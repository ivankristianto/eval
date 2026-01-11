// src/pages/api/templates/[id].ts
// Individual template endpoints

import type { APIRoute } from 'astro';
import { getTemplateById, updateTemplate, deleteTemplate, getModelById } from '@lib/db';
import {
  validateTemplateName,
  validateDescription,
  validateInstruction,
  validateRubricType,
  validateModelIds,
  validateSystemPrompt,
  validateTemperature,
} from '@lib/validation/validators';
import type { RubricType } from '@lib/utils/types';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Templates:ById');

/**
 * GET /api/templates/:id
 * Retrieves detailed configuration for a specific evaluation template.
 * @param root0
 * @param root0.params
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('GET', '/api/templates/:id', 400, Date.now() - startTime);
      return badRequest('Template ID is required', 'INVALID_INPUT');
    }

    const template = getTemplateById(id);

    if (!template) {
      logger.logApiRequest('GET', `/api/templates/${id}`, 404, Date.now() - startTime);
      return notFound('Template');
    }

    // Get model details
    const models = template.model_ids
      .map((modelId) => {
        const model = getModelById(modelId);
        return model
          ? {
              id: model.id,
              model_name: model.model_name,
              provider: model.provider,
              is_active: model.is_active,
            }
          : null;
      })
      .filter(Boolean);

    logger.logApiRequest('GET', `/api/templates/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: template.id,
        name: template.name,
        description: template.description,
        instruction_text: template.instruction_text,
        model_ids: template.model_ids,
        models,
        accuracy_rubric: template.accuracy_rubric,
        expected_output: template.expected_output,
        partial_credit_concepts: template.partial_credit_concepts,
        created_at: template.created_at,
        updated_at: template.updated_at,
        run_count: template.run_count,
        system_prompt: template.system_prompt,
        temperature: template.temperature,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/templates/${id}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * PATCH /api/templates/:id
 * Updates an existing evaluation template.
 * Validates only the provided fields.
 * @param root0
 * @param root0.params
 * @param root0.request
 */
export const PATCH: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('PATCH', '/api/templates/:id', 400, Date.now() - startTime);
      return badRequest('Template ID is required', 'INVALID_INPUT');
    }

    const template = getTemplateById(id);

    if (!template) {
      logger.logApiRequest('PATCH', `/api/templates/${id}`, 404, Date.now() - startTime);
      return notFound('Template');
    }

    const body = await request.json();

    // Validate provided fields
    if (body.name !== undefined) {
      const validation = validateTemplateName(body.name);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid name',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    if (body.description !== undefined) {
      const validation = validateDescription(body.description);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid description',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    if (body.instruction_text !== undefined) {
      const validation = validateInstruction(body.instruction_text);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid instruction',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    if (body.accuracy_rubric !== undefined) {
      const validation = validateRubricType(body.accuracy_rubric);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid rubric type',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    if (body.model_ids !== undefined) {
      const validation = validateModelIds(body.model_ids);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid model IDs',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    if (body.system_prompt !== undefined) {
      const validation = validateSystemPrompt(body.system_prompt);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid system prompt',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    if (body.temperature !== undefined) {
      const validation = validateTemperature(body.temperature);
      if (!validation.valid) {
        logger.logApiRequest('PATCH', `/api/templates/${id}`, 400, Date.now() - startTime);
        return badRequest(
          validation.error?.message || 'Invalid temperature',
          'VALIDATION_ERROR',
          validation.error
        );
      }
    }

    // Build updates object
    const updates: Partial<{
      name: string;
      description: string;
      instruction_text: string;
      model_ids: string[];
      accuracy_rubric: RubricType;
      expected_output: string;
      partial_credit_concepts: string[];
      system_prompt: string;
      temperature: number;
    }> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.instruction_text !== undefined) updates.instruction_text = body.instruction_text;
    if (body.model_ids !== undefined) updates.model_ids = body.model_ids;
    if (body.accuracy_rubric !== undefined) updates.accuracy_rubric = body.accuracy_rubric;
    if (body.expected_output !== undefined) updates.expected_output = body.expected_output;
    if (body.partial_credit_concepts !== undefined)
      updates.partial_credit_concepts = body.partial_credit_concepts;
    if (body.system_prompt !== undefined) updates.system_prompt = body.system_prompt;
    if (body.temperature !== undefined) updates.temperature = body.temperature;

    logger.info('Updating template', { templateId: id, updates: Object.keys(updates) });

    const updated = updateTemplate(id, updates);

    if (!updated) {
      logger.logApiRequest('PATCH', `/api/templates/${id}`, 500, Date.now() - startTime);
      return badRequest('Failed to update template', 'UPDATE_FAILED');
    }

    logger.info('Template updated', { templateId: id });
    logger.logApiRequest('PATCH', `/api/templates/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: updated.id,
        name: updated.name,
        updated_at: updated.updated_at,
        run_count: updated.run_count,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('PATCH', `/api/templates/${id}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * DELETE /api/templates/:id
 * Deletes an evaluation template.
 * @param root0
 * @param root0.params
 */
export const DELETE: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('DELETE', '/api/templates/:id', 400, Date.now() - startTime);
      return badRequest('Template ID is required', 'INVALID_INPUT');
    }

    const template = getTemplateById(id);

    if (!template) {
      logger.logApiRequest('DELETE', `/api/templates/${id}`, 404, Date.now() - startTime);
      return notFound('Template');
    }

    logger.info('Deleting template', { templateId: id, name: template.name });

    const deleted = deleteTemplate(id);

    if (!deleted) {
      logger.logApiRequest('DELETE', `/api/templates/${id}`, 500, Date.now() - startTime);
      return badRequest('Failed to delete template', 'DELETE_FAILED');
    }

    logger.info('Template deleted', { templateId: id });
    logger.logApiRequest('DELETE', `/api/templates/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id,
        message: 'Template deleted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('DELETE', `/api/templates/${id}`, error as Error);
    return createErrorResponse(error);
  }
};
