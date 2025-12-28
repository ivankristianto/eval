/**
 * POST /api/personas/[id]/iterations/[num]/accept-prompt
 *
 * For iteration 1: Accept refined prompts and continue training
 * - Calculates metrics from human votes
 * - Refines both prompts using LLM based on human feedback
 * - Continues to iteration 2 automatically
 *
 * For iterations 2+: Accept refined prompt (AI-generated or manually edited) and store version
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { storePromptVersion } from '@lib/training/prompt-version-manager';
import { IterativeTrainingLoop } from '@lib/training/training-loop';

/**
 * POST /api/personas/[id]/iterations/[num]/accept-prompt
 *
 * ITERATION 1: Special workflow - calculates metrics from human reviews, refines both prompts, continues to iteration 2
 * ITERATIONS 2+: Stores prompt version (for manual edits or alternative prompts)
 *
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
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

    // Verify persona exists first
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

    // Get iteration to verify it exists
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

    // ITERATION 1: Special workflow - calculate metrics from human reviews, refine prompts, continue to iteration 2
    if (iterationNumber === 1) {
      // Verify all human reviews are complete
      const decisionsWithoutReview = db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM judge_decisions jd
          LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
          WHERE jd.iteration_id = ? AND hr.id IS NULL
        `
        )
        .get(iteration.id) as { count: number };

      if (decisionsWithoutReview.count > 0) {
        return new Response(
          JSON.stringify({
            error: 'INCOMPLETE_REVIEWS',
            message: `${decisionsWithoutReview.count} judge decisions have not been reviewed. All decisions must be reviewed before accepting prompts.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get training loop state - must be awaiting_human_review for iteration 1 accept
      const state = db
        .prepare(
          `SELECT session_id FROM training_loop_state
           WHERE persona_id = ? AND status = 'awaiting_human_review'
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(id) as { session_id: string } | undefined;

      if (!state) {
        return new Response(
          JSON.stringify({
            error: 'NO_ACTIVE_SESSION',
            message: 'No training session awaiting human review found for this persona',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create training loop instance and accept prompts
      const loop = new IterativeTrainingLoop(state.session_id, id, db);

      // This will:
      // 1. Calculate metrics from human votes
      // 2. Refine both prompts using LLM based on human feedback
      // 3. Continue to iteration 2 automatically
      await loop.acceptPromptsAndContinue(iteration.id);

      // Get final state after training continues
      const finalState = db
        .prepare('SELECT status, current_iteration FROM training_loop_state WHERE session_id = ?')
        .get(state.session_id) as { status: string; current_iteration: number } | undefined;

      const latestIteration = db
        .prepare('SELECT iteration_number, status FROM training_iterations WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1')
        .get(id) as { iteration_number: number; status: string } | undefined;

      return new Response(
        JSON.stringify({
          message: 'Iteration 1 human review complete. Metrics calculated, prompts refined, and training continued.',
          iteration_number: 1,
          training_status: finalState?.status || 'unknown',
          current_iteration: finalState?.current_iteration,
          latest_iteration: latestIteration?.iteration_number,
          latest_iteration_status: latestIteration?.status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ITERATIONS 2+: Original behavior - accept manual prompt edit
    // Parse request body
    const body = await request.json();
    const { prompt_text, reason } = body;

    // Validate required fields
    if (!prompt_text) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'prompt_text is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate reason
    if (reason !== 'ai-generated' && reason !== 'manual-edit') {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'reason must be either "ai-generated" or "manual-edit"',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine created_by based on reason
    const createdBy = reason === 'ai-generated' ? 'ai' : 'human';

    // Store prompt version
    const rationale =
      reason === 'ai-generated'
        ? 'AI-generated improvement based on failure analysis'
        : 'Manually edited by user';

    const versionId = await storePromptVersion(
      id,
      iterationNumber,
      prompt_text,
      rationale,
      createdBy,
      db
    );

    if (!versionId) {
      return new Response(
        JSON.stringify({
          error: 'DUPLICATE_PROMPT',
          message: 'This prompt is identical to the previous version and was not stored',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        version_id: versionId,
        prompt_text,
        reason,
        created_by: createdBy,
        iteration_number: iterationNumber,
        message: 'Prompt version stored successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/personas/[id]/iterations/[num]/accept-prompt error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
