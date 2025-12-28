/**
 * POST /api/personas/[id]/iterations/[num]/calculate-metrics
 * Calculate metrics and continue training.
 * For iteration 1: Calculate metrics from human reviews → Refine prompts → Continue to iteration 2+
 * For iterations 2+: Calculate metrics AUTOMATICALLY from ground truth
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { calculateIterationMetricsFromGroundTruth } from '@lib/evaluation/metrics-orchestrator';
import type { JudgeResult } from '@lib/training/training-loop';
import { IterativeTrainingLoop } from '@lib/training/training-loop';

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

    // ITERATION 1 SPECIAL HANDLING: Calculate metrics, refine prompts, and continue to iteration 2+
    if (iterationNumber === 1) {
      // Get training loop state
      const state = db
        .prepare(
          `SELECT session_id FROM training_loop_state
           WHERE persona_id = ? AND status = 'awaiting_human_review'
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(id) as { session_id: string } | undefined;

      if (!state) {
        return new Response(
          JSON.stringify({
            error: 'NO_ACTIVE_SESSION',
            message: 'No training session awaiting human review found for this persona',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create training loop instance and continue training
      const loop = new IterativeTrainingLoop(state.session_id, id, db);

      // This will:
      // 1. Calculate metrics from human votes
      // 2. Refine both prompts using LLM based on human feedback
      // 3. Continue to iteration 2+ automatically
      await loop.acceptPromptsAndContinue(iteration.id);

      // Get final state after training continues
      const finalState = db
        .prepare('SELECT status, current_iteration FROM training_loop_state WHERE session_id = ?')
        .get(state.session_id) as { status: string; current_iteration: number } | undefined;

      const latestIteration = db
        .prepare('SELECT iteration_number, status FROM training_iterations WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1')
        .get(id) as { iteration_number: number; status: string } | undefined;

      // Get the calculated metrics
      const metricsRow = db
        .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
        .get(iteration.id) as any;

      return new Response(
        JSON.stringify({
          message: 'Iteration 1 complete. Metrics calculated, prompts refined, and training continued.',
          metrics: metricsRow ? {
            f1_score: metricsRow.f1_score,
            precision: metricsRow.precision,
            recall: metricsRow.recall,
            cohens_kappa: metricsRow.cohens_kappa,
            accuracy: metricsRow.accuracy,
            confusion_matrix: {
              true_positives: metricsRow.true_positives,
              true_negatives: metricsRow.true_negatives,
              false_positives: metricsRow.false_positives,
              false_negatives: metricsRow.false_negatives,
            },
          } : null,
          iteration: {
            id: iteration.id,
            iteration_number: 1,
            status: 'completed',
          },
          training_status: finalState?.status || 'unknown',
          current_iteration: finalState?.current_iteration,
          latest_iteration: latestIteration?.iteration_number,
          latest_iteration_status: latestIteration?.status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ITERATIONS 2+: Original behavior - just calculate metrics
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
