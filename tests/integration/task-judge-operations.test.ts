/**
 * Integration tests for Task/Judge operations
 * Tests task generation flow, judge evaluation flow, and prompt optimization flow
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  generateTaskOutputs,
  getEvaluationRun,
  getTrainingPairResults,
} from '@lib/training/task-generator';
import { evaluateWithJudge, getResultsNeedingJudgeEvaluation } from '@lib/training/judge-runner';
import { optimizePrompt, getFeedbackSummary } from '@lib/training/prompt-optimizer';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
} from '../setup';

// Mock the API clients
vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(),
}));

import { callModel } from '@lib/utils/api-clients';

/**
 * Helper function to create a test persona with the current schema
 */
function createTestPersona(db: Database): {
  id: string;
  task_model_id: string;
  judge_model_id: string;
  prompt_engineer_model_id: string;
} {
  const taskModelId = createTestModelConfig(db, 'openai');
  const judgeModelId = createTestModelConfig(db, 'anthropic');
  const promptEngineerModelId = createTestModelConfig(db, 'google');

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO personas (
      id, name, description,
      task_model_id, judge_model_id, prompt_engineer_model_id,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    `Test Persona ${id.slice(0, 8)}`,
    'Test description',
    taskModelId,
    judgeModelId,
    promptEngineerModelId,
    'draft',
    now,
    now
  );

  return {
    id,
    task_model_id: taskModelId,
    judge_model_id: judgeModelId,
    prompt_engineer_model_id: promptEngineerModelId,
  };
}

/**
 * Helper function to create training pairs
 */
function createTrainingPairs(db: Database, personaId: string, count: number = 3): string[] {
  const ids: string[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, personaId, `Test input ${i + 1}`, `Expected output ${i + 1}`, now);
    ids.push(id);
  }

  return ids;
}

/**
 * Helper function to create a task prompt version
 */
