/**
 * Unit tests for prompt version manager
 * Tests version storage, history retrieval, and diff generation
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Database } from 'better-sqlite3';
import {
  storePromptVersion,
  getPromptHistory,
  getPromptDiff,
} from '@lib/training/prompt-version-manager';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
  createTestPersona,
} from '../setup';

describe('Prompt Version Manager', () => {
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

    // Create test model configurations using fixture
    createTestModelConfig(db, 'openai');
    createTestModelConfig(db, 'anthropic');
    createTestModelConfig(db, 'google');

    // Create test persona using fixture
    const persona = createTestPersona(db, {
      name: 'Test Persona for Prompt Version Manager',
      description: 'Test description',
      task_prompt: 'Evaluate customer support',
      initial_judge_prompt: 'Initial judge prompt for testing',
    });
    personaId = persona.id;
  });

  afterEach(() => {
    // Clean up after each test
    cleanTestDatabase();
  });

  it('should store a new prompt version', async () => {
    const promptText = 'Evaluate if the response is accurate and helpful';
    const rationale = 'Initial prompt';

    const versionId = await storePromptVersion(personaId, 1, promptText, rationale, 'human', db);

    expect(versionId).toBeDefined();

    // Verify stored
    const stored = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
      .get(versionId) as any;

    expect(stored).toBeDefined();
    expect(stored.persona_id).toBe(personaId);
    expect(stored.iteration_number).toBe(1);
    expect(stored.prompt_text).toBe(promptText);
    expect(stored.improvement_rationale).toBe(rationale);
    expect(stored.created_by).toBe('human');
  });

  it('should not store duplicate identical prompt', async () => {
    const promptText = 'Evaluate if the response is accurate';

    // Store first version
    await storePromptVersion(personaId, 1, promptText, 'First', 'human', db);

    // Try to store identical prompt for next iteration
    const result = await storePromptVersion(personaId, 2, promptText, 'Second', 'ai', db);

    expect(result).toBeNull();

    // Verify only 2 versions exist: initial (iteration 0) + first stored (iteration 1)
    // The duplicate at iteration 2 should not be stored
    const versions = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
      .all(personaId);

    expect(versions).toHaveLength(2);
  });

  it('should store significantly different prompt', async () => {
    const prompt1 = 'Evaluate if the response is accurate';
    const prompt2 = 'Evaluate if the response is semantically equivalent to the expected output';

    await storePromptVersion(personaId, 1, prompt1, 'First', 'human', db);
    const _id2 = await storePromptVersion(personaId, 2, prompt2, 'Second', 'ai', db);

    expect(_id2).toBeDefined();

    // Should have 3 versions: initial (iteration 0) + two stored (iterations 1 and 2)
    const versions = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
      .all(personaId);

    expect(versions).toHaveLength(3);
  });

  it('should ignore whitespace-only differences', async () => {
    const prompt1 = 'Evaluate accuracy';
    const prompt2 = '  Evaluate accuracy  \n';

    await storePromptVersion(personaId, 1, prompt1, 'First', 'human', db);
    const result = await storePromptVersion(personaId, 2, prompt2, 'Second', 'ai', db);

    expect(result).toBeNull();
  });

  it('should retrieve prompt history in chronological order', async () => {
    // Note: createTestPersona creates an initial judge prompt at iteration 0
    await storePromptVersion(personaId, 1, 'Prompt v1', 'First', 'human', db);
    await storePromptVersion(personaId, 2, 'Prompt v2', 'Second', 'ai', db);
    await storePromptVersion(personaId, 3, 'Prompt v3', 'Third', 'ai', db);

    const history = await getPromptHistory(personaId, db);

    // Should have 4 versions: initial (iteration 0) + 3 stored versions
    expect(history).toHaveLength(4);
    expect(history[0].iteration_number).toBe(0);
    expect(history[1].iteration_number).toBe(1);
    expect(history[2].iteration_number).toBe(2);
    expect(history[3].iteration_number).toBe(3);
    // Initial and first stored are created by human
    expect(history[0].created_by).toBe('human');
    expect(history[1].created_by).toBe('human');
    expect(history[2].created_by).toBe('ai');
  });

  it('should return empty array for persona with no prompt versions beyond initial', async () => {
    // The createTestPersona fixture creates an initial judge prompt at iteration 0
    // So when we call getPromptHistory for the main personaId, we should see that initial version
    // Let's delete all versions for the persona to test empty history
    db.prepare('DELETE FROM judge_prompt_versions WHERE persona_id = ?').run(personaId);

    const history = await getPromptHistory(personaId, db);

    expect(history).toHaveLength(0);
  });

  it('should generate diff between two versions', async () => {
    const _id1 = await storePromptVersion(personaId, 1, 'Evaluate accuracy', 'First', 'human', db);
    const _id2 = await storePromptVersion(
      personaId,
      2,
      'Evaluate accuracy and completeness',
      'Second',
      'ai',
      db
    );

    const diff = await getPromptDiff(_id1!, _id2!, db);

    expect(diff.before).toBe('Evaluate accuracy');
    expect(diff.after).toBe('Evaluate accuracy and completeness');
    expect(diff.changes).toBeDefined();
  });

  it('should handle diff with identical versions', async () => {
    const promptText = 'Evaluate accuracy';

    const _id1 = await storePromptVersion(personaId, 1, promptText, 'First', 'human', db);
    const _id2 = await storePromptVersion(personaId, 3, 'Different prompt', 'Third', 'ai', db);

    // Get history and manually create a second version with same text
    db.prepare(
      `
      INSERT INTO judge_prompt_versions
      (id, persona_id, iteration_number, prompt_text, improvement_rationale, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      uuidv4(),
      personaId,
      2,
      promptText,
      'Duplicate for test',
      'human',
      new Date().toISOString()
    );

    const allVersions = await getPromptHistory(personaId, db);
    // Find the two versions with the same text (iterations 1 and 2)
    const identicalVersions = allVersions.filter((v) => v.prompt_text === promptText);
    const diff = await getPromptDiff(identicalVersions[0].id, identicalVersions[1].id, db);

    expect(diff.before).toBe(diff.after);
    expect(diff.changes).toContain('No changes');
  });

  it('should throw error if version not found in diff', async () => {
    const fakeId = uuidv4();

    await expect(getPromptDiff(fakeId, fakeId, db)).rejects.toThrow('Version not found');
  });

  it('should support both human and ai created_by values', async () => {
    // Note: createTestPersona creates an initial judge prompt at iteration 0 with created_by='human'
    const _id1 = await storePromptVersion(personaId, 1, 'Prompt 1', 'Human', 'human', db);
    const _id2 = await storePromptVersion(personaId, 2, 'Prompt 2', 'AI', 'ai', db);

    const history = await getPromptHistory(personaId, db);

    // Initial prompt from fixture is created by 'human'
    expect(history[0].created_by).toBe('human');
    expect(history[0].iteration_number).toBe(0);
    // First stored version is also 'human'
    expect(history[1].created_by).toBe('human');
    expect(history[1].iteration_number).toBe(1);
    // Second stored version is 'ai'
    expect(history[2].created_by).toBe('ai');
    expect(history[2].iteration_number).toBe(2);
  });
});
