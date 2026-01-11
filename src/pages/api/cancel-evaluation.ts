// src/pages/api/cancel-evaluation.ts
// Cancel a running evaluation

import type { APIRoute } from 'astro';
import { getEvaluation } from '@lib/db';
import { cancelEvaluation } from '@lib/evaluation/evaluator';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:CancelEvaluation');

/**
 * POST /api/cancel-evaluation
 * Cancels a running evaluation process.
 * @param root0
 * @param root0.request
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { evaluation_id } = body;

    if (!evaluation_id) {
      logger.logApiRequest('POST', '/api/cancel-evaluation', 400, Date.now() - startTime);
      return badRequest('evaluation_id is required', 'INVALID_INPUT');
    }

    const evaluation = getEvaluation(evaluation_id);

    if (!evaluation) {
      logger.logApiRequest('POST', '/api/cancel-evaluation', 404, Date.now() - startTime);
      return badRequest('Evaluation does not exist', 'EVALUATION_NOT_FOUND', {
        evaluation_id,
      });
    }

    if (evaluation.status === 'completed' || evaluation.status === 'failed') {
      logger.logApiRequest('POST', '/api/cancel-evaluation', 409, Date.now() - startTime);
      // Return error code in error field and status at top level for test compatibility
      return new Response(JSON.stringify({ error: 'CANNOT_CANCEL', status: evaluation.status }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info('Cancelling evaluation', { evaluationId: evaluation_id });

    cancelEvaluation(evaluation_id);

    logger.info('Evaluation cancelled successfully', { evaluationId: evaluation_id });
    logger.logApiRequest('POST', '/api/cancel-evaluation', 200, Date.now() - startTime);

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
    logger.logApiError('POST', '/api/cancel-evaluation', error as Error);
    return createErrorResponse(error);
  }
};
