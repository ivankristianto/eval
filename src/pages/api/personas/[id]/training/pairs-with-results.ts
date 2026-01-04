/**
 * GET /api/personas/[id]/training/pairs-with-results
 *
 * Retrieves all training pairs for a persona with their latest results.
 * Supports polling for real-time updates as generation/evaluation progresses.
 */

import type { APIRoute } from 'astro';
import { getPersona } from '@lib/db/persona-db';
import { getDatabase } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:PairsWithResults');

interface TrainingPairWithResults {
  id: string;
  input: string;
  expected_output: string;
  generated_output?: string;
  judge_rating?: 'pass' | 'fail';
  judge_feedback?: string;
  human_rating?: 'pass' | 'fail';
  human_feedback?: string;
  created_at: string;
  result_updated_at?: string;
}

/**
 * GET /api/personas/[id]/training/pairs-with-results
 * Retrieves all training pairs with their latest results.
 * Useful for polling to update the UI in real-time.
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
        '/api/personas/[id]/training/pairs-with-results',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    // Verify persona exists
    const persona = getPersona(id);
    if (!persona) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/training/pairs-with-results`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Retrieve training pairs with their latest results
    const db = getDatabase();

    // Get pairs with their most recent results
    const pairsWithResults = db
      .prepare(
        `SELECT
          tp.id,
          tp.input,
          tp.expected_output,
          tp.created_at,
          tpr.generated_output,
          tpr.judge_rating,
          tpr.judge_feedback,
          tpr.human_rating,
          tpr.human_feedback,
          tpr.updated_at as result_updated_at
        FROM training_pairs tp
        LEFT JOIN (
          SELECT
            training_pair_id,
            generated_output,
            judge_rating,
            judge_feedback,
            human_rating,
            human_feedback,
            updated_at,
            ROW_NUMBER() OVER (PARTITION BY training_pair_id ORDER BY updated_at DESC) as rn
          FROM training_pair_results
        ) tpr ON tp.id = tpr.training_pair_id AND tpr.rn = 1
        WHERE tp.persona_id = ?
        ORDER BY tp.created_at ASC`
      )
      .all(id) as TrainingPairWithResults[];

    // Count stats for progress tracking
    const stats = {
      total_pairs: pairsWithResults.length,
      with_generated_output: pairsWithResults.filter((p) => p.generated_output).length,
      with_judge_rating: pairsWithResults.filter((p) => p.judge_rating).length,
      with_human_rating: pairsWithResults.filter((p) => p.human_rating).length,
    };

    logger.logApiRequest(
      'GET',
      `/api/personas/${id}/training/pairs-with-results`,
      200,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        persona_id: id,
        stats,
        pairs: pairsWithResults,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/training/pairs-with-results`, error as Error);
    return createErrorResponse(error);
  }
};
