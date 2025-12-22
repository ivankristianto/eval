// src/pages/api/templates/[id]/run.ts
// Run evaluation using template

import type { APIRoute } from 'astro';
import {
  getTemplateById,
  insertEvaluation,
  insertResult,
  incrementTemplateRunCount,
  getModelById,
} from '../../../../lib/db';
import { startEvaluation } from '../../../../lib/evaluator';
import { validateModelIds } from '../../../../lib/validators';

export const POST: APIRoute = async ({ params, request }) => {
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

    // Check for model override in request body
    let modelIds = template.model_ids;
    try {
      const body = await request.json();
      if (body.model_ids && Array.isArray(body.model_ids)) {
        const validation = validateModelIds(body.model_ids);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({
              error: 'INVALID_MODEL_OVERRIDE',
              message: 'At least one model must be selected',
              field: 'model_ids',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        modelIds = body.model_ids;
      }
    } catch {
      // No body or invalid JSON, use template's models
    }

    // Validate all models exist and are active
    const models: { id: string; model_name: string; provider: string }[] = [];
    for (const modelId of modelIds) {
      const model = getModelById(modelId);
      if (!model || !model.is_active) {
        return new Response(
          JSON.stringify({
            error: 'MODEL_INACTIVE',
            message: 'Model is not active or does not exist',
            details: { model_id: modelId, reason: 'not_found_or_inactive' },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      models.push({
        id: model.id,
        model_name: model.model_name,
        provider: model.provider,
      });
    }

    // Create evaluation record with template reference
    const evaluation = insertEvaluation(
      template.instruction_text,
      template.accuracy_rubric,
      template.expected_output,
      template.partial_credit_concepts,
      template.id
    );

    // Create result records for each model
    for (const model of models) {
      insertResult(evaluation.id, model.id);
    }

    // Increment template run count
    incrementTemplateRunCount(template.id);

    // Start evaluation in background
    startEvaluation({
      evaluationId: evaluation.id,
      modelIds,
      instruction: template.instruction_text,
      rubricType: template.accuracy_rubric,
      expectedOutput: template.expected_output || '',
      partialCreditConcepts: template.partial_credit_concepts,
    });

    return new Response(
      JSON.stringify({
        evaluation_id: evaluation.id,
        template_id: template.id,
        status: 'pending',
        models: models.map((m) => ({
          model_id: m.id,
          model_name: m.model_name,
          provider: m.provider,
          status: 'pending',
        })),
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('POST /api/templates/:id/run error:', error);
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
