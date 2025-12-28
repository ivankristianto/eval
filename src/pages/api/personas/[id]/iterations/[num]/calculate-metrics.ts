/**
 * POST /api/personas/[id]/iterations/[num]/calculate-metrics
 * Calculate metrics AUTOMATICALLY from ground truth (no human review required)
 * LEGACY: Also supports manual metrics calculation from human reviews
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { calculateIterationMetricsFromGroundTruth } from '@lib/evaluation/metrics-orchestrator';
import type { JudgeResult } from '@lib/training/training-loop';

/**
 * POST /api/personas/[id]/iterations/[num]/calculate-metrics
 * Calculates metrics AUTOMATICALLY from ground truth comparison.
 * Also supports LEGACY flow for manual human review validation.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id, num } = params;

    if (!id || !num) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Persona ID and iteration number are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Iteration number must be a valid integer',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as any;
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Persona not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get iteration
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, iterationNumber) as any;

    if (!iteration) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: `Iteration ${iterationNumber} not found for persona`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if metrics already calculated
    const existingMetrics = db
      .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
      .get(iteration.id) as any;

    let metrics: {
      f1_score: number;
      precision: number;
      recall: number;
      cohens_kappa: number;
      accuracy: number;
      confusion_matrix: {
        true_positives: number;
        true_negatives: number;
        false_positives: number;
        false_negatives: number;
      };
    };

    if (existingMetrics) {
      // Metrics already exist, use them instead of recalculating
      console.info('Metrics already calculated, using existing', {
        personaId: id,
        iterationNumber,
        metricsId: existingMetrics.id,
      });

      metrics = {
        f1_score: existingMetrics.f1_score,
        precision: existingMetrics.precision,
        recall: existingMetrics.recall,
        cohens_kappa: existingMetrics.cohens_kappa,
        accuracy: existingMetrics.accuracy,
        confusion_matrix: {
          true_positives: existingMetrics.true_positives,
          true_negatives: existingMetrics.true_negatives,
          false_positives: existingMetrics.false_positives,
          false_negatives: existingMetrics.false_negatives,
        },
      };
    } else {
      // Check if this is automatic or manual calculation
      const body = request.headers.get('content-type')?.includes('application/json')
        ? await request.json().catch(() => ({}))
        : {};

      const useAutomaticCalculation = body.automatic !== false; // Default to automatic

      if (useAutomaticCalculation) {
        // AUTOMATIC: Calculate metrics from ground truth (no human review required)
        try {
          const result = calculateIterationMetricsFromGroundTruth(iteration.id, db);
          metrics = result.metrics;
        } catch (error) {
          // If automatic calculation fails, fall back to manual mode check
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn('Automatic metrics calculation failed:', errorMessage);
          throw error;
        }
      } else {
        // LEGACY: Manual metrics calculation from human reviews
        // Verify all judge decisions have human reviews
        const totalDecisions = db
          .prepare('SELECT COUNT(*) as count FROM judge_decisions WHERE iteration_id = ?')
          .get(iteration.id) as { count: number };

        const reviewedDecisions = db
          .prepare(
            `SELECT COUNT(*) as count FROM human_reviews hr
             JOIN judge_decisions jd ON jd.id = hr.judge_decision_id
             WHERE jd.iteration_id = ?`
          )
          .get(iteration.id) as { count: number };

        if (reviewedDecisions.count < totalDecisions.count) {
          return new Response(
            JSON.stringify({
              error: 'INCOMPLETE_REVIEWS',
              message: `Only ${reviewedDecisions.count} of ${totalDecisions.count} decisions have been reviewed`,
              hint: 'Use automatic=true for ground-truth based metrics calculation',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Fetch all judge decisions with human reviews
        const judgeResults = db
          .prepare(
            `SELECT
               jd.judge_decision,
               hr.human_decision
             FROM judge_decisions jd
             JOIN human_reviews hr ON hr.judge_decision_id = jd.id
             WHERE jd.iteration_id = ?`
          )
          .all(iteration.id) as JudgeResult[];

        // Import IterativeTrainingLoop for metrics calculation
        const { IterativeTrainingLoop } = await import('@lib/training/training-loop');
        const trainingLoop = new IterativeTrainingLoop('', id, db);
        metrics = await trainingLoop.calculateMetricsInWorker(judgeResults);
      }
    }

    // Update iteration status to completed
    db.prepare('UPDATE training_iterations SET status = ?, completed_at = ? WHERE id = ?').run(
      'completed',
      new Date().toISOString(),
      iteration.id
    );

    // Update persona best scores if this iteration is better
    if (persona.best_f1_score === null || metrics.f1_score > persona.best_f1_score) {
      db.prepare(
        'UPDATE personas SET best_f1_score = ?, best_f1_iteration = ?, updated_at = ? WHERE id = ?'
      ).run(metrics.f1_score, iterationNumber, new Date().toISOString(), id);
    }

    return new Response(
      JSON.stringify({
        metrics,
        iteration: {
          id: iteration.id,
          iteration_number: iterationNumber,
          status: 'completed',
          completed_at: iteration.completed_at,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/personas/[id]/iterations/[num]/calculate-metrics error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
