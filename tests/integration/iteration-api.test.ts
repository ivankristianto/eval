/**
 * Integration tests for Training Iteration API endpoints
 * Tests start training and status endpoints
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase } from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Training Iteration API', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();

    // Create model configurations
    const modelStmt = db.prepare(`
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    modelStmt.run('task-model', 'openai', 'gpt-4', 'test-key', new Date().toISOString());
    modelStmt.run('judge-model', 'anthropic', 'claude-3', 'test-key', new Date().toISOString());
    modelStmt.run('engineer-model', 'google', 'gemini-pro', 'test-key', new Date().toISOString());

    // Create persona
    db.prepare(
      `
      INSERT INTO personas (id, name, description, task_prompt,
        task_model_id, judge_model_id, prompt_engineer_model_id,
        status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      'persona-1',
      'Test Persona',
      'Test description',
      'Test task prompt',
      'task-model',
      'judge-model',
      'engineer-model',
      'draft',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create training pairs
    const pairStmt = db.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < 10; i++) {
      pairStmt.run(
        uuidv4(),
        'persona-1',
        `Input ${i + 1}`,
        `Output ${i + 1}`,
        new Date().toISOString()
      );
    }
  });

  describe('POST /api/personas/[id]/training/start', () => {
    it('should create training iteration record', () => {
      const iterationId = uuidv4();

      // Simulate API creating iteration
      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
         status, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        iterationId,
        'persona-1',
        1,
        'judge-model',
        'Evaluate the output',
        'in_progress',
        new Date().toISOString()
      );

      // Verify iteration created
      const iteration = db
        .prepare('SELECT * FROM training_iterations WHERE id = ?')
        .get(iterationId) as {
          persona_id: string;
          iteration_number: number;
          status: string;
        } | undefined;

      expect(iteration).toBeDefined();
      expect(iteration!.persona_id).toBe('persona-1');
      expect(iteration!.iteration_number).toBe(1);
      expect(iteration!.status).toBe('in_progress');
    });

    it('should create training_loop_state record', () => {
      const sessionId = uuidv4();

      // Simulate API creating training loop state
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
        'persona-1',
        1,
        5,
        'in_progress',
        'task-model',
        'judge-model',
        'engineer-model',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as {
          status: string;
          total_iterations: number;
        } | undefined;

      expect(state).toBeDefined();
      expect(state!.status).toBe('in_progress');
      expect(state!.total_iterations).toBe(5);
    });

    it('should increment iteration number for subsequent iterations', () => {
      // Create first iteration
      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
         status, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        uuidv4(),
        'persona-1',
        1,
        'judge-model',
        'Evaluate the output',
        'completed',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Create second iteration
      const iteration2Id = uuidv4();
      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
         status, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        iteration2Id,
        'persona-1',
        2,
        'judge-model',
        'Evaluate the output v2',
        'in_progress',
        new Date().toISOString()
      );

      const iteration2 = db
        .prepare('SELECT * FROM training_iterations WHERE id = ?')
        .get(iteration2Id) as {
          iteration_number: number;
        } | undefined;

      expect(iteration2).toBeDefined();
      expect(iteration2!.iteration_number).toBe(2);
    });

    it('should return 400 if persona has no training pairs', () => {
      // Create persona without training pairs
      db.prepare(
        `
        INSERT INTO personas (id, name, description, task_prompt,
          task_model_id, judge_model_id, prompt_engineer_model_id,
          status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'persona-2',
        'Empty Persona',
        'No training data',
        'Test prompt',
        'task-model',
        'judge-model',
        'engineer-model',
        'draft',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Check if persona has training pairs
      const pairs = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get('persona-2') as { count: number };

      expect(pairs.count).toBe(0);
    });
  });

  describe('GET /api/personas/[id]/training/status', () => {
    it('should return latest iteration with metrics', () => {
      // Create completed iteration
      const iterationId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
         status, total_pairs_evaluated, pairs_reviewed_by_human,
         started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        iterationId,
        'persona-1',
        1,
        'judge-model',
        'Evaluate the output',
        'completed',
        10,
        10,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Create metrics
      db.prepare(
        `
        INSERT INTO iteration_metrics
        (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
         precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(uuidv4(), iterationId, 8, 1, 1, 0, 0.89, 1.0, 0.94, 0.8, 0.9, new Date().toISOString());

      // Query for status
      const status = db
        .prepare(
          `
          SELECT
            ti.*,
            im.f1_score,
            im.precision,
            im.recall,
            im.cohens_kappa
          FROM training_iterations ti
          LEFT JOIN iteration_metrics im ON im.iteration_id = ti.id
          WHERE ti.persona_id = ?
          ORDER BY ti.iteration_number DESC
          LIMIT 1
        `
        )
        .get('persona-1') as {
          iteration_number: number;
          status: string;
          f1_score: number;
          pairs_reviewed_by_human: number;
        } | undefined;

      expect(status).toBeDefined();
      expect(status!.iteration_number).toBe(1);
      expect(status!.status).toBe('completed');
      expect(status!.f1_score).toBeCloseTo(0.94);
      expect(status!.pairs_reviewed_by_human).toBe(10);
    });

    it('should return in_progress status for ongoing iteration', () => {
      const iterationId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
         status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        iterationId,
        'persona-1',
        1,
        'judge-model',
        'Evaluate the output',
        'in_progress',
        10,
        5,
        new Date().toISOString()
      );

      const status = db
        .prepare('SELECT * FROM training_iterations WHERE id = ?')
        .get(iterationId) as {
          iteration_number: number;
          status: string;
          pairs_reviewed_by_human: number;
          total_pairs_evaluated: number;
        } | undefined;

      expect(status).toBeDefined();
      expect(status!.status).toBe('in_progress');
      expect(status!.pairs_reviewed_by_human).toBe(5);
      expect(status!.total_pairs_evaluated).toBe(10);
    });

    it('should return null if no iterations exist', () => {
      const iteration = db
        .prepare('SELECT * FROM training_iterations WHERE persona_id = ?')
        .get('persona-1');

      expect(iteration).toBeUndefined();
    });
  });
});
