// src/pages/api/evaluation-status.ts
// Evaluation status polling endpoint

import type { APIRoute } from 'astro';
import { getEvaluationStatus } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:EvaluationStatus');

/**
 * GET /api/evaluation-status
 * Retrieves current overall and per-model status for a specific evaluation.
 * @param root0
 * @param root0.url
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const evaluationId = url.searchParams.get('evaluation_id');

    if (!evaluationId) {
      logger.logApiRequest('GET', '/api/evaluation-status', 400, Date.now() - startTime);
      // Return error code in error field for test compatibility
      return new Response(JSON.stringify({ error: 'INVALID_INPUT' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status = getEvaluationStatus(evaluationId);

    if (!status) {
      logger.logApiRequest('GET', '/api/evaluation-status', 404, Date.now() - startTime);
      return badRequest('Evaluation does not exist', 'EVALUATION_NOT_FOUND', {
        evaluation_id: evaluationId,
      });
    }

    logger.logApiRequest('GET', '/api/evaluation-status', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        evaluation_id: evaluationId,
        overall_status: status.overall_status,
        created_at: status.created_at,
        completed_at: status.completed_at,
        results: status.results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/evaluation-status', error as Error);
    return createErrorResponse(error);
  }
};
