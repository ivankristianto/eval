/**
 * Bulk Evaluation Status API Endpoint
 * GET /api/bulk/status
 *
 * Returns real-time status of a bulk evaluation run.
 * Client polls this endpoint to track progress.
 */

import type { APIRoute } from 'astro';
import { getEvaluationRun } from '@lib/db';
import { isBulkEvaluationRunning } from '@lib/bulk-evaluation/bulk-evaluator';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Status');

/**
 * GET /api/bulk/status?run_id={id}
 * Get status of a bulk evaluation run
 *
 * Query params: run_id (required)
 * Response: 200 with { status, total_rows, processed_rows, error_message, created_at, updated_at, is_running }
 *          400 with { error: string }
 *          404 with { error: string }
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const runId = url.searchParams.get('run_id');

    if (!runId) {
      logger.logApiRequest('GET', '/api/bulk/status', 400, Date.now() - startTime);
      return badRequest('run_id query parameter is required', 'INVALID_INPUT');
    }

    // Get evaluation run from database
    const run = getEvaluationRun(runId);
    if (!run) {
      logger.logApiRequest('GET', '/api/bulk/status', 404, Date.now() - startTime);
      return notFound('Evaluation run');
    }

    // Check if actually running in memory
    const isRunning = isBulkEvaluationRunning(runId);

    logger.logApiRequest('GET', '/api/bulk/status', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        run_id: run.id,
        dataset_id: run.dataset_id,
        status: run.status,
        total_rows: run.total_rows,
        processed_rows: run.processed_rows,
        error_message: run.error_message,
        created_at: run.created_at,
        updated_at: run.updated_at,
        started_at: run.started_at,
        completed_at: run.completed_at,
        is_running: isRunning,
        // Calculate percentage for convenience
        completion_percentage: run.total_rows > 0 ? (run.processed_rows / run.total_rows) * 100 : 0,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/bulk/status', error as Error);
    return createErrorResponse(error);
  }
};
