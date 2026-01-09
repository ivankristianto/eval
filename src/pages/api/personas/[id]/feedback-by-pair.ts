/**
 * POST /api/personas/[id]/feedback-by-pair
 * Submit human review feedback for a training pair by training_pair_id
 * This endpoint bridges the frontend (which has pair_id) to the backend feedback API (which expects result_id)
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:FeedbackByPair');

/**
 * POST /api/personas/[id]/feedback-by-pair
 * Submits human review feedback for a training pair using training_pair_id instead of result_id.
 * Fetches the latest result_id for the given training_pair_id and submits feedback.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/feedback-by-pair',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    // Parse request body
    const body = await request.json();
    const { training_pair_id, human_rating, human_feedback } = body;

    // Validate required fields
    if (!training_pair_id) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/feedback-by-pair`,
        400,
        Date.now() - startTime
      );
      return badRequest('training_pair_id is required', 'INVALID_REQUEST');
    }

    if (!human_rating) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/feedback-by-pair`,
        400,
        Date.now() - startTime
      );
      return badRequest('human_rating is required', 'INVALID_REQUEST');
    }

    // Validate human_rating value
    if (human_rating !== 'pass' && human_rating !== 'fail') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/feedback-by-pair`,
        400,
        Date.now() - startTime
      );
      return badRequest('human_rating must be "pass" or "fail"', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/feedback-by-pair`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Verify training pair exists and belongs to this persona
    const trainingPair = db
      .prepare('SELECT * FROM training_pairs WHERE id = ? AND persona_id = ?')
      .get(training_pair_id, id) as
      | {
          id: string;
          persona_id: string;
        }
      | undefined;

    if (!trainingPair) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/feedback-by-pair`,
        404,
        Date.now() - startTime
      );
      return notFound('Training pair');
    }

    // Fetch the latest training_pair_result for this training_pair_id
    const latestResult = db
      .prepare(
        `
        SELECT * FROM training_pair_results
        WHERE training_pair_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
      )
      .get(training_pair_id) as
      | {
          id: string;
          persona_id: string;
          training_pair_id: string;
          human_rating: string | null;
          human_feedback: string | null;
          updated_at: string;
        }
      | undefined;

    if (!latestResult) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/feedback-by-pair`,
        404,
        Date.now() - startTime
      );
      return notFound('Training pair result');
    }

    // Update the training_pair_result with human feedback
    db.prepare(
      `
      UPDATE training_pair_results
      SET human_rating = ?, human_feedback = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(human_rating, human_feedback || null, new Date().toISOString(), latestResult.id);

    logger.info('Human feedback submitted by pair', {
      personaId: id,
      trainingPairId: training_pair_id,
      resultId: latestResult.id,
      humanRating: human_rating,
    });
    logger.logApiRequest(
      'POST',
      `/api/personas/${id}/feedback-by-pair`,
      200,
      Date.now() - startTime
    );

    // Fetch and return the updated result
    const updatedResult = db
      .prepare('SELECT * FROM training_pair_results WHERE id = ?')
      .get(latestResult.id) as {
      id: string;
      persona_id: string;
      training_pair_id: string;
      generated_output: string | null;
      judge_rating: string | null;
      judge_feedback: string | null;
      judge_reasoning: string | null;
      human_rating: string | null;
      human_feedback: string | null;
      execution_time_ms: number | null;
      input_tokens: number | null;
      output_tokens: number | null;
      total_tokens: number | null;
      created_at: string;
      updated_at: string;
    };

    return new Response(
      JSON.stringify({
        id: updatedResult.id,
        training_pair_id: updatedResult.training_pair_id,
        human_rating: updatedResult.human_rating,
        human_feedback: updatedResult.human_feedback,
        updated_at: updatedResult.updated_at,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/feedback-by-pair`, error as Error);
    return createErrorResponse(error);
  }
};
