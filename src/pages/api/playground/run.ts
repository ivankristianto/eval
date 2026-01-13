// src/pages/api/playground/run.ts
// Playground API for running single-shot evaluations with override prompts

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db/db';
import { getPersona, getTrainingPair } from '@lib/db/persona-db';
import { getCurrentTaskVersion, getCurrentJudgeVersion } from '@lib/db/persona-db';
import { validatePlaygroundRun } from '@lib/validation/playground-validator';
import { badRequest, createErrorResponse, notFound } from '@lib/api-error-handler';
import { callModel } from '@lib/utils/api-clients';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Playground:Run');

/**
 * Response from playground run
 */
interface PlaygroundRunResponse {
  taskOutput: string;
  judgeDecision: {
    rating: 'pass' | 'fail';
    reasoning: string;
    feedback?: string;
  };
  metadata: {
    personaId: string;
    pairId: string;
    taskModelId: string;
    judgeModelId: string;
    taskPrompt?: string;
    judgePrompt?: string;
  };
}

/**
 * POST /api/playground/run
 *
 * Runs a single-shot evaluation using a persona's models with optional prompt overrides.
 * Generates a task output, then evaluates it with the judge model.
 *
 * Request body:
 * - personaId: ID of the persona to use
 * - pairId: ID of the training pair to evaluate
 * - taskPrompt?: Optional override for the task prompt (default: persona's current)
 * - judgePrompt?: Optional override for the judge prompt (default: persona's current)
 *
 * Returns the final task output and judge decision (non-streaming)
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Validate input
    const validation = validatePlaygroundRun(body);
    if (!validation.valid) {
      logger.logApiRequest('POST', '/api/playground/run', 400, Date.now() - startTime);
      return badRequest(
        validation.error?.message || 'Invalid playground run data',
        'VALIDATION_ERROR',
        validation.error
      );
    }

    const { personaId, pairId, taskPrompt, judgePrompt } = body;

    logger.info('Playground run requested', { personaId, pairId });

    const db = getDatabase();

    // Get persona
    const persona = getPersona(personaId, db);
    if (!persona) {
      logger.logApiRequest('POST', '/api/playground/run', 404, Date.now() - startTime);
      return notFound('Persona');
    }

    // Get training pair
    const trainingPair = getTrainingPair(pairId, db);
    if (!trainingPair) {
      logger.logApiRequest('POST', '/api/playground/run', 404, Date.now() - startTime);
      return notFound('Training pair');
    }

    // Verify training pair belongs to persona
    if (trainingPair.persona_id !== personaId) {
      logger.logApiRequest('POST', '/api/playground/run', 400, Date.now() - startTime);
      return badRequest(
        'Training pair does not belong to the specified persona',
        'VALIDATION_ERROR'
      );
    }

    // Get prompts (use override if provided, otherwise use persona's current)
    const finalTaskPrompt = taskPrompt || getCurrentTaskVersion(personaId, db)?.prompt_text;
    const finalJudgePrompt = judgePrompt || getCurrentJudgeVersion(personaId, db)?.prompt_text;

    if (!finalTaskPrompt) {
      logger.logApiRequest('POST', '/api/playground/run', 400, Date.now() - startTime);
      return badRequest(
        'No task prompt available. Provide taskPrompt override or ensure persona has a current task prompt.',
        'VALIDATION_ERROR'
      );
    }

    if (!finalJudgePrompt) {
      logger.logApiRequest('POST', '/api/playground/run', 400, Date.now() - startTime);
      return badRequest(
        'No judge prompt available. Provide judgePrompt override or ensure persona has a current judge prompt.',
        'VALIDATION_ERROR'
      );
    }

    logger.debug('Prompts resolved', {
      taskPromptOverride: !!taskPrompt,
      judgePromptOverride: !!judgePrompt,
      taskPromptLength: finalTaskPrompt.length,
      judgePromptLength: finalJudgePrompt.length,
    });

    // Step 1: Generate task output
    logger.debug('Generating task output', {
      personaId,
      pairId,
      taskModelId: persona.task_model_id,
    });

    const taskOutput = await callModel(persona.task_model_id, trainingPair.input, {
      systemPrompt: finalTaskPrompt,
    });

    logger.debug('Task output generated', {
      outputLength: taskOutput.length,
      preview: taskOutput.substring(0, 100) + (taskOutput.length > 100 ? '...' : ''),
    });

    // Step 2: Evaluate with judge
    logger.debug('Evaluating with judge', {
      personaId,
      pairId,
      judgeModelId: persona.judge_model_id,
    });

    const judgeInstruction = buildJudgeInstruction(
      trainingPair.input,
      taskOutput,
      trainingPair.expected_output
    );

    const judgeResponseRaw = await callModel(persona.judge_model_id, judgeInstruction, {
      systemPrompt: finalJudgePrompt,
    });

    // Parse judge response
    const judgeDecision = parseJudgeResponse(judgeResponseRaw);

    logger.debug('Judge decision received', {
      rating: judgeDecision.rating,
      reasoningLength: judgeDecision.reasoning.length,
    });

    logger.logApiRequest('POST', '/api/playground/run', 200, Date.now() - startTime);

    const response: PlaygroundRunResponse = {
      taskOutput,
      judgeDecision,
      metadata: {
        personaId,
        pairId,
        taskModelId: persona.task_model_id,
        judgeModelId: persona.judge_model_id,
        taskPrompt: taskPrompt || undefined,
        judgePrompt: judgePrompt || undefined,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('POST', '/api/playground/run', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * Build the instruction for the judge model
 * @param input - The original input
 * @param generatedOutput - The output to evaluate
 * @param expectedOutput - The expected/correct output
 * @returns Judge instruction string
 */
function buildJudgeInstruction(
  input: string,
  generatedOutput: string,
  expectedOutput: string
): string {
  return `Please evaluate the following generated output against the expected output.

**Input:**
${input}

**Generated Output:**
${generatedOutput}

**Expected Output:**
${expectedOutput}

Based on these, provide your evaluation in the following JSON format:
\`\`\`json
{
  "rating": "pass" or "fail",
  "reasoning": "Your explanation for the rating",
  "feedback": "Optional feedback for improvement"
}
\`\`\``;
}

/**
 * Parse the judge response from the LLM
 * @param response - Raw LLM response
 * @returns Parsed judge response
 * @throws Error if response cannot be parsed
 */
function parseJudgeResponse(response: string): {
  rating: 'pass' | 'fail';
  reasoning: string;
  feedback?: string;
} {
  // Try to extract JSON from response
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Find JSON object in response
  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch && jsonObjectMatch[0]) {
    jsonStr = jsonObjectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr) as unknown;

    // Validate response structure
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'rating' in parsed &&
      typeof parsed.rating === 'string' &&
      (parsed.rating === 'pass' || parsed.rating === 'fail')
    ) {
      return {
        rating: parsed.rating,
        reasoning:
          'reasoning' in parsed && typeof parsed.reasoning === 'string'
            ? parsed.reasoning
            : 'No reasoning provided',
        feedback:
          'feedback' in parsed && typeof parsed.feedback === 'string' ? parsed.feedback : undefined,
      };
    }

    throw new Error('Invalid response structure: missing or invalid rating field');
  } catch (error) {
    logger.error('Failed to parse judge response', error as Error, { response });
    throw new Error(
      `Failed to parse judge response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
