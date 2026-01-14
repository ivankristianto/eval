/**
 * Version Comparison Service
 *
 * Provides functionality to fetch and compare generated outputs for the same
 * training pair across different evaluation runs/versions.
 *
 * This service enables side-by-side comparison of model outputs across different
 * iterations, helping users track how judge performance evolves with prompt refinements.
 */

import type { Database } from 'better-sqlite3';
import type { TrainingPair, EvaluationRun, JudgeRating, HumanRating } from '@src-types/training';

/**
 * Input parameters for comparing versions
 */
export interface CompareVersionsInput {
  /**
   * ID of the persona
   */
  persona_id: string;
  /**
   * ID of the training pair to compare
   */
  training_pair_id: string;
  /**
   * First evaluation run ID or iteration number to compare
   */
  version1: string | number;
  /**
   * Second evaluation run ID or iteration number to compare
   */
  version2: string | number;
  /**
   * Type of version identifier: 'run_id' or 'iteration_number'
   * @default 'run_id'
   */
  version_type?: 'run_id' | 'iteration_number';
}

/**
 * Output from a single evaluation run for a training pair
 */
export interface VersionOutput {
  /**
   * Result ID from training_pair_results table
   */
  result_id: string;
  /**
   * Evaluation run ID
   */
  evaluation_run_id: string | null;
  /**
   * Generated output text
   */
  generated_output: string | null;
  /**
   * Judge rating (pass/fail)
   */
  judge_rating: JudgeRating | null;
  /**
   * Judge feedback text
   */
  judge_feedback: string | null;
  /**
   * Judge reasoning text
   */
  judge_reasoning: string | null;
  /**
   * Human rating (pass/fail)
   */
  human_rating: HumanRating | null;
  /**
   * Human feedback text
   */
  human_feedback: string | null;
  /**
   * Execution time in milliseconds
   */
  execution_time_ms: number | null;
  /**
   * Token usage
   */
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  /**
   * Timestamp when result was created
   */
  created_at: string;
}

/**
 * Comparison result containing outputs from both versions
 */
export interface VersionComparisonResult {
  /**
   * The training pair being compared
   */
  training_pair: TrainingPair;
  /**
   * Output from first version
   */
  version1: {
    /**
     * Version identifier (run ID or iteration number)
     */
    identifier: string;
    /**
     * Evaluation run details (if available)
     */
    evaluation_run: EvaluationRun | null;
    /**
     * Output data
     */
    output: VersionOutput | null;
  };
  /**
   * Output from second version
   */
  version2: {
    /**
     * Version identifier (run ID or iteration number)
     */
    identifier: string;
    /**
     * Evaluation run details (if available)
     */
    evaluation_run: EvaluationRun | null;
    /**
     * Output data
     */
    output: VersionOutput | null;
  };
}

/**
 * Resolve version identifier to evaluation run ID
 * @private
 */
function resolveRunId(
  db: Database,
  persona_id: string,
  version: string | number,
  version_type: 'run_id' | 'iteration_number'
): string | null {
  if (version_type === 'run_id') {
    // Validate that the run exists and belongs to the persona
    const run = db
      .prepare('SELECT id FROM evaluation_runs WHERE id = ? AND persona_id = ?')
      .get(version as string, persona_id) as { id: string } | undefined;
    return run?.id ?? null;
  }

  // version_type === 'iteration_number'
  // Find the evaluation run for this iteration number
  // Note: We need to match against training_iterations table
  const iteration = db
    .prepare(
      `SELECT ti.id as iteration_id, er.id as run_id
       FROM training_iterations ti
       LEFT JOIN evaluation_runs er ON er.persona_id = ti.persona_id AND er.model_id = ti.judge_model_id
       WHERE ti.persona_id = ? AND ti.iteration_number = ?`
    )
    .get(persona_id, version as number) as
    | { iteration_id: string; run_id: string | null }
    | undefined;

  return iteration?.run_id ?? iteration?.iteration_id ?? null;
}

/**
 * Fetch training pair result for a specific evaluation run
 * @private
 */
