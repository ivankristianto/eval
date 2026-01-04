/**
 * Prompt Optimizer
 * Analyzes Pass/Fail feedback and calls Prompt Engineer LLM to suggest prompt improvements
 */

import type { Database } from 'better-sqlite3';
import type { TrainingPairResult } from '@src-types/training';
import { callModel } from '@lib/utils/api-clients';
import { createLogger } from '@lib/logger';

const logger = createLogger('PromptOptimizer');

/**
 * Prompt type to optimize
 */
export type PromptType = 'task' | 'judge';

/**
 * Configuration for prompt optimization
 */
export interface PromptOptimizerConfig {
  persona_id: string;
  prompt_type: PromptType;
  evaluation_run_id?: string; // If provided, only analyze results from this run
  max_examples?: number; // Max examples to include in analysis (default: 10)
}

/**
 * Result of prompt optimization
 */
export interface PromptOptimizationResult {
  improved_prompt: string | null;
  rationale: string;
  expected_impact: string;
  error?: string;
}

/**
 * Feedback context for prompt optimization
 */
interface FeedbackContext {
  current_prompt: string;
  pass_examples: Array<{
    input: string;
    generated_output: string;
    expected_output: string;
    judge_reasoning: string;
  }>;
  fail_examples: Array<{
    input: string;
    generated_output: string;
    expected_output: string;
    judge_reasoning: string;
  }>;
  metrics: {
    total_results: number;
    pass_count: number;
    fail_count: number;
    pass_rate: number;
  };
}

/**
 * Analyze Pass/Fail feedback and generate suggested prompt improvements
 *
 * @param config - Optimization configuration
 * @param db - Database connection
 * @returns Prompt optimization result with improved prompt and rationale
 * @throws Error if persona not found or no feedback to analyze
 */
