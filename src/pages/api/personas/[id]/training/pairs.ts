/**
 * Training Pairs API Endpoint
 * GET /api/personas/[id]/training/pairs - Retrieves all training pairs for a persona
 * POST /api/personas/[id]/training/pairs - Creates a single training pair
 */

import type { APIRoute } from 'astro';
import { getPersona, createTrainingPairs } from '@lib/db/persona-db';
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

/**
 * POST /api/personas/[id]/training/pairs
 * Creates a single training pair
 *
 * Request body: JSON with { input: string, expected_output: string }
 * Response: 201 with { pair: TrainingPair }
 *          400 with { error: string }
 *          404 with { error: string }
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/training/pairs',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    // Verify persona exists
    const persona = getPersona(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/pairs`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Parse request body
    const body = await request.json();
    const { input, expected_output } = body;

    // Validate input
    if (!input || typeof input !== 'string') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/pairs`,
        400,
        Date.now() - startTime
      );
      return badRequest('Input is required and must be a string', 'INVALID_INPUT');
    }

    if (!expected_output || typeof expected_output !== 'string') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/pairs`,
        400,
        Date.now() - startTime
      );
      return badRequest('Expected output is required and must be a string', 'INVALID_INPUT');
    }

    // Create training pair
    const pairs = createTrainingPairs(id, [
      { input: input.trim(), expected_output: expected_output.trim() },
    ]);

    // Get the newly created pair (it should be the last one since we're sorting by created_at)
    const pair = pairs[pairs.length - 1];

    logger.info('Training pair created', {
      personaId: id,
      pairId: pair.id,
    });
    logger.logApiRequest('POST', `/api/personas/${id}/training/pairs`, 201, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        pair,
        message: 'Training pair created successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/training/pairs`, error as Error);
    return createErrorResponse(error);
  }
};
