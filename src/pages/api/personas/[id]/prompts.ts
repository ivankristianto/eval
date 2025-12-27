// src/pages/api/personas/[id]/prompts.ts
// API endpoint to fetch judge prompt versions for a persona

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../lib/db';
import type { JudgePromptVersion } from '../../../../types/training';

// GET /api/personas/[id]/prompts - Get all judge prompt versions for a persona
/**
 * GET /api/personas/[id]/prompts
 * Retrieves all judge prompt versions for a specific persona.
 * Sorted by iteration number descending.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'Persona ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(id);
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Persona not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch all prompt versions sorted by iteration (newest first)
    const prompts = db
      .prepare(
        `
      SELECT
        id,
        persona_id,
        iteration_number,
        prompt_text,
        improvement_rationale,
        created_by,
        created_at
      FROM judge_prompt_versions
      WHERE persona_id = ?
      ORDER BY iteration_number DESC
    `
      )
      .all(id) as JudgePromptVersion[];

    return new Response(
      JSON.stringify({
        prompts,
        count: prompts.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/personas/[id]/prompts error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
