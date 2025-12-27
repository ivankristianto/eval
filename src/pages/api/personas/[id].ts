// src/pages/api/personas/[id].ts
// Individual persona endpoints

import type { APIRoute, APIContext } from 'astro';
import { getPersona, updatePersona, deletePersona } from '../../../lib/persona-db';
import type { Persona } from '../../../types/training';

/**
 * GET /api/personas/:id
 * Retrieves detailed configuration and metrics for a specific persona.
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

    return new Response(
      JSON.stringify({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        task_prompt: persona.task_prompt,
        task_model_id: persona.task_model_id,
        judge_model_id: persona.judge_model_id,
        prompt_engineer_model_id: persona.prompt_engineer_model_id,
        status: persona.status,
        target_f1_score: persona.target_f1_score,
        max_iterations: persona.max_iterations,
        current_iteration: persona.current_iteration,
        best_f1_score: persona.best_f1_score,
        best_f1_iteration: persona.best_f1_iteration,
        created_at: persona.created_at,
        updated_at: persona.updated_at,
        created_by: persona.created_by,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/personas/:id error:', error);
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

/**
 * PUT /api/personas/:id
 * Alias for PATCH /api/personas/:id
 */
export const PUT: APIRoute = async (context: APIContext) => {
  return PATCH(context);
};

/**
 * PATCH /api/personas/:id
 * Updates an existing persona configuration.
 * Only allowed fields are updated.
 */
export const PATCH: APIRoute = async ({ params, request }) => {
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

    const body = await request.json();

    // Build updates object with only allowed fields
    const updates: Partial<
      Pick<
        Persona,
        | 'name'
        | 'description'
        | 'task_prompt'
        | 'status'
        | 'current_iteration'
        | 'best_f1_score'
        | 'best_f1_iteration'
      >
    > = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.task_prompt !== undefined) updates.task_prompt = body.task_prompt;
    if (body.status !== undefined) updates.status = body.status;
    if (body.current_iteration !== undefined) updates.current_iteration = body.current_iteration;
    if (body.best_f1_score !== undefined) updates.best_f1_score = body.best_f1_score;
    if (body.best_f1_iteration !== undefined) updates.best_f1_iteration = body.best_f1_iteration;

    // updatePersona will validate and throw on error
    const updated = updatePersona(id, updates);

    return new Response(
      JSON.stringify({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        task_prompt: updated.task_prompt,
        status: updated.status,
        current_iteration: updated.current_iteration,
        best_f1_score: updated.best_f1_score,
        best_f1_iteration: updated.best_f1_iteration,
        updated_at: updated.updated_at,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('PATCH /api/personas/:id error:', error);

    // Check if it's a not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return new Response(
        JSON.stringify({
          error: 'PERSONA_NOT_FOUND',
          message: error.message,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if it's a validation error (duplicate name)
    if (error instanceof Error && error.message.includes('already exists')) {
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: error.message,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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

/**
 * DELETE /api/personas/:id
 * Deletes a persona and all its associated training data.
 */
export const DELETE: APIRoute = async ({ params }) => {
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

    // deletePersona will throw if persona not found
    deletePersona(id);

    return new Response(
      JSON.stringify({
        id,
        message: 'Persona deleted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('DELETE /api/personas/:id error:', error);

    // Check if it's a not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return new Response(
        JSON.stringify({
          error: 'PERSONA_NOT_FOUND',
          message: error.message,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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
