// src/pages/api/judge/evaluate.ts
// API endpoint to trigger judge evaluation for training pair results

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { evaluateWithJudge } from '@lib/training/judge-runner';
import {
  createJudgePromptVersion,
  getCurrentJudgePromptVersion,
} from '@lib/training/version-manager';
import { repairJudgePromptVersion } from '@lib/training/persona-repair';
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
 *   training_pair_result_ids?: string[]; // Optional: specific result IDs to evaluate
 *   training_pair_ids?: string[]; // Optional: specific training pair IDs to evaluate (will be resolved to result IDs)
 * }
 *
 * Response:
 * {
 *   evaluation_run_id: string;
 *   total_results: number;
 *   evaluated_results: number;
 *   judge_prompt_version_id?: string; // Included if new version was created
 *   results: Array<{id, training_pair_id, judge_rating, judge_feedback, judge_reasoning, updated_at}>; // For optimistic updates
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      persona_id: string;
      judge_prompt_text?: string;
      training_pair_result_ids?: string[];
      training_pair_ids?: string[];
    }>(request);

    const { persona_id, judge_prompt_text, training_pair_result_ids, training_pair_ids } = body;

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

    // Fallback: if current_judge_prompt_version_id is null, attempt auto-repair
    if (!judgePromptVersionId) {
      logger.info('No current judge prompt version set, attempting auto-repair', {
        persona_id,
      });

      const repairResult = repairJudgePromptVersion(db, {
        personaId: persona_id,
        promptText: judge_prompt_text,
      });

      if (!repairResult.success) {
        logger.logApiRequest('POST', '/api/judge/evaluate', 400, Date.now() - startTime);

        // Provide specific error messages based on failure reason
        switch (repairResult.reason) {
          case 'version_0_missing': {
            // Check if any versions exist at all
            const hasAnyVersions = db
              .prepare('SELECT COUNT(*) as count FROM judge_prompt_versions WHERE persona_id = ?')
              .get(persona_id) as { count: number };

            if (hasAnyVersions.count === 0) {
              return badRequest(
                'No judge prompt versions exist for this persona.',
                'NO_JUDGE_VERSIONS'
              );
            }

            // Version 0 specifically missing - potential data corruption
            logger.error('Judge prompt version 0 missing, data corruption suspected', undefined, {
              persona_id,
            });
            return badRequest(
              'Judge prompt version 0 is missing. Please reinitialize the persona.',
              'CORRUPTED_DATA'
            );
          }
          case 'persona_deleted':
            return badRequest('Persona not found.', 'PERSONA_NOT_FOUND');
          default:
            return badRequest(
              'No judge prompt version available. Please provide judge_prompt_text.',
              'NO_JUDGE_PROMPT'
            );
        }
      }

      judgePromptVersionId = repairResult.versionId;
    }

    // Resolve training_pair_ids to training_pair_result_ids if provided
    let resolvedResultIds = training_pair_result_ids;

    if (training_pair_ids && training_pair_ids.length > 0) {
      logger.info('Resolving training_pair_ids to training_pair_result_ids', {
        persona_id,
        pair_ids: training_pair_ids,
      });

      // Query only the LATEST result for each training pair
      // Use a subquery to get the latest result per training pair
      const placeholders = training_pair_ids.map(() => '?').join(',');
      const existingResults = db
        .prepare(
          `SELECT
             tpr.id,
             tpr.training_pair_id,
             tpr.generated_output,
             tpr.judge_rating
           FROM training_pair_results tpr
           INNER JOIN (
             SELECT training_pair_id, MAX(created_at) as max_created_at
             FROM training_pair_results
             WHERE persona_id = ? AND training_pair_id IN (${placeholders})
             GROUP BY training_pair_id
           ) latest ON tpr.training_pair_id = latest.training_pair_id
                      AND tpr.created_at = latest.max_created_at
           WHERE tpr.persona_id = ?`
        )
        .all(persona_id, ...training_pair_ids, persona_id) as Array<{
        id: string;
        training_pair_id: string;
        generated_output: string | null;
        judge_rating: string | null;
      }>;

      // Filter to results that have generated_output and no judge_rating
      const validResults = existingResults.filter(
        (r) => r.generated_output !== null && r.judge_rating === null
      );

      // Log warnings for pairs that don't have valid results
      const pairIdsWithResults = new Set(existingResults.map((r) => r.training_pair_id));
      const pairIdsWithoutResults = training_pair_ids.filter((id) => !pairIdsWithResults.has(id));
      if (pairIdsWithoutResults.length > 0) {
        logger.warn('Some training pairs have no results, skipping them', {
          persona_id,
          skipped_pairs: pairIdsWithoutResults,
        });
      }

      const pairIdsWithRatedResults = existingResults
        .filter((r) => r.judge_rating !== null)
        .map((r) => r.training_pair_id);
      if (pairIdsWithRatedResults.length > 0) {
        logger.warn('Some training pairs already have judge ratings, skipping them', {
          persona_id,
          rated_pairs: pairIdsWithRatedResults,
        });
      }

      if (validResults.length === 0) {
        logger.logApiRequest('POST', '/api/judge/evaluate', 400, Date.now() - startTime);
        return badRequest(
          'No valid training pair results found for the selected pairs. Results must have generated_output and no existing judge_rating.',
          'NO_VALID_RESULTS'
        );
      }

      resolvedResultIds = validResults.map((r) => r.id);
      logger.info('Resolved training_pair_ids to training_pair_result_ids', {
        persona_id,
        requested_count: training_pair_ids.length,
        resolved_count: resolvedResultIds.length,
      });
    }

    // Evaluate with judge
    logger.info('Starting judge evaluation', { persona_id, judgePromptVersionId });

    const result = await evaluateWithJudge(
      {
        persona_id,
        judge_prompt_version_id: judgePromptVersionId,
        training_pair_result_ids: resolvedResultIds,
      },
      db
    );

    logger.logApiRequest('POST', '/api/judge/evaluate', 200, Date.now() - startTime);

    // Return results for optimistic updates - include the actual judge decisions
    return new Response(
      JSON.stringify({
        evaluation_run_id: result.evaluation_run_id,
        total_results: result.total_results,
        evaluated_results: result.evaluated_results,
        judge_prompt_version_id: judgePromptVersionId,
        results: result.results.map((r) => ({
          id: r.id,
          training_pair_id: r.training_pair_id,
          judge_rating: r.judge_rating,
          judge_feedback: r.judge_feedback,
          judge_reasoning: r.judge_reasoning,
          updated_at: r.updated_at,
        })),
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
