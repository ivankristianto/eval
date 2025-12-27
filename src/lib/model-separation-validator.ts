/**
 * Model separation validator
 * Enforces requirement that task, judge, and prompt engineer models must be from different providers
 * This prevents bias from having the same model evaluate its own outputs
 */

import Database from 'better-sqlite3';
import { getDatabase } from './db';
import type { ValidationResult } from '../types/training';

/**
 * Basic information about a model configuration.
 */
interface ModelInfo {
  id: string;
  provider: string;
  model_name: string;
  is_active: number;
}

/**
 * Validate that task, judge, and prompt engineer models are from different providers.
 *
 * @param taskModelId - ID of the model that generates task outputs
 * @param judgeModelId - ID of the model that judges outputs
 * @param promptEngineerModelId - ID of the model that refines prompts
 * @param db - Optional database instance (for testing)
 * @returns ValidationResult with isValid flag, errors array, and optional model details
 */
export function validateModelSeparation(
  taskModelId: string,
  judgeModelId: string,
  promptEngineerModelId: string,
  db?: Database.Database
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Fetch model configurations from database
  const database = db || getDatabase();
  const stmt = database.prepare(
    'SELECT id, provider, model_name, is_active FROM ModelConfiguration WHERE id = ?'
  );

  const taskModel = stmt.get(taskModelId) as ModelInfo | undefined;
  const judgeModel = stmt.get(judgeModelId) as ModelInfo | undefined;
  const promptEngineerModel = stmt.get(promptEngineerModelId) as ModelInfo | undefined;

  // Check if models exist
  if (!taskModel) {
    errors.push('Task model not found');
  }
  if (!judgeModel) {
    errors.push('Judge model not found');
  }
  if (!promptEngineerModel) {
    errors.push('Prompt Engineer model not found');
  }

  // If any model is missing, return early
  if (!taskModel || !judgeModel || !promptEngineerModel) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Check if models are active
  if (taskModel.is_active !== 1) {
    errors.push('Task model is not active');
  }
  if (judgeModel.is_active !== 1) {
    errors.push('Judge model is not active');
  }
  if (promptEngineerModel.is_active !== 1) {
    errors.push('Prompt Engineer model is not active');
  }

  // If any model is inactive, return early
  if (
    taskModel.is_active !== 1 ||
    judgeModel.is_active !== 1 ||
    promptEngineerModel.is_active !== 1
  ) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Check provider separation
  if (taskModel.provider === judgeModel.provider) {
    errors.push(
      `Task model and Judge model must be from different providers (both are ${taskModel.provider})`
    );
  }

  if (taskModel.provider === promptEngineerModel.provider) {
    errors.push(
      `Task model and Prompt Engineer model must be from different providers (both are ${taskModel.provider})`
    );
  }

  if (judgeModel.provider === promptEngineerModel.provider) {
    errors.push(
      `Judge model and Prompt Engineer model must be from different providers (both are ${judgeModel.provider})`
    );
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    models: isValid
      ? {
          task: { id: taskModel.id, provider: taskModel.provider },
          judge: { id: judgeModel.id, provider: judgeModel.provider },
          promptEngineer: { id: promptEngineerModel.id, provider: promptEngineerModel.provider },
        }
      : undefined,
  };
}

/**
 * Get all available providers from ModelConfiguration table.
 * Useful for UI to show user which providers are available.
 * @returns Array of unique provider names
 */
export function getAvailableProviders(): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT DISTINCT provider FROM ModelConfiguration ORDER BY provider');
  const rows = stmt.all() as { provider: string }[];
  return rows.map((row) => row.provider);
}

/**
 * Get models by provider.
 * Useful for UI to show user which models are available per provider.
 * @param provider - The provider name to filter by
 * @returns Array of models for the provider
 */
export function getModelsByProvider(provider: string): ModelInfo[] {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT id, provider, model_name, is_active FROM ModelConfiguration WHERE provider = ? ORDER BY model_name'
  );
  return stmt.all(provider) as ModelInfo[];
}

/**
 * Suggest valid model combinations (one from each provider).
 * Returns up to 5 valid combinations for quick setup.
 * @returns Array of model combinations
 */
export function suggestModelCombinations(): Array<{
  task: ModelInfo;
  judge: ModelInfo;
  promptEngineer: ModelInfo;
}> {
  const providers = getAvailableProviders();

  if (providers.length < 3) {
    // Not enough providers to create a valid combination
    return [];
  }

  const combinations: Array<{
    task: ModelInfo;
    judge: ModelInfo;
    promptEngineer: ModelInfo;
  }> = [];

  // Get one model from each of the first 3 providers
  for (let i = 0; i < Math.min(providers.length - 2, 5); i++) {
    const taskModels = getModelsByProvider(providers[i]);
    const judgeModels = getModelsByProvider(providers[i + 1]);
    const promptEngineerModels = getModelsByProvider(providers[i + 2]);

    if (taskModels.length > 0 && judgeModels.length > 0 && promptEngineerModels.length > 0) {
      combinations.push({
        task: taskModels[0],
        judge: judgeModels[0],
        promptEngineer: promptEngineerModels[0],
      });
    }
  }

  return combinations;
}
