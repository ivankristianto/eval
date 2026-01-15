/**
 * Judge Runner
 * Evaluates training pair results using the judge model, assigns Pass/Fail ratings
 */

import type { Database } from 'better-sqlite3';
import type { TrainingPairResult } from '@src-types/training';
import { callModel } from '@lib/utils/api-clients';
import { createLogger } from '@lib/logger';

const logger = createLogger('JudgeRunner');

/**
 * Configuration for judge evaluation
 */
export interface JudgeRunnerConfig {
  persona_id: string;
  judge_prompt_version_id: string;
  training_pair_result_ids?: string[]; // If not provided, uses all results for persona that need judge evaluation
}

/**
 * Result of judge evaluation
 */
export interface JudgeEvaluationResult {
  evaluation_run_id: string;
  total_results: number;
  evaluated_results: number;
  results: TrainingPairResult[];
}

/**
 * Judge evaluation response from LLM
 */
interface JudgeResponse {
  rating: 'pass' | 'fail';
  reasoning: string;
  feedback?: string;
}

/**
 * Evaluate training pair results using the judge model
 * Creates an evaluation_run and updates training_pair_results with judge ratings
 *
 * @param config - Judge evaluation configuration
 * @param db - Database connection
 * @returns Judge evaluation result with evaluation_run_id
 * @throws Error if persona not found, no results to evaluate, or model call fails
 */
