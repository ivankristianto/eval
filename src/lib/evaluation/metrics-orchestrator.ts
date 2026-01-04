/**
 * Metrics Orchestrator
 * Calculates and stores iteration metrics from judge decisions and ground truth (automatic)
 * or human reviews (optional validation)
 */

import type { Database } from 'better-sqlite3';
import { calculateMetrics, buildConfusionMatrix } from './metrics';
import type { MetricsResult, FailureCase } from '@src-types/training';
import { MetricsCalculationError } from '@lib/training/deprecated/training-errors';
import { evaluateByAtomicFacts } from '@lib/training/prompt-engineer';
import { createLogger } from '@lib/logger';

const logger = createLogger('MetricsOrchestrator');

/** Database row type for iteration_metrics */
interface IterationMetricsRow {
  precision: number;
  recall: number;
  f1_score: number;
  cohens_kappa: number;
  accuracy: number;
  true_positives: number;
  true_negatives: number;
  false_positives: number;
  false_negatives: number;
  calculated_at: string;
}

/** Database row type for training_iterations joined with iteration_metrics */
interface IterationMetricsJoinRow extends IterationMetricsRow {
  iteration_number: number;
}

/**
 * Calculate metrics for a training iteration AUTOMATICALLY from ground truth
 * Uses Atomic Fact Evaluation via LLM to compare generated output vs expected output
 * - NO human review required
 * - NO exact string matching (uses semantic fact comparison)
 *
 * @param iterationId - The iteration to calculate metrics for
 * @param db - Database connection
 * @returns Calculated metrics and failure cases for prompt refinement
 * @throws MetricsCalculationError if no judge decisions found
 */
export async function calculateIterationMetricsFromGroundTruth(
  iterationId: string,
  db: Database
): Promise<{ metrics: MetricsResult; failureCases: FailureCase[] }> {
  // Fetch all judge decisions with their training pairs (for ground truth)
  const decisions = db
    .prepare(
      `
      SELECT
        jd.id,
        jd.judge_decision,
        jd.generated_output,
        jd.judge_reasoning,
        tp.input as pair_input,
        tp.expected_output,
        ti.persona_id
      FROM judge_decisions jd
      JOIN training_pairs tp ON tp.id = jd.training_pair_id
      JOIN training_iterations ti ON ti.id = jd.iteration_id
      WHERE jd.iteration_id = ?
    `
    )
    .all(iterationId) as Array<{
    id: string;
    judge_decision: 'agree' | 'disagree';
    generated_output: string;
    judge_reasoning: string;
    pair_input: string;
    expected_output: string;
    persona_id: string;
  }>;

  if (decisions.length === 0) {
    throw new MetricsCalculationError(`No judge decisions found for iteration: ${iterationId}`);
  }

  // Get persona's prompt engineer model ID
  const persona = db
    .prepare('SELECT prompt_engineer_model_id FROM personas WHERE id = ?')
    .get(decisions[0].persona_id) as { prompt_engineer_model_id: string } | undefined;

  if (!persona) {
    throw new MetricsCalculationError(`Persona not found: ${decisions[0].persona_id}`);
  }

  // Aggregate atomic fact evaluation results across all decisions
  let totalTP = 0;
  let totalTN = 0;
  let totalFP = 0;
  let totalFN = 0;
  const failureCases: FailureCase[] = [];

  // Evaluate each decision using atomic fact comparison
  for (const decision of decisions) {
    try {
      const evaluation = await evaluateByAtomicFacts(
        decision.expected_output,
        decision.generated_output,
        persona.prompt_engineer_model_id
      );

      // Aggregate counts from atomic fact evaluation
      totalTP += evaluation.TP_count;
      totalTN += evaluation.TN_count;
      totalFP += evaluation.FP_count;
      totalFN += evaluation.FN_count;

      // Collect failure cases for prompt refinement
      if (evaluation.FP_count > 0) {
        // False Positive: Model generated facts not in reference (hallucination)
        failureCases.push({
          type: 'false_positive',
          input: decision.pair_input,
          generated_output: decision.generated_output,
          expected_output: decision.expected_output,
          judge_reasoning: `${evaluation.FP_count} hallucinated facts. ${evaluation.Reasoning}`,
        });
      }

      if (evaluation.FN_count > 0) {
        // False Negative: Model missed facts from reference (omission)
        failureCases.push({
          type: 'false_negative',
          input: decision.pair_input,
          generated_output: decision.generated_output,
          expected_output: decision.expected_output,
          judge_reasoning: `${evaluation.FN_count} missing facts. ${evaluation.Reasoning}`,
        });
      }
    } catch (error) {
      logger.warn('Atomic fact evaluation failed for decision, using fallback', {
        decisionId: decision.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // On failure, count as FP and FN (worst case)
      totalFP += 1;
      totalFN += 1;
    }
  }

  // Build confusion matrix from aggregated atomic fact counts
  // TP: facts correctly included, TN: facts correctly omitted
  // FP: hallucinated facts, FN: omitted facts
  const confusionMatrix = {
    true_positives: totalTP,
    true_negatives: totalTN,
    false_positives: totalFP,
    false_negatives: totalFN,
  };

  // Calculate metrics from confusion matrix
  const metrics = calculateMetrics(confusionMatrix);

  // Store metrics to database
  storeIterationMetrics(iterationId, metrics, db);

  // Update persona best_f1_score if this is an improvement
  updatePersonaBestScore(iterationId, metrics.f1_score, db);

  logger.info('Atomic fact evaluation metrics calculated', {
    iterationId,
    totalDecisions: decisions.length,
    TP: totalTP,
    TN: totalTN,
    FP: totalFP,
    FN: totalFN,
    f1Score: metrics.f1_score,
  });

  return { metrics, failureCases };
}

/**
 * Calculate metrics for a training iteration (LEGACY - requires human review)
 * This is kept for backwards compatibility with optional human validation
 * Use calculateIterationMetricsFromGroundTruth for automatic training
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
    .get(iterationId) as IterationMetricsRow | undefined;

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
    .all(personaId) as IterationMetricsJoinRow[];

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
