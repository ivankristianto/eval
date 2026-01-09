import type { APIRoute } from 'astro';
import { getEvaluations, getEvaluationsCount, deleteEvaluations } from '@lib/db';
import type { RubricType } from '@lib/utils/types';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Evaluations');

/**
 * GET /api/evaluations
 * Lists evaluations with optional filtering and pagination.
 * @param root0
 * @param root0.url
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  const limit = Number(url.searchParams.get('limit')) || 10;
  const offset = Number(url.searchParams.get('offset')) || 0;

  const filters = {
    templateId: url.searchParams.get('template') || undefined,
    fromDate: url.searchParams.get('fromDate') || undefined,
    toDate: url.searchParams.get('toDate') || undefined,
    rubric: (url.searchParams.get('rubric') as RubricType) || undefined,
    minScore: url.searchParams.get('minScore')
      ? Number(url.searchParams.get('minScore'))
      : undefined,
  };

  try {
    const items = getEvaluations(filters, limit, offset);
    const total = getEvaluationsCount(filters);

    logger.logApiRequest('GET', '/api/evaluations', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        items,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/evaluations', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * DELETE /api/evaluations
 * Bulk deletes multiple evaluations by ID.
 * @param root0
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const DELETE: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      logger.logApiRequest('DELETE', '/api/evaluations', 400, Date.now() - startTime);
      return badRequest('Invalid IDs', 'INVALID_INPUT');
    }

    logger.info('Bulk deleting evaluations', { count: ids.length });

    const count = deleteEvaluations(ids);

    logger.info('Evaluations deleted', { count });
    logger.logApiRequest('DELETE', '/api/evaluations', 200, Date.now() - startTime);

    return new Response(JSON.stringify({ deleted: count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('DELETE', '/api/evaluations', error as Error);
    return createErrorResponse(error);
  }
};
