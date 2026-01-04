/**
 * POST /api/prompts/optimize
 * Generic prompt optimization endpoint that suggests improvements without iteration context
 */

import type { APIRoute } from 'astro';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { parseJsonBody } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Prompts:Optimize');

/**
 * POST /api/prompts/optimize
 * Suggests improvements to a prompt without requiring iteration/failure context.
 *
 * Request body:
 * {
 *   prompt_text: string;
 *   prompt_type: 'task' | 'judge';
 *   persona_id?: string; // Optional: for context-aware optimization
 * }
 *
 * Response:
 * {
 *   suggested_prompt: string;
 *   rationale: string;
 *   improvements: string[];
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      prompt_text: string;
      prompt_type: 'task' | 'judge';
      persona_id?: string;
    }>(request);

    const { prompt_text, prompt_type, _persona_id } = body;

    if (!prompt_text || !prompt_type) {
      logger.logApiRequest('POST', '/api/prompts/optimize', 400, Date.now() - startTime);
      return badRequest('prompt_text and prompt_type are required', 'INVALID_REQUEST');
    }

    // TODO: Implement actual LLM-based prompt optimization
    // For now, return mock suggestions based on prompt type
    const mockSuggestions = generateMockSuggestions(prompt_text, prompt_type);

    logger.logApiRequest('POST', '/api/prompts/optimize', 200, Date.now() - startTime);

    return new Response(JSON.stringify(mockSuggestions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('POST', '/api/prompts/optimize', error as Error);
    return createErrorResponse(error);
  }
};

/**
 * Generate mock optimization suggestions
 * TODO: Replace with actual LLM-based optimization
 */
function generateMockSuggestions(
  promptText: string,
  promptType: 'task' | 'judge'
): {
  suggested_prompt: string;
  rationale: string;
  improvements: string[];
} {
  if (promptType === 'task') {
    return {
      suggested_prompt: `${promptText}\n\nAdditional Guidelines:\n- Be specific and concrete in your responses\n- Include relevant examples when appropriate\n- Keep responses concise and focused`,
      rationale:
        'Added explicit structure and guidelines to improve consistency and clarity. These changes help reduce ambiguity in task outputs.',
      improvements: [
        'Added structured guidelines section',
        'Emphasized specificity and concreteness',
        'Included instruction for relevant examples',
      ],
    };
  } else {
    return {
      suggested_prompt: `${promptText}\n\nEvaluation Criteria:\n- PASS: Output fully addresses the requirements\n- FAIL: Output is incomplete, incorrect, or off-topic\n\nProvide specific feedback explaining your decision.`,
      rationale:
        'Added explicit PASS/FAIL criteria and requirement for specific feedback. This reduces false positives and improves evaluation consistency.',
      improvements: [
        'Added explicit PASS/FAIL criteria',
        'Required specific feedback for decisions',
        'Clarified evaluation thresholds',
      ],
    };
  }
}
