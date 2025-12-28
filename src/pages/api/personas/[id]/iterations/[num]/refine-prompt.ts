/**
 * POST /api/personas/[id]/iterations/[num]/refine-prompt
 * Trigger AI-powered prompt refinement based on failure analysis
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { analyzeIterationFailures } from '@lib/training/failure-analysis';
import { refineJudgePrompt } from '@lib/training/prompt-engineer';

/**
 * POST /api/personas/[id]/iterations/[num]/refine-prompt
 * Triggers AI-powered prompt refinement based on failure analysis.
 * Requires the iteration to be in 'completed' status.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params }) => {
  try {
    const { id, num } = params;

    if (!id || !num) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Persona ID and iteration number are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Iteration number must be a valid integer',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as any;
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Persona not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get iteration
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, iterationNumber) as any;

    if (!iteration) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: `Iteration ${iterationNumber} not found for persona`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify iteration is completed
    if (iteration.status !== 'completed') {
      return new Response(
        JSON.stringify({
          error: 'INVALID_STATE',
          message: `Cannot refine prompt for iteration with status: ${iteration.status}. Iteration must be completed.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Analyze iteration failures
    const failureContext = await analyzeIterationFailures(iteration.id, db);

    // Call prompt engineer to refine prompt
    const refinementResult = await refineJudgePrompt(
      failureContext,
      persona.prompt_engineer_model_id
    );

    // If LLM failed, return error
    if (refinementResult.error || !refinementResult.improved_prompt) {
      return new Response(
        JSON.stringify({
          error: 'REFINEMENT_FAILED',
          message: refinementResult.error || 'Failed to generate improved prompt',
          fallback_to_manual: true,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
    console.error('POST /api/personas/[id]/iterations/[num]/refine-prompt error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
