/**
 * Training Pairs API Endpoint
 * GET /api/personas/[id]/training/pairs
 *
 * Retrieves all training pairs for a persona.
 */

import type { APIRoute } from 'astro';
import { getPersona } from '@lib/db/persona-db';
import { getDatabase } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Pairs');

/**
 * GET /api/personas/[id]/training/pairs
 * Retrieve all training pairs for a persona
 *
 * Response: 200 with training pairs array
 *          404 with { error: string }
 */
/**
 * GET /api/personas/:id/training/pairs
 * Retrieves all training pairs associated with a specific persona.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('GET', '/api/personas/[id]/training/pairs', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    // Verify persona exists
    const persona = getPersona(id);
    if (!persona) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/training/pairs`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Retrieve training pairs
    const db = getDatabase();
    const pairs = db
      .prepare(
        `SELECT
          id,
          persona_id,
          input,
          expected_output,
          created_at
        FROM training_pairs
        WHERE persona_id = ?
        ORDER BY created_at ASC`
      )
      .all(id);

    logger.logApiRequest('GET', `/api/personas/${id}/training/pairs`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        persona_id: id,
        count: pairs.length,
        pairs: pairs,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/training/pairs`, error as Error);
    return createErrorResponse(error);
  }
};
