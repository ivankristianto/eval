/**
 * Unit tests for version comparison service
 * Tests comparing outputs across different evaluation runs/versions
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  compareVersions,
  getAvailableVersions,
  compareMultiplePairs,
} from '@lib/training/version-comparison';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
  createTestPersona,
  createTestTrainingPairs,
} from '../setup';

/**
 * Helper to create a test evaluation run
 */
let iterationNumberCounter = 0;

function createTestEvaluationRun(
  db: Database,
  personaId: string,
  overrides?: {
    run_type?: 'task_generate' | 'judge_evaluate' | 'full_evaluation';
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    iteration_number?: number;
  }
): { runId: string; modelId: string; promptVersionId: string } {
  const modelId = createTestModelConfig(db, 'openai');

  // Get next version number for this persona
  const versionResult = db
    .prepare(
      'SELECT COALESCE(MAX(version_number), 0) as max_version FROM judge_prompt_versions WHERE persona_id = ?'
    )
    .get(personaId) as { max_version: number };
  const nextVersion = versionResult.max_version + 1;

  const promptVersionId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(promptVersionId, personaId, nextVersion, 'Test prompt', 'human', now);

  const runId = uuidv4();
  // Use auto-incrementing iteration number if not provided
  const iterationNumber = overrides?.iteration_number ?? ++iterationNumberCounter;

  db.prepare(
    `INSERT INTO evaluation_runs (
      id, persona_id, run_type, status, total_pairs, processed_pairs,
      started_at, completed_at, created_at, updated_at, model_id, prompt_version_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    runId,
    personaId,
    overrides?.run_type ?? 'task_generate',
    overrides?.status ?? 'completed',
    10,
    10,
    now,
    now,
    now,
    now,
    modelId,
    promptVersionId
  );

  // Create corresponding training iteration for iteration_number lookups
  const iterationId = uuidv4();
  db.prepare(
    `INSERT INTO training_iterations (
      id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(iterationId, personaId, iterationNumber, modelId, 'Test prompt', 'completed', now);

  return { runId, modelId, promptVersionId };
}

/**
 * Helper to create a test training pair result
 */
function createTestTrainingPairResult(
  db: Database,
  personaId: string,
  trainingPairId: string,
  evaluationRunId: string,
  overrides?: {
    generated_output?: string;
    judge_rating?: 'pass' | 'fail';
    judge_feedback?: string;
    judge_reasoning?: string;
    human_rating?: 'pass' | 'fail';
    human_feedback?: string;
    execution_time_ms?: number;
  }
): string {
  const resultId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO training_pair_results (
      id, persona_id, evaluation_run_id, training_pair_id,
      generated_output, judge_rating, judge_feedback, judge_reasoning,
      human_rating, human_feedback,
      execution_time_ms, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    resultId,
    personaId,
    evaluationRunId,
    trainingPairId,
    overrides?.generated_output ?? 'Test output',
    overrides?.judge_rating ?? null,
    overrides?.judge_feedback ?? null,
    overrides?.judge_reasoning ?? null,
    overrides?.human_rating ?? null,
    overrides?.human_feedback ?? null,
    overrides?.execution_time_ms ?? 100,
    now,
    now
  );

  return resultId;
}

describe('Version Comparison Service', () => {
  let db: Database;
  let personaId: string;
  let trainingPairIds: string[];

  beforeAll(() => {
    initializeTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();
    // Reset counter
    iterationNumberCounter = 0;

    // Create test model configurations
    createTestModelConfig(db, 'openai');
    createTestModelConfig(db, 'anthropic');
    createTestModelConfig(db, 'google');

    // Create test persona
    const persona = createTestPersona(db);
    personaId = persona.id;

    // Create test training pairs
    const pairs = createTestTrainingPairs(db, personaId, 5);
    trainingPairIds = pairs.map((p) => p.id);
  });

  afterEach(() => {
    cleanTestDatabase();
  });

  describe('compareVersions - by run_id', () => {
    it('should compare outputs from two different evaluation runs', () => {
      const run1 = createTestEvaluationRun(db, personaId, { iteration_number: 1 });
      const run2 = createTestEvaluationRun(db, personaId, { iteration_number: 2 });

      // Create results for the same training pair
      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId, {
        generated_output: 'Output from iteration 1',
        judge_rating: 'pass',
      });

      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run2.runId, {
        generated_output: 'Output from iteration 2',
        judge_rating: 'fail',
      });

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(result.training_pair.id).toBe(trainingPairIds[0]);
      expect(result.version1.identifier).toBe(run1.runId);
      expect(result.version2.identifier).toBe(run2.runId);
      expect(result.version1.output?.generated_output).toBe('Output from iteration 1');
      expect(result.version2.output?.generated_output).toBe('Output from iteration 2');
      expect(result.version1.output?.judge_rating).toBe('pass');
      expect(result.version2.output?.judge_rating).toBe('fail');
    });

    it('should return null for version2 output when no result exists for second run', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      // Only create result for first run
      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId, {
        generated_output: 'Output exists',
      });

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(result.version1.output).not.toBeNull();
      expect(result.version1.output?.generated_output).toBe('Output exists');
      expect(result.version2.output).toBeNull();
    });

    it('should include evaluation run details', () => {
      const run1 = createTestEvaluationRun(db, personaId, { run_type: 'task_generate' });
      const run2 = createTestEvaluationRun(db, personaId, { run_type: 'judge_evaluate' });

      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId);
      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run2.runId);

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(result.version1.evaluation_run).not.toBeNull();
      expect(result.version1.evaluation_run?.run_type).toBe('task_generate');
      expect(result.version2.evaluation_run?.run_type).toBe('judge_evaluate');
    });

    it('should include all output fields', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId, {
        generated_output: 'Output 1',
        judge_rating: 'pass',
        judge_feedback: 'Good response',
        judge_reasoning: 'Meets all criteria',
        human_rating: 'pass',
        human_feedback: 'Agreed',
        execution_time_ms: 500,
      });

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      const output = result.version1.output;
      expect(output).not.toBeNull();
      expect(output?.generated_output).toBe('Output 1');
      expect(output?.judge_rating).toBe('pass');
      expect(output?.judge_feedback).toBe('Good response');
      expect(output?.judge_reasoning).toBe('Meets all criteria');
      expect(output?.human_rating).toBe('pass');
      expect(output?.human_feedback).toBe('Agreed');
      expect(output?.execution_time_ms).toBe(500);
      expect(output?.result_id).toBeDefined();
      expect(output?.created_at).toBeDefined();
    });

    it('should throw error for non-existent training pair', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      expect(() =>
        compareVersions(
          {
            persona_id: personaId,
            training_pair_id: 'non-existent-pair',
            version1: run1.runId,
            version2: run2.runId,
          },
          db
        )
      ).toThrow('Training pair not found');
    });

    it('should throw error for training pair belonging to different persona', () => {
      // Create another persona
      const otherPersona = createTestPersona(db);
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      expect(() =>
        compareVersions(
          {
            persona_id: personaId,
            training_pair_id: trainingPairIds[0],
            version1: run1.runId,
            version2: run2.runId,
          },
          db
        )
      ).not.toThrow();

      // Try with other persona's pair (won't exist for first persona)
      expect(() =>
        compareVersions(
          {
            persona_id: otherPersona.id,
            training_pair_id: trainingPairIds[0],
            version1: run1.runId,
            version2: run2.runId,
          },
          db
        )
      ).toThrow('Training pair not found');
    });

    it('should return null for both outputs when no results exist', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(result.version1.output).toBeNull();
      expect(result.version2.output).toBeNull();
    });
  });

  describe('compareVersions - by iteration_number', () => {
    it('should compare outputs using iteration numbers', () => {
      const run1 = createTestEvaluationRun(db, personaId, { iteration_number: 1 });
      const run2 = createTestEvaluationRun(db, personaId, { iteration_number: 2 });

      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId, {
        generated_output: 'Iteration 1 output',
      });

      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run2.runId, {
        generated_output: 'Iteration 2 output',
      });

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: 1,
          version2: 2,
          version_type: 'iteration_number',
        },
        db
      );

      expect(result.version1.identifier).toBe('iteration-1');
      expect(result.version2.identifier).toBe('iteration-2');
      expect(result.version1.output?.generated_output).toBe('Iteration 1 output');
      expect(result.version2.output?.generated_output).toBe('Iteration 2 output');
    });

    it('should handle non-existent iteration numbers', () => {
      const run1 = createTestEvaluationRun(db, personaId, { iteration_number: 1 });

      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId);

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: 1,
          version2: 999, // Non-existent
          version_type: 'iteration_number',
        },
        db
      );

      expect(result.version1.output).not.toBeNull();
      expect(result.version2.output).toBeNull();
    });

    it('should return null outputs when iteration has no matching evaluation run', () => {
      // Create iterations without corresponding evaluation runs
      const iterationId1 = uuidv4();
      const iterationId2 = uuidv4();
      const now = new Date().toISOString();

      const modelId = createTestModelConfig(db, 'openai');

      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(iterationId1, personaId, 1, modelId, 'Prompt 1', 'completed', now);

      db.prepare(
        `INSERT INTO training_iterations (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(iterationId2, personaId, 2, modelId, 'Prompt 2', 'completed', now);

      const result = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: 1,
          version2: 2,
          version_type: 'iteration_number',
        },
        db
      );

      // Should return null since there's no evaluation run linking
      expect(result.version1.output).toBeNull();
      expect(result.version2.output).toBeNull();
    });
  });

  describe('getAvailableVersions', () => {
    it('should return all evaluation runs for a persona', () => {
      const run1 = createTestEvaluationRun(db, personaId, { status: 'completed' });
      const run2 = createTestEvaluationRun(db, personaId, { status: 'completed' });
      const run3 = createTestEvaluationRun(db, personaId, { status: 'running' });

      const versions = getAvailableVersions(personaId, trainingPairIds[0], db);

      expect(versions).toHaveLength(3);
      expect(versions.map((v) => v.run.id)).toContain(run1.runId);
      expect(versions.map((v) => v.run.id)).toContain(run2.runId);
      expect(versions.map((v) => v.run.id)).toContain(run3.runId);
    });

    it('should indicate which runs have results for the training pair', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      // Only create result for run1
      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId);

      const versions = getAvailableVersions(personaId, trainingPairIds[0], db);

      expect(versions).toHaveLength(2);

      const run1Version = versions.find((v) => v.run.id === run1.runId);
      const run2Version = versions.find((v) => v.run.id === run2.runId);

      expect(run1Version?.has_result).toBe(true);
      expect(run2Version?.has_result).toBe(false);
    });

    it('should only return completed or running runs', () => {
      const run1 = createTestEvaluationRun(db, personaId, { status: 'completed' });
      const run2 = createTestEvaluationRun(db, personaId, { status: 'running' });
      const run3 = createTestEvaluationRun(db, personaId, { status: 'pending' });
      const run4 = createTestEvaluationRun(db, personaId, { status: 'failed' });
      const run5 = createTestEvaluationRun(db, personaId, { status: 'cancelled' });

      const versions = getAvailableVersions(personaId, trainingPairIds[0], db);

      expect(versions).toHaveLength(2);
      expect(versions.map((v) => v.run.id)).toContain(run1.runId);
      expect(versions.map((v) => v.run.id)).toContain(run2.runId);
      expect(versions.map((v) => v.run.id)).not.toContain(run3.runId);
      expect(versions.map((v) => v.run.id)).not.toContain(run4.runId);
      expect(versions.map((v) => v.run.id)).not.toContain(run5.runId);
    });

    it('should order runs by created_at DESC', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 2) {
        // busy wait for 2ms
      }
      const run2 = createTestEvaluationRun(db, personaId);
      while (Date.now() - start < 4) {
        // busy wait for 4ms total
      }
      const run3 = createTestEvaluationRun(db, personaId);

      const versions = getAvailableVersions(personaId, trainingPairIds[0], db);

      // Most recent first
      expect(versions[0].run.id).toBe(run3.runId);
      expect(versions[1].run.id).toBe(run2.runId);
      expect(versions[2].run.id).toBe(run1.runId);
    });

    it('should return empty array for persona with no runs', () => {
      const newPersona = createTestPersona(db);
      const pairs = createTestTrainingPairs(db, newPersona.id, 1);

      const versions = getAvailableVersions(newPersona.id, pairs[0].id, db);

      expect(versions).toHaveLength(0);
    });
  });

  describe('compareMultiplePairs', () => {
    it('should compare multiple training pairs at once', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      // Create results for multiple pairs
      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run1.runId, {
        generated_output: 'Pair 1 - Run 1',
      });
      createTestTrainingPairResult(db, personaId, trainingPairIds[0], run2.runId, {
        generated_output: 'Pair 1 - Run 2',
      });

      createTestTrainingPairResult(db, personaId, trainingPairIds[1], run1.runId, {
        generated_output: 'Pair 2 - Run 1',
      });
      createTestTrainingPairResult(db, personaId, trainingPairIds[1], run2.runId, {
        generated_output: 'Pair 2 - Run 2',
      });

      createTestTrainingPairResult(db, personaId, trainingPairIds[2], run1.runId, {
        generated_output: 'Pair 3 - Run 1',
      });
      // No result for pair 3 in run 2

      const results = compareMultiplePairs(
        {
          persona_id: personaId,
          training_pair_ids: [trainingPairIds[0], trainingPairIds[1], trainingPairIds[2]],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(results).toHaveLength(3);

      // Check pair 1
      expect(results[0].training_pair.id).toBe(trainingPairIds[0]);
      expect(results[0].version1.output?.generated_output).toBe('Pair 1 - Run 1');
      expect(results[0].version2.output?.generated_output).toBe('Pair 1 - Run 2');

      // Check pair 2
      expect(results[1].training_pair.id).toBe(trainingPairIds[1]);
      expect(results[1].version1.output?.generated_output).toBe('Pair 2 - Run 1');
      expect(results[1].version2.output?.generated_output).toBe('Pair 2 - Run 2');

      // Check pair 3 (missing version 2)
      expect(results[2].training_pair.id).toBe(trainingPairIds[2]);
      expect(results[2].version1.output?.generated_output).toBe('Pair 3 - Run 1');
      expect(results[2].version2.output).toBeNull();
    });

    it('should handle empty training pair IDs array', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      const results = compareMultiplePairs(
        {
          persona_id: personaId,
          training_pair_ids: [],
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(results).toHaveLength(0);
    });

    it('should throw error for any non-existent training pair', () => {
      const run1 = createTestEvaluationRun(db, personaId);
      const run2 = createTestEvaluationRun(db, personaId);

      expect(() =>
        compareMultiplePairs(
          {
            persona_id: personaId,
            training_pair_ids: [trainingPairIds[0], 'non-existent-pair'],
            version1: run1.runId,
            version2: run2.runId,
          },
          db
        )
      ).toThrow('Training pair not found');
    });
  });

  describe('integration scenarios', () => {
    it('should support typical version comparison workflow', () => {
      // Simulate a typical training scenario with multiple iterations
      const run1 = createTestEvaluationRun(db, personaId, {
        run_type: 'task_generate',
        iteration_number: 1,
      });
      const run2 = createTestEvaluationRun(db, personaId, {
        run_type: 'task_generate',
        iteration_number: 2,
      });

      // Create results for multiple pairs across both runs
      for (let i = 0; i < 3; i++) {
        createTestTrainingPairResult(db, personaId, trainingPairIds[i], run1.runId, {
          generated_output: `Iteration 1 - Pair ${i + 1}`,
          judge_rating: i % 2 === 0 ? 'pass' : 'fail',
          execution_time_ms: 100 + i * 10,
        });

        createTestTrainingPairResult(db, personaId, trainingPairIds[i], run2.runId, {
          generated_output: `Iteration 2 - Pair ${i + 1}`,
          judge_rating: 'pass', // All pass in iteration 2
          execution_time_ms: 90 + i * 10,
        });
      }

      // Get available versions for UI
      const availableVersions = getAvailableVersions(personaId, trainingPairIds[0], db);
      expect(availableVersions).toHaveLength(2);

      // Compare using iteration numbers
      const comparison = compareVersions(
        {
          persona_id: personaId,
          training_pair_id: trainingPairIds[0],
          version1: 1,
          version2: 2,
          version_type: 'iteration_number',
        },
        db
      );

      expect(comparison.version1.output?.generated_output).toBe('Iteration 1 - Pair 1');
      expect(comparison.version2.output?.generated_output).toBe('Iteration 2 - Pair 1');
      expect(comparison.version1.output?.judge_rating).toBe('pass');
      expect(comparison.version2.output?.judge_rating).toBe('pass');

      // Batch compare multiple pairs
      const batchComparison = compareMultiplePairs(
        {
          persona_id: personaId,
          training_pair_ids: trainingPairIds.slice(0, 3),
          version1: run1.runId,
          version2: run2.runId,
        },
        db
      );

      expect(batchComparison).toHaveLength(3);
      expect(batchComparison.every((c) => c.version2.output?.judge_rating === 'pass')).toBe(true);
    });
  });
});
