/**
 * GET /api/personas/[id]/training/status
 * Get current training status for a persona
 *
 * Supports SSE streaming when `?stream=true` query parameter is provided.
 * The SSE stream sends updates when the training state changes.
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Status');

/**
 * SSE event data for training status updates
 */
interface TrainingStatusEvent {
  type: 'status_update' | 'stream_closed' | 'error';
  data: {
    persona_id: string;
    latest_iteration: {
      id: string;
      iteration_number: number;
      status: string;
      total_pairs_evaluated?: number;
      pairs_reviewed_by_human?: number;
      started_at?: string;
      completed_at?: string;
      error_message?: string;
    } | null;
    training_loop_state: {
      session_id: string;
      status: string;
      current_iteration: number;
    } | null;
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
    timestamp: string;
  };
}

/**
 * GET /api/personas/[id]/training/status
 * Retrieves current training status, metrics, and loop state for a persona.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params, request }) => {
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
      .get(id) as
      | (TrainingIteration & {
          f1_score?: number;
          precision?: number;
          recall?: number;
          cohens_kappa?: number;
          accuracy?: number;
          true_positives?: number;
          true_negatives?: number;
          false_positives?: number;
          false_negatives?: number;
        })
      | undefined;

    // Get training loop state if active
    const loopState = db
      .prepare(
        'SELECT * FROM training_loop_state WHERE persona_id = ? ORDER BY updated_at DESC LIMIT 1'
      )
      .get(id) as
      | {
          session_id: string;
          persona_id: string;
          status: string;
          current_iteration: number;
          task_results_evaluated: number;
        }
      | undefined;

    // Build response
    const response: {
      persona_id: string;
      latest_iteration: typeof latestIteration | null;
      training_loop_state: typeof loopState | null;
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
    } = {
      persona_id: id,
      latest_iteration: latestIteration || null,
      training_loop_state: loopState || null,
    };

    // Add metrics if available
    if (latestIteration?.f1_score !== undefined) {
      response.metrics = {
        f1_score: latestIteration.f1_score ?? 0,
        precision: latestIteration.precision ?? 0,
        recall: latestIteration.recall ?? 0,
        cohens_kappa: latestIteration.cohens_kappa ?? 0,
        accuracy: latestIteration.accuracy ?? 0,
        confusion_matrix: {
          true_positives: latestIteration.true_positives ?? 0,
          true_negatives: latestIteration.true_negatives ?? 0,
          false_positives: latestIteration.false_positives ?? 0,
          false_negatives: latestIteration.false_negatives ?? 0,
        },
      };

      // Remove redundant fields from latestIteration
      const iterationData = latestIteration as typeof latestIteration & {
        f1_score?: number;
        precision?: number;
        recall?: number;
        cohens_kappa?: number;
        accuracy?: number;
        true_positives?: number;
        true_negatives?: number;
        false_positives?: number;
        false_negatives?: number;
      };
      delete iterationData.f1_score;
      delete iterationData.precision;
      delete iterationData.recall;
      delete iterationData.cohens_kappa;
      delete iterationData.accuracy;
      delete iterationData.true_positives;
      delete iterationData.true_negatives;
      delete iterationData.false_positives;
      delete iterationData.false_negatives;
    }

    logger.logApiRequest('GET', `/api/personas/${id}/training/status`, 200, Date.now() - startTime);

    // Check if SSE streaming is requested
    const url = new URL(request.url);
    const useSSE = url.searchParams.get('stream') === 'true';

    if (useSSE) {
      // Return SSE stream
      return createSSEStream(id, db, response);
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/training/status`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * Create an SSE stream for training status updates
 * @param personaId - The persona ID to monitor
 * @param db - The database instance
 * @param initialResponse - The initial response data
 * @returns {Response} SSE stream response
 */
