// src/pages/api/task/generate.ts
// API endpoint to trigger task output generation for training pairs

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { generateTaskOutputs } from '@lib/training/task-generator';
import {
  createTaskPromptVersion,
  getCurrentTaskPromptVersion,
} from '@lib/training/version-manager';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { parseJsonBody } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Task:Generate');
const INITIAL_TASK_VERSION = 0;

/**
 * POST /api/task/generate
 * Triggers task output generation for training pairs
 *
 * Request body:
 * {
 *   persona_id: string;
 *   task_prompt_text?: string; // Optional: if provided, creates new version if different from current
 *   training_pair_ids?: string[]; // Optional: specific pairs to generate for
 * }
 *
 * Response:
 * {
 *   evaluation_run_id: string;
 *   total_pairs: number;
 *   processed_pairs: number;
 *   task_prompt_version_id?: string; // Included if new version was created
 *   results: Array<{id, training_pair_id, generated_output, created_at, updated_at}>; // For optimistic updates
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      persona_id: string;
      task_prompt_text?: string;
      training_pair_ids?: string[];
    }>(request);

    const { persona_id, task_prompt_text, training_pair_ids } = body;

    if (!persona_id) {
      logger.logApiRequest('POST', '/api/task/generate', 400, Date.now() - startTime);
      return badRequest('persona_id is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db
      .prepare('SELECT id, name, current_task_prompt_version_id FROM personas WHERE id = ?')
      .get(persona_id) as
      | { id: string; name: string; current_task_prompt_version_id: string | null }
      | undefined;

    if (!persona) {
      logger.logApiRequest('POST', '/api/task/generate', 404, Date.now() - startTime);
      return notFound('Persona');
    }

    let taskPromptVersionId = persona.current_task_prompt_version_id;

    // If task_prompt_text is provided, check if we need to create a new version
    if (task_prompt_text) {
      const currentVersion = getCurrentTaskPromptVersion(persona_id, db);

      // Create new version if prompt text is different from current
      if (!currentVersion || currentVersion.prompt_text !== task_prompt_text) {
        logger.info('Creating new task prompt version', { persona_id });

        const newVersion = createTaskPromptVersion(
          {
            persona_id,
            prompt_text: task_prompt_text,
            created_by: 'human',
          },
          db
        );

        taskPromptVersionId = newVersion.id;
        logger.info('New task prompt version created', { persona_id, version_id: newVersion.id });
      }
    }

    // Fallback: if current_task_prompt_version_id is null, try to find initial task prompt (version 0)
    if (!taskPromptVersionId) {
      logger.info('No current task prompt version set, falling back to initial version', {
        persona_id,
      });

      /**
       * Repair transaction: Auto-repair persona with null current_task_prompt_version_id
       *
       * Implements atomic read-repair operation with:
       * 1. Re-verify persona still needs repair (handles concurrent requests)
       * 2. Find initial task prompt version (version 0)
       * 3. Update persona to point to initial version
       * 4. If task_prompt_text provided, create new version after repair
       *
       * @returns The task prompt version ID to use, or null if repair failed
       */
      const repairTx = db.transaction(() => {
        // Re-verify persona still needs repair (handles concurrent requests)
        const personaCheckStmt = db.prepare(
          'SELECT current_task_prompt_version_id FROM personas WHERE id = ?'
        );
        const personaCheck = personaCheckStmt.get(persona_id) as
          | {
              current_task_prompt_version_id: string | null;
            }
          | undefined;

        if (!personaCheck) {
          return null; // Persona was deleted
        }

        // If another request already repaired it, use that value
        if (personaCheck.current_task_prompt_version_id) {
          return personaCheck.current_task_prompt_version_id;
        }

        // Find initial task prompt version
        const initialVersionStmt = db.prepare(
          'SELECT id FROM task_prompt_versions WHERE persona_id = ? AND version_number = ?'
        );
        const initialVersion = initialVersionStmt.get(persona_id, INITIAL_TASK_VERSION) as
          | { id: string }
          | undefined;

        if (initialVersion) {
          // Update persona to set the current version
          const updateResult = db
            .prepare(
              'UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?'
            )
            .run(initialVersion.id, new Date().toISOString(), persona_id);

          // Verify the update succeeded (persona might have been deleted)
          if (updateResult.changes === 0) {
            return null;
          }

          logger.info('Repaired persona: set current_task_prompt_version_id to initial version', {
            persona_id,
            version_id: initialVersion.id,
          });

          // If user provided task_prompt_text, create a new version after repair
          if (task_prompt_text) {
            logger.info(
              'task_prompt_text provided but persona was repaired to version 0; creating new version',
              { persona_id }
            );

            const newVersion = createTaskPromptVersion(
              {
                persona_id,
                prompt_text: task_prompt_text,
                created_by: 'human',
              },
              db
            );

            logger.info('New task prompt version created', {
              persona_id,
              version_id: newVersion.id,
            });
            return newVersion.id;
          }

          return initialVersion.id;
        }

        return null;
      });

      taskPromptVersionId = repairTx();

      if (!taskPromptVersionId) {
        logger.logApiRequest('POST', '/api/task/generate', 400, Date.now() - startTime);
        return badRequest(
          'No task prompt version available. Please provide task_prompt_text.',
          'NO_TASK_PROMPT'
        );
      }
    }

    // Generate task outputs
    logger.info('Starting task generation', { persona_id, taskPromptVersionId });

    const result = await generateTaskOutputs(
      {
        persona_id,
        task_prompt_version_id: taskPromptVersionId,
        training_pair_ids,
      },
      db
    );

    logger.logApiRequest('POST', '/api/task/generate', 200, Date.now() - startTime);

    // Return results for optimistic updates - include the actual generated outputs
    return new Response(
      JSON.stringify({
        evaluation_run_id: result.evaluation_run_id,
        total_pairs: result.total_pairs,
        processed_pairs: result.processed_pairs,
        task_prompt_version_id: taskPromptVersionId,
        results: result.results.map((r) => ({
          id: r.id,
          training_pair_id: r.training_pair_id,
          generated_output: r.generated_output,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/task/generate', error as Error);
    return createErrorResponse(error);
  }
};
