// src/pages/api/prompts/optimize-judge.ts
// API endpoint to analyze failures and suggest judge prompt improvements using LLM

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { optimizePrompt } from '@lib/training/prompt-optimizer';
import {
  createJudgePromptVersion,
  getCurrentJudgePromptVersion,
} from '@lib/training/version-manager';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { parseJsonBody } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Prompts:OptimizeJudge');

/**
 * POST /api/prompts/optimize-judge
 * Analyzes failures and suggests judge prompt improvements using LLM
 *
 * Request body:
 * {
 *   persona_id: string;
 *   evaluation_run_id?: string; // Optional: analyze specific run
 *   max_examples?: number; // Optional: max examples to include (default: 10)
 *   apply_improvements?: boolean; // Optional: auto-create new version (default: false)
 * }
 *
 * Response:
 * {
 *   optimization: {
 *     improved_prompt: string | null;
 *     rationale: string;
 *     expected_impact: string;
 *   };
 *   new_version_id?: string; // Included if apply_improvements=true
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      persona_id: string;
      evaluation_run_id?: string;
      max_examples?: number;
      apply_improvements?: boolean;
    }>(request);

    const { persona_id, evaluation_run_id, max_examples = 10, apply_improvements = false } = body;

    if (!persona_id) {
      logger.logApiRequest('POST', '/api/prompts/optimize-judge', 400, Date.now() - startTime);
      return badRequest('persona_id is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists and has prompt_engineer_model_id
    const persona = db
      .prepare('SELECT id, name, prompt_engineer_model_id FROM personas WHERE id = ?')
      .get(persona_id) as
      | { id: string; name: string; prompt_engineer_model_id: string }
      | undefined;

    if (!persona) {
      logger.logApiRequest('POST', '/api/prompts/optimize-judge', 404, Date.now() - startTime);
      return notFound('Persona');
    }

    if (!persona.prompt_engineer_model_id) {
      logger.logApiRequest('POST', '/api/prompts/optimize-judge', 400, Date.now() - startTime);
      return badRequest(
        'Persona does not have a prompt_engineer_model_id configured',
        'NO_PROMPT_ENGINEER'
      );
    }

    // Verify persona has current judge prompt
    const currentVersion = getCurrentJudgePromptVersion(persona_id, db);
    if (!currentVersion) {
      logger.logApiRequest('POST', '/api/prompts/optimize-judge', 400, Date.now() - startTime);
      return badRequest(
        'Persona does not have a current judge prompt version',
        'NO_CURRENT_PROMPT'
      );
    }

    // Run prompt optimization
    logger.info('Starting judge prompt optimization', { persona_id, evaluation_run_id });

    const optimization = await optimizePrompt(
      {
        persona_id,
        prompt_type: 'judge',
        evaluation_run_id,
        max_examples,
      },
      db
    );

    // Optionally apply improvements by creating a new version
    let new_version_id: string | undefined;

    if (apply_improvements && optimization.improved_prompt) {
      logger.info('Applying judge prompt improvements', { persona_id });

      const newVersion = createJudgePromptVersion(
        {
          persona_id,
          prompt_text: optimization.improved_prompt,
          improvement_rationale: optimization.rationale,
          label: `AI-optimized: ${optimization.expected_impact.substring(0, 50)}`,
          created_by: 'ai',
        },
        db
      );

      new_version_id = newVersion.id;
      logger.info('New judge prompt version created', { persona_id, version_id: new_version_id });
    }

    logger.logApiRequest('POST', '/api/prompts/optimize-judge', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        optimization: {
          improved_prompt: optimization.improved_prompt,
          rationale: optimization.rationale,
          expected_impact: optimization.expected_impact,
        },
        new_version_id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/prompts/optimize-judge', error as Error);
    return createErrorResponse(error);
  }
};
