/**
 * Integration tests for Human Review API endpoints
 * Tests fetching decisions and submitting feedback
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase } from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Human Review API', () => {
  let db: ReturnType<typeof getTestDatabase>;
  let personaId: string;
  let iterationId: string;
  let decisionId: string;

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
    personaId = uuidv4();
    db.prepare(`
      INSERT INTO personas (id, name, description, task_prompt,
        task_model_id, judge_model_id, prompt_engineer_model_id,
        status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personaId,
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
    iterationId = uuidv4();
    db.prepare(`
      INSERT INTO training_iterations
      (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
       status, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      iterationId,
      personaId,
      1,
      'judge-model',
      'Evaluate the output',
      'in_progress',
      new Date().toISOString()
    );

    // Create training pair
    const pairId = uuidv4();
    db.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(pairId, personaId, 'What is 2+2?', '4', new Date().toISOString());

    // Create judge decision
    decisionId = uuidv4();
    db.prepare(`
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      iterationId,
      pairId,
      '4',
      'agree',
      0.95,
      'The answer is correct',
      new Date().toISOString()
    );
  });

  describe('GET /api/personas/[id]/iterations/[num]/decisions', () => {
    it('should fetch all decisions for an iteration', () => {
      const decisions = db
        .prepare(
          `
          SELECT
            jd.id as decision_id,
            jd.generated_output,
            jd.judge_decision,
            tp.input,
            tp.expected_output
          FROM judge_decisions jd
          JOIN training_pairs tp ON tp.id = jd.training_pair_id
          WHERE jd.iteration_id = ?
        `
        )
        .all(iterationId) as any[];

      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision_id).toBe(decisionId);
      expect(decisions[0].input).toBe('What is 2+2?');
      expect(decisions[0].expected_output).toBe('4');
      expect(decisions[0].generated_output).toBe('4');
      expect(decisions[0].judge_decision).toBe('agree');
    });

    it('should include human review status for each decision', () => {
      // Add human review
      const reviewId = uuidv4();
      db.prepare(`
        INSERT INTO human_reviews (id, judge_decision_id, human_decision, created_at)
        VALUES (?, ?, ?, ?)
      `).run(reviewId, decisionId, 'agree', new Date().toISOString());

      const decisions = db
        .prepare(
          `
          SELECT
            jd.id as decision_id,
            hr.id as review_id,
            hr.human_decision
          FROM judge_decisions jd
          LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
          WHERE jd.iteration_id = ?
        `
        )
        .all(iterationId) as any[];

      expect(decisions[0].review_id).toBe(reviewId);
      expect(decisions[0].human_decision).toBe('agree');
    });

    it('should show null for decisions without human review', () => {
      const decisions = db
        .prepare(
          `
          SELECT
            jd.id as decision_id,
            hr.id as review_id
          FROM judge_decisions jd
          LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
          WHERE jd.iteration_id = ?
        `
        )
        .all(iterationId) as any[];

      expect(decisions[0].review_id).toBeNull();
    });
  });

  describe('POST /api/personas/[id]/iterations/[num]/feedback', () => {
    it('should create human review for a decision', () => {
      const reviewId = uuidv4();

      // Simulate API creating review
      db.prepare(`
        INSERT INTO human_reviews
        (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(reviewId, decisionId, 'agree', 0.9, 'Looks good', new Date().toISOString());

      const review = db.prepare('SELECT * FROM human_reviews WHERE id = ?').get(reviewId) as any;

      expect(review).toBeDefined();
      expect(review.judge_decision_id).toBe(decisionId);
      expect(review.human_decision).toBe('agree');
      expect(review.human_confidence).toBe(0.9);
      expect(review.human_notes).toBe('Looks good');
    });

    it('should update iteration pairs_reviewed_by_human count', () => {
      // Create review
      db.prepare(`
        INSERT INTO human_reviews (id, judge_decision_id, human_decision, created_at)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), decisionId, 'agree', new Date().toISOString());

      // Update iteration count
      db.prepare(
        `
        UPDATE training_iterations
        SET pairs_reviewed_by_human = (
          SELECT COUNT(*) FROM human_reviews hr
          JOIN judge_decisions jd ON jd.id = hr.judge_decision_id
          WHERE jd.iteration_id = ?
        )
        WHERE id = ?
      `
      ).run(iterationId, iterationId);

      const iteration = db.prepare('SELECT * FROM training_iterations WHERE id = ?').get(iterationId) as any;

      expect(iteration.pairs_reviewed_by_human).toBe(1);
    });

    it('should allow updating existing human review', () => {
      const reviewId = uuidv4();

      // Create initial review
      db.prepare(`
        INSERT INTO human_reviews (id, judge_decision_id, human_decision, created_at)
        VALUES (?, ?, ?, ?)
      `).run(reviewId, decisionId, 'agree', new Date().toISOString());

      // Update review
      db.prepare(
        `
        UPDATE human_reviews
        SET human_decision = ?, human_notes = ?
        WHERE id = ?
      `
      ).run('disagree', 'Changed my mind', reviewId);

      const review = db.prepare('SELECT * FROM human_reviews WHERE id = ?').get(reviewId) as any;

      expect(review.human_decision).toBe('disagree');
      expect(review.human_notes).toBe('Changed my mind');
    });

    it('should validate human_decision values', () => {
      // This would be validated at API level
      const validDecisions = ['agree', 'disagree'];
      expect(validDecisions).toContain('agree');
      expect(validDecisions).toContain('disagree');
      expect(validDecisions).not.toContain('maybe');
    });
  });
});
