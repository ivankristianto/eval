/**
 * POST /api/personas/[id]/training/pause
 * Pause an in-progress training iteration for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration, Persona } from '@src-types/training';
import { TrainingStateManager } from '@lib/training/deprecated/training-state';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Pause');

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
 * POST /api/personas/[id]/training/pause
 * Pauses an in-progress training iteration.
 * Saves checkpoint and sets status to 'paused'.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    // Validate persona ID is provided
    if (!id) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/training/pause',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    // Validate persona ID is a valid UUID
    if (!isValidUUID(id)) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/pause`,
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
        `/api/personas/${id}/training/pause`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Find active or paused training session (for idempotency)
    const activeSession = db
      .prepare(
        `SELECT session_id, persona_id, status, current_iteration, created_at, pause_reason
         FROM training_loop_state
         WHERE persona_id = ?
         AND status IN ('in_progress', 'paused')
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(id) as (TrainingSessionRow & { pause_reason: string | null }) | undefined;

    if (!activeSession) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/pause`,
        400,
        Date.now() - startTime
      );
      return badRequest('No active training session found for this persona', 'NO_ACTIVE_SESSION');
    }

    // Idempotency: If already paused, return success without modification
    if (activeSession.status === 'paused') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/pause`,
        200,
        Date.now() - startTime
      );
      return new Response(
        JSON.stringify({
          session_id: activeSession.session_id,
          status: 'paused',
          pause_reason: activeSession.pause_reason || 'Unknown',
          iteration_number: activeSession.current_iteration,
          message: 'Training already paused',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body for pause reason (optional)
    let pauseReason = 'User requested pause';
    try {
      const body = await request.json();
      if (body.reason !== undefined && body.reason !== null) {
        // Validate pause reason is a string
        if (typeof body.reason !== 'string') {
          logger.logApiRequest(
            'POST',
            `/api/personas/${id}/training/pause`,
            400,
            Date.now() - startTime
          );
          return badRequest('Pause reason must be a string', 'INVALID_REQUEST');
        }

        // Validate pause reason length
        if (body.reason.length > 500) {
          logger.logApiRequest(
            'POST',
            `/api/personas/${id}/training/pause`,
            400,
            Date.now() - startTime
          );
          return badRequest('Pause reason must not exceed 500 characters', 'INVALID_REQUEST');
        }

        pauseReason = body.reason.trim();
      }
    } catch (error) {
      // If JSON parsing fails, check if it's not a SyntaxError
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
      // Empty or invalid JSON body, use default reason
    }

    // Create checkpoint before pausing
    const stateManager = new TrainingStateManager(db);

    // Get current iteration data for checkpoint
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, activeSession.current_iteration) as TrainingIteration | undefined;

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
            true_positives: number;
            true_negatives: number;
            false_positives: number;
            false_negatives: number;
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

      const currentPrompt =
        judgePrompt?.prompt_text || (persona as Persona).task_prompt || 'No prompt available';

      // Build checkpoint data
      const checkpointData = {
        iterationNumber: activeSession.current_iteration,
        evaluatedResultCount: evaluatedDecisions.length,
        metricsSnapshot: metrics
          ? {
              f1_score: metrics.f1_score ?? 0,
              precision: metrics.precision ?? 0,
              recall: metrics.recall ?? 0,
              accuracy: metrics.accuracy ?? 0,
              cohens_kappa: metrics.cohens_kappa ?? 0,
              confusion_matrix: {
                true_positives: metrics.true_positives,
                true_negatives: metrics.true_negatives,
                false_positives: metrics.false_positives,
                false_negatives: metrics.false_negatives,
              },
            }
          : {
              f1_score: 0,
              precision: 0,
              recall: 0,
              accuracy: 0,
              cohens_kappa: 0,
              confusion_matrix: {
                true_positives: 0,
                true_negatives: 0,
                false_positives: 0,
                false_negatives: 0,
              },
            },
        evaluatedResultIds: evaluatedDecisions.map((d) => d.id),
        currentPrompt,
      };

      // Save checkpoint
      stateManager.saveCheckpoint(activeSession.session_id, id, checkpointData);
    }

    // Perform all database operations in a transaction
    const transaction = db.transaction(() => {
      // Pause the training session
      stateManager.pause(activeSession.session_id, pauseReason);

      // Update current iteration status to paused
      db.prepare(
        `UPDATE training_iterations
         SET status = 'paused'
         WHERE persona_id = ?
         AND iteration_number = ?`
      ).run(id, activeSession.current_iteration);

      // Update persona status
      db.prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?').run(
        'training',
        new Date().toISOString(),
        id
      );
    });

    // Execute transaction
    transaction();

    logger.info('Training paused', {
      personaId: id,
      sessionId: activeSession.session_id,
      iterationNumber: activeSession.current_iteration,
      reason: pauseReason,
    });
    logger.logApiRequest('POST', `/api/personas/${id}/training/pause`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        session_id: activeSession.session_id,
        status: 'paused',
        pause_reason: pauseReason,
        iteration_number: activeSession.current_iteration,
        message: 'Training paused successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/training/pause`, error as Error);
    return createErrorResponse(error);
  }
};
