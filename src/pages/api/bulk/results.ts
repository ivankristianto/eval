/**
 * Bulk Evaluation Results API Endpoint
 * GET /api/bulk/results
 *
 * Returns complete evaluation results including dataset, run info, and row results.
 * Organizes results by row and model for display in results table.
 */

import type { APIRoute } from 'astro';
import { getRunWithResults } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Results');

/**
 * GET /api/bulk/results?run_id={id}
 * Get complete results for a bulk evaluation run
 *
 * Query params: run_id (required)
 * Response: 200 with { run, dataset, headers, results_by_row, models }
 *          400 with { error: string }
 *          404 with { error: string }
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const runId = url.searchParams.get('run_id');

    if (!runId) {
      logger.logApiRequest('GET', '/api/bulk/results', 400, Date.now() - startTime);
      return badRequest('run_id query parameter is required', 'INVALID_INPUT');
    }

    // Get run with dataset and results
    const data = getRunWithResults(runId);
    if (!data) {
      logger.logApiRequest('GET', '/api/bulk/results', 404, Date.now() - startTime);
      return notFound('Evaluation run');
    }

    // Parse CSV data to get headers and rows
    const csvRows = JSON.parse(data.dataset.csv_data) as Record<string, unknown>[];
    const headers = Object.keys(csvRows[0] || {});

    // Parse selected models
    const selectedModels = JSON.parse(data.selected_models) as string[];

    // Group results by row index and model for easy display
    const resultsByRow: Record<
      number,
      Record<
        string,
        {
          output_text?: string;
          status: string;
          error_message?: string;
          duration_ms?: number;
        }
      >
    > = {};

    for (const result of data.results) {
      const rowIndex = result.original_row_index;
      if (!resultsByRow[rowIndex]) {
        resultsByRow[rowIndex] = {};
      }
      resultsByRow[rowIndex][result.model_id] = {
        output_text: result.output_text,
        status: result.status,
        error_message: result.error_message,
        duration_ms: result.duration_ms,
      };
    }

    // Build response with CSV data and results interleaved
    const rowsWithResults = csvRows.map((row, index) => ({
      index,
      data: row,
      results: resultsByRow[index] || {},
    }));

    logger.logApiRequest('GET', '/api/bulk/results', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        run: {
          id: data.id,
          dataset_id: data.dataset_id,
          status: data.status,
          system_prompt: data.system_prompt,
          temperature: data.temperature,
          total_rows: data.total_rows,
          processed_rows: data.processed_rows,
          created_at: data.created_at,
          updated_at: data.updated_at,
          started_at: data.started_at,
          completed_at: data.completed_at,
          error_message: data.error_message,
        },
        dataset: {
          id: data.dataset.id,
          filename: data.dataset.filename,
          row_count: data.dataset.row_count,
          created_at: data.dataset.created_at,
        },
        headers,
        selected_models: selectedModels,
        rows: rowsWithResults,
        // Summary statistics
        summary: {
          total_rows: data.total_rows,
          processed_rows: data.processed_rows,
          completed_count: data.results.filter((r) => r.status === 'completed').length,
          failed_count: data.results.filter((r) => r.status === 'failed').length,
          pending_count: data.results.filter((r) => r.status === 'pending').length,
          total_results: data.results.length,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/bulk/results', error as Error);
    return createErrorResponse(error);
  }
};
