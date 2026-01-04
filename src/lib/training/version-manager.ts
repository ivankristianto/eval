/**
 * Version Manager
 * Manages task and judge prompt versions with auto-increment logic
 */

import type { Database } from 'better-sqlite3';
import type { TaskPromptVersion, JudgePromptVersion } from '@src-types/training';

/**
 * Input for creating a new task prompt version
 */
export interface CreateTaskPromptVersionInput {
  persona_id: string;
  prompt_text: string;
  improvement_rationale?: string | null;
  label?: string | null;
  created_by: 'human' | 'ai';
}

/**
 * Input for creating a new judge prompt version
 */
export interface CreateJudgePromptVersionInput {
  persona_id: string;
  prompt_text: string;
  improvement_rationale?: string | null;
  label?: string | null;
  created_by: 'human' | 'ai';
}

/**
 * Create a new task prompt version with auto-incremented version_number
 * @param input - Version creation input
 * @param db - Database connection
 * @returns The created task prompt version
 * @throws Error if persona not found
 */
export function createTaskPromptVersion(
  input: CreateTaskPromptVersionInput,
  db: Database
): TaskPromptVersion {
  const { persona_id, prompt_text, improvement_rationale = null, label = null, created_by } = input;

  // Verify persona exists
  const persona = db
    .prepare('SELECT id FROM personas WHERE id = ?')
    .get(persona_id) as { id: string } | undefined;

  if (!persona) {
    throw new Error(`Persona not found: ${persona_id}`);
  }

  // Get next version number
  const nextVersion = getNextTaskVersionNumber(persona_id, db);

  // Insert new version
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  db.prepare(
    `INSERT INTO task_prompt_versions
     (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, persona_id, nextVersion, prompt_text, improvement_rationale, label, created_by, created_at);

  // Update persona's current task prompt version
  db.prepare('UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?').run(
    id,
    created_at,
    persona_id
  );

  return {
    id,
    persona_id,
    version_number: nextVersion,
    prompt_text,
    improvement_rationale,
    label,
    created_by,
    created_at,
  };
}

/**
 * Create a new judge prompt version with auto-incremented version_number
 * @param input - Version creation input
 * @param db - Database connection
 * @returns The created judge prompt version
 * @throws Error if persona not found
 */
export function createJudgePromptVersion(
  input: CreateJudgePromptVersionInput,
  db: Database
): JudgePromptVersion {
  const { persona_id, prompt_text, improvement_rationale = null, label = null, created_by } = input;

  // Verify persona exists
  const persona = db
    .prepare('SELECT id FROM personas WHERE id = ?')
    .get(persona_id) as { id: string } | undefined;

  if (!persona) {
    throw new Error(`Persona not found: ${persona_id}`);
  }

  // Get next version number
  const nextVersion = getNextJudgeVersionNumber(persona_id, db);

  // Insert new version
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  db.prepare(
    `INSERT INTO judge_prompt_versions
     (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, persona_id, nextVersion, prompt_text, improvement_rationale, label, created_by, created_at);

  // Update persona's current judge prompt version
  db.prepare('UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?').run(
    id,
    created_at,
    persona_id
  );

  return {
    id,
    persona_id,
    version_number: nextVersion,
    prompt_text,
    improvement_rationale,
    label,
    created_by,
    created_at,
  };
}

/**
 * Get a task prompt version by ID
 * @param versionId - Version ID
 * @param db - Database connection
 * @returns The task prompt version or null if not found
 */
export function getTaskPromptVersion(versionId: string, db: Database): TaskPromptVersion | null {
  const version = db
    .prepare('SELECT * FROM task_prompt_versions WHERE id = ?')
    .get(versionId) as TaskPromptVersion | undefined;

  return version ?? null;
}

/**
 * Get a judge prompt version by ID
 * @param versionId - Version ID
 * @param db - Database connection
 * @returns The judge prompt version or null if not found
 */
export function getJudgePromptVersion(versionId: string, db: Database): JudgePromptVersion | null {
  const version = db
    .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
    .get(versionId) as JudgePromptVersion | undefined;

  return version ?? null;
}

/**
 * Get a task prompt version by persona and version number
 * @param personaId - Persona ID
 * @param versionNumber - Version number
 * @param db - Database connection
 * @returns The task prompt version or null if not found
 */
export function getTaskPromptVersionByNumber(
  personaId: string,
  versionNumber: number,
  db: Database
): TaskPromptVersion | null {
  const version = db
    .prepare('SELECT * FROM task_prompt_versions WHERE persona_id = ? AND version_number = ?')
    .get(personaId, versionNumber) as TaskPromptVersion | undefined;

  return version ?? null;
}

/**
 * Get a judge prompt version by persona and version number
 * @param personaId - Persona ID
 * @param versionNumber - Version number
 * @param db - Database connection
 * @returns The judge prompt version or null if not found
 */
export function getJudgePromptVersionByNumber(
  personaId: string,
  versionNumber: number,
  db: Database
): JudgePromptVersion | null {
  const version = db
    .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ? AND version_number = ?')
    .get(personaId, versionNumber) as JudgePromptVersion | undefined;

  return version ?? null;
}

/**
 * List all task prompt versions for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Array of task prompt versions ordered by version_number
 */
export function listTaskPromptVersions(personaId: string, db: Database): TaskPromptVersion[] {
  const versions = db
    .prepare(
      `SELECT * FROM task_prompt_versions
       WHERE persona_id = ?
       ORDER BY version_number ASC`
    )
    .all(personaId) as TaskPromptVersion[];

  return versions;
}

/**
 * List all judge prompt versions for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Array of judge prompt versions ordered by version_number
 */
export function listJudgePromptVersions(personaId: string, db: Database): JudgePromptVersion[] {
  const versions = db
    .prepare(
      `SELECT * FROM judge_prompt_versions
       WHERE persona_id = ?
       ORDER BY version_number ASC`
    )
    .all(personaId) as JudgePromptVersion[];

  return versions;
}

/**
 * Get the current (latest) task prompt version for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns The latest task prompt version or null if none exist
 */
export function getCurrentTaskPromptVersion(personaId: string, db: Database): TaskPromptVersion | null {
  const version = db
    .prepare(
      `SELECT * FROM task_prompt_versions
       WHERE persona_id = ?
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .get(personaId) as TaskPromptVersion | undefined;

  return version ?? null;
}

/**
 * Get the current (latest) judge prompt version for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns The latest judge prompt version or null if none exist
 */
export function getCurrentJudgePromptVersion(personaId: string, db: Database): JudgePromptVersion | null {
  const version = db
    .prepare(
      `SELECT * FROM judge_prompt_versions
       WHERE persona_id = ?
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .get(personaId) as JudgePromptVersion | undefined;

  return version ?? null;
}

/**
 * Get the next version number for task prompts (auto-increment logic)
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Next version number (1 if no versions exist, otherwise max + 1)
 */
export function getNextTaskVersionNumber(personaId: string, db: Database): number {
  const result = db
    .prepare('SELECT COALESCE(MAX(version_number), 0) as max_version FROM task_prompt_versions WHERE persona_id = ?')
    .get(personaId) as { max_version: number };

  return result.max_version + 1;
}

/**
 * Get the next version number for judge prompts (auto-increment logic)
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Next version number (1 if no versions exist, otherwise max + 1)
 */
export function getNextJudgeVersionNumber(personaId: string, db: Database): number {
  const result = db
    .prepare('SELECT COALESCE(MAX(version_number), 0) as max_version FROM judge_prompt_versions WHERE persona_id = ?')
    .get(personaId) as { max_version: number };

  return result.max_version + 1;
}

/**
 * Delete a task prompt version
 * @param versionId - Version ID
 * @param db - Database connection
 * @returns true if deleted, false if not found
 */
export function deleteTaskPromptVersion(versionId: string, db: Database): boolean {
  const result = db.prepare('DELETE FROM task_prompt_versions WHERE id = ?').run(versionId);
  return result.changes > 0;
}

/**
 * Delete a judge prompt version
 * @param versionId - Version ID
 * @param db - Database connection
 * @returns true if deleted, false if not found
 */
export function deleteJudgePromptVersion(versionId: string, db: Database): boolean {
  const result = db.prepare('DELETE FROM judge_prompt_versions WHERE id = ?').run(versionId);
  return result.changes > 0;
}
