/**
 * Bulk Evaluation Run Delete API Endpoint
 * DELETE /api/bulk/runs/[id]
 *
 * Deletes a single evaluation run and its associated results.
 * The row_results table cascades deletes due to foreign key constraints.
 */

import type { APIRoute } from 'astro';
import { getEvaluationRun, deleteEvaluationRun } from '@lib/db';
import { notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Runs:Delete');

/**
 * DELETE /api/bulk/runs/[id]
 * Delete a single evaluation run and its associated results
 *
 * URL params:
 *   - id: Run ID to delete
 *
 * Response: 204 No Content on success
 *          404 with { error: string } - run not found
 */
export const DELETE: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  if (!id) {
    logger.logApiRequest('DELETE', '/api/bulk/runs/[id]', 400, Date.now() - startTime);
    return new Response(
      JSON.stringify({
        error: 'Run ID is required',
        code: 'INVALID_PARAMETER',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Verify the run exists before deleting
    const run = getEvaluationRun(id);
    if (!run) {
      logger.logApiRequest('DELETE', `/api/bulk/runs/${id}`, 404, Date.now() - startTime);
      return notFound('Evaluation run');
    }

    // Delete the run (row_results cascade delete via FK constraint)
    const deleted = deleteEvaluationRun(id);

    if (!deleted) {
      logger.error('Failed to delete evaluation run', undefined, { runId: id });
      return new Response(
        JSON.stringify({
          error: 'Failed to delete evaluation run',
          code: 'INTERNAL_ERROR',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    logger.info('Evaluation run deleted', {
      runId: id,
      datasetId: run.dataset_id,
    });
    logger.logApiRequest('DELETE', `/api/bulk/runs/${id}`, 204, Date.now() - startTime);

    return new Response(null, { status: 204 });
  } catch (error) {
    logger.logApiError('DELETE', `/api/bulk/runs/${id}`, error as Error);
    return createErrorResponse(error);
  }
};
