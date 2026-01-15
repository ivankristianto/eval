/**
 * Bulk Evaluation Executor
 *
 * Orchestrates sequential execution of bulk evaluation runs.
 * For each selected row and each model, interpolates template with row data,
 * calls ModelClient.evaluate(), and stores results in row_results table.
 *
 * Error Handling Policy (FR-011):
 * - Per-row failures are logged and stored without stopping the entire batch
 * - Run status is 'failed' only if ALL row evaluations fail
 * - Run status is 'completed' if ANY row evaluation succeeds
 * - Individual model failures within a row do not stop other models
 */

import { ClientFactory } from '@lib/utils/api-clients';
import { interpolateTemplate } from '@lib/utils/template-engine';
import {
  getEvaluationRun,
  getBulkDataset,
  updateRunStatus,
  createRowResult,
  getModelById,
  decryptApiKey,
} from '@lib/db';

// Timeout constants (matching evaluator.ts)
const MODEL_TIMEOUT_MS = 30000; // 30 seconds per model evaluation

/**
 * Progress callback for bulk evaluation execution.
 * Reports completion percentage and processed row count.
 */
export interface BulkProgressCallback {
  (progress: {
    processedRows: number;
    totalRows: number;
    percentage: number;
    currentRowIndex: number;
  }): void;
}

/**
 * Result of a single row/model evaluation.
 */
interface RowEvaluationResult {
  rowIndex: number;
  modelId: string;
  success: boolean;
  outputText?: string;
  durationMs?: number;
  errorMessage?: string;
}

/**
 * Orchestrates sequential execution of bulk evaluation runs.
 * Handles template interpolation, model client execution, and result storage.
 * Continues execution even when individual rows or models fail.
 */
export class BulkEvaluator {
  private aborted = false;
  private runId: string;
  private progressCallback?: BulkProgressCallback;

  /**
   * Creates a new BulkEvaluator instance.
   * @param runId - Evaluation run ID to execute
   * @param progressCallback - Optional callback for progress updates
   */
  constructor(runId: string, progressCallback?: BulkProgressCallback) {
    this.runId = runId;
    this.progressCallback = progressCallback;
  }

  /**
   * Executes the bulk evaluation run.
   * Processes each selected row sequentially for each model.
   * @returns Promise that resolves when execution is complete or aborted
   * @throws {Error} If run configuration or dataset is not found
   */
  async execute(): Promise<void> {
    try {
      // Fetch run configuration and dataset
      const run = getEvaluationRun(this.runId);
      if (!run) {
        throw new Error(`Evaluation run not found: ${this.runId}`);
      }

      const dataset = getBulkDataset(run.dataset_id);
      if (!dataset) {
        throw new Error(`Dataset not found: ${run.dataset_id}`);
      }

      // Parse CSV data
      const csvRows = JSON.parse(dataset.csv_data) as Record<string, unknown>[];
      const selectedModels = JSON.parse(run.selected_models) as string[];

      // Update status to running
      updateRunStatus(this.runId, 'running', 0);

      // Execute evaluations sequentially (one row at a time)
      const results: RowEvaluationResult[] = [];
      for (let i = 0; i < csvRows.length; i++) {
        if (this.aborted) {
          break;
        }

        const row = csvRows[i];
        const rowResults = await this.executeRow(
          row,
          i,
          selectedModels,
          run.system_prompt,
          run.temperature
        );

        results.push(...rowResults);

        // Update progress
        const processedCount = i + 1;
        updateRunStatus(this.runId, 'running', processedCount);

        // Report progress if callback provided
        if (this.progressCallback) {
          this.progressCallback({
            processedRows: processedCount,
            totalRows: csvRows.length,
            percentage: (processedCount / csvRows.length) * 100,
            currentRowIndex: i,
          });
        }
      }

      if (this.aborted) {
        return;
      }

      // Determine final status (FR-011: fail-fast per row, but continue batch)
      // - If ANY row evaluation succeeds → run is 'completed'
      // - If ALL evaluations fail → run is 'failed'
      const hasAnySuccess = results.some((r) => r.success);
      const finalStatus = hasAnySuccess ? 'completed' : 'failed';

      updateRunStatus(
        this.runId,
        finalStatus,
        csvRows.length,
        hasAnySuccess ? undefined : 'All row evaluations failed'
      );
    } catch (error) {
      console.error(`Bulk evaluation execution error for run ${this.runId}:`, error);

      if (!this.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updateRunStatus(this.runId, 'failed', 0, errorMessage);
      }
    }
  }

