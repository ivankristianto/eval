// src/pages/api/results.ts
// Evaluation results endpoint

import type { APIRoute } from 'astro';
import { getEvaluation, getResults } from '../../lib/db';

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

    const evaluation = getEvaluation(evaluationId);

    if (!evaluation) {
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

    const results = getResults(evaluationId);

    // Sort by accuracy descending (only for completed results)
    const sortedResults = results.sort((a, b) => (b.accuracy_score || 0) - (a.accuracy_score || 0));

    return new Response(
      JSON.stringify({
        evaluation_id: evaluationId,
        evaluation_status: evaluation.status,
        instruction_text: evaluation.instruction_text,
        accuracy_rubric: evaluation.accuracy_rubric,
        expected_output: evaluation.expected_output || '',
        created_at: evaluation.created_at,
        completed_at: evaluation.completed_at || '',
        results: sortedResults.map((r) => ({
          model_id: r.model_id,
          model_name: r.model_name,
          provider: r.provider,
          status: r.status,
          execution_time_ms: r.execution_time_ms || 0,
          input_tokens: r.input_tokens || 0,
          output_tokens: r.output_tokens || 0,
          total_tokens: r.total_tokens || 0,
          accuracy_score: r.accuracy_score || 0,
          accuracy_reasoning: r.accuracy_reasoning || '',
          response_text: r.response_text || '',
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/results error:', error);
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
