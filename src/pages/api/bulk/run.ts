/**
 * Bulk Evaluation Run API Endpoint
 * POST /api/bulk/run
 *
 * Triggers bulk evaluation by creating an evaluation run and starting async execution.
 * Validates dataset, row indices, models, and configuration before starting.
 */

import type { APIRoute } from 'astro';
import { createEvaluationRun, getBulkDataset, listEvaluationRuns } from '@lib/db';
import { startBulkEvaluation, isBulkEvaluationRunning } from '@lib/bulk-evaluation/bulk-evaluator';
import { getModels } from '@lib/db';
import { badRequest, notFound, conflict, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Run');

/**
 * Request body for creating a bulk evaluation run.
 */
interface BulkRunRequest {
  dataset_id: string;
  system_prompt: string;
  temperature: number;
  model_ids: string[];
  row_indices?: number[]; // Optional: specific rows to evaluate (default: all rows)
}

/**
 * POST /api/bulk/run
 * Create and start a bulk evaluation run
 *
 * Request body: { dataset_id, system_prompt, temperature, model_ids, row_indices? }
 * Response: 201 with { run_id, dataset_id, status, total_rows }
 *          400 with { error: string, code: string }
 *          404 with { error: string }
 *          409 with { error: string } - if active run exists for dataset
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = (await request.json()) as BulkRunRequest;

    // Validate required fields
    if (!body.dataset_id) {
      logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
      return badRequest('dataset_id is required', 'INVALID_INPUT');
    }

    if (!body.system_prompt || body.system_prompt.trim() === '') {
      logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
      return badRequest('system_prompt is required', 'INVALID_INPUT');
    }

    if (body.temperature === undefined || body.temperature === null) {
      logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
      return badRequest('temperature is required', 'INVALID_INPUT');
    }

    if (!body.model_ids || !Array.isArray(body.model_ids) || body.model_ids.length === 0) {
      logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
      return badRequest('model_ids must be a non-empty array', 'INVALID_INPUT');
    }

    // Validate temperature range
    if (body.temperature < 0 || body.temperature > 2.0) {
      logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
      return badRequest('temperature must be between 0.0 and 2.0', 'INVALID_INPUT');
    }

    // Verify dataset exists
    const dataset = getBulkDataset(body.dataset_id);
    if (!dataset) {
      logger.logApiRequest('POST', '/api/bulk/run', 404, Date.now() - startTime);
      return notFound('Dataset');
    }

    // Validate row_indices if provided
    if (body.row_indices) {
      const csvData = JSON.parse(dataset.csv_data) as Record<string, unknown>[];
      const maxIndex = csvData.length - 1;

      for (const index of body.row_indices) {
        if (index < 0 || index > maxIndex) {
          logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
          return badRequest(
            `row_indices contains invalid index: ${index}. Dataset has ${csvData.length} rows (0-${maxIndex})`,
            'INVALID_ROW_INDEX'
          );
        }
      }
    }

    // Verify all models exist and are active
    const activeModels = getModels(true); // Only active models
    const validModelIds = new Set(activeModels.map((m) => m.id));

    for (const modelId of body.model_ids) {
      if (!validModelIds.has(modelId)) {
        logger.logApiRequest('POST', '/api/bulk/run', 400, Date.now() - startTime);
        return badRequest(`Model not found or inactive: ${modelId}`, 'INVALID_MODEL');
      }
    }

    // Check for active runs on this dataset (FR-013: prevent concurrent runs)
    const existingRuns = listEvaluationRuns(body.dataset_id, 'running');
    if (existingRuns.length > 0) {
      const activeRunId = existingRuns[0].id;
      // Check if actually running in memory
      if (isBulkEvaluationRunning(activeRunId)) {
        logger.logApiRequest('POST', '/api/bulk/run', 409, Date.now() - startTime);
        return conflict(
          `An evaluation run is already in progress for this dataset. Run ID: ${activeRunId}`,
          'ACTIVE_RUN_EXISTS',
          { active_run_id: activeRunId }
        );
      }
      // Clean up stale run in database
      logger.warn(`Found stale run in database: ${activeRunId}, will create new run`);
    }

    // Create evaluation run
    const run = createEvaluationRun({
      dataset_id: body.dataset_id,
      system_prompt: body.system_prompt,
      temperature: body.temperature,
      selected_models: body.model_ids,
    });

    // Start async bulk evaluation (don't await)
    startBulkEvaluation(run.id);

    logger.info('Bulk evaluation run started', {
      runId: run.id,
      datasetId: body.dataset_id,
      modelCount: body.model_ids.length,
      totalRows: run.total_rows,
    });
    logger.logApiRequest('POST', '/api/bulk/run', 201, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        run_id: run.id,
        dataset_id: run.dataset_id,
        status: run.status,
        total_rows: run.total_rows,
        processed_rows: run.processed_rows,
        created_at: run.created_at,
        message: 'Evaluation run started successfully',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/bulk/run', error as Error);
    return createErrorResponse(error);
  }
};
