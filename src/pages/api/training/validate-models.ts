// src/pages/api/training/validate-models.ts
// Model validation endpoint for persona creation

import type { APIRoute } from 'astro';
import {
  validateModelSeparation,
  getAvailableProviders,
  getModelsByProvider,
  suggestModelCombinations,
} from '../../../lib/model-separation-validator';

/**
 * POST /api/training/validate-models
 * Validates that task, judge, and prompt engineer models are from different providers.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const { task_model_id, judge_model_id, prompt_engineer_model_id } = body;

    // Validate required fields
    if (!task_model_id || !judge_model_id || !prompt_engineer_model_id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message:
            'All model IDs are required: task_model_id, judge_model_id, prompt_engineer_model_id',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const validation = validateModelSeparation(
      task_model_id,
      judge_model_id,
      prompt_engineer_model_id
    );

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
    console.error('POST /api/training/validate-models error:', error);
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

/**
 * GET /api/training/validate-models
 * Retrieves available providers, models, or suggested model combinations.
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const action = url.searchParams.get('action');
    const provider = url.searchParams.get('provider');

    // Get available providers
    if (action === 'providers') {
      const providers = getAvailableProviders();
      return new Response(JSON.stringify({ providers }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get models by provider
    if (action === 'models' && provider) {
      const models = getModelsByProvider(provider);
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get suggested model combinations
    if (action === 'suggestions') {
      const suggestions = suggestModelCombinations();
      return new Response(JSON.stringify({ suggestions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: return all data
    const providers = getAvailableProviders();
    const suggestions = suggestModelCombinations();

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
    console.error('GET /api/training/validate-models error:', error);
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
