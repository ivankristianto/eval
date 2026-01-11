// src/pages/api/templates.ts
// Template CRUD endpoints

import type { APIRoute } from 'astro';
import { insertTemplate, getTemplates } from '@lib/db';
import {
  validateCreateTemplate,
  validateSystemPrompt,
  validateTemperature,
} from '@lib/validation/validators';
import type { RubricType } from '@lib/utils/types';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Templates');

/**
 * POST /api/templates
 * Creates a new evaluation template for reusable configurations.
 * Validates inputs and persists the template to the database.
 * @param root0
 * @param root0.request
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateTemplate(body);
    if (!validation.valid) {
      logger.logApiRequest('POST', '/api/templates', 400, Date.now() - startTime);
      return badRequest(
        validation.error?.message || 'Invalid template data',
        'VALIDATION_ERROR',
        validation.error
      );
    }

    const {
      name,
      description,
      instruction_text,
      model_ids,
      accuracy_rubric,
      expected_output,
      partial_credit_concepts,
      system_prompt,
      temperature,
    } = body;

    // Validate system prompt if provided
    const systemPromptValidation = validateSystemPrompt(system_prompt);
    if (!systemPromptValidation.valid) {
      logger.logApiRequest('POST', '/api/templates', 400, Date.now() - startTime);
      return badRequest(
        systemPromptValidation.error?.message || 'Invalid system prompt',
        'VALIDATION_ERROR',
        systemPromptValidation.error
      );
    }

    // Validate temperature if provided
    const temperatureValidation = validateTemperature(temperature);
    if (!temperatureValidation.valid) {
      logger.logApiRequest('POST', '/api/templates', 400, Date.now() - startTime);
      return badRequest(
        temperatureValidation.error?.message || 'Invalid temperature',
        'VALIDATION_ERROR',
        temperatureValidation.error
      );
    }

    logger.info('Creating evaluation template', { name, modelCount: model_ids?.length });

    // Create template
    const template = insertTemplate(
      name,
      instruction_text,
      model_ids,
      accuracy_rubric as RubricType,
      description,
      expected_output,
      partial_credit_concepts,
      system_prompt,
      temperature
    );

    logger.info('Evaluation template created', { templateId: template.id, name });
    logger.logApiRequest('POST', '/api/templates', 201, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: template.id,
        name: template.name,
        instruction_text: template.instruction_text,
        model_count: template.model_ids.length,
        accuracy_rubric: template.accuracy_rubric,
        created_at: template.created_at,
        run_count: template.run_count,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/templates', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * GET /api/templates
 * Lists all evaluation templates.
 * Supports sorting by creation date, name, or run count.
 * @param root0
 * @param root0.url
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const sortBy = (url.searchParams.get('sort_by') || 'created') as
      | 'created'
      | 'name'
      | 'run_count';
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

    const templates = getTemplates(sortBy, order);

    logger.logApiRequest('GET', '/api/templates', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          instruction_text: t.instruction_text.substring(0, 200),
          model_count: t.model_ids.length,
          accuracy_rubric: t.accuracy_rubric,
          created_at: t.created_at,
          run_count: t.run_count,
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/templates', error as Error);
    return createErrorResponse(error);
  }
};
