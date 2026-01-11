// src/pages/api/templates/[id]/history.ts
// Get template evaluation history

import type { APIRoute } from 'astro';
import { getTemplateById, getTemplateHistory } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Templates:History');

/**
 * GET /api/templates/:id/history
 * Retrieves evaluation run history for a template.
 * @param root0
 * @param root0.params
 * @param root0.url
 */
export const GET: APIRoute = async ({ params, url }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('GET', '/api/templates/:id/history', 400, Date.now() - startTime);
      return badRequest('Template ID is required', 'INVALID_INPUT');
    }

    const template = getTemplateById(id);

    if (!template) {
      logger.logApiRequest('GET', `/api/templates/${id}/history`, 404, Date.now() - startTime);
      return notFound('Template');
    }

    // Parse pagination params
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

    const history = getTemplateHistory(id, limit, offset);

    logger.logApiRequest('GET', `/api/templates/${id}/history`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        template_id: template.id,
        template_name: template.name,
        total_runs: template.run_count,
        runs: history,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/templates/${id}/history`, error as Error);
    return createErrorResponse(error);
  }
};
