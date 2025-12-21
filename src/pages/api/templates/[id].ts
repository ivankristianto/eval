// src/pages/api/templates/[id].ts
// Individual template endpoints

import type { APIRoute } from 'astro';
import { getTemplateById, updateTemplate, deleteTemplate, getModelById } from '../../../lib/db';
import {
  validateTemplateName,
  validateDescription,
  validateInstruction,
  validateRubricType,
  validateModelIds,
} from '../../../lib/validators';
import type { RubricType } from '../../../lib/types';

// GET /api/templates/:id - Get template details
export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Template ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const template = getTemplateById(id);

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template does not exist',
          template_id: id,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/templates/:id error:', error);
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

// PATCH /api/templates/:id - Update template
export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Template ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const template = getTemplateById(id);

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template does not exist',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();

    // Validate provided fields
    if (body.name !== undefined) {
      const validation = validateTemplateName(body.name);
      if (!validation.valid) {
        return new Response(JSON.stringify(validation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (body.description !== undefined) {
      const validation = validateDescription(body.description);
      if (!validation.valid) {
        return new Response(JSON.stringify(validation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (body.instruction_text !== undefined) {
      const validation = validateInstruction(body.instruction_text);
      if (!validation.valid) {
        return new Response(JSON.stringify(validation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (body.accuracy_rubric !== undefined) {
      const validation = validateRubricType(body.accuracy_rubric);
      if (!validation.valid) {
        return new Response(JSON.stringify(validation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (body.model_ids !== undefined) {
      const validation = validateModelIds(body.model_ids);
      if (!validation.valid) {
        return new Response(JSON.stringify(validation.error), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
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
    }> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.instruction_text !== undefined) updates.instruction_text = body.instruction_text;
    if (body.model_ids !== undefined) updates.model_ids = body.model_ids;
    if (body.accuracy_rubric !== undefined) updates.accuracy_rubric = body.accuracy_rubric;
    if (body.expected_output !== undefined) updates.expected_output = body.expected_output;
    if (body.partial_credit_concepts !== undefined)
      updates.partial_credit_concepts = body.partial_credit_concepts;

    const updated = updateTemplate(id, updates);

    if (!updated) {
      return new Response(
        JSON.stringify({
          error: 'UPDATE_FAILED',
          message: 'Failed to update template',
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
    console.error('PATCH /api/templates/:id error:', error);
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

// DELETE /api/templates/:id - Delete template
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Template ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const template = getTemplateById(id);

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template does not exist',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const deleted = deleteTemplate(id);

    if (!deleted) {
      return new Response(
        JSON.stringify({
          error: 'DELETE_FAILED',
          message: 'Failed to delete template',
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
        message: 'Template deleted successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('DELETE /api/templates/:id error:', error);
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
