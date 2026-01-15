/**
 * Task Generator
 * Generates outputs for training pairs using the task model
 */

import type { Database } from 'better-sqlite3';
import type { EvaluationRun, TrainingPairResult } from '@src-types/training';
import { callModel } from '@lib/utils/api-clients';
import { createLogger } from '@lib/logger';

const logger = createLogger('TaskGenerator');

/**
 * Clear feedback fields from training_pair_results for specific training pairs.
 * This is used when regenerating outputs with a new task prompt version to allow fresh evaluation.
 *
 * Clears: human_feedback, human_rating, judge_feedback, judge_reasoning, judge_rating
 *
 * @param personaId - Persona ID
 * @param trainingPairIds - Array of training pair IDs to clear feedback for
 * @param db - Database connection
 * @returns Number of results that had their feedback cleared
 */
export function clearFeedbackForTrainingPairs(
  personaId: string,
  trainingPairIds: string[],
  db: Database
): number {
  if (trainingPairIds.length === 0) {
    return 0;
  }

  const placeholders = trainingPairIds.map(() => '?').join(',');
  const now = new Date().toISOString();

  const stmt = db.prepare(
    `UPDATE training_pair_results
     SET human_feedback = NULL,
         human_rating = NULL,
         judge_feedback = NULL,
         judge_reasoning = NULL,
         judge_rating = NULL,
         updated_at = ?
     WHERE persona_id = ?
       AND training_pair_id IN (${placeholders})`
  );

  const result = stmt.run(now, personaId, ...trainingPairIds);
  return result.changes;
}

/**
 * Configuration for task generation
 */
export interface TaskGeneratorConfig {
  persona_id: string;
  task_prompt_version_id: string;
  training_pair_ids?: string[]; // If not provided, uses all pairs for persona
}

/**
 * Result of task generation
 */
export interface TaskGenerationResult {
  evaluation_run_id: string;
  total_pairs: number;
  processed_pairs: number;
  results: TrainingPairResult[];
}

/**
 * Generate outputs for training pairs using the task model
 * Creates an evaluation_run and stores results in training_pair_results
 *
 * @param config - Generation configuration
 * @param db - Database connection
 * @returns Task generation result with evaluation_run_id
 * @throws Error if persona not found, no training pairs, or model call fails
 */
