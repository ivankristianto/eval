/**
 * GET /api/personas/[id]/iterations/[num]/decisions
 * Fetch all judge decisions for an iteration awaiting human review
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Decisions');

/**
 * GET /api/personas/[id]/iterations/[num]/decisions
 * Retrieves all judge decisions for a specific iteration.
 * Includes training pair details and existing human reviews.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id, num } = params;

  try {
    if (!id || !num) {
      logger.logApiRequest(
        'GET',
        '/api/personas/[id]/iterations/[num]/decisions',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID and iteration number are required', 'INVALID_REQUEST');
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/iterations/${num}/decisions`,
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
        'GET',
        `/api/personas/${id}/iterations/${num}/decisions`,
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
        'GET',
        `/api/personas/${id}/iterations/${num}/decisions`,
        404,
        Date.now() - startTime
      );
      return notFound('Iteration');
    }

    // Fetch all judge decisions with training pair info and human review status
    const decisions = db
      .prepare(
        `
        SELECT
          jd.id as decision_id,
          jd.generated_output,
          jd.judge_decision,
          jd.judge_confidence,
          jd.judge_reasoning,
          jd.created_at as decision_created_at,
          tp.id as training_pair_id,
          tp.input,
          tp.expected_output,
          hr.id as review_id,
          hr.human_decision,
          hr.human_confidence,
          hr.human_notes,
          hr.created_at as review_created_at
        FROM judge_decisions jd
        JOIN training_pairs tp ON tp.id = jd.training_pair_id
        LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
        WHERE jd.iteration_id = ?
        ORDER BY tp.created_at ASC
      `
      )
      .all(iteration.id) as Array<{
      decision_id: string;
      review_id: string | null;
      training_pair_id: string;
      input: string;
      expected_output: string;
      generated_output: string;
      judge_decision: 'agree' | 'disagree';
      judge_confidence: number | null;
      judge_reasoning: string | null;
      decision_created_at: string;
      human_decision: 'agree' | 'disagree' | null;
      human_confidence: number | null;
      human_notes: string | null;
      review_created_at: string | null;
    }>;

    // Format response
    const formattedDecisions = decisions.map((d) => ({
      decision_id: d.decision_id,
      training_pair: {
        id: d.training_pair_id,
        input: d.input,
        expected_output: d.expected_output,
      },
      judge: {
        generated_output: d.generated_output,
        decision: d.judge_decision,
        confidence: d.judge_confidence,
        reasoning: d.judge_reasoning,
        created_at: d.decision_created_at,
      },
      human_review:
        d.review_id !== null
          ? {
              id: d.review_id,
              decision: d.human_decision as 'agree' | 'disagree',
              confidence: d.human_confidence,
              notes: d.human_notes,
              created_at: d.review_created_at ?? d.decision_created_at,
            }
          : null,
    }));

    // Count reviewed vs pending
    const reviewedCount = formattedDecisions.filter((d) => d.human_review !== null).length;
    const totalCount = formattedDecisions.length;

    logger.logApiRequest(
      'GET',
      `/api/personas/${id}/iterations/${num}/decisions`,
      200,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        iteration: {
          id: iteration.id,
          number: iteration.iteration_number,
          status: iteration.status,
        },
        decisions: formattedDecisions,
        summary: {
          total: totalCount,
          reviewed: reviewedCount,
          pending: totalCount - reviewedCount,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/iterations/${num}/decisions`, error as Error);
    return createErrorResponse(error);
  }
};
