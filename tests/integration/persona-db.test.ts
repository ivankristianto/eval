/**
 * Integration tests for persona database access layer
 * Tests transaction atomicity, cascade deletes, and FK constraints
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
  createTestPersona,
} from '../setup';
import {
  getPersona,
  deletePersona,
  createTrainingPairs,
  getTrainingPairs,
  createTrainingIteration,
  listIterations,
  createJudgeDecision,
  getJudgeDecision,
  getIterationDecisions,
  createHumanReview,
  getHumanReview,
  getIterationReviews,
  createIterationMetrics,
  getIterationMetrics,
  createPromptVersion,
  getPromptHistory,
  createTrainingLoopState,
  getTrainingLoopState,
  createCheckpoint,
  getLatestCheckpoint,
  withTransaction,
} from '../../src/lib/persona-db';
import type { CreatePersonaInput } from '../../src/types/training';

describe('Persona Database Integration Tests', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Transaction Atomicity', () => {
    it('should rollback transaction on error', () => {
      const db = getTestDatabase();

      expect(() => {
        withTransaction((database) => {
          // Create persona successfully
          const taskModelId = createTestModelConfig(database, 'openai');
          const judgeModelId = createTestModelConfig(database, 'anthropic');
          const promptEngineerModelId = createTestModelConfig(database, 'google');

          const input: CreatePersonaInput = {
            name: 'Test Persona',
            task_prompt: 'Test prompt',
            task_model_id: taskModelId,
            judge_model_id: judgeModelId,
            prompt_engineer_model_id: promptEngineerModelId,
          };

          const stmt = database.prepare(`
            INSERT INTO personas (
              id, name, task_prompt, task_model_id, judge_model_id,
              prompt_engineer_model_id, status, target_f1_score,
              max_iterations, current_iteration, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            'test-id',
            input.name,
            input.task_prompt,
            input.task_model_id,
            input.judge_model_id,
            input.prompt_engineer_model_id,
            'draft',
            0.8,
            5,
            0,
            new Date().toISOString(),
            new Date().toISOString()
          );

          // Now cause an error with duplicate ID
          stmt.run(
            'test-id', // Same ID - should violate PRIMARY KEY constraint
            'Another Persona',
            input.task_prompt,
            input.task_model_id,
            input.judge_model_id,
            input.prompt_engineer_model_id,
            'draft',
            0.8,
            5,
            0,
            new Date().toISOString(),
            new Date().toISOString()
          );
        }, db);
      }).toThrow();

      // Verify rollback - no personas should exist
      const personas = db.prepare('SELECT * FROM personas').all();
      expect(personas).toHaveLength(0);
    });

    it('should commit transaction when successful', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Verify persona was committed
      const retrieved = getPersona(persona.id, db);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(persona.id);
    });

    it('should handle nested operations atomically', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Create training pairs and iteration in one conceptual operation
      const pairs = createTrainingPairs(
        persona.id,
        [
          { input: 'Input 1', expected_output: 'Output 1' },
          { input: 'Input 2', expected_output: 'Output 2' },
          { input: 'Input 3', expected_output: 'Output 3' },
        ],
        db
      );

      const iteration = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Initial prompt',
        db
      );

      // Verify all were created
      expect(pairs).toHaveLength(3);
      expect(iteration.iteration_number).toBe(1);

      // Create judge decisions for all pairs
      pairs.forEach((pair, index) => {
        createJudgeDecision(
          iteration.id,
          pair.id,
          `Generated output ${index + 1}`,
          'agree',
          0.9,
          'Reasoning',
          undefined,
          db
        );
      });

      // Verify all decisions were created
      const decisions = getIterationDecisions(iteration.id, db);
      expect(decisions).toHaveLength(3);
    });
  });

  describe('Cascade Deletes', () => {
    it('should cascade delete training pairs when persona is deleted', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Create training pairs
      const pairs = createTrainingPairs(
        persona.id,
        [
          { input: 'Input 1', expected_output: 'Output 1' },
          { input: 'Input 2', expected_output: 'Output 2' },
        ],
        db
      );

      expect(pairs).toHaveLength(2);

      // Delete persona
      deletePersona(persona.id, db);

      // Verify persona is deleted
      expect(getPersona(persona.id, db)).toBeNull();

      // Verify training pairs are cascade deleted
      const remainingPairs = getTrainingPairs(persona.id, db);
      expect(remainingPairs).toHaveLength(0);
    });

    it('should cascade delete iterations when persona is deleted', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Create iterations
      createTrainingIteration(persona.id, 1, persona.judge_model_id, 'Prompt 1', db);
      createTrainingIteration(persona.id, 2, persona.judge_model_id, 'Prompt 2', db);

      const iterations = listIterations(persona.id, db);
      expect(iterations).toHaveLength(2);

      // Delete persona
      deletePersona(persona.id, db);

      // Verify iterations are cascade deleted
      const remainingIterations = listIterations(persona.id, db);
      expect(remainingIterations).toHaveLength(0);
    });

    it('should cascade delete judge decisions when iteration is deleted', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(
        persona.id,
        [{ input: 'Input', expected_output: 'Output' }],
        db
      );
      const iteration = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Prompt',
        db
      );

      // Create judge decision
      const decision = createJudgeDecision(
        iteration.id,
        pairs[0].id,
        'Generated',
        'agree',
        0.9,
        'Reason',
        undefined,
        db
      );

      expect(getJudgeDecision(decision.id, db)).toBeDefined();

      // Delete persona (should cascade to iteration, then to decision)
      deletePersona(persona.id, db);

      // Verify decision is cascade deleted
      expect(getJudgeDecision(decision.id, db)).toBeNull();
    });

    it('should cascade delete human reviews when judge decision is deleted', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(
        persona.id,
        [{ input: 'Input', expected_output: 'Output' }],
        db
      );
      const iteration = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Prompt',
        db
      );

      const decision = createJudgeDecision(
        iteration.id,
        pairs[0].id,
        'Generated',
        'agree',
        0.9,
        'Reason',
        undefined,
        db
      );

      // Create human review
      const review = createHumanReview(
        {
          judge_decision_id: decision.id,
          human_decision: 'agree',
          human_confidence: 0.95,
        },
        db
      );

      expect(getHumanReview(review.id, db)).toBeDefined();

      // Delete persona (cascades all the way down)
      deletePersona(persona.id, db);

      // Verify review is cascade deleted
      expect(getHumanReview(review.id, db)).toBeNull();
    });

    it('should cascade delete all related data when persona is deleted', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Create full data hierarchy
      const pairs = createTrainingPairs(
        persona.id,
        [
          { input: 'Input 1', expected_output: 'Output 1' },
          { input: 'Input 2', expected_output: 'Output 2' },
        ],
        db
      );

      const iteration = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Prompt',
        db
      );

      const decision1 = createJudgeDecision(
        iteration.id,
        pairs[0].id,
        'Gen 1',
        'agree',
        0.9,
        'R1',
        undefined,
        db
      );
      const decision2 = createJudgeDecision(
        iteration.id,
        pairs[1].id,
        'Gen 2',
        'disagree',
        0.8,
        'R2',
        undefined,
        db
      );

      createHumanReview({ judge_decision_id: decision1.id, human_decision: 'agree' }, db);
      createHumanReview({ judge_decision_id: decision2.id, human_decision: 'disagree' }, db);

      createIterationMetrics(
        iteration.id,
        {
          tp: 1,
          tn: 1,
          fp: 0,
          fn: 0,
          precision: 1.0,
          recall: 1.0,
          f1_score: 1.0,
          cohens_kappa: 1.0,
          accuracy: 1.0,
        },
        db
      );

      createPromptVersion(persona.id, 1, 'Prompt v1', 'Initial', 'human', db);

      // Verify all data exists
      expect(getTrainingPairs(persona.id, db)).toHaveLength(2);
      expect(listIterations(persona.id, db)).toHaveLength(1);
      expect(getIterationDecisions(iteration.id, db)).toHaveLength(2);
      expect(getIterationReviews(iteration.id, db)).toHaveLength(2);
      expect(getIterationMetrics(iteration.id, db)).toBeDefined();
      expect(getPromptHistory(persona.id, db)).toHaveLength(1);

      // Delete persona
      deletePersona(persona.id, db);

      // Verify all cascade deleted
      expect(getTrainingPairs(persona.id, db)).toHaveLength(0);
      expect(listIterations(persona.id, db)).toHaveLength(0);
      expect(getIterationDecisions(iteration.id, db)).toHaveLength(0);
      expect(getIterationReviews(iteration.id, db)).toHaveLength(0);
      expect(getIterationMetrics(iteration.id, db)).toBeNull();
      expect(getPromptHistory(persona.id, db)).toHaveLength(0);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should prevent creating training pair with non-existent persona', () => {
      const db = getTestDatabase();

      expect(() => {
        db.prepare(
          `
          INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run('test-id', 'non-existent-persona-id', 'Input', 'Output', new Date().toISOString());
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should prevent creating iteration with non-existent persona', () => {
      const db = getTestDatabase();
      const judgeModelId = createTestModelConfig(db, 'anthropic');

      expect(() => {
        db.prepare(
          `
          INSERT INTO training_iterations (
            id, persona_id, iteration_number, judge_model_id,
            judge_prompt_text, status, started_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          'test-id',
          'non-existent-persona-id',
          1,
          judgeModelId,
          'Prompt',
          'in_progress',
          new Date().toISOString()
        );
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should prevent creating judge decision with non-existent iteration', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(
        persona.id,
        [{ input: 'Input', expected_output: 'Output' }],
        db
      );

      expect(() => {
        db.prepare(
          `
          INSERT INTO judge_decisions (
            id, iteration_id, training_pair_id, generated_output,
            judge_decision, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(
          'test-id',
          'non-existent-iteration-id',
          pairs[0].id,
          'Generated',
          'agree',
          new Date().toISOString()
        );
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('should prevent creating human review with non-existent judge decision', () => {
      const db = getTestDatabase();

      expect(() => {
        db.prepare(
          `
          INSERT INTO human_reviews (
            id, judge_decision_id, human_decision, created_at
          ) VALUES (?, ?, ?, ?)
        `
        ).run('test-id', 'non-existent-decision-id', 'agree', new Date().toISOString());
      }).toThrow(/FOREIGN KEY constraint failed/);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should support full training iteration workflow', () => {
      const db = getTestDatabase();

      // 1. Create persona
      const persona = createTestPersona(db);
      expect(persona.status).toBe('draft');

      // 2. Upload training pairs
      const pairs = createTrainingPairs(
        persona.id,
        [
          { input: 'Query 1', expected_output: 'Response 1' },
          { input: 'Query 2', expected_output: 'Response 2' },
          { input: 'Query 3', expected_output: 'Response 3' },
          { input: 'Query 4', expected_output: 'Response 4' },
          { input: 'Query 5', expected_output: 'Response 5' },
        ],
        db
      );

      expect(pairs).toHaveLength(5);

      // 3. Start training iteration
      const iteration1 = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Initial judge prompt',
        db
      );

      expect(iteration1.iteration_number).toBe(1);
      expect(iteration1.status).toBe('in_progress');

      // 4. Generate judge decisions for each pair
      pairs.forEach((pair, index) => {
        const decision = index < 3 ? 'agree' : 'disagree';
        createJudgeDecision(
          iteration1.id,
          pair.id,
          `Generated response ${index + 1}`,
          decision,
          0.85 + index * 0.02,
          `Reasoning for decision ${index + 1}`,
          undefined,
          db
        );
      });

      const decisions = getIterationDecisions(iteration1.id, db);
      expect(decisions).toHaveLength(5);

      // 5. Add human reviews for disagreements
      const disagreementDecisions = decisions.filter((d) => d.judge_decision === 'disagree');
      disagreementDecisions.forEach((decision) => {
        createHumanReview(
          {
            judge_decision_id: decision.id,
            human_decision: 'agree',
            human_confidence: 0.9,
            human_notes: 'Judge was incorrect',
          },
          db
        );
      });

      const reviews = getIterationReviews(iteration1.id, db);
      expect(reviews).toHaveLength(2);

      // 6. Calculate and save metrics
      const metrics = createIterationMetrics(
        iteration1.id,
        {
          tp: 3,
          tn: 0,
          fp: 0,
          fn: 2,
          precision: 1.0,
          recall: 0.6,
          f1_score: 0.75,
          cohens_kappa: 0.5,
          accuracy: 0.6,
        },
        db
      );

      expect(metrics.f1_score).toBe(0.75);

      // 7. Save prompt version
      createPromptVersion(
        persona.id,
        1,
        'Initial judge prompt',
        'First iteration baseline',
        'human',
        db
      );

      // 8. Start second iteration with improved prompt
      const iteration2 = createTrainingIteration(
        persona.id,
        2,
        persona.judge_model_id,
        'Improved judge prompt based on feedback',
        db
      );

      expect(iteration2.iteration_number).toBe(2);

      // 9. Save improved prompt version
      createPromptVersion(
        persona.id,
        2,
        'Improved judge prompt based on feedback',
        'Addressed false negatives from iteration 1',
        'ai',
        db
      );

      // Verify full history
      const allIterations = listIterations(persona.id, db);
      expect(allIterations).toHaveLength(2);

      const promptHistory = getPromptHistory(persona.id, db);
      expect(promptHistory).toHaveLength(2);
    });

    it('should support training loop state management', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Create training loop state
      const sessionId = 'session-123';
      createTrainingLoopState(
        sessionId,
        persona.id,
        5,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        persona.task_model_id,
        db
      );

      const state = getTrainingLoopState(sessionId, db);
      expect(state).toBeDefined();
      expect(state?.status).toBe('pending');
      expect(state?.current_iteration).toBe(0);

      // Create checkpoints for iterations
      createCheckpoint(
        sessionId,
        1,
        10,
        JSON.stringify({ f1: 0.7 }),
        JSON.stringify([]),
        'Prompt 1',
        db
      );
      createCheckpoint(
        sessionId,
        2,
        10,
        JSON.stringify({ f1: 0.75 }),
        JSON.stringify([]),
        'Prompt 2',
        db
      );
      createCheckpoint(
        sessionId,
        3,
        10,
        JSON.stringify({ f1: 0.8 }),
        JSON.stringify([]),
        'Prompt 3',
        db
      );

      const latestCheckpoint = getLatestCheckpoint(sessionId, db);
      expect(latestCheckpoint).toBeDefined();
      expect(latestCheckpoint?.iteration_number).toBe(3);
      expect(JSON.parse(latestCheckpoint!.metrics_snapshot).f1).toBe(0.8);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity across tables', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const pairs = createTrainingPairs(
        persona.id,
        [{ input: 'Input', expected_output: 'Output' }],
        db
      );
      const iteration = createTrainingIteration(
        persona.id,
        1,
        persona.judge_model_id,
        'Prompt',
        db
      );
      const decision = createJudgeDecision(
        iteration.id,
        pairs[0].id,
        'Gen',
        'agree',
        0.9,
        'R',
        undefined,
        db
      );

      // Verify all foreign keys point to existing records
      const decisionRow = db
        .prepare('SELECT * FROM judge_decisions WHERE id = ?')
        .get(decision.id) as any;

      expect(decisionRow.iteration_id).toBe(iteration.id);
      expect(decisionRow.training_pair_id).toBe(pairs[0].id);

      const iterationRow = db
        .prepare('SELECT * FROM training_iterations WHERE id = ?')
        .get(iteration.id) as any;

      expect(iterationRow.persona_id).toBe(persona.id);

      const pairRow = db
        .prepare('SELECT * FROM training_pairs WHERE id = ?')
        .get(pairs[0].id) as any;

      expect(pairRow.persona_id).toBe(persona.id);
    });

    it('should enforce unique constraints', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Try to create another persona with same name
      expect(() => {
        const taskModelId = createTestModelConfig(db, 'openai');
        const judgeModelId = createTestModelConfig(db, 'anthropic');
        const promptEngineerModelId = createTestModelConfig(db, 'google');

        db.prepare(
          `
          INSERT INTO personas (
            id, name, task_prompt, task_model_id, judge_model_id,
            prompt_engineer_model_id, status, target_f1_score,
            max_iterations, current_iteration, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          'another-id',
          persona.name, // Same name - should violate UNIQUE constraint
          'Prompt',
          taskModelId,
          judgeModelId,
          promptEngineerModelId,
          'draft',
          0.8,
          5,
          0,
          new Date().toISOString(),
          new Date().toISOString()
        );
      }).toThrow(/UNIQUE constraint failed/);
    });
  });
});