export async function generateTaskOutputs(
  config: TaskGeneratorConfig,
  db: Database
): Promise<TaskGenerationResult> {
  const { persona_id, task_prompt_version_id, training_pair_ids } = config;

  logger.info('Starting task generation', { persona_id, task_prompt_version_id });

  // Get persona with model configurations
  const persona = db
    .prepare(
      `SELECT p.*, tpv.prompt_text as task_prompt, tpv.version_number as task_version_number
       FROM personas p
       LEFT JOIN task_prompt_versions tpv ON tpv.id = ?
       WHERE p.id = ?`
    )
    .get(task_prompt_version_id, persona_id) as
    | {
        id: string;
        name: string;
        task_model_id: string;
        task_prompt: string;
        task_version_number: number;
      }
    | undefined;

  if (!persona) {
    throw new Error(`Persona not found: ${persona_id}`);
  }

  if (!persona.task_prompt) {
    throw new Error(`Task prompt version not found: ${task_prompt_version_id}`);
  }

  // Get training pairs to process
  let pairsToProcess: Array<{ id: string; input: string; expected_output: string }>;

  if (training_pair_ids && training_pair_ids.length > 0) {
    // Use specified pairs
    const placeholders = training_pair_ids.map(() => '?').join(',');
    pairsToProcess = db
      .prepare(
        `SELECT id, input, expected_output FROM training_pairs WHERE id IN (${placeholders})`
      )
      .all(...training_pair_ids) as Array<{ id: string; input: string; expected_output: string }>;
  } else {
    // Use all pairs for persona
    pairsToProcess = db
      .prepare('SELECT id, input, expected_output FROM training_pairs WHERE persona_id = ?')
      .all(persona_id) as Array<{ id: string; input: string; expected_output: string }>;
  }

  if (pairsToProcess.length === 0) {
    throw new Error(`No training pairs found for persona: ${persona_id}`);
  }

  // Create evaluation run
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO evaluation_runs
     (id, persona_id, run_type, status, total_pairs, processed_pairs, started_at, created_at, updated_at, model_id, prompt_version_id)
     VALUES (?, ?, 'task_generate', 'running', ?, 0, ?, ?, ?, ?, ?)`
  ).run(
    runId,
    persona_id,
    pairsToProcess.length,
    now,
    now,
    now,
    persona.task_model_id,
    task_prompt_version_id
  );

  logger.info('Evaluation run created', { runId, totalPairs: pairsToProcess.length });

  // Clear existing feedback when regenerating with new task prompt version
  // This allows fresh evaluation with the new prompt
  const pairIdsToProcess = pairsToProcess.map((p) => p.id);
  const clearedCount = clearFeedbackForTrainingPairs(persona_id, pairIdsToProcess, db);
  if (clearedCount > 0) {
    logger.info('Cleared existing feedback for training pairs', {
      persona_id,
      count: clearedCount,
      task_prompt_version_id,
    });
  }

  // Generate outputs for each pair
  const results: TrainingPairResult[] = [];
  let processedCount = 0;
  let errorCount = 0;

  for (const pair of pairsToProcess) {
    try {
      logger.debug('Generating output for training pair', {
        runId,
        pairId: pair.id,
        inputLength: pair.input.length,
      });

      // Generate output using task model with task prompt as system prompt
      const generated_output = await callModel(persona.task_model_id, pair.input, {
        systemPrompt: persona.task_prompt,
      });

      // Store result
      const resultId = crypto.randomUUID();
      const resultNow = new Date().toISOString();

      db.prepare(
        `INSERT INTO training_pair_results
         (id, persona_id, evaluation_run_id, training_pair_id, generated_output, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(resultId, persona_id, runId, pair.id, generated_output, resultNow, resultNow);

      results.push({
        id: resultId,
        persona_id,
        evaluation_run_id: runId,
        training_pair_id: pair.id,
        generated_output,
        judge_rating: null,
        judge_feedback: null,
        judge_reasoning: null,
        human_rating: null,
        human_feedback: null,
        execution_time_ms: null,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        created_at: resultNow,
        updated_at: resultNow,
      });

      processedCount++;

      // Update run progress
      db.prepare('UPDATE evaluation_runs SET processed_pairs = ?, updated_at = ? WHERE id = ?').run(
        processedCount,
        new Date().toISOString(),
        runId
      );

      logger.debug('Training pair result created', {
        runId,
        pairId: pair.id,
        resultId,
        outputLength: generated_output.length,
      });
    } catch (error) {
      errorCount++;
      logger.error('Failed to generate output for training pair', error as Error, {
        runId,
        pairId: pair.id,
      });

      // Continue processing other pairs even if one fails
      continue;
    }
  }

  // Update run status
  const finalStatus = processedCount === pairsToProcess.length ? 'completed' : 'partial';
  const completedAt = finalStatus === 'completed' ? new Date().toISOString() : null;

  db.prepare(
    `UPDATE evaluation_runs
     SET status = ?, processed_pairs = ?, completed_at = ?, updated_at = ?, error_message = ?
     WHERE id = ?`
  ).run(
    finalStatus,
    processedCount,
    completedAt,
    new Date().toISOString(),
    errorCount > 0 ? `${errorCount} pairs failed to process` : null,
    runId
  );

  logger.info('Task generation completed', {
    runId,
    totalPairs: pairsToProcess.length,
    processedCount,
    errorCount,
    status: finalStatus,
  });

  return {
    evaluation_run_id: runId,
    total_pairs: pairsToProcess.length,
    processed_pairs: processedCount,
    results,
  };
}

/**
 * Get an evaluation run by ID
 * @param runId - Evaluation run ID
 * @param db - Database connection
 * @returns Evaluation run or null if not found
 */
export function getEvaluationRun(runId: string, db: Database): EvaluationRun | null {
  const run = db.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(runId) as
    | EvaluationRun
    | undefined;

  return run ?? null;
}

/**
 * Get training pair results for an evaluation run
 * @param runId - Evaluation run ID
 * @param db - Database connection
 * @returns Array of training pair results
 */
export function getTrainingPairResults(runId: string, db: Database): TrainingPairResult[] {
  const results = db
    .prepare(
      'SELECT * FROM training_pair_results WHERE evaluation_run_id = ? ORDER BY created_at ASC'
    )
    .all(runId) as TrainingPairResult[];

  return results;
}
