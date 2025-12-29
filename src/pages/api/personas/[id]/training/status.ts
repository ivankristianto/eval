/**
 * GET /api/personas/[id]/training/status
 * Get current training status for a persona
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Status');

/**
 * GET /api/personas/[id]/training/status
 * Retrieves current training status, metrics, and loop state for a persona.
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

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/training/status`, error as Error);
    return createErrorResponse(error);
  }
};
