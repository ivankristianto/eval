/**
 * Prompt Engineer Module
 * Uses LLM to refine judge prompts based on failure analysis
 */

import { callModel, extractJsonFromResponse } from '@lib/utils/api-clients';
import type { FailureAnalysisContext } from './failure-analysis';
import { createLogger } from '@lib/logger';

const logger = createLogger('PromptEngineer');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of atomic fact evaluation.
 */
export interface AtomicFactEvaluationResult {
  TP_count: number;
  TN_count: number;
  FP_count: number;
  FN_count: number;
  Reasoning: string;
}

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
 * Result of refining both task and judge prompts based on human feedback.
 */
export interface BothPromptsRefinementResult {
  refined_task_prompt: string | null;
  refined_judge_prompt: string | null;
  task_rationale?: string;
  judge_rationale?: string;
  expected_impact?: string;
  error?: string;
}

/**
 * Context for refining prompts based on human feedback.
 */
export interface HumanFeedbackContext {
  current_task_prompt: string;
  current_judge_prompt: string;
  human_disagreements: Array<{
    judge_decision: 'agree' | 'disagree';
    human_decision: 'agree' | 'disagree';
    generated_output: string;
    expected_output: string;
    judge_reasoning: string;
    human_feedback: string;
    input: string;
  }>;
  metrics: {
    f1_score: number;
    precision: number;
    recall: number;
    cohens_kappa: number;
    accuracy: number;
    confusion_matrix: {
      true_positives: number;
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
    };
  };
  iteration_number: number;
  total_decisions: number;
  disagreements_count: number;
}

// ============================================================================
// TASK MODEL PROMPT BUILDERS
// ============================================================================

/**
 * Build system prompt for task model.
 * @param taskPrompt - The task prompt instructions
 * @returns System prompt for task model
 */
export function buildTaskModelSystemPrompt(taskPrompt: string): string {
  return `You are a task model. Follow these instructions: ${taskPrompt}`;
}

/**
 * Build instruction for task model to generate response.
 * @param input - The input to process
 * @returns Instruction for task model
 */
export function buildTaskModelInstruction(input: string): string {
  return `Input: ${input}\n\nGenerate a response following the task instructions above.`;
}

// ============================================================================
// JUDGE MODEL PROMPT BUILDERS
// ============================================================================

/**
 * Build system prompt for judge model.
 * @param judgePrompt - The judge prompt/criteria
 * @returns System prompt for judge model
 */
export function buildJudgeSystemPrompt(judgePrompt: string): string {
  return `You are a judge model. Your task is to evaluate whether a generated output correctly addresses the input according to the following criteria:

${judgePrompt}

Evaluate the output and provide your decision in JSON format:
{
  "decision": "agree" or "disagree",
  "reasoning": "Brief explanation of your decision (1-2 sentences)"
}

Important:
- "agree" means the generated output correctly addresses the input according to the criteria
- "disagree" means the generated output does not correctly address the input
- Format the response strictly as JSON
- Avoid any additional commentary outside the JSON response
- Do not use markdown formatting in your response`;
}

/**
 * Build user instruction for judge model evaluation.
 * @param input - Original input
 * @param generatedOutput - Output from task model
 * @returns User instruction for judge model
 */
export function buildJudgeEvaluationInstruction(input: string, generatedOutput: string): string {
  return `Input: ${input}
Generated Output: ${generatedOutput}

Evaluate whether the generated output correctly addresses the input according to the criteria provided in the system prompt.`;
}

// ============================================================================
// ATOMIC FACT EVALUATION
// ============================================================================

/**
 * Build system prompt for atomic fact evaluation.
 * Evaluates model output against reference answer using atomic fact comparison.
 * @returns System prompt for atomic fact evaluation
 */
export function buildAtomicFactEvaluationSystemPrompt(): string {
  return `You are an expert evaluator for a RAG (Retrieval-Augmented Generation) system.
Your task is to compare a **Model Output** against a **Reference Answer** (Ground Truth).

You must evaluate based on "Atomic Facts" (individual pieces of information).

**Definitions:**
1. **True Positive (TP):** A fact stated in the **Model Output** that is semantically identical or equivalent to a fact in the **Reference Answer**.
2. **False Positive (FP):** A fact stated in the **Model Output** that is NOT present in the **Reference Answer** (hallucination or extra info).
3. **False Negative (FN):** A fact present in the **Reference Answer** that was omitted or missed by the **Model Output**.
4. **True Negative (TN):** A fact not stated in the **Model Output** that is also not in the **Reference Answer**.

**Steps to Follow:**
1. Break down the **Reference Answer** into a numbered list of atomic facts.
2. Break down the **Model Output** into a numbered list of atomic facts.
3. Compare the two lists item-by-item to determine TP, TN, FP, and FN.
4. Output the final counts in JSON format.

**Constraint:**
- Do not count stylistic differences or word variations as False Positives if the meaning is the same.
- Focus strictly on the information content.`;
}

