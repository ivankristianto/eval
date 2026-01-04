// src/pages/api/metrics.ts
// API endpoint to return simple pass/fail percentages for a persona

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import {
  getLatestMetrics,
  getMetricsHistory,
} from '@lib/training/metrics-calculator';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Metrics');

/**
 * GET /api/metrics?persona_id=<id>[&run_id=<id>][&history=<true|false>]
 * Returns simple pass/fail percentages
 *
 * Query params:
 * - persona_id (required): Persona ID to get metrics for
 * - run_id (optional): Specific evaluation run to get metrics for
 * - history (optional): If "true", returns metrics history across all runs
 *
 * Response (single):
 * {
 *   total_results: number;
 *   pass_count: number;
 *   fail_count: number;
 *   pass_percentage: number;
 *   fail_percentage: number;
 * }
 *
 * Response (history):
 * {
 *   history: Array<{
 *     run_id: string;
 *     run_type: string;
 *     created_at: string;
 *     metrics: { ... }
 *   }>
 * }
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();
  const personaId = url.searchParams.get('persona_id');
  const runId = url.searchParams.get('run_id');
  const history = url.searchParams.get('history') === 'true';

  try {
    if (!personaId) {
      logger.logApiRequest('GET', '/api/metrics', 400, Date.now() - startTime);
      return badRequest('persona_id query parameter is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id, name FROM personas WHERE id = ?').get(personaId);
    if (!persona) {
      logger.logApiRequest('GET', `/api/metrics?persona_id=${personaId}`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    // Get metrics history if requested
    if (history) {
      const metricsHistory = getMetricsHistory(personaId, db);

      logger.logApiRequest('GET', `/api/metrics?persona_id=${personaId}&history=true`, 200, Date.now() - startTime);

      return new Response(
        JSON.stringify({
          history: metricsHistory,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get metrics for specific run if run_id provided
    if (runId) {
      // Verify run exists and belongs to persona
      const run = db
        .prepare('SELECT id FROM evaluation_runs WHERE id = ? AND persona_id = ?')
        .get(runId, personaId);

      if (!run) {
        logger.logApiRequest('GET', `/api/metrics?persona_id=${personaId}&run_id=${runId}`, 404, Date.now() - startTime);
        return notFound('Evaluation run');
      }

      const runMetrics = await import('@lib/training/metrics-calculator').then((m) =>
        m.calculateRunMetrics(runId, db)
      );

      logger.logApiRequest('GET', `/api/metrics?persona_id=${personaId}&run_id=${runId}`, 200, Date.now() - startTime);

      return new Response(JSON.stringify(runMetrics), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get latest metrics for persona
    const latestMetrics = getLatestMetrics(personaId, db);

    if (!latestMetrics) {
      // Return empty metrics if no results
      const emptyMetrics = {
        total_results: 0,
        pass_count: 0,
        fail_count: 0,
        pass_percentage: 0,
        fail_percentage: 0,
      };

      logger.logApiRequest('GET', `/api/metrics?persona_id=${personaId}`, 200, Date.now() - startTime);

      return new Response(JSON.stringify(emptyMetrics), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.logApiRequest('GET', `/api/metrics?persona_id=${personaId}`, 200, Date.now() - startTime);

    return new Response(JSON.stringify(latestMetrics), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/metrics?persona_id=${personaId}`, error as Error);
    return createErrorResponse(error);
  }
};
