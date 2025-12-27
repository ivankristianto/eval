/**
 * Integration tests for Judge API calls
 * Tests the judge evaluator with mock API client
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { evaluateOutput, storeJudgeDecision } from '../../src/lib/judge-evaluator';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase } from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Judge API Integration', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();

    // Create model configuration
    db.prepare(`
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('judge-model', 'anthropic', 'claude-3', 'test-key', new Date().toISOString());

    // Create persona
    db.prepare(`
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('task-model', 'openai', 'gpt-4', 'test-key', new Date().toISOString());

    db.prepare(`
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('engineer-model', 'google', 'gemini-pro', 'test-key', new Date().toISOString());

    db.prepare(`
      INSERT INTO personas (id, name, description, task_prompt,
        task_model_id, judge_model_id, prompt_engineer_model_id,
        status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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

    // Create training iteration
    db.prepare(`
      INSERT INTO training_iterations
      (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
       status, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'iteration-1',
      'persona-1',
      1,
      'judge-model',
      'Evaluate the output',
      'in_progress',
      new Date().toISOString()
    );

    // Create training pair
    db.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'pair-1',
      'persona-1',
      'What is 2+2?',
      '4',
      new Date().toISOString()
    );
  });

  describe('evaluateOutput', () => {
    it('should evaluate output and return decision', async () => {
      const result = await evaluateOutput(
        'What is 2+2?',
        '4',
        '4',
        'Is the answer correct?',
        'judge-model'
      );

      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('reasoning');
      expect(result.decision).toMatch(/^(agree|disagree)$/);
    });

    it('should handle different input/output combinations', async () => {
      const result = await evaluateOutput(
        'What is the capital of France?',
        'Paris',
        'Paris',
        'Is the answer correct?',
        'judge-model'
      );

      expect(result.decision).toBeDefined();
    });
  });

  describe('storeJudgeDecision', () => {
    it('should store judge decision to database', () => {
      const decisionId = storeJudgeDecision(
        db,
        'iteration-1',
        'pair-1',
        '4',
        {
          decision: 'agree',
          confidence: 0.95,
          reasoning: 'The answer is correct',
        }
      );

      expect(decisionId).toBeTruthy();

      // Verify stored in database
      const stored = db
        .prepare('SELECT * FROM judge_decisions WHERE id = ?')
        .get(decisionId) as any;

      expect(stored).toBeDefined();
      expect(stored.iteration_id).toBe('iteration-1');
      expect(stored.training_pair_id).toBe('pair-1');
      expect(stored.judge_decision).toBe('agree');
      expect(stored.judge_confidence).toBe(0.95);
      expect(stored.judge_reasoning).toBe('The answer is correct');
    });

    it('should handle missing confidence value', () => {
      const decisionId = storeJudgeDecision(
        db,
        'iteration-1',
        'pair-1',
        'Incorrect answer',
        {
          decision: 'disagree',
          reasoning: 'The answer is wrong',
        }
      );

      const stored = db
        .prepare('SELECT * FROM judge_decisions WHERE id = ?')
        .get(decisionId) as any;

      expect(stored.judge_decision).toBe('disagree');
      expect(stored.judge_confidence).toBeNull();
    });

    it('should allow null result_id when not provided', () => {
      const decisionId = storeJudgeDecision(
        db,
        'iteration-1',
        'pair-1',
        'Test output',
        {
          decision: 'agree',
          confidence: 0.8,
          reasoning: 'Good output',
        }
        // No result_id provided
      );

      const stored = db
        .prepare('SELECT * FROM judge_decisions WHERE id = ?')
        .get(decisionId) as any;

      expect(stored.result_id).toBeNull();
    });
  });

  describe('end-to-end flow', () => {
    it('should evaluate and store a complete judge decision', async () => {
      // Evaluate
      const result = await evaluateOutput(
        'What is 2+2?',
        '4',
        '4',
        'Is the answer mathematically correct?',
        'judge-model',
        db
      );

      // Store
      const decisionId = storeJudgeDecision(
        db,
        'iteration-1',
        'pair-1',
        '4',
        result
      );

      // Verify
      const stored = db
        .prepare('SELECT * FROM judge_decisions WHERE id = ?')
        .get(decisionId) as any;

      expect(stored).toBeDefined();
      expect(stored.judge_decision).toBe(result.decision);
      expect(stored.judge_reasoning).toBe(result.reasoning);
    });
  });
});