/**
 * Build user input for atomic fact evaluation.
 * @param referenceAnswer - The ground truth/expected output
 * @param modelOutput - The generated output to evaluate
 * @returns User input for atomic fact evaluation
 */
export function buildAtomicFactEvaluationUserInput(
  referenceAnswer: string,
  modelOutput: string
): string {
  return `**Reference Answer:**
${referenceAnswer}

**Model Output:**
${modelOutput}

Please provide your reasoning followed by a JSON block exactly like this:

\`\`\`json
{
  "TP_count": <integer>,
  "TN_count": <integer>,
  "FP_count": <integer>,
  "FN_count": <integer>,
  "Reasoning": "1-3 sentences of the reasoning."
}
\`\`\`

Important:
- Format the response strictly as JSON
- Avoid any additional commentary outside the JSON response
- Do not use markdown formatting in your response`;
}

/**
 * Evaluate outputs using atomic fact comparison via LLM.
 * @param referenceAnswer - The ground truth/expected output
 * @param modelOutput - The generated output to evaluate
 * @param promptEngineerModelId - Model ID for the prompt engineer
 * @returns Promise with atomic fact evaluation result
 */
export async function evaluateByAtomicFacts(
  referenceAnswer: string,
  modelOutput: string,
  promptEngineerModelId: string
): Promise<AtomicFactEvaluationResult> {
  const systemPrompt = buildAtomicFactEvaluationSystemPrompt();
  const userInput = buildAtomicFactEvaluationUserInput(referenceAnswer, modelOutput);

  try {
    const response = await callModel(promptEngineerModelId, userInput, {
      systemPrompt,
      temperature: 0.3,
    });

    // Check for null/empty/undefined response
    if (!response || typeof response !== 'string') {
      throw new Error('LLM returned empty or invalid response');
    }

    // Parse JSON response
    const jsonContent = extractJsonFromResponse(response);
    const parsed = JSON.parse(jsonContent) as AtomicFactEvaluationResult;

    // Validate required fields
    if (
      typeof parsed.TP_count !== 'number' ||
      typeof parsed.TN_count !== 'number' ||
      typeof parsed.FP_count !== 'number' ||
      typeof parsed.FN_count !== 'number'
    ) {
      throw new Error('Invalid atomic fact evaluation response: missing or invalid count fields');
    }

    return parsed;
  } catch (error) {
    logger.error('Atomic fact evaluation failed', error as Error, {
      referenceAnswer: referenceAnswer.slice(0, 100),
      modelOutput: modelOutput.slice(0, 100),
    });

    // Return fallback values on error
    return {
      TP_count: 0,
      TN_count: 0,
      FP_count: 1,
      FN_count: 1,
      Reasoning: 'Evaluation failed',
    };
  }
}

