// src/pages/api/models.ts
// Model configuration API endpoints

import type { APIRoute } from 'astro';
import { insertModel, getModels, getModelUsageCount } from '../../lib/db';
import { ClientFactory } from '../../lib/api-clients';
import { validateCreateModel, validateProvider } from '../../lib/validators';
import type { Provider } from '../../lib/types';

// POST /api/models - Create new model
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateModel(body);
    if (!validation.valid) {
      return new Response(JSON.stringify(validation.error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { provider, model_name, api_key, notes } = body;

    // Test API key with provider
    const isValid = await ClientFactory.testConnection(provider, api_key, model_name);

    if (!isValid) {
      return new Response(
        JSON.stringify({
          error: 'API_KEY_AUTHENTICATION_FAILED',
          message: 'API key rejected by provider',
          details: { provider, provider_message: 'Invalid authentication credentials' },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create model
    const model = insertModel(provider, model_name, api_key, notes);

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
    console.error('POST /api/models error:', error);
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

// GET /api/models - List all models
export const GET: APIRoute = async ({ url }) => {
  try {
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const provider = url.searchParams.get('provider') as Provider | null;

    // Validate provider if provided
    if (provider) {
      const providerValidation = validateProvider(provider);
      if (!providerValidation.valid) {
        return new Response(JSON.stringify(providerValidation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
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

    return new Response(JSON.stringify({ models: modelsWithUsage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GET /api/models error:', error);
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
