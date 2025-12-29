/**
 * POST /api/personas/[id]/iterations/[num]/refine-prompt
 * Trigger AI-powered prompt refinement based on failure analysis
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration, Persona } from '@src-types/training';
import { analyzeIterationFailures } from '@lib/training/failure-analysis';
import { refineJudgePrompt } from '@lib/training/prompt-engineer';
import { badRequest, notFound, internalError, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:RefinePrompt');

/**
 * POST /api/personas/[id]/iterations/[num]/refine-prompt
 * Triggers AI-powered prompt refinement based on failure analysis.
 * Requires the iteration to be in 'completed' status.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id, num } = params;

  try {
    if (!id || !num) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/iterations/[num]/refine-prompt',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID and iteration number are required', 'INVALID_REQUEST');
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/refine-prompt`,
        400,
        Date.now() - startTime
      );
      return badRequest('Iteration number must be a valid integer', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/refine-prompt`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Get iteration
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, iterationNumber) as TrainingIteration | undefined;

    if (!iteration) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/refine-prompt`,
        404,
        Date.now() - startTime
      );
      return notFound('Iteration');
    }

    // Verify iteration is completed
    if (iteration.status !== 'completed') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/refine-prompt`,
        400,
        Date.now() - startTime
      );
      return badRequest(
        `Cannot refine prompt for iteration with status: ${iteration.status}. Iteration must be completed.`,
        'INVALID_STATE'
      );
    }

    logger.info('Starting AI-powered prompt refinement', {
      personaId: id,
      iterationNumber,
      iterationId: iteration.id,
    });

    // Analyze iteration failures
    const failureContext = await analyzeIterationFailures(iteration.id, db);

    // Call prompt engineer to refine prompt
    const refinementResult = await refineJudgePrompt(
      failureContext,
      (persona as Persona).prompt_engineer_model_id
    );

    // If LLM failed, return error
    if (refinementResult.error || !refinementResult.improved_prompt) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/refine-prompt`,
        500,
        Date.now() - startTime
      );
      return internalError(refinementResult.error || 'Failed to generate improved prompt', {
        code: 'REFINEMENT_FAILED',
        fallback_to_manual: true,
      });
    }

    logger.info('AI-powered prompt refinement successful', {
      personaId: id,
      iterationNumber,
      hasRationale: !!refinementResult.rationale,
      hasExpectedImpact: !!refinementResult.expected_impact,
    });
    logger.logApiRequest(
      'POST',
      `/api/personas/${id}/iterations/${num}/refine-prompt`,
      200,
      Date.now() - startTime
    );

    // Return refined prompt for user review
    return new Response(
      JSON.stringify({
        improved_prompt: refinementResult.improved_prompt,
        rationale: refinementResult.rationale,
        expected_impact: refinementResult.expected_impact,
        current_prompt: failureContext.current_prompt,
        current_metrics: failureContext.current_metrics,
        iteration_number: iterationNumber,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError(
      'POST',
      `/api/personas/${id}/iterations/${num}/refine-prompt`,
      error as Error
    );
    return createErrorResponse(error);
  }
};
