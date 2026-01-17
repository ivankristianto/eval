/**
 * Bulk Evaluation Row Details API Endpoint
 * GET /api/bulk/row-details
 *
 * Fetches all model results and original row data for a specific row in a bulk evaluation run.
 * Used by the detail drawer to display comprehensive row information.
 */

import type { APIRoute } from 'astro';
import { getRunWithResults, getRowResultsByIndex } from '@lib/db/bulk-db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:RowDetails');

/**
 * GET /api/bulk/row-details?run_id={id}&row_index={index}
 * Get all results and original data for a specific row
 *
 * Query params:
 *   - run_id (required): The evaluation run ID
 *   - row_index (required): The row index (0-based)
 *
 * Response: 200 with { allRowResults: RowResult[], rowData: Record<string, string> }
 *          400 with { error: string, code: string }
 *          404 with { error: string }
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const runId = url.searchParams.get('run_id');
    const rowIndexStr = url.searchParams.get('row_index');

    if (!runId) {
      logger.logApiRequest('GET', '/api/bulk/row-details', 400, Date.now() - startTime);
      return badRequest('run_id query parameter is required', 'INVALID_INPUT');
    }

    if (!rowIndexStr) {
      logger.logApiRequest('GET', '/api/bulk/row-details', 400, Date.now() - startTime);
      return badRequest('row_index query parameter is required', 'INVALID_INPUT');
    }

    const rowIndex = parseInt(rowIndexStr, 10);
    if (isNaN(rowIndex) || rowIndex < 0) {
      logger.logApiRequest('GET', '/api/bulk/row-details', 400, Date.now() - startTime);
      return badRequest('row_index must be a non-negative integer', 'INVALID_INPUT');
    }

    // Get run with dataset
    const run = getRunWithResults(runId);
    if (!run) {
      logger.logApiRequest('GET', '/api/bulk/row-details', 404, Date.now() - startTime);
      return notFound('Evaluation run');
    }

    // Parse CSV data to get the specific row
    const csvRows = JSON.parse(run.dataset.csv_data) as Record<string, unknown>[];
    if (rowIndex >= csvRows.length) {
      logger.logApiRequest('GET', '/api/bulk/row-details', 404, Date.now() - startTime);
      return notFound('Row data');
    }

    const rowData = csvRows[rowIndex];

    // Get all results for this row
    const allRowResults = getRowResultsByIndex(runId, rowIndex);

    logger.logApiRequest('GET', '/api/bulk/row-details', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        allRowResults,
        rowData,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/bulk/row-details', error as Error);
    return createErrorResponse(error);
  }
};
