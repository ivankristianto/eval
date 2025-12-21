// src/pages/api/evaluation-status.ts
// Evaluation status polling endpoint

import type { APIRoute } from 'astro';
import { getEvaluationStatus } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  try {
    const evaluationId = url.searchParams.get('evaluation_id');

    if (!evaluationId) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'evaluation_id query parameter is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const status = getEvaluationStatus(evaluationId);

    if (!status) {
      return new Response(
        JSON.stringify({
          error: 'EVALUATION_NOT_FOUND',
          message: 'Evaluation does not exist',
          evaluation_id: evaluationId,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        evaluation_id: evaluationId,
        overall_status: status.overall_status,
        created_at: status.created_at,
        completed_at: status.completed_at,
        results: status.results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/evaluation-status error:', error);
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