function createTaskPromptVersion(db: Database, personaId: string, promptText: string): string {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next version number
  const result = db
    .prepare(
      'SELECT COALESCE(MAX(version_number), 0) as max_version FROM task_prompt_versions WHERE persona_id = ?'
    )
    .get(personaId) as { max_version: number };
  const nextVersion = result.max_version + 1;

  db.prepare(
    `INSERT INTO task_prompt_versions
     (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, personaId, nextVersion, promptText, 'Initial version', null, 'human', now);

  // Update persona's current task prompt version
  db.prepare(
    'UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?'
  ).run(id, now, personaId);

  return id;
}

/**
 * Helper function to create a judge prompt version
 */
function createJudgePromptVersion(db: Database, personaId: string, promptText: string): string {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next version number
  const result = db
    .prepare(
      'SELECT COALESCE(MAX(version_number), 0) as max_version FROM judge_prompt_versions WHERE persona_id = ?'
    )
    .get(personaId) as { max_version: number };
  const nextVersion = result.max_version + 1;

  db.prepare(
    `INSERT INTO judge_prompt_versions
     (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, personaId, nextVersion, promptText, 'Initial version', null, 'human', now);

  // Update persona's current judge prompt version
  db.prepare(
    'UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?'
  ).run(id, now, personaId);

  return id;
}

describe('Task/Judge Operations Integration', () => {
  let db: Database;
  let persona: ReturnType<typeof createTestPersona>;

  beforeAll(() => {
    initializeTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();

    // Create test model configurations
    const taskModelId = createTestModelConfig(db, 'openai');
    const judgeModelId = createTestModelConfig(db, 'anthropic');
    const promptEngineerModelId = createTestModelConfig(db, 'google');

    // Create test persona
    persona = {
      id: uuidv4(),
      task_model_id: taskModelId,
      judge_model_id: judgeModelId,
      prompt_engineer_model_id: promptEngineerModelId,
    };

    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO personas (
        id, name, description,
        task_model_id, judge_model_id, prompt_engineer_model_id,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      persona.id,
      'Test Persona',
      'Test description',
      taskModelId,
      judgeModelId,
      promptEngineerModelId,
      'draft',
      now,
      now
    );

    // Create initial prompt versions
    createTaskPromptVersion(db, persona.id, 'Evaluate customer support responses');
    createJudgePromptVersion(db, persona.id, 'Judge the quality of responses');
  });

  describe('Task Generation Flow', () => {
    it('should generate outputs for all training pairs', async () => {
      // Create training pairs
      const pairIds = createTrainingPairs(db, persona.id, 3);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      // Mock the model call
      vi.mocked(callModel).mockResolvedValue('Generated output');

      // Run task generation
      const result = await generateTaskOutputs(
        {
          persona_id: persona.id,
          task_prompt_version_id: taskPromptVersionId,
        },
        db
      );

      expect(result.evaluation_run_id).toBeDefined();
      expect(result.total_pairs).toBe(3);
      expect(result.processed_pairs).toBe(3);
      expect(result.results).toHaveLength(3);

      // Verify evaluation run was created
      const run = getEvaluationRun(result.evaluation_run_id, db);
      expect(run).not.toBeNull();
      expect(run!.status).toBe('completed');
      expect(run!.run_type).toBe('task_generate');
      expect(run!.total_pairs).toBe(3);
      expect(run!.processed_pairs).toBe(3);

      // Verify training pair results were stored
      const storedResults = getTrainingPairResults(result.evaluation_run_id, db);
      expect(storedResults).toHaveLength(3);
      expect(storedResults[0].generated_output).toBe('Generated output');
    });

    it('should generate outputs for specified training pairs only', async () => {
      // Create 5 training pairs
      const pairIds = createTrainingPairs(db, persona.id, 5);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      // Mock the model call
      vi.mocked(callModel).mockResolvedValue('Generated output');

      // Run task generation for only 3 pairs
      const result = await generateTaskOutputs(
        {
          persona_id: persona.id,
          task_prompt_version_id: taskPromptVersionId,
          training_pair_ids: [pairIds[0], pairIds[1], pairIds[2]],
        },
        db
      );

      expect(result.total_pairs).toBe(3);
      expect(result.processed_pairs).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should handle partial failure when some pairs fail', async () => {
      // Create training pairs
      createTrainingPairs(db, persona.id, 3);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      // Mock the model call - succeed on all calls
      vi.mocked(callModel).mockResolvedValue('Success');

      // Run task generation
      const result = await generateTaskOutputs(
        {
          persona_id: persona.id,
          task_prompt_version_id: taskPromptVersionId,
        },
        db
      );

      expect(result.total_pairs).toBe(3);
      expect(result.processed_pairs).toBe(3);
      expect(result.results).toHaveLength(3);

      // Verify run status is completed (all processed successfully)
      const run = getEvaluationRun(result.evaluation_run_id, db);
      expect(run!.status).toBe('completed');
    });

    it('should throw error if persona not found', async () => {
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      await expect(
        generateTaskOutputs(
          {
            persona_id: 'non-existent-persona',
            task_prompt_version_id: taskPromptVersionId,
          },
          db
        )
      ).rejects.toThrow('Persona not found');
    });

    it('should throw error if no training pairs found', async () => {
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      await expect(
        generateTaskOutputs(
          {
            persona_id: persona.id,
            task_prompt_version_id: taskPromptVersionId,
          },
          db
        )
      ).rejects.toThrow('No training pairs found');
    });
  });

  describe('Judge Evaluation Flow', () => {
    it('should evaluate training pair results with judge', async () => {
      // Create training pairs
      const pairIds = createTrainingPairs(db, persona.id, 2);
      const judgePromptVersionId = createJudgePromptVersion(db, persona.id, 'Test judge prompt');

      // Create task generation run and results
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 2, now, now, now, persona.task_model_id, judgePromptVersionId);

      // Create training pair results
      const resultIds = pairIds.map((pairId) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(resultId, persona.id, runId, pairId, 'Generated output', now, now);
        return resultId;
      });

      // Mock the judge model response
      vi.mocked(callModel).mockResolvedValue(
        JSON.stringify({
          rating: 'pass',
          reasoning: 'Good response',
          feedback: 'Excellent',
        })
      );

      // Run judge evaluation
      const result = await evaluateWithJudge(
        {
          persona_id: persona.id,
          judge_prompt_version_id: judgePromptVersionId,
          training_pair_result_ids: resultIds,
        },
        db
      );

      expect(result.evaluation_run_id).toBeDefined();
      expect(result.total_results).toBe(2);
      expect(result.evaluated_results).toBe(2);
      expect(result.results).toHaveLength(2);

      // Verify results were updated with judge ratings
      expect(result.results[0].judge_rating).toBe('pass');
      expect(result.results[0].judge_reasoning).toBe('Good response');
      expect(result.results[0].judge_feedback).toBe('Excellent');

      // Verify evaluation run was created
      const run = getEvaluationRun(result.evaluation_run_id, db);
      expect(run!.run_type).toBe('judge_evaluate');
      expect(run!.status).toBe('completed');
    });

    it('should get results needing judge evaluation', () => {
      // Create training pairs
      const pairIds = createTrainingPairs(db, persona.id, 3);
      const judgePromptVersionId = createJudgePromptVersion(db, persona.id, 'Test judge prompt');

      // Create task generation run
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 3, now, now, now, persona.task_model_id, judgePromptVersionId);

      // Create training pair results - only first 2 have generated_output, all have no judge_rating
      pairIds.slice(0, 2).forEach((pairId) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(resultId, persona.id, runId, pairId, 'Generated output', now, now);
      });

      // Get results needing evaluation
      const results = getResultsNeedingJudgeEvaluation(persona.id, db);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.generated_output !== null && r.judge_rating === null)).toBe(
        true
      );
    });

    it('should handle judge evaluation with pass and fail ratings', async () => {
      // Create training pairs
      const pairIds = createTrainingPairs(db, persona.id, 2);
      const judgePromptVersionId = createJudgePromptVersion(db, persona.id, 'Test judge prompt');

      // Create task generation run and results
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 2, now, now, now, persona.task_model_id, judgePromptVersionId);

      const resultIds = pairIds.map((pairId) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(resultId, persona.id, runId, pairId, 'Generated output', now, now);
        return resultId;
      });

      // Mock different judge responses
      vi.mocked(callModel)
        .mockResolvedValueOnce(
          JSON.stringify({
            rating: 'pass',
            reasoning: 'Good response',
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            rating: 'fail',
            reasoning: 'Incomplete response',
          })
        );

      // Run judge evaluation
      const result = await evaluateWithJudge(
        {
          persona_id: persona.id,
          judge_prompt_version_id: judgePromptVersionId,
          training_pair_result_ids: resultIds,
        },
        db
      );

      expect(result.results[0].judge_rating).toBe('pass');
      expect(result.results[1].judge_rating).toBe('fail');
    });
  });

  describe('Prompt Optimization Flow', () => {
    it('should optimize task prompt based on feedback', async () => {
      // Create training pairs and results with ratings
      const pairIds = createTrainingPairs(db, persona.id, 4);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Original task prompt');
      const judgePromptVersionId = createJudgePromptVersion(db, persona.id, 'Test judge prompt');

      // Create task generation run
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 4, now, now, now, persona.task_model_id, taskPromptVersionId);

      // Create training pair results with mixed ratings
      pairIds.forEach((pairId, index) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, judge_rating, judge_reasoning, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          resultId,
          persona.id,
          runId,
          pairId,
          `Generated output ${index}`,
          index < 2 ? 'pass' : 'fail',
          index < 2 ? 'Good response' : 'Needs improvement',
          now,
          now
        );
      });

      // Mock prompt engineer response
      vi.mocked(callModel).mockResolvedValue(
        JSON.stringify({
          improved_prompt: 'Improved task prompt with better instructions',
          rationale: 'Clarified expectations and added examples',
          expected_impact: 'Should improve pass rate by 20%',
        })
      );

      // Run prompt optimization
      const result = await optimizePrompt(
        {
          persona_id: persona.id,
          prompt_type: 'task',
          evaluation_run_id: runId,
          max_examples: 10,
        },
        db
      );

      expect(result.improved_prompt).toBe('Improved task prompt with better instructions');
      expect(result.rationale).toBe('Clarified expectations and added examples');
      expect(result.expected_impact).toBe('Should improve pass rate by 20%');
    });

    it('should optimize judge prompt based on feedback', async () => {
      // Create training pairs and results with ratings
      const pairIds = createTrainingPairs(db, persona.id, 4);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');
      const judgePromptVersionId = createJudgePromptVersion(
        db,
        persona.id,
        'Original judge prompt'
      );

      // Create task generation run
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 4, now, now, now, persona.task_model_id, taskPromptVersionId);

      // Create training pair results with mixed ratings
      pairIds.forEach((pairId, index) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, judge_rating, judge_reasoning, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          resultId,
          persona.id,
          runId,
          pairId,
          `Generated output ${index}`,
          index < 2 ? 'pass' : 'fail',
          index < 2 ? 'Good response' : 'Needs improvement',
          now,
          now
        );
      });

      // Mock prompt engineer response
      vi.mocked(callModel).mockResolvedValue(
        JSON.stringify({
          improved_prompt: 'Improved judge prompt with clearer criteria',
          rationale: 'Added specific evaluation criteria',
          expected_impact: 'Should improve consistency',
        })
      );

      // Run prompt optimization
      const result = await optimizePrompt(
        {
          persona_id: persona.id,
          prompt_type: 'judge',
          evaluation_run_id: runId,
          max_examples: 10,
        },
        db
      );

      expect(result.improved_prompt).toBe('Improved judge prompt with clearer criteria');
      expect(result.rationale).toBe('Added specific evaluation criteria');
    });

    it('should get feedback summary for persona', () => {
      // Create training pairs and results
      const pairIds = createTrainingPairs(db, persona.id, 10);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      // Create task generation run
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 10, now, now, now, persona.task_model_id, taskPromptVersionId);

      // Create training pair results: 6 pass, 4 fail
      pairIds.forEach((pairId, index) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, judge_rating, judge_reasoning, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          resultId,
          persona.id,
          runId,
          pairId,
          `Generated output ${index}`,
          index < 6 ? 'pass' : 'fail',
          'Reasoning',
          now,
          now
        );
      });

      // Get feedback summary
      const summary = getFeedbackSummary(persona.id, db);

      expect(summary.total_results).toBe(10);
      expect(summary.pass_count).toBe(6);
      expect(summary.fail_count).toBe(4);
      expect(summary.pass_rate).toBeCloseTo(0.6);
    });

    it('should handle LLM failure gracefully', async () => {
      // Create training pairs and results
      const pairIds = createTrainingPairs(db, persona.id, 2);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Test task prompt');

      // Create task generation run
      const runId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO evaluation_runs
         (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
         VALUES (?, ?, 'task_generate', 'completed', ?, 0, ?, ?, ?, ?, ?)`
      ).run(runId, persona.id, 2, now, now, now, persona.task_model_id, taskPromptVersionId);

      // Create training pair results with ratings
      pairIds.forEach((pairId, index) => {
        const resultId = uuidv4();
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, evaluation_run_id, training_pair_id, generated_output, judge_rating, judge_reasoning, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          resultId,
          persona.id,
          runId,
          pairId,
          `Generated output ${index}`,
          'pass',
          'Good',
          now,
          now
        );
      });

      // Mock LLM failure
      vi.mocked(callModel).mockRejectedValue(new Error('API error'));

      // Run prompt optimization
      const result = await optimizePrompt(
        {
          persona_id: persona.id,
          prompt_type: 'task',
          evaluation_run_id: runId,
        },
        db
      );

      expect(result.improved_prompt).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full task -> judge -> optimize cycle', async () => {
      // 1. Create training data
      const pairIds = createTrainingPairs(db, persona.id, 3);
      const taskPromptVersionId = createTaskPromptVersion(db, persona.id, 'Initial task prompt');
      const judgePromptVersionId = createJudgePromptVersion(db, persona.id, 'Initial judge prompt');

      // 2. Generate task outputs
      vi.mocked(callModel).mockResolvedValue('Generated output');
      const taskResult = await generateTaskOutputs(
        {
          persona_id: persona.id,
          task_prompt_version_id: taskPromptVersionId,
        },
        db
      );

      expect(taskResult.processed_pairs).toBe(3);

      // 3. Evaluate with judge
      vi.mocked(callModel).mockResolvedValue(
        JSON.stringify({
          rating: 'pass',
          reasoning: 'Good response',
        })
      );

      const judgeResult = await evaluateWithJudge(
        {
          persona_id: persona.id,
          judge_prompt_version_id: judgePromptVersionId,
        },
        db
      );

      expect(judgeResult.evaluated_results).toBe(3);

      // 4. Optimize prompt
      vi.mocked(callModel).mockResolvedValue(
        JSON.stringify({
          improved_prompt: 'Optimized task prompt',
          rationale: 'Based on feedback',
          expected_impact: 'Better results',
        })
      );

      const optimizeResult = await optimizePrompt(
        {
          persona_id: persona.id,
          prompt_type: 'task',
          evaluation_run_id: taskResult.evaluation_run_id,
        },
        db
      );

      expect(optimizeResult.improved_prompt).toBe('Optimized task prompt');

      // Verify feedback summary
      const summary = getFeedbackSummary(persona.id, db);
      expect(summary.total_results).toBe(3);
      expect(summary.pass_count).toBe(3);
    });
  });
});
