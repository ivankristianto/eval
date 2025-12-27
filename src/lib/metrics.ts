/**
 * Metrics calculation module for LLM-as-Judge training
 * Implements confusion matrix, F1 score, precision, recall, Cohen's Kappa, and accuracy
 */

import type { ConfusionMatrix, MetricsResult } from '../types/training';

/**
 * Build confusion matrix from judge and human agreement arrays
 *
 * Mapping:
 * - Judge agrees (true) + Human agrees (true) = True Positive (TP)
 * - Judge disagrees (false) + Human agrees (true) = True Negative (TN)
 * - Judge agrees (true) + Human disagrees (false) = False Positive (FP)
 * - Judge disagrees (false) + Human disagrees (false) = False Negative (FN)
 *
 * @param judgeAgreements - Array of judge decisions (true = "agree", false = "disagree")
 * @param humanAgreements - Array of human decisions (true = agrees with judge, false = disagrees)
 * @returns ConfusionMatrix with TP, TN, FP, FN counts
 */
export function buildConfusionMatrix(
  judgeAgreements: boolean[],
  humanAgreements: boolean[]
): ConfusionMatrix {
  if (judgeAgreements.length !== humanAgreements.length) {
    throw new Error('Judge and human agreement arrays must have the same length');
  }

  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  for (let i = 0; i < judgeAgreements.length; i++) {
    const judgeAgrees = judgeAgreements[i];
    const humanAgrees = humanAgreements[i];

    if (judgeAgrees && humanAgrees) {
      tp++; // Judge said "agree", human affirmed
    } else if (!judgeAgrees && humanAgrees) {
      tn++; // Judge said "disagree", human affirmed (correctly rejected)
    } else if (judgeAgrees && !humanAgrees) {
      fp++; // Judge said "agree", human disagreed (judge was wrong)
    } else {
      fn++; // Judge said "disagree", human disagreed (judge should have agreed)
    }
  }

  return {
    true_positives: tp,
    true_negatives: tn,
    false_positives: fp,
    false_negatives: fn,
  };
}

/**
 * Calculate precision: TP / (TP + FP).
 * Handles division by zero gracefully.
 * @param cm - Confusion matrix data
 * @returns Precision score (0.0 to 1.0)
 */
export function calculatePrecision(cm: ConfusionMatrix): number {
  const denominator = cm.true_positives + cm.false_positives;
  if (denominator === 0) return 0;
  return cm.true_positives / denominator;
}

/**
 * Calculate recall: TP / (TP + FN).
 * Handles division by zero gracefully.
 * @param cm - Confusion matrix data
 * @returns Recall score (0.0 to 1.0)
 */
export function calculateRecall(cm: ConfusionMatrix): number {
  const denominator = cm.true_positives + cm.false_negatives;
  if (denominator === 0) return 0;
  return cm.true_positives / denominator;
}

/**
 * Calculate F1 score: 2 * (precision * recall) / (precision + recall).
 * Handles division by zero gracefully.
 * @param precision - Precision score
 * @param recall - Recall score
 * @returns F1 score (0.0 to 1.0)
 */
export function calculateF1Score(precision: number, recall: number): number {
  const denominator = precision + recall;
  if (denominator === 0) return 0;
  return (2 * precision * recall) / denominator;
}

/**
 * Calculate accuracy: (TP + TN) / Total.
 * Handles edge case of zero total.
 * @param cm - Confusion matrix data
 * @returns Accuracy score (0.0 to 1.0)
 */
export function calculateAccuracy(cm: ConfusionMatrix): number {
  const total = cm.true_positives + cm.true_negatives + cm.false_positives + cm.false_negatives;
  if (total === 0) return 0;
  return (cm.true_positives + cm.true_negatives) / total;
}

/**
 * Calculate Cohen's Kappa: inter-rater reliability metric.
 * Formula: (P_o - P_e) / (1 - P_e)
 * where:
 * - P_o = observed agreement (accuracy)
 * - P_e = expected agreement by chance
 *
 * Range: -1 (complete disagreement) to 1 (perfect agreement)
 * - κ > 0.66: substantial agreement
 * - κ 0.41-0.66: moderate agreement
 * - κ < 0.41: poor agreement
 * @param cm - Confusion matrix data
 * @returns Cohen's Kappa score (-1.0 to 1.0)
 */
export function calculateCohensKappa(cm: ConfusionMatrix): number {
  const total = cm.true_positives + cm.true_negatives + cm.false_positives + cm.false_negatives;

  if (total === 0) return 0;

  // Observed agreement
  const po = (cm.true_positives + cm.true_negatives) / total;

  // Edge case: perfect agreement
  if (po === 1) return 1;

  // Expected agreement by chance
  const yesActual = cm.true_positives + cm.false_negatives; // Total actual positives
  const yesPredicted = cm.true_positives + cm.false_positives; // Total predicted positives
  const noActual = cm.true_negatives + cm.false_positives; // Total actual negatives
  const noPredicted = cm.true_negatives + cm.false_negatives; // Total predicted negatives

  const pYes = (yesActual * yesPredicted) / (total * total);
  const pNo = (noActual * noPredicted) / (total * total);
  const pe = pYes + pNo;

  // Cohen's Kappa
  const denominator = 1 - pe;
  if (denominator === 0) return 0;

  return (po - pe) / denominator;
}

/**
 * Calculate all metrics from confusion matrix.
 * Returns comprehensive metrics result.
 * @param cm - Confusion matrix data
 * @returns Calculated precision, recall, F1, kappa, and accuracy
 */
export function calculateMetrics(cm: ConfusionMatrix): MetricsResult {
  const precision = calculatePrecision(cm);
  const recall = calculateRecall(cm);
  const f1_score = calculateF1Score(precision, recall);
  const cohens_kappa = calculateCohensKappa(cm);
  const accuracy = calculateAccuracy(cm);

  return {
    precision,
    recall,
    f1_score,
    cohens_kappa,
    accuracy,
    confusion_matrix: cm,
  };
}

/**
 * Calculate batch metrics aggregated across multiple iterations.
 * Useful for trend analysis and overall performance tracking.
 * @param confusionMatrices - Array of confusion matrices to aggregate
 * @returns Aggregated metrics result
 */
export function calculateBatchMetrics(confusionMatrices: ConfusionMatrix[]): MetricsResult {
  // Aggregate confusion matrices
  const aggregated: ConfusionMatrix = confusionMatrices.reduce(
    (acc, cm) => ({
      true_positives: acc.true_positives + cm.true_positives,
      true_negatives: acc.true_negatives + cm.true_negatives,
      false_positives: acc.false_positives + cm.false_positives,
      false_negatives: acc.false_negatives + cm.false_negatives,
    }),
    { true_positives: 0, true_negatives: 0, false_positives: 0, false_negatives: 0 }
  );

  return calculateMetrics(aggregated);
}
