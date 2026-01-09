// src/pages/api/feedback.ts
// API endpoint to submit human Pass/Fail feedback for training pairs

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { parseJsonBody } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Feedback');

/**
 * POST /api/feedback
 * Submit human Pass/Fail feedback for training pair results
 *
 * Request body:
 * {
 *   result_id: string;
 *   human_rating: 'pass' | 'fail';
 *   human_feedback?: string;
 * }
 *
 * Response:
 * {
 *   success: true;
 *   result: { ...updated result }
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      result_id: string;
      human_rating: 'pass' | 'fail';
      human_feedback?: string;
    }>(request);

    const { result_id, human_rating, human_feedback } = body;

    if (!result_id) {
      logger.logApiRequest('POST', '/api/feedback', 400, Date.now() - startTime);
      return badRequest('result_id is required', 'INVALID_REQUEST');
    }

    if (!human_rating || (human_rating !== 'pass' && human_rating !== 'fail')) {
      logger.logApiRequest('POST', '/api/feedback', 400, Date.now() - startTime);
      return badRequest('human_rating must be "pass" or "fail"', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify result exists
    const result = db.prepare('SELECT * FROM training_pair_results WHERE id = ?').get(result_id) as
      | {
          id: string;
          persona_id: string;
          training_pair_id: string;
          human_rating: string | null;
        }
      | undefined;

    if (!result) {
      logger.logApiRequest('POST', '/api/feedback', 404, Date.now() - startTime);
      return notFound('Training pair result');
    }

    // Update with human feedback
    const updated_at = new Date().toISOString();

    db.prepare(
      `UPDATE training_pair_results
       SET human_rating = ?, human_feedback = ?, updated_at = ?
       WHERE id = ?`
    ).run(human_rating, human_feedback ?? null, updated_at, result_id);

    // Get updated result
    const updatedResult = db
      .prepare('SELECT * FROM training_pair_results WHERE id = ?')
      .get(result_id);

    logger.logApiRequest('POST', '/api/feedback', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        success: true,
        result: updatedResult,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/feedback', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * PUT /api/feedback
 * Batch update human Pass/Fail feedback for multiple training pair results
 *
 * Request body:
 * {
 *   feedback: Array<{
 *     result_id: string;
 *     human_rating: 'pass' | 'fail';
 *     human_feedback?: string;
 *   }>;
 * }
 *
 * Response:
 * {
 *   success: true;
 *   updated_count: number;
 *   results: Array<{ ...updated result }>
 * }
 */
export const PUT: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      feedback: Array<{
        result_id: string;
        human_rating: 'pass' | 'fail';
        human_feedback?: string;
      }>;
    }>(request);

    const { feedback } = body;

    if (!feedback || !Array.isArray(feedback)) {
      logger.logApiRequest('PUT', '/api/feedback', 400, Date.now() - startTime);
      return badRequest('feedback array is required', 'INVALID_REQUEST');
    }

    if (feedback.length === 0) {
      logger.logApiRequest('PUT', '/api/feedback', 400, Date.now() - startTime);
      return badRequest('feedback array cannot be empty', 'INVALID_REQUEST');
    }

    // Validate all feedback entries
    for (const item of feedback) {
      if (!item.result_id) {
        logger.logApiRequest('PUT', '/api/feedback', 400, Date.now() - startTime);
        return badRequest('Each feedback item must have a result_id', 'INVALID_REQUEST');
      }

      if (!item.human_rating || (item.human_rating !== 'pass' && item.human_rating !== 'fail')) {
        logger.logApiRequest('PUT', '/api/feedback', 400, Date.now() - startTime);
        return badRequest(
          'Each feedback item must have human_rating as "pass" or "fail"',
          'INVALID_REQUEST'
        );
      }
    }

    const db = getDatabase();

    // Verify all results exist
    const resultIds = feedback.map((f) => f.result_id);
    const placeholders = resultIds.map(() => '?').join(',');
    const existingResults = db
      .prepare(`SELECT id FROM training_pair_results WHERE id IN (${placeholders})`)
      .all(...resultIds) as Array<{ id: string }>;

    if (existingResults.length !== resultIds.length) {
      logger.logApiRequest('PUT', '/api/feedback', 404, Date.now() - startTime);
      return notFound('One or more training pair results not found');
    }

    // Update all feedback in a transaction
    const updatedResults = [];
    const updated_at = new Date().toISOString();

    for (const item of feedback) {
      db.prepare(
        `UPDATE training_pair_results
         SET human_rating = ?, human_feedback = ?, updated_at = ?
         WHERE id = ?`
      ).run(item.human_rating, item.human_feedback ?? null, updated_at, item.result_id);

      const updatedResult = db
        .prepare('SELECT * FROM training_pair_results WHERE id = ?')
        .get(item.result_id);
      updatedResults.push(updatedResult);
    }

    logger.logApiRequest('PUT', '/api/feedback', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        success: true,
        updated_count: updatedResults.length,
        results: updatedResults,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('PUT', '/api/feedback', error as Error);
    return createErrorResponse(error);
  }
};