// ============================================================================
// JUDGE PROMPT REFINEMENT (iterations 2+, judge only)
// ============================================================================

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

    // Check for null/empty/undefined response
    if (!response || typeof response !== 'string') {
      return {
        improved_prompt: null,
        error: 'LLM returned empty or invalid response',
      };
    }

    // Parse JSON response
    let parsedResponse: {
      improved_prompt?: string | null;
      rationale?: string;
      expected_impact?: string;
    };
    try {
      const jsonContent = extractJsonFromResponse(response);
      parsedResponse = JSON.parse(jsonContent);
    } catch (parseError) {
      return {
        improved_prompt: null,
        error: `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    // Extract fields from response
    return {
      improved_prompt: parsedResponse?.improved_prompt || null,
      rationale: parsedResponse?.rationale,
      expected_impact: parsedResponse?.expected_impact,
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
    judge_prompt,
    task_prompt,
  } = context;

  return `You are an expert prompt engineer tasked with refining a judge prompt for an LLM evaluation system.

## Task Prompt (for context)
"${task_prompt}"

## Current Judge Prompt (Iteration ${iteration_number})
"${judge_prompt}"

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
- Both refined prompts should be complete, standalone prompts (not diffs)
- Focus on the most impactful changes based on disagreement patterns
- Ensure prompts are clear and unambiguous for their respective models
- The goal is to reduce the disagreement rate and improve F1 score
- Format the response strictly as JSON
- Avoid any additional commentary outside the JSON response
- Do not use markdown formatting in your response
`;
}

// ============================================================================
// BOTH PROMPTS REFINEMENT (iteration 1, human feedback)
// ============================================================================

/**
 * Refine both Task and Judge prompts based on human feedback from iteration 1.
 * Uses LLM to analyze human disagreements and generate improved versions of both prompts.
 *
 * @param context - Human feedback context with disagreements and metrics
 * @param promptEngineerModelId - Model ID for prompt engineer
 * @returns Promise with refined task prompt, refined judge prompt, and rationales
 */
export async function refineBothPromptsFromHumanFeedback(
  context: HumanFeedbackContext,
  promptEngineerModelId: string
): Promise<BothPromptsRefinementResult> {
  try {
    const systemPrompt = buildHumanFeedbackPromptContext(context);

    // Call Prompt Engineer Model
    const response = await callModel(promptEngineerModelId, systemPrompt);

    // Check for null/empty/undefined response
    if (!response || typeof response !== 'string') {
      return {
        refined_task_prompt: null,
        refined_judge_prompt: null,
        error: 'LLM returned empty or invalid response',
      };
    }

    // Parse JSON response
    let parsedResponse: {
      refined_task_prompt?: string | null;
      refined_judge_prompt?: string | null;
      task_rationale?: string;
      judge_rationale?: string;
      expected_impact?: string;
    };

    try {
      const jsonContent = extractJsonFromResponse(response);
      parsedResponse = JSON.parse(jsonContent);
    } catch (parseError) {
      logger.error('refineBothPromptsFromHumanFeedback - JSON parse error', parseError as Error, {
        iteration_number: context.iteration_number,
        promptEngineerModelId,
        response,
        parseError,
      });

      return {
        refined_task_prompt: null,
        refined_judge_prompt: null,
        error: `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    // Add logger here if needed to log response for debugging
    logger.info('refineBothPromptsFromHumanFeedback', {
      iteration: context.iteration_number,
      promptEngineerModelId,
      response: {
        refined_task_prompt: parsedResponse?.refined_task_prompt || null,
        refined_judge_prompt: parsedResponse?.refined_judge_prompt || null,
        task_rationale: parsedResponse?.task_rationale,
        judge_rationale: parsedResponse?.judge_rationale,
        expected_impact: parsedResponse?.expected_impact,
      },
    });

    // Extract fields from response
    return {
      refined_task_prompt: parsedResponse?.refined_task_prompt || null,
      refined_judge_prompt: parsedResponse?.refined_judge_prompt || null,
      task_rationale: parsedResponse?.task_rationale,
      judge_rationale: parsedResponse?.judge_rationale,
      expected_impact: parsedResponse?.expected_impact,
    };
  } catch (error) {
    return {
      refined_task_prompt: null,
      refined_judge_prompt: null,
      error: error instanceof Error ? error.message : 'Unknown error during prompt refinement',
    };
  }
}

/**
 * Build detailed context prompt for LLM prompt engineer based on human feedback.
 * Includes metrics, human disagreements, and current prompts.
 * @param context - Human feedback context
 * @returns String containing the full system prompt for the prompt engineer model
 */
