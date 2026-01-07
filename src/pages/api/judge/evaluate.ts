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
const INITIAL_JUDGE_VERSION = 0;

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

    // Fallback: if current_judge_prompt_version_id is null, try to find initial judge prompt (version 0)
    if (!judgePromptVersionId) {
      logger.info('No current judge prompt version set, falling back to initial version', {
        persona_id,
      });

      /**
       * Repair transaction: Auto-repair persona with null current_judge_prompt_version_id
       *
       * Implements atomic read-repair operation with:
       * 1. Re-verify persona still needs repair (handles concurrent requests)
       * 2. Find initial judge prompt version (version 0)
       * 3. Update persona to point to initial version
       * 4. If judge_prompt_text provided, create new version after repair
       *
       * @returns The judge prompt version ID to use, or null if repair failed
       */
      const repairTx = db.transaction(() => {
        // Re-verify persona still needs repair (handles concurrent requests)
        const personaCheckStmt = db.prepare(
          'SELECT current_judge_prompt_version_id FROM personas WHERE id = ?'
        );
        const personaCheck = personaCheckStmt.get(persona_id) as
          | {
              current_judge_prompt_version_id: string | null;
            }
          | undefined;

        if (!personaCheck) {
          return null; // Persona was deleted
        }

        // If another request already repaired it, use that value
        if (personaCheck.current_judge_prompt_version_id) {
          return personaCheck.current_judge_prompt_version_id;
        }

        // Find initial judge prompt version
        const initialVersionStmt = db.prepare(
          'SELECT id FROM judge_prompt_versions WHERE persona_id = ? AND version_number = ?'
        );
        const initialVersion = initialVersionStmt.get(persona_id, INITIAL_JUDGE_VERSION) as
          | { id: string }
          | undefined;

        if (initialVersion) {
          // Update persona to set the current version
          const updateResult = db
            .prepare(
              'UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?'
            )
            .run(initialVersion.id, new Date().toISOString(), persona_id);

          // Verify the update succeeded (persona might have been deleted)
          if (updateResult.changes === 0) {
            return null;
          }

          logger.info('Repaired persona: set current_judge_prompt_version_id to initial version', {
            persona_id,
            version_id: initialVersion.id,
          });

          // If user provided judge_prompt_text, create a new version after repair
          if (judge_prompt_text) {
            logger.info(
              'judge_prompt_text provided but persona was repaired to version 0; creating new version',
              { persona_id }
            );

            const newVersion = createJudgePromptVersion(
              {
                persona_id,
                prompt_text: judge_prompt_text,
                created_by: 'human',
              },
              db
            );

            logger.info('New judge prompt version created', {
              persona_id,
              version_id: newVersion.id,
            });
            return newVersion.id;
          }

          return initialVersion.id;
        }

        return null;
      });

      judgePromptVersionId = repairTx();

      if (!judgePromptVersionId) {
        logger.logApiRequest('POST', '/api/judge/evaluate', 400, Date.now() - startTime);
        return badRequest(
          'No judge prompt version available. Please provide judge_prompt_text.',
          'NO_JUDGE_PROMPT'
        );
      }
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