export async function optimizePrompt(
  config: PromptOptimizerConfig,
  db: Database
): Promise<PromptOptimizationResult> {
  const { persona_id, prompt_type, evaluation_run_id, max_examples = 10 } = config;

  logger.info('Starting prompt optimization', { persona_id, prompt_type, evaluation_run_id });

  // Get persona with current prompt and prompt engineer model
  const persona = db
    .prepare(
      `SELECT p.*,
              tpv.prompt_text as task_prompt,
              jpv.prompt_text as judge_prompt
       FROM personas p
       LEFT JOIN task_prompt_versions tpv ON tpv.id = p.current_task_prompt_version_id
       LEFT JOIN judge_prompt_versions jpv ON jpv.id = p.current_judge_prompt_version_id
       WHERE p.id = ?`
    )
    .get(persona_id) as
    | {
        id: string;
        name: string;
        prompt_engineer_model_id: string;
        task_prompt: string | null;
        judge_prompt: string | null;
      }
    | undefined;

  if (!persona) {
    throw new Error(`Persona not found: ${persona_id}`);
  }

  // Determine current prompt based on type
  const currentPrompt = prompt_type === 'task' ? persona.task_prompt : persona.judge_prompt;

  if (!currentPrompt) {
    throw new Error(`No current ${prompt_type} prompt found for persona: ${persona_id}`);
  }

  if (!persona.prompt_engineer_model_id) {
    throw new Error(`Prompt engineer model not configured for persona: ${persona_id}`);
  }

  // Get training pair results with judge feedback
  let results: TrainingPairResult[];

  if (evaluation_run_id) {
    results = db
      .prepare(
        `SELECT tpr.*
         FROM training_pair_results tpr
         WHERE tpr.evaluation_run_id = ?
           AND tpr.judge_rating IS NOT NULL
         ORDER BY tpr.created_at ASC`
      )
      .all(evaluation_run_id) as TrainingPairResult[];
  } else {
    results = db
      .prepare(
        `SELECT tpr.*
         FROM training_pair_results tpr
         WHERE tpr.persona_id = ?
           AND tpr.judge_rating IS NOT NULL
         ORDER BY tpr.created_at DESC
         LIMIT 100`
      )
      .all(persona_id) as TrainingPairResult[];
  }

  if (results.length === 0) {
    throw new Error(`No training pair results with judge ratings found for persona: ${persona_id}`);
  }

  // Calculate metrics and collect examples
  const passResults = results.filter((r) => r.judge_rating === 'pass');
  const failResults = results.filter((r) => r.judge_rating === 'fail');

  const metrics = {
    total_results: results.length,
    pass_count: passResults.length,
    fail_count: failResults.length,
    pass_rate: passResults.length / results.length,
  };

  // Collect examples with training pair data
  const passExamples: FeedbackContext['pass_examples'] = [];
  const failExamples: FeedbackContext['fail_examples'] = [];

  for (const result of passResults.slice(0, Math.floor(max_examples / 2))) {
    const pair = db
      .prepare('SELECT input, expected_output FROM training_pairs WHERE id = ?')
      .get(result.training_pair_id) as { input: string; expected_output: string } | undefined;

    if (pair && result.generated_output) {
      passExamples.push({
        input: pair.input,
        generated_output: result.generated_output,
        expected_output: pair.expected_output,
        judge_reasoning: result.judge_reasoning || 'No reasoning provided',
      });
    }
  }

  for (const result of failResults.slice(0, Math.floor(max_examples / 2))) {
    const pair = db
      .prepare('SELECT input, expected_output FROM training_pairs WHERE id = ?')
      .get(result.training_pair_id) as { input: string; expected_output: string } | undefined;

    if (pair && result.generated_output) {
      failExamples.push({
        input: pair.input,
        generated_output: result.generated_output,
        expected_output: pair.expected_output,
        judge_reasoning: result.judge_reasoning || 'No reasoning provided',
      });
    }
  }

  // Build feedback context
  const context: FeedbackContext = {
    current_prompt: currentPrompt,
    pass_examples: passExamples,
    fail_examples: failExamples,
    metrics,
  };

  // Call prompt engineer to generate suggestions
  try {
    const optimizationPrompt = buildOptimizationPrompt(prompt_type, context);
    const response = await callModel(persona.prompt_engineer_model_id, optimizationPrompt);

    if (!response || typeof response !== 'string') {
      return {
        improved_prompt: null,
        rationale: 'Failed to get response from prompt engineer model',
        expected_impact: '',
        error: 'LLM returned empty or invalid response',
      };
    }

    // Parse JSON response
    const parsed = parseOptimizationResponse(response);

    logger.info('Prompt optimization completed', {
      persona_id,
      prompt_type,
      has_improved_prompt: !!parsed.improved_prompt,
    });

    return parsed;
  } catch (error) {
    logger.error('Prompt optimization failed', error as Error, { persona_id, prompt_type });
    return {
      improved_prompt: null,
      rationale: 'Failed to generate prompt improvements',
      expected_impact: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build the optimization prompt for the prompt engineer LLM
 * @param promptType - Type of prompt to optimize
 * @param context - Feedback context
 * @returns Optimization prompt string
 */
function buildOptimizationPrompt(promptType: PromptType, context: FeedbackContext): string {
  const { current_prompt, pass_examples, fail_examples, metrics } = context;

  const promptTypeName = promptType === 'task' ? 'Task' : 'Judge';

  return `You are an expert prompt engineer tasked with improving a ${promptTypeName.toLowerCase()} prompt based on evaluation feedback.

## Current ${promptTypeName} Prompt
"${current_prompt}"

## Current Performance Metrics
- Total Results: ${metrics.total_results}
- Pass Count: ${metrics.pass_count}
- Fail Count: ${metrics.fail_count}
- Pass Rate: ${(metrics.pass_rate * 100).toFixed(1)}%

## Pass Examples (${pass_examples.length} examples)
${pass_examples.length > 0 ? pass_examples.map((ex, idx) => `
${idx + 1}. Input: "${ex.input.substring(0, 200)}${ex.input.length > 200 ? '...' : ''}"
   Generated Output: "${ex.generated_output.substring(0, 200)}${ex.generated_output.length > 200 ? '...' : ''}"
   Expected Output: "${ex.expected_output.substring(0, 200)}${ex.expected_output.length > 200 ? '...' : ''}"
   Judge Reasoning: "${ex.judge_reasoning}"
`).join('') : 'No pass examples available.'}

## Fail Examples (${fail_examples.length} examples)
${fail_examples.length > 0 ? fail_examples.map((ex, idx) => `
${idx + 1}. Input: "${ex.input.substring(0, 200)}${ex.input.length > 200 ? '...' : ''}"
   Generated Output: "${ex.generated_output.substring(0, 200)}${ex.generated_output.length > 200 ? '...' : ''}"
   Expected Output: "${ex.expected_output.substring(0, 200)}${ex.expected_output.length > 200 ? '...' : ''}"
   Judge Reasoning: "${ex.judge_reasoning}"
`).join('') : 'No fail examples available.'}

## Your Task

Analyze the feedback and generate an improved ${promptTypeName.toLowerCase()} prompt that:
1. Addresses common failure patterns
2. Maintains successful patterns from pass examples
3. Provides clearer guidance
4. Is concise but comprehensive

## Response Format

Respond with a JSON object containing:
{
  "improved_prompt": "Your improved prompt here",
  "rationale": "Explain what you changed and why (2-3 sentences)",
  "expected_impact": "Predict how this will improve pass rate (1-2 sentences)"
}

Important:
- The improved_prompt should be a complete, standalone prompt (not a diff)
- Focus on the most impactful changes based on failure patterns
- Ensure the prompt is clear and unambiguous
- Format the response strictly as JSON
- Avoid any additional commentary outside the JSON response
- Do not use markdown formatting in your response`;
}

/**
 * Parse the optimization response from the LLM
 * @param response - Raw LLM response
 * @returns Parsed optimization result
 * @throws Error if response cannot be parsed
 */
function parseOptimizationResponse(response: string): PromptOptimizationResult {
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
      'improved_prompt' in parsed &&
      typeof parsed.improved_prompt === 'string' &&
      'rationale' in parsed &&
      typeof parsed.rationale === 'string'
    ) {
      return {
        improved_prompt: parsed.improved_prompt || null,
        rationale: parsed.rationale,
        expected_impact:
          'expected_impact' in parsed && typeof parsed.expected_impact === 'string'
            ? parsed.expected_impact
            : 'No expected impact provided',
      };
    }

    throw new Error('Invalid response structure: missing required fields');
  } catch (error) {
    logger.error('Failed to parse optimization response', error as Error, { response });
    throw new Error(
      `Failed to parse optimization response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get feedback summary for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Feedback summary with metrics
 */
export function getFeedbackSummary(personaId: string, db: Database): {
  total_results: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
} {
  const result = db
    .prepare(
      `SELECT
        COUNT(*) as total_results,
        SUM(CASE WHEN judge_rating = 'pass' THEN 1 ELSE 0 END) as pass_count,
        SUM(CASE WHEN judge_rating = 'fail' THEN 1 ELSE 0 END) as fail_count
       FROM training_pair_results
       WHERE persona_id = ? AND judge_rating IS NOT NULL`
    )
    .get(personaId) as { total_results: number; pass_count: number; fail_count: number };

  return {
    total_results: result.total_results,
    pass_count: result.pass_count,
    fail_count: result.fail_count,
    pass_rate: result.total_results > 0 ? result.pass_count / result.total_results : 0,
  };
}
