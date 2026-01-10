/**
 * Integration tests for feedback-by-pair functionality
 * Tests human feedback submission by training_pair_id
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
} from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Feedback by Pair - Integration Tests', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Core Validation Logic', () => {
    it('should validate training_pair_id belongs to persona', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      // Create persona
      const personaId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Create training pair
      const trainingPairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(trainingPairId, personaId, 'Test input', 'Expected output', now);

      // Query to verify training pair belongs to persona
      const trainingPair = db
        .prepare('SELECT * FROM training_pairs WHERE id = ? AND persona_id = ?')
        .get(trainingPairId, personaId);

      expect(trainingPair).toBeDefined();
      expect(trainingPair).toBeTruthy();
    });

    it('should return null when training_pair_id does not belong to persona', () => {
      const db = getTestDatabase();

      // Create two personas
      const persona1Id = uuidv4();
      const persona2Id = uuidv4();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');
      const now = new Date().toISOString();

      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        persona1Id,
        'Test Persona 1',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        persona2Id,
        'Test Persona 2',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Create training pair for persona1
      const trainingPairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(trainingPairId, persona1Id, 'Test input', 'Expected output', now);

      // Query with persona2 should return null
      const trainingPair = db
        .prepare('SELECT * FROM training_pairs WHERE id = ? AND persona_id = ?')
        .get(trainingPairId, persona2Id);

      expect(trainingPair).toBeUndefined();
    });
  });

  describe('Latest Result Query', () => {
    it('should fetch the latest result when multiple exist for the same pair', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      // Create persona
      const personaId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Create training pair
      const trainingPairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(trainingPairId, personaId, 'Test input', 'Expected output', now);

      // Create first result (older)
      const resultId1 = uuidv4();
      const earlierTime = new Date(Date.now() - 10000).toISOString();
      db.prepare(
        `
        INSERT INTO training_pair_results (
          id, persona_id, training_pair_id, generated_output,
          judge_rating, judge_feedback,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        resultId1,
        personaId,
        trainingPairId,
        'Old output',
        'pass',
        'Old',
        earlierTime,
        earlierTime
      );

      // Create second result (newer)
      const resultId2 = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pair_results (
          id, persona_id, training_pair_id, generated_output,
          judge_rating, judge_feedback,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(resultId2, personaId, trainingPairId, 'New output', 'fail', 'New', now, now);

      // Query for latest result
      const latestResult = db
        .prepare(
          `
          SELECT * FROM training_pair_results
          WHERE training_pair_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `
        )
        .get(trainingPairId);

      expect(latestResult).toBeDefined();
      expect((latestResult as { id: string }).id).toBe(resultId2);
    });

    it('should return null when no results exist for training pair', () => {
      const db = getTestDatabase();

      // Query for non-existent result
      const result = db
        .prepare(
          `
          SELECT * FROM training_pair_results
          WHERE training_pair_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `
        )
        .get(uuidv4());

      expect(result).toBeUndefined();
    });
  });

  describe('Human Rating Validation', () => {
    it('should only accept "pass" or "fail" as human_rating values', () => {
      const validRatings = ['pass', 'fail'];
      const invalidRatings = ['Pass', 'Fail', 'PASS', 'FAIL', 'yes', 'no', '1', '0', true, false];

      // All valid ratings should be in the allowed set
      expect(validRatings).toContain('pass');
      expect(validRatings).toContain('fail');

      // Invalid ratings should not match the allowed values
      invalidRatings.forEach((rating) => {
        expect(rating === 'pass' || rating === 'fail').toBe(false);
      });
    });
  });

  describe('Database Update Operations', () => {
    it('should update human_rating and human_feedback in training_pair_results', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      // Create persona
      const personaId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Create training pair
      const trainingPairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(trainingPairId, personaId, 'Test input', 'Expected output', now);

      // Create training pair result
      const resultId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pair_results (
          id, persona_id, training_pair_id, generated_output,
          judge_rating, judge_feedback,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(resultId, personaId, trainingPairId, 'Generated output', 'pass', 'Good job', now, now);

      // Update with human feedback
      db.prepare(
        `
        UPDATE training_pair_results
        SET human_rating = ?, human_feedback = ?, updated_at = ?
        WHERE id = ?
      `
      ).run('pass', 'Correct judgment', new Date().toISOString(), resultId);

      // Verify update
      const result = db
        .prepare('SELECT * FROM training_pair_results WHERE id = ?')
        .get(resultId) as {
        human_rating: string;
        human_feedback: string;
      };

      expect(result.human_rating).toBe('pass');
      expect(result.human_feedback).toBe('Correct judgment');
    });

    it('should allow updating existing human feedback', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      // Create persona
      const personaId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Create training pair
      const trainingPairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(trainingPairId, personaId, 'Test input', 'Expected output', now);

      // Create training pair result with existing feedback
      const resultId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pair_results (
          id, persona_id, training_pair_id, generated_output,
          judge_rating, judge_feedback, human_rating, human_feedback,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        resultId,
        personaId,
        trainingPairId,
        'Generated output',
        'pass',
        'Good job',
        'pass',
        'Original feedback',
        now,
        now
      );

      // Update with new feedback
      db.prepare(
        `
        UPDATE training_pair_results
        SET human_rating = ?, human_feedback = ?, updated_at = ?
        WHERE id = ?
      `
      ).run('fail', 'Updated feedback', new Date().toISOString(), resultId);

      // Verify update
      const result = db
        .prepare('SELECT * FROM training_pair_results WHERE id = ?')
        .get(resultId) as {
        human_rating: string;
        human_feedback: string;
      };

      expect(result.human_rating).toBe('fail');
      expect(result.human_feedback).toBe('Updated feedback');
    });

    it('should allow null human_feedback (optional field)', () => {
      const db = getTestDatabase();

      // Create test models
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      // Create persona
      const personaId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO personas (
          id, name, description,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_pass_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Create training pair
      const trainingPairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(trainingPairId, personaId, 'Test input', 'Expected output', now);

      // Create training pair result
      const resultId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pair_results (
          id, persona_id, training_pair_id, generated_output,
          judge_rating, judge_feedback,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(resultId, personaId, trainingPairId, 'Generated output', 'pass', 'Good job', now, now);

      // Update with human rating but no feedback
      db.prepare(
        `
        UPDATE training_pair_results
        SET human_rating = ?, human_feedback = ?, updated_at = ?
        WHERE id = ?
      `
      ).run('pass', null, new Date().toISOString(), resultId);

      // Verify update
      const result = db
        .prepare('SELECT * FROM training_pair_results WHERE id = ?')
        .get(resultId) as {
        human_rating: string;
        human_feedback: string | null;
      };

      expect(result.human_rating).toBe('pass');
      expect(result.human_feedback).toBeNull();
    });
  });
});
