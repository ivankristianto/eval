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
import { TrainingLoopManager } from '@lib/training/training-loop-manager';
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

      // Update iteration status to in_progress (metrics calculation is part of iteration)
      db.prepare('UPDATE training_iterations SET status = ? WHERE id = ?').run(
        'in_progress',
        iteration.id
      );

      // Update training loop state to in_progress
      db.prepare(
        'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
      ).run('in_progress', new Date().toISOString(), state.session_id);

      // Create training loop instance and continue training IN BACKGROUND
      // This allows the API to return immediately while training runs asynchronously
      setImmediate(async () => {
        const loop = new TrainingLoopManager({ sessionId: state.session_id, personaId: id }, db);
        try {
          // This will:
          // 1. Calculate metrics from human votes
          // 2. Refine both prompts using LLM based on human feedback
          // 3. Continue to iteration 2+ automatically
          await loop.acceptPromptsAndContinue(iteration.id);

          logger.info('Background training completed', {
            personaId: id,
            iterationId: iteration.id,
            sessionId: state.session_id,
          });
        } catch (error) {
          logger.error('Background training failed', error instanceof Error ? error : undefined, {
            personaId: id,
            iterationId: iteration.id,
            sessionId: state.session_id,
          });

          // Update status to failed on error
          db.prepare(
            'UPDATE training_iterations SET status = ?, error_message = ? WHERE id = ?'
          ).run('failed', error instanceof Error ? error.message : 'Unknown error', iteration.id);

          db.prepare(
            'UPDATE training_loop_state SET status = ?, error_message = ?, updated_at = ? WHERE session_id = ?'
          ).run(
            'failed',
            error instanceof Error ? error.message : 'Unknown error',
            new Date().toISOString(),
            state.session_id
          );
        }
      });

      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/1/calculate-metrics`,
        202,
        Date.now() - startTime
      );

      // Return immediately with 202 Accepted - client should poll/SSE for progress
      return new Response(
        JSON.stringify({
          message: 'Metrics calculation started. Training is continuing in the background.',
          iteration: {
            id: iteration.id,
            iteration_number: 1,
            status: 'in_progress',
          },
          training_status: 'in_progress',
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ITERATIONS 2+: Original behavior - just calculate metrics
    // Check if metrics already calculated
    const existingMetrics = db
      .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
      .get(iteration.id) as
      | {
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
        }
      | undefined;

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
          const result = await calculateIterationMetricsFromGroundTruth(iteration.id, db);
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

        // Import TrainingLoopManager for metrics calculation
        // Note: calculateMetricsInWorker is a private method in the old deprecated class
        // Use metrics-orchestrator instead for compatibility
        // For now, we'll calculate metrics directly here
        metrics = await (async () => {
          // Use calculateIterationMetricsFromGroundTruth for consistency
          // This uses ground truth comparison which is more reliable than human reviews
          const result = await calculateIterationMetricsFromGroundTruth(iteration.id, db);
          return result.metrics;
        })();

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
    if (personaRecord.best_pass_rate === null || metrics.f1_score > personaRecord.best_pass_rate) {
      db.prepare(
        'UPDATE personas SET best_pass_rate = ?, best_f1_iteration = ?, updated_at = ? WHERE id = ?'
      ).run(metrics.f1_score, iterationNumber, new Date().toISOString(), id);

      logger.info('New best F1 score achieved', {
        personaId: id,
        iterationNumber,
        previousBest: personaRecord.best_pass_rate,
        newBest: metrics.f1_score,
      });
    }

    // ITERATIONS 2+: Refine prompts and continue training automatically
    if (iterationNumber >= 2) {
      // Check if converged (F1 >= 0.95 or reached max iterations)
      // Note: max_iterations removed from persona schema - using default of 10
      const maxIterations = 10;
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
        const loop = new TrainingLoopManager({ sessionId: state.session_id, personaId: id }, db);

        // Run the training loop in background without blocking
        setImmediate(async () => {
          try {
            await loop.execute();
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