function createSSEStream(
  personaId: string,
  db: ReturnType<typeof getDatabase>,
  initialResponse: {
    persona_id: string;
    latest_iteration?: {
      id: string;
      iteration_number: number;
      status: string;
      total_pairs_evaluated?: number;
      pairs_reviewed_by_human?: number;
      started_at?: string | null;
      completed_at?: string | null;
      error_message?: string | null;
    } | null;
    training_loop_state?: {
      session_id: string;
      status: string;
      current_iteration: number;
    } | null;
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
    } | null;
  }
): Response {
  const encoder = new TextEncoder();
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;

  /**
   * Send SSE event to client
   */
  const sendEvent = (type: TrainingStatusEvent['type'], data: TrainingStatusEvent['data']) => {
    if (isClosed) return;

    const event: TrainingStatusEvent = { type, data };
    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    return encoder.encode(eventData);
  };

  /**
   * Fetch current training status from database
   */
  const fetchCurrentStatus = (): TrainingStatusEvent['data'] => {
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
          ti.error_message
        FROM training_iterations ti
        WHERE ti.persona_id = ?
        ORDER BY ti.iteration_number DESC
        LIMIT 1
      `
      )
      .get(personaId) as
      | {
          id: string;
          iteration_number: number;
          status: string;
          total_pairs_evaluated?: number;
          pairs_reviewed_by_human?: number;
          started_at: string;
          completed_at?: string;
          error_message?: string;
        }
      | undefined;

    const loopState = db
      .prepare(
        'SELECT session_id, status, current_iteration FROM training_loop_state WHERE persona_id = ? ORDER BY updated_at DESC LIMIT 1'
      )
      .get(personaId) as
      | {
          session_id: string;
          status: string;
          current_iteration: number;
        }
      | undefined;

    let metrics: TrainingStatusEvent['data']['metrics'] | undefined;

    // Only fetch metrics if iteration is completed
    if (latestIteration?.status === 'completed' && latestIteration.id) {
      const metricsRow = db
        .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
        .get(latestIteration.id) as
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

      if (metricsRow) {
        metrics = {
          f1_score: metricsRow.f1_score ?? 0,
          precision: metricsRow.precision ?? 0,
          recall: metricsRow.recall ?? 0,
          cohens_kappa: metricsRow.cohens_kappa ?? 0,
          accuracy: metricsRow.accuracy ?? 0,
          confusion_matrix: {
            true_positives: metricsRow.true_positives,
            true_negatives: metricsRow.true_negatives,
            false_positives: metricsRow.false_positives,
            false_negatives: metricsRow.false_negatives,
          },
        };
      }
    }

    return {
      persona_id: personaId,
      latest_iteration: latestIteration || null,
      training_loop_state: loopState || null,
      metrics,
      timestamp: new Date().toISOString(),
    };
  };

  /**
   * Create the readable stream for SSE
   */
  const stream = new ReadableStream({
    start(controller) {
      // Send initial status immediately
      const initialData = {
        ...initialResponse,
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'status_update', data: initialData })}\n\n`)
      );

      // Poll for status changes every 2 seconds
      let lastStatus = initialResponse.latest_iteration?.status || null;
      let lastIterationNumber = initialResponse.latest_iteration?.iteration_number || 0;
      let lastHasMetrics = !!initialResponse.metrics;

      pollInterval = setInterval(() => {
        if (isClosed) {
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        try {
          const currentData = fetchCurrentStatus();
          const currentStatus = currentData.latest_iteration?.status || null;
          const currentIterationNumber = currentData.latest_iteration?.iteration_number || 0;
          const hasMetrics = !!currentData.metrics;

          // Send status_update if anything changed
          const statusChanged = currentStatus !== lastStatus;
          const iterationChanged = currentIterationNumber > lastIterationNumber;
          const metricsChanged = hasMetrics !== lastHasMetrics;

          if (statusChanged || iterationChanged || metricsChanged) {
            // Update last known values
            if (statusChanged) lastStatus = currentStatus;
            if (iterationChanged) lastIterationNumber = currentIterationNumber;
            if (metricsChanged) lastHasMetrics = hasMetrics;

            // Always send the full status update when anything changes
            controller.enqueue(sendEvent('status_update', currentData));
          }

          // Stop polling if training is in a terminal state
          // Terminal states: 'completed', 'failed', 'paused', or no active training loop
          const loopStatus = currentData.training_loop_state?.status;
          const iterationStatus = currentData.latest_iteration?.status;
          const isTerminalState =
            loopStatus === 'completed' ||
            loopStatus === 'failed' ||
            loopStatus === 'paused' ||
            // No active training loop and iteration is completed
            (!loopStatus && iterationStatus === 'completed') ||
            // Iteration failed even if loop state exists
            iterationStatus === 'failed';

          if (isTerminalState) {
            if (pollInterval) clearInterval(pollInterval);

            // Send final status update
            controller.enqueue(sendEvent('status_update', currentData));
            // Send stream_closed event to signal clean close to client
            controller.enqueue(sendEvent('stream_closed', currentData));
            // Close stream immediately after sending events
            try {
              controller.close();
              isClosed = true;
            } catch {
              // Controller may already be closed
            }
          }
        } catch (error) {
          logger.error('SSE polling error', error instanceof Error ? error : undefined);
          controller.enqueue(
            sendEvent('error', {
              persona_id: personaId,
              latest_iteration: null,
              training_loop_state: null,
              timestamp: new Date().toISOString(),
            })
          );
          if (pollInterval) clearInterval(pollInterval);
          controller.close();
          isClosed = true;
        }
      }, 2000);
    },

    cancel() {
      isClosed = true;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
