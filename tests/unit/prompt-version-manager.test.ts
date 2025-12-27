/**
 * Unit tests for prompt version manager
 * Tests version storage, history retrieval, and diff generation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../src/lib/db';
import type { Database } from 'better-sqlite3';
import {
  storePromptVersion,
  getPromptHistory,
  getPromptDiff,
} from '../../src/lib/prompt-version-manager';
import { v4 as uuidv4 } from 'uuid';

describe('Prompt Version Manager', () => {
  let db: Database;
  let personaId: string;

  beforeEach(() => {
    db = getDatabase();

    // Create test model configurations
    db.prepare(`
      INSERT OR IGNORE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run('model-task-1', 'openai', 'gpt-4', 'fake-key', 1);

    db.prepare(`
      INSERT OR IGNORE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run('model-judge-1', 'anthropic', 'claude-3', 'fake-key', 1);

    db.prepare(`
      INSERT OR IGNORE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run('model-engineer-1', 'google', 'gemini-pro', 'fake-key', 1);

    // Create test persona
    personaId = uuidv4();
    db.prepare(`
      INSERT INTO personas
      (id, name, description, task_prompt, task_model_id, judge_model_id,
       prompt_engineer_model_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      personaId,
      'Test Persona',
      'Test description',
      'Evaluate customer support',
      'model-task-1',
      'model-judge-1',
      'model-engineer-1',
      'training',
      new Date().toISOString(),
      new Date().toISOString()
    );
  });

  afterEach(() => {
    // Clean up
    db.prepare('DELETE FROM judge_prompt_versions WHERE persona_id = ?').run(personaId);
    db.prepare('DELETE FROM personas WHERE id = ?').run(personaId);
    db.prepare('DELETE FROM ModelConfiguration WHERE id IN (?, ?, ?)').run(
      'model-task-1',
      'model-judge-1',
      'model-engineer-1'
    );
  });

  it('should store a new prompt version', async () => {
    const promptText = 'Evaluate if the response is accurate and helpful';
    const rationale = 'Initial prompt';

    const versionId = await storePromptVersion(
      personaId,
      1,
      promptText,
      rationale,
      'human',
      db
    );

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

    // Verify only one version exists
    const versions = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
      .all(personaId);

    expect(versions).toHaveLength(1);
  });

  it('should store significantly different prompt', async () => {
    const prompt1 = 'Evaluate if the response is accurate';
    const prompt2 = 'Evaluate if the response is semantically equivalent to the expected output';

    await storePromptVersion(personaId, 1, prompt1, 'First', 'human', db);
    const _id2 = await storePromptVersion(personaId, 2, prompt2, 'Second', 'ai', db);

    expect(_id2).toBeDefined();

    const versions = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
      .all(personaId);

    expect(versions).toHaveLength(2);
  });

  it('should ignore whitespace-only differences', async () => {
    const prompt1 = 'Evaluate accuracy';
    const prompt2 = '  Evaluate accuracy  \n';

    await storePromptVersion(personaId, 1, prompt1, 'First', 'human', db);
    const result = await storePromptVersion(personaId, 2, prompt2, 'Second', 'ai', db);

    expect(result).toBeNull();
  });

  it('should retrieve prompt history in chronological order', async () => {
    await storePromptVersion(personaId, 1, 'Prompt v1', 'First', 'human', db);
    await storePromptVersion(personaId, 2, 'Prompt v2', 'Second', 'ai', db);
    await storePromptVersion(personaId, 3, 'Prompt v3', 'Third', 'ai', db);

    const history = await getPromptHistory(personaId, db);

    expect(history).toHaveLength(3);
    expect(history[0].iteration_number).toBe(1);
    expect(history[1].iteration_number).toBe(2);
    expect(history[2].iteration_number).toBe(3);
    expect(history[0].created_by).toBe('human');
    expect(history[1].created_by).toBe('ai');
  });

  it('should return empty array for persona with no prompt versions', async () => {
    const newPersonaId = uuidv4();

    db.prepare(`
      INSERT INTO personas
      (id, name, description, task_prompt, task_model_id, judge_model_id,
       prompt_engineer_model_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newPersonaId,
      'New Persona',
      'Test',
      'Test prompt',
      'model-task-1',
      'model-judge-1',
      'model-engineer-1',
      'draft',
      new Date().toISOString(),
      new Date().toISOString()
    );

    const history = await getPromptHistory(newPersonaId, db);

    expect(history).toHaveLength(0);

    // Cleanup
    db.prepare('DELETE FROM personas WHERE id = ?').run(newPersonaId);
  });

  it('should generate diff between two versions', async () => {
    const _id1 = await storePromptVersion(
      personaId,
      1,
      'Evaluate accuracy',
      'First',
      'human',
      db
    );
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
    const _id2 = await storePromptVersion(
      personaId,
      3,
      'Different prompt',
      'Third',
      'ai',
      db
    );

    // Get history and manually create a second version with same text
    db.prepare(`
      INSERT INTO judge_prompt_versions
      (id, persona_id, iteration_number, prompt_text, improvement_rationale, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      personaId,
      2,
      promptText,
      'Duplicate for test',
      'human',
      new Date().toISOString()
    );

    const allVersions = await getPromptHistory(personaId, db);
    const diff = await getPromptDiff(allVersions[0].id, allVersions[1].id, db);

    expect(diff.before).toBe(diff.after);
    expect(diff.changes).toContain('No changes');
  });

  it('should throw error if version not found in diff', async () => {
    const fakeId = uuidv4();

    await expect(getPromptDiff(fakeId, fakeId, db)).rejects.toThrow('Version not found');
  });

  it('should support both human and ai created_by values', async () => {
    const _id1 = await storePromptVersion(personaId, 1, 'Prompt 1', 'Human', 'human', db);
    const _id2 = await storePromptVersion(personaId, 2, 'Prompt 2', 'AI', 'ai', db);

    const history = await getPromptHistory(personaId, db);

    expect(history[0].created_by).toBe('human');
    expect(history[1].created_by).toBe('ai');
  });
});
