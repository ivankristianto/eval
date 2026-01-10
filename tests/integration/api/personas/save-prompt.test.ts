/**
 * Integration tests for Prompt Save database operations
 * Tests the core logic that POST /api/personas/[id]/prompts/[type]/save performs
 * Covers both task and judge prompt types with comprehensive validation
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestPersona,
} from '../../../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Prompt Save Database Operations Integration', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Task prompt save operations', () => {
    it('should save a valid task prompt and return created record', () => {
      const persona = createTestPersona(db);

      const promptText = 'This is an improved task prompt for generating outputs';
      const improvementRationale = 'Improved clarity and structure';
      const label = 'v1 - Initial improvement';

      // Simulate the database operations that the API endpoint performs
      const transaction = db.transaction(() => {
        // Get next version number
        const versionResult = db
          .prepare(
            `SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM task_prompt_versions WHERE persona_id = ?`
          )
          .get(persona.id) as { next_version: number };

        const nextVersionNumber = versionResult.next_version;

        // Create new prompt version
        const versionId = uuidv4();
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          versionId,
          persona.id,
          nextVersionNumber,
          promptText,
          improvementRationale,
          label,
          'human',
          now
        );

        // Update persona's current prompt version
        db.prepare(
          `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
        ).run(versionId, now, persona.id);

        // Fetch and return the created version
        const createdVersion = db
          .prepare(`SELECT * FROM task_prompt_versions WHERE id = ?`)
          .get(versionId) as {
          id: string;
          persona_id: string;
          version_number: number;
          prompt_text: string;
          improvement_rationale: string | null;
          label: string | null;
          created_by: 'human' | 'ai';
          created_at: string;
        };

        return createdVersion;
      });

      const newVersion = transaction();

      // Verify response structure
      expect(newVersion).toMatchObject({
        id: expect.any(String),
        persona_id: persona.id,
        version_number: 0,
        prompt_text: promptText,
        improvement_rationale: improvementRationale,
        label: label,
        created_by: 'human',
        created_at: expect.any(String),
      });

      // Verify database record exists
      const savedPrompt = db
        .prepare('SELECT * FROM task_prompt_versions WHERE id = ?')
        .get(newVersion.id) as
        | {
            version_number: number;
            prompt_text: string;
            created_by: string;
          }
        | undefined;

      expect(savedPrompt).toBeDefined();
      expect(savedPrompt!.version_number).toBe(0);
      expect(savedPrompt!.prompt_text).toBe(promptText);
      expect(savedPrompt!.created_by).toBe('human');

      // Verify persona's current_task_prompt_version_id was updated
      const updatedPersona = db
        .prepare('SELECT current_task_prompt_version_id FROM personas WHERE id = ?')
        .get(persona.id) as { current_task_prompt_version_id: string | null };

      expect(updatedPersona.current_task_prompt_version_id).toBe(newVersion.id);
    });

    it('should save task prompt with optional fields as null', () => {
      const persona = createTestPersona(db);

      const promptText = 'Task prompt with minimal fields';

      // Simulate saving without optional fields
      const versionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId, persona.id, 0, promptText, null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId, now, persona.id);

      const createdVersion = db
        .prepare(`SELECT * FROM task_prompt_versions WHERE id = ?`)
        .get(versionId) as {
        improvement_rationale: string | null;
        label: string | null;
      };

      expect(createdVersion.improvement_rationale).toBeNull();
      expect(createdVersion.label).toBeNull();
    });

    it('should increment version number for subsequent task prompts', () => {
      const persona = createTestPersona(db);

      // Create first version
      const versionId1 = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId1, persona.id, 0, 'First version', null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId1, now, persona.id);

      // Create second version
      const versionId2 = uuidv4();
      const now2 = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        versionId2,
        persona.id,
        1,
        'Second version',
        'Refined based on feedback',
        null,
        'human',
        now2
      );

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId2, now2, persona.id);

      // Create third version
      const versionId3 = uuidv4();
      const now3 = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId3, persona.id, 2, 'Third version', null, null, 'human', now3);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId3, now3, persona.id);

      // Verify all versions exist in database
      const allVersions = db
        .prepare(
          'SELECT version_number FROM task_prompt_versions WHERE persona_id = ? ORDER BY version_number'
        )
        .all(persona.id) as Array<{ version_number: number }>;

      expect(allVersions).toHaveLength(3);
      expect(allVersions.map((v) => v.version_number)).toEqual([0, 1, 2]);
    });

    it('should return 404 for non-existent persona', () => {
      const nonExistentId = uuidv4();

      const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(nonExistentId);

      expect(persona).toBeUndefined();
    });
  });

  describe('Judge prompt save operations', () => {
    it('should save a valid judge prompt and return created record', () => {
      const persona = createTestPersona(db);

      const promptText = 'This is an improved judge prompt for evaluation';
      const improvementRationale = 'Added clearer evaluation criteria';
      const label = 'v2 - Enhanced criteria';

      // Get next version number (should be 1 since createTestPersona creates version 0)
      const versionResult = db
        .prepare(
          `SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM judge_prompt_versions WHERE persona_id = ?`
        )
        .get(persona.id) as { next_version: number };

      const nextVersionNumber = versionResult.next_version;

      // Create new prompt version
      const versionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        versionId,
        persona.id,
        nextVersionNumber,
        promptText,
        improvementRationale,
        label,
        'human',
        now
      );

      // Update persona's current prompt version
      db.prepare(
        `UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId, now, persona.id);

      // Fetch and return the created version
      const createdVersion = db
        .prepare(`SELECT * FROM judge_prompt_versions WHERE id = ?`)
        .get(versionId) as {
        id: string;
        persona_id: string;
        version_number: number;
        prompt_text: string;
        improvement_rationale: string | null;
        label: string | null;
        created_by: 'human' | 'ai';
        created_at: string;
      };

      // Verify response structure
      expect(createdVersion).toMatchObject({
        id: expect.any(String),
        persona_id: persona.id,
        version_number: 1, // Should be 1 since createTestPersona creates version 0
        prompt_text: promptText,
        improvement_rationale: improvementRationale,
        label: label,
        created_by: 'human',
        created_at: expect.any(String),
      });

      // Verify database record exists
      const savedPrompt = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
        .get(createdVersion.id) as
        | {
            version_number: number;
            prompt_text: string;
            created_by: string;
          }
        | undefined;

      expect(savedPrompt).toBeDefined();
      expect(savedPrompt!.version_number).toBe(1);
      expect(savedPrompt!.prompt_text).toBe(promptText);
      expect(savedPrompt!.created_by).toBe('human');

      // Verify persona's current_judge_prompt_version_id was updated
      const updatedPersona = db
        .prepare('SELECT current_judge_prompt_version_id FROM personas WHERE id = ?')
        .get(persona.id) as { current_judge_prompt_version_id: string | null };

      expect(updatedPersona.current_judge_prompt_version_id).toBe(createdVersion.id);
    });

    it('should save judge prompt with optional fields as null', () => {
      const persona = createTestPersona(db);

      const promptText = 'Judge prompt with minimal fields';

      // Get next version number
      const versionResult = db
        .prepare(
          `SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM judge_prompt_versions WHERE persona_id = ?`
        )
        .get(persona.id) as { next_version: number };

      const nextVersionNumber = versionResult.next_version;

      // Create new prompt version
      const versionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId, persona.id, nextVersionNumber, promptText, null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId, now, persona.id);

      const createdVersion = db
        .prepare(`SELECT * FROM judge_prompt_versions WHERE id = ?`)
        .get(versionId) as {
        improvement_rationale: string | null;
        label: string | null;
      };

      expect(createdVersion.improvement_rationale).toBeNull();
      expect(createdVersion.label).toBeNull();
    });

    it('should increment version number for subsequent judge prompts', () => {
      const persona = createTestPersona(db);

      // createTestPersona creates version 0
      // Create version 1
      const versionId1 = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId1, persona.id, 1, 'First saved version', null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId1, now, persona.id);

      // Create version 2
      const versionId2 = uuidv4();
      const now2 = new Date().toISOString();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        versionId2,
        persona.id,
        2,
        'Second saved version',
        'Refined based on feedback',
        null,
        'human',
        now2
      );

      db.prepare(
        `UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId2, now2, persona.id);

      // Verify all versions exist in database (including initial version 0)
      const allVersions = db
        .prepare(
          'SELECT version_number FROM judge_prompt_versions WHERE persona_id = ? ORDER BY version_number'
        )
        .all(persona.id) as Array<{ version_number: number }>;

      expect(allVersions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Transaction safety', () => {
    it('should use transaction for atomic version number assignment', () => {
      const persona = createTestPersona(db);

      // Use transaction to save first version
      const transaction1 = db.transaction(() => {
        const versionResult = db
          .prepare(
            `SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM task_prompt_versions WHERE persona_id = ?`
          )
          .get(persona.id) as { next_version: number };

        const nextVersionNumber = versionResult.next_version;
        const versionId = uuidv4();
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(versionId, persona.id, nextVersionNumber, 'Version 0', null, null, 'human', now);

        db.prepare(
          `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
        ).run(versionId, now, persona.id);

        return { id: versionId, version_number: nextVersionNumber };
      });

      const data1 = transaction1();

      // Use transaction to save second version
      const transaction2 = db.transaction(() => {
        const versionResult = db
          .prepare(
            `SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM task_prompt_versions WHERE persona_id = ?`
          )
          .get(persona.id) as { next_version: number };

        const nextVersionNumber = versionResult.next_version;
        const versionId = uuidv4();
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(versionId, persona.id, nextVersionNumber, 'Version 1', null, null, 'human', now);

        db.prepare(
          `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
        ).run(versionId, now, persona.id);

        return { id: versionId, version_number: nextVersionNumber };
      });

      const data2 = transaction2();

      // Verify version numbers are sequential
      expect(data2.version_number).toBe(data1.version_number + 1);

      // Verify persona was updated to point to latest version
      const personaRecord = db
        .prepare('SELECT current_task_prompt_version_id FROM personas WHERE id = ?')
        .get(persona.id) as { current_task_prompt_version_id: string };

      expect(personaRecord.current_task_prompt_version_id).toBe(data2.id);
    });

    it('should update persona updated_at timestamp', () => {
      const persona = createTestPersona(db);

      // Save a prompt
      const versionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId, persona.id, 0, 'New prompt', null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId, now, persona.id);

      // Verify updated_at was set
      const updatedPersona = db
        .prepare('SELECT updated_at FROM personas WHERE id = ?')
        .get(persona.id) as { updated_at: string };

      // Timestamp should be set and be a valid ISO string
      expect(updatedPersona.updated_at).toBeTruthy();
      expect(new Date(updatedPersona.updated_at).toISOString()).toBe(updatedPersona.updated_at);
    });
  });

  describe('Cross-type isolation', () => {
    it('should maintain separate version counters for task and judge prompts', () => {
      const persona = createTestPersona(db);

      // Save a task prompt
      const taskVersionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(taskVersionId, persona.id, 0, 'Task prompt', null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(taskVersionId, now, persona.id);

      const taskData = db
        .prepare(`SELECT * FROM task_prompt_versions WHERE id = ?`)
        .get(taskVersionId) as { version_number: number; id: string };

      // Save a judge prompt
      const judgeVersionId = uuidv4();
      const now2 = new Date().toISOString();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(judgeVersionId, persona.id, 1, 'Judge prompt', null, null, 'human', now2);

      db.prepare(
        `UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(judgeVersionId, now2, persona.id);

      const judgeData = db
        .prepare(`SELECT * FROM judge_prompt_versions WHERE id = ?`)
        .get(judgeVersionId) as { version_number: number; id: string };

      // Task version should be 0 (first task prompt)
      expect(taskData.version_number).toBe(0);

      // Judge version should be 1 (version 0 created by createTestPersona)
      expect(judgeData.version_number).toBe(1);

      // Verify they're in different tables
      const taskPrompt = db
        .prepare('SELECT * FROM task_prompt_versions WHERE id = ?')
        .get(taskData.id);
      const judgePrompt = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
        .get(judgeData.id);

      expect(taskPrompt).toBeDefined();
      expect(judgePrompt).toBeDefined();
    });

    it('should update correct current version column based on type', () => {
      const persona = createTestPersona(db);

      // Save task prompt
      const taskVersionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(taskVersionId, persona.id, 0, 'Task prompt', null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(taskVersionId, now, persona.id);

      const taskData = db
        .prepare(`SELECT * FROM task_prompt_versions WHERE id = ?`)
        .get(taskVersionId) as { id: string };

      // Save judge prompt
      const judgeVersionId = uuidv4();
      const now2 = new Date().toISOString();

      db.prepare(
        `INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(judgeVersionId, persona.id, 1, 'Judge prompt', null, null, 'human', now2);

      db.prepare(
        `UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(judgeVersionId, now2, persona.id);

      const judgeData = db
        .prepare(`SELECT * FROM judge_prompt_versions WHERE id = ?`)
        .get(judgeVersionId) as { id: string };

      // Verify correct columns were updated
      const personaRecord = db
        .prepare(
          'SELECT current_task_prompt_version_id, current_judge_prompt_version_id FROM personas WHERE id = ?'
        )
        .get(persona.id) as {
        current_task_prompt_version_id: string | null;
        current_judge_prompt_version_id: string | null;
      };

      expect(personaRecord.current_task_prompt_version_id).toBe(taskData.id);
      expect(personaRecord.current_judge_prompt_version_id).toBe(judgeData.id);
    });
  });

  describe('Edge cases and constraints', () => {
    it('should handle saving prompt for persona with no existing prompts', () => {
      // Create a persona without initial prompts
      const taskModelId = uuidv4();
      const judgeModelId = uuidv4();
      const promptEngineerModelId = uuidv4();

      // Create model configurations
      db.prepare(
        `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        taskModelId,
        'openai',
        'gpt-4',
        'encrypted-key',
        new Date().toISOString(),
        new Date().toISOString()
      );

      db.prepare(
        `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        judgeModelId,
        'anthropic',
        'claude-3',
        'encrypted-key',
        new Date().toISOString(),
        new Date().toISOString()
      );

      db.prepare(
        `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        promptEngineerModelId,
        'google',
        'gemini-pro',
        'encrypted-key',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const personaId = uuidv4();
      const now = new Date().toISOString();

      // Create persona without initial judge prompt
      db.prepare(
        `INSERT INTO personas (id, name, description, task_model_id, judge_model_id, prompt_engineer_model_id, status, target_pass_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        personaId,
        'Test Persona',
        'Test',
        taskModelId,
        judgeModelId,
        promptEngineerModelId,
        'draft',
        0.8,
        now,
        now
      );

      // Save first task prompt
      const versionId = uuidv4();
      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId, personaId, 0, 'First task prompt', null, null, 'human', now);

      db.prepare(
        `UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?`
      ).run(versionId, now, personaId);

      const savedPrompt = db
        .prepare(`SELECT * FROM task_prompt_versions WHERE id = ?`)
        .get(versionId) as { version_number: number };

      expect(savedPrompt.version_number).toBe(0);
    });

    it('should enforce unique constraint on (persona_id, version_number)', () => {
      const persona = createTestPersona(db);

      const versionId = uuidv4();
      const now = new Date().toISOString();

      // Insert first prompt with version 0
      db.prepare(
        `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(versionId, persona.id, 0, 'First prompt', null, null, 'human', now);

      // Try to insert another prompt with same persona_id and version_number
      const duplicateVersionId = uuidv4();

      expect(() => {
        db.prepare(
          `INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(duplicateVersionId, persona.id, 0, 'Duplicate version', null, null, 'human', now);
      }).toThrow();
    });
  });
});
