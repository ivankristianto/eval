/**
 * POST /api/personas/[id]/iterations/[num]/calculate-metrics
 * Calculate metrics for an iteration after all human reviews are complete
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../../lib/db';
import { IterativeTrainingLoop } from '../../../../../../lib/training-loop';
import type { JudgeResult } from '../../../../../../lib/training-loop';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/personas/[id]/iterations/[num]/calculate-metrics
 * Calculates metrics for a completed iteration and determines next steps.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params }) => {
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

    let metrics;

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
      // Calculate new metrics
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

      // Calculate metrics
      const trainingLoop = new IterativeTrainingLoop('', id, db);
      metrics = await trainingLoop.calculateMetricsInWorker(judgeResults);

      // Generate ID for metrics record
      const metricsId = uuidv4();

      // Save metrics to database
      db.prepare(
        `INSERT INTO iteration_metrics
         (id, iteration_id, f1_score, precision, recall, cohens_kappa, accuracy,
          true_positives, true_negatives, false_positives, false_negatives, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        metricsId,
        iteration.id,
        metrics.f1_score,
        metrics.precision,
        metrics.recall,
        metrics.cohens_kappa,
        metrics.accuracy,
        metrics.confusion_matrix.true_positives,
        metrics.confusion_matrix.true_negatives,
        metrics.confusion_matrix.false_positives,
        metrics.confusion_matrix.false_negatives,
        new Date().toISOString()
      );
    }

    // Update iteration status to completed
    db.prepare(
      'UPDATE training_iterations SET status = ?, completed_at = ? WHERE id = ?'
    ).run('completed', new Date().toISOString(), iteration.id);

    // Update persona best scores if this iteration is better
    if (persona.best_f1_score === null || metrics.f1_score > persona.best_f1_score) {
      db.prepare(
        'UPDATE personas SET best_f1_score = ?, best_f1_iteration = ?, updated_at = ? WHERE id = ?'
      ).run(metrics.f1_score, iterationNumber, new Date().toISOString(), id);
    }

    // Determine next action
    const targetReached = metrics.f1_score >= persona.target_f1_score;
    const maxIterationsReached = iterationNumber >= persona.max_iterations;

    if (targetReached || maxIterationsReached) {
      // Mark training as complete
      db.prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?').run(
        'trained',
        new Date().toISOString(),
        id
      );

      // Update training loop state to completed
      db.prepare(
        'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE persona_id = ? AND status = ?'
      ).run('completed', new Date().toISOString(), id, 'in_progress');

      return new Response(
        JSON.stringify({
          metrics,
          status: 'training_complete',
          reason: targetReached ? 'target_reached' : 'max_iterations_reached',
          message: targetReached
            ? `Target F1 score of ${(persona.target_f1_score * 100).toFixed(0)}% reached!`
            : `Maximum ${persona.max_iterations} iterations completed.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Continue to next iteration - create it directly
    const nextIterationNumber = iterationNumber + 1;

    // Get current judge prompt (either from latest prompt version or initial)
    const judgePrompt = db
      .prepare(
        'SELECT prompt_text FROM judge_prompt_versions WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1'
      )
      .get(id) as { prompt_text: string } | undefined;

    const judgePromptText = judgePrompt?.prompt_text || persona.task_prompt;

    // Create next training iteration record
    const nextIterationId = uuidv4();
    db.prepare(
      `INSERT INTO training_iterations
      (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
       status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nextIterationId,
      id,
      nextIterationNumber,
      persona.judge_model_id,
      judgePromptText,
      'in_progress',
      0,
      0,
      new Date().toISOString()
    );

    // Update persona current iteration
    db.prepare('UPDATE personas SET current_iteration = ?, updated_at = ? WHERE id = ?').run(
      nextIterationNumber,
      new Date().toISOString(),
      id
    );

    // Update training loop state with new iteration
    db.prepare(
      'UPDATE training_loop_state SET current_iteration = ?, updated_at = ? WHERE persona_id = ? AND status = ?'
    ).run(nextIterationNumber, new Date().toISOString(), id, 'in_progress');

    // Get session ID for the training loop
    const session = db
      .prepare(
        'SELECT session_id FROM training_loop_state WHERE persona_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(id, 'in_progress') as { session_id: string } | undefined;

    const sessionId = session?.session_id || uuidv4();

    // Execute training loop for next iteration
    const nextTrainingLoop = new IterativeTrainingLoop(sessionId, id, db);
    await nextTrainingLoop.execute([]);

    return new Response(
      JSON.stringify({
        metrics,
        status: 'continue',
        message: 'Metrics calculated. Next iteration started.',
        next_iteration: {
          id: nextIterationId,
          iteration_number: nextIterationNumber,
          status: 'in_progress',
          started_at: new Date().toISOString(),
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