export async function evaluateWithJudge(
  config: JudgeRunnerConfig,
  db: Database
): Promise<JudgeEvaluationResult> {
  const { persona_id, judge_prompt_version_id, training_pair_result_ids } = config;

  logger.info('Starting judge evaluation', { persona_id, judge_prompt_version_id });

  // Get persona with model configurations
  const persona = db
    .prepare(
      `SELECT p.*, jpv.prompt_text as judge_prompt, jpv.version_number as judge_version_number
       FROM personas p
       LEFT JOIN judge_prompt_versions jpv ON jpv.id = ?
       WHERE p.id = ?`
    )
    .get(judge_prompt_version_id, persona_id) as
    | {
        id: string;
        name: string;
        judge_model_id: string;
        judge_prompt: string;
        judge_version_number: number;
      }
    | undefined;

  if (!persona) {
    throw new Error(`Persona not found: ${persona_id}`);
  }

  if (!persona.judge_prompt) {
    throw new Error(`Judge prompt version not found: ${judge_prompt_version_id}`);
  }

  // Get training pair results to evaluate
  let resultsToEvaluate: Array<{
    id: string;
    training_pair_id: string;
    generated_output: string;
  }>;

  if (training_pair_result_ids && training_pair_result_ids.length > 0) {
    // Use specified results
    const placeholders = training_pair_result_ids.map(() => '?').join(',');
    resultsToEvaluate = db
      .prepare(
        `SELECT id, training_pair_id, generated_output
         FROM training_pair_results
         WHERE id IN (${placeholders}) AND generated_output IS NOT NULL`
      )
      .all(...training_pair_result_ids) as Array<{
      id: string;
      training_pair_id: string;
      generated_output: string;
    }>;
  } else {
    // Use all results for persona that have generated output but no judge rating
    resultsToEvaluate = db
      .prepare(
        `SELECT id, training_pair_id, generated_output
         FROM training_pair_results
         WHERE persona_id = ? AND generated_output IS NOT NULL AND judge_rating IS NULL`
      )
      .all(persona_id) as Array<{
      id: string;
      training_pair_id: string;
      generated_output: string;
    }>;
  }

  if (resultsToEvaluate.length === 0) {
    throw new Error(
      `No outputs to evaluate for persona "${persona_id}". Please generate outputs first by starting the training process.`
    );
  }

  // Create evaluation run
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO evaluation_runs
     (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
     VALUES (?, ?, 'judge_evaluate', 'running', ?, 0, ?, ?, ?, ?, ?)`
  ).run(
    runId,
    persona_id,
    resultsToEvaluate.length,
    now,
    now,
    now,
    persona.judge_model_id,
    judge_prompt_version_id
  );

  logger.info('Evaluation run created', { runId, totalResults: resultsToEvaluate.length });

  // Evaluate each result
  const results: TrainingPairResult[] = [];
  let evaluatedCount = 0;
  let errorCount = 0;

  for (const result of resultsToEvaluate) {
    try {
      // Get the training pair to access input and expected_output
      const trainingPair = db
        .prepare('SELECT input, expected_output FROM training_pairs WHERE id = ?')
        .get(result.training_pair_id) as { input: string; expected_output: string } | undefined;

      if (!trainingPair) {
        logger.warn('Training pair not found for result', { resultId: result.id });
        continue;
      }

      logger.debug('Evaluating training pair result', {
        runId,
        resultId: result.id,
        pairId: result.training_pair_id,
      });

      // Build judge instruction
      const judgeInstruction = buildJudgeInstruction(
        trainingPair.input,
        result.generated_output,
        trainingPair.expected_output
      );

      // Call judge model with judge prompt as system prompt
      const judgeResponseRaw = await callModel(persona.judge_model_id, judgeInstruction, {
        systemPrompt: persona.judge_prompt,
      });

      // Parse judge response
      const judgeResponse = parseJudgeResponse(judgeResponseRaw);

      // Update result with judge evaluation
      const resultNow = new Date().toISOString();

      db.prepare(
        `UPDATE training_pair_results
         SET judge_rating = ?, judge_reasoning = ?, judge_feedback = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        judgeResponse.rating,
        judgeResponse.reasoning,
        judgeResponse.feedback ?? null,
        resultNow,
        result.id
      );

      // Get updated result
      const updatedResult = db
        .prepare('SELECT * FROM training_pair_results WHERE id = ?')
        .get(result.id) as TrainingPairResult;

      results.push(updatedResult);
      evaluatedCount++;

      // Update run progress
      db.prepare('UPDATE evaluation_runs SET processed_pairs = ?, updated_at = ? WHERE id = ?').run(
        evaluatedCount,
        new Date().toISOString(),
        runId
      );

      logger.debug('Training pair result evaluated', {
        runId,
        resultId: result.id,
        rating: judgeResponse.rating,
      });
    } catch (error) {
      errorCount++;
      logger.error('Failed to evaluate training pair result', error as Error, {
        runId,
        resultId: result.id,
      });

      // Continue processing other results even if one fails
      continue;
    }
  }

  // Update run status
  const finalStatus = evaluatedCount === resultsToEvaluate.length ? 'completed' : 'partial';
  const completedAt = finalStatus === 'completed' ? new Date().toISOString() : null;

  db.prepare(
    `UPDATE evaluation_runs
     SET status = ?, processed_pairs = ?, completed_at = ?, updated_at = ?, error_message = ?
     WHERE id = ?`
  ).run(
    finalStatus,
    evaluatedCount,
    completedAt,
    new Date().toISOString(),
    errorCount > 0 ? `${errorCount} results failed to evaluate` : null,
    runId
  );

  logger.info('Judge evaluation completed', {
    runId,
    totalResults: resultsToEvaluate.length,
    evaluatedCount,
    errorCount,
    status: finalStatus,
  });

  return {
    evaluation_run_id: runId,
    total_results: resultsToEvaluate.length,
    evaluated_results: evaluatedCount,
    results,
  };
}

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
function parseJudgeResponse(response: string): JudgeResponse {
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

/**
 * Get training pair results that need judge evaluation
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Array of training pair results that need evaluation
 */
export function getResultsNeedingJudgeEvaluation(
  personaId: string,
  db: Database
): TrainingPairResult[] {
  const results = db
    .prepare(
      `SELECT * FROM training_pair_results
       WHERE persona_id = ? AND generated_output IS NOT NULL AND judge_rating IS NULL
       ORDER BY created_at ASC`
    )
    .all(personaId) as TrainingPairResult[];

  return results;
}
