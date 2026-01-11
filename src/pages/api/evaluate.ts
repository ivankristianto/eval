// src/pages/api/evaluate.ts
// Evaluation submission endpoint

import type { APIRoute } from 'astro';
import { insertEvaluation, insertResult, getModelById, getDatabase } from '@lib/db';
import { startEvaluation } from '@lib/evaluation/evaluator';
import {
  validateCreateEvaluation,
  validateSystemPrompt,
  validateTemperature,
} from '@lib/validation/validators';
import type { RubricType } from '@lib/utils/types';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Evaluate');

/**
 * POST /api/evaluate
 * Submits a new evaluation request for one or more models.
 * Validates inputs, creates database records, and starts background execution.
 * @param root0
 * @param root0.request
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateEvaluation(body);
    if (!validation.valid) {
      logger.logApiRequest('POST', '/api/evaluate', 400, Date.now() - startTime);
      return badRequest(
        validation.error?.message || 'Invalid evaluation data',
        'VALIDATION_ERROR',
        validation.error
      );
    }

    const {
      instruction,
      model_ids,
      rubric_type,
      expected_output,
      partial_credit_concepts,
      system_prompt,
      temperature,
    } = body;

    // Validate system prompt if provided
    const systemPromptValidation = validateSystemPrompt(system_prompt);
    if (!systemPromptValidation.valid) {
      logger.logApiRequest('POST', '/api/evaluate', 400, Date.now() - startTime);
      return badRequest(
        systemPromptValidation.error?.message || 'Invalid system prompt',
        'VALIDATION_ERROR',
        systemPromptValidation.error
      );
    }

    // Validate temperature if provided
    const temperatureValidation = validateTemperature(temperature);
    if (!temperatureValidation.valid) {
      logger.logApiRequest('POST', '/api/evaluate', 400, Date.now() - startTime);
      return badRequest(
        temperatureValidation.error?.message || 'Invalid temperature',
        'VALIDATION_ERROR',
        temperatureValidation.error
      );
    }

    // Validate all models exist and are active
    const models: { id: string; model_name: string; provider: string }[] = [];
    for (const modelId of model_ids) {
      const model = getModelById(modelId);
      if (!model || !model.is_active) {
        logger.logApiRequest('POST', '/api/evaluate', 400, Date.now() - startTime);
        // Return error code in error field for test compatibility
        return new Response(JSON.stringify({ error: 'MODEL_INACTIVE' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      models.push({
        id: model.id,
        model_name: model.model_name,
        provider: model.provider,
      });
    }

    logger.info('Creating evaluation', {
      modelCount: models.length,
      rubricType: rubric_type,
    });

    // Create evaluation and result records within a transaction for atomicity
    const db = getDatabase();
    const transaction = db.transaction(() => {
      // Create evaluation record
      const evaluation = insertEvaluation(
        instruction,
        rubric_type as RubricType,
        expected_output,
        partial_credit_concepts,
        undefined, // templateId
        system_prompt,
        temperature
      );

      // Create result records for each model
      for (const model of models) {
        insertResult(evaluation.id, model.id);
      }

      return evaluation;
    });

    const evaluation = transaction();

    // Start evaluation in background
    startEvaluation({
      evaluationId: evaluation.id,
      modelIds: model_ids,
      instruction,
      rubricType: rubric_type as RubricType,
      expectedOutput: expected_output,
      partialCreditConcepts: partial_credit_concepts,
      systemPrompt: system_prompt,
      temperature,
    });

    logger.info('Evaluation started', {
      evaluationId: evaluation.id,
      modelIds: model_ids,
    });
    logger.logApiRequest('POST', '/api/evaluate', 201, Date.now() - startTime);

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
    logger.logApiError('POST', '/api/evaluate', error as Error);
    return createErrorResponse(error);
  }
};
