/**
 * Unit tests for Training Loop Orchestration
 * Tests the IterativeTrainingLoop class for managing training iterations
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { IterativeTrainingLoop } from '@lib/training/training-loop';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase } from '../setup';
import { v4 as uuidv4 } from 'uuid';

/** Type for training_loop_state database record */
interface TrainingLoopStateRecord {
  session_id: string;
  status: string;
  pause_reason: string | null;
}

describe('IterativeTrainingLoop', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();

    // Create model configurations (required for personas FK constraints)
    const modelStmt = db.prepare(`
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    modelStmt.run('model-1', 'openai', 'gpt-4', 'test-key-1', new Date().toISOString());
    modelStmt.run('model-2', 'anthropic', 'claude-3', 'test-key-2', new Date().toISOString());
    modelStmt.run('model-3', 'google', 'gemini-pro', 'test-key-3', new Date().toISOString());
  });

  describe('constructor', () => {
    it('should create a new training loop instance with session ID', () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      expect(loop.sessionId).toBe(sessionId);
      expect(loop.personaId).toBe(personaId);
    });
  });

  describe('execute', () => {
    it('should return a promise that resolves when iteration starts', async () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      // Create persona first with max_iterations and target_f1_score
      db.prepare(
        `
        INSERT INTO personas (id, name, description, task_prompt,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_f1_score, max_iterations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        'Test task prompt',
        'model-1',
        'model-2',
        'model-3',
        'draft',
        0.95,
        5,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Create training pairs (required for automated training loop)
      const pairId1 = uuidv4();
      const pairId2 = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(pairId1, personaId, 'Test input 1', 'Test output 1', new Date().toISOString());
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(pairId2, personaId, 'Test input 2', 'Test output 2', new Date().toISOString());

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      // Execute should return a promise
      const promise = loop.execute([]);
      expect(promise).toBeInstanceOf(Promise);

      // Should not throw
      await expect(promise).resolves.not.toThrow();
    });

    it('should create training_loop_state record when execution starts', async () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      // Create persona first with max_iterations and target_f1_score
      db.prepare(
        `
        INSERT INTO personas (id, name, description, task_prompt,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, target_f1_score, max_iterations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        'Test task prompt',
        'model-1',
        'model-2',
        'model-3',
        'draft',
        0.95,
        5,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Create training pairs (required for automated training loop)
      const pairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(pairId, personaId, 'Test input', 'Test output', new Date().toISOString());

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      // Execute (fire and forget)
      void loop.execute([]);

      // Wait a bit for async execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId);
      expect(state).toBeDefined();
    });
  });

  describe('pause', () => {
    it('should pause an in-progress training loop', async () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      // Create persona and loop state
      db.prepare(
        `
        INSERT INTO personas (id, name, description, task_prompt,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        personaId,
        'Test Persona',
        'Test description',
        'Test task prompt',
        'model-1',
        'model-2',
        'model-3',
        'training',
        new Date().toISOString(),
        new Date().toISOString()
      );

      db.prepare(
        `
        INSERT INTO training_loop_state
        (session_id, persona_id, current_iteration, total_iterations,
         status, task_model_id, judge_model_id, prompt_engineer_model_id,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        sessionId,
        personaId,
        1,
        5,
        'in_progress',
        'model-1',
        'model-2',
        'model-3',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      await loop.pause('User requested pause');

      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopStateRecord | undefined;
      expect(state).toBeDefined();
      expect(state!.status).toBe('paused');
      expect(state!.pause_reason).toBe('User requested pause');
    });

    it('should throw error if session not found', async () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      await expect(loop.pause('Test')).rejects.toThrow('Session not found');
    });
  });

  describe('evaluateWithJudge', () => {
    it('should return a promise for judge evaluation', async () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      // execute should return a promise
      const promise = loop.execute([]);
      expect(promise).toBeInstanceOf(Promise);

      // Catch the error to prevent unhandled rejection
      await promise.catch(() => {
        // Expected to fail since persona doesn't exist
      });
    });
  });

  describe('calculateMetricsInWorker', () => {
    it('should calculate metrics from judge results', async () => {
      const sessionId = uuidv4();
      const personaId = uuidv4();

      const loop = new IterativeTrainingLoop(sessionId, personaId, db);

      // Mock judge results
      const judgeResults: Array<{
        judge_decision: 'agree' | 'disagree';
        human_decision: 'agree' | 'disagree';
      }> = [
        { judge_decision: 'agree', human_decision: 'agree' },
        { judge_decision: 'agree', human_decision: 'disagree' },
        { judge_decision: 'disagree', human_decision: 'agree' },
        { judge_decision: 'disagree', human_decision: 'disagree' },
      ];

      const metrics = await loop.calculateMetricsInWorker(judgeResults);

      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('f1_score');
      expect(metrics).toHaveProperty('cohens_kappa');
      expect(metrics).toHaveProperty('confusion_matrix');
    });
  });
});
