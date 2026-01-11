/**
 * POST /api/personas/[id]/training/start
 * Start a new training iteration for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { Persona } from '@src-types/training';
import { TrainingLoopManager } from '@lib/training/training-loop-manager';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Start');

/**
 * POST /api/personas/[id]/training/start
 * Initiates a new training iteration for a specific persona.
 * Validates that minimum training data requirements are met.
 * @param root0
 * @param root0.params
 */
export const POST: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest(
        'POST',
        `/api/personas/[id]/training/start`,
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as
      | Persona
      | undefined;
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/start`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Check if there's already an active or paused training session
    const existingSession = db
      .prepare(
        `SELECT session_id, status, current_iteration
         FROM training_loop_state
         WHERE persona_id = ?
         AND status IN ('in_progress', 'paused')
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(id) as { session_id: string; status: string; current_iteration: number } | undefined;

    if (existingSession) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/start`,
        409,
        Date.now() - startTime
      );
      return new Response(
        JSON.stringify({
          error: 'TRAINING_ALREADY_ACTIVE',
          code: 'TRAINING_STATE_ERROR',
          message: `Training is already ${existingSession.status}. Please pause or wait for completion before starting a new session.`,
          existing_session: {
            session_id: existingSession.session_id,
            status: existingSession.status,
            current_iteration: existingSession.current_iteration,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify persona has training pairs
    const pairCount = db
      .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
      .get(id) as { count: number };

    if (pairCount.count < 10) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/start`,
        400,
        Date.now() - startTime
      );
      return badRequest(
        `Persona requires at least 10 training pairs. Current count: ${pairCount.count}`,
        'INSUFFICIENT_DATA'
      );
    }

    // Update persona status to training (iteration will be set by execute())
    db.prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?').run(
      'training',
      new Date().toISOString(),
      id
    );

    // Create session and start training loop
    const sessionId = uuidv4();
    const trainingLoop = new TrainingLoopManager({ sessionId, personaId: id }, db);

    logger.info('Starting training loop', { sessionId, personaId: id });

    // Execute training loop (for MVP, run synchronously to ensure decisions are created)
    // In production, this would be fire-and-forget with background job processing
    // NOTE: For iteration 1, execute() will stop after judge evaluation and wait for human review
    await trainingLoop.execute();

    // Get the created iteration info after execute completes
    const createdIteration = db
      .prepare(
        `SELECT id, iteration_number, status, started_at
         FROM training_iterations
         WHERE persona_id = ?
         ORDER BY iteration_number DESC
         LIMIT 1`
      )
      .get(id) as
      | { id: string; iteration_number: number; status: string; started_at: string }
      | undefined;

    // Get the training loop state to return current status
    const loopState = db
      .prepare('SELECT status FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as { status: string } | undefined;

    logger.info('Training loop executed', {
      sessionId,
      personaId: id,
      iterationNumber: createdIteration?.iteration_number,
      status: loopState?.status,
    });

    logger.logApiRequest('POST', `/api/personas/${id}/training/start`, 202, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        status: loopState?.status || 'awaiting_human_review',
        iteration: createdIteration
          ? {
              id: createdIteration.id,
              iteration_number: createdIteration.iteration_number,
              status: createdIteration.status,
              started_at: createdIteration.started_at,
            }
          : null,
        message:
          createdIteration?.iteration_number === 1
            ? 'Iteration 1 complete. Awaiting human review before continuing.'
            : 'Training started successfully.',
      }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/training/start`, error as Error);
    return createErrorResponse(error);
  }
};
