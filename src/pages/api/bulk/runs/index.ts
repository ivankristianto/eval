/**
 * Bulk Evaluation Runs List API Endpoint
 * GET /api/bulk/runs
 *
 * Returns a list of all evaluation runs with their basic metadata.
 * Supports optional filtering by dataset_id and status via query params.
 */

import type { APIRoute } from 'astro';
import { listEvaluationRuns, getBulkDataset } from '@lib/db';
import { createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Runs');

/**
 * GET /api/bulk/runs
 * List all evaluation runs with optional filtering
 *
 * Query params:
 *   - dataset_id: Optional filter by dataset
 *   - status: Optional filter by status (pending|running|completed|failed)
 *
 * Response: 200 with { runs: [...] }
 *          400 with { error: string } - invalid status
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const params = new URL(url).searchParams;
    const datasetId = params.get('dataset_id') || undefined;
    const statusParam = params.get('status');

    // Validate status if provided
    let status: 'pending' | 'running' | 'completed' | 'failed' | undefined = undefined;
    if (statusParam) {
      const validStatuses = ['pending', 'running', 'completed', 'failed'];
      if (!validStatuses.includes(statusParam)) {
        logger.logApiRequest('GET', '/api/bulk/runs', 400, Date.now() - startTime);
        return new Response(
          JSON.stringify({
            error: `Invalid status: ${statusParam}. Must be one of: ${validStatuses.join(', ')}`,
            code: 'INVALID_PARAMETER',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      status = statusParam as 'pending' | 'running' | 'completed' | 'failed';
    }

    // Get evaluation runs from database
    const runs = listEvaluationRuns(datasetId, status);

    // Enrich with dataset filename for display
    const enrichedRuns = runs.map((run) => {
      const dataset = getBulkDataset(run.dataset_id);
      const selectedModels = JSON.parse(run.selected_models) as string[];

      return {
        id: run.id,
        dataset_id: run.dataset_id,
        dataset_filename: dataset?.filename || 'Unknown',
        status: run.status,
        model_count: selectedModels.length,
        total_rows: run.total_rows,
        processed_rows: run.processed_rows,
        created_at: run.created_at,
        started_at: run.started_at || null,
        completed_at: run.completed_at || null,
        error_message: run.error_message || null,
      };
    });

    logger.logApiRequest('GET', '/api/bulk/runs', 200, Date.now() - startTime);

    return new Response(JSON.stringify({ runs: enrichedRuns }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', '/api/bulk/runs', error as Error);
    return createErrorResponse(error);
  }
};
