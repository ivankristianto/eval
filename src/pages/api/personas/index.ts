/**
 * API endpoints for persona collection
 * POST /api/personas - Create new persona
 * GET /api/personas - List all personas (with optional status filter)
 */

import type { APIRoute } from 'astro';
import { createPersona, listPersonas } from '../../../lib/persona-db';
import { validatePersonaCreation } from '../../../lib/persona-validator';
import type { CreatePersonaInput, Persona } from '../../../types/training';

/**
 * POST /api/personas
 * Create a new persona with task description, models, and initial judge prompt
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validatePersonaCreation(body as CreatePersonaInput);

    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create persona
    const persona = createPersona(
      body.name,
      body.description,
      body.task_prompt,
      body.task_model_id,
      body.judge_model_id,
      body.prompt_engineer_model_id
    );

    return new Response(JSON.stringify(persona), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating persona:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return new Response(
          JSON.stringify({
            error: 'Persona name already exists',
            code: 'DUPLICATE_NAME',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (error.message.includes('model')) {
        return new Response(
          JSON.stringify({
            error: error.message,
            code: 'MODEL_VALIDATION_ERROR',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to create persona',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * GET /api/personas
 * List all personas with optional status filter
 * Query params: ?status=draft|training|trained|incomplete
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const status = url.searchParams.get('status') as Persona['status'] | null;

    // Validate status parameter if provided
    if (status && !['draft', 'training', 'trained', 'incomplete'].includes(status)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid status filter',
          code: 'INVALID_PARAMETER',
          details: 'Status must be one of: draft, training, trained, incomplete',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const personas = listPersonas(status || undefined);

    return new Response(JSON.stringify(personas), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error listing personas:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to list personas',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
