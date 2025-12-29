// src/pages/api/models.ts
// Model configuration API endpoints

import type { APIRoute } from 'astro';
import { insertModel, getModels, getModelUsageCount } from '@lib/db';
import { ClientFactory } from '@lib/utils/api-clients';
import { validateCreateModel, validateProvider } from '@lib/validation/validators';
import type { Provider } from '@lib/utils/types';
import { badRequest, internalError, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Models');

/**
 * POST /api/models
 * Creates a new model configuration.
 * Verifies API connectivity before persisting to database.
 * @param root0
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateModel(body);
    if (!validation.valid) {
      logger.logApiRequest('POST', '/api/models', 400, Date.now() - startTime);
      // Return validation error directly for test compatibility
      return new Response(JSON.stringify(validation.error || {}), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { provider, model_name, api_key, notes } = body;

    logger.info('Creating new model configuration', { provider, model_name });

    // Test API key with provider
    const isValid = await ClientFactory.testConnection(provider, api_key, model_name);

    if (!isValid) {
      logger.logApiRequest('POST', '/api/models', 401, Date.now() - startTime);
      return internalError('API key rejected by provider', {
        code: 'API_KEY_AUTHENTICATION_FAILED',
        provider,
        provider_message: 'Invalid authentication credentials',
      });
    }

    // Create model
    const model = insertModel(provider, model_name, api_key, notes);

    logger.info('Model configuration created', {
      modelId: model.id,
      provider,
      model_name,
    });
    logger.logApiRequest('POST', '/api/models', 201, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        id: model.id,
        provider: model.provider,
        model_name: model.model_name,
        is_active: model.is_active,
        created_at: model.created_at,
        validation_status: 'valid',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/models', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * GET /api/models
 * Lists all configured models.
 * Supports filtering by provider and active status.
 * @param root0
 * @param root0.url
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const provider = url.searchParams.get('provider') as Provider | null;

    // Validate provider if provided
    if (provider) {
      const providerValidation = validateProvider(provider);
      if (!providerValidation.valid) {
        logger.logApiRequest('GET', '/api/models', 400, Date.now() - startTime);
        return badRequest(
          providerValidation.error?.message || 'Invalid provider',
          'VALIDATION_ERROR',
          providerValidation.error
        );
      }
    }

    const models = getModels(activeOnly, provider || undefined);

    // Add usage count to each model
    const modelsWithUsage = models.map((model) => ({
      id: model.id,
      provider: model.provider,
      model_name: model.model_name,
      is_active: model.is_active,
      created_at: model.created_at,
      notes: model.notes,
      usage_count: getModelUsageCount(model.id),
    }));

    logger.logApiRequest('GET', '/api/models', 200, Date.now() - startTime);

    return new Response(JSON.stringify({ models: modelsWithUsage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', '/api/models', error as Error);
    return createErrorResponse(error);
  }
};
