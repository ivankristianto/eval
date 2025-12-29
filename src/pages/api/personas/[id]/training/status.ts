/**
 * GET /api/personas/[id]/training/status
 * Get current training status for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Status');

/**
 * GET /api/personas/[id]/training/status
 * Retrieves current training status, metrics, and loop state for a persona.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest(
        'GET',
        '/api/personas/[id]/training/status',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/training/status`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Get latest iteration with metrics
    const latestIteration = db
      .prepare(
        `
        SELECT
          ti.id,
          ti.iteration_number,
          ti.status,
          ti.total_pairs_evaluated,
          ti.pairs_reviewed_by_human,
          ti.started_at,
          ti.completed_at,
          ti.error_message,
          im.f1_score,
          im.precision,
          im.recall,
          im.cohens_kappa,
          im.accuracy,
          im.true_positives,
          im.true_negatives,
          im.false_positives,
          im.false_negatives
        FROM training_iterations ti
        LEFT JOIN iteration_metrics im ON im.iteration_id = ti.id
        WHERE ti.persona_id = ?
        ORDER BY ti.iteration_number DESC
        LIMIT 1
      `
      )
      .get(id) as any;

    // Get training loop state if active
    const loopState = db
      .prepare(
        'SELECT * FROM training_loop_state WHERE persona_id = ? ORDER BY updated_at DESC LIMIT 1'
      )
      .get(id) as any;

    // Build response
    const response: any = {
      persona_id: id,
      current_iteration: latestIteration || null,
      training_loop_state: loopState || null,
    };

    // Add metrics if available
    if (latestIteration?.f1_score !== undefined) {
      response.current_iteration.metrics = {
        f1_score: latestIteration.f1_score,
        precision: latestIteration.precision,
        recall: latestIteration.recall,
        cohens_kappa: latestIteration.cohens_kappa,
        accuracy: latestIteration.accuracy,
        confusion_matrix: {
          true_positives: latestIteration.true_positives,
          true_negatives: latestIteration.true_negatives,
          false_positives: latestIteration.false_positives,
          false_negatives: latestIteration.false_negatives,
        },
      };

      // Remove redundant fields
      delete response.current_iteration.f1_score;
      delete response.current_iteration.precision;
      delete response.current_iteration.recall;
      delete response.current_iteration.cohens_kappa;
      delete response.current_iteration.accuracy;
      delete response.current_iteration.true_positives;
      delete response.current_iteration.true_negatives;
      delete response.current_iteration.false_positives;
      delete response.current_iteration.false_negatives;
    }

    logger.logApiRequest('GET', `/api/personas/${id}/training/status`, 200, Date.now() - startTime);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/training/status`, error as Error);
    return createErrorResponse(error);
  }
};
