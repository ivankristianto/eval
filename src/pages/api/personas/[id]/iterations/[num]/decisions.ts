/**
 * GET /api/personas/[id]/iterations/[num]/decisions
 * Fetch all judge decisions for an iteration awaiting human review
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../../lib/db';

/**
 * GET /api/personas/[id]/iterations/[num]/decisions
 * Retrieves all judge decisions for a specific iteration.
 * Includes training pair details and existing human reviews.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params }) => {
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
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
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
      .all(iteration.id) as any[];

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
      human_review: d.review_id
        ? {
            id: d.review_id,
            decision: d.human_decision,
            confidence: d.human_confidence,
            notes: d.human_notes,
            created_at: d.review_created_at,
          }
        : null,
    }));

    // Count reviewed vs pending
    const reviewedCount = formattedDecisions.filter((d) => d.human_review !== null).length;
    const totalCount = formattedDecisions.length;

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
    console.error('GET /api/personas/[id]/iterations/[num]/decisions error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
