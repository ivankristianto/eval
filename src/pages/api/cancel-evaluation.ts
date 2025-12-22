// src/pages/api/cancel-evaluation.ts
// Cancel a running evaluation

import type { APIRoute } from 'astro';
import { getEvaluation } from '../../lib/db';
import { cancelEvaluation } from '../../lib/evaluator';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { evaluation_id } = body;

    if (!evaluation_id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'evaluation_id is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const evaluation = getEvaluation(evaluation_id);

    if (!evaluation) {
      return new Response(
        JSON.stringify({
          error: 'EVALUATION_NOT_FOUND',
          message: 'Evaluation does not exist',
          evaluation_id,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (evaluation.status === 'completed' || evaluation.status === 'failed') {
      return new Response(
        JSON.stringify({
          error: 'CANNOT_CANCEL',
          message: 'Evaluation already completed',
          status: evaluation.status,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    cancelEvaluation(evaluation_id);

    return new Response(
      JSON.stringify({
        evaluation_id,
        status: 'cancelled',
        message: 'Evaluation cancelled successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('POST /api/cancel-evaluation error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
