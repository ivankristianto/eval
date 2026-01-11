/**
 * API endpoints for persona collection
 * POST /api/personas - Create new persona
 * GET /api/personas - List all personas (with optional status filter)
 */

import type { APIRoute } from 'astro';
import { createPersona, listPersonas } from '@lib/db/persona-db';
import { validatePersonaCreation } from '@lib/validation/persona-validator';
import type { CreatePersonaInput, Persona } from '@src-types/training';
import { createErrorResponse, badRequest } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Personas');

/**
 * POST /api/personas
 * Create a new persona with task description, models, and initial judge prompt
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate request body
    const validation = validatePersonaCreation(body as CreatePersonaInput);

    if (!validation.isValid) {
      logger.logApiRequest('POST', '/api/personas', 400, Date.now() - startTime);
      return badRequest('Validation failed', 'VALIDATION_ERROR', validation.errors);
    }

    // Create persona (support both task_prompt and initial_task_prompt for backward compatibility)
    const persona = createPersona(
      body.name,
      body.description,
      body.initial_task_prompt || body.task_prompt,
      body.initial_judge_prompt,
      body.task_model_id,
      body.judge_model_id,
      body.prompt_engineer_model_id
    );

    logger.info('Persona created successfully', { personaId: persona.id, name: persona.name });
    logger.logApiRequest('POST', '/api/personas', 201, Date.now() - startTime);

    return new Response(JSON.stringify(persona), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('POST', '/api/personas', error as Error);

    // Return standardized error response
    return createErrorResponse(error);
  }
};

/**
 * GET /api/personas
 * List all personas with optional status filter
 * Query params: ?status=draft|training|trained|incomplete
 * @param root0
 * @param root0.url
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const status = url.searchParams.get('status') as Persona['status'] | null;

    // Validate status parameter if provided
    if (status && !['draft', 'training', 'trained', 'incomplete'].includes(status)) {
      logger.logApiRequest('GET', '/api/personas', 400, Date.now() - startTime);
      return badRequest(
        'Invalid status filter',
        'INVALID_PARAMETER',
        'Status must be one of: draft, training, trained, incomplete'
      );
    }

    const personas = listPersonas(status || undefined);

    logger.logApiRequest('GET', '/api/personas', 200, Date.now() - startTime);

    return new Response(JSON.stringify(personas), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', '/api/personas', error as Error);

    // Return standardized error response
    return createErrorResponse(error);
  }
};
