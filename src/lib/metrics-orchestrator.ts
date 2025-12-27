/**
 * Metrics Orchestrator
 * Calculates and stores iteration metrics from judge decisions and human reviews
 */

import type { Database } from 'better-sqlite3';
import { calculateMetrics, buildConfusionMatrix } from './metrics';
import type { MetricsResult } from '../types/training';
import { MetricsCalculationError } from './training-errors';

/**
 * Calculate metrics for a training iteration
 * Requires all judge decisions to have corresponding human reviews
 *
 * @param iterationId - The iteration to calculate metrics for
 * @param db - Database connection
 * @returns Calculated metrics
 * @throws MetricsCalculationError if incomplete human feedback
 */
export function calculateIterationMetrics(iterationId: string, db: Database): MetricsResult {
  // Fetch all judge decisions for this iteration
  const judgeDecisions = db
    .prepare(
      `
      SELECT
        jd.id,
        jd.judge_decision,
        hr.human_decision
      FROM judge_decisions jd
      LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
      WHERE jd.iteration_id = ?
    `
    )
    .all(iterationId) as Array<{
    id: string;
    judge_decision: 'agree' | 'disagree';
    human_decision: 'agree' | 'disagree' | null;
  }>;

  if (judgeDecisions.length === 0) {
    throw new MetricsCalculationError(`No judge decisions found for iteration: ${iterationId}`);
  }

  // Verify all decisions have human reviews
  const decisionsWithoutReview = judgeDecisions.filter((d) => d.human_decision === null);
  if (decisionsWithoutReview.length > 0) {
    throw new MetricsCalculationError(
      `Cannot calculate metrics: ${decisionsWithoutReview.length} decisions have incomplete human feedback. All decisions must be reviewed before calculating metrics.`
    );
  }

  // Extract judge and human agreements for confusion matrix
  const judgeAgreements: boolean[] = [];
  const humanAgreements: boolean[] = [];

  for (const decision of judgeDecisions) {
    judgeAgreements.push(decision.judge_decision === 'agree');
    humanAgreements.push(decision.human_decision === 'agree');
  }

  // Build confusion matrix
  const confusionMatrix = buildConfusionMatrix(judgeAgreements, humanAgreements);

  // Calculate metrics
  const metrics = calculateMetrics(confusionMatrix);

  // Store metrics to database
  storeIterationMetrics(iterationId, metrics, db);

  // Update persona best_f1_score if this is an improvement
  updatePersonaBestScore(iterationId, metrics.f1_score, db);

  return metrics;
}

/**
 * Store calculated metrics to iteration_metrics table.
 * @param iterationId - The iteration to store metrics for
 * @param metrics - Calculated metrics result
 * @param db - Database connection
 */
function storeIterationMetrics(iterationId: string, metrics: MetricsResult, db: Database): void {
  const id = crypto.randomUUID();

  db.prepare(
    `
    INSERT INTO iteration_metrics
    (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
     precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    iterationId,
    metrics.confusion_matrix.true_positives,
    metrics.confusion_matrix.true_negatives,
    metrics.confusion_matrix.false_positives,
    metrics.confusion_matrix.false_negatives,
    metrics.precision,
    metrics.recall,
    metrics.f1_score,
    metrics.cohens_kappa,
    metrics.accuracy,
    new Date().toISOString()
  );
}

/**
 * Update persona's best F1 score if the new score is higher.
 * @param iterationId - Current iteration ID
 * @param f1Score - Calculated F1 score
 * @param db - Database connection
 */
function updatePersonaBestScore(iterationId: string, f1Score: number, db: Database): void {
  // Get persona and current iteration number
  const iteration = db
    .prepare('SELECT persona_id, iteration_number FROM training_iterations WHERE id = ?')
    .get(iterationId) as { persona_id: string; iteration_number: number } | undefined;

  if (!iteration) {
    return;
  }

  const persona = db
    .prepare('SELECT best_f1_score FROM personas WHERE id = ?')
    .get(iteration.persona_id) as { best_f1_score: number | null } | undefined;

  if (!persona) {
    return;
  }

  // Update if this is the first score or if it's better than current best
  if (persona.best_f1_score === null || f1Score > persona.best_f1_score) {
    db.prepare(
      `
      UPDATE personas
      SET best_f1_score = ?, best_f1_iteration = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(f1Score, iteration.iteration_number, new Date().toISOString(), iteration.persona_id);
  }
}

/**
 * Get iteration metrics by iteration ID.
 * @param iterationId - The iteration ID to fetch metrics for
 * @param db - Database connection
 * @returns MetricsResult or null if not found
 */
export function getIterationMetrics(iterationId: string, db: Database): MetricsResult | null {
  const metrics = db
    .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
    .get(iterationId) as any;

  if (!metrics) {
    return null;
  }

  return {
    precision: metrics.precision,
    recall: metrics.recall,
    f1_score: metrics.f1_score,
    cohens_kappa: metrics.cohens_kappa,
    accuracy: metrics.accuracy,
    confusion_matrix: {
      true_positives: metrics.true_positives,
      true_negatives: metrics.true_negatives,
      false_positives: metrics.false_positives,
      false_negatives: metrics.false_negatives,
    },
  };
}

/**
 * Get all metrics for a persona across all iterations.
 * @param personaId - Persona ID
 * @param db - Database connection
 * @returns Array of iteration metrics with iteration numbers
 */
export function getPersonaMetricsHistory(
  personaId: string,
  db: Database
): Array<{
  iteration_number: number;
  metrics: MetricsResult;
  calculated_at: string;
}> {
  const results = db
    .prepare(
      `
      SELECT
        ti.iteration_number,
        im.*
      FROM iteration_metrics im
      JOIN training_iterations ti ON ti.id = im.iteration_id
      WHERE ti.persona_id = ?
      ORDER BY ti.iteration_number ASC
    `
    )
    .all(personaId) as any[];

  return results.map((row) => ({
    iteration_number: row.iteration_number,
    calculated_at: row.calculated_at,
    metrics: {
      precision: row.precision,
      recall: row.recall,
      f1_score: row.f1_score,
      cohens_kappa: row.cohens_kappa,
      accuracy: row.accuracy,
      confusion_matrix: {
        true_positives: row.true_positives,
        true_negatives: row.true_negatives,
        false_positives: row.false_positives,
        false_negatives: row.false_negatives,
      },
    },
  }));
}
