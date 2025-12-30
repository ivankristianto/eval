/**
 * POST /api/personas/[id]/reset
 * Reset a persona's training data and return to initial state.
 *
 * Deletes all training-related data:
 * - iteration_metrics
 * - judge_decisions
 * - human_reviews
 * - judge_prompt_versions
 * - task_prompt_versions
 * - training_iterations
 * - training_loop_checkpoints
 * - training_loop_state
 *
 * Resets persona status to 'draft' and iteration counters to 0.
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { Persona } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Persona:Reset');

/**
 * POST /api/personas/[id]/reset
 * Resets all training data for a persona and returns it to draft state.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('POST', '/api/personas/[id]/reset', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as
      | Persona
      | undefined;

    if (!persona) {
      logger.logApiRequest('POST', `/api/personas/${id}/reset`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    logger.info('Resetting persona training data', { personaId: id });

    // Use a transaction to ensure all deletions and updates succeed atomically
    const resetTransaction = db.transaction(() => {
      // Delete human_reviews (must be done before judge_decisions due to foreign key)
      const deletedHumanReviews = db
        .prepare(
          `DELETE FROM human_reviews
           WHERE judge_decision_id IN (
             SELECT jd.id FROM judge_decisions jd
             JOIN training_iterations ti ON ti.id = jd.iteration_id
             WHERE ti.persona_id = ?
           )`
        )
        .run(id).changes;

      // Delete iteration_metrics
      const deletedMetrics = db
        .prepare(
          `DELETE FROM iteration_metrics
           WHERE iteration_id IN (
             SELECT id FROM training_iterations WHERE persona_id = ?
           )`
        )
        .run(id).changes;

      // Delete judge_decisions
      const deletedDecisions = db
        .prepare(
          `DELETE FROM judge_decisions
           WHERE iteration_id IN (
             SELECT id FROM training_iterations WHERE persona_id = ?
           )`
        )
        .run(id).changes;

      // Delete judge_prompt_versions
      const deletedJudgePromptVersions = db
        .prepare('DELETE FROM judge_prompt_versions WHERE persona_id = ?')
        .run(id).changes;

      // Delete task_prompt_versions
      const deletedTaskPromptVersions = db
        .prepare('DELETE FROM task_prompt_versions WHERE persona_id = ?')
        .run(id).changes;

      // Delete training_loop_checkpoints (via session_id in training_loop_state)
      const deletedCheckpoints = db
        .prepare(
          `DELETE FROM training_loop_checkpoints
           WHERE session_id IN (
             SELECT session_id FROM training_loop_state WHERE persona_id = ?
           )`
        )
        .run(id).changes;

      // Delete training_loop_state for this persona
      const deletedLoopState = db
        .prepare('DELETE FROM training_loop_state WHERE persona_id = ?')
        .run(id).changes;

      // Delete training_iterations last (after cascading deletes)
      const deletedIterations = db
        .prepare('DELETE FROM training_iterations WHERE persona_id = ?')
        .run(id).changes;

      // Reset persona to initial state
      db.prepare(
        `UPDATE personas
         SET status = 'draft',
             current_iteration = 0,
             best_f1_score = NULL,
             best_f1_iteration = NULL,
             updated_at = ?
         WHERE id = ?`
      ).run(new Date().toISOString(), id);

      return {
        deletedHumanReviews,
        deletedMetrics,
        deletedDecisions,
        deletedJudgePromptVersions,
        deletedTaskPromptVersions,
        deletedIterations,
        deletedCheckpoints,
        deletedLoopState,
      };
    });

    const result = resetTransaction();

    logger.info('Persona reset complete', {
      personaId: id,
      deletedIterations: result.deletedIterations,
      deletedDecisions: result.deletedDecisions,
      deletedMetrics: result.deletedMetrics,
    });

    logger.logApiRequest('POST', `/api/personas/${id}/reset`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        message: 'Persona training data reset successfully',
        deleted: {
          human_reviews: result.deletedHumanReviews,
          iteration_metrics: result.deletedMetrics,
          judge_decisions: result.deletedDecisions,
          judge_prompt_versions: result.deletedJudgePromptVersions,
          task_prompt_versions: result.deletedTaskPromptVersions,
          training_iterations: result.deletedIterations,
          training_loop_checkpoints: result.deletedCheckpoints,
          training_loop_state: result.deletedLoopState,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/reset`, error as Error);
    return createErrorResponse(error);
  }
};
