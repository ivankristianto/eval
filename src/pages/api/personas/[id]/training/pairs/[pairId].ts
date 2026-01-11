/**
 * Training Pair Single Item API Endpoint
 * DELETE /api/personas/[id]/training/pairs/[pairId] - Deletes a single training pair
 */

import type { APIRoute } from 'astro';
import { getPersona, getTrainingPair, deleteTrainingPair } from '@lib/db/persona-db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Pairs:Single');

/**
 * DELETE /api/personas/[id]/training/pairs/[pairId]
 * Deletes a single training pair by ID
 *
 * Cascades to delete related training_pair_results due to foreign key constraint
 * with ON DELETE CASCADE on training_pair_id column.
 *
 * Response: 200 with { message: string }
 *          400 with { error: string }
 *          404 with { error: string }
 */
export const DELETE: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id: personaId, pairId } = params;

  try {
    if (!personaId) {
      logger.logApiRequest(
        'DELETE',
        '/api/personas/[id]/training/pairs/[pairId]',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    if (!pairId) {
      logger.logApiRequest(
        'DELETE',
        '/api/personas/[id]/training/pairs/[pairId]',
        400,
        Date.now() - startTime
      );
      return badRequest('Training pair ID is required', 'INVALID_INPUT');
    }

    // Verify persona exists
    const persona = getPersona(personaId);
    if (!persona) {
      logger.logApiRequest(
        'DELETE',
        `/api/personas/${personaId}/training/pairs/${pairId}`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Verify training pair exists
    const pair = getTrainingPair(pairId);
    if (!pair) {
      logger.logApiRequest(
        'DELETE',
        `/api/personas/${personaId}/training/pairs/${pairId}`,
        404,
        Date.now() - startTime
      );
      return notFound('Training pair');
    }

    // Verify pair belongs to persona
    if (pair.persona_id !== personaId) {
      logger.logApiRequest(
        'DELETE',
        `/api/personas/${personaId}/training/pairs/${pairId}`,
        400,
        Date.now() - startTime
      );
      return badRequest(
        'Training pair does not belong to the specified persona',
        'INVALID_RELATIONSHIP'
      );
    }

    // Delete the training pair (cascades to training_pair_results)
    const deleted = deleteTrainingPair(pairId);

    if (!deleted) {
      logger.logApiRequest(
        'DELETE',
        `/api/personas/${personaId}/training/pairs/${pairId}`,
        404,
        Date.now() - startTime
      );
      return notFound('Training pair');
    }

    logger.info('Training pair deleted', {
      personaId,
      pairId,
    });
    logger.logApiRequest(
      'DELETE',
      `/api/personas/${personaId}/training/pairs/${pairId}`,
      200,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        message: 'Training pair deleted successfully',
        pairId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError(
      'DELETE',
      `/api/personas/${personaId}/training/pairs/${pairId}`,
      error as Error
    );
    return createErrorResponse(error);
  }
};
