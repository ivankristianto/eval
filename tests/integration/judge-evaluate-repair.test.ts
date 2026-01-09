/**
 * Integration tests for Judge Evaluate API with auto-repair functionality
 * Tests repair transaction logic for personas with NULL current_judge_prompt_version_id
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestPersona,
  createTestModelConfig,
} from '../setup';
import { v4 as uuidv4 } from 'uuid';
import { repairJudgePromptVersion, type RepairResult } from '@lib/training/persona-repair';

// No API client mocks needed for repair function tests

describe('Judge Evaluate Auto-Repair', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
    vi.clearAllMocks();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('repairJudgePromptVersion', () => {
    it('should repair persona when version 0 exists', () => {
      const db = getTestDatabase();

      // Create persona with initial judge prompt version
      const persona = createPersonaWithInitialPrompt(db);
      const initialVersionId = getInitialJudgePromptVersionId(db, persona.id);

      // Set current_judge_prompt_version_id to NULL to simulate broken state
      db.prepare('UPDATE personas SET current_judge_prompt_version_id = NULL WHERE id = ?').run(
        persona.id
      );

      // Verify broken state
      const personaBefore = db
        .prepare('SELECT current_judge_prompt_version_id FROM personas WHERE id = ?')
        .get(persona.id) as { current_judge_prompt_version_id: string | null };
      expect(personaBefore.current_judge_prompt_version_id).toBeNull();

      // Run repair
      const result = repairJudgePromptVersion(db, { personaId: persona.id });

      // Verify repair succeeded
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.versionId).toBe(initialVersionId);
        expect(result.wasRepaired).toBe(true);
      }

      // Verify database state
      const personaAfter = db
        .prepare('SELECT current_judge_prompt_version_id FROM personas WHERE id = ?')
        .get(persona.id) as { current_judge_prompt_version_id: string };
      expect(personaAfter.current_judge_prompt_version_id).toBe(initialVersionId);
    });

    it('should return existing version when already repaired (concurrent request safety)', () => {
      const db = getTestDatabase();

      // Create persona with initial judge prompt version
      const persona = createPersonaWithInitialPrompt(db);
      const initialVersionId = getInitialJudgePromptVersionId(db, persona.id);

      // First repair
      const result1 = repairJudgePromptVersion(db, { personaId: persona.id });
      expect(result1.success).toBe(true);

      // Second "concurrent" repair (simulates another request hitting after first completed)
      const result2 = repairJudgePromptVersion(db, { personaId: persona.id });
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.versionId).toBe(initialVersionId);
        expect(result2.wasRepaired).toBe(false); // Already repaired, not repaired by this call
      }
    });

    it('should create new version when promptText provided after repair', () => {
      const db = getTestDatabase();

      // Create persona with initial judge prompt version
      const persona = createPersonaWithInitialPrompt(db);

      // Set current_judge_prompt_version_id to NULL
      db.prepare('UPDATE personas SET current_judge_prompt_version_id = NULL WHERE id = ?').run(
        persona.id
      );

      // Run repair with new prompt text
      const newPromptText = 'This is a new judge prompt for testing';
      const result = repairJudgePromptVersion(db, {
        personaId: persona.id,
        promptText: newPromptText,
      });

      // Verify repair succeeded with new version
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.versionId).not.toBe(getInitialJudgePromptVersionId(db, persona.id));
        expect(result.wasRepaired).toBe(true);

        // Verify the new version was created with the provided text
        const newVersion = db
          .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
          .get(result.versionId) as { prompt_text: string; version_number: number };
        expect(newVersion.prompt_text).toBe(newPromptText);
        expect(newVersion.version_number).toBe(1); // Should be version 1
      }
    });

    it('should fail when version 0 does not exist', () => {
      const db = getTestDatabase();

      // Create persona without initial prompt versions
      const persona = createPersonaWithoutPrompts(db);

      const result = repairJudgePromptVersion(db, { personaId: persona.id });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('version_0_missing');
      }
    });

    it('should handle concurrent repair requests correctly', () => {
      const db = getTestDatabase();

      // Create persona with initial judge prompt version
      const persona = createPersonaWithInitialPrompt(db);
      const initialVersionId = getInitialJudgePromptVersionId(db, persona.id);

      // Set current_judge_prompt_version_id to NULL
      db.prepare('UPDATE personas SET current_judge_prompt_version_id = NULL WHERE id = ?').run(
        persona.id
      );

      // Simulate concurrent requests
      const results: RepairResult[] = [];
      const concurrentCount = 5;

      for (let i = 0; i < concurrentCount; i++) {
        results.push(repairJudgePromptVersion(db, { personaId: persona.id }));
      }

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Only first should have wasRepaired: true, rest should have wasRepaired: false
      const repairedCount = results.filter((r) => r.success && r.wasRepaired === true).length;
      expect(repairedCount).toBe(1);

      // All should point to the same version
      const versionIds = new Set(
        results
          .filter((r) => r.success)
          .map((r) => (r as { success: true; versionId: string }).versionId)
      );
      expect(versionIds.size).toBe(1);
      expect(versionIds.has(initialVersionId)).toBe(true);
    });

    it('should verify updated_at timestamp is set on repair', () => {
      const db = getTestDatabase();

      // Create persona with initial judge prompt version
      const persona = createPersonaWithInitialPrompt(db);

      // Get original updated_at
      const personaBefore = db
        .prepare('SELECT updated_at FROM personas WHERE id = ?')
        .get(persona.id) as { updated_at: string };
      const originalUpdatedAt = new Date(personaBefore.updated_at);

      // Wait a bit to ensure timestamp difference
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Small delay
      }

      // Set current_judge_prompt_version_id to NULL and repair
      db.prepare('UPDATE personas SET current_judge_prompt_version_id = NULL WHERE id = ?').run(
        persona.id
      );

      repairJudgePromptVersion(db, { personaId: persona.id });

      // Verify updated_at was modified
      const personaAfter = db
        .prepare('SELECT updated_at FROM personas WHERE id = ?')
        .get(persona.id) as { updated_at: string };
      const newUpdatedAt = new Date(personaAfter.updated_at);

      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  // Helper functions
  function createPersonaWithInitialPrompt(db: Database): {
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
    const initialJudgePromptId = uuidv4();

    // Create persona
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

    // Create initial judge prompt version (v0)
    db.prepare(
      `
      INSERT INTO judge_prompt_versions (
        id, persona_id, version_number, prompt_text,
        improvement_rationale, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      initialJudgePromptId,
      id,
      0,
      'Initial judge prompt for testing',
      'Initial judge prompt provided during persona creation',
      'human',
      now
    );

    // Link to persona
    db.prepare('UPDATE personas SET current_judge_prompt_version_id = ? WHERE id = ?').run(
      initialJudgePromptId,
      id
    );

    return {
      id,
      task_model_id: taskModelId,
      judge_model_id: judgeModelId,
      prompt_engineer_model_id: promptEngineerModelId,
    };
  }

  function createPersonaWithoutPrompts(db: Database): {
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

    // Create persona without any prompt versions
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

  function getInitialJudgePromptVersionId(db: Database, personaId: string): string {
    const result = db
      .prepare('SELECT id FROM judge_prompt_versions WHERE persona_id = ? AND version_number = 0')
      .get(personaId) as { id: string } | undefined;
    if (!result) {
      throw new Error('Initial judge prompt version not found');
    }
    return result.id;
  }
});
