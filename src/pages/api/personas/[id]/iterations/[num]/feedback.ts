/**
 * POST /api/personas/[id]/iterations/[num]/feedback
 * Submit human review feedback for a judge decision
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { TrainingIteration } from '@src-types/training';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Feedback');

/**
 * POST /api/personas/[id]/iterations/[num]/feedback
 * Submits human review feedback for a judge decision.
 * Updates an existing review if one exists for the decision ID.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id, num } = params;

  try {
    if (!id || !num) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/iterations/[num]/feedback',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID and iteration number are required', 'INVALID_REQUEST');
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        400,
        Date.now() - startTime
      );
      return badRequest('Iteration number must be a valid integer', 'INVALID_REQUEST');
    }

    // Parse request body
    const body = await request.json();
    const { decision_id, human_decision, human_confidence, notes } = body;

    // Validate required fields
    if (!decision_id || !human_decision) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        400,
        Date.now() - startTime
      );
      return badRequest('decision_id and human_decision are required', 'INVALID_REQUEST');
    }

    // Validate human_decision value
    if (human_decision !== 'agree' && human_decision !== 'disagree') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        400,
        Date.now() - startTime
      );
      return badRequest('human_decision must be "agree" or "disagree"', 'INVALID_REQUEST');
    }

    // Validate confidence if provided
    if (human_confidence !== undefined) {
      const confidence = parseFloat(human_confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/iterations/${num}/feedback`,
          400,
          Date.now() - startTime
        );
        return badRequest(
          'human_confidence must be a number between 0.0 and 1.0',
          'INVALID_REQUEST'
        );
      }
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Get iteration
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, iterationNumber) as TrainingIteration | undefined;

    if (!iteration) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        404,
        Date.now() - startTime
      );
      return notFound('Iteration');
    }

    // Verify decision belongs to this iteration
    const decision = db
      .prepare('SELECT * FROM judge_decisions WHERE id = ? AND iteration_id = ?')
      .get(decision_id, iteration.id) as
      | {
          id: string;
          iteration_id: string;
        }
      | undefined;

    if (!decision) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        404,
        Date.now() - startTime
      );
      return notFound('Judge decision');
    }

    // Check if review already exists (prevent duplicate reviews)
    const existingReview = db
      .prepare('SELECT id FROM human_reviews WHERE judge_decision_id = ?')
      .get(decision_id) as { id: string } | undefined;

    if (existingReview) {
      // Update existing review
      db.prepare(
        `
        UPDATE human_reviews
        SET human_decision = ?, human_confidence = ?, human_notes = ?
        WHERE judge_decision_id = ?
      `
      ).run(human_decision, human_confidence || null, notes || null, decision_id);

      logger.info('Human review updated', {
        personaId: id,
        iterationNumber,
        reviewId: existingReview.id,
        humanDecision: human_decision,
      });
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/iterations/${num}/feedback`,
        200,
        Date.now() - startTime
      );

      return new Response(
        JSON.stringify({
          id: existingReview.id,
          decision_id,
          human_decision,
          human_confidence: human_confidence || null,
          notes: notes || null,
          updated: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new human review
    const reviewId = uuidv4();
    db.prepare(
      `
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      reviewId,
      decision_id,
      human_decision,
      human_confidence || null,
      notes || null,
      new Date().toISOString()
    );

    // Update iteration pairs_reviewed_by_human count
    db.prepare(
      `
      UPDATE training_iterations
      SET pairs_reviewed_by_human = (
        SELECT COUNT(*) FROM human_reviews hr
        JOIN judge_decisions jd ON jd.id = hr.judge_decision_id
        WHERE jd.iteration_id = ?
      )
      WHERE id = ?
    `
    ).run(iteration.id, iteration.id);

    logger.info('Human review created', {
      personaId: id,
      iterationNumber,
      reviewId,
      humanDecision: human_decision,
    });
    logger.logApiRequest(
      'POST',
      `/api/personas/${id}/iterations/${num}/feedback`,
      201,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        id: reviewId,
        decision_id,
        human_decision,
        human_confidence: human_confidence || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/iterations/${num}/feedback`, error as Error);
    return createErrorResponse(error);
  }
};
