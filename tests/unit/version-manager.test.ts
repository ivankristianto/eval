/**
 * Unit tests for version manager
 * Tests auto-increment logic, create/get/list functions, version deduplication
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  createTaskPromptVersion,
  createJudgePromptVersion,
  getTaskPromptVersion,
  getJudgePromptVersion,
  getTaskPromptVersionByNumber,
  getJudgePromptVersionByNumber,
  listTaskPromptVersions,
  listJudgePromptVersions,
  getCurrentTaskPromptVersion,
  getCurrentJudgePromptVersion,
  getNextTaskVersionNumber,
  getNextJudgeVersionNumber,
  deleteTaskPromptVersion,
  deleteJudgePromptVersion,
} from '@lib/training/version-manager';
import type { TaskPromptVersion, JudgePromptVersion } from '@src-types/training';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
} from '../setup';

/**
 * Helper function to create a test persona with the current schema
 */
function createTestPersona(db: Database): { id: string } {
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

  return { id };
}

describe('Version Manager', () => {
  let db: Database;
  let personaId: string;

  beforeAll(() => {
    initializeTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();

    // Clean up before each test
    cleanTestDatabase();

    // Create test model configurations
    createTestModelConfig(db, 'openai');
    createTestModelConfig(db, 'anthropic');
    createTestModelConfig(db, 'google');

    // Create test persona
    const persona = createTestPersona(db);
    personaId = persona.id;
  });

  afterEach(() => {
    // Clean up after each test
    cleanTestDatabase();
  });

  describe('Task Prompt Version - Auto-Increment', () => {
    it('should assign version number 1 to first task prompt version', () => {
      const version = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First task prompt',
          created_by: 'human',
        },
        db
      );

      expect(version.version_number).toBe(1);
    });

    it('should auto-increment version numbers for subsequent task prompt versions', () => {
      const v1 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First task prompt',
          created_by: 'human',
        },
        db
      );

      const v2 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second task prompt',
          created_by: 'ai',
        },
        db
      );

      const v3 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third task prompt',
          created_by: 'human',
        },
        db
      );

      expect(v1.version_number).toBe(1);
      expect(v2.version_number).toBe(2);
      expect(v3.version_number).toBe(3);
    });

    it('should have independent version counters for different personas', () => {
      // Create second persona
      const persona2 = createTestPersona(db, {
        name: 'Second Persona',
        description: 'Another test persona',
        task_prompt: 'Different task prompt',
        initial_judge_prompt: 'Different judge prompt',
      });

      // Create versions for first persona
      const v1a = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Persona 1 - v1',
          created_by: 'human',
        },
        db
      );

      const v1b = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Persona 1 - v2',
          created_by: 'human',
        },
        db
      );

      // Create versions for second persona
      const v2a = createTaskPromptVersion(
        {
          persona_id: persona2.id,
          prompt_text: 'Persona 2 - v1',
          created_by: 'human',
        },
        db
      );

      const v2b = createTaskPromptVersion(
        {
          persona_id: persona2.id,
          prompt_text: 'Persona 2 - v2',
          created_by: 'human',
        },
        db
      );

      const v2c = createTaskPromptVersion(
        {
          persona_id: persona2.id,
          prompt_text: 'Persona 2 - v3',
          created_by: 'human',
        },
        db
      );

      expect(v1a.version_number).toBe(1);
      expect(v1b.version_number).toBe(2);
      expect(v2a.version_number).toBe(1);
      expect(v2b.version_number).toBe(2);
      expect(v2c.version_number).toBe(3);
    });
  });

  describe('Judge Prompt Version - Auto-Increment', () => {
    it('should assign version number 1 to first judge prompt version', () => {
      const version = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First judge prompt',
          created_by: 'human',
        },
        db
      );

      expect(version.version_number).toBe(1);
    });

    it('should auto-increment version numbers for subsequent judge prompt versions', () => {
      const v1 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First judge prompt',
          created_by: 'human',
        },
        db
      );

      const v2 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second judge prompt',
          created_by: 'ai',
        },
        db
      );

      const v3 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third judge prompt',
          created_by: 'human',
        },
        db
      );

      expect(v1.version_number).toBe(1);
      expect(v2.version_number).toBe(2);
      expect(v3.version_number).toBe(3);
    });

    it('should have independent version counters for different personas', () => {
      // Create second persona
      const persona2 = createTestPersona(db, {
        name: 'Second Persona',
        description: 'Another test persona',
        task_prompt: 'Different task prompt',
        initial_judge_prompt: 'Different judge prompt',
      });

      // Create versions for first persona
      const v1a = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Persona 1 - v1',
          created_by: 'human',
        },
        db
      );

      const v1b = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Persona 1 - v2',
          created_by: 'human',
        },
        db
      );

      // Create versions for second persona
      const v2a = createJudgePromptVersion(
        {
          persona_id: persona2.id,
          prompt_text: 'Persona 2 - v1',
          created_by: 'human',
        },
        db
      );

      const v2b = createJudgePromptVersion(
        {
          persona_id: persona2.id,
          prompt_text: 'Persona 2 - v2',
          created_by: 'human',
        },
        db
      );

      const v2c = createJudgePromptVersion(
        {
          persona_id: persona2.id,
          prompt_text: 'Persona 2 - v3',
          created_by: 'human',
        },
        db
      );

      expect(v1a.version_number).toBe(1);
      expect(v1b.version_number).toBe(2);
      expect(v2a.version_number).toBe(1);
      expect(v2b.version_number).toBe(2);
      expect(v2c.version_number).toBe(3);
    });
  });

  describe('Task Prompt Version - Create', () => {
    it('should create task prompt version with all fields', () => {
      const version = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test task prompt',
          improvement_rationale: 'Improved clarity',
          label: 'v1.0',
          created_by: 'human',
        },
        db
      );

      expect(version.id).toBeDefined();
      expect(version.persona_id).toBe(personaId);
      expect(version.prompt_text).toBe('Test task prompt');
      expect(version.improvement_rationale).toBe('Improved clarity');
      expect(version.label).toBe('v1.0');
      expect(version.created_by).toBe('human');
      expect(version.created_at).toBeDefined();
    });

    it('should create task prompt version with null optional fields', () => {
      const version = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test task prompt',
          created_by: 'ai',
        },
        db
      );

      expect(version.improvement_rationale).toBeNull();
      expect(version.label).toBeNull();
      expect(version.created_by).toBe('ai');
    });

    it('should update persona current_task_prompt_version_id', () => {
      const version = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test task prompt',
          created_by: 'human',
        },
        db
      );

      const persona = db
        .prepare('SELECT current_task_prompt_version_id FROM personas WHERE id = ?')
        .get(personaId) as { current_task_prompt_version_id: string };

      expect(persona.current_task_prompt_version_id).toBe(version.id);
    });

    it('should throw error if persona not found', () => {
      expect(() =>
        createTaskPromptVersion(
          {
            persona_id: 'non-existent-persona',
            prompt_text: 'Test task prompt',
            created_by: 'human',
          },
          db
        )
      ).toThrow('Persona not found');
    });
  });

  describe('Judge Prompt Version - Create', () => {
    it('should create judge prompt version with all fields', () => {
      const version = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test judge prompt',
          improvement_rationale: 'Better evaluation criteria',
          label: 'v1.0',
          created_by: 'human',
        },
        db
      );

      expect(version.id).toBeDefined();
      expect(version.persona_id).toBe(personaId);
      expect(version.prompt_text).toBe('Test judge prompt');
      expect(version.improvement_rationale).toBe('Better evaluation criteria');
      expect(version.label).toBe('v1.0');
      expect(version.created_by).toBe('human');
      expect(version.created_at).toBeDefined();
    });

    it('should create judge prompt version with null optional fields', () => {
      const version = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test judge prompt',
          created_by: 'ai',
        },
        db
      );

      expect(version.improvement_rationale).toBeNull();
      expect(version.label).toBeNull();
      expect(version.created_by).toBe('ai');
    });

    it('should update persona current_judge_prompt_version_id', () => {
      const version = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test judge prompt',
          created_by: 'human',
        },
        db
      );

      const persona = db
        .prepare('SELECT current_judge_prompt_version_id FROM personas WHERE id = ?')
        .get(personaId) as { current_judge_prompt_version_id: string };

      expect(persona.current_judge_prompt_version_id).toBe(version.id);
    });

    it('should throw error if persona not found', () => {
      expect(() =>
        createJudgePromptVersion(
          {
            persona_id: 'non-existent-persona',
            prompt_text: 'Test judge prompt',
            created_by: 'human',
          },
          db
        )
      ).toThrow('Persona not found');
    });
  });

  describe('Get Version by ID', () => {
    it('should get task prompt version by ID', () => {
      const created = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test task prompt',
          created_by: 'human',
        },
        db
      );

      const retrieved = getTaskPromptVersion(created.id, db);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.prompt_text).toBe('Test task prompt');
    });

    it('should get judge prompt version by ID', () => {
      const created = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Test judge prompt',
          created_by: 'human',
        },
        db
      );

      const retrieved = getJudgePromptVersion(created.id, db);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.prompt_text).toBe('Test judge prompt');
    });

    it('should return null for non-existent task prompt version', () => {
      const retrieved = getTaskPromptVersion('non-existent-id', db);
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent judge prompt version', () => {
      const retrieved = getJudgePromptVersion('non-existent-id', db);
      expect(retrieved).toBeNull();
    });
  });

  describe('Get Version by Number', () => {
    it('should get task prompt version by persona and version number', () => {
      createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First task prompt',
          created_by: 'human',
        },
        db
      );

      createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second task prompt',
          created_by: 'human',
        },
        db
      );

      const retrieved = getTaskPromptVersionByNumber(personaId, 2, db);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.version_number).toBe(2);
      expect(retrieved!.prompt_text).toBe('Second task prompt');
    });

    it('should get judge prompt version by persona and version number', () => {
      createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First judge prompt',
          created_by: 'human',
        },
        db
      );

      createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second judge prompt',
          created_by: 'human',
        },
        db
      );

      const retrieved = getJudgePromptVersionByNumber(personaId, 2, db);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.version_number).toBe(2);
      expect(retrieved!.prompt_text).toBe('Second judge prompt');
    });

    it('should return null for non-existent version number', () => {
      const retrieved = getTaskPromptVersionByNumber(personaId, 999, db);
      expect(retrieved).toBeNull();
    });
  });

  describe('List Versions', () => {
    it('should list all task prompt versions for a persona ordered by version_number', () => {
      const v1 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First',
          created_by: 'human',
        },
        db
      );

      const v2 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second',
          created_by: 'human',
        },
        db
      );

      const v3 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third',
          created_by: 'human',
        },
        db
      );

      const versions = listTaskPromptVersions(personaId, db);

      expect(versions).toHaveLength(3);
      expect(versions[0].version_number).toBe(1);
      expect(versions[0].id).toBe(v1.id);
      expect(versions[1].version_number).toBe(2);
      expect(versions[1].id).toBe(v2.id);
      expect(versions[2].version_number).toBe(3);
      expect(versions[2].id).toBe(v3.id);
    });

    it('should list all judge prompt versions for a persona ordered by version_number', () => {
      const v1 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First',
          created_by: 'human',
        },
        db
      );

      const v2 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second',
          created_by: 'human',
        },
        db
      );

      const v3 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third',
          created_by: 'human',
        },
        db
      );

      const versions = listJudgePromptVersions(personaId, db);

      expect(versions).toHaveLength(3);
      expect(versions[0].version_number).toBe(1);
      expect(versions[0].id).toBe(v1.id);
      expect(versions[1].version_number).toBe(2);
      expect(versions[1].id).toBe(v2.id);
      expect(versions[2].version_number).toBe(3);
      expect(versions[2].id).toBe(v3.id);
    });

    it('should return empty array for persona with no versions', () => {
      // Create a new persona with no versions
      const persona2 = createTestPersona(db);

      const taskVersions = listTaskPromptVersions(persona2.id, db);
      const judgeVersions = listJudgePromptVersions(persona2.id, db);

      expect(taskVersions).toHaveLength(0);
      expect(judgeVersions).toHaveLength(0);
    });
  });

  describe('Get Current Version', () => {
    it('should get latest task prompt version for a persona', () => {
      const v1 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First',
          created_by: 'human',
        },
        db
      );

      const v2 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second',
          created_by: 'ai',
        },
        db
      );

      const v3 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third',
          created_by: 'human',
        },
        db
      );

      const current = getCurrentTaskPromptVersion(personaId, db);

      expect(current).not.toBeNull();
      expect(current!.id).toBe(v3.id);
      expect(current!.prompt_text).toBe('Third');
    });

    it('should get latest judge prompt version for a persona', () => {
      const v1 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First',
          created_by: 'human',
        },
        db
      );

      const v2 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second',
          created_by: 'ai',
        },
        db
      );

      const v3 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third',
          created_by: 'human',
        },
        db
      );

      const current = getCurrentJudgePromptVersion(personaId, db);

      expect(current).not.toBeNull();
      expect(current!.id).toBe(v3.id);
      expect(current!.prompt_text).toBe('Third');
    });

    it('should return null if no versions exist', () => {
      // Create a new persona with no versions
      const persona2 = createTestPersona(db, {
        name: 'Empty Persona',
        description: 'No versions',
        task_prompt: 'Task prompt',
        initial_judge_prompt: 'Judge prompt',
      });

      const currentTask = getCurrentTaskPromptVersion(persona2.id, db);
      const currentJudge = getCurrentJudgePromptVersion(persona2.id, db);

      expect(currentTask).toBeNull();
      expect(currentJudge).toBeNull();
    });
  });

  describe('Get Next Version Number', () => {
    it('should return 1 for persona with no task prompt versions', () => {
      const persona2 = createTestPersona(db, {
        name: 'New Persona',
        description: 'No versions yet',
        task_prompt: 'Task prompt',
        initial_judge_prompt: 'Judge prompt',
      });

      const nextVersion = getNextTaskVersionNumber(persona2.id, db);
      expect(nextVersion).toBe(1);
    });

    it('should return 1 for persona with no judge prompt versions', () => {
      const persona2 = createTestPersona(db, {
        name: 'New Persona',
        description: 'No versions yet',
        task_prompt: 'Task prompt',
        initial_judge_prompt: 'Judge prompt',
      });

      const nextVersion = getNextJudgeVersionNumber(persona2.id, db);
      expect(nextVersion).toBe(1);
    });

    it('should return max + 1 for existing task prompt versions', () => {
      createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First',
          created_by: 'human',
        },
        db
      );

      createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second',
          created_by: 'human',
        },
        db
      );

      createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third',
          created_by: 'human',
        },
        db
      );

      const nextVersion = getNextTaskVersionNumber(personaId, db);
      expect(nextVersion).toBe(4);
    });

    it('should return max + 1 for existing judge prompt versions', () => {
      createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'First',
          created_by: 'human',
        },
        db
      );

      createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Second',
          created_by: 'human',
        },
        db
      );

      createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Third',
          created_by: 'human',
        },
        db
      );

      const nextVersion = getNextJudgeVersionNumber(personaId, db);
      expect(nextVersion).toBe(4);
    });
  });

  describe('Delete Version', () => {
    it('should delete task prompt version by ID', () => {
      const version = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'To be deleted',
          created_by: 'human',
        },
        db
      );

      const deleted = deleteTaskPromptVersion(version.id, db);

      expect(deleted).toBe(true);

      const retrieved = getTaskPromptVersion(version.id, db);
      expect(retrieved).toBeNull();
    });

    it('should delete judge prompt version by ID', () => {
      const version = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'To be deleted',
          created_by: 'human',
        },
        db
      );

      const deleted = deleteJudgePromptVersion(version.id, db);

      expect(deleted).toBe(true);

      const retrieved = getJudgePromptVersion(version.id, db);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent version', () => {
      const taskDeleted = deleteTaskPromptVersion('non-existent-id', db);
      const judgeDeleted = deleteJudgePromptVersion('non-existent-id', db);

      expect(taskDeleted).toBe(false);
      expect(judgeDeleted).toBe(false);
    });
  });

  describe('Version Deduplication', () => {
    it('should not prevent storing identical task prompts (different from prompt-version-manager)', () => {
      // version-manager.ts does NOT implement deduplication
      // It allows duplicate prompts to be stored
      const v1 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Same prompt',
          created_by: 'human',
        },
        db
      );

      const v2 = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Same prompt',
          created_by: 'ai',
        },
        db
      );

      // Both should be stored with different version numbers
      expect(v1.id).not.toBe(v2.id);
      expect(v1.version_number).toBe(1);
      expect(v2.version_number).toBe(2);
    });

    it('should not prevent storing identical judge prompts', () => {
      // version-manager.ts does NOT implement deduplication
      const v1 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Same prompt',
          created_by: 'human',
        },
        db
      );

      const v2 = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: 'Same prompt',
          created_by: 'ai',
        },
        db
      );

      // Both should be stored with different version numbers
      expect(v1.id).not.toBe(v2.id);
      expect(v1.version_number).toBe(1);
      expect(v2.version_number).toBe(2);
    });
  });
});
