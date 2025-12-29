/**
 * POST /api/personas/[id]/iterations/[num]/calculate-metrics
 * Calculate metrics and continue training.
 * For iteration 1: Calculate metrics from human reviews → Refine prompts → Continue to iteration 2+
 * For iterations 2+: Calculate metrics AUTOMATICALLY from ground truth
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration, Persona } from '@src-types/training';
import { calculateIterationMetricsFromGroundTruth } from '@lib/evaluation/metrics-orchestrator';
import type { JudgeResult } from '@lib/training/training-loop';
import { IterativeTrainingLoop } from '@lib/training/training-loop';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:CalculateMetrics');

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
  const startTime = Date.now();
  const { id, num } = params;

  try {
    if (!id || !num) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/iterations/[num]/calculate-metrics',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID and iteration number are required', 'INVALID_REQUEST');
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/calculate-metrics`,
        400,
        Date.now() - startTime
      );
      return badRequest('Iteration number must be a valid integer', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/calculate-metrics`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Get iteration
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, iterationNumber) as TrainingIteration | undefined;

    if (!iteration) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/calculate-metrics`,
        404,
        Date.now() - startTime
      );
      return notFound('Iteration');
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
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/iterations/1/calculate-metrics`,
          400,
          Date.now() - startTime
        );
        return badRequest(
          'No training session awaiting human review found for this persona',
          'NO_ACTIVE_SESSION'
        );
      }

      logger.info('Calculating iteration 1 metrics from human reviews and continuing training', {
        personaId: id,
        iterationId: iteration.id,
        sessionId: state.session_id,
      });

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
        .prepare(
          'SELECT iteration_number, status FROM training_iterations WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1'
        )
        .get(id) as { iteration_number: number; status: string } | undefined;

      // Get the calculated metrics
      const metricsRow = db
        .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
        .get(iteration.id) as {
        id: string;
        f1_score: number | null;
        precision: number | null;
        recall: number | null;
        cohens_kappa: number | null;
        accuracy: number | null;
        true_positives: number | null;
        true_negatives: number | null;
        false_positives: number | null;
        false_negatives: number | null;
      } | undefined;

      logger.info('Iteration 1 metrics calculated and training continued', {
        personaId: id,
        finalState: finalState?.status,
        currentIteration: finalState?.current_iteration,
        latestIteration: latestIteration?.iteration_number,
        f1Score: metricsRow?.f1_score,
      });
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/1/calculate-metrics`,
        200,
        Date.now() - startTime
      );

      return new Response(
        JSON.stringify({
          message:
            'Iteration 1 complete. Metrics calculated, prompts refined, and training continued.',
          metrics: metricsRow
            ? {
                f1_score: metricsRow.f1_score ?? 0,
                precision: metricsRow.precision ?? 0,
                recall: metricsRow.recall ?? 0,
                cohens_kappa: metricsRow.cohens_kappa ?? 0,
                accuracy: metricsRow.accuracy ?? 0,
                confusion_matrix: {
                  true_positives: metricsRow.true_positives ?? 0,
                  true_negatives: metricsRow.true_negatives ?? 0,
                  false_positives: metricsRow.false_positives ?? 0,
                  false_negatives: metricsRow.false_negatives ?? 0,
                },
              }
            : null,
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
      .get(iteration.id) as {
      id: string;
      f1_score: number | null;
      precision: number | null;
      recall: number | null;
      cohens_kappa: number | null;
      accuracy: number | null;
      true_positives: number;
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
    } | undefined;

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
      logger.info('Metrics already calculated, using existing', {
        personaId: id,
        iterationNumber,
        metricsId: existingMetrics.id,
      });

      metrics = {
        f1_score: existingMetrics.f1_score ?? 0,
        precision: existingMetrics.precision ?? 0,
        recall: existingMetrics.recall ?? 0,
        cohens_kappa: existingMetrics.cohens_kappa ?? 0,
        accuracy: existingMetrics.accuracy ?? 0,
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
        logger.info('Calculating iteration metrics from ground truth', {
          personaId: id,
          iterationNumber,
        });

        try {
          const result = calculateIterationMetricsFromGroundTruth(iteration.id, db);
          metrics = result.metrics;

          logger.info('Ground truth metrics calculated successfully', {
            personaId: id,
            iterationNumber,
            f1Score: metrics.f1_score,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('Automatic metrics calculation failed', {
            personaId: id,
            iterationNumber,
            error: errorMessage,
          });
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
          logger.logApiRequest(
            'POST',
            `/api/personas/${id}/iterations/${num}/calculate-metrics`,
            400,
            Date.now() - startTime
          );
          return badRequest(
            `Only ${reviewedDecisions.count} of ${totalDecisions.count} decisions have been reviewed`,
            'INCOMPLETE_REVIEWS',
            { hint: 'Use automatic=true for ground-truth based metrics calculation' }
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
        const trainingLoop = new IterativeTrainingLoop('', id, db);
        metrics = await trainingLoop.calculateMetricsInWorker(judgeResults);

        logger.info('Human review metrics calculated successfully', {
          personaId: id,
          iterationNumber,
          f1Score: metrics.f1_score,
        });
      }
    }

    // Update iteration status to completed
    db.prepare('UPDATE training_iterations SET status = ?, completed_at = ? WHERE id = ?').run(
      'completed',
      new Date().toISOString(),
      iteration.id
    );

    // Update persona best scores if this iteration is better
    const personaRecord = persona as Persona;
    if (personaRecord.best_f1_score === null || metrics.f1_score > personaRecord.best_f1_score) {
      db.prepare(
        'UPDATE personas SET best_f1_score = ?, best_f1_iteration = ?, updated_at = ? WHERE id = ?'
      ).run(metrics.f1_score, iterationNumber, new Date().toISOString(), id);

      logger.info('New best F1 score achieved', {
        personaId: id,
        iterationNumber,
        previousBest: personaRecord.best_f1_score,
        newBest: metrics.f1_score,
      });
    }

    // ITERATIONS 2+: Refine prompts and continue training automatically
    if (iterationNumber >= 2) {
      // Check if converged (F1 >= 0.95 or reached max iterations)
      const maxIterations = personaRecord.max_iterations || 10;
      const converged = metrics.f1_score >= 0.95 || iterationNumber >= maxIterations;

      if (converged) {
        logger.info('Training converged', {
          personaId: id,
          iterationNumber,
          f1Score: metrics.f1_score,
        });

        // Update persona status to trained
        db.prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?').run(
          'trained',
          new Date().toISOString(),
          id
        );

        // Update training loop state
        db.prepare(
          'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE persona_id = ?'
        ).run('completed', new Date().toISOString(), id);
      } else {
        // Not converged - continue training loop which will refine prompts automatically
        logger.info('Continuing training loop to refine prompts and start next iteration', {
          personaId: id,
          iterationNumber,
          f1Score: metrics.f1_score,
        });

        // Get or create training loop session
        let state = db
          .prepare('SELECT session_id FROM training_loop_state WHERE persona_id = ?')
          .get(id) as { session_id: string } | undefined;

        if (!state) {
          // Create new training loop state
          const sessionId = `session_${id}_${Date.now()}`;
          db.prepare(
            'INSERT INTO training_loop_state (session_id, persona_id, status, current_iteration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
            sessionId,
            id,
            'in_progress',
            iterationNumber,
            new Date().toISOString(),
            new Date().toISOString()
          );
          state = { session_id: sessionId };
        }

        // Update training loop state to in_progress
        db.prepare(
          'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
        ).run('in_progress', new Date().toISOString(), state.session_id);

        // Update persona status to training
        db.prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?').run(
          'training',
          new Date().toISOString(),
          id
        );

        // Create training loop and execute - this will refine prompts and continue to next iteration
        const loop = new IterativeTrainingLoop(state.session_id, id, db);

        // Run the training loop in background without blocking
        setImmediate(async () => {
          try {
            await loop.execute([]);
            logger.info('Training loop completed', {
              personaId: id,
              sessionId: state.session_id,
            });
          } catch (error) {
            logger.error('Training loop error', error instanceof Error ? error : undefined, {
              sessionId: state.session_id,
            });
          }
        });

        logger.info('Training loop started in background', {
          personaId: id,
          sessionId: state.session_id,
        });
      }
    }

    logger.logApiRequest(
      'POST',
      `/api/personas/${id}/iterations/${num}/calculate-metrics`,
      200,
      Date.now() - startTime
    );

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
    logger.logApiError(
      'POST',
      `/api/personas/${id}/iterations/${num}/calculate-metrics`,
      error as Error
    );
    return createErrorResponse(error);
  }
};
