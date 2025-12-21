// src/pages/api/models/[id]/test-connection.ts
// Test API key connection endpoint

import type { APIRoute } from 'astro';
import { getModelById, decryptApiKey } from '../../../../lib/db';
import { ClientFactory } from '../../../../lib/api-clients';
import { validateApiKeyFormat } from '../../../../lib/validators';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Model ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const model = getModelById(id);

    if (!model) {
      return new Response(
        JSON.stringify({
          error: 'MODEL_NOT_FOUND',
          message: 'Model does not exist',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if a new API key was provided in the request body
    let apiKey: string;
    try {
      const body = await request.json();
      if (body.api_key) {
        // Validate the provided API key format
        const validation = validateApiKeyFormat(body.api_key, model.provider);
        if (!validation.valid) {
          return new Response(JSON.stringify(validation.error), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        apiKey = body.api_key;
      } else {
        // Use stored API key
        apiKey = decryptApiKey(model.api_key_encrypted);
      }
    } catch {
      // No body or invalid JSON, use stored API key
      apiKey = decryptApiKey(model.api_key_encrypted);
    }

    // Test connection
    const isValid = await ClientFactory.testConnection(model.provider, apiKey, model.model_name);

    if (isValid) {
      return new Response(
        JSON.stringify({
          model_id: model.id,
          provider: model.provider,
          model_name: model.model_name,
          status: 'valid',
          message: 'API key is valid',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          error: 'API_KEY_INVALID',
          message: 'API key is invalid or expired',
          details: {
            provider: model.provider,
            provider_message: 'Invalid authentication credentials',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('POST /api/models/:id/test-connection error:', error);
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
