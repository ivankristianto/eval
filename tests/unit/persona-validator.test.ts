/**
 * Unit tests for persona creation validation
 * Tests validation of required fields, uniqueness, and model separation
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
} from '../setup';
import { validatePersonaCreation } from '../../src/lib/persona-validator';
import type { PersonaCreationInput } from '../../src/types/training';

describe('Persona Validator', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Required Fields Validation', () => {
    it('should pass validation with all required fields', () => {
      const db = getTestDatabase();

      // Create test models from different providers
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'anthropic', 'Claude-3', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'google', 'Gemini-Pro', 'encrypted-key-3', 1);

      const input: PersonaCreationInput = {
        name: 'Test Persona',
        description: 'Test description',
        task_prompt: 'Evaluate customer support responses',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when name is missing', () => {
      const db = getTestDatabase();

      const input: any = {
        description: 'Test description',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail validation when name is empty string', () => {
      const db = getTestDatabase();

      const input: PersonaCreationInput = {
        name: '',
        description: 'Test description',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail validation when task_prompt is missing', () => {
      const db = getTestDatabase();

      const input: any = {
        name: 'Test Persona',
        description: 'Test description',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task prompt is required');
    });

    it('should fail validation when task_model_id is missing', () => {
      const db = getTestDatabase();

      const input: any = {
        name: 'Test Persona',
        description: 'Test description',
        task_prompt: 'Test prompt',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task model ID is required');
    });

    it('should fail validation when judge_model_id is missing', () => {
      const db = getTestDatabase();

      const input: any = {
        name: 'Test Persona',
        description: 'Test description',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Judge model ID is required');
    });

    it('should fail validation when prompt_engineer_model_id is missing', () => {
      const db = getTestDatabase();

      const input: any = {
        name: 'Test Persona',
        description: 'Test description',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt engineer model ID is required');
    });

    it('should allow description to be optional', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'anthropic', 'Claude-3', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'google', 'Gemini-Pro', 'encrypted-key-3', 1);

      const input: PersonaCreationInput = {
        name: 'Test Persona',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Name Uniqueness Validation', () => {
    it('should fail validation when persona name already exists', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'anthropic', 'Claude-3', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'google', 'Gemini-Pro', 'encrypted-key-3', 1);

      // Create existing persona
      db.prepare(`
        INSERT INTO personas (id, name, task_prompt, task_model_id, judge_model_id, prompt_engineer_model_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('existing-persona', 'Existing Persona', 'Prompt', 'task-model', 'judge-model', 'engineer-model', 'draft');

      const input: PersonaCreationInput = {
        name: 'Existing Persona',
        task_prompt: 'Different prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Persona name already exists');
    });

    it('should pass validation when persona name is unique', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'anthropic', 'Claude-3', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'google', 'Gemini-Pro', 'encrypted-key-3', 1);

      // Create existing persona with different name
      db.prepare(`
        INSERT INTO personas (id, name, task_prompt, task_model_id, judge_model_id, prompt_engineer_model_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('existing-persona', 'Existing Persona', 'Prompt', 'task-model', 'judge-model', 'engineer-model', 'draft');

      const input: PersonaCreationInput = {
        name: 'New Unique Persona',
        task_prompt: 'Different prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Model Separation Validation', () => {
    it('should fail validation when models are from the same provider', () => {
      const db = getTestDatabase();

      // Create test models all from OpenAI
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'openai', 'GPT-3.5', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'openai', 'GPT-4-Turbo', 'encrypted-key-3', 1);

      const input: PersonaCreationInput = {
        name: 'Test Persona',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('different providers'))).toBe(true);
    });

    it('should fail validation when task and judge models are from the same provider', () => {
      const db = getTestDatabase();

      // Create test models: task and judge from OpenAI
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'openai', 'GPT-3.5', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'anthropic', 'Claude-3', 'encrypted-key-3', 1);

      const input: PersonaCreationInput = {
        name: 'Test Persona',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('different providers'))).toBe(true);
    });

    it('should fail validation when model ID does not exist', () => {
      const db = getTestDatabase();

      const input: PersonaCreationInput = {
        name: 'Test Persona',
        task_prompt: 'Test prompt',
        task_model_id: 'non-existent-model',
        judge_model_id: 'also-non-existent',
        prompt_engineer_model_id: 'still-non-existent',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('not found') || e.includes('invalid'))).toBe(true);
    });

    it('should fail validation when a model is inactive', () => {
      const db = getTestDatabase();

      // Create test models, one inactive
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'anthropic', 'Claude-3', 'encrypted-key-2', 0); // inactive
      taskModel.run('engineer-model', 'google', 'Gemini-Pro', 'encrypted-key-3', 1);

      const input: PersonaCreationInput = {
        name: 'Test Persona',
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('inactive') || e.includes('not active'))).toBe(true);
    });
  });

  describe('Error Message Quality', () => {
    it('should return clear, actionable error messages', () => {
      const db = getTestDatabase();

      const input: any = {
        name: '',
        task_model_id: '',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // All error messages should be non-empty strings
      result.errors.forEach(error => {
        expect(error).toBeTruthy();
        expect(typeof error).toBe('string');
        expect(error.length).toBeGreaterThan(5);
      });
    });

    it('should return multiple errors when multiple validations fail', () => {
      const db = getTestDatabase();

      const input: any = {
        name: '',
        task_prompt: '',
      };

      const result = validatePersonaCreation(input, db);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Warnings', () => {
    it('should include warnings for optional best practices', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModel = db.prepare(`
        INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      taskModel.run('task-model', 'openai', 'GPT-4', 'encrypted-key-1', 1);
      taskModel.run('judge-model', 'anthropic', 'Claude-3', 'encrypted-key-2', 1);
      taskModel.run('engineer-model', 'google', 'Gemini-Pro', 'encrypted-key-3', 1);

      const input: PersonaCreationInput = {
        name: 'x', // Very short name
        task_prompt: 'Test prompt',
        task_model_id: 'task-model',
        judge_model_id: 'judge-model',
        prompt_engineer_model_id: 'engineer-model',
      };

      const result = validatePersonaCreation(input, db);

      // Should pass validation but include warnings
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });
});
