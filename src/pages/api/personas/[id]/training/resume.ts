/**
 * POST /api/personas/[id]/training/resume
 * Resume a paused training iteration for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../lib/db';
import { TrainingStateManager } from '../../../../../lib/training-state';
import { IterativeTrainingLoop } from '../../../../../lib/training-loop';

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

    // Load checkpoint and verify integrity (before transaction)
    const stateManager = new TrainingStateManager(db);

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
      if (error instanceof Error && error.message === 'NO_PAUSED_SESSION') {
        return new Response(
          JSON.stringify({
            error: 'NO_PAUSED_SESSION',
            message: 'No paused training session found for this persona',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Load checkpoint after transaction succeeds
    const checkpoint = stateManager.resume(checkpointSessionId);

    if (!checkpoint) {
      // Rollback state if checkpoint loading fails
      db.prepare(
        'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
      ).run('paused', new Date().toISOString(), checkpointSessionId);

      db.prepare(
        `UPDATE training_iterations
         SET status = 'paused'
         WHERE persona_id = ?
         AND iteration_number = ?`
      ).run(id, pausedSession!.current_iteration);

      return new Response(
        JSON.stringify({
          error: 'CHECKPOINT_NOT_FOUND',
          message: 'No valid checkpoint found for this session. State has been preserved.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify checkpoint integrity
    const isCheckpointValid = stateManager.verifyCheckpointIntegrity(checkpointSessionId);
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

      return new Response(
        JSON.stringify({
          error: 'CHECKPOINT_INVALID',
          message: 'Checkpoint data is corrupted or incomplete. State has been preserved.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Resume training loop
    try {
      const trainingLoop = new IterativeTrainingLoop(checkpointSessionId, id, db);
      await trainingLoop.resume();
    } catch (error) {
      // Rollback state if resume execution fails
      db.prepare(
        'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
      ).run('paused', new Date().toISOString(), checkpointSessionId);

      db.prepare(
        `UPDATE training_iterations
         SET status = 'paused'
         WHERE persona_id = ?
         AND iteration_number = ?`
      ).run(id, pausedSession!.current_iteration);

      console.error('Failed to resume training loop:', error);
      return new Response(
        JSON.stringify({
          error: 'RESUME_FAILED',
          message: 'Failed to resume training execution. State has been preserved.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log successful resume operation
    console.info('Training resumed', {
      personaId: id,
      sessionId: checkpointSessionId,
      iterationNumber: pausedSession!.current_iteration,
      checkpointData: {
        f1Score: checkpoint.metricsSnapshot.f1_score,
        evaluatedCount: checkpoint.evaluatedResultCount,
      },
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        session_id: checkpointSessionId,
        status: 'in_progress',
        iteration_number: pausedSession!.current_iteration,
        checkpoint: {
          iteration_number: checkpoint.iterationNumber,
          evaluated_result_count: checkpoint.evaluatedResultCount,
          f1_score: checkpoint.metricsSnapshot.f1_score,
        },
        message: 'Training resumed successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/personas/[id]/training/resume error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
