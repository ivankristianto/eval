/**
 * POST /api/personas/[id]/training/resume
 * Resume a paused training iteration for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration } from '@src-types/training';
import { TrainingSessionManager } from '@lib/training/training-session-manager';
import { badRequest, notFound, internalError, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Resume');

/**
 * Persona database row type
 */
interface PersonaRow {
  id: string;
  status: string;
  name: string;
}

/**
 * Training session database row type
 */
interface TrainingSessionRow {
  session_id: string;
  persona_id: string;
  status: string;
  current_iteration: number;
  created_at: string;
}

/**
 * Validates that a string is a valid UUID v4
 * @param id - String to validate
 * @returns true if valid UUID, false otherwise
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * POST /api/personas/[id]/training/resume
 * Resumes a paused training iteration.
 * Loads checkpoint and continues from where it left off.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    // Validate persona ID is provided
    if (!id) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/training/resume',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    // Validate persona ID is a valid UUID
    if (!isValidUUID(id)) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/resume`,
        400,
        Date.now() - startTime
      );
      return badRequest('Invalid persona ID format. Must be a valid UUID.', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id, status, name FROM personas WHERE id = ?').get(id) as
      | PersonaRow
      | undefined;
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/resume`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Load checkpoint and verify integrity (before transaction)
    const stateManager = new TrainingSessionManager(db);

    // Find paused training session and perform state transition in transaction
    // This prevents race conditions from concurrent resume requests
    let pausedSession: TrainingSessionRow | undefined;
    let checkpointSessionId = ''; // Initialize to avoid TS2454

    try {
      const transaction = db.transaction(() => {
        // Re-check session status within transaction to prevent race conditions
        // Check for both paused and in_progress for idempotency
        pausedSession = db
          .prepare(
            `SELECT session_id, persona_id, status, current_iteration, created_at
             FROM training_loop_state
             WHERE persona_id = ?
             AND status IN ('paused', 'in_progress')
             ORDER BY created_at DESC
             LIMIT 1`
          )
          .get(id) as TrainingSessionRow | undefined;

        if (!pausedSession) {
          // Check if session is in awaiting_human_review state
          const awaitingReview = db
            .prepare(
              `SELECT session_id, current_iteration
               FROM training_loop_state
               WHERE persona_id = ? AND status = 'awaiting_human_review'
               ORDER BY created_at DESC LIMIT 1`
            )
            .get(id) as { session_id: string; current_iteration: number } | undefined;

          if (awaitingReview) {
            throw new Error('AWAITING_HUMAN_REVIEW');
          }
          throw new Error('NO_SESSION');
        }

        // Idempotency: If already in_progress, skip state updates
        if (pausedSession.status === 'in_progress') {
          throw new Error('ALREADY_RESUMED');
        }

        if (pausedSession.status !== 'paused') {
          throw new Error('NO_PAUSED_SESSION');
        }

        checkpointSessionId = pausedSession.session_id;

        // Update current iteration status to in_progress
        db.prepare(
          `UPDATE training_iterations
           SET status = 'in_progress'
           WHERE persona_id = ?
           AND iteration_number = ?`
        ).run(id, pausedSession.current_iteration);

        // Update persona status
        db.prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?').run(
          'training',
          new Date().toISOString(),
          id
        );

        // Update training loop state to in_progress
        db.prepare(
          `UPDATE training_loop_state
           SET status = 'in_progress', pause_reason = NULL, updated_at = ?
           WHERE session_id = ?`
        ).run(new Date().toISOString(), pausedSession.session_id);
      });

      // Execute transaction
      transaction();
    } catch (error) {
      if (error instanceof Error && error.message === 'ALREADY_RESUMED') {
        // Idempotency: Return success if already resumed
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/resume`,
          200,
          Date.now() - startTime
        );
        return new Response(
          JSON.stringify({
            session_id: pausedSession!.session_id,
            status: 'in_progress',
            iteration_number: pausedSession!.current_iteration,
            message: 'Training already resumed',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (error instanceof Error && error.message === 'AWAITING_HUMAN_REVIEW') {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/resume`,
          400,
          Date.now() - startTime
        );
        return badRequest(
          'Iteration 1 is awaiting human review. Use the accept-prompt endpoint to continue.',
          'TRAINING_STATE_ERROR'
        );
      }
      if (error instanceof Error && error.message === 'NO_PAUSED_SESSION') {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/resume`,
          400,
          Date.now() - startTime
        );
        return badRequest(
          'No paused training session found for this persona',
          'TRAINING_STATE_ERROR'
        );
      }
      if (error instanceof Error && error.message === 'NO_SESSION') {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/resume`,
          404,
          Date.now() - startTime
        );
        return notFound('Training session');
      }
      throw error;
    }

    // Load checkpoint after transaction succeeds
    let checkpoint = stateManager.resume(checkpointSessionId);

    // If no checkpoint exists (paused before checkpoint feature was added),
    // create one from current database state
    if (!checkpoint) {
      logger.info('No checkpoint found, creating from current state', {
        sessionId: checkpointSessionId,
        personaId: id,
        iteration: pausedSession!.current_iteration,
      });

      // Get current iteration data
      const iteration = db
        .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
        .get(id, pausedSession!.current_iteration) as TrainingIteration | undefined;

      if (iteration) {
        // Get current metrics if available
        const metrics = db
          .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
          .get(iteration.id) as
          | {
              precision: number | null;
              recall: number | null;
              f1_score: number | null;
              cohens_kappa: number | null;
              accuracy: number | null;
              true_positives: number | null;
              true_negatives: number | null;
              false_positives: number | null;
              false_negatives: number | null;
            }
          | undefined;

        // Get evaluated decision IDs
        const evaluatedDecisions = db
          .prepare('SELECT id FROM judge_decisions WHERE iteration_id = ?')
          .all(iteration.id) as Array<{ id: string }>;

        // Get current judge prompt
        const judgePrompt = db
          .prepare(
            'SELECT prompt_text FROM judge_prompt_versions WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1'
          )
          .get(id) as { prompt_text: string } | undefined;

        // Get task prompt from persona if judge prompt not found
        const personaFull = db.prepare('SELECT task_prompt FROM personas WHERE id = ?').get(id) as
          | { task_prompt: string }
          | undefined;

        const currentPrompt =
          judgePrompt?.prompt_text ||
          personaFull?.task_prompt ||
          iteration.judge_prompt_text ||
          'Initial judge prompt';

        // Build checkpoint data with proper defaults
        const checkpointData = {
          iterationNumber: pausedSession!.current_iteration,
          evaluatedResultCount: evaluatedDecisions.length,
          metricsSnapshot: {
            f1_score: metrics?.f1_score ?? 0,
            precision: metrics?.precision ?? 0,
            recall: metrics?.recall ?? 0,
            accuracy: metrics?.accuracy ?? 0,
            cohens_kappa: metrics?.cohens_kappa ?? 0,
            confusion_matrix: {
              true_positives: metrics?.true_positives ?? 0,
              true_negatives: metrics?.true_negatives ?? 0,
              false_positives: metrics?.false_positives ?? 0,
              false_negatives: metrics?.false_negatives ?? 0,
            },
          },
          evaluatedResultIds: evaluatedDecisions.map((d) => d.id),
          currentPrompt,
        };

        // Verify the checkpoint data BEFORE saving to catch issues early
        const metricsSnapshot = checkpointData.metricsSnapshot;
        const hasValidMetrics =
          typeof metricsSnapshot.f1_score === 'number' &&
          typeof metricsSnapshot.precision === 'number' &&
          typeof metricsSnapshot.recall === 'number' &&
          typeof metricsSnapshot.accuracy === 'number' &&
          typeof metricsSnapshot.cohens_kappa === 'number' &&
          metricsSnapshot.confusion_matrix &&
          typeof metricsSnapshot.confusion_matrix.true_positives === 'number' &&
          typeof metricsSnapshot.confusion_matrix.true_negatives === 'number' &&
          typeof metricsSnapshot.confusion_matrix.false_positives === 'number' &&
          typeof metricsSnapshot.confusion_matrix.false_negatives === 'number' &&
          Array.isArray(checkpointData.evaluatedResultIds) &&
          checkpointData.currentPrompt &&
          checkpointData.currentPrompt.length > 0;

        if (!hasValidMetrics) {
          // Rollback state if checkpoint data is invalid
          db.prepare(
            'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
          ).run('paused', new Date().toISOString(), checkpointSessionId);

          db.prepare(
            `UPDATE training_iterations
             SET status = 'paused'
             WHERE persona_id = ?
             AND iteration_number = ?`
          ).run(id, pausedSession!.current_iteration);

          return internalError(
            'Checkpoint data validation failed. Please check your training data and try again.'
          );
        }

        // Save checkpoint
        stateManager.saveCheckpoint(checkpointSessionId, id, checkpointData);

        // Use the newly created checkpoint (which we've already validated)
        checkpoint = checkpointData;
      } else {
        // Rollback state if we can't create a checkpoint
        db.prepare(
          'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
        ).run('paused', new Date().toISOString(), checkpointSessionId);

        db.prepare(
          `UPDATE training_iterations
           SET status = 'paused'
           WHERE persona_id = ?
           AND iteration_number = ?`
        ).run(id, pausedSession!.current_iteration);

        return internalError(
          'Could not find or create checkpoint. Iteration data may be missing. State has been preserved.'
        );
      }
    }

    // Verify checkpoint integrity (only verify if we loaded from database, not if we just created)
    const isCheckpointValid =
      checkpoint !== null ? true : stateManager.verifyCheckpointIntegrity(checkpointSessionId);
    if (!isCheckpointValid) {
      // Rollback state if checkpoint is invalid
      db.prepare(
        'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
      ).run('paused', new Date().toISOString(), checkpointSessionId);

      db.prepare(
        `UPDATE training_iterations
         SET status = 'paused'
         WHERE persona_id = ?
         AND iteration_number = ?`
      ).run(id, pausedSession!.current_iteration);

      return internalError('Checkpoint data is corrupted or incomplete. State has been preserved.');
    }

    // Training has been resumed successfully
    // The transaction already updated all necessary state:
    // - training_loop_state status = 'in_progress'
    // - training_iterations status = 'in_progress'
    // - persona status = 'training'
    // User can now continue with human reviews or calculate metrics

    // Log successful resume operation
    logger.info('Training resumed', {
      personaId: id,
      sessionId: checkpointSessionId,
      iterationNumber: pausedSession!.current_iteration,
      f1Score: checkpoint?.metricsSnapshot.f1_score ?? 0,
      evaluatedCount: checkpoint?.evaluatedResultCount ?? 0,
    });
    logger.logApiRequest(
      'POST',
      `/api/personas/${id}/training/resume`,
      200,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        session_id: checkpointSessionId,
        status: 'in_progress',
        iteration_number: pausedSession!.current_iteration,
        checkpoint: {
          iteration_number: checkpoint?.iterationNumber ?? 0,
          evaluated_result_count: checkpoint?.evaluatedResultCount ?? 0,
          f1_score: checkpoint?.metricsSnapshot.f1_score ?? 0,
        },
        message: 'Training resumed successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/training/resume`, error as Error);
    return createErrorResponse(error);
  }
};
