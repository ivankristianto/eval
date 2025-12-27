/**
 * POST /api/personas/[id]/iterations/[num]/accept-prompt
 * Accept refined prompt (AI-generated or manually edited) and store version
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../../../lib/db';
import { storePromptVersion } from '../../../../../../lib/prompt-version-manager';

/**
 * POST /api/personas/[id]/iterations/[num]/accept-prompt
 * Accepts a refined prompt (either AI-generated or manually edited).
 * Stores the new version in the database if it differs from the previous one.
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

    const db = getDatabase();

    // Verify persona exists first (before validating request body)
    const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as any;
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Persona not found',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { prompt_text, reason } = body;

    // Validate required fields
    if (!prompt_text) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'prompt_text is required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate reason
    if (reason !== 'ai-generated' && reason !== 'manual-edit') {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'reason must be either "ai-generated" or "manual-edit"',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get iteration to verify it exists
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

    // Determine created_by based on reason
    const createdBy = reason === 'ai-generated' ? 'ai' : 'human';

    // Store prompt version
    const rationale =
      reason === 'ai-generated'
        ? 'AI-generated improvement based on failure analysis'
        : 'Manually edited by user';

    const versionId = await storePromptVersion(
      id,
      iterationNumber,
      prompt_text,
      rationale,
      createdBy,
      db
    );

    if (!versionId) {
      return new Response(
        JSON.stringify({
          error: 'DUPLICATE_PROMPT',
          message: 'This prompt is identical to the previous version and was not stored',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update persona's judge prompt for next iteration (optional - can be done when starting next iteration)
    // For now, we just store the version

    return new Response(
      JSON.stringify({
        version_id: versionId,
        prompt_text,
        reason,
        created_by: createdBy,
        iteration_number: iterationNumber,
        message: 'Prompt version stored successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('POST /api/personas/[id]/iterations/[num]/accept-prompt error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
