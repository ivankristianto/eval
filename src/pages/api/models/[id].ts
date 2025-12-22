// src/pages/api/models/[id].ts
// Individual model configuration endpoints

import type { APIRoute } from 'astro';
import {
  getModelById,
  updateModel,
  deleteModel,
  getModelUsageCount,
  hasActiveEvaluations,
} from '../../../lib/db';
import { ClientFactory } from '../../../lib/api-clients';
import { validateApiKeyFormat } from '../../../lib/validators';

// GET /api/models/:id - Get model details
export const GET: APIRoute = async ({ params }) => {
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
          model_id: id,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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
    console.error('GET /api/models/:id error:', error);
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

// PATCH /api/models/:id - Update model
export const PATCH: APIRoute = async ({ params, request }) => {
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

    const body = await request.json();
    const { is_active, notes, api_key } = body;

    // Check if trying to disable model with active evaluations
    if (is_active === false && hasActiveEvaluations(id)) {
      return new Response(
        JSON.stringify({
          error: 'CANNOT_UPDATE',
          message: 'Cannot disable model with active evaluations',
          model_id: id,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate and test new API key if provided
    let validationStatus: 'valid' | 'invalid' = 'valid';
    let errorMessage: string | undefined;

    if (api_key) {
      const apiKeyValidation = validateApiKeyFormat(api_key, model.provider);
      if (!apiKeyValidation.valid) {
        return new Response(JSON.stringify(apiKeyValidation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const isValid = await ClientFactory.testConnection(model.provider, api_key, model.model_name);
      if (!isValid) {
        validationStatus = 'invalid';
        errorMessage = 'API key validation failed';
      }
    }

    // Build updates object
    const updates: Partial<{ is_active: boolean; notes: string; api_key: string }> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (notes !== undefined) updates.notes = notes;
    if (api_key && validationStatus === 'valid') updates.api_key = api_key;

    const updated = updateModel(id, updates);

    if (!updated) {
      return new Response(
        JSON.stringify({
          error: 'UPDATE_FAILED',
          message: 'Failed to update model',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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
    console.error('PATCH /api/models/:id error:', error);
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

// DELETE /api/models/:id - Delete model
export const DELETE: APIRoute = async ({ params }) => {
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

    // Check if model has evaluation results
    const usageCount = getModelUsageCount(id);
    if (usageCount > 0) {
      return new Response(
        JSON.stringify({
          error: 'CANNOT_DELETE',
          message: `Cannot delete model with existing evaluation results (${usageCount} evaluations)`,
          model_id: id,
          result_count: usageCount,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const deleted = deleteModel(id);

    if (!deleted) {
      return new Response(
        JSON.stringify({
          error: 'DELETE_FAILED',
          message: 'Failed to delete model',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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
    console.error('DELETE /api/models/:id error:', error);
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
