/**
 * Metrics Calculator (Simplified)
 * Calculates simple pass/fail percentages for training workspace
 */

import type { Database } from 'better-sqlite3';

/**
 * Simple metrics result - just pass/fail percentages
 */
export interface SimpleMetrics {
  total_results: number;
  pass_count: number;
  fail_count: number;
  pass_percentage: number;
  fail_percentage: number;
}

/**
 * Calculate simple pass/fail metrics for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Simple metrics with pass/fail counts and percentages
 */
export function calculateSimpleMetrics(personaId: string, db: Database): SimpleMetrics {
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

  const total = result.total_results || 0;
  const passCount = result.pass_count || 0;
  const failCount = result.fail_count || 0;

  return {
    total_results: total,
    pass_count: passCount,
    fail_count: failCount,
    pass_percentage: total > 0 ? (passCount / total) * 100 : 0,
    fail_percentage: total > 0 ? (failCount / total) * 100 : 0,
  };
}

/**
 * Calculate simple pass/fail metrics for an evaluation run
 * @param runId - Evaluation run ID
 * @param db - Database connection
 * @returns Simple metrics with pass/fail counts and percentages
 */
export function calculateRunMetrics(runId: string, db: Database): SimpleMetrics {
  const result = db
    .prepare(
      `SELECT
        COUNT(*) as total_results,
        SUM(CASE WHEN judge_rating = 'pass' THEN 1 ELSE 0 END) as pass_count,
        SUM(CASE WHEN judge_rating = 'fail' THEN 1 ELSE 0 END) as fail_count
       FROM training_pair_results
       WHERE evaluation_run_id = ? AND judge_rating IS NOT NULL`
    )
    .get(runId) as { total_results: number; pass_count: number; fail_count: number };

  const total = result.total_results || 0;
  const passCount = result.pass_count || 0;
  const failCount = result.fail_count || 0;

  return {
    total_results: total,
    pass_count: passCount,
    fail_count: failCount,
    pass_percentage: total > 0 ? (passCount / total) * 100 : 0,
    fail_percentage: total > 0 ? (failCount / total) * 100 : 0,
  };
}

/**
 * Get metrics summary across all evaluation runs for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Array of metrics per run
 */
export function getMetricsHistory(
  personaId: string,
  db: Database
): Array<{
  run_id: string;
  run_type: string;
  created_at: string;
  metrics: SimpleMetrics;
}> {
  const runs = db
    .prepare(
      `SELECT id, run_type, created_at
       FROM evaluation_runs
       WHERE persona_id = ?
       ORDER BY created_at ASC`
    )
    .all(personaId) as Array<{ id: string; run_type: string; created_at: string }>;

  return runs.map((run) => ({
    run_id: run.id,
    run_type: run.run_type,
    created_at: run.created_at,
    metrics: calculateRunMetrics(run.id, db),
  }));
}

/**
 * Get latest metrics for a persona
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Latest simple metrics or null if no results
 */
export function getLatestMetrics(personaId: string, db: Database): SimpleMetrics | null {
  const latestRunId = db
    .prepare(
      `SELECT id
       FROM evaluation_runs
       WHERE persona_id = ? AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(personaId) as { id: string } | undefined;

  if (!latestRunId) {
    // Fall back to overall metrics
    return calculateSimpleMetrics(personaId, db);
  }

  return calculateRunMetrics(latestRunId.id, db);
}
