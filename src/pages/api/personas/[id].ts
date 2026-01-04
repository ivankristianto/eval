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
        task_model_id: persona.task_model_id,
        judge_model_id: persona.judge_model_id,
        prompt_engineer_model_id: persona.prompt_engineer_model_id,
        current_task_prompt_version_id: persona.current_task_prompt_version_id,
        current_judge_prompt_version_id: persona.current_judge_prompt_version_id,
        status: persona.status,
        target_pass_rate: persona.target_pass_rate,
        best_pass_rate: persona.best_pass_rate,
        best_pass_rate_updated_at: persona.best_pass_rate_updated_at,
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
        | 'status'
        | 'best_pass_rate'
        | 'best_pass_rate_updated_at'
        | 'current_task_prompt_version_id'
        | 'current_judge_prompt_version_id'
      >
    > = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.best_pass_rate !== undefined) updates.best_pass_rate = body.best_pass_rate;
    if (body.best_pass_rate_updated_at !== undefined) updates.best_pass_rate_updated_at = body.best_pass_rate_updated_at;
    if (body.current_task_prompt_version_id !== undefined) updates.current_task_prompt_version_id = body.current_task_prompt_version_id;
    if (body.current_judge_prompt_version_id !== undefined) updates.current_judge_prompt_version_id = body.current_judge_prompt_version_id;

    // updatePersona will validate and throw on error
    const updated = updatePersona(id, updates);

    logger.info('Persona updated', { personaId: id, updates: Object.keys(updates) });
    logger.logApiRequest('PATCH', `/api/personas/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        best_pass_rate: updated.best_pass_rate,
        best_pass_rate_updated_at: updated.best_pass_rate_updated_at,
        current_task_prompt_version_id: updated.current_task_prompt_version_id,
        current_judge_prompt_version_id: updated.current_judge_prompt_version_id,
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
