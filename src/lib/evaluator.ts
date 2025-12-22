// src/lib/evaluator.ts
// Evaluation orchestration for AI Model Evaluation Framework

import { ClientFactory } from './api-clients';
import { calculateAccuracy } from './accuracy';
import {
  getModelById,
  getEvaluation,
  updateEvaluationStatus,
  updateResult,
  getResults,
  decryptApiKey,
} from './db';
import type { RubricType, ResultStatus } from './types';

// Timeout constants
const MODEL_TIMEOUT_MS = 30000; // 30 seconds per model
const EVALUATION_TIMEOUT_MS = 300000; // 5 minutes total

export interface EvaluationOptions {
  evaluationId: string;
  modelIds: string[];
  instruction: string;
  rubricType: RubricType;
  expectedOutput: string;
  partialCreditConcepts?: string[];
}

export class EvaluationExecutor {
  private aborted = false;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  async execute(options: EvaluationOptions): Promise<void> {
    const {
      evaluationId,
      modelIds,
      instruction,
      rubricType,
      expectedOutput,
      partialCreditConcepts,
    } = options;

    // Set hard timeout
    this.timeoutHandle = setTimeout(() => {
      this.abort();
      this.handleTimeout(evaluationId);
    }, EVALUATION_TIMEOUT_MS);

    try {
      // Update evaluation status to running
      updateEvaluationStatus(evaluationId, 'running');

      // Execute all models in parallel
      const modelPromises = modelIds.map((modelId) =>
        this.executeModel(
          evaluationId,
          modelId,
          instruction,
          rubricType,
          expectedOutput,
          partialCreditConcepts
        )
      );

      // Wait for all models to complete
      await Promise.allSettled(modelPromises);

      if (this.aborted) return;

      // Check if all models completed or failed
      const results = getResults(evaluationId);
      const allCompleted = results.every((r) => r.status !== 'pending');

      if (allCompleted) {
        const hasAnySuccess = results.some((r) => r.status === 'completed');
        if (hasAnySuccess) {
          updateEvaluationStatus(evaluationId, 'completed');
        } else {
          updateEvaluationStatus(evaluationId, 'failed', 'All models failed');
        }
      }
    } catch (error) {
      console.error('Evaluation execution error:', error);
      if (!this.aborted) {
        updateEvaluationStatus(
          evaluationId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } finally {
      this.clearTimeout();
    }
  }

  private async executeModel(
    evaluationId: string,
    modelId: string,
    instruction: string,
    rubricType: RubricType,
    expectedOutput: string,
    partialCreditConcepts?: string[]
  ): Promise<void> {
    // Find the result record for this model
    const results = getResults(evaluationId);
    const resultRecord = results.find((r) => r.model_id === modelId);
    if (!resultRecord) {
      console.error(`No result record found for model ${modelId}`);
      return;
    }

    try {
      // Get model configuration
      const model = getModelById(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      if (!model.is_active) {
        throw new Error('Model is inactive');
      }

      // Decrypt API key
      const apiKey = decryptApiKey(model.api_key_encrypted);

      // Create client and execute with timeout
      const client = ClientFactory.createClient(model.provider, apiKey, model.model_name);

      const modelResponse = await Promise.race([
        client.evaluate(instruction),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Model timeout')), MODEL_TIMEOUT_MS)
        ),
      ]);

      if (this.aborted) return;

      // Calculate accuracy
      const accuracyResult = await calculateAccuracy(
        rubricType,
        modelResponse.response,
        expectedOutput,
        partialCreditConcepts
      );

      // Update result record
      updateResult(resultRecord.id, {
        response_text: modelResponse.response,
        execution_time_ms: modelResponse.executionTime,
        input_tokens: modelResponse.inputTokens,
        output_tokens: modelResponse.outputTokens,
        total_tokens: modelResponse.totalTokens,
        accuracy_score: accuracyResult.score,
        accuracy_reasoning: accuracyResult.reasoning,
        status: 'completed' as ResultStatus,
      });
    } catch (error) {
      console.error(`Model ${modelId} execution error:`, error);

      if (!this.aborted) {
        updateResult(resultRecord.id, {
          status: 'failed' as ResultStatus,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private handleTimeout(evaluationId: string): void {
    console.error(`Evaluation ${evaluationId} timed out`);
    updateEvaluationStatus(evaluationId, 'failed', 'Evaluation timed out after 5 minutes');

    // Mark any pending results as failed
    const results = getResults(evaluationId);
    for (const result of results) {
      if (result.status === 'pending') {
        updateResult(result.id, {
          status: 'failed' as ResultStatus,
          error_message: 'Timeout',
        });
      }
    }
  }

  abort(): void {
    this.aborted = true;
    this.clearTimeout();
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}

// Singleton for tracking active evaluations
const activeEvaluations = new Map<string, EvaluationExecutor>();

export function startEvaluation(options: EvaluationOptions): void {
  const executor = new EvaluationExecutor();
  activeEvaluations.set(options.evaluationId, executor);

  // Execute in background (don't await)
  executor.execute(options).finally(() => {
    activeEvaluations.delete(options.evaluationId);
  });
}

export function cancelEvaluation(evaluationId: string): boolean {
  const executor = activeEvaluations.get(evaluationId);
  if (executor) {
    executor.abort();
    activeEvaluations.delete(evaluationId);

    const evaluation = getEvaluation(evaluationId);
    if (evaluation && evaluation.status !== 'completed') {
      updateEvaluationStatus(evaluationId, 'failed', 'Cancelled by user');
    }

    return true;
  }
  return false;
}

export function isEvaluationRunning(evaluationId: string): boolean {
  return activeEvaluations.has(evaluationId);
}
