/**
 * POST /api/personas/[id]/training/start
 * Start a new training iteration for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { IterativeTrainingLoop } from '@lib/training/training-loop';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/personas/[id]/training/start
 * Initiates a new training iteration for a specific persona.
 * Validates that minimum training data requirements are met.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Persona ID is required',
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
      return new Response(
        JSON.stringify({
          error: 'TRAINING_ALREADY_ACTIVE',
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
      return new Response(
        JSON.stringify({
          error: 'INSUFFICIENT_DATA',
          message: `Persona requires at least 10 training pairs. Current count: ${pairCount.count}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update persona status to training (iteration will be set by execute())
    db.prepare(
      'UPDATE personas SET status = ?, updated_at = ? WHERE id = ?'
    ).run('training', new Date().toISOString(), id);

    // Create session and start training loop
    const sessionId = uuidv4();
    const trainingLoop = new IterativeTrainingLoop(sessionId, id, db);

    // Execute training loop (for MVP, run synchronously to ensure decisions are created)
    // In production, this would be fire-and-forget with background job processing
    // NOTE: For iteration 1, execute() will stop after judge evaluation and wait for human review
    await trainingLoop.execute([]);

    // Get the created iteration info after execute completes
    const createdIteration = db
      .prepare(
        `SELECT id, iteration_number, status, started_at
         FROM training_iterations
         WHERE persona_id = ?
         ORDER BY iteration_number DESC
         LIMIT 1`
      )
      .get(id) as { id: string; iteration_number: number; status: string; started_at: string } | undefined;

    // Get the training loop state to return current status
    const loopState = db
      .prepare('SELECT status FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as { status: string } | undefined;

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
    console.error('POST /api/personas/[id]/training/start error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
