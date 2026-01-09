// src/pages/api/templates/[id]/run.ts
// Run evaluation using template

import type { APIRoute } from 'astro';
import {
  getTemplateById,
  insertEvaluation,
  insertResult,
  incrementTemplateRunCount,
  getModelById,
} from '@lib/db';
import { startEvaluation } from '@lib/evaluation/evaluator';
import { validateModelIds } from '@lib/validation/validators';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Templates:Run');

/**
 * POST /api/templates/:id/run
 * Executes a new evaluation based on the specified template.
 * Supports overriding the default models configured in the template.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('POST', '/api/templates/:id/run', 400, Date.now() - startTime);
      return badRequest('Template ID is required', 'INVALID_INPUT');
    }

    const template = getTemplateById(id);

    if (!template) {
      logger.logApiRequest('POST', `/api/templates/${id}/run`, 404, Date.now() - startTime);
      return notFound('Template');
    }

    // Check for model override in request body
    let modelIds = template.model_ids;
    try {
      const body = await request.json();
      if (body.model_ids && Array.isArray(body.model_ids)) {
        const validation = validateModelIds(body.model_ids);
        if (!validation.valid) {
          logger.logApiRequest('POST', `/api/templates/${id}/run`, 400, Date.now() - startTime);
          return badRequest('At least one model must be selected', 'INVALID_MODEL_OVERRIDE', {
            field: 'model_ids',
          });
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
        logger.logApiRequest('POST', `/api/templates/${id}/run`, 400, Date.now() - startTime);
        return badRequest('Model is not active or does not exist', 'MODEL_INACTIVE', {
          model_id: modelId,
          reason: 'not_found_or_inactive',
        });
      }
      models.push({
        id: model.id,
        model_name: model.model_name,
        provider: model.provider,
      });
    }

    logger.info('Running evaluation from template', {
      templateId: id,
      templateName: template.name,
      modelCount: models.length,
    });

    // Create evaluation record with template reference
    const evaluation = insertEvaluation(
      template.instruction_text,
      template.accuracy_rubric,
      template.expected_output,
      template.partial_credit_concepts,
      template.id,
      template.system_prompt,
      template.temperature
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
      systemPrompt: template.system_prompt,
      temperature: template.temperature,
    });

    logger.info('Evaluation started from template', {
      evaluationId: evaluation.id,
      templateId: id,
    });
    logger.logApiRequest('POST', `/api/templates/${id}/run`, 201, Date.now() - startTime);

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
    logger.logApiError('POST', `/api/templates/${id}/run`, error as Error);
    return createErrorResponse(error);
  }
};
