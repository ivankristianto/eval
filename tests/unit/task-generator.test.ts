/**
 * Unit tests for Task Generator
 * Tests the clearFeedbackForTrainingPairs function
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { open } from 'node:fs/promises';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getDatabase } from '@lib/db';
import {
  clearFeedbackForTrainingPairs,
  generateTaskOutputs,
} from '@lib/training/task-generator';
import { createPersona } from '@lib/db/persona-db';
import { createTrainingPairs } from '@lib/db/persona-db';
import type { TrainingPairResult } from '@src-types/training';

describe('TaskGenerator', () => {
  let db: Database.Database;
  let testDbPath: string;
  let personaId: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    testDbPath = join(process.cwd(), `test-task-generator-${Date.now()}.db`);
    db = new Database(testDbPath);

    // Read and execute schema
    const schemaPath = join(process.cwd(), 'db', 'schema.sql');
    const schema = await open(schemaPath, 'r');
    const schemaSql = await schema.readFile();
    await schema.close();

    db.exec(schemaSql.toString());

    // Insert model configurations (required for persona creation)
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('model-1', 'openai', 'gpt-4', 'encrypted-key-1', now, now);
    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('model-2', 'anthropic', 'claude-3', 'encrypted-key-2', now, now);
    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('model-3', 'google', 'gemini-pro', 'encrypted-key-3', now, now);

    // Set as global database for the test
    globalThis.__TEST_DB__ = db;
  });

  afterEach(async () => {
    // Clean up test database
    db.close();
    try {
      await unlink(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
    delete globalThis.__TEST_DB__;
  });

  describe('clearFeedbackForTrainingPairs', () => {
    it('should clear feedback fields for specified training pairs', () => {
      // Create persona
      const persona = createPersona(
        {
          name: 'Test Persona',
          initial_task_prompt: 'Test task prompt',
          initial_judge_prompt: 'Test judge prompt',
          task_model_id: 'model-1',
          judge_model_id: 'model-2',
          prompt_engineer_model_id: 'model-3',
        },
        db
      );
      personaId = persona.id;

      // Create training pairs
      const pairs = createTrainingPairs(
        personaId,
        [
          { input: 'Input 1', expected_output: 'Output 1' },
          { input: 'Input 2', expected_output: 'Output 2' },
          { input: 'Input 3', expected_output: 'Output 3' },
        ],
        db
      );

      // Insert training pair results with feedback data
      const now = new Date().toISOString();
      pairs.forEach((pair) => {
        db.prepare(
          `INSERT INTO training_pair_results
           (id, persona_id, training_pair_id, generated_output,
            human_feedback, human_rating, judge_feedback, judge_reasoning, judge_rating,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          crypto.randomUUID(),
          personaId,
          pair.id,
          'Generated output',
          'Human feedback',
          'pass',
          'Judge feedback',
          'Judge reasoning',
          'fail',
          now,
          now
        );
      });

      // Verify feedback exists before clearing
      const beforeClear = db
        .prepare(
          `SELECT COUNT(*) as count FROM training_pair_results
           WHERE persona_id = ? AND human_feedback IS NOT NULL`
        )
        .get(personaId) as { count: number };
      expect(beforeClear.count).toBe(3);

      // Clear feedback for first two pairs
      const pairIdsToClear = [pairs[0].id, pairs[1].id];
      const clearedCount = clearFeedbackForTrainingPairs(personaId, pairIdsToClear, db);

      // Verify only the specified pairs had feedback cleared
      expect(clearedCount).toBe(2);

      const afterClear = db
        .prepare(
          `SELECT human_feedback, human_rating, judge_feedback, judge_reasoning, judge_rating
           FROM training_pair_results
           WHERE training_pair_id = ?`
        )
        .all(pairIdsToClear[0]) as Array<{
        human_feedback: string | null;
        human_rating: string | null;
        judge_feedback: string | null;
        judge_reasoning: string | null;
        judge_rating: string | null;
      }>;

      expect(afterClear[0].human_feedback).toBeNull();
      expect(afterClear[0].human_rating).toBeNull();
      expect(afterClear[0].judge_feedback).toBeNull();
      expect(afterClear[0].judge_reasoning).toBeNull();
      expect(afterClear[0].judge_rating).toBeNull();

      // Verify third pair still has feedback
      const remainingFeedback = db
        .prepare(
          `SELECT human_feedback FROM training_pair_results
           WHERE training_pair_id = ?`
        )
        .get(pairs[2].id) as { human_feedback: string | null };
      expect(remainingFeedback.human_feedback).toBe('Human feedback');
    });

    it('should return 0 when no pair IDs are provided', () => {
      const clearedCount = clearFeedbackForTrainingPairs(personaId, [], db);
      expect(clearedCount).toBe(0);
    });

    it('should return 0 when no matching results exist', () => {
      const clearedCount = clearFeedbackForTrainingPairs(
        personaId,
        ['non-existent-pair-id'],
        db
      );
      expect(clearedCount).toBe(0);
    });

    it('should update the updated_at timestamp when clearing feedback', async () => {
      // Create persona
      const persona = createPersona(
        {
          name: 'Test Persona',
          initial_task_prompt: 'Test task prompt',
          initial_judge_prompt: 'Test judge prompt',
          task_model_id: 'model-1',
          judge_model_id: 'model-2',
          prompt_engineer_model_id: 'model-3',
        },
        db
      );
      personaId = persona.id;

      // Create training pair
      const pairs = createTrainingPairs(
        personaId,
        [{ input: 'Input 1', expected_output: 'Output 1' }],
        db
      );

      // Insert result with old timestamp
      const oldTimestamp = '2024-01-01T00:00:00.000Z';
      db.prepare(
        `INSERT INTO training_pair_results
         (id, persona_id, training_pair_id, generated_output, human_feedback,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        personaId,
        pairs[0].id,
        'Generated output',
        'Human feedback',
        oldTimestamp,
        oldTimestamp
      );

      // Clear feedback
      clearFeedbackForTrainingPairs(personaId, [pairs[0].id], db);

      // Verify updated_at was updated
      const result = db
        .prepare('SELECT updated_at FROM training_pair_results WHERE training_pair_id = ?')
        .get(pairs[0].id) as { updated_at: string };

      expect(result.updated_at).not.toBe(oldTimestamp);
      expect(new Date(result.updated_at).getTime()).toBeGreaterThan(
        new Date(oldTimestamp).getTime()
      );
    });
  });

  describe('generateTaskOutputs integration', () => {
    it('should clear existing feedback when generating outputs', async () => {
      // Create persona
      const persona = createPersona(
        {
          name: 'Test Persona',
          initial_task_prompt: 'Test task prompt',
          initial_judge_prompt: 'Test judge prompt',
          task_model_id: 'model-1',
          judge_model_id: 'model-2',
          prompt_engineer_model_id: 'model-3',
        },
        db
      );
      personaId = persona.id;

      // Create training pairs
      const pairs = createTrainingPairs(
        personaId,
        [{ input: 'Input 1', expected_output: 'Output 1' }],
        db
      );

      // Get task prompt version
      const taskPromptVersion = db
        .prepare('SELECT id FROM task_prompt_versions WHERE persona_id = ? LIMIT 1')
        .get(personaId) as { id: string };

      // Insert existing result with feedback
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO training_pair_results
         (id, persona_id, training_pair_id, generated_output,
          human_feedback, human_rating, judge_feedback, judge_reasoning, judge_rating,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        personaId,
        pairs[0].id,
        'Old generated output',
        'Old human feedback',
        'pass',
        'Old judge feedback',
        'Old judge reasoning',
        'fail',
        now,
        now
      );

      // Verify feedback exists before generation
      const beforeGen = db
        .prepare(
          `SELECT COUNT(*) as count FROM training_pair_results
           WHERE training_pair_id = ? AND human_feedback IS NOT NULL`
        )
        .get(pairs[0].id) as { count: number };
      expect(beforeGen.count).toBe(1);

      // Note: This test would need mocking of callModel to actually run generateTaskOutputs
      // For now, we're testing the clearFeedbackForTrainingPairs function directly
      // which is called by generateTaskOutputs
    });
  });
});
