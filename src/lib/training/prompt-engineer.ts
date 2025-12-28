/**
 * Prompt Engineer Module
 * Uses LLM to refine judge prompts based on failure analysis
 */

import { callModel } from '@lib/utils/api-clients';
import type { FailureAnalysisContext } from './failure-analysis';

/**
 * Result of a prompt refinement process.
 */
export interface PromptRefinementResult {
  improved_prompt: string | null;
  rationale?: string;
  expected_impact?: string;
  error?: string;
}

/**
 * Refine judge prompt using Prompt Engineer LLM.
 *
 * Builds comprehensive context from failure analysis and asks LLM to:
 * 1. Analyze failure patterns (false positives and false negatives)
 * 2. Identify weaknesses in current prompt
 * 3. Generate improved prompt that addresses failures
 * 4. Explain rationale and expected impact
 *
 * @param failureContext - Failure analysis context with metrics and examples
 * @param promptEngineerModelId - Model ID for prompt engineer
 * @returns Promise with refined prompt, rationale, and expected impact
 */
export async function refineJudgePrompt(
  failureContext: FailureAnalysisContext,
  promptEngineerModelId: string
): Promise<PromptRefinementResult> {
  try {
    // Build comprehensive prompt for the LLM
    const systemPrompt = buildPromptRefinementContext(failureContext);

    // Call Prompt Engineer Model
    const response = await callModel(promptEngineerModelId, systemPrompt);

    // Parse JSON response
    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      return {
        improved_prompt: null,
        error: `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    // Extract fields from response
    return {
      improved_prompt: parsedResponse.improved_prompt || null,
      rationale: parsedResponse.rationale,
      expected_impact: parsedResponse.expected_impact,
    };
  } catch (error) {
    return {
      improved_prompt: null,
      error: error instanceof Error ? error.message : 'Unknown error during prompt refinement',
    };
  }
}

/**
 * Build detailed context prompt for LLM prompt engineer.
 * Includes metrics, failure examples, correct examples, and chain-of-thought instructions.
 * @param context - Failure analysis context
 * @returns String containing the full system prompt for the prompt engineer model
 */
function buildPromptRefinementContext(context: FailureAnalysisContext): string {
  const {
    current_metrics,
    iteration_number,
    false_positives,
    false_negatives,
    correct_examples,
    current_prompt,
    task_description,
  } = context;

  return `You are an expert prompt engineer tasked with refining a judge prompt for an LLM evaluation system.

## Task Description
${task_description}

## Current Judge Prompt (Iteration ${iteration_number})
"${current_prompt}"

## Current Performance Metrics
- Precision: ${current_metrics.precision.toFixed(2)}
- Recall: ${current_metrics.recall.toFixed(2)}
- F1 Score: ${current_metrics.f1_score.toFixed(2)}
- Cohen's Kappa: ${current_metrics.cohens_kappa.toFixed(2)}
- Accuracy: ${current_metrics.accuracy.toFixed(2)}

Confusion Matrix:
- True Positives (TP): ${current_metrics.confusion_matrix.true_positives}
- True Negatives (TN): ${current_metrics.confusion_matrix.true_negatives}
- False Positives (FP): ${current_metrics.confusion_matrix.false_positives}
- False Negatives (FN): ${current_metrics.confusion_matrix.false_negatives}

## Failure Analysis

### False Positives (Judge agreed, but should have disagreed - ${false_positives.length} examples)
${
  false_positives.length > 0
    ? false_positives
        .map(
          (fp, idx) => `
${idx + 1}. Model Output: "${fp.model_output}"
   Expected Output: "${fp.expected_output}"
   Why it should have disagreed: ${fp.why_it_should_have_disagreed}
`
        )
        .join('\n')
    : 'No false positives in this iteration.'
}

### False Negatives (Judge disagreed, but should have agreed - ${false_negatives.length} examples)
${
  false_negatives.length > 0
    ? false_negatives
        .map(
          (fn, idx) => `
${idx + 1}. Model Output: "${fn.model_output}"
   Expected Output: "${fn.expected_output}"
   Why it should have agreed: ${fn.why_it_should_have_agreed}
`
        )
        .join('\n')
    : 'No false negatives in this iteration.'
}

### Correct Classifications (For calibration - ${correct_examples.length} examples)
${
  correct_examples.length > 0
    ? correct_examples
        .map(
          (ce, idx) => `
${idx + 1}. Model Output: "${ce.model_output}"
   Expected Output: "${ce.expected_output}"
   Decision: ${ce.decision}
   Reasoning: ${ce.reasoning}
`
        )
        .join('\n')
    : 'No correct examples available for this iteration.'
}

## Your Task

Using chain-of-thought reasoning, analyze the failure patterns and refine the judge prompt to improve performance.

### Step 1: Identify Patterns
- What common patterns do you see in false positives?
- What common patterns do you see in false negatives?
- What aspects of the current prompt are causing these failures?

### Step 2: Design Improvements
- How should the prompt be modified to reduce false positives?
- How should the prompt be modified to reduce false negatives?
- What specific guidance should be added to the prompt?

### Step 3: Generate Refined Prompt
Create an improved judge prompt that:
1. Addresses the identified failure patterns
2. Maintains the strengths shown in correct classifications
3. Provides clear, actionable criteria for the judge
4. Is concise but comprehensive

## Response Format

Respond with a JSON object containing:
{
  "improved_prompt": "Your refined judge prompt here",
  "rationale": "Explain what you changed and why (2-3 sentences)",
  "expected_impact": "Predict how this will affect metrics (1-2 sentences)"
}

Important:
- The improved_prompt should be a complete, standalone prompt (not a diff)
- Focus on the most impactful changes based on failure patterns
- Ensure the prompt is clear and unambiguous for the judge model
`;
}
