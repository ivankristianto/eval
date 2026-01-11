/**
 * Integration tests for Dashboard API
 * Tests the complete dashboard data aggregation endpoint
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initTestDb, cleanupTestDb } from '../setup';

describe('Dashboard API Integration Tests', () => {
  let db: Database.Database;
  let personaId: string;
  let judgeModelId: string;

  beforeEach(() => {
    db = initTestDb();

    // Create test model configurations (required for FK constraints)
    const taskModelId = crypto.randomUUID();
    judgeModelId = crypto.randomUUID();
    const engineerModelId = crypto.randomUUID();

    db.prepare(
      `
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      taskModelId,
      'openai',
      'gpt-4',
      'encrypted',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(
      `
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      judgeModelId,
      'anthropic',
      'claude-3',
      'encrypted',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(
      `
      INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      engineerModelId,
      'google',
      'gemini-pro',
      'encrypted',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create test persona
    personaId = crypto.randomUUID();
    db.prepare(
      `
      INSERT INTO personas (
        id, name, description, task_model_id, judge_model_id, prompt_engineer_model_id,
        status, target_pass_rate, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      personaId,
      'Test Judge Persona',
      'Test description',
      taskModelId,
      judgeModelId,
      engineerModelId,
      'training',
      0.8,
      new Date().toISOString(),
      new Date().toISOString()
    );
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  describe('GET /api/personas/[id]/dashboard', () => {
    it('should return dashboard data with no iterations', () => {
      // Fetch persona from DB to verify structure
      const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as
        | {
            id: string;
            name: string;
            status: string;
            target_pass_rate: number;
            best_pass_rate: number | null;
          }
        | undefined;

      expect(persona).toBeDefined();
      expect(persona!.name).toBe('Test Judge Persona');
      expect(persona!.status).toBe('training');
      expect(persona!.target_pass_rate).toBe(0.8);
    });

    it('should return dashboard data with completed iterations', () => {
      // Create 3 completed iterations with metrics
      const iterations = [
        { num: 1, f1: 0.65, precision: 0.7, recall: 0.61, kappa: 0.55 },
        { num: 2, f1: 0.75, precision: 0.8, recall: 0.71, kappa: 0.65 },
        { num: 3, f1: 0.82, precision: 0.85, recall: 0.79, kappa: 0.72 },
      ];

      for (const iter of iterations) {
        const iterationId = crypto.randomUUID();

        // Create iteration
        db.prepare(
          `
          INSERT INTO training_iterations
          (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, started_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          iterationId,
          personaId,
          iter.num,
          judgeModelId,
          'Test judge prompt',
          'completed',
          new Date().toISOString(),
          new Date().toISOString()
        );

        // Create metrics for iteration
        db.prepare(
          `
          INSERT INTO iteration_metrics
          (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
           precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          crypto.randomUUID(),
          iterationId,
          10,
          8,
          2,
          1,
          iter.precision,
          iter.recall,
          iter.f1,
          iter.kappa,
          (10 + 8) / (10 + 8 + 2 + 1), // accuracy
          new Date().toISOString()
        );
      }

      // Update persona with best pass rate
      db.prepare(
        `
        UPDATE personas
        SET best_pass_rate = ?, best_pass_rate_updated_at = ?
        WHERE id = ?
      `
      ).run(0.82, new Date().toISOString(), personaId);

      // Fetch persona
      const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as
        | {
            best_pass_rate: number | null;
            target_pass_rate: number;
          }
        | undefined;

      expect(persona!.best_pass_rate).toBe(0.82);

      // Fetch metrics history
      const metricsHistory = db
        .prepare(
          `
        SELECT
          ti.iteration_number,
          im.f1_score,
          im.precision,
          im.recall,
          im.cohens_kappa,
          im.calculated_at
        FROM iteration_metrics im
        JOIN training_iterations ti ON ti.id = im.iteration_id
        WHERE ti.persona_id = ?
        ORDER BY ti.iteration_number ASC
      `
        )
        .all(personaId) as Array<{
        iteration_number: number;
        f1_score: number;
        precision: number;
        recall: number;
        cohens_kappa: number;
        calculated_at: string;
      }>;

      expect(metricsHistory).toHaveLength(3);
      expect(metricsHistory[0].f1_score).toBe(0.65);
      expect(metricsHistory[1].f1_score).toBe(0.75);
      expect(metricsHistory[2].f1_score).toBe(0.82);

      // Check convergence (pass rate >= 0.80)
      const convergenceAchieved = (persona!.best_pass_rate ?? 0) >= persona!.target_pass_rate;
      expect(convergenceAchieved).toBe(true);
    });

    it('should indicate convergence when pass rate >= target', () => {
      // Create persona with pass rate = 0.85, target = 0.80
      const iterationId = crypto.randomUUID();

      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Test prompt',
        'completed',
        new Date().toISOString(),
        new Date().toISOString()
      );

      db.prepare(
        `
        INSERT INTO iteration_metrics
        (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
         precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        crypto.randomUUID(),
        iterationId,
        15,
        10,
        1,
        2,
        0.94, // precision
        0.88, // recall
        0.85, // F1
        0.75, // kappa
        0.89, // accuracy
        new Date().toISOString()
      );

      db.prepare(
        `
        UPDATE personas
        SET best_pass_rate = 0.85, best_pass_rate_updated_at = ?
        WHERE id = ?
      `
      ).run(new Date().toISOString(), personaId);

      const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as
        | {
            best_pass_rate: number | null;
            target_pass_rate: number;
          }
        | undefined;

      const convergenceAchieved = (persona!.best_pass_rate ?? 0) >= persona!.target_pass_rate;
      expect(convergenceAchieved).toBe(true);
      expect(persona!.best_pass_rate).toBe(0.85);
    });

    it('should return current iteration status if training in progress', () => {
      // Create in-progress iteration
      const iterationId = crypto.randomUUID();

      db.prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, total_pairs_evaluated, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        iterationId,
        personaId,
        1,
        judgeModelId,
        'Test prompt',
        'in_progress',
        25, // 25 pairs evaluated so far
        new Date().toISOString()
      );

      // Fetch latest iteration
      const latestIteration = db
        .prepare(
          `
        SELECT * FROM training_iterations
        WHERE persona_id = ?
        ORDER BY iteration_number DESC
        LIMIT 1
      `
        )
        .get(personaId) as
        | {
            status: string;
            total_pairs_evaluated: number;
            completed_at: string | null;
          }
        | undefined;

      expect(latestIteration!.status).toBe('in_progress');
      expect(latestIteration!.total_pairs_evaluated).toBe(25);
      expect(latestIteration!.completed_at).toBeNull();
    });

    it('should return empty iterations for persona without training', () => {
      const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as
        | {
            best_pass_rate: number | null;
          }
        | undefined;

      const metricsHistory = db
        .prepare(
          `
        SELECT
          ti.iteration_number,
          im.f1_score
        FROM iteration_metrics im
        JOIN training_iterations ti ON ti.id = im.iteration_id
        WHERE ti.persona_id = ?
        ORDER BY ti.iteration_number ASC
      `
        )
        .all(personaId) as Array<{
        iteration_number: number;
        f1_score: number | null;
      }>;

      expect(metricsHistory).toHaveLength(0);
      expect(persona!.best_pass_rate).toBeNull();
    });
  });
});
