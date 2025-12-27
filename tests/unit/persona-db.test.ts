/**
 * Unit tests for persona database access layer
 * Tests CRUD operations for all training-related tables
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase, closeTestDatabase, createTestModelConfig, createTestPersona } from '../setup';
import {
  createPersona,
  getPersona,
  listPersonas,
  updatePersona,
  deletePersona,
  createTrainingPairs,
  getTrainingPairs,
  getTrainingPair,
  deleteTrainingPairs,
  createTrainingIteration,
  getTrainingIteration,
  getLatestIteration,
  listIterations,
  updateIterationStatus,
  updateIterationCounts,
  createJudgeDecision,
  getIterationDecisions,
  createHumanReview,
  getHumanReviewByDecision,
  getIterationReviews,
  createIterationMetrics,
  getIterationMetrics,
  getPersonaMetrics,
  createPromptVersion,
  getPromptVersionByIteration,
  getPromptHistory,
  createTrainingLoopState,
  getTrainingLoopState,
  updateTrainingLoopState,
  createCheckpoint,
  getLatestCheckpoint,
} from '../../src/lib/persona-db';
import type { CreatePersonaInput, CreateTrainingPairInput, CreateHumanReviewInput } from '../../src/types/training';

describe('Persona Database Access Layer', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Persona CRUD', () => {
    it('should create a new persona', () => {
      const db = getTestDatabase();
      const taskModelId = createTestModelConfig(db, 'openai');
      const judgeModelId = createTestModelConfig(db, 'anthropic');
      const promptEngineerModelId = createTestModelConfig(db, 'google');

      const input: CreatePersonaInput = {
        name: 'Test Persona',
        description: 'A test persona',
        task_prompt: 'Evaluate responses',
        task_model_id: taskModelId,
        judge_model_id: judgeModelId,
        prompt_engineer_model_id: promptEngineerModelId,
      };

      const persona = createPersona(input, db);

      expect(persona).toBeDefined();
      expect(persona.name).toBe('Test Persona');
      expect(persona.status).toBe('draft');
      expect(persona.target_f1_score).toBe(0.8);
      expect(persona.max_iterations).toBe(5);
      expect(persona.current_iteration).toBe(0);
    });

    it('should get persona by ID', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const retrieved = getPersona(persona.id, db);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(persona.id);
      expect(retrieved?.name).toBe(persona.name);
    });

    it('should return null for non-existent persona', () => {
      const db = getTestDatabase();
      const retrieved = getPersona('non-existent-id', db);
      expect(retrieved).toBeNull();
    });

    it('should list all personas', () => {
      const db = getTestDatabase();
      createTestPersona(db, { name: 'Persona 1' });
      createTestPersona(db, { name: 'Persona 2' });
      createTestPersona(db, { name: 'Persona 3' });

      const personas = listPersonas(undefined, db);

      expect(personas).toHaveLength(3);
      expect(personas.map(p => p.name)).toContain('Persona 1');
    });

    it('should filter personas by status', () => {
      const db = getTestDatabase();
      const persona1 = createTestPersona(db);
      createTestPersona(db);

      // Update one persona to training status
      updatePersona(persona1.id, { status: 'training' }, db);

      const trainingPersonas = listPersonas('training', db);
      expect(trainingPersonas).toHaveLength(1);
      expect(trainingPersonas[0].status).toBe('training');

      const draftPersonas = listPersonas('draft', db);
      expect(draftPersonas).toHaveLength(1);
    });

    it('should update persona fields', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const updated = updatePersona(persona.id, {
        name: 'Updated Name',
        description: 'Updated description',
        status: 'training',
      }, db);

      expect(updated.name).toBe('Updated Name');
      expect(updated.description).toBe('Updated description');
      expect(updated.status).toBe('training');
    });

    it('should update persona metrics', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const updated = updatePersona(persona.id, {
        best_f1_score: 0.85,
        best_f1_iteration: 3,
      }, db);

      expect(updated.best_f1_score).toBe(0.85);
      expect(updated.best_f1_iteration).toBe(3);
    });

    it('should delete persona', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      deletePersona(persona.id, db);

      const retrieved = getPersona(persona.id, db);
      expect(retrieved).toBeNull();
    });
  });

  describe('TrainingPair CRUD', () => {
    it('should create multiple training pairs', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const pairs: CreateTrainingPairInput[] = [
        { input: 'Input 1', expected_output: 'Output 1' },
        { input: 'Input 2', expected_output: 'Output 2' },
        { input: 'Input 3', expected_output: 'Output 3' },
      ];

      const created = createTrainingPairs(persona.id, pairs, db);

      expect(created).toHaveLength(3);
      expect(created[0].input).toBe('Input 1');
    });

    it('should get all training pairs for a persona', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const pairs: CreateTrainingPairInput[] = [
        { input: 'Input 1', expected_output: 'Output 1' },
        { input: 'Input 2', expected_output: 'Output 2' },
      ];

      createTrainingPairs(persona.id, pairs, db);
      const retrieved = getTrainingPairs(persona.id, db);

      expect(retrieved).toHaveLength(2);
    });

    it('should get single training pair by ID', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(persona.id, [{ input: 'Test', expected_output: 'Output' }], db);

      const pair = getTrainingPair(pairs[0].id, db);

      expect(pair).toBeDefined();
      expect(pair?.input).toBe('Test');
    });

    it('should delete all training pairs for a persona', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingPairs(persona.id, [
        { input: 'Input 1', expected_output: 'Output 1' },
        { input: 'Input 2', expected_output: 'Output 2' },
      ], db);

      deleteTrainingPairs(persona.id, db);

      const pairs = getTrainingPairs(persona.id, db);
      expect(pairs).toHaveLength(0);
    });
  });

  describe('TrainingIteration CRUD', () => {
    it('should create training iteration', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const iteration = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Initial judge prompt',
        db,
      );

      expect(iteration).toBeDefined();
      expect(iteration.iteration_number).toBe(1);
      expect(iteration.status).toBe('in_progress');
      expect(iteration.total_pairs_evaluated).toBe(0);
    });

    it('should get iteration by ID', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      const retrieved = getTrainingIteration(iteration.id, db);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(iteration.id);
    });

    it('should get latest iteration for persona', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt 1', db);
      createTrainingIteration(persona.id, 2, persona.judge_model_id, 'Prompt 2', db);
      const iteration3 = createTrainingIteration(persona.id, 3, persona.judge_model_id, 'Prompt 3', db);

      const latest = getLatestIteration(persona.id, db);

      expect(latest).toBeDefined();
      expect(latest?.iteration_number).toBe(3);
      expect(latest?.id).toBe(iteration3.id);
    });

    it('should list all iterations for persona', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt 1', db);
      createTrainingIteration(persona.id, 2, persona.judge_model_id, 'Prompt 2', db);
      createTrainingIteration(persona.id, 3, persona.judge_model_id, 'Prompt 3', db);

      const iterations = listIterations(persona.id, db);

      expect(iterations).toHaveLength(3);
      expect(iterations[0].iteration_number).toBe(3); // Ordered DESC
      expect(iterations[2].iteration_number).toBe(1);
    });

    it('should update iteration status', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      const updated = updateIterationStatus(iteration.id, 'completed', undefined, db);

      expect(updated.status).toBe('completed');
      expect(updated.completed_at).toBeDefined();
    });

    it('should update iteration counts', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      updateIterationCounts(iteration.id, 10, 8, db);

      const updated = getTrainingIteration(iteration.id, db);
      expect(updated?.total_pairs_evaluated).toBe(10);
      expect(updated?.pairs_reviewed_by_human).toBe(8);
    });
  });

  describe('JudgeDecision CRUD', () => {
    it('should create judge decision', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(persona.id, [{ input: 'Test', expected_output: 'Output' }], db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      const decision = createJudgeDecision(
        iteration.id,
        pairs[0].id,
        'Generated output',
        'agree',
        0.95,
        'Reasoning here',
        undefined,
        db,
      );

      expect(decision).toBeDefined();
      expect(decision.judge_decision).toBe('agree');
      expect(decision.judge_confidence).toBe(0.95);
    });

    it('should get all decisions for an iteration', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(persona.id, [
        { input: 'Input 1', expected_output: 'Output 1' },
        { input: 'Input 2', expected_output: 'Output 2' },
      ], db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      createJudgeDecision(iteration.id, pairs[0].id, 'Generated 1', 'agree', 0.9, 'Reason 1', undefined, db);
      createJudgeDecision(iteration.id, pairs[1].id, 'Generated 2', 'disagree', 0.8, 'Reason 2', undefined, db);

      const decisions = getIterationDecisions(iteration.id, db);

      expect(decisions).toHaveLength(2);
    });
  });

  describe('HumanReview CRUD', () => {
    it('should create human review', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(persona.id, [{ input: 'Test', expected_output: 'Output' }], db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);
      const decision = createJudgeDecision(iteration.id, pairs[0].id, 'Generated', 'agree', 0.9, 'Reason', undefined, db);

      const input: CreateHumanReviewInput = {
        judge_decision_id: decision.id,
        human_decision: 'agree',
        human_confidence: 0.95,
        human_notes: 'I agree with the judge',
      };

      const review = createHumanReview(input, db);

      expect(review).toBeDefined();
      expect(review.human_decision).toBe('agree');
      expect(review.human_confidence).toBe(0.95);
    });

    it('should get human review by decision ID', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(persona.id, [{ input: 'Test', expected_output: 'Output' }], db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);
      const decision = createJudgeDecision(iteration.id, pairs[0].id, 'Generated', 'agree', 0.9, 'Reason', undefined, db);

      const review = createHumanReview({
        judge_decision_id: decision.id,
        human_decision: 'disagree',
      }, db);

      const retrieved = getHumanReviewByDecision(decision.id, db);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(review.id);
      expect(retrieved?.human_decision).toBe('disagree');
    });

    it('should get all reviews for an iteration', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(persona.id, [
        { input: 'Input 1', expected_output: 'Output 1' },
        { input: 'Input 2', expected_output: 'Output 2' },
      ], db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      const decision1 = createJudgeDecision(iteration.id, pairs[0].id, 'Gen 1', 'agree', 0.9, 'R1', undefined, db);
      const decision2 = createJudgeDecision(iteration.id, pairs[1].id, 'Gen 2', 'disagree', 0.8, 'R2', undefined, db);

      createHumanReview({ judge_decision_id: decision1.id, human_decision: 'agree' }, db);
      createHumanReview({ judge_decision_id: decision2.id, human_decision: 'disagree' }, db);

      const reviews = getIterationReviews(iteration.id, db);

      expect(reviews).toHaveLength(2);
    });
  });

  describe('IterationMetrics CRUD', () => {
    it('should create iteration metrics', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      const metrics = createIterationMetrics(iteration.id, {
        tp: 5,
        tn: 3,
        fp: 1,
        fn: 1,
        precision: 0.833,
        recall: 0.833,
        f1_score: 0.833,
        cohens_kappa: 0.6,
        accuracy: 0.8,
      }, db);

      expect(metrics).toBeDefined();
      expect(metrics.f1_score).toBe(0.833);
      expect(metrics.true_positives).toBe(5);
    });

    it('should get metrics by iteration ID', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const iteration = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt', db);

      createIterationMetrics(iteration.id, {
        tp: 5,
        tn: 3,
        fp: 1,
        fn: 1,
        precision: 0.833,
        recall: 0.833,
        f1_score: 0.833,
        cohens_kappa: 0.6,
        accuracy: 0.8,
      }, db);

      const metrics = getIterationMetrics(iteration.id, db);

      expect(metrics).toBeDefined();
      expect(metrics?.f1_score).toBe(0.833);
    });

    it('should get all metrics for a persona', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const iter1 = createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt 1', db);
      const iter2 = createTrainingIteration(persona.id, 2, persona.judge_model_id, 'Prompt 2', db);

      createIterationMetrics(iter1.id, {
        tp: 5, tn: 3, fp: 1, fn: 1,
        precision: 0.833, recall: 0.833, f1_score: 0.833, cohens_kappa: 0.6, accuracy: 0.8,
      }, db);

      createIterationMetrics(iter2.id, {
        tp: 6, tn: 3, fp: 0, fn: 1,
        precision: 1.0, recall: 0.857, f1_score: 0.923, cohens_kappa: 0.7, accuracy: 0.9,
      }, db);

      const allMetrics = getPersonaMetrics(persona.id, db);

      expect(allMetrics).toHaveLength(2);
      expect(allMetrics[0].f1_score).toBe(0.833);
      expect(allMetrics[1].f1_score).toBe(0.923);
    });
  });

  describe('JudgePromptVersion CRUD', () => {
    it('should create prompt version', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const version = createPromptVersion(
        persona.id,
        1,
        'Initial judge prompt',
        'First version',
        'human',
        db,
      );

      expect(version).toBeDefined();
      expect(version.prompt_text).toBe('Initial judge prompt');
      expect(version.created_by).toBe('human');
    });

    it('should get prompt version by iteration', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createPromptVersion(persona.id, 1, 'Prompt v1', null, 'human', db);
      createPromptVersion(persona.id, 2, 'Prompt v2', 'Improved', 'ai', db);

      const version = getPromptVersionByIteration(persona.id, 2, db);

      expect(version).toBeDefined();
      expect(version?.prompt_text).toBe('Prompt v2');
      expect(version?.created_by).toBe('ai');
    });

    it('should get prompt history', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createPromptVersion(persona.id, 1, 'Prompt v1', null, 'human', db);
      createPromptVersion(persona.id, 2, 'Prompt v2', 'Improved', 'ai', db);
      createPromptVersion(persona.id, 3, 'Prompt v3', 'Further improved', 'ai', db);

      const history = getPromptHistory(persona.id, db);

      expect(history).toHaveLength(3);
      expect(history[0].iteration_number).toBe(3); // Ordered DESC
      expect(history[2].iteration_number).toBe(1);
    });
  });

  describe('TrainingLoopState CRUD', () => {
    it('should create training loop state', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const state = createTrainingLoopState(
        'session-123',
        persona.id,
        5,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        persona.task_model_id,
        db,
      );

      expect(state).toBeDefined();
      expect(state.session_id).toBe('session-123');
      expect(state.status).toBe('pending');
      expect(state.total_iterations).toBe(5);
    });

    it('should get training loop state', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingLoopState(
        'session-123',
        persona.id,
        5,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        persona.task_model_id,
        db,
      );

      const state = getTrainingLoopState('session-123', db);

      expect(state).toBeDefined();
      expect(state?.session_id).toBe('session-123');
    });

    it('should update training loop state', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingLoopState(
        'session-123',
        persona.id,
        5,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        persona.task_model_id,
        db,
      );

      const updated = updateTrainingLoopState('session-123', {
        current_iteration: 2,
        status: 'in_progress',
        task_results_evaluated: 20,
      }, db);

      expect(updated.current_iteration).toBe(2);
      expect(updated.status).toBe('in_progress');
      expect(updated.task_results_evaluated).toBe(20);
    });
  });

  describe('TrainingLoopCheckpoint CRUD', () => {
    it('should create checkpoint', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingLoopState(
        'session-123',
        persona.id,
        5,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        persona.task_model_id,
        db,
      );

      const checkpoint = createCheckpoint(
        'session-123',
        1,
        10,
        JSON.stringify({ f1_score: 0.8 }),
        JSON.stringify(['id1', 'id2']),
        'Current prompt',
        db,
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.iteration_number).toBe(1);
      expect(checkpoint.evaluated_result_count).toBe(10);
    });

    it('should get latest checkpoint', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      createTrainingLoopState(
        'session-123',
        persona.id,
        5,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        persona.task_model_id,
        db,
      );

      createCheckpoint('session-123', 1, 10, '{}', '[]', 'Prompt 1', db);
      createCheckpoint('session-123', 2, 20, '{}', '[]', 'Prompt 2', db);
      const checkpoint3 = createCheckpoint('session-123', 3, 30, '{}', '[]', 'Prompt 3', db);

      const latest = getLatestCheckpoint('session-123', db);

      expect(latest).toBeDefined();
      expect(latest?.iteration_number).toBe(3);
      expect(latest?.id).toBe(checkpoint3.id);
    });
  });
});
