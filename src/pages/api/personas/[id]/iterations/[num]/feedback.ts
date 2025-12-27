/**
 * POST /api/personas/[id]/iterations/[num]/feedback
 * Submit human review feedback for a judge decision
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/personas/[id]/iterations/[num]/feedback
 * Submits human review feedback for a judge decision.
 * Updates an existing review if one exists for the decision ID.
 */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id, num } = params;

    if (!id || !num) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Persona ID and iteration number are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const iterationNumber = parseInt(num, 10);
    if (isNaN(iterationNumber)) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Iteration number must be a valid integer',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { decision_id, human_decision, human_confidence, notes } = body;

    // Validate required fields
    if (!decision_id || !human_decision) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'decision_id and human_decision are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate human_decision value
    if (human_decision !== 'agree' && human_decision !== 'disagree') {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'human_decision must be "agree" or "disagree"',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate confidence if provided
    if (human_confidence !== undefined) {
      const confidence = parseFloat(human_confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        return new Response(
          JSON.stringify({
            error: 'INVALID_REQUEST',
            message: 'human_confidence must be a number between 0.0 and 1.0',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id);
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Persona not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get iteration
    const iteration = db
      .prepare('SELECT * FROM training_iterations WHERE persona_id = ? AND iteration_number = ?')
      .get(id, iterationNumber) as any;

    if (!iteration) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: `Iteration ${iterationNumber} not found for persona`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify decision belongs to this iteration
    const decision = db
      .prepare('SELECT * FROM judge_decisions WHERE id = ? AND iteration_id = ?')
      .get(decision_id, iteration.id) as any;

    if (!decision) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Judge decision not found for this iteration',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if review already exists (prevent duplicate reviews)
    const existingReview = db
      .prepare('SELECT id FROM human_reviews WHERE judge_decision_id = ?')
      .get(decision_id);

    if (existingReview) {
      // Update existing review
      db.prepare(
        `
        UPDATE human_reviews
        SET human_decision = ?, human_confidence = ?, human_notes = ?
        WHERE judge_decision_id = ?
      `
      ).run(human_decision, human_confidence || null, notes || null, decision_id);

      return new Response(
        JSON.stringify({
          id: (existingReview as any).id,
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
    console.error('POST /api/personas/[id]/iterations/[num]/feedback error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