function buildHumanFeedbackPromptContext(context: HumanFeedbackContext): string {
  const {
    current_task_prompt,
    current_judge_prompt,
    human_disagreements,
    metrics,
    iteration_number,
    total_decisions,
    disagreements_count,
  } = context;

  return `You are an expert prompt engineer tasked with refining both the task prompt and judge prompt for an LLM evaluation system based on human feedback.

## Context
This is iteration ${iteration_number} of the training process. Humans have reviewed the judge's decisions and provided feedback where they disagreed.

## Current Task Prompt (Iteration ${iteration_number})
"${current_task_prompt}"

## Current Judge Prompt (Iteration ${iteration_number})
"${current_judge_prompt}"

## Metrics from Human Review
- Precision: ${metrics.precision.toFixed(2)}
- Recall: ${metrics.recall.toFixed(2)}
- F1 Score: ${metrics.f1_score.toFixed(2)}
- Cohen's Kappa: ${metrics.cohens_kappa.toFixed(2)}
- Accuracy: ${metrics.accuracy.toFixed(2)}

Confusion Matrix (Human vs Judge):
- True Positives (TP): ${metrics.confusion_matrix.true_positives} - Human agreed with correct decision
- True Negatives (TN): ${metrics.confusion_matrix.true_negatives} - Human agreed with incorrect decision
- False Positives (FP): ${metrics.confusion_matrix.false_positives} - Human disagreed with correct decision (judge was wrong)
- False Negatives (FN): ${metrics.confusion_matrix.false_negatives} - Human disagreed with incorrect decision (judge was wrong)

Total decisions: ${total_decisions}
Disagreements: ${disagreements_count} (${((disagreements_count / total_decisions) * 100).toFixed(1)}%)

## Human Disagreements (Cases where human disagreed with judge - ${human_disagreements.length} examples)
${
  human_disagreements.length > 0
    ? human_disagreements
        .map(
          (d, idx) => `
${idx + 1}. Judge Decision: "${d.judge_decision}" | Human Decision: "${d.human_decision}"
   Input: "${d.input}"
   Generated Output: "${d.generated_output}"
   Expected Output: "${d.expected_output}"
   Judge Reasoning: "${d.judge_reasoning}"
   Human Feedback: "${d.human_feedback}"
`
        )
        .join('\n')
    : 'No disagreements in this iteration.'
}

## Your Task

Using chain-of-thought reasoning, analyze the human disagreements and refine BOTH prompts to improve alignment with human judgment.

### Step 1: Identify Patterns
- What patterns do you see in the human disagreements?
- Are there specific types of cases where the judge consistently gets it wrong?
- What aspects of the prompts are causing these misalignments?

### Step 2: Design Improvements for Task Prompt
- How should the task prompt be modified to generate better outputs?
- What additional guidance or constraints should be added?
- What should the task model focus on or avoid?

### Step 3: Design Improvements for Judge Prompt
- How should the judge prompt be modified to better align with human judgment?
- What evaluation criteria should be clarified?
- What should the judge focus on when making decisions?

### Step 4: Generate Refined Prompts
Create improved prompts that:
1. Address the identified disagreement patterns
2. Provide clearer guidance for both models
3. Align better with human judgment patterns
4. Are concise but comprehensive

## Response Format

Respond with a JSON object containing:
{
  "refined_task_prompt": "Your refined task prompt here",
  "task_rationale": "Explain what you changed in the task prompt and why (2-3 sentences)",
  "refined_judge_prompt": "Your refined judge prompt here",
  "judge_rationale": "Explain what you changed in the judge prompt and why (2-3 sentences)",
  "expected_impact": "Predict how these changes will improve alignment with human judgment (1-2 sentences)"
}

Important:
- Both refined prompts should be complete, standalone prompts (not diffs)
- Focus on the most impactful changes based on disagreement patterns
- Ensure prompts are clear and unambiguous for their respective models
- The goal is to reduce the disagreement rate and improve F1 score
- Format the response strictly as JSON
- Avoid any additional commentary outside the JSON response
- Do not use markdown formatting in your response
`;
}

// ============================================================================
// BOTH PROMPTS REFINEMENT (iterations 2+, failure analysis)
// ============================================================================

/**
 * Refine both Task and Judge prompts based on FP/FN failure analysis (iterations 2+).
 * Uses LLM to analyze failure patterns and generate improved versions of both prompts.
 *
 * @param failureContext - Failure analysis context with metrics and FP/FN examples
 * @param promptEngineerModelId - Model ID for prompt engineer
 * @returns Promise with refined task prompt, refined judge prompt, and rationales
 */
