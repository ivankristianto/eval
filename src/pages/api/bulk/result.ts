/**
 * Bulk Evaluation Single Result API Endpoint
 * GET /api/bulk/result
 *
 * Fetches a single row result by ID for polling during regeneration.
 */

import type { APIRoute } from 'astro';
import { getRowResult } from '@lib/db';
import { notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Result');

/**
 * GET /api/bulk/result
 * Get a single row result by ID
 *
 * Query params: result_id
 * Response: 200 with { id, run_id, original_row_index, model_id, output_text, status, error_message, duration_ms, created_at }
 *          400 with { error: string, code: string }
 *          404 with { error: string }
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const result_id = url.searchParams.get('result_id');

    if (!result_id) {
      logger.logApiRequest('GET', '/api/bulk/result', 400, Date.now() - startTime);
      return new Response(
        JSON.stringify({ error: 'result_id is required', code: 'INVALID_INPUT' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = getRowResult(result_id);

    if (!result) {
      logger.logApiRequest('GET', '/api/bulk/result', 404, Date.now() - startTime);
      return notFound('Row result');
    }

    logger.logApiRequest('GET', '/api/bulk/result', 200, Date.now() - startTime);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', '/api/bulk/result', error as Error);
    return createErrorResponse(error);
  }
};
