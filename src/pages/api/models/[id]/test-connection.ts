// src/pages/api/models/[id]/test-connection.ts
// Test API key connection endpoint

import type { APIRoute } from 'astro';
import { getModelById, decryptApiKey } from '@lib/db';
import { ClientFactory } from '@lib/utils/api-clients';
import { validateApiKeyFormat } from '@lib/validation/validators';
import { badRequest, notFound, internalError, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Models:TestConnection');

/**
 * POST /api/models/:id/test-connection
 * Tests the API connectivity for a specific model configuration.
 * Can test either the stored API key or a new key provided in the request body.
 * @param root0
 * @param root0.params
 * @param root0.request
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('POST', '/api/models/:id/test-connection', 400, Date.now() - startTime);
      return badRequest('Model ID is required', 'INVALID_INPUT');
    }

    const model = getModelById(id);

    if (!model) {
      logger.logApiRequest(
        'POST',
        `/api/models/${id}/test-connection`,
        404,
        Date.now() - startTime
      );
      return notFound('Model');
    }

    logger.info('Testing model API connection', { modelId: id, provider: model.provider });

    // Check if a new API key or base URL was provided in the request body
    let apiKey: string | undefined;
    let baseUrl = model.base_url;
    let usingProvidedKey = false;
    let usingProvidedBaseUrl = false;

    try {
      const body = await request.json();
      if (body.api_key) {
        // Validate the provided API key format
        const validation = validateApiKeyFormat(body.api_key, model.provider);
        if (!validation.valid) {
          logger.logApiRequest(
            'POST',
            `/api/models/${id}/test-connection`,
            400,
            Date.now() - startTime
          );
          return badRequest(
            validation.error?.message || 'Invalid API key format',
            'VALIDATION_ERROR',
            validation.error
          );
        }
        apiKey = body.api_key;
        usingProvidedKey = true;
      } else if (model.api_key_encrypted) {
        // Use stored API key
        apiKey = decryptApiKey(model.api_key_encrypted);
      }
      // For local providers (lmstudio, ollama), apiKey may remain undefined

      if (body.base_url) {
        baseUrl = body.base_url;
        usingProvidedBaseUrl = true;
      }
    } catch {
      // No body or invalid JSON, use stored API key and base URL
      if (model.api_key_encrypted) {
        apiKey = decryptApiKey(model.api_key_encrypted);
      }
      baseUrl = model.base_url;
    }

    // Test connection
    const isValid = await ClientFactory.testConnection(
      model.provider,
      apiKey,
      model.model_name,
      baseUrl
    );

    if (isValid) {
      logger.info('API connection test successful', {
        modelId: id,
        provider: model.provider,
        usingProvidedKey,
        usingProvidedBaseUrl,
      });
      logger.logApiRequest(
        'POST',
        `/api/models/${id}/test-connection`,
        200,
        Date.now() - startTime
      );

      return new Response(
        JSON.stringify({
          model_id: model.id,
          provider: model.provider,
          model_name: model.model_name,
          base_url: baseUrl,
          status: 'valid',
          message: 'Connection test successful',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      logger.warn('API connection test failed', {
        modelId: id,
        provider: model.provider,
        usingProvidedKey,
        usingProvidedBaseUrl,
      });
      logger.logApiRequest(
        'POST',
        `/api/models/${id}/test-connection`,
        401,
        Date.now() - startTime
      );

      return internalError('Connection test failed. Please check your credentials and base URL.', {
        code: 'CONNECTION_FAILED',
        provider: model.provider,
        provider_message: 'Could not connect to the provider API',
      });
    }
  } catch (error) {
    logger.logApiError('POST', `/api/models/${id}/test-connection`, error as Error);
    return createErrorResponse(error);
  }
};
