// src/pages/api/training/validate-models.ts
// Model validation endpoint for persona creation

import type { APIRoute } from 'astro';
import {
  validateModelSeparation,
  getAvailableProviders,
  getModelsByProvider,
  suggestModelCombinations,
} from '@lib/validation/model-separation-validator';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:ValidateModels');

/**
 * POST /api/training/validate-models
 * Validates that task, judge, and prompt engineer models are from different providers.
 * @param root0
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();

    const { task_model_id, judge_model_id, prompt_engineer_model_id } = body;

    // Validate required fields
    if (!task_model_id || !judge_model_id || !prompt_engineer_model_id) {
      logger.logApiRequest('POST', '/api/training/validate-models', 400, Date.now() - startTime);
      return badRequest(
        'All model IDs are required: task_model_id, judge_model_id, prompt_engineer_model_id',
        'INVALID_INPUT'
      );
    }

    const validation = validateModelSeparation(
      task_model_id,
      judge_model_id,
      prompt_engineer_model_id
    );

    logger.logApiRequest('POST', '/api/training/validate-models', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        models: validation.models,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/training/validate-models', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * GET /api/training/validate-models
 * Retrieves available providers, models, or suggested model combinations.
 * @param root0
 * @param root0.url
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const action = url.searchParams.get('action');
    const provider = url.searchParams.get('provider');

    // Get available providers
    if (action === 'providers') {
      const providers = getAvailableProviders();
      logger.logApiRequest('GET', '/api/training/validate-models', 200, Date.now() - startTime);
      return new Response(JSON.stringify({ providers }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get models by provider
    if (action === 'models' && provider) {
      const models = getModelsByProvider(provider);
      logger.logApiRequest('GET', '/api/training/validate-models', 200, Date.now() - startTime);
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get suggested model combinations
    if (action === 'suggestions') {
      const suggestions = suggestModelCombinations();
      logger.logApiRequest('GET', '/api/training/validate-models', 200, Date.now() - startTime);
      return new Response(JSON.stringify({ suggestions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: return all data
    const providers = getAvailableProviders();
    const suggestions = suggestModelCombinations();

    logger.logApiRequest('GET', '/api/training/validate-models', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        providers,
        suggestions,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', '/api/training/validate-models', error as Error);
    return createErrorResponse(error);
  }
};
