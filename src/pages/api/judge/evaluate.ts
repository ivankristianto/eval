// src/pages/api/judge/evaluate.ts
// API endpoint to trigger judge evaluation for training pair results

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { evaluateWithJudge } from '@lib/training/judge-runner';
import {
  createJudgePromptVersion,
  getCurrentJudgePromptVersion,
} from '@lib/training/version-manager';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { parseJsonBody } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Judge:Evaluate');

/**
 * POST /api/judge/evaluate
 * Triggers judge evaluation for training pair results
 *
 * Request body:
 * {
 *   persona_id: string;
 *   judge_prompt_text?: string; // Optional: if provided, creates new version if different from current
 *   training_pair_result_ids?: string[]; // Optional: specific results to evaluate
 * }
 *
 * Response:
 * {
 *   evaluation_run_id: string;
 *   total_results: number;
 *   evaluated_results: number;
 *   judge_prompt_version_id?: string; // Included if new version was created
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      persona_id: string;
      judge_prompt_text?: string;
      training_pair_result_ids?: string[];
    }>(request);

    const { persona_id, judge_prompt_text, training_pair_result_ids } = body;

    if (!persona_id) {
      logger.logApiRequest('POST', '/api/judge/evaluate', 400, Date.now() - startTime);
      return badRequest('persona_id is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db
      .prepare('SELECT id, name, current_judge_prompt_version_id FROM personas WHERE id = ?')
      .get(persona_id) as
      | { id: string; name: string; current_judge_prompt_version_id: string | null }
      | undefined;

    if (!persona) {
      logger.logApiRequest('POST', '/api/judge/evaluate', 404, Date.now() - startTime);
      return notFound('Persona');
    }

    let judgePromptVersionId = persona.current_judge_prompt_version_id;

    // If judge_prompt_text is provided, check if we need to create a new version
    if (judge_prompt_text) {
      const currentVersion = getCurrentJudgePromptVersion(persona_id, db);

      // Create new version if prompt text is different from current
      if (!currentVersion || currentVersion.prompt_text !== judge_prompt_text) {
        logger.info('Creating new judge prompt version', { persona_id });

        const newVersion = createJudgePromptVersion(
          {
            persona_id,
            prompt_text: judge_prompt_text,
            created_by: 'human',
          },
          db
        );

        judgePromptVersionId = newVersion.id;
        logger.info('New judge prompt version created', { persona_id, version_id: newVersion.id });
      }
    }

    // Verify we have a judge prompt version to use
    if (!judgePromptVersionId) {
      logger.logApiRequest('POST', '/api/judge/evaluate', 400, Date.now() - startTime);
      return badRequest(
        'No judge prompt version available. Please provide judge_prompt_text.',
        'NO_JUDGE_PROMPT'
      );
    }

    // Evaluate with judge
    logger.info('Starting judge evaluation', { persona_id, judgePromptVersionId });

    const result = await evaluateWithJudge(
      {
        persona_id,
        judge_prompt_version_id: judgePromptVersionId,
        training_pair_result_ids,
      },
      db
    );

    logger.logApiRequest('POST', '/api/judge/evaluate', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        evaluation_run_id: result.evaluation_run_id,
        total_results: result.total_results,
        evaluated_results: result.evaluated_results,
        judge_prompt_version_id: judgePromptVersionId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/judge/evaluate', error as Error);
    return createErrorResponse(error);
  }
};
