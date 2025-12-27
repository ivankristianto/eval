/**
 * Integration tests for model separation validator with database
 * Verifies that model separation validation works correctly with actual ModelConfiguration database queries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  createTestModelConfig,
} from '../setup';
import { validateModelSeparation } from '../../src/lib/model-separation-validator';

describe('Model Separation Validator Integration', () => {
  beforeEach(() => {
    initializeTestDatabase();
    cleanTestDatabase();
  });

  describe('validateModelSeparation with database integration', () => {
    it('should successfully validate when all three models are from different providers', () => {
      const db = getTestDatabase();

      // Create three models from different providers
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

    it('should fail validation when models are from the same provider (OpenAI task + judge)', () => {
      const db = getTestDatabase();

      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'openai'); // Same provider!
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Task model and Judge model'))).toBe(true);
    });

    it('should fail validation when task and prompt engineer models are from the same provider', () => {
      const db = getTestDatabase();

      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'openai'); // Same as task!

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Task model and Prompt Engineer model'))).toBe(
        true
      );
    });

    it('should fail validation when judge and prompt engineer models are from the same provider', () => {
      const db = getTestDatabase();

      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'anthropic'); // Same as judge!

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Judge model and Prompt Engineer model'))).toBe(
        true
      );
    });

    it('should fail validation when all three models are from the same provider', () => {
      const db = getTestDatabase();

      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'openai');
      const promptEngineerModelId = createTestModelConfig(db, 'openai');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2); // At least 2 violations
    });

    it('should handle database queries correctly for nonexistent model IDs', () => {
      const db = getTestDatabase();

      const taskModelId = 'nonexistent-task-id';
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task model not found');
    });

    it('should provide model details in validation result when successful', () => {
      const db = getTestDatabase();

      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(true);
      expect(result.models).toBeDefined();
      if (result.models) {
        expect(result.models.task.id).toBe(taskModelId);
        expect(result.models.judge.id).toBe(judgeModelId);
        expect(result.models.promptEngineer.id).toBe(promptEngineerModelId);

        // Verify model details are complete
        expect(result.models.task.provider).toBeTruthy();
        expect(result.models.judge.provider).toBeTruthy();
        expect(result.models.promptEngineer.provider).toBeTruthy();
      }
    });

    it('should verify that model records exist in database before validation', () => {
      const db = getTestDatabase();

      // Create models
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      // Verify models exist in database
      const taskModel = db
        .prepare('SELECT * FROM ModelConfiguration WHERE id = ?')
        .get(taskModelId);
      const judgeModel = db
        .prepare('SELECT * FROM ModelConfiguration WHERE id = ?')
        .get(judgeModelId);
      const promptEngineerModel = db
        .prepare('SELECT * FROM ModelConfiguration WHERE id = ?')
        .get(promptEngineerModelId);

      expect(taskModel).toBeDefined();
      expect(judgeModel).toBeDefined();
      expect(promptEngineerModel).toBeDefined();

      // Now validate
      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(true);
    });

    it('should handle edge case where only one model ID is invalid', () => {
      const db = getTestDatabase();

      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = 'nonexistent-engineer-id';

      const result = validateModelSeparation(taskModelId, judgeModelId, promptEngineerModelId, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt Engineer model not found');
      expect(result.errors.length).toBe(1); // Only one error
    });

    it('should handle edge case where all model IDs are invalid', () => {
      const result = validateModelSeparation(
        'nonexistent-task',
        'nonexistent-judge',
        'nonexistent-engineer'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors).toContain('Task model not found');
      expect(result.errors).toContain('Judge model not found');
      expect(result.errors).toContain('Prompt Engineer model not found');
    });
  });

  describe('Performance and concurrency', () => {
    it('should handle multiple validations without database conflicts', () => {
      const db = getTestDatabase();

      // Create models
      const openaiId = createTestModelConfig(db, 'openai');
      const anthropicId = createTestModelConfig(db, 'anthropic');
      const googleId = createTestModelConfig(db, 'google');

      // Run multiple validations in sequence (simulating concurrent API requests)
      const results = [
        validateModelSeparation(openaiId, anthropicId, googleId, db),
        validateModelSeparation(googleId, openaiId, anthropicId, db),
        validateModelSeparation(anthropicId, googleId, openaiId, db),
      ];

      // All should pass
      results.forEach((result) => {
        expect(result.isValid).toBe(true);
      });
    });
  });
});
