/**
 * Unit tests for failure analysis module
 * Tests extraction of false positives, false negatives, and correct examples
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from 'better-sqlite3';
import { analyzeIterationFailures } from '@lib/training/failure-analysis';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
  createTestPersona,
  createTestIteration,
} from '../setup';

describe('Failure Analysis', () => {
  let db: Database;
  let personaId: string;
  let iterationId: string;
  let modelTaskId: string;
  let modelJudgeId: string;
  let modelEngineerId: string;

  beforeAll(() => {
    initializeTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  beforeEach(async () => {
    db = getTestDatabase();

    // Clean up before each test
    cleanTestDatabase();

    // Create test model configurations using fixture
    modelTaskId = createTestModelConfig(db, 'openai');
    modelJudgeId = createTestModelConfig(db, 'anthropic');
    modelEngineerId = createTestModelConfig(db, 'google');

    // Create test persona using fixture
    const persona = createTestPersona(db, {
      name: 'Test Persona Failure Analysis',
      description: 'Test description',
      task_prompt: 'Evaluate customer support quality',
      task_model_id: modelTaskId,
      judge_model_id: modelJudgeId,
      prompt_engineer_model_id: modelEngineerId,
    });
    personaId = persona.id;

    // Create test iteration using fixture
    const iteration = createTestIteration(db, personaId, 1, 'Evaluate if the response is helpful and polite');
    iterationId = iteration.id;

    // Update iteration status to completed with full evaluation counts
    db.prepare(
      `
      UPDATE training_iterations
      SET status = 'completed',
          total_pairs_evaluated = 10,
          pairs_reviewed_by_human = 10
      WHERE id = ?
    `
    ).run(iterationId);
  });

  afterEach(() => {
    // Clean up after each test
    cleanTestDatabase();
  });

  it('should extract false positives (judge agreed, human disagreed)', async () => {
    // Create training pair
    const pairId = uuidv4();
    db.prepare(
      `
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(
      pairId,
      personaId,
      'How do I reset my password?',
      'Click "Forgot Password" link',
      new Date().toISOString()
    );

    // Create judge decision (judge says "agree")
    const decisionId = uuidv4();
    db.prepare(
      `
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
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
    db.prepare(
      `
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
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
    db.prepare(
      `
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(
      pairId,
      personaId,
      'What is your return policy?',
      '30-day money-back guarantee',
      new Date().toISOString()
    );

    // Create judge decision (judge says "disagree")
    const decisionId = uuidv4();
    db.prepare(
      `
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
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
    db.prepare(
      `
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
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
    db.prepare(
      `
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(
      pairId,
      personaId,
      'Is shipping free?',
      'Yes, free shipping on orders over $50',
      new Date().toISOString()
    );

    // Create judge decision (judge says "agree")
    const decisionId = uuidv4();
    db.prepare(
      `
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
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
    db.prepare(
      `
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
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
    expect(result.correct_examples[0].expected_output).toBe(
      'Yes, free shipping on orders over $50'
    );
    expect(result.correct_examples[0].decision).toBe('agree');
    expect(result.correct_examples[0].reasoning).toBe('Response correctly conveys the information');
  });

  it('should limit false positives to 5 examples', async () => {
    // Create 10 false positive examples
    for (let i = 0; i < 10; i++) {
      const pairId = uuidv4();
      db.prepare(
        `
        INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(pairId, personaId, `Question ${i}`, `Answer ${i}`, new Date().toISOString());

      const decisionId = uuidv4();
      db.prepare(
        `
        INSERT INTO judge_decisions
        (id, iteration_id, training_pair_id, generated_output, judge_decision,
         judge_confidence, judge_reasoning, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
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
      db.prepare(
        `
        INSERT INTO human_reviews
        (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run(reviewId, decisionId, 'disagree', 0.9, 'Not good enough', new Date().toISOString());
    }

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.false_positives).toHaveLength(5);
  });

  it('should include current metrics and task description', async () => {
    // Create metrics for iteration
    const metricsId = uuidv4();
    db.prepare(
      `
      INSERT INTO iteration_metrics
      (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
       precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      metricsId,
      iterationId,
      10,
      5,
      3,
      2,
      0.77,
      0.83,
      0.8,
      0.7,
      0.75,
      new Date().toISOString()
    );

    const result = await analyzeIterationFailures(iterationId, db);

    expect(result.current_metrics).toBeDefined();
    expect(result.current_metrics.f1_score).toBe(0.8);
    expect(result.current_metrics.cohens_kappa).toBe(0.7);
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

    await expect(analyzeIterationFailures(invalidIterationId, db)).rejects.toThrow(
      'Iteration not found'
    );
  });
});
