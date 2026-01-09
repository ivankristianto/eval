/**
 * Metrics API Endpoint
 * GET /api/personas/[id]/metrics
 * Returns lightweight metrics data optimized for chart rendering
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { getPersonaMetricsHistory } from '@lib/evaluation/metrics-orchestrator';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Personas:Metrics');

/**
 * GET /api/personas/[id]/metrics
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  if (!id) {
    logger.logApiRequest('GET', '/api/personas/[id]/metrics', 400, Date.now() - startTime);
    return badRequest('Persona ID is required', 'INVALID_INPUT');
  }

  try {
    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(id);

    if (!persona) {
      logger.logApiRequest('GET', `/api/personas/${id}/metrics`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    // Fetch metrics history
    const metricsHistory = getPersonaMetricsHistory(id, db);

    // Transform to chart-optimized format
    const metrics = metricsHistory.map((item) => ({
      iteration: item.iteration_number,
      f1_score: item.metrics.f1_score,
      precision: item.metrics.precision,
      recall: item.metrics.recall,
      cohens_kappa: item.metrics.cohens_kappa,
      timestamp: item.calculated_at,
    }));

    logger.logApiRequest('GET', `/api/personas/${id}/metrics`, 200, Date.now() - startTime);

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/metrics`, error as Error);
    return createErrorResponse(error);
  }
};
