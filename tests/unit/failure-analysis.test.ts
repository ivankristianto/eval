/**
 * Unit tests for failure analysis module
 * Tests extraction of false positives, false negatives, and correct examples
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../src/lib/db';
import type { Database } from 'better-sqlite3';
import { analyzeIterationFailures, type FailureAnalysisContext } from '../../src/lib/failure-analysis';
import { v4 as uuidv4 } from 'uuid';

describe('Failure Analysis', () => {
  let db: Database;
  let personaId: string;
  let iterationId: string;

  beforeEach(async () => {
    db = getDatabase();

    // Create test model configurations
    const modelTaskId = 'model-task-1';
    const modelJudgeId = 'model-judge-1';
    const modelEngineerId = 'model-engineer-1';

    db.prepare(`
      INSERT OR IGNORE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(modelTaskId, 'openai', 'gpt-4', 'fake-key', 1);

    db.prepare(`
      INSERT OR IGNORE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(modelJudgeId, 'anthropic', 'claude-3', 'fake-key', 1);

    db.prepare(`
      INSERT OR IGNORE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(modelEngineerId, 'google', 'gemini-pro', 'fake-key', 1);

    // Create test persona
    personaId = uuidv4();
    db.prepare(`
      INSERT INTO personas
      (id, name, description, task_prompt, task_model_id, judge_model_id,
       prompt_engineer_model_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personaId,
      'Test Persona',
      'Test description',
      'Evaluate customer support quality',
      modelTaskId,
      modelJudgeId,
      modelEngineerId,
      'training',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create test iteration
    iterationId = uuidv4();
    db.prepare(`
      INSERT INTO training_iterations
      (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
       status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      iterationId,
      personaId,
      1,
      'model-judge-1',
      'Evaluate if the response is helpful and polite',
      'completed',
      10,
      10,
      new Date().toISOString()
    );
  });

  afterEach(() => {
    // Clean up test data in reverse dependency order
    db.prepare('DELETE FROM human_reviews WHERE judge_decision_id IN (SELECT id FROM judge_decisions WHERE iteration_id = ?)').run(iterationId);
    db.prepare('DELETE FROM judge_decisions WHERE iteration_id = ?').run(iterationId);
    db.prepare('DELETE FROM iteration_metrics WHERE iteration_id = ?').run(iterationId);
    db.prepare('DELETE FROM training_iterations WHERE id = ?').run(iterationId);
    db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(personaId);
    db.prepare('DELETE FROM personas WHERE id = ?').run(personaId);
    db.prepare('DELETE FROM ModelConfiguration WHERE id IN (?, ?, ?)').run('model-task-1', 'model-judge-1', 'model-engineer-1');
  });

  it('should extract false positives (judge agreed, human disagreed)', async () => {
    // Create training pair
    const pairId = uuidv4();
    db.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(pairId, personaId, 'How do I reset my password?', 'Click "Forgot Password" link', new Date().toISOString());

    // Create judge decision (judge says "agree")
    const decisionId = uuidv4();
    db.prepare(`
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      iterationId,
      pairId,
      'You can reset by clicking the link',
      'agree',
      0.9,
      'Response is accurate and helpful',
      new Date().toISOString()
    );

    // Create human review (human says "disagree" - this is a false positive)
    const reviewId = uuidv4();
    db.prepare(`
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      decisionId,
      'disagree',
      0.8,
      'Response is too vague, should include specific steps',
      new Date().toISOString()
    );

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.false_positives).toHaveLength(1);
    expect(result.false_positives[0].model_output).toBe('You can reset by clicking the link');
    expect(result.false_positives[0].expected_output).toBe('Click "Forgot Password" link');
    expect(result.false_positives[0].why_it_should_have_disagreed).toContain('vague');
  });

  it('should extract false negatives (judge disagreed, human agreed)', async () => {
    // Create training pair
    const pairId = uuidv4();
    db.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(pairId, personaId, 'What is your return policy?', '30-day money-back guarantee', new Date().toISOString());

    // Create judge decision (judge says "disagree")
    const decisionId = uuidv4();
    db.prepare(`
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      iterationId,
      pairId,
      'We offer 30 days money back',
      'disagree',
      0.7,
      'Response is incomplete, missing details',
      new Date().toISOString()
    );

    // Create human review (human says "agree" - this is a false negative)
    const reviewId = uuidv4();
    db.prepare(`
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      decisionId,
      'agree',
      0.9,
      'Response is actually correct, judge is too strict',
      new Date().toISOString()
    );

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.false_negatives).toHaveLength(1);
    expect(result.false_negatives[0].model_output).toBe('We offer 30 days money back');
    expect(result.false_negatives[0].expected_output).toBe('30-day money-back guarantee');
    expect(result.false_negatives[0].why_it_should_have_agreed).toContain('too strict');
  });

  it('should extract correct examples (judge and human agree)', async () => {
    // Create training pair
    const pairId = uuidv4();
    db.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(pairId, personaId, 'Is shipping free?', 'Yes, free shipping on orders over $50', new Date().toISOString());

    // Create judge decision (judge says "agree")
    const decisionId = uuidv4();
    db.prepare(`
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      iterationId,
      pairId,
      'Free shipping for orders above $50',
      'agree',
      0.95,
      'Response correctly conveys the information',
      new Date().toISOString()
    );

    // Create human review (human also says "agree" - correct classification)
    const reviewId = uuidv4();
    db.prepare(`
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      decisionId,
      'agree',
      1.0,
      'Judge correctly identified this as accurate',
      new Date().toISOString()
    );

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.correct_examples).toHaveLength(1);
    expect(result.correct_examples[0].model_output).toBe('Free shipping for orders above $50');
    expect(result.correct_examples[0].expected_output).toBe('Yes, free shipping on orders over $50');
    expect(result.correct_examples[0].decision).toBe('agree');
    expect(result.correct_examples[0].reasoning).toBe('Response correctly conveys the information');
  });

  it('should limit false positives to 5 examples', async () => {
    // Create 10 false positive examples
    for (let i = 0; i < 10; i++) {
      const pairId = uuidv4();
      db.prepare(`
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(pairId, personaId, `Question ${i}`, `Answer ${i}`, new Date().toISOString());

      const decisionId = uuidv4();
      db.prepare(`
        INSERT INTO judge_decisions
        (id, iteration_id, training_pair_id, generated_output, judge_decision,
         judge_confidence, judge_reasoning, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        decisionId,
        iterationId,
        pairId,
        `Response ${i}`,
        'agree',
        0.8,
        'Looks good',
        new Date().toISOString()
      );

      const reviewId = uuidv4();
      db.prepare(`
        INSERT INTO human_reviews
        (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(reviewId, decisionId, 'disagree', 0.9, 'Not good enough', new Date().toISOString());
    }

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.false_positives).toHaveLength(5);
  });

  it('should include current metrics and task description', async () => {
    // Create metrics for iteration
    const metricsId = uuidv4();
    db.prepare(`
      INSERT INTO iteration_metrics
      (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
       precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      metricsId,
      iterationId,
      10,
      5,
      3,
      2,
      0.77,
      0.83,
      0.80,
      0.70,
      0.75,
      new Date().toISOString()
    );

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.current_metrics).toBeDefined();
    expect(result.current_metrics.f1_score).toBe(0.80);
    expect(result.current_metrics.cohens_kappa).toBe(0.70);
    expect(result.iteration_number).toBe(1);
    expect(result.task_description).toBe('Test description');
    expect(result.current_prompt).toBe('Evaluate if the response is helpful and polite');
  });

  it('should return empty arrays when no failures exist', async () => {
    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.false_positives).toHaveLength(0);
    expect(result.false_negatives).toHaveLength(0);
    expect(result.correct_examples).toHaveLength(0);
  });

  it('should throw error if iteration not found', async () => {
    const invalidIterationId = uuidv4();

    await expect(
      analyzeIterationFailures(invalidIterationId, db)
    ).rejects.toThrow('Iteration not found');
  });
});
