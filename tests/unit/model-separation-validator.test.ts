/**
 * Unit tests for model separation validator
 * Validates that task, judge, and prompt engineer models are from different providers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  createTestModelConfig,
} from '../setup';
import { validateModelSeparation } from '@lib/validation/model-separation-validator';

describe('Model Separation Validator', () => {
  beforeEach(() => {
    initializeTestDatabase();
    cleanTestDatabase();
  });

  describe('validateModelSeparation', () => {
    it('should pass validation when all three models are from different providers', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.models).toBeDefined();
      expect(result.models?.task.provider).toBe('openai');
      expect(result.models?.judge.provider).toBe('anthropic');
      expect(result.models?.promptEngineer.provider).toBe('google');
    });

    it('should fail validation when task and judge models are from the same provider', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'openai'); // Same provider
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes('Task model and Judge model must be from different providers')
        )
      ).toBe(true);
    });

    it('should fail validation when task and prompt engineer models are from the same provider', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'openai'); // Same provider

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes('Task model and Prompt Engineer model must be from different providers')
        )
      ).toBe(true);
    });

    it('should fail validation when judge and prompt engineer models are from the same provider', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'anthropic'); // Same provider

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes('Judge model and Prompt Engineer model must be from different providers')
        )
      ).toBe(true);
    });

    it('should fail validation when all three models are from the same provider', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'openai');
      const promptEngineerModelId = createTestModelConfig(db, 'openai');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) =>
          e.includes('Task model and Judge model must be from different providers')
        )
      ).toBe(true);
      expect(
        result.errors.some((e) =>
          e.includes('Task model and Prompt Engineer model must be from different providers')
        )
      ).toBe(true);
    });

    it('should fail validation when task model does not exist', () => {
      const db = getTestDatabase();
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation('nonexistent-id', judgeModelId, promptEngineerModelId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task model not found');
    });

    it('should fail validation when judge model does not exist', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, 'nonexistent-id', promptEngineerModelId);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Judge model not found');
    });

    it('should fail validation when prompt engineer model does not exist', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');

      const result = validateModelSeparation(taskModelId, judgeModelId, 'nonexistent-id');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt Engineer model not found');
    });

    it('should fail validation when multiple models do not exist', () => {
      const result = validateModelSeparation('nonexistent-1', 'nonexistent-2', 'nonexistent-3');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task model not found');
      expect(result.errors).toContain('Judge model not found');
      expect(result.errors).toContain('Prompt Engineer model not found');
    });

    it('should include model details in the validation result when valid', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(true);
      expect(result.models).toBeDefined();
      expect(result.models?.task.id).toBe(taskModelId);
      expect(result.models?.judge.id).toBe(judgeModelId);
      expect(result.models?.promptEngineer.id).toBe(promptEngineerModelId);
    });

    it('should provide clear error messages for validation failures', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'openai');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors[0]).toMatch(
        /Task model and Judge model must be from different providers/
      );
    });

    it('should handle empty model IDs', () => {
      const result = validateModelSeparation('', '', '');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
