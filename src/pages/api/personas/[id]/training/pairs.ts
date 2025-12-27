/**
 * Training Pairs API Endpoint
 * GET /api/personas/[id]/training/pairs
 *
 * Retrieves all training pairs for a persona.
 */

import type { APIRoute } from 'astro';
import { getPersona } from '../../../../../lib/persona-db';
import { getDatabase } from '../../../../../lib/db';

/**
 * GET /api/personas/[id]/training/pairs
 * Retrieve all training pairs for a persona
 *
 * Response: 200 with training pairs array
 *          404 with { error: string }
 */
export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Persona ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify persona exists
    const persona = getPersona(id);
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'PERSONA_NOT_FOUND',
          message: 'Persona does not exist',
          persona_id: id,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Retrieve training pairs
    const db = getDatabase();
    const pairs = db
      .prepare(
        `SELECT
          id,
          persona_id,
          input,
          expected_output,
          created_at
        FROM training_pairs
        WHERE persona_id = ?
        ORDER BY created_at ASC`
      )
      .all(id);

    return new Response(
      JSON.stringify({
        persona_id: id,
        count: pairs.length,
        pairs: pairs,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/personas/[id]/training/pairs error:', error);

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
