/**
 * Integration tests for Metrics Calculation
 * Tests the complete flow from judge decisions + human reviews to calculated metrics
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { calculateIterationMetrics } from '../../src/lib/metrics-orchestrator';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase } from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Metrics Calculation Integration', () => {
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
      'training',
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
      'completed',
      new Date().toISOString()
    );
  });

  describe('calculateIterationMetrics', () => {
    it('should calculate metrics when all decisions have human reviews', () => {
      // Create training pairs
      const pair1 = uuidv4();
      const pair2 = uuidv4();
      const pair3 = uuidv4();
      const pair4 = uuidv4();

      const pairStmt = db.prepare(`
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      pairStmt.run(pair1, 'persona-1', 'Input 1', 'Output 1', new Date().toISOString());
      pairStmt.run(pair2, 'persona-1', 'Input 2', 'Output 2', new Date().toISOString());
      pairStmt.run(pair3, 'persona-1', 'Input 3', 'Output 3', new Date().toISOString());
      pairStmt.run(pair4, 'persona-1', 'Input 4', 'Output 4', new Date().toISOString());

      // Create judge decisions
      // TP: Judge agree, Human agree
      const decision1 = uuidv4();
      // FP: Judge agree, Human disagree
      const decision2 = uuidv4();
      // FN: Judge disagree, Human agree
      const decision3 = uuidv4();
      // TN: Judge disagree, Human disagree
      const decision4 = uuidv4();

      const decisionStmt = db.prepare(`
        INSERT INTO judge_decisions
        (id, iteration_id, training_pair_id, generated_output, judge_decision,
         judge_confidence, judge_reasoning, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      decisionStmt.run(decision1, 'iteration-1', pair1, 'Output 1', 'agree', 0.9, 'Good', new Date().toISOString());
      decisionStmt.run(decision2, 'iteration-1', pair2, 'Output 2', 'agree', 0.8, 'Good', new Date().toISOString());
      decisionStmt.run(decision3, 'iteration-1', pair3, 'Bad output', 'disagree', 0.7, 'Bad', new Date().toISOString());
      decisionStmt.run(decision4, 'iteration-1', pair4, 'Bad output', 'disagree', 0.6, 'Bad', new Date().toISOString());

      // Create human reviews
      const reviewStmt = db.prepare(`
        INSERT INTO human_reviews
        (id, judge_decision_id, human_decision, human_notes, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      reviewStmt.run(uuidv4(), decision1, 'agree', 'I agree', new Date().toISOString());
      reviewStmt.run(uuidv4(), decision2, 'disagree', 'I disagree', new Date().toISOString());
      reviewStmt.run(uuidv4(), decision3, 'agree', 'Should agree', new Date().toISOString());
      reviewStmt.run(uuidv4(), decision4, 'disagree', 'Correct', new Date().toISOString());

      // Calculate metrics
      const metrics = calculateIterationMetrics('iteration-1', db);

      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('f1_score');
      expect(metrics).toHaveProperty('cohens_kappa');
      expect(metrics).toHaveProperty('confusion_matrix');

      // Verify confusion matrix
      expect(metrics.confusion_matrix.true_positives).toBe(1); // decision1
      expect(metrics.confusion_matrix.false_positives).toBe(1); // decision2
      expect(metrics.confusion_matrix.false_negatives).toBe(1); // decision3
      expect(metrics.confusion_matrix.true_negatives).toBe(1); // decision4

      // Verify metrics calculations
      expect(metrics.precision).toBeCloseTo(0.5); // TP/(TP+FP) = 1/2
      expect(metrics.recall).toBeCloseTo(0.5); // TP/(TP+FN) = 1/2
      expect(metrics.f1_score).toBeCloseTo(0.5); // 2*P*R/(P+R) = 2*0.5*0.5/1
    });

    it('should throw error if not all decisions have human reviews', () => {
      // Create training pair
      const pair1 = uuidv4();
      db.prepare(`
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(pair1, 'persona-1', 'Input 1', 'Output 1', new Date().toISOString());

      // Create judge decision without human review
      const decision1 = uuidv4();
      db.prepare(`
        INSERT INTO judge_decisions
        (id, iteration_id, training_pair_id, generated_output, judge_decision,
         judge_reasoning, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(decision1, 'iteration-1', pair1, 'Output 1', 'agree', 'Good', new Date().toISOString());

      // Should throw error
      expect(() => calculateIterationMetrics('iteration-1', db)).toThrow('incomplete human feedback');
    });

    it('should store metrics to iteration_metrics table', () => {
      // Create simple test case
      const pair1 = uuidv4();
      db.prepare(`
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(pair1, 'persona-1', 'Input 1', 'Output 1', new Date().toISOString());

      const decision1 = uuidv4();
      db.prepare(`
        INSERT INTO judge_decisions
        (id, iteration_id, training_pair_id, generated_output, judge_decision,
         judge_reasoning, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(decision1, 'iteration-1', pair1, 'Output 1', 'agree', 'Good', new Date().toISOString());

      db.prepare(`
        INSERT INTO human_reviews (id, judge_decision_id, human_decision, created_at)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), decision1, 'agree', new Date().toISOString());

      // Calculate metrics
      calculateIterationMetrics('iteration-1', db);

      // Verify stored in database
      const storedMetrics = db
        .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
        .get('iteration-1') as any;

      expect(storedMetrics).toBeDefined();
      expect(storedMetrics.iteration_id).toBe('iteration-1');
      expect(storedMetrics).toHaveProperty('f1_score');
      expect(storedMetrics).toHaveProperty('precision');
      expect(storedMetrics).toHaveProperty('recall');
      expect(storedMetrics).toHaveProperty('cohens_kappa');
    });

    it('should update persona best_f1_score if improved', () => {
      // Create simple perfect case (F1 = 1.0)
      const pair1 = uuidv4();
      db.prepare(`
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(pair1, 'persona-1', 'Input 1', 'Output 1', new Date().toISOString());

      const decision1 = uuidv4();
      db.prepare(`
        INSERT INTO judge_decisions
        (id, iteration_id, training_pair_id, generated_output, judge_decision,
         judge_reasoning, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(decision1, 'iteration-1', pair1, 'Output 1', 'agree', 'Good', new Date().toISOString());

      db.prepare(`
        INSERT INTO human_reviews (id, judge_decision_id, human_decision, created_at)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), decision1, 'agree', new Date().toISOString());

      // Calculate metrics
      calculateIterationMetrics('iteration-1', db);

      // Verify persona updated
      const persona = db
        .prepare('SELECT * FROM personas WHERE id = ?')
        .get('persona-1') as any;

      expect(persona.best_f1_score).toBeDefined();
      expect(persona.best_f1_iteration).toBe(1);
    });
  });
});
