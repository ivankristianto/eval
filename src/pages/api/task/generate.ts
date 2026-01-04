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

    // Verify we have a task prompt version to use
    if (!taskPromptVersionId) {
      logger.logApiRequest('POST', '/api/task/generate', 400, Date.now() - startTime);
      return badRequest(
        'No task prompt version available. Please provide task_prompt_text.',
        'NO_TASK_PROMPT'
      );
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

    return new Response(
      JSON.stringify({
        evaluation_run_id: result.evaluation_run_id,
        total_pairs: result.total_pairs,
        processed_pairs: result.processed_pairs,
        task_prompt_version_id: taskPromptVersionId,
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
