/**
 * Persona Prompt Repair Module
 *
 * Provides shared repair transaction logic for personas with NULL
 * current_task_prompt_version_id or current_judge_prompt_version_id.
 *
 * Handles concurrent requests safely by re-verifying persona state
 * within the transaction and finding/creating initial prompt versions.
 */

import type { Database } from 'better-sqlite3';
import { createTaskPromptVersion } from './version-manager';
import { createJudgePromptVersion } from './version-manager';
import { createLogger } from '@lib/logger';

const logger = createLogger('Persona:Repair');

const INITIAL_VERSION = 0;

/**
 * Result type for repair transactions
 */
export type RepairResult =
  | { success: true; versionId: string; wasRepaired: boolean }
  | { success: false; reason: 'persona_deleted' | 'version_0_missing' | 'unknown' };

/**
 * Options for repair operations
 */
export interface RepairOptions {
  /** Optional new prompt text to create a version with after repair */
  promptText?: string;
  /** The persona ID to repair */
  personaId: string;
}

/**
 * Repairs a persona's task prompt version by finding and linking version 0.
 *
 * This transaction handles the auto-repair flow:
 * 1. Re-verifies persona still needs repair (concurrent request safety)
 * 2. Finds initial task prompt version (version 0)
 * 3. Updates persona.current_task_prompt_version_id
 * 4. If promptText provided, creates new version after repair
 *
 * @param db - Database connection
 * @param options - Repair options including personaId and optional promptText
 * @returns RepairResult with success status and versionId or failure reason
 *
 * @example
 * ```typescript
 * const result = repairTaskPromptVersion(db, { personaId: 'abc-123' });
 * if (result.success) {
 *   console.log(`Repaired to version ${result.versionId}`);
 * }
 * ```
 */
export function repairTaskPromptVersion(db: Database, options: RepairOptions): RepairResult {
  const { personaId, promptText } = options;

  const repairTx = db.transaction((): RepairResult => {
    // Re-verify persona still needs repair (handles concurrent requests)
    const personaCheckStmt = db.prepare(
      'SELECT current_task_prompt_version_id FROM personas WHERE id = ?'
    );
    const personaCheck = personaCheckStmt.get(personaId) as
      | {
          current_task_prompt_version_id: string | null;
        }
      | undefined;

    if (!personaCheck) {
      return { success: false, reason: 'persona_deleted' };
    }

    // If another request already repaired it, use that value
    if (personaCheck.current_task_prompt_version_id) {
      return {
        success: true,
        versionId: personaCheck.current_task_prompt_version_id,
        wasRepaired: false,
      };
    }

    // Find initial task prompt version
    const initialVersionStmt = db.prepare(
      'SELECT id FROM task_prompt_versions WHERE persona_id = ? AND version_number = ?'
    );
    const initialVersion = initialVersionStmt.get(personaId, INITIAL_VERSION) as
      | { id: string }
      | undefined;

    if (!initialVersion) {
      if (promptText) {
        logger.warn(
          'prompt_text provided but no initial task prompt version exists; cannot repair',
          { personaId }
        );
      }
      return { success: false, reason: 'version_0_missing' };
    }

    // Update persona to set the current version
    const updateResult = db
      .prepare(
        'UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?'
      )
      .run(initialVersion.id, new Date().toISOString(), personaId);

    // Verify the update succeeded (persona might have been deleted)
    if (updateResult.changes === 0) {
      return { success: false, reason: 'persona_deleted' };
    }

    logger.info('Repaired persona: set current_task_prompt_version_id to initial version', {
      personaId,
      version_id: initialVersion.id,
    });

    // If user provided prompt_text, create a new version after repair
    if (promptText) {
      logger.info(
        'prompt_text provided but persona was repaired to version 0; creating new version',
        { personaId }
      );

      const newVersion = createTaskPromptVersion(
        {
          persona_id: personaId,
          prompt_text: promptText,
          created_by: 'human',
        },
        db
      );

      logger.info('New task prompt version created', {
        personaId,
        version_id: newVersion.id,
      });
      return { success: true, versionId: newVersion.id, wasRepaired: true };
    }

    return { success: true, versionId: initialVersion.id, wasRepaired: true };
  });

  return repairTx();
}

/**
 * Repairs a persona's judge prompt version by finding and linking version 0.
 *
 * This transaction handles the auto-repair flow:
 * 1. Re-verifies persona still needs repair (concurrent request safety)
 * 2. Finds initial judge prompt version (version 0)
 * 3. Updates persona.current_judge_prompt_version_id
 * 4. If promptText provided, creates new version after repair
 *
 * @param db - Database connection
 * @param options - Repair options including personaId and optional promptText
 * @returns RepairResult with success status and versionId or failure reason
 *
 * @example
 * ```typescript
 * const result = repairJudgePromptVersion(db, { personaId: 'abc-123' });
 * if (result.success) {
 *   console.log(`Repaired to version ${result.versionId}`);
 * }
 * ```
 */
export function repairJudgePromptVersion(db: Database, options: RepairOptions): RepairResult {
  const { personaId, promptText } = options;

  const repairTx = db.transaction((): RepairResult => {
    // Re-verify persona still needs repair (handles concurrent requests)
    const personaCheckStmt = db.prepare(
      'SELECT current_judge_prompt_version_id FROM personas WHERE id = ?'
    );
    const personaCheck = personaCheckStmt.get(personaId) as
      | {
          current_judge_prompt_version_id: string | null;
        }
      | undefined;

    if (!personaCheck) {
      return { success: false, reason: 'persona_deleted' };
    }

    // If another request already repaired it, use that value
    if (personaCheck.current_judge_prompt_version_id) {
      return {
        success: true,
        versionId: personaCheck.current_judge_prompt_version_id,
        wasRepaired: false,
      };
    }

    // Find initial judge prompt version
    const initialVersionStmt = db.prepare(
      'SELECT id FROM judge_prompt_versions WHERE persona_id = ? AND version_number = ?'
    );
    const initialVersion = initialVersionStmt.get(personaId, INITIAL_VERSION) as
      | { id: string }
      | undefined;

    if (!initialVersion) {
      if (promptText) {
        logger.warn(
          'judge_prompt_text provided but no initial judge prompt version exists; cannot repair',
          { personaId }
        );
      }
      return { success: false, reason: 'version_0_missing' };
    }

    // Update persona to set the current version
    const updateResult = db
      .prepare(
        'UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?'
      )
      .run(initialVersion.id, new Date().toISOString(), personaId);

    // Verify the update succeeded (persona might have been deleted)
    if (updateResult.changes === 0) {
      return { success: false, reason: 'persona_deleted' };
    }

    logger.info('Repaired persona: set current_judge_prompt_version_id to initial version', {
      personaId,
      version_id: initialVersion.id,
    });

    // If user provided prompt_text, create a new version after repair
    if (promptText) {
      logger.info(
        'judge_prompt_text provided but persona was repaired to version 0; creating new version',
        { personaId }
      );

      const newVersion = createJudgePromptVersion(
        {
          persona_id: personaId,
          prompt_text: promptText,
          created_by: 'human',
        },
        db
      );

      logger.info('New judge prompt version created', {
        personaId,
        version_id: newVersion.id,
      });
      return { success: true, versionId: newVersion.id, wasRepaired: true };
    }

    return { success: true, versionId: initialVersion.id, wasRepaired: true };
  });

  return repairTx();
}
