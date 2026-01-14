/**
 * GET /api/personas/[id]/prompts/[type]/compare-outputs?version1=<id>&version2=<id>
 * Get output comparison between two prompt versions
 *
 * This endpoint fetches and compares the generated outputs for the same
 * training pairs across different prompt versions, enabling users to see
 * how prompt improvements affect model outputs.
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { compareVersions, getAvailableVersions } from '@lib/training/version-comparison';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Personas:Prompts:CompareOutputs');

/**
 * GET /api/personas/[id]/prompts/[type]/compare-outputs
 * Retrieves output comparisons between two prompt versions.
 *
 * Query parameters:
 * - version1: First version ID (required)
 * - version2: Second version ID (required)
 * - training_pair_id: Optional training pair ID for specific comparison
 *
 * @param root0
 * @param root0.params - Path parameters including persona id and prompt type
 * @param root0.url - Request URL for query parameters
 */
export const GET: APIRoute = async ({ params, url }) => {
  const startTime = Date.now();

  try {
    const { id: personaId, type } = params;

    // Validate required path parameters
    if (!personaId) {
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    const version1 = url.searchParams.get('version1');
    const version2 = url.searchParams.get('version2');
    const trainingPairId = url.searchParams.get('training_pair_id');

    if (!version1 || !version2) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${personaId}/prompts/${type}/compare-outputs`,
        400,
        Date.now() - startTime
      );
      return badRequest('version1 and version2 query parameters are required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Validate persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId);

    if (!persona) {
      return badRequest('Persona not found', 'NOT_FOUND');
    }

    // Get available versions for this persona
    // Use empty string for training_pair_id if not provided (for aggregated view)
    const availableVersions = getAvailableVersions(personaId, trainingPairId || '', db);

    // If a specific training pair is requested, fetch the comparison
    let comparison = null;
    if (trainingPairId) {
      comparison = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairId,
          version1,
          version2,
          version_type: 'run_id',
        },
        db
      );
    }

    logger.logApiRequest(
      'GET',
      `/api/personas/${personaId}/prompts/${type}/compare-outputs`,
      200,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        available_versions: availableVersions,
        comparison,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const { id: personaId, type } = params;
    logger.logApiError(
      'GET',
      `/api/personas/${personaId}/prompts/${type}/compare-outputs`,
      error as Error
    );

    if (error instanceof Error && error.message.includes('not found')) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${personaId}/prompts/${type}/compare-outputs`,
        404,
        Date.now() - startTime
      );
      return badRequest(error.message, 'NOT_FOUND');
    }

    return createErrorResponse(error);
  }
};
