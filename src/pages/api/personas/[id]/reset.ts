/**
 * POST /api/personas/[id]/reset
 *
 * Resets a persona's training data and returns it to initial state.
 *
 * Deletes all training-related data:
 * - iteration_metrics
 * - judge_decisions
 * - human_reviews
 * - judge_prompt_versions
 * - task_prompt_versions
 * - training_iterations
 * - training_loop_checkpoints
 * - training_loop_state
 * - training_pair_results
 *
 * Resets persona status to 'draft', current prompt version IDs to NULL,
 * and best_pass_rate fields to NULL.
 *
 * Preserves training_pairs (input/expected data) for reuse.
 *
 * All operations are performed within a database transaction for atomicity.
 *
 * @example
 * POST /api/personas/abc-123/reset
 * Response: { "success": true }
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { Persona } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';
import { resetPersonaTrainingData as dbResetPersonaTrainingData } from '@lib/db/persona-db';

const logger = createLogger('API:Persona:Reset');

/**
 * POST /api/personas/[id]/reset
 * Resets all training data for a persona and returns it to draft state.
 *
 * @param params - Route parameters containing the persona ID.
 * @returns Response indicating success or failure.
 */
export const POST: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('POST', '/api/personas/[id]/reset', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists first (for proper error response)
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as
      | Persona
      | undefined;

    if (!persona) {
      logger.logApiRequest('POST', `/api/personas/${id}/reset`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    logger.info('Resetting persona training data', { personaId: id });

    // Use the database function to perform the reset
    dbResetPersonaTrainingData(id, db);

    logger.logApiRequest('POST', `/api/personas/${id}/reset`, 200, Date.now() - startTime);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/reset`, error as Error);
    return createErrorResponse(error);
  }
};
