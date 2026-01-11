/**
 * Unit tests for judge prompt version management
 * Uses version-manager and current schema (version_number)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Database } from 'better-sqlite3';
import {
  createJudgePromptVersion,
  listJudgePromptVersions,
  getJudgePromptVersion,
  getJudgePromptVersionByNumber,
} from '@lib/training/version-manager';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestPersona,
} from '../setup';

describe('Judge Prompt Versions (version-manager)', () => {
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
    cleanTestDatabase();

    const persona = createTestPersona(db, {
      name: 'Test Persona for Prompt Version Manager',
      description: 'Test description',
      initial_task_prompt: 'Evaluate customer support',
      initial_judge_prompt: 'Initial judge prompt for testing',
    });
    personaId = persona.id;
  });

  afterEach(() => {
    cleanTestDatabase();
  });

  it('stores a new judge prompt version', () => {
    const version = createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Evaluate if the response is accurate and helpful',
        improvement_rationale: 'Initial refinement',
        label: 'v1',
        created_by: 'human',
      },
      db
    );

    expect(version).toBeDefined();
    expect(version.version_number).toBe(1);

    const stored = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
      .get(version.id) as { persona_id: string; version_number: number } | undefined;

    expect(stored).toBeDefined();
    expect(stored!.persona_id).toBe(personaId);
    expect(stored!.version_number).toBe(1);

    const persona = db
      .prepare('SELECT current_judge_prompt_version_id FROM personas WHERE id = ?')
      .get(personaId) as { current_judge_prompt_version_id: string | null } | undefined;

    expect(persona?.current_judge_prompt_version_id).toBe(version.id);
  });

  it('increments version_number for subsequent versions', () => {
    const first = createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Prompt v1',
        improvement_rationale: 'First',
        created_by: 'human',
      },
      db
    );

    const second = createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Prompt v2',
        improvement_rationale: 'Second',
        created_by: 'ai',
      },
      db
    );

    expect(first.version_number).toBe(1);
    expect(second.version_number).toBe(2);

    const versions = listJudgePromptVersions(personaId, db);
    expect(versions).toHaveLength(3);
  });

  it('lists versions in chronological order', () => {
    createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Prompt v1',
        improvement_rationale: 'First',
        created_by: 'human',
      },
      db
    );
    createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Prompt v2',
        improvement_rationale: 'Second',
        created_by: 'ai',
      },
      db
    );

    const versions = listJudgePromptVersions(personaId, db);
    const numbers = versions.map((v) => v.version_number);

    expect(numbers).toEqual([0, 1, 2]);
    expect(versions[0].created_by).toBe('human');
  });

  it('retrieves versions by id and by number', () => {
    const version = createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Prompt v1',
        improvement_rationale: 'First',
        created_by: 'human',
      },
      db
    );

    const byId = getJudgePromptVersion(version.id, db);
    const byNumber = getJudgePromptVersionByNumber(personaId, 1, db);

    expect(byId?.id).toBe(version.id);
    expect(byNumber?.id).toBe(version.id);
  });

  it('allows duplicate prompt text', () => {
    createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Same prompt',
        improvement_rationale: 'First',
        created_by: 'human',
      },
      db
    );

    createJudgePromptVersion(
      {
        persona_id: personaId,
        prompt_text: 'Same prompt',
        improvement_rationale: 'Second',
        created_by: 'ai',
      },
      db
    );

    const versions = listJudgePromptVersions(personaId, db);
    expect(versions).toHaveLength(3);
    expect(versions[2].version_number).toBe(2);
  });

  it('returns empty list when no versions exist', () => {
    db.prepare('DELETE FROM judge_prompt_versions WHERE persona_id = ?').run(personaId);

    const versions = listJudgePromptVersions(personaId, db);
    expect(versions).toHaveLength(0);
  });
});
