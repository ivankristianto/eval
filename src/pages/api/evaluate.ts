// src/pages/api/evaluate.ts
// Evaluation submission endpoint

import type { APIRoute } from 'astro';
import { insertEvaluation, insertResult, getModelById } from '../../lib/db';
import { startEvaluation } from '../../lib/evaluator';
import { validateCreateEvaluation } from '../../lib/validators';
import type { RubricType } from '../../lib/types';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateEvaluation(body);
    if (!validation.valid) {
      return new Response(JSON.stringify(validation.error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { instruction, model_ids, rubric_type, expected_output, partial_credit_concepts } = body;

    // Validate all models exist and are active
    const models: { id: string; model_name: string; provider: string }[] = [];
    for (const modelId of model_ids) {
      const model = getModelById(modelId);
      if (!model) {
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
      if (!model.is_active) {
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

    // Create evaluation record
    const evaluation = insertEvaluation(
      instruction,
      rubric_type as RubricType,
      expected_output,
      partial_credit_concepts
    );

    // Create result records for each model
    for (const model of models) {
      insertResult(evaluation.id, model.id);
    }

    // Start evaluation in background
    startEvaluation({
      evaluationId: evaluation.id,
      modelIds: model_ids,
      instruction,
      rubricType: rubric_type as RubricType,
      expectedOutput: expected_output,
      partialCreditConcepts: partial_credit_concepts,
    });

    return new Response(
      JSON.stringify({
        evaluation_id: evaluation.id,
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
    console.error('POST /api/evaluate error:', error);
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
