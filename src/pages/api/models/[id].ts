// src/pages/api/models/[id].ts
// Individual model configuration endpoints

import type { APIRoute } from 'astro';
import {
  getModelById,
  updateModel,
  deleteModel,
  getModelUsageCount,
  hasActiveEvaluations,
} from '@lib/db';
import { ClientFactory } from '@lib/utils/api-clients';
import { validateApiKeyFormat } from '@lib/validation/validators';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Models:ById');

/**
 * GET /api/models/:id
 * Retrieves detailed configuration for a specific model.
 * @param root0
 * @param root0.params
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('GET', '/api/models/:id', 400, Date.now() - startTime);
      return badRequest('Model ID is required', 'INVALID_INPUT');
    }

    const model = getModelById(id);

    if (!model) {
      logger.logApiRequest('GET', `/api/models/${id}`, 404, Date.now() - startTime);
      return notFound('Model');
    }

    logger.logApiRequest('GET', `/api/models/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: model.id,
        provider: model.provider,
        model_name: model.model_name,
        is_active: model.is_active,
        created_at: model.created_at,
        updated_at: model.updated_at,
        notes: model.notes,
        usage_count: getModelUsageCount(model.id),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/models/${id}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * PATCH /api/models/:id
 * Updates an existing model configuration.
 * Validates new API keys if provided.
 * @param root0
 * @param root0.params
 * @param root0.request
 */
export const PATCH: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('PATCH', '/api/models/:id', 400, Date.now() - startTime);
      return badRequest('Model ID is required', 'INVALID_INPUT');
    }

    const model = getModelById(id);

    if (!model) {
      logger.logApiRequest('PATCH', `/api/models/${id}`, 404, Date.now() - startTime);
      return notFound('Model');
    }

    const body = await request.json();
    const { is_active, notes, api_key } = body;

    // Check if trying to disable model with active evaluations
    if (is_active === false && hasActiveEvaluations(id)) {
      logger.logApiRequest('PATCH', `/api/models/${id}`, 409, Date.now() - startTime);
      // Return error code in error field and model_id at top level for test compatibility
      return new Response(JSON.stringify({ error: 'CANNOT_UPDATE', model_id: id }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate and test new API key if provided
    let validationStatus: 'valid' | 'invalid' = 'valid';
    let errorMessage: string | undefined;

    if (api_key) {
      logger.info('Testing new API key for model', { modelId: id, provider: model.provider });

      const apiKeyValidation = validateApiKeyFormat(api_key, model.provider);
      if (!apiKeyValidation.valid) {
        logger.logApiRequest('PATCH', `/api/models/${id}`, 400, Date.now() - startTime);
        return badRequest(
          apiKeyValidation.error?.message || 'Invalid API key format',
          'VALIDATION_ERROR',
          apiKeyValidation.error
        );
      }

      const isValid = await ClientFactory.testConnection(model.provider, api_key, model.model_name);
      if (!isValid) {
        validationStatus = 'invalid';
        errorMessage = 'API key validation failed';
        logger.warn('API key validation failed for model', { modelId: id });
      }
    }

    // Build updates object
    const updates: Partial<{ is_active: boolean; notes: string; api_key: string }> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (notes !== undefined) updates.notes = notes;
    if (api_key && validationStatus === 'valid') updates.api_key = api_key;

    const updated = updateModel(id, updates);

    if (!updated) {
      logger.logApiRequest('PATCH', `/api/models/${id}`, 500, Date.now() - startTime);
      return badRequest('Failed to update model', 'UPDATE_FAILED');
    }

    logger.info('Model configuration updated', {
      modelId: id,
      updates: Object.keys(updates),
      validationStatus,
    });
    logger.logApiRequest('PATCH', `/api/models/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: updated.id,
        provider: updated.provider,
        model_name: updated.model_name,
        is_active: updated.is_active,
        updated_at: updated.updated_at,
        validation_status: validationStatus,
        error_message: errorMessage,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('PATCH', `/api/models/${id}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * DELETE /api/models/:id
 * Deletes a model configuration.
 * Prevents deletion if the model has associated evaluation results.
 * @param root0
 * @param root0.params
 */
export const DELETE: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('DELETE', '/api/models/:id', 400, Date.now() - startTime);
      return badRequest('Model ID is required', 'INVALID_INPUT');
    }

    const model = getModelById(id);

    if (!model) {
      logger.logApiRequest('DELETE', `/api/models/${id}`, 404, Date.now() - startTime);
      return notFound('Model');
    }

    // Check if model has evaluation results
    const usageCount = getModelUsageCount(id);
    if (usageCount > 0) {
      logger.logApiRequest('DELETE', `/api/models/${id}`, 409, Date.now() - startTime);
      // Return error code in error field and model_id at top level for test compatibility
      return new Response(JSON.stringify({ error: 'CANNOT_DELETE', model_id: id }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deleted = deleteModel(id);

    if (!deleted) {
      logger.logApiRequest('DELETE', `/api/models/${id}`, 500, Date.now() - startTime);
      return badRequest('Failed to delete model', 'DELETE_FAILED');
    }

    logger.info('Model configuration deleted', { modelId: id });
    logger.logApiRequest('DELETE', `/api/models/${id}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id,
        message: 'Model deleted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('DELETE', `/api/models/${id}`, error as Error);
    return createErrorResponse(error);
  }
};