  /**
   * Executes evaluation for a single row across all selected models.
   * @param row - Row data from CSV
   * @param rowIndex - Original row index from CSV
   * @param modelIds - Model IDs to evaluate
   * @param systemPrompt - System prompt for all evaluations
   * @param temperature - Temperature for all evaluations
   * @returns Array of evaluation results for this row
   */
  private async executeRow(
    row: Record<string, unknown>,
    rowIndex: number,
    modelIds: string[],
    systemPrompt: string,
    temperature: number
  ): Promise<RowEvaluationResult[]> {
    const results: RowEvaluationResult[] = [];

    // Process each model for this row
    for (const modelId of modelIds) {
      if (this.aborted) {
        break;
      }

      const result = await this.executeRowModel(row, rowIndex, modelId, systemPrompt, temperature);
      results.push(result);
    }

    return results;
  }

  /**
   * Executes evaluation for a single row/model combination.
   * @param row - Row data from CSV
   * @param rowIndex - Original row index from CSV
   * @param modelId - Model ID to evaluate
   * @param systemPrompt - System prompt for evaluation
   * @param temperature - Temperature for evaluation
   * @returns Evaluation result for this row/model
   */
  private async executeRowModel(
    row: Record<string, unknown>,
    rowIndex: number,
    modelId: string,
    systemPrompt: string,
    temperature: number
  ): Promise<RowEvaluationResult> {
    // Create initial pending row result
    const prompt = interpolateTemplate(systemPrompt, row);
    createRowResult({
      run_id: this.runId,
      original_row_index: rowIndex,
      model_id: modelId,
      prompt_used: prompt,
      status: 'pending',
    });

    try {
      // Get model configuration
      const model = getModelById(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      if (!model.is_active) {
        throw new Error(`Model is inactive: ${modelId}`);
      }

      // Decrypt API key and create client
      const apiKey = decryptApiKey(model.api_key_encrypted);
      const client = ClientFactory.createClient(model.provider, apiKey, model.model_name);

      // Execute model with timeout
      const modelResponse = await Promise.race([
        client.evaluate(prompt, { systemPrompt, temperature }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Model timeout')), MODEL_TIMEOUT_MS)
        ),
      ]);

      if (this.aborted) {
        return {
          rowIndex,
          modelId,
          success: false,
          errorMessage: 'Aborted',
        };
      }

      // Update row result with success
      createRowResult({
        run_id: this.runId,
        original_row_index: rowIndex,
        model_id: modelId,
        prompt_used: prompt,
        output_text: modelResponse.response,
        status: 'completed',
        duration_ms: modelResponse.executionTime,
      });

      return {
        rowIndex,
        modelId,
        success: true,
        outputText: modelResponse.response,
        durationMs: modelResponse.executionTime,
      };
    } catch (error) {
      // Log error but don't throw - continue with other evaluations
      console.error(
        `Row ${rowIndex}, model ${modelId} evaluation error:`,
        error instanceof Error ? error.message : error
      );

      // Update row result with failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      createRowResult({
        run_id: this.runId,
        original_row_index: rowIndex,
        model_id: modelId,
        prompt_used: prompt,
        status: 'failed',
        error_message: errorMessage,
      });

      return {
        rowIndex,
        modelId,
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * Aborts current execution.
   * Further progress updates will be skipped, but current operations will complete.
   */
  abort(): void {
    this.aborted = true;
  }
}

// Singleton for tracking active bulk evaluations
const activeBulkEvaluations = new Map<string, BulkEvaluator>();

/**
 * Starts a new bulk evaluation process in the background.
 * @param runId - Evaluation run ID
 * @param progressCallback - Optional callback for progress updates
 */
export function startBulkEvaluation(runId: string, progressCallback?: BulkProgressCallback): void {
  const evaluator = new BulkEvaluator(runId, progressCallback);
  activeBulkEvaluations.set(runId, evaluator);

  // Execute in background (don't await)
  evaluator.execute().finally(() => {
    activeBulkEvaluations.delete(runId);
  });
}

/**
 * Checks if a bulk evaluation is currently running.
 * @param runId - Evaluation run ID to check
 * @returns True if running
 */
export function isBulkEvaluationRunning(runId: string): boolean {
  return activeBulkEvaluations.has(runId);
}

/**
 * Aborts a running bulk evaluation.
 * @param runId - Evaluation run ID to abort
 * @returns True if evaluation was running and aborted, false otherwise
 */
export function abortBulkEvaluation(runId: string): boolean {
  const evaluator = activeBulkEvaluations.get(runId);
  if (evaluator) {
    evaluator.abort();
    return true;
  }
  return false;
}
