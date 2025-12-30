/**
 * Unit tests for human-driven prompt refiner module
 * Tests analysis of human feedback from iteration 1 and prompt refinement
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

/** Type for judge_prompt_versions database record */
interface JudgePromptVersionRecord {
  id: string;
  persona_id: string;
  iteration_number: number;
  prompt_text: string;
  improvement_rationale: string;
  created_by: string;
  created_at: string;
}
import {
  analyzeHumanFeedback,
  refineJudgePromptFromHumanFeedback,
  storeHumanRefinedPromptVersion,
} from '@lib/training/human-prompt-refiner';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
  createTestPersona,
  createTestIteration,
} from '../setup';

// Mock the api-clients module
vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(() =>
    Promise.resolve(
      JSON.stringify({
        improved_prompt:
          'Evaluate the response for accuracy, completeness, and tone. Consider the full context of the customer query.',
        rationale:
          'Added criteria for completeness and tone based on human feedback about vague responses',
        expected_impact:
          'Expected to improve agreement rate by addressing the systematic leniency issue',
      })
    )
  ),
}));

describe('Human-Driven Prompt Refiner', () => {
  let db: Database;
  let personaId: string;
  let iterationId: string;
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
    const modelTaskId = createTestModelConfig(db, 'openai');
    const modelJudgeId = createTestModelConfig(db, 'anthropic');
    modelEngineerId = createTestModelConfig(db, 'google');

    // Create test persona using fixture
    const persona = createTestPersona(db, {
      name: 'Test Human Refiner Persona',
      description: 'Test description for human refiner',
      task_prompt: 'Evaluate customer support quality',
      task_model_id: modelTaskId,
      judge_model_id: modelJudgeId,
      prompt_engineer_model_id: modelEngineerId,
    });
    personaId = persona.id;

    // Create test iteration (iteration 1 for human-driven refinement) using fixture
    const iteration = createTestIteration(
      db,
      personaId,
      1,
      'Evaluate if the response is helpful and polite'
    );
    iterationId = iteration.id;

    // Update iteration to completed status with full evaluation counts
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
    vi.clearAllMocks();
  });

  describe('analyzeHumanFeedback', () => {
    it('should analyze human feedback from iteration 1 with agree and disagree votes', async () => {
      // Create training pairs and decisions with mixed human feedback

      // Case 1: Judge says "agree", human says "agree" (true positive)
      const pairId1 = uuidv4();
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        pairId1,
        personaId,
        'How do I reset my password?',
        'Click "Forgot Password" link',
        new Date().toISOString()
      );

      const decisionId1 = uuidv4();
      db.prepare(
        `INSERT INTO judge_decisions
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId1,
        iterationId,
        pairId1,
        'You can reset by clicking the link',
        'agree',
        'Response is accurate',
        new Date().toISOString()
      );

      const reviewId1 = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(reviewId1, decisionId1, 'agree', 'Correct assessment', new Date().toISOString());

      // Case 2: Judge says "agree", human says "disagree" (false positive - too lenient)
      const pairId2 = uuidv4();
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        pairId2,
        personaId,
        'What is your return policy?',
        '30-day money-back guarantee',
        new Date().toISOString()
      );

      const decisionId2 = uuidv4();
      db.prepare(
        `INSERT INTO judge_decisions
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId2,
        iterationId,
        pairId2,
        'We have returns',
        'agree',
        'Response addresses the question',
        new Date().toISOString()
      );

      const reviewId2 = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        reviewId2,
        decisionId2,
        'disagree',
        'Judge is too lenient - response is incomplete and missing the 30-day timeframe',
        new Date().toISOString()
      );

      // Case 3: Judge says "disagree", human says "agree" (false negative - too strict)
      const pairId3 = uuidv4();
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(
        pairId3,
        personaId,
        'Is shipping free?',
        'Yes, free shipping on orders over $50',
        new Date().toISOString()
      );

      const decisionId3 = uuidv4();
      db.prepare(
        `INSERT INTO judge_decisions
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId3,
        iterationId,
        pairId3,
        'Free shipping over $50',
        'disagree',
        'Response is too brief',
        new Date().toISOString()
      );

      const reviewId3 = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        reviewId3,
        decisionId3,
        'agree',
        'Judge is too strict - response correctly conveys the key information',
        new Date().toISOString()
      );

      const analysis = analyzeHumanFeedback(iterationId, db);

      expect(analysis.totalReviews).toBe(3);
      expect(analysis.agreeVotes).toBe(2);
      expect(analysis.disagreeVotes).toBe(1);

      // Check that systematic errors are identified
      expect(analysis.systematicErrors).toBeDefined();
      expect(analysis.systematicErrors.length).toBeGreaterThan(0);

      // Check that key insights are generated
      expect(analysis.keyInsights).toBeDefined();
      expect(analysis.keyInsights.length).toBeGreaterThan(0);
      expect(analysis.keyInsights[0]).toContain('agreement rate');
    });

    it('should extract common patterns from human notes', async () => {
      // Create multiple reviews with similar notes mentioning "too strict"
      for (let i = 0; i < 3; i++) {
        const pairId = uuidv4();
        db.prepare(
          'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(pairId, personaId, `Question ${i}`, `Answer ${i}`, new Date().toISOString());

        const decisionId = uuidv4();
        db.prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'disagree',
          'Insufficient detail',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(
          reviewId,
          decisionId,
          'agree',
          'Judge is too strict - the response is actually correct',
          new Date().toISOString()
        );
      }

      const analysis = analyzeHumanFeedback(iterationId, db);

      expect(analysis.commonDisagreePatterns).toBeDefined();
      expect(analysis.commonDisagreePatterns.length).toBeGreaterThan(0);
    });

    it('should identify missed edge cases from reviews', async () => {
      const pairId = uuidv4();
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(pairId, personaId, 'Empty field?', 'Empty response', new Date().toISOString());

      const decisionId = uuidv4();
      db.prepare(
        `INSERT INTO judge_decisions
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId,
        iterationId,
        pairId,
        '',
        'disagree',
        'Empty response',
        new Date().toISOString()
      );

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        reviewId,
        decisionId,
        'agree',
        'This is a special edge case - empty response is correct for this query',
        new Date().toISOString()
      );

      const analysis = analyzeHumanFeedback(iterationId, db);

      expect(analysis.missedEdgeCases).toBeDefined();
      // Should detect the edge case mention
      const hasEdgeCase = analysis.missedEdgeCases.some(
        (e) => e.toLowerCase().includes('special case') || e.toLowerCase().includes('edge')
      );
      expect(hasEdgeCase).toBe(true);
    });

    it('should generate suggested improvements based on analysis', async () => {
      // Create reviews that indicate judge is too lenient
      // (Judge says "agree"/correct, but human says "disagree"/incorrect)
      for (let i = 0; i < 3; i++) {
        const pairId = uuidv4();
        db.prepare(
          'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(pairId, personaId, `Q${i}`, `A${i}`, new Date().toISOString());

        const decisionId = uuidv4();
        db.prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'agree',
          'Response looks good',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(
          reviewId,
          decisionId,
          'disagree',
          'Judge is too lenient - response is incomplete',
          new Date().toISOString()
        );
      }

      const analysis = analyzeHumanFeedback(iterationId, db);

      expect(analysis.suggestedImprovements).toBeDefined();
      expect(analysis.suggestedImprovements.length).toBeGreaterThan(0);
      // Should suggest being stricter
      expect(analysis.suggestedImprovements.some((i) => i.toLowerCase().includes('stricter'))).toBe(
        true
      );
    });

    it('should require 100% human review completion for iteration 1', async () => {
      // Create only 5 decisions out of 10 total
      for (let i = 0; i < 5; i++) {
        const pairId = uuidv4();
        db.prepare(
          'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(pairId, personaId, `Q${i}`, `A${i}`, new Date().toISOString());

        const decisionId = uuidv4();
        db.prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'agree',
          'Good',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(reviewId, decisionId, 'agree', 'Good', new Date().toISOString());
      }

      // Create 5 more decisions WITHOUT reviews (incomplete)
      for (let i = 5; i < 10; i++) {
        const pairId = uuidv4();
        db.prepare(
          'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(pairId, personaId, `Q${i}`, `A${i}`, new Date().toISOString());

        const decisionId = uuidv4();
        db.prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'agree',
          'Good',
          new Date().toISOString()
        );
        // No human review for these decisions
      }

      expect(() => analyzeHumanFeedback(iterationId, db)).toThrow(
        /requires 100% human review completion/
      );
    });

    it('should only work for iteration 1', async () => {
      // Create iteration 2 (should not work for human-driven refinement)
      const modelJudgeId = createTestModelConfig(db, 'anthropic');
      const iterationId2 = uuidv4();
      db.prepare(
        `INSERT INTO training_iterations
         (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId2,
        personaId,
        2,
        modelJudgeId,
        'Evaluate if helpful',
        'completed',
        10,
        10,
        new Date().toISOString()
      );

      expect(() => analyzeHumanFeedback(iterationId2, db)).toThrow(
        /Human-driven prompt refinement is only for iteration 1/
      );
    });

    it('should throw error if iteration not found', () => {
      const invalidId = uuidv4();
      expect(() => analyzeHumanFeedback(invalidId, db)).toThrow('Iteration not found');
    });
  });

  describe('refineJudgePromptFromHumanFeedback', () => {
    it('should use LLM to refine prompt based on human feedback analysis', async () => {
      // Create some test data
      const pairId = uuidv4();
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(pairId, personaId, 'Test question', 'Test answer', new Date().toISOString());

      const decisionId = uuidv4();
      db.prepare(
        `INSERT INTO judge_decisions
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId,
        iterationId,
        pairId,
        'Test response',
        'agree',
        'Good response',
        new Date().toISOString()
      );

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 'Correct', new Date().toISOString());

      // Analyze feedback
      const analysis = analyzeHumanFeedback(iterationId, db);
      const currentPrompt = 'Evaluate if the response is helpful and polite';

      // Refine prompt
      const result = await refineJudgePromptFromHumanFeedback(
        currentPrompt,
        analysis,
        modelEngineerId
      );

      expect(result).toBeDefined();
      expect(result.refined_prompt).toBeDefined();
      expect(result.rationale).toBeDefined();
      expect(result.expected_impact).toBeDefined();
      expect(result.original_prompt).toBe(currentPrompt);
      expect(result.analysis).toBe(analysis);
    });

    it('should handle LLM failure gracefully', async () => {
      // Mock failing LLM call
      const { callModel } = await import('@lib/utils/api-clients');
      vi.mocked(callModel).mockRejectedValueOnce(new Error('LLM API error'));

      // Create minimal test data
      const pairId = uuidv4();
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(pairId, personaId, 'Q', 'A', new Date().toISOString());

      const decisionId = uuidv4();
      db.prepare(
        `INSERT INTO judge_decisions
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(decisionId, iterationId, pairId, 'Response', 'agree', 'Good', new Date().toISOString());

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 'Good', new Date().toISOString());

      const analysis = analyzeHumanFeedback(iterationId, db);
      const result = await refineJudgePromptFromHumanFeedback(
        'Original prompt',
        analysis,
        modelEngineerId
      );

      expect(result.refined_prompt).toBeNull();
      expect(result.rationale).toContain('LLM call failed');
    });
  });

  describe('storeHumanRefinedPromptVersion', () => {
    it('should store human-refined prompt version in database', () => {
      const refinedPrompt = 'Refined prompt based on human feedback';
      const rationale = 'Added clarity based on human reviews';

      const versionId = storeHumanRefinedPromptVersion(
        personaId,
        1,
        refinedPrompt,
        rationale,
        'human',
        db
      );

      expect(versionId).toBeDefined();

      // Verify the record was created
      const record = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
        .get(versionId) as JudgePromptVersionRecord | undefined;

      expect(record).toBeDefined();
      expect(record!.persona_id).toBe(personaId);
      expect(record!.iteration_number).toBe(1);
      expect(record!.prompt_text).toBe(refinedPrompt);
      expect(record!.improvement_rationale).toBe(rationale);
      expect(record!.created_by).toBe('human');
    });

    it('should create unique ID for each version', () => {
      const versionId1 = storeHumanRefinedPromptVersion(
        personaId,
        1,
        'Prompt 1',
        'Rationale 1',
        'human',
        db
      );

      const versionId2 = storeHumanRefinedPromptVersion(
        personaId,
        2,
        'Prompt 2',
        'Rationale 2',
        'human',
        db
      );

      expect(versionId1).not.toBe(versionId2);
    });
  });
});
