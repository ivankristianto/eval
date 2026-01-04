/**
 * Persona Creation Validator
 * Validates persona input and enforces model separation requirements
 */

import type Database from 'better-sqlite3';
import { getDatabase } from '@lib/db';
import { validateModelSeparation } from './model-separation-validator';
import type { PersonaCreationInput, ValidationResult } from '@src-types/training';

/**
 * Validates persona creation input
 * - Checks required fields
 * - Validates persona name uniqueness
 * - Enforces model separation (different providers)
 * - Verifies models exist and are active
 *
 * @param input - Persona creation input
 * @param db - Optional database instance (for testing)
 * @returns ValidationResult with isValid, errors, warnings
 */
export function validatePersonaCreation(
  input: PersonaCreationInput,
  db?: Database.Database
): ValidationResult {
  const database = db || getDatabase();
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate required fields
  if (!input.name || input.name.trim() === '') {
    errors.push('Name is required');
  }

  if (!input.initial_task_prompt || input.initial_task_prompt.trim() === '') {
    errors.push('Task prompt is required');
  }

  if (!input.initial_judge_prompt || input.initial_judge_prompt.trim() === '') {
    errors.push('Initial judge prompt is required');
  }

  if (!input.task_model_id || input.task_model_id.trim() === '') {
    errors.push('Task model ID is required');
  }

  if (!input.judge_model_id || input.judge_model_id.trim() === '') {
    errors.push('Judge model ID is required');
  }

  if (!input.prompt_engineer_model_id || input.prompt_engineer_model_id.trim() === '') {
    errors.push('Prompt engineer model ID is required');
  }

  // If any required fields are missing, return early
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // 2. Validate persona name uniqueness
  const existingPersona = database
    .prepare('SELECT id FROM personas WHERE name = ?')
    .get(input.name.trim());

  if (existingPersona) {
    errors.push('Persona name already exists');
  }

  // 3. Validate model separation (different providers)
  const modelSeparationResult = validateModelSeparation(
    input.task_model_id,
    input.judge_model_id,
    input.prompt_engineer_model_id,
    database
  );

  if (!modelSeparationResult.isValid) {
    errors.push(...modelSeparationResult.errors);
  }

  // Add warnings from model separation validation
  if (modelSeparationResult.warnings) {
    warnings.push(...modelSeparationResult.warnings);
  }

  // 4. Add warnings for best practices
  if (input.name && input.name.trim().length < 3) {
    warnings.push('Persona name is very short. Consider using a more descriptive name.');
  }

  if (input.initial_task_prompt && input.initial_task_prompt.trim().length < 10) {
    warnings.push('Task prompt is very short. Consider providing more context.');
  }

  if (input.initial_judge_prompt && input.initial_judge_prompt.trim().length < 10) {
    warnings.push(
      'Initial judge prompt is very short. Consider providing more evaluation criteria.'
    );
  }

  if (!input.description || input.description.trim() === '') {
    warnings.push('No description provided. Adding a description helps with organization.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    models: modelSeparationResult.models,
  };
}

/**
 * Validates persona update input
 * - Only validates fields that are being updated
 * - Skips model separation if models aren't being changed
 *
 * @param personaId - Existing persona ID
 * @param updates - Partial persona updates
 * @param db - Optional database instance (for testing)
 * @returns ValidationResult
 */
export function validatePersonaUpdate(
  personaId: string,
  updates: Partial<PersonaCreationInput>,
  db?: Database.Database
): ValidationResult {
  const database = db || getDatabase();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verify persona exists
  const existingPersona = database.prepare('SELECT id FROM personas WHERE id = ?').get(personaId);

  if (!existingPersona) {
    errors.push(`Persona not found: ${personaId}`);
    return { isValid: false, errors, warnings };
  }

  // Validate name uniqueness if name is being updated
  if (updates.name !== undefined) {
    if (!updates.name || updates.name.trim() === '') {
      errors.push('Name cannot be empty');
    } else {
      const duplicateName = database
        .prepare('SELECT id FROM personas WHERE name = ? AND id != ?')
        .get(updates.name.trim(), personaId);

      if (duplicateName) {
        errors.push('Persona name already exists');
      }

      if (updates.name.trim().length < 3) {
        warnings.push('Persona name is very short. Consider using a more descriptive name.');
      }
    }
  }

  // If models are being updated, validate model separation
  if (
    updates.task_model_id !== undefined ||
    updates.judge_model_id !== undefined ||
    updates.prompt_engineer_model_id !== undefined
  ) {
    // Get current persona to merge with updates
    const current = database
      .prepare(
        'SELECT task_model_id, judge_model_id, prompt_engineer_model_id FROM personas WHERE id = ?'
      )
      .get(personaId) as {
      task_model_id: string;
      judge_model_id: string;
      prompt_engineer_model_id: string;
    };

    const taskModelId = updates.task_model_id ?? current.task_model_id;
    const judgeModelId = updates.judge_model_id ?? current.judge_model_id;
    const promptEngineerModelId =
      updates.prompt_engineer_model_id ?? current.prompt_engineer_model_id;

    const modelSeparationResult = validateModelSeparation(
      taskModelId,
      judgeModelId,
      promptEngineerModelId,
      database
    );

    if (!modelSeparationResult.isValid) {
      errors.push(...modelSeparationResult.errors);
    }

    if (modelSeparationResult.warnings) {
      warnings.push(...modelSeparationResult.warnings);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
