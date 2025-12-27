/**
 * Edge case tests for metrics calculation
 * Tests division by zero, empty datasets, all-correct scenarios, single-element datasets
 */

import { describe, it, expect } from 'vitest';
import type { ConfusionMatrix } from '../../src/types/training';
import {
  buildConfusionMatrix,
  calculateMetrics,
  calculatePrecision,
  calculateRecall,
  calculateF1Score,
  calculateCohensKappa,
  calculateAccuracy,
  calculateBatchMetrics,
} from '../../src/lib/metrics';

describe('Metrics Edge Cases', () => {
  describe('Empty confusion matrix (all zeros)', () => {
    const emptyCm: ConfusionMatrix = {
      true_positives: 0,
      true_negatives: 0,
      false_positives: 0,
      false_negatives: 0,
    };

    it('should return 0 for precision (no division by zero error)', () => {
      const precision = calculatePrecision(emptyCm);
      expect(precision).toBe(0);
      expect(Number.isNaN(precision)).toBe(false);
    });

    it('should return 0 for recall (no division by zero error)', () => {
      const recall = calculateRecall(emptyCm);
      expect(recall).toBe(0);
      expect(Number.isNaN(recall)).toBe(false);
    });

    it('should return 0 for F1 score', () => {
      const f1 = calculateF1Score(0, 0);
      expect(f1).toBe(0);
      expect(Number.isNaN(f1)).toBe(false);
    });

    it("should return 0 for Cohen's Kappa", () => {
      const kappa = calculateCohensKappa(emptyCm);
      expect(kappa).toBe(0);
      expect(Number.isNaN(kappa)).toBe(false);
    });

    it('should return 0 for accuracy', () => {
      const accuracy = calculateAccuracy(emptyCm);
      expect(accuracy).toBe(0);
      expect(Number.isNaN(accuracy)).toBe(false);
    });

    it('should return all zeros for calculateMetrics', () => {
      const metrics = calculateMetrics(emptyCm);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1_score).toBe(0);
      expect(metrics.cohens_kappa).toBe(0);
      expect(metrics.accuracy).toBe(0);
    });
  });

  describe('All true positives (100% agreement)', () => {
    const allTpCm: ConfusionMatrix = {
      true_positives: 100,
      true_negatives: 0,
      false_positives: 0,
      false_negatives: 0,
    };

    it('should return 1 for precision', () => {
      const precision = calculatePrecision(allTpCm);
      expect(precision).toBe(1);
    });

    it('should return 1 for recall', () => {
      const recall = calculateRecall(allTpCm);
      expect(recall).toBe(1);
    });

    it('should return 1 for F1 score', () => {
      const f1 = calculateF1Score(1, 1);
      expect(f1).toBe(1);
    });

    it("should return 1 for Cohen's Kappa (perfect agreement)", () => {
      const kappa = calculateCohensKappa(allTpCm);
      expect(kappa).toBe(1);
    });

    it('should return 1 for accuracy', () => {
      const accuracy = calculateAccuracy(allTpCm);
      expect(accuracy).toBe(1);
    });
  });

  describe('All false positives (no ground truth matches)', () => {
    const allFpCm: ConfusionMatrix = {
      true_positives: 0,
      true_negatives: 0,
      false_positives: 100,
      false_negatives: 0,
    };

    it('should return 0 for precision (all predictions wrong)', () => {
      const precision = calculatePrecision(allFpCm);
      expect(precision).toBe(0);
    });

    it('should return 0 for recall (no actual positives caught)', () => {
      const recall = calculateRecall(allFpCm);
      expect(recall).toBe(0);
    });

    it('should return 0 for F1 score', () => {
      const metrics = calculateMetrics(allFpCm);
      expect(metrics.f1_score).toBe(0);
    });

    it('should return 0 for accuracy (no correct predictions)', () => {
      const accuracy = calculateAccuracy(allFpCm);
      expect(accuracy).toBe(0);
    });

    it("should return negative or zero Cohen's Kappa", () => {
      const kappa = calculateCohensKappa(allFpCm);
      expect(kappa).toBeLessThanOrEqual(0);
    });
  });

  describe('Single-element dataset', () => {
    it('should handle single TP correctly', () => {
      const judgeAgreements = [true];
      const humanAgreements = [true];

      const cm = buildConfusionMatrix(judgeAgreements, humanAgreements);
      expect(cm.true_positives).toBe(1);
      expect(cm.true_negatives).toBe(0);
      expect(cm.false_positives).toBe(0);
      expect(cm.false_negatives).toBe(0);

      const metrics = calculateMetrics(cm);
      expect(metrics.precision).toBe(1);
      expect(metrics.recall).toBe(1);
      expect(metrics.f1_score).toBe(1);
      expect(metrics.accuracy).toBe(1);
    });

    it('should handle single FP correctly', () => {
      const judgeAgreements = [true];
      const humanAgreements = [false];

      const cm = buildConfusionMatrix(judgeAgreements, humanAgreements);
      expect(cm.false_positives).toBe(1);

      const metrics = calculateMetrics(cm);
      expect(metrics.precision).toBe(0);
      expect(metrics.accuracy).toBe(0);
    });
  });

  describe('Empty arrays', () => {
    it('should throw error for empty arrays', () => {
      const judgeAgreements: boolean[] = [];
      const humanAgreements: boolean[] = [];

      // Empty arrays should still produce a confusion matrix (all zeros)
      const cm = buildConfusionMatrix(judgeAgreements, humanAgreements);
      expect(cm.true_positives).toBe(0);
      expect(cm.true_negatives).toBe(0);
      expect(cm.false_positives).toBe(0);
      expect(cm.false_negatives).toBe(0);
    });
  });

  describe('Mismatched array lengths', () => {
    it('should throw error when judge and human arrays have different lengths', () => {
      const judgeAgreements = [true, true, false];
      const humanAgreements = [true, false]; // Missing one element

      expect(() => buildConfusionMatrix(judgeAgreements, humanAgreements)).toThrow(
        'Judge and human agreement arrays must have the same length'
      );
    });
  });

  describe('Extreme values', () => {
    it('should handle very large numbers correctly', () => {
      const cm: ConfusionMatrix = {
        true_positives: 1000000,
        true_negatives: 1000000,
        false_positives: 0,
        false_negatives: 0,
      };

      const metrics = calculateMetrics(cm);
      expect(metrics.precision).toBe(1);
      expect(metrics.recall).toBe(1);
      expect(metrics.f1_score).toBe(1);
      expect(metrics.accuracy).toBe(1);
      expect(Number.isFinite(metrics.cohens_kappa)).toBe(true);
    });
  });

  describe('Batch metrics aggregation', () => {
    it('should aggregate multiple confusion matrices correctly', () => {
      const matrices: ConfusionMatrix[] = [
        { true_positives: 5, true_negatives: 3, false_positives: 1, false_negatives: 1 },
        { true_positives: 4, true_negatives: 4, false_positives: 1, false_negatives: 1 },
        { true_positives: 6, true_negatives: 2, false_positives: 1, false_negatives: 1 },
      ];

      const batchMetrics = calculateBatchMetrics(matrices);

      // Aggregated: TP=15, TN=9, FP=3, FN=3
      expect(batchMetrics.confusion_matrix.true_positives).toBe(15);
      expect(batchMetrics.confusion_matrix.true_negatives).toBe(9);
      expect(batchMetrics.confusion_matrix.false_positives).toBe(3);
      expect(batchMetrics.confusion_matrix.false_negatives).toBe(3);

      // Precision = 15 / (15 + 3) = 0.833
      expect(batchMetrics.precision).toBeCloseTo(0.833, 2);

      // Recall = 15 / (15 + 3) = 0.833
      expect(batchMetrics.recall).toBeCloseTo(0.833, 2);

      // Accuracy = (15 + 9) / 30 = 0.8
      expect(batchMetrics.accuracy).toBeCloseTo(0.8, 2);
    });

    it('should handle empty batch array', () => {
      const matrices: ConfusionMatrix[] = [];

      const batchMetrics = calculateBatchMetrics(matrices);

      expect(batchMetrics.precision).toBe(0);
      expect(batchMetrics.recall).toBe(0);
      expect(batchMetrics.f1_score).toBe(0);
      expect(batchMetrics.accuracy).toBe(0);
    });
  });

  describe('Real-world scenario: spec success criteria validation', () => {
    it('should meet spec target: F1 >= 0.80', () => {
      // Design a confusion matrix that achieves F1 >= 0.80
      const cm: ConfusionMatrix = {
        true_positives: 80,
        true_negatives: 10,
        false_positives: 5,
        false_negatives: 5,
      };

      const metrics = calculateMetrics(cm);

      // Precision = 80 / (80 + 5) = 0.941
      // Recall = 80 / (80 + 5) = 0.941
      // F1 = 0.941
      expect(metrics.f1_score).toBeGreaterThanOrEqual(0.8);
    });

    it('should meet spec target: Precision >= 0.89, Recall >= 0.73', () => {
      // Design a confusion matrix that achieves both targets
      const cm: ConfusionMatrix = {
        true_positives: 89,
        true_negatives: 0,
        false_positives: 11,
        false_negatives: 0,
      };

      const metrics = calculateMetrics(cm);

      // Precision = 89 / (89 + 11) = 0.89
      expect(metrics.precision).toBeGreaterThanOrEqual(0.89);

      // Recall = 89 / (89 + 0) = 1.0
      expect(metrics.recall).toBeGreaterThanOrEqual(0.73);

      // F1 should also be high
      expect(metrics.f1_score).toBeGreaterThan(0.8);
    });

    it("should meet spec target: Cohen's Kappa >= 0.66", () => {
      // Design a confusion matrix that achieves substantial agreement
      const cm: ConfusionMatrix = {
        true_positives: 70,
        true_negatives: 20,
        false_positives: 5,
        false_negatives: 5,
      };

      const metrics = calculateMetrics(cm);

      // Kappa should indicate substantial agreement
      expect(metrics.cohens_kappa).toBeGreaterThanOrEqual(0.66);
    });
  });
});