function fetchResultForRun(
  db: Database,
  persona_id: string,
  training_pair_id: string,
  run_id: string | null
): VersionOutput | null {
  if (!run_id) {
    return null;
  }

  const result = db
    .prepare(
      `SELECT
        id as result_id,
        evaluation_run_id,
        generated_output,
        judge_rating,
        judge_feedback,
        judge_reasoning,
        human_rating,
        human_feedback,
        execution_time_ms,
        input_tokens,
        output_tokens,
        total_tokens,
        created_at
       FROM training_pair_results
       WHERE persona_id = ? AND training_pair_id = ? AND evaluation_run_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(persona_id, training_pair_id, run_id) as VersionOutput | undefined;

  return result ?? null;
}

/**
 * Fetch evaluation run details
 * @private
 */
function fetchEvaluationRun(db: Database, run_id: string | null): EvaluationRun | null {
  if (!run_id) {
    return null;
  }

  const run = db.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(run_id) as
    | EvaluationRun
    | undefined;

  return run ?? null;
}

/**
 * Compare generated outputs for the same training pair across two different evaluation runs.
 *
 * This function fetches the outputs from both versions and returns them in a structured format
 * for side-by-side comparison. It supports comparison by evaluation run ID or by iteration number.
 *
 * @param input - Comparison parameters including persona_id, training_pair_id, and two version identifiers
 * @param db - Database connection
 * @returns Comparison result containing outputs from both versions
 * @throws Error if training pair not found
 *
 * @example
 * ```typescript
 * // Compare by run IDs
 * const result = compareVersions({
 *   persona_id: 'persona-123',
 *   training_pair_id: 'pair-456',
 *   version1: 'run-abc',
 *   version2: 'run-def',
 * }, db);
 * ```
 *
 * @example
 * ```typescript
 * // Compare by iteration numbers
 * const result = compareVersions({
 *   persona_id: 'persona-123',
 *   training_pair_id: 'pair-456',
 *   version1: 1,
 *   version2: 2,
 *   version_type: 'iteration_number',
 * }, db);
 * ```
 */
export function compareVersions(
  input: CompareVersionsInput,
  db: Database
): VersionComparisonResult {
  const { persona_id, training_pair_id, version1, version2, version_type = 'run_id' } = input;

  // Fetch training pair
  const trainingPair = db
    .prepare('SELECT * FROM training_pairs WHERE id = ? AND persona_id = ?')
    .get(training_pair_id, persona_id) as TrainingPair | undefined;

  if (!trainingPair) {
    throw new Error(`Training pair not found: ${training_pair_id} for persona ${persona_id}`);
  }

  // Resolve version identifiers to run IDs
  const runId1 = resolveRunId(db, persona_id, version1, version_type);
  const runId2 = resolveRunId(db, persona_id, version2, version_type);

  // Fetch outputs for both versions
  const output1 = fetchResultForRun(db, persona_id, training_pair_id, runId1);
  const output2 = fetchResultForRun(db, persona_id, training_pair_id, runId2);

  // Fetch evaluation run details
  const evalRun1 = fetchEvaluationRun(db, runId1);
  const evalRun2 = fetchEvaluationRun(db, runId2);

  return {
    training_pair: trainingPair,
    version1: {
      identifier: typeof version1 === 'string' ? version1 : `iteration-${version1}`,
      evaluation_run: evalRun1,
      output: output1,
    },
    version2: {
      identifier: typeof version2 === 'string' ? version2 : `iteration-${version2}`,
      evaluation_run: evalRun2,
      output: output2,
    },
  };
}

/**
 * Get all available evaluation runs for a persona that have results for a specific training pair.
 *
 * This is useful for UI components to populate version selectors for comparison.
 *
 * @param persona_id - Persona ID
 * @param training_pair_id - Training pair ID
 * @param db - Database connection
 * @returns Array of evaluation runs with results for this training pair
 */
export function getAvailableVersions(
  persona_id: string,
  training_pair_id: string,
  db: Database
): Array<{ run: EvaluationRun; has_result: boolean }> {
  const runs = db
    .prepare(
      `SELECT
        er.*,
        CASE WHEN tpr.id IS NOT NULL THEN 1 ELSE 0 END as has_result
       FROM evaluation_runs er
       LEFT JOIN training_pair_results tpr
         ON tpr.evaluation_run_id = er.id
         AND tpr.training_pair_id = ?
       WHERE er.persona_id = ?
         AND er.status IN ('completed', 'running')
       ORDER BY er.created_at DESC`
    )
    .all(training_pair_id, persona_id) as Array<EvaluationRun & { has_result: 0 | 1 }>;

  return runs.map((run) => ({
    run: {
      id: run.id,
      persona_id: run.persona_id,
      run_type: run.run_type,
      status: run.status,
      total_pairs: run.total_pairs,
      processed_pairs: run.processed_pairs,
      started_at: run.started_at,
      completed_at: run.completed_at,
      error_message: run.error_message,
      created_at: run.created_at,
      updated_at: run.updated_at,
      model_id: run.model_id,
      prompt_version_id: run.prompt_version_id,
    },
    has_result: run.has_result === 1,
  }));
}

/**
 * Get multiple training pair comparisons at once for batch comparison.
 *
 * This is useful for comparing multiple pairs across two versions.
 *
 * @param input - Comparison parameters with multiple training pair IDs
 * @param db - Database connection
 * @returns Array of comparison results
 *
 * @example
 * ```typescript
 * const comparisons = compareMultiplePairs({
 *   persona_id: 'persona-123',
 *   training_pair_ids: ['pair-1', 'pair-2', 'pair-3'],
 *   version1: 'run-abc',
 *   version2: 'run-def',
 * }, db);
 * ```
 */
export function compareMultiplePairs(
  input: Omit<CompareVersionsInput, 'training_pair_id'> & {
    training_pair_ids: string[];
  },
  db: Database
): VersionComparisonResult[] {
  const { training_pair_ids, ...baseInput } = input;

  return training_pair_ids.map((training_pair_id) =>
    compareVersions({ ...baseInput, training_pair_id }, db)
  );
}
