/**
 * POST /api/personas/[id]/training/pause
 * Pause an in-progress training iteration for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/db';
import { TrainingStateManager } from '../../../../../lib/training-state';

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
  try {
    const { id } = params;

    // Validate persona ID is provided
    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Persona ID is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate persona ID is a valid UUID
    if (!isValidUUID(id)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Invalid persona ID format. Must be a valid UUID.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id, status, name FROM personas WHERE id = ?').get(id) as
      | PersonaRow
      | undefined;
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Persona not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({
          error: 'NO_ACTIVE_SESSION',
          message: 'No active training session found for this persona',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency: If already paused, return success without modification
    if (activeSession.status === 'paused') {
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
          return new Response(
            JSON.stringify({
              error: 'INVALID_REQUEST',
              message: 'Pause reason must be a string',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Validate pause reason length
        if (body.reason.length > 500) {
          return new Response(
            JSON.stringify({
              error: 'INVALID_REQUEST',
              message: 'Pause reason must not exceed 500 characters',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
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

    // Perform all database operations in a transaction
    const transaction = db.transaction(() => {
      // Pause the training session
      const stateManager = new TrainingStateManager(db);
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

    // Log successful pause operation
    console.info('Training paused', {
      personaId: id,
      sessionId: activeSession.session_id,
      iterationNumber: activeSession.current_iteration,
      reason: pauseReason,
      timestamp: new Date().toISOString(),
    });

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
    console.error('POST /api/personas/[id]/training/pause error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
