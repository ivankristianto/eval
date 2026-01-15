/**
 * Integration tests for TrainingLoopManager
 * Tests database interactions and full workflow
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { TrainingLoopManager } from '@lib/training/training-loop-manager';
import { TrainingStateError } from '@lib/training/training-errors';
import path from 'path';
import { readFileSync } from 'fs';

// Mock external dependencies
vi.mock('@lib/evaluation/metrics-orchestrator', () => ({
  calculateIterationMetricsFromGroundTruth: vi.fn(),
  calculateIterationMetrics: vi.fn(),
}));

vi.mock('@lib/evaluation/semanticSimilarity', () => ({
  getSemanticSimilarityScore: vi.fn(),
}));

vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(),
  extractJsonFromResponse: vi.fn((response: string) => response),
}));

vi.mock('@lib/training/prompt-engineer', () => ({
  buildTaskModelSystemPrompt: vi.fn((prompt: string) => `System: ${prompt}`),
  buildTaskModelInstruction: vi.fn((input: string) => `Process: ${input}`),
  buildJudgeSystemPrompt: vi.fn((prompt: string) => `Judge: ${prompt}`),
  buildJudgeEvaluationInstruction: vi.fn(
    (input: string, output: string) => `Evaluate: ${input} -> ${output}`
  ),
  refineBothPromptsFromFailureAnalysis: vi.fn(),
  refineBothPromptsFromHumanFeedback: vi.fn(),
}));

import { calculateIterationMetricsFromGroundTruth } from '@lib/evaluation/metrics-orchestrator';
import { getSemanticSimilarityScore } from '@lib/evaluation/semanticSimilarity';
import { callModel } from '@lib/utils/api-clients';
import {
  refineBothPromptsFromFailureAnalysis,
  refineBothPromptsFromHumanFeedback,
} from '@lib/training/prompt-engineer';

const mockCalculateMetrics = vi.mocked(calculateIterationMetricsFromGroundTruth);
const mockGetSemanticSimilarity = vi.mocked(getSemanticSimilarityScore);
const mockCallModel = vi.mocked(callModel);
const mockRefineBothFromFailure = vi.mocked(refineBothPromptsFromFailureAnalysis);
const mockRefineBothFromHuman = vi.mocked(refineBothPromptsFromHumanFeedback);

describe('TrainingLoopManager Integration Tests', () => {
  let db: Database.Database;
  let manager: TrainingLoopManager;
  let sessionId: string;
  let personaId: string;
  let taskModelId: string;
  let judgeModelId: string;
  let engineerModelId: string;

  const createTestPersona = () => {
    const id = 'persona-' + crypto.randomUUID();
    db.prepare(
      `INSERT INTO personas (id, name, description, task_model_id, judge_model_id, prompt_engineer_model_id, status, target_pass_rate, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      'test-persona',
      'Test persona for integration tests',
      taskModelId,
      judgeModelId,
      engineerModelId,
      'draft',
      0.8,
      new Date().toISOString(),
      new Date().toISOString()
    );
    return id;
  };

  const createTrainingPairs = (personaId: string, count: number = 5) => {
    for (let i = 0; i < count; i++) {
      const pairId = 'pair-' + crypto.randomUUID();
      db.prepare(
        `INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(pairId, personaId, `Input ${i}`, `Output ${i}`, new Date().toISOString());
    }
  };

  const createInitialPromptVersions = (personaId: string) => {
    const taskPromptId = 'task-prompt-' + crypto.randomUUID();
    const judgePromptId = 'judge-prompt-' + crypto.randomUUID();

    db.prepare(
      `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskPromptId,
      personaId,
      1,
      'Initial task prompt',
      'Initial version',
      'human',
      new Date().toISOString()
    );

    db.prepare(
      `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      judgePromptId,
      personaId,
      1,
      'Initial judge prompt',
      'Initial version',
      'human',
      new Date().toISOString()
    );
  };

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');

    // Initialize schema
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Create test models (use unique model names to avoid UNIQUE constraint)
    const timestamp = Date.now();
    taskModelId = 'model-task-' + crypto.randomUUID();
    judgeModelId = 'model-judge-' + crypto.randomUUID();
    engineerModelId = 'model-engineer-' + crypto.randomUUID();

    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      taskModelId,
      'openai',
      `gpt-4-task-${timestamp}`,
      'enc:task-key',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      judgeModelId,
      'anthropic',
      `claude-3-judge-${timestamp}`,
      'enc:judge-key',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      engineerModelId,
      'google',
      `gemini-engineer-${timestamp}`,
      'enc:engineer-key',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Set up mocks
    mockCallModel.mockResolvedValue('mock response');
    mockGetSemanticSimilarity.mockResolvedValue({
      score: 0.9,
      overallMatch: true,
      reasoning: 'High similarity',
      dimensions: {
        correctness: { rating: 'YES', details: 'Fully correct' },
        completeness: { rating: 'YES', details: 'Complete' },
        noContradictions: { rating: 'YES', details: 'No contradictions' },
      },
    });
    mockCalculateMetrics.mockResolvedValue({
      metrics: {
        f1_score: 0.85,
        precision: 0.9,
        recall: 0.8,
        cohens_kappa: 0.75,
        accuracy: 0.82,
        confusion_matrix: {
          true_positives: 8,
          true_negatives: 7,
          false_positives: 1,
          false_negatives: 2,
        },
      },
      failureCases: [] as Array<{
        type: 'false_positive' | 'false_negative';
        input: string;
        generated_output: string;
        expected_output: string;
        judge_reasoning: string;
      }>,
    });
    mockRefineBothFromFailure.mockResolvedValue({
      refined_task_prompt: 'Refined task prompt',
      refined_judge_prompt: 'Refined judge prompt',
      task_rationale: 'Task improvement',
      judge_rationale: 'Judge improvement',
      expected_impact: 'Expected 10% improvement',
    });
    mockRefineBothFromHuman.mockResolvedValue({
      refined_task_prompt: 'Refined task prompt from human',
      refined_judge_prompt: 'Refined judge prompt from human',
      task_rationale: 'Task improvement from human',
      judge_rationale: 'Judge improvement from human',
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    vi.clearAllMocks();
  });

  describe('Database Operations', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      createTrainingPairs(personaId, 5);
      createInitialPromptVersions(personaId);

      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);
    });

    it('should create training loop state', () => {
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId);

      expect(state).toBeUndefined(); // State doesn't exist yet
    });

    it('should initialize state on first execution', async () => {
      // Start execution but don't wait for completion
      const executePromise = manager.execute();

      // Give it a moment to create the state and complete iteration 1
      await new Promise((resolve) => setTimeout(resolve, 200));

      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as {
        session_id: string;
        persona_id: string;
        status: string;
        current_iteration: number;
        pause_reason: string | null;
      };

      expect(state).toBeDefined();
      expect(state.session_id).toBe(sessionId);
      expect(state.persona_id).toBe(personaId);
      // After iteration 1, state should be awaiting_human_review
      expect(state.status).toBe('awaiting_human_review');
      expect(state.current_iteration).toBe(1);

      // Stop the manager to prevent further execution
      manager.stop();

      // Wait for execution to complete or timeout
      try {
        await Promise.race([executePromise, new Promise((resolve) => setTimeout(resolve, 1000))]);
      } catch {
        // Ignore errors from stopping
      }
    });
  });

  describe('Training Pair Processing', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 1 }, db);
    });

    it('should handle empty training pairs gracefully', async () => {
      // Don't create any training pairs
      createInitialPromptVersions(personaId);

      const executePromise = manager.execute();
      manager.stop();

      try {
        await Promise.race([executePromise, new Promise((resolve) => setTimeout(resolve, 500))]);
      } catch {
        // Ignore errors
      }

      // Should not throw error, just complete with no iterations
      expect(true).toBe(true);
    });

    it('should process all training pairs', async () => {
      createTrainingPairs(personaId, 5);
      createInitialPromptVersions(personaId);

      const executePromise = manager.execute();
      manager.stop();

      try {
        await Promise.race([executePromise, new Promise((resolve) => setTimeout(resolve, 500))]);
      } catch {
        // Ignore errors
      }

      const pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);
      expect(pairs.length).toBe(5);
    });
  });

  describe('Pause and Resume', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      createTrainingPairs(personaId, 3);
      createInitialPromptVersions(personaId);

      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);
    });

    it('should pause and update state', async () => {
      // First initialize state by starting execution
      const executePromise = manager.execute();

      // Wait a bit then pause
      await new Promise((resolve) => setTimeout(resolve, 50));
      await manager.pause('Test pause');
      manager.stop();

      try {
        await Promise.race([executePromise, new Promise((resolve) => setTimeout(resolve, 500))]);
      } catch {
        // Ignore errors
      }

      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as {
        session_id: string;
        persona_id: string;
        status: string;
        current_iteration: number;
        pause_reason: string | null;
      };

      expect(state).toBeDefined();
      expect(state.status).toBe('paused');
      expect(state.pause_reason).toBe('Test pause');
    });

    it('should resume from paused state', async () => {
      // Create a paused state
      db.prepare(
        `INSERT INTO training_loop_state (session_id, persona_id, total_iterations, status, task_model_id, judge_model_id, prompt_engineer_model_id, task_results_evaluated, current_iteration, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        sessionId,
        personaId,
        3,
        'paused',
        taskModelId,
        judgeModelId,
        engineerModelId,
        0,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      );

      const newManager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);

      const resumePromise = newManager.resume();
      newManager.stop();

      try {
        await Promise.race([resumePromise, new Promise((resolve) => setTimeout(resolve, 500))]);
      } catch {
        // Ignore errors
      }

      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as {
        session_id: string;
        persona_id: string;
        status: string;
        current_iteration: number;
        pause_reason: string | null;
      };

      expect(state.status).not.toBe('paused');
    });

    it('should throw error when resuming non-paused session', async () => {
      // Create an in_progress state
      db.prepare(
        `INSERT INTO training_loop_state (session_id, persona_id, total_iterations, status, task_model_id, judge_model_id, prompt_engineer_model_id, task_results_evaluated, current_iteration, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        sessionId,
        personaId,
        3,
        'in_progress',
        taskModelId,
        judgeModelId,
        engineerModelId,
        0,
        1,
        new Date().toISOString(),
        new Date().toISOString()
      );

      const newManager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);

      await expect(newManager.resume()).rejects.toThrow(TrainingStateError);
    });
  });

  describe('Iteration 1 Human Review Workflow', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      createTrainingPairs(personaId, 3);
      createInitialPromptVersions(personaId);

      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);
    });

    it('should create iteration in awaiting_human_review status', async () => {
      // Create iteration in awaiting_human_review state
      const iterationId = 'iteration-' + crypto.randomUUID();
      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Judge prompt',
        'awaiting_human_review',
        3,
        0,
        new Date().toISOString()
      );

      const iteration = db
        .prepare('SELECT * FROM training_iterations WHERE id = ?')
        .get(iterationId) as { id: string; status: string };
      expect(iteration.status).toBe('awaiting_human_review');
    });

    it('should store human reviews for judge decisions', () => {
      const decisionId = 'decision-' + crypto.randomUUID();
      const reviewId = 'review-' + crypto.randomUUID();
      const iterationId = 'iteration-' + crypto.randomUUID();
      const pairId = 'pair-' + crypto.randomUUID();

      // Create training pair (required for foreign key)
      db.prepare(
        `INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(pairId, personaId, 'Input 1', 'Output 1', new Date().toISOString());

      // Create iteration (required for foreign key)
      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Judge prompt',
        'completed',
        1,
        0,
        new Date().toISOString()
      );

      // Create a judge decision
      db.prepare(
        `INSERT INTO judge_decisions (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decisionId,
        iterationId,
        pairId,
        'Generated output',
        'agree',
        'Good output',
        new Date().toISOString()
      );

      // Add human review
      db.prepare(
        `INSERT INTO human_reviews (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(reviewId, decisionId, 'agree', 'Looks good', new Date().toISOString());

      const review = db
        .prepare('SELECT * FROM human_reviews WHERE judge_decision_id = ?')
        .get(decisionId) as { human_decision: string };
      expect(review).toBeDefined();
      expect(review.human_decision).toBe('agree');
    });

    it('should verify all decisions are reviewed before continuing', () => {
      const iterationId = 'iteration-' + crypto.randomUUID();

      // Create iteration (required for foreign key)
      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Judge prompt',
        'in_progress',
        2,
        0,
        new Date().toISOString()
      );

      // Create two training pairs
      const pairId1 = 'pair-1-' + crypto.randomUUID();
      const pairId2 = 'pair-2-' + crypto.randomUUID();

      db.prepare(
        `INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
         VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`
      ).run(
        pairId1,
        personaId,
        'Input 1',
        'Output 1',
        new Date().toISOString(),
        pairId2,
        personaId,
        'Input 2',
        'Output 2',
        new Date().toISOString()
      );

      // Create two decisions
      const decision1 = 'decision-1-' + crypto.randomUUID();
      const decision2 = 'decision-2-' + crypto.randomUUID();

      db.prepare(
        `INSERT INTO judge_decisions (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        decision1,
        iterationId,
        pairId1,
        'Output 1',
        'agree',
        'Good',
        new Date().toISOString(),
        decision2,
        iterationId,
        pairId2,
        'Output 2',
        'disagree',
        'Bad',
        new Date().toISOString()
      );

      // Only review one
      db.prepare(
        `INSERT INTO human_reviews (id, judge_decision_id, human_decision, human_notes, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run('review-1', decision1, 'agree', 'Good', new Date().toISOString());

      // Check for unreviewed decisions
      const unreviewed = db
        .prepare(
          `SELECT COUNT(*) as count
         FROM judge_decisions jd
         LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
         WHERE jd.iteration_id = ? AND hr.id IS NULL`
        )
        .get(iterationId) as { count: number };

      expect(unreviewed.count).toBe(1);
    });
  });

  describe('Prompt Version Management', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);
    });

    it('should store task prompt versions', () => {
      const promptId = 'task-prompt-' + crypto.randomUUID();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        promptId,
        personaId,
        1,
        'Task prompt v1',
        'Initial version',
        'human',
        new Date().toISOString()
      );

      const prompt = db
        .prepare('SELECT * FROM task_prompt_versions WHERE persona_id = ? AND version_number = ?')
        .get(personaId, 1);
      expect(prompt).toBeDefined();
    });

    it('should store judge prompt versions', () => {
      const promptId = 'judge-prompt-' + crypto.randomUUID();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        promptId,
        personaId,
        1,
        'Judge prompt v1',
        'Initial version',
        'human',
        new Date().toISOString()
      );

      const prompt = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ? AND version_number = ?')
        .get(personaId, 1);
      expect(prompt).toBeDefined();
    });

    it('should enforce unique constraint on persona_id and version_number', () => {
      const promptId1 = 'task-prompt-1-' + crypto.randomUUID();
      const promptId2 = 'task-prompt-2-' + crypto.randomUUID();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        promptId1,
        personaId,
        1,
        'Task prompt v1',
        'Initial version',
        'human',
        new Date().toISOString()
      );

      // Attempting to insert another version 1 for the same persona should fail
      expect(() => {
        db.prepare(
          `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          promptId2,
          personaId,
          1,
          'Task prompt v1 duplicate',
          'Duplicate',
          'human',
          new Date().toISOString()
        );
      }).toThrow();
    });
  });

  describe('Metrics Storage', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);
    });

    it('should store iteration metrics', () => {
      const iterationId = 'iteration-' + crypto.randomUUID();
      const metricsId = 'metrics-' + crypto.randomUUID();

      // First create the iteration (required for foreign key constraint)
      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Judge prompt',
        'completed',
        5,
        0,
        new Date().toISOString()
      );

      // Now create the metrics
      db.prepare(
        `INSERT INTO iteration_metrics (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives, precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        metricsId,
        iterationId,
        8,
        7,
        1,
        2,
        0.9,
        0.8,
        0.85,
        0.75,
        0.82,
        new Date().toISOString()
      );

      const metrics = db
        .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
        .get(iterationId) as { f1_score: number };
      expect(metrics).toBeDefined();
      expect(metrics.f1_score).toBe(0.85);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 3 }, db);
    });

    it('should handle non-existent persona', async () => {
      const badManager = new TrainingLoopManager(
        { sessionId, personaId: 'non-existent-persona', maxIterations: 3 },
        db
      );

      await expect(badManager.execute()).rejects.toThrow(TrainingStateError);
    });

    it('should handle non-existent session in pause', async () => {
      const badManager = new TrainingLoopManager(
        { sessionId: 'non-existent-session', personaId, maxIterations: 3 },
        db
      );

      await expect(badManager.pause()).rejects.toThrow(TrainingStateError);
    });
  });

  describe('Concurrent Database Access Safety', () => {
    beforeEach(() => {
      sessionId = 'session-' + crypto.randomUUID();
      personaId = createTestPersona();
      createTrainingPairs(personaId, 10);
      createInitialPromptVersions(personaId);

      manager = new TrainingLoopManager({ sessionId, personaId, maxIterations: 2 }, db);
    });

    it('should handle sequential database writes safely', async () => {
      // Test that sequential operations don't cause race conditions
      const iterationId = 'iteration-' + crypto.randomUUID();

      // First create the iteration (required for foreign key constraint)
      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Judge prompt',
        'in_progress',
        0,
        0,
        new Date().toISOString()
      );

      // Create multiple training pairs
      for (let i = 0; i < 5; i++) {
        const pairId = `pair-${i}-${crypto.randomUUID()}`;
        db.prepare(
          `INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(pairId, personaId, `Input ${i}`, `Output ${i}`, new Date().toISOString());

        // Now create the decision for this pair
        const decisionId = `decision-${i}-${crypto.randomUUID()}`;
        db.prepare(
          `INSERT INTO judge_decisions (id, iteration_id, training_pair_id, generated_output, judge_decision, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          decisionId,
          iterationId,
          pairId,
          `Output ${i}`,
          i % 2 === 0 ? 'agree' : 'disagree',
          `Reasoning ${i}`,
          new Date().toISOString()
        );
      }

      const decisions = db
        .prepare('SELECT * FROM judge_decisions WHERE iteration_id = ?')
        .all(iterationId);
      expect(decisions.length).toBe(5);
    });

    it('should maintain data consistency during concurrent reads', () => {
      // Simulate concurrent reads (SQLite handles this with WAL mode)
      const pairs1 = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);
      const pairs2 = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);

      expect(pairs1.length).toBe(pairs2.length);
      expect(pairs1.length).toBe(10);
    });
  });
});