export async function refineBothPromptsFromFailureAnalysis(
  failureContext: FailureAnalysisContext,
  promptEngineerModelId: string
): Promise<BothPromptsRefinementResult> {
  try {
    const systemPrompt = buildFailureAnalysisPromptContextForBothPrompts(failureContext);

    // Call Prompt Engineer Model
    const response = await callModel(promptEngineerModelId, systemPrompt);

    // Check for null/empty/undefined response
    if (!response || typeof response !== 'string') {
      return {
        refined_task_prompt: null,
        refined_judge_prompt: null,
        error: 'LLM returned empty or invalid response',
      };
    }

    // Parse JSON response
    let parsedResponse: {
      refined_task_prompt?: string | null;
      refined_judge_prompt?: string | null;
      task_rationale?: string;
      judge_rationale?: string;
      expected_impact?: string;
    };

    try {
      const jsonContent = extractJsonFromResponse(response);
      parsedResponse = JSON.parse(jsonContent);
    } catch (parseError) {
      logger.error('refineBothPromptsFromFailureAnalysis - JSON parse error', parseError as Error, {
        iteration_number: failureContext.iteration_number,
        promptEngineerModelId,
        response,
        parseError,
      });

      return {
        refined_task_prompt: null,
        refined_judge_prompt: null,
        error: `Failed to parse LLM response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    logger.info('refineBothPromptsFromFailureAnalysis', {
      iteration: failureContext.iteration_number,
      promptEngineerModelId,
      response: {
        refined_task_prompt: parsedResponse?.refined_task_prompt || null,
        refined_judge_prompt: parsedResponse?.refined_judge_prompt || null,
        task_rationale: parsedResponse?.task_rationale,
        judge_rationale: parsedResponse?.judge_rationale,
        expected_impact: parsedResponse?.expected_impact,
      },
    });

    // Extract fields from response
    return {
      refined_task_prompt: parsedResponse?.refined_task_prompt || null,
      refined_judge_prompt: parsedResponse?.refined_judge_prompt || null,
      task_rationale: parsedResponse?.task_rationale,
      judge_rationale: parsedResponse?.judge_rationale,
      expected_impact: parsedResponse?.expected_impact,
    };
  } catch (error) {
    return {
      refined_task_prompt: null,
      refined_judge_prompt: null,
      error: error instanceof Error ? error.message : 'Unknown error during prompt refinement',
    };
  }
}

/**
 * Build detailed context prompt for LLM prompt engineer based on FP/FN failure analysis.
 * Includes metrics, failure examples, and current prompts.
 * @param context - Failure analysis context
 * @returns String containing the full system prompt for the prompt engineer model
 */
function buildFailureAnalysisPromptContextForBothPrompts(context: FailureAnalysisContext): string {
  const {
    current_metrics,
    iteration_number,
    false_positives,
    false_negatives,
    correct_examples,
    judge_prompt,
    task_prompt,
  } = context;

  return `You are an expert prompt engineer tasked with refining both the task prompt and judge prompt for an LLM evaluation system based on failure analysis.

## Current Task Prompt (Iteration ${iteration_number})
"${task_prompt}"

## Current Judge Prompt (Iteration ${iteration_number})
"${judge_prompt}"

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

Using chain-of-thought reasoning, analyze the failure patterns and refine BOTH prompts to improve performance.

### Step 1: Identify Patterns
- What common patterns do you see in false positives?
- What common patterns do you see in false negatives?
- What aspects of the current prompts are causing these failures?

### Step 2: Design Improvements for Task Prompt
- How should the task prompt be modified to generate better outputs that match expected outputs?
- What additional guidance or constraints should be added?
- What should the task model focus on or avoid?

### Step 3: Design Improvements for Judge Prompt
- How should the judge prompt be modified to reduce FP/FN cases?
- What evaluation criteria should be clarified?
- What should the judge focus on when making decisions?

### Step 4: Generate Refined Prompts
Create improved prompts that:
1. Address the identified failure patterns
2. Maintain the strengths shown in correct classifications
3. Provide clear, actionable criteria
4. Are concise but comprehensive

## Response Format

Respond with a JSON object containing:
{
  "refined_task_prompt": "Your refined task prompt here (should improve output quality)",
  "task_rationale": "Explain what you changed in the task prompt and why (2-3 sentences)",
  "refined_judge_prompt": "Your refined judge prompt here (should improve evaluation accuracy)",
  "judge_rationale": "Explain what you changed in the judge prompt and why (2-3 sentences)",
  "expected_impact": "Predict how this will affect metrics (1-2 sentences)"
}

Important:
- Both refined prompts should be complete, standalone prompts (not diffs)
- Focus on the most impactful changes based on failure patterns
- Ensure prompts are clear and unambiguous for their respective models
- The task prompt should guide the model to generate outputs that match expected outputs
- The judge prompt should guide the model to correctly evaluate outputs against expected outputs
- Format the response strictly as JSON
- Avoid any additional commentary outside the JSON response
- Do not use markdown formatting in your response
`;
}
