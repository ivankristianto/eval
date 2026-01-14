/**
 * GET /api/personas/[id]/iterations/[num]/status
 *
 * Returns the current status of metrics calculation for an iteration.
 * Used for polling by the frontend to track progress.
 *
 * Response states:
 * - calculating: Metrics are currently being computed
 * - completed: Metrics calculation finished successfully
 * - error: Metrics calculation failed
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { Persona, TrainingIteration } from '@src-types/training';
import { badRequest, notFound } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';
import { ErrorCode } from '@lib/error-codes';

const logger = createLogger('API:MetricsStatus');

/**
 * Status response interface
 */
interface MetricsStatusResponse {
  status: 'calculating' | 'completed' | 'error';
  iteration: number;
  persona_id: string;
  message: string;
  progress_percent?: number;
  metrics?: {
    f1_score: number;
    precision: number;
    recall: number;
    cohens_kappa: number;
    accuracy: number;
    confusion_matrix: {
      true_positives: number;
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
    };
  };
  duration_ms?: number;
  calculated_at?: string;
}

/**
 * GET /api/personas/[id]/iterations/[num]/status
 *
 * @param root0
 * @param root0.params
 * @param root0.request
 */
export const GET: APIRoute = async ({ params, request: _request }) => {
  const startTime = Date.now();
  const { id, num } = params;

  try {
    // Validate required parameters
    if (!id || !num) {
      logger.logApiRequest(
        'GET',
        '/api/personas/[id]/iterations/[num]/status',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID and iteration number are required', ErrorCode.INVALID_REQUEST);
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber) || iterationNumber < 1) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/iterations/${num}/status`,
        400,
        Date.now() - startTime
      );
      return badRequest('Iteration number must be a valid integer >= 1', ErrorCode.INVALID_REQUEST);
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as
      | Persona
      | undefined;
    if (!persona) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/iterations/${num}/status`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Get iteration record
    const iterationRecord = db
      .prepare(
        `SELECT ti.*, tls.status as loop_status, tls.task_results_evaluated
         FROM training_iterations ti
         LEFT JOIN training_loop_state tls ON tls.persona_id = ti.persona_id
           AND tls.current_iteration = ti.iteration_number
         WHERE ti.persona_id = ? AND ti.iteration_number = ?`
      )
      .get(id, iterationNumber) as
      | (TrainingIteration & {
          loop_status?: string;
          task_results_evaluated?: number;
          completed_at?: string;
          started_at?: string;
        })
      | undefined;

    if (!iterationRecord) {
      logger.logApiRequest(
        'GET',
        `/api/personas/${id}/iterations/${num}/status`,
        404,
        Date.now() - startTime
      );
      return notFound('Iteration');
    }

    // Calculate duration if completed
    let durationMs: number | undefined;
    if (iterationRecord.completed_at && iterationRecord.started_at) {
      durationMs =
        new Date(iterationRecord.completed_at).getTime() -
        new Date(iterationRecord.started_at).getTime();
    }

    // Build response based on iteration status
    const response: Partial<MetricsStatusResponse> = {
      iteration: iterationNumber,
      persona_id: id,
    };

    switch (iterationRecord.status) {
      case 'in_progress': {
        // Calculate progress percentage if we have total pairs
        let progressPercent = 0;
        if (iterationRecord.total_pairs_evaluated && iterationRecord.total_pairs_evaluated > 0) {
          // Estimate progress based on pairs evaluated
          const trainingPairs = db
            .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
            .get(id) as { count: number };
          const totalPairs = trainingPairs?.count || 0;
          if (totalPairs > 0) {
            progressPercent = Math.min(
              100,
              Math.round((iterationRecord.total_pairs_evaluated / totalPairs) * 100)
            );
          }
        }

        response.status = 'calculating';
        response.message = 'The training in progress';
        response.progress_percent = progressPercent;
        break;
      }

      case 'completed': {
        // Get calculated metrics
        const metrics = db
          .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
          .get(iterationRecord.id) as
          | {
              f1_score: number;
              precision: number;
              recall: number;
              cohens_kappa: number;
              accuracy: number;
              true_positives: number;
              true_negatives: number;
              false_positives: number;
              false_negatives: number;
            }
          | undefined;

        if (metrics) {
          response.status = 'completed';
          response.message = 'Metrics calculated successfully';
          response.metrics = {
            f1_score: metrics.f1_score,
            precision: metrics.precision,
            recall: metrics.recall,
            cohens_kappa: metrics.cohens_kappa,
            accuracy: metrics.accuracy,
            confusion_matrix: {
              true_positives: metrics.true_positives,
              true_negatives: metrics.true_negatives,
              false_positives: metrics.false_positives,
              false_negatives: metrics.false_negatives,
            },
          };
          // Note: calculated_at may not exist on metrics type
          // response.calculated_at = (metrics as any).calculated_at;
          response.duration_ms = durationMs;
        } else {
          // Iteration is completed but no metrics (edge case)
          response.status = 'completed';
          response.message = 'Iteration completed, metrics pending calculation';
        }
        break;
      }

      case 'failed':
        response.status = 'error';
        response.message = iterationRecord.error_message || 'Metrics calculation failed';
        break;

      default:
        // For other states (awaiting_human_review, etc.)
        response.status = 'calculating';
        response.message = `Iteration status: ${iterationRecord.status}`;
    }

    logger.logApiRequest(
      'GET',
      `/api/personas/${id}/iterations/${num}/status`,
      200,
      Date.now() - startTime
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/iterations/${num}/status`, error as Error);
    return new Response(
      JSON.stringify({
        error: 'Failed to retrieve metrics status',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * Handle OPTIONS preflight requests
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
