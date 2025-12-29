/**
 * Dashboard API Endpoint
 * GET /api/personas/[id]/dashboard
 * Returns complete dashboard data for a persona including iterations, metrics, and convergence status
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { getPersonaMetricsHistory } from '@lib/evaluation/metrics-orchestrator';
import type { Persona, TrainingIteration } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Personas:Dashboard');

/**
 * GET /api/personas/[id]/dashboard
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  if (!id) {
    logger.logApiRequest('GET', '/api/personas/[id]/dashboard', 400, Date.now() - startTime);
    return badRequest('Persona ID is required', 'INVALID_INPUT');
  }

  try {
    const db = getDatabase();

    // Fetch persona
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as
      | Persona
      | undefined;

    if (!persona) {
      logger.logApiRequest('GET', `/api/personas/${id}/dashboard`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    // Fetch all iterations with metrics
    const metricsHistory = getPersonaMetricsHistory(id, db);

    // Transform to dashboard iteration format
    const iterations = metricsHistory.map((item) => ({
      iteration_num: item.iteration_number,
      f1_score: item.metrics.f1_score,
      precision: item.metrics.precision,
      recall: item.metrics.recall,
      cohens_kappa: item.metrics.cohens_kappa,
      accuracy: item.metrics.accuracy,
      confusion_matrix: item.metrics.confusion_matrix,
      timestamp: item.calculated_at,
    }));

    // Check convergence (F1 >= target)
    const convergenceAchieved =
      persona.best_f1_score !== null && persona.best_f1_score >= persona.target_f1_score;

    // Get current iteration status if training in progress
    const currentIterationQuery = db
      .prepare(
        `
      SELECT * FROM training_iterations
      WHERE persona_id = ?
      ORDER BY iteration_number DESC
      LIMIT 1
    `
      )
      .get(id) as TrainingIteration | undefined;

    const currentIterationStatus = currentIterationQuery
      ? {
          iteration_number: currentIterationQuery.iteration_number,
          status: currentIterationQuery.status,
          total_pairs_evaluated: currentIterationQuery.total_pairs_evaluated,
          pairs_reviewed_by_human: currentIterationQuery.pairs_reviewed_by_human,
          started_at: currentIterationQuery.started_at,
          completed_at: currentIterationQuery.completed_at,
        }
      : null;

    // Build response
    const dashboardData = {
      persona: {
        id: persona.id,
        name: persona.name,
        description: persona.description,
        status: persona.status,
        target_f1_score: persona.target_f1_score,
        max_iterations: persona.max_iterations,
        current_iteration: persona.current_iteration,
        best_f1_score: persona.best_f1_score,
        best_f1_iteration: persona.best_f1_iteration,
        created_at: persona.created_at,
        updated_at: persona.updated_at,
      },
      iterations,
      convergence_achieved: convergenceAchieved,
      current_iteration_status: currentIterationStatus,
    };

    logger.logApiRequest('GET', `/api/personas/${id}/dashboard`, 200, Date.now() - startTime);

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/dashboard`, error as Error);
    return createErrorResponse(error);
  }
};
