/**
 * Bulk Evaluation Rerun Result API Endpoint
 * POST /api/bulk/rerun-result
 *
 * Reruns evaluation for a specific row + model combination.
 * Triggers async execution and returns result ID for polling.
 */

import type { APIRoute } from 'astro';
import {
  getEvaluationRun,
  getBulkDataset,
  getRowResultForModel,
  createRowResult,
  updateRowResult,
  getModelById,
  decryptApiKey,
} from '@lib/db';
import { ClientFactory } from '@lib/utils/api-clients';
import { interpolateTemplate } from '@lib/utils/template-engine';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:RerunResult');

// Timeout constant (matching bulk-evaluator.ts)
const MODEL_TIMEOUT_MS = 30000; // 30 seconds per model evaluation

/**
 * Request body for rerunning a single row result.
 */
interface RerunResultRequest {
  run_id: string;
  row_index: number;
  model_id: string;
}

/**
 * POST /api/bulk/rerun-result
 * Rerun evaluation for a specific row + model combination
 *
 * Request body: { run_id, row_index, model_id }
 * Response: 202 with { result_id, status: 'pending' }
 *          400 with { error: string, code: string }
 *          404 with { error: string }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = (await request.json()) as RerunResultRequest;

    // Validate required fields
    if (!body.run_id) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest('run_id is required', 'INVALID_INPUT');
    }

    if (body.row_index === undefined || body.row_index === null) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest('row_index is required', 'INVALID_INPUT');
    }

    if (!body.model_id) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest('model_id is required', 'INVALID_INPUT');
    }

    // Verify run exists
    const run = getEvaluationRun(body.run_id);
    if (!run) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 404, Date.now() - startTime);
      return notFound('Evaluation run');
    }

    // Verify dataset exists
    const dataset = getBulkDataset(run.dataset_id);
    if (!dataset) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 404, Date.now() - startTime);
      return notFound('Dataset');
    }

    // Parse CSV data and validate row_index
    const csvData = JSON.parse(dataset.csv_data) as Record<string, unknown>[];
    const maxIndex = csvData.length - 1;

    if (body.row_index < 0 || body.row_index > maxIndex) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest(
        `row_index out of bounds: ${body.row_index}. Dataset has ${csvData.length} rows (0-${maxIndex})`,
        'INVALID_ROW_INDEX'
      );
    }

    // Verify model exists and is active
    const model = getModelById(body.model_id);
    if (!model) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest(`Model not found: ${body.model_id}`, 'INVALID_MODEL');
    }

    if (!model.is_active) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest(`Model is inactive: ${body.model_id}`, 'INACTIVE_MODEL');
    }

    // Check if model is in the run's selected models
    const selectedModels = JSON.parse(run.selected_models) as string[];
    if (!selectedModels.includes(body.model_id)) {
      logger.logApiRequest('POST', '/api/bulk/rerun-result', 400, Date.now() - startTime);
      return badRequest(
        `Model ${body.model_id} is not in the selected models for this run`,
        'INVALID_MODEL_FOR_RUN'
      );
    }

    // Get existing result (if any)
    const existingResult = getRowResultForModel(body.run_id, body.row_index, body.model_id);

    // Create or update row result with pending status
    let resultId: string;
    if (existingResult) {
      resultId = existingResult.id;
      // Update existing result to pending (clear error message by setting to undefined)
      updateRowResult(resultId, { status: 'pending', error_message: undefined });
    } else {
      // Create new result
      const row = csvData[body.row_index];
      const prompt = interpolateTemplate(run.system_prompt, row);
      const created = createRowResult({
        run_id: body.run_id,
        original_row_index: body.row_index,
        model_id: body.model_id,
        prompt_used: prompt,
        status: 'pending',
      });
      resultId = created.id;
    }

    // Start async evaluation (don't await)
    executeRerun(
      resultId,
      body.run_id,
      body.row_index,
      body.model_id,
      run.system_prompt,
      run.temperature,
      csvData[body.row_index]
    );

    logger.info('Row result rerun started', {
      resultId,
      runId: body.run_id,
      rowIndex: body.row_index,
      modelId: body.model_id,
    });
    logger.logApiRequest('POST', '/api/bulk/rerun-result', 202, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        result_id: resultId,
        status: 'pending',
        message: 'Rerun started successfully',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/bulk/rerun-result', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * Executes the rerun for a specific row/model combination.
 * Runs asynchronously in the background.
 */
async function executeRerun(
  resultId: string,
  runId: string,
  rowIndex: number,
  modelId: string,
  systemPrompt: string,
  temperature: number,
  rowData: Record<string, unknown>
): Promise<void> {
  try {
    // Get model configuration
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Decrypt API key (optional for local providers) and create client
    const apiKey = model.api_key_encrypted ? decryptApiKey(model.api_key_encrypted) : undefined;
    const client = ClientFactory.createClient(
      model.provider,
      apiKey,
      model.model_name,
      model.base_url
    );

    // Interpolate prompt with row data
    const prompt = interpolateTemplate(systemPrompt, rowData);

    // Execute model with timeout
    const modelResponse = await Promise.race([
      client.evaluate(prompt, { systemPrompt, temperature }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model timeout')), MODEL_TIMEOUT_MS)
      ),
    ]);

    // Update row result with success
    updateRowResult(resultId, {
      output_text: modelResponse.response,
      status: 'completed',
      error_message: undefined,
      duration_ms: modelResponse.executionTime,
    });

    logger.info(`Row result rerun completed: ${resultId}`);
  } catch (error) {
    // Update row result with failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    updateRowResult(resultId, {
      status: 'failed',
      error_message: errorMessage,
    });

    logger.error(
      `Row result rerun failed: ${resultId}`,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
