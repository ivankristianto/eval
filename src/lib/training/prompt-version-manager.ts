/**
 * Prompt Version Manager
 * Manages versioning and history of judge prompts with change tracking
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a specific version of a judge prompt.
 */
export interface JudgePromptVersion {
  id: string;
  persona_id: string;
  version_number: number;
  prompt_text: string;
  improvement_rationale: string | null;
  created_by: 'human' | 'ai';
  created_at: string;
}

/**
 * Result of a comparison between two prompt versions.
 */
export interface PromptDiff {
  before: string;
  after: string;
  changes: string;
}

/**
 * Store a new prompt version if significantly different from previous.
 *
 * Only stores if:
 * - This is the first version for the persona
 * - OR the prompt text is significantly different (not just whitespace)
 *
 * @param personaId - Persona ID
 * @param versionNumber - Version number for this prompt
 * @param promptText - The prompt text to store
 * @param rationale - Explanation of improvements
 * @param createdBy - 'human' or 'ai'
 * @param db - Database connection
 * @returns Version ID if stored, null if skipped (duplicate)
 */
export async function storePromptVersion(
  personaId: string,
  versionNumber: number,
  promptText: string,
  rationale: string,
  createdBy: 'human' | 'ai',
  db: Database
): Promise<string | null> {
  // Normalize prompt text (trim whitespace)
  const normalizedPrompt = promptText.trim();

  // Check if identical prompt already exists
  const previousVersion = db
    .prepare(
      `SELECT prompt_text FROM judge_prompt_versions
       WHERE persona_id = ?
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .get(personaId) as { prompt_text: string } | undefined;

  if (previousVersion) {
    const previousNormalized = previousVersion.prompt_text.trim();

    // Skip if identical (only whitespace differences)
    if (previousNormalized === normalizedPrompt) {
      return null;
    }
  }

  // Store new version
  const versionId = uuidv4();
  db.prepare(
    `INSERT INTO judge_prompt_versions
     (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    versionId,
    personaId,
    versionNumber,
    promptText,
    rationale,
    createdBy,
    new Date().toISOString()
  );

  return versionId;
}

/**
 * Retrieve prompt version history for a persona.
 *
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Array of prompt versions in chronological order
 */
export async function getPromptHistory(
  personaId: string,
  db: Database
): Promise<JudgePromptVersion[]> {
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
 * Generate diff between two prompt versions.
 *
 * @param version1Id - ID of first version
 * @param version2Id - ID of second version
 * @param db - Database connection
 * @returns Diff with before/after text and changes description
 * @throws Error if version not found
 */
export async function getPromptDiff(
  version1Id: string,
  version2Id: string,
  db: Database
): Promise<PromptDiff> {
  const version1 = db
    .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
    .get(version1Id) as JudgePromptVersion | undefined;

  const version2 = db
    .prepare('SELECT * FROM judge_prompt_versions WHERE id = ?')
    .get(version2Id) as JudgePromptVersion | undefined;

  if (!version1 || !version2) {
    throw new Error(`Version not found: ${!version1 ? version1Id : version2Id}`);
  }

  // Simple diff: compare text
  const changes =
    version1.prompt_text === version2.prompt_text
      ? 'No changes detected'
      : generateSimpleDiff(version1.prompt_text, version2.prompt_text);

  return {
    before: version1.prompt_text,
    after: version2.prompt_text,
    changes,
  };
}

/**
 * Generate simple textual diff description.
 * For MVP, just describe what changed. Could be enhanced with line-by-line diff later.
 * @param before - Original prompt text
 * @param after - New prompt text
 * @returns Text description of changes
 */
function generateSimpleDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  if (beforeLines.length !== afterLines.length) {
    return `Length changed from ${beforeLines.length} to ${afterLines.length} lines`;
  }

  // Count changed lines
  let changedLines = 0;
  for (let i = 0; i < beforeLines.length; i++) {
    if (beforeLines[i] !== afterLines[i]) {
      changedLines++;
    }
  }

  if (changedLines === 0) {
    return 'No changes detected';
  }

  return `${changedLines} line${changedLines > 1 ? 's' : ''} modified`;
}
