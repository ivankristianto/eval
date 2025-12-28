/**
 * Unit tests for human-driven prompt refiner module
 * Tests analysis of human feedback from iteration 1 and prompt refinement
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { getDatabase } from '@lib/db';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  analyzeHumanFeedback,
  refineJudgePromptFromHumanFeedback,
  storeHumanRefinedPromptVersion,
} from '@lib/training/human-prompt-refiner';

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

  // Clean up any leftover test data before running tests
  beforeAll(() => {
    db = getDatabase();
    db.prepare(
      "DELETE FROM human_reviews WHERE judge_decision_id IN (SELECT id FROM judge_decisions WHERE iteration_id IN (SELECT id FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')))"
    ).run();
    db.prepare(
      "DELETE FROM judge_decisions WHERE iteration_id IN (SELECT id FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%'))"
    ).run();
    db.prepare(
      "DELETE FROM iteration_metrics WHERE iteration_id IN (SELECT id FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%'))"
    ).run();
    db.prepare(
      "DELETE FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare(
      "DELETE FROM training_pairs WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare(
      "DELETE FROM judge_prompt_versions WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare(
      "DELETE FROM training_loop_state WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare("DELETE FROM personas WHERE name LIKE '%Human Refiner%'").run();
    db.prepare("DELETE FROM ModelConfiguration WHERE id LIKE '%-human-test'").run();
  });

  beforeEach(async () => {
    db = getDatabase();

    // Create test model configurations
    const modelTaskId = 'model-task-human-test';
    const modelJudgeId = 'model-judge-human-test';
    const modelEngineerId = 'model-engineer-human-test';

    db.prepare(
      `
      INSERT OR REPLACE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(modelTaskId, 'openai', 'gpt-4-hrt', 'fake-key', 1);

    db.prepare(
      `
      INSERT OR REPLACE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(modelJudgeId, 'anthropic', 'claude-3-hrt', 'fake-key', 1);

    db.prepare(
      `
      INSERT OR REPLACE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run(modelEngineerId, 'google', 'gemini-pro-hrt', 'fake-key', 1);

    // Create test persona
    personaId = uuidv4();
    db.prepare(
      `
      INSERT INTO personas
      (id, name, description, task_prompt, task_model_id, judge_model_id,
       prompt_engineer_model_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      personaId,
      'Test Human Refiner Persona ' + personaId.substring(0, 8),
      'Test description for human refiner',
      'Evaluate customer support quality',
      modelTaskId,
      modelJudgeId,
      modelEngineerId,
      'training',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create test iteration (iteration 1 for human-driven refinement)
    iterationId = uuidv4();
    db.prepare(
      `
      INSERT INTO training_iterations
      (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
       status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      iterationId,
      personaId,
      1,
      modelJudgeId,
      'Evaluate if the response is helpful and polite',
      'completed',
      10,
      10,
      new Date().toISOString()
    );
  });

  afterEach(() => {
    // Clean up test data in reverse dependency order
    // First try to clean up by specific ID, then by name pattern for safety
    db.prepare(
      'DELETE FROM human_reviews WHERE judge_decision_id IN (SELECT id FROM judge_decisions WHERE iteration_id = ?)'
    ).run(iterationId);
    db.prepare('DELETE FROM judge_decisions WHERE iteration_id = ?').run(iterationId);
    db.prepare('DELETE FROM iteration_metrics WHERE iteration_id = ?').run(iterationId);
    db.prepare('DELETE FROM training_iterations WHERE id = ?').run(iterationId);
    db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(personaId);
    // Also cleanup by name pattern in case integration test ran first
    db.prepare(
      "DELETE FROM human_reviews WHERE judge_decision_id IN (SELECT id FROM judge_decisions WHERE iteration_id IN (SELECT id FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')))"
    ).run();
    db.prepare(
      "DELETE FROM judge_decisions WHERE iteration_id IN (SELECT id FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%'))"
    ).run();
    db.prepare(
      "DELETE FROM iteration_metrics WHERE iteration_id IN (SELECT id FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%'))"
    ).run();
    db.prepare(
      "DELETE FROM training_iterations WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare(
      "DELETE FROM training_pairs WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare(
      "DELETE FROM judge_prompt_versions WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare(
      "DELETE FROM training_loop_state WHERE persona_id IN (SELECT id FROM personas WHERE name LIKE '%Human Refiner%')"
    ).run();
    db.prepare("DELETE FROM personas WHERE name LIKE '%Human Refiner%'").run();
    db.prepare('DELETE FROM personas WHERE id = ?').run(personaId);
    db.prepare('DELETE FROM ModelConfiguration WHERE id IN (?, ?, ?)').run(
      'model-task-human-test',
      'model-judge-human-test',
      'model-engineer-human-test'
    );
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
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId1,
        iterationId,
        pairId1,
        'You can reset by clicking the link',
        'agree',
        0.9,
        'Response is accurate',
        new Date().toISOString()
      );

      const reviewId1 = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(reviewId1, decisionId1, 'agree', 1.0, 'Correct assessment', new Date().toISOString());

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
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId2,
        iterationId,
        pairId2,
        'We have returns',
        'agree',
        0.8,
        'Response addresses the question',
        new Date().toISOString()
      );

      const reviewId2 = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        reviewId2,
        decisionId2,
        'disagree',
        0.9,
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
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId3,
        iterationId,
        pairId3,
        'Free shipping over $50',
        'disagree',
        0.7,
        'Response is too brief',
        new Date().toISOString()
      );

      const reviewId3 = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        reviewId3,
        decisionId3,
        'agree',
        0.9,
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
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'disagree',
          0.7,
          'Insufficient detail',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          reviewId,
          decisionId,
          'agree',
          0.9,
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
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId,
        iterationId,
        pairId,
        '',
        'disagree',
        0.5,
        'Empty response',
        new Date().toISOString()
      );

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        reviewId,
        decisionId,
        'agree',
        0.9,
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
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'agree',
          0.8,
          'Response looks good',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          reviewId,
          decisionId,
          'disagree',
          0.9,
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
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'agree',
          0.8,
          'Good',
          new Date().toISOString()
        );

        const reviewId = uuidv4();
        db.prepare(
          `INSERT INTO human_reviews
           (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(reviewId, decisionId, 'agree', 1.0, 'Good', new Date().toISOString());
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
           (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Response ${i}`,
          'agree',
          0.8,
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
      const iterationId2 = uuidv4();
      db.prepare(
        `INSERT INTO training_iterations
         (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId2,
        personaId,
        2,
        'model-judge-human-test',
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
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId,
        iterationId,
        pairId,
        'Test response',
        'agree',
        0.8,
        'Good response',
        new Date().toISOString()
      );

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 1.0, 'Correct', new Date().toISOString());

      // Analyze feedback
      const analysis = analyzeHumanFeedback(iterationId, db);
      const currentPrompt = 'Evaluate if the response is helpful and polite';

      // Refine prompt
      const result = await refineJudgePromptFromHumanFeedback(
        currentPrompt,
        analysis,
        'model-engineer-human-test'
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
         (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_confidence, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId,
        iterationId,
        pairId,
        'Response',
        'agree',
        0.8,
        'Good',
        new Date().toISOString()
      );

      const reviewId = uuidv4();
      db.prepare(
        `INSERT INTO human_reviews
         (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 1.0, 'Good', new Date().toISOString());

      const analysis = analyzeHumanFeedback(iterationId, db);
      const result = await refineJudgePromptFromHumanFeedback(
        'Original prompt',
        analysis,
        'model-engineer-human-test'
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
        .get(versionId) as any;

      expect(record).toBeDefined();
      expect(record.persona_id).toBe(personaId);
      expect(record.iteration_number).toBe(1);
      expect(record.prompt_text).toBe(refinedPrompt);
      expect(record.improvement_rationale).toBe(rationale);
      expect(record.created_by).toBe('human');
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
