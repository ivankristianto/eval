/**
 * Integration tests for human-driven prompt refinement
 * Tests the complete iteration 1 flow with database interactions
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
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

// Mock the API clients
vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(),
}));

import { callModel } from '@lib/utils/api-clients';

describe('Human-Driven Prompt Refiner Integration', () => {
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
      name: 'Integration Test Persona',
      description: 'Persona for testing human-driven prompt refinement',
      task_prompt: 'Evaluate customer support responses for accuracy, completeness, and tone',
      task_model_id: modelTaskId,
      judge_model_id: modelJudgeId,
      prompt_engineer_model_id: modelEngineerId,
    });
    personaId = persona.id;

    // Create test iteration (iteration 1) using fixture
    const iteration = createTestIteration(
      db,
      personaId,
      1,
      'Evaluate if the response is accurate and helpful'
    );
    iterationId = iteration.id;

    // Update iteration to completed status with full evaluation counts
    db.prepare(
      `
      UPDATE training_iterations
      SET status = 'completed',
          total_pairs_evaluated = 15,
          pairs_reviewed_by_human = 15
      WHERE id = ?
    `
    ).run(iterationId);
  });

  afterEach(() => {
    // Clean up after each test
    cleanTestDatabase();
    vi.clearAllMocks();
  });

  describe('Complete Iteration 1 Flow', () => {
    it('should successfully analyze human feedback and refine prompt for iteration 1', async () => {
      // Create realistic iteration 1 scenario with mixed human feedback

      // True positives (judge and human agree)
      const truePositiveCases = [
        {
          input: 'How do I reset my password?',
          output: 'Click the "Forgot Password" link',
          expected: 'Click the "Forgot Password" link',
          decision: 'agree',
          human: 'agree',
        },
        {
          input: 'What are your hours?',
          output: 'We are open 9-5 Monday to Friday',
          expected: '9 AM to 5 PM, Mon-Fri',
          decision: 'agree',
          human: 'agree',
        },
        {
          input: 'Do you offer refunds?',
          output: 'Yes, we offer refunds within 30 days',
          expected: '30-day refund policy available',
          decision: 'agree',
          human: 'agree',
        },
      ];

      // False positives (judge says agree, human disagrees - judge too lenient)
      const falsePositiveCases = [
        {
          input: 'How do I contact support?',
          output: 'Use our contact form',
          expected: 'You can reach support at support@example.com or call 1-800-555-1234',
          decision: 'agree',
          human: 'disagree',
          note: 'Judge is too lenient - response is incomplete and missing critical information',
        },
        {
          input: 'What is the return policy?',
          output: 'We accept returns',
          expected: '30-day money-back guarantee on all unused items',
          decision: 'agree',
          human: 'disagree',
          note: 'Judge is too lenient - response lacks important details about timeframe and conditions',
        },
        {
          input: 'Is this product available?',
          output: 'It depends',
          expected: 'The product is currently in stock and available for immediate shipping',
          decision: 'agree',
          human: 'disagree',
          note: 'Judge is too lenient - vague response does not properly answer the customer question',
        },
      ];

      // False negatives (judge says disagree, human agrees - judge too strict)
      const falseNegativeCases = [
        {
          input: 'Is shipping free?',
          output: 'Free shipping over $50',
          expected: 'Yes, free shipping on orders over $50',
          decision: 'disagree',
          human: 'agree',
          note: 'Judge is too strict - the response correctly conveys the key information despite being concise',
        },
        {
          input: 'Can I track my order?',
          output: 'Yes, tracking available in your account',
          expected: 'You can track your order through your account dashboard',
          decision: 'disagree',
          human: 'agree',
          note: 'Judge is too strict - semantically correct and helpful',
        },
      ];

      // Insert all test cases
      const allCases = [...truePositiveCases, ...falsePositiveCases, ...falseNegativeCases];

      for (const testCase of allCases) {
        const pairId = uuidv4();
        db.prepare(
          'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(pairId, personaId, testCase.input, testCase.expected, new Date().toISOString());

        const decisionId = uuidv4();
        db.prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          testCase.output,
          testCase.decision,
          0.8,
          'Evaluation based on current criteria',
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
          testCase.human,
          1.0,
          (testCase as { note?: string }).note || 'Correct assessment',
          new Date().toISOString()
        );
      }

      // Step 1: Analyze human feedback
      const analysis = analyzeHumanFeedback(iterationId, db);

      expect(analysis.totalReviews).toBe(8);
      expect(analysis.agreeVotes).toBe(5); // 3 true positives + 2 false negatives
      expect(analysis.disagreeVotes).toBe(3); // 3 false positives

      // Step 2: Refine prompt using LLM
      const mockLLMResponse = {
        improved_prompt:
          'Evaluate the customer support response for accuracy, completeness, and helpfulness. The response should provide specific, actionable information. Vague or incomplete responses should be marked as incorrect, while responses that correctly address the customer question even with concise wording should be marked as correct.',
        rationale:
          'Analysis of iteration 1 human feedback revealed the judge is too lenient (3 false positives - accepting vague/incomplete responses) and too strict (2 false negatives - rejecting correct but concise responses). The refined prompt adds specific criteria for completeness while clarifying that semantic correctness matters more than exact wording.',
        expected_impact:
          'Expected to reduce false positives by requiring more specific information in responses, while reducing false negatives by clarifying that semantic equivalence is acceptable. Should improve overall agreement rate from 62.5% to over 80% in iteration 2.',
      };

      vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockLLMResponse));

      const refinementResult = await refineJudgePromptFromHumanFeedback(
        'Evaluate if the response is accurate and helpful',
        analysis,
        modelEngineerId
      );

      expect(refinementResult.refined_prompt).toBe(mockLLMResponse.improved_prompt);
      expect(refinementResult.rationale).toContain('too lenient');
      expect(refinementResult.rationale).toContain('too strict');
      expect(refinementResult.expected_impact).toContain('agreement rate');
      expect(refinementResult.original_prompt).toBe(
        'Evaluate if the response is accurate and helpful'
      );
      expect(refinementResult.analysis).toBe(analysis);

      // Step 3: Store refined prompt version
      const versionId = storeHumanRefinedPromptVersion(
        personaId,
        1,
        refinementResult.refined_prompt!,
        refinementResult.rationale,
        'human',
        db
      );

      expect(versionId).toBeDefined();

      // Verify the stored version
      const storedVersion = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
        .get(versionId) as
        | {
            id: string;
            persona_id: string;
            iteration_number: number;
            prompt_text: string;
            improvement_rationale: string | null;
            created_by: string;
          }
        | undefined;

      expect(storedVersion).toBeDefined();
      expect(storedVersion!.persona_id).toBe(personaId);
      expect(storedVersion!.iteration_number).toBe(1);
      expect(storedVersion!.prompt_text).toBe(refinementResult.refined_prompt);
      expect(storedVersion!.improvement_rationale).toBe(refinementResult.rationale);
      expect(storedVersion!.created_by).toBe('human');

      // Verify LLM was called with human feedback analysis
      expect(callModel).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(callModel).mock.calls[0];
      expect(callArgs[0]).toBe(modelEngineerId);
      expect(callArgs[1]).toContain('Human Feedback Analysis');
      expect(callArgs[1]).toContain('Agree Votes');
      expect(callArgs[1]).toContain('Disagree Votes');
      expect(callArgs[1]).toContain('too lenient');
    });

    it('should handle edge case of 100% agreement in iteration 1', async () => {
      // Create cases where judge and human always agree
      for (let i = 0; i < 10; i++) {
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
          0.9,
          'Good response',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(reviewId, decisionId, 'agree', 'Perfect agreement', new Date().toISOString());
      }

      // Analyze feedback
      const analysis = analyzeHumanFeedback(iterationId, db);

      expect(analysis.totalReviews).toBe(10);
      expect(analysis.agreeVotes).toBe(10);
      expect(analysis.disagreeVotes).toBe(0);
      expect(analysis.keyInsights[0]).toContain('100.0%');

      // LLM should still generate a refined prompt even with perfect agreement
      const mockLLMResponse = {
        improved_prompt:
          'Evaluate customer support responses for accuracy, completeness, and helpfulness. Maintain the current high standards.',
        rationale:
          'With 100% agreement, the current prompt is working well. Minor adjustments for consistency.',
        expected_impact:
          'Expect to maintain high agreement rate in iteration 2 with continued human review.',
      };

      vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockLLMResponse));

      const result = await refineJudgePromptFromHumanFeedback(
        'Evaluate if the response is accurate and helpful',
        analysis,
        modelEngineerId
      );

      expect(result.refined_prompt).toBeDefined();
      expect(result.analysis.keyInsights[0]).toContain('100.0%');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when trying to refine prompt for iteration 2', () => {
      // Create iteration 2
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

      // Add some test data
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
          iterationId2,
          pairId,
          `R${i}`,
          'agree',
          0.8,
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

      expect(() => analyzeHumanFeedback(iterationId2, db)).toThrow(
        'Human-driven prompt refinement is only for iteration 1'
      );
    });

    it('should throw error when iteration 1 has incomplete human reviews', () => {
      // Create 10 decisions but only 5 reviews
      for (let i = 0; i < 10; i++) {
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
          `R${i}`,
          'agree',
          0.8,
          'Good',
          new Date().toISOString()
        );

        // Only add reviews for first 5
        if (i < 5) {
          const reviewId = uuidv4();
          db.prepare(
            `INSERT INTO human_reviews
             (id, judge_decision_id, human_decision, human_notes, created_at)
             VALUES (?, ?, ?, ?, ?)`
          ).run(reviewId, decisionId, 'agree', 'Good', new Date().toISOString());
        }
      }

      expect(() => analyzeHumanFeedback(iterationId, db)).toThrow(
        'requires 100% human review completion'
      );
    });

    it('should handle LLM API failure gracefully during refinement', async () => {
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
      ).run(decisionId, iterationId, pairId, 'R', 'agree', 'Good', new Date().toISOString());

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 'Good', new Date().toISOString());

      const analysis = analyzeHumanFeedback(iterationId, db);

      // Mock LLM failure
      vi.mocked(callModel).mockRejectedValue(new Error('API timeout'));

      const result = await refineJudgePromptFromHumanFeedback(
        'Original prompt',
        analysis,
        modelEngineerId
      );

      expect(result.refined_prompt).toBeNull();
      expect(result.rationale).toContain('LLM call failed');
      expect(result.original_prompt).toBe('Original prompt');
      expect(result.analysis).toBe(analysis);

      // System should still be able to store a manually crafted prompt
      const versionId = storeHumanRefinedPromptVersion(
        personaId,
        1,
        'Manually refined prompt',
        'Manual refinement after LLM failure',
        'human',
        db
      );

      expect(versionId).toBeDefined();
    });
  });

  describe('Prompt Version History', () => {
    it('should track human-refined prompts in version history', async () => {
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
      ).run(decisionId, iterationId, pairId, 'R', 'agree', 'Good', new Date().toISOString());

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 'Good', new Date().toISOString());

      const analysis = analyzeHumanFeedback(iterationId, db);

      // Mock LLM response
      const mockResponse = {
        improved_prompt: 'Refined prompt v1',
        rationale: 'Based on human feedback',
        expected_impact: 'Should improve',
      };
      vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockResponse));

      const result = await refineJudgePromptFromHumanFeedback(
        'Original',
        analysis,
        modelEngineerId
      );

      // Store version
      const versionId1 = storeHumanRefinedPromptVersion(
        personaId,
        1,
        result.refined_prompt!,
        result.rationale,
        'human',
        db
      );

      // Verify history (includes initial prompt from fixture at iteration 0)
      const history = db
        .prepare(
          'SELECT * FROM judge_prompt_versions WHERE persona_id = ? ORDER BY iteration_number ASC'
        )
        .all(personaId) as Array<{
        id: string;
        iteration_number: number;
        created_by: string;
        prompt_text: string;
      }>;

      expect(history).toHaveLength(2);
      expect(history[0].iteration_number).toBe(0);
      expect(history[1].id).toBe(versionId1);
      expect(history[1].iteration_number).toBe(1);
      expect(history[1].created_by).toBe('human');
      expect(history[1].prompt_text).toBe('Refined prompt v1');
    });
  });
});
