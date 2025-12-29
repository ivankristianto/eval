// src/pages/api/personas/[id].ts
// Individual persona endpoints

import type { APIRoute, APIContext } from 'astro';
import { getPersona, updatePersona, deletePersona } from '@lib/db/persona-db';
import type { Persona } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Personas:Detail');

/**
 * GET /api/personas/:id
 * Retrieves detailed configuration and metrics for a specific persona.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('GET', '/api/personas/:id', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    const persona = getPersona(id);

    if (!persona) {
      logger.logApiRequest('GET', `/api/personas/${id}`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    logger.logApiRequest('GET', `/api/personas/${id}`, 200, Date.now() - startTime);

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
    logger.logApiError('GET', `/api/personas/${id}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * PUT /api/personas/:id
 * Alias for PATCH /api/personas/:id
 * @param context
 * @returns {Promise<Response>}
 */
export const PUT: APIRoute = async (context: APIContext) => {
  return PATCH(context);
};

/**
 * PATCH /api/personas/:id
 * Updates an existing persona configuration.
 * Only allowed fields are updated.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const PATCH: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('PATCH', '/api/personas/:id', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_INPUT');
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

    logger.info('Persona updated', { personaId: id, updates: Object.keys(updates) });
    logger.logApiRequest('PATCH', `/api/personas/${id}`, 200, Date.now() - startTime);

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
    logger.logApiError('PATCH', `/api/personas/${id}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * DELETE /api/personas/:id
 * Deletes a persona and all its associated training data.
 * @param root0
 * @param root0.params
 * @returns {Promise<Response>}
 */
export const DELETE: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('DELETE', '/api/personas/:id', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    // deletePersona will throw if persona not found
    deletePersona(id);

    logger.info('Persona deleted', { personaId: id });
    logger.logApiRequest('DELETE', `/api/personas/${id}`, 200, Date.now() - startTime);

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
    logger.logApiError('DELETE', `/api/personas/${id}`, error as Error);
    return createErrorResponse(error);
  }
};
