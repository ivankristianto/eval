/**
 * Unit tests for metrics calculation module
 * Tests confusion matrix building, F1 score, precision, recall, Cohen's Kappa
 */

import { describe, it, expect } from 'vitest';
import type { ConfusionMatrix } from '../../src/types/training';

// Import functions from metrics module (to be implemented)
import {
  buildConfusionMatrix,
  calculateMetrics,
  calculatePrecision,
  calculateRecall,
  calculateF1Score,
  calculateCohensKappa,
  calculateAccuracy,
} from '@lib/evaluation/metrics';

describe('Metrics Calculation', () => {
  describe('buildConfusionMatrix', () => {
    it('should correctly map judge and human decisions to confusion matrix', () => {
      // Judge agrees = true means judge said "agree"
      // Human agrees = true means human said "agree" with judge
      const judgeAgreements = [true, true, true, false, false];
      const humanAgreements = [true, true, false, false, true];

      const cm = buildConfusionMatrix(judgeAgreements, humanAgreements);

      // TP: Judge agreed, Human agreed = indices 0, 1 = 2
      // TN: Judge disagreed, Human agreed (with disagreement) = index 3 = 1
      // FP: Judge agreed, Human disagreed = index 2 = 1
      // FN: Judge disagreed, Human disagreed (wanted judge to agree) = index 4 = 1
      expect(cm.true_positives).toBe(2);
      expect(cm.true_negatives).toBe(1);
      expect(cm.false_positives).toBe(1);
      expect(cm.false_negatives).toBe(1);
    });

    it('should handle all true positives', () => {
      const judgeAgreements = [true, true, true];
      const humanAgreements = [true, true, true];

      const cm = buildConfusionMatrix(judgeAgreements, humanAgreements);

      expect(cm.true_positives).toBe(3);
      expect(cm.true_negatives).toBe(0);
      expect(cm.false_positives).toBe(0);
      expect(cm.false_negatives).toBe(0);
    });

    it('should handle all true negatives', () => {
      const judgeAgreements = [false, false, false];
      const humanAgreements = [true, true, true]; // Human agrees with judge's "disagree"

      const cm = buildConfusionMatrix(judgeAgreements, humanAgreements);

      expect(cm.true_positives).toBe(0);
      expect(cm.true_negatives).toBe(3);
      expect(cm.false_positives).toBe(0);
      expect(cm.false_negatives).toBe(0);
    });

    it('should throw error on mismatched array lengths', () => {
      const judgeAgreements = [true, true];
      const humanAgreements = [true];

      expect(() => buildConfusionMatrix(judgeAgreements, humanAgreements)).toThrow(
        'Judge and human agreement arrays must have the same length'
      );
    });
  });

  describe('calculatePrecision', () => {
    it('should calculate precision correctly', () => {
      const cm: ConfusionMatrix = {
        true_positives: 5,
        true_negatives: 3,
        false_positives: 1,
        false_negatives: 1,
      };

      const precision = calculatePrecision(cm);
      expect(precision).toBeCloseTo(5 / 6, 3); // 0.833
    });

    it('should return 0 when TP + FP = 0 (no positive predictions)', () => {
      const cm: ConfusionMatrix = {
        true_positives: 0,
        true_negatives: 5,
        false_positives: 0,
        false_negatives: 5,
      };

      const precision = calculatePrecision(cm);
      expect(precision).toBe(0);
    });

    it('should return 1 when only TP (no false positives)', () => {
      const cm: ConfusionMatrix = {
        true_positives: 10,
        true_negatives: 0,
        false_positives: 0,
        false_negatives: 0,
      };

      const precision = calculatePrecision(cm);
      expect(precision).toBe(1);
    });
  });

  describe('calculateRecall', () => {
    it('should calculate recall correctly', () => {
      const cm: ConfusionMatrix = {
        true_positives: 5,
        true_negatives: 3,
        false_positives: 1,
        false_negatives: 1,
      };

      const recall = calculateRecall(cm);
      expect(recall).toBeCloseTo(5 / 6, 3); // 0.833
    });

    it('should return 0 when TP + FN = 0 (no actual positives)', () => {
      const cm: ConfusionMatrix = {
        true_positives: 0,
        true_negatives: 5,
        false_positives: 5,
        false_negatives: 0,
      };

      const recall = calculateRecall(cm);
      expect(recall).toBe(0);
    });

    it('should return 1 when only TP (no false negatives)', () => {
      const cm: ConfusionMatrix = {
        true_positives: 10,
        true_negatives: 0,
        false_positives: 0,
        false_negatives: 0,
      };

      const recall = calculateRecall(cm);
      expect(recall).toBe(1);
    });
  });

  describe('calculateF1Score', () => {
    it('should calculate F1 score correctly', () => {
      const precision = 0.833;
      const recall = 0.833;

      const f1 = calculateF1Score(precision, recall);
      expect(f1).toBeCloseTo(0.833, 3);
    });

    it('should calculate F1 with different precision and recall', () => {
      const precision = 0.9;
      const recall = 0.7;

      const f1 = calculateF1Score(precision, recall);
      // F1 = 2 * (0.9 * 0.7) / (0.9 + 0.7) = 1.26 / 1.6 = 0.7875
      expect(f1).toBeCloseTo(0.7875, 3);
    });

    it('should return 0 when precision + recall = 0', () => {
      const f1 = calculateF1Score(0, 0);
      expect(f1).toBe(0);
    });

    it('should return 1 when both precision and recall are 1', () => {
      const f1 = calculateF1Score(1, 1);
      expect(f1).toBe(1);
    });
  });

  describe('calculateCohensKappa', () => {
    it("should calculate Cohen's Kappa correctly", () => {
      const cm: ConfusionMatrix = {
        true_positives: 50,
        true_negatives: 30,
        false_positives: 10,
        false_negatives: 10,
      };

      const kappa = calculateCohensKappa(cm);

      // Total = 100
      // P_o (observed agreement) = (50 + 30) / 100 = 0.8
      // P_yes (expected yes) = ((50+10) * (50+10)) / 10000 = 3600/10000 = 0.36
      // P_no (expected no) = ((30+10) * (30+10)) / 10000 = 1600/10000 = 0.16
      // P_e = 0.36 + 0.16 = 0.52
      // Kappa = (0.8 - 0.52) / (1 - 0.52) = 0.28 / 0.48 = 0.583
      expect(kappa).toBeCloseTo(0.583, 2);
    });

    it('should return 1 for perfect agreement', () => {
      const cm: ConfusionMatrix = {
        true_positives: 50,
        true_negatives: 50,
        false_positives: 0,
        false_negatives: 0,
      };

      const kappa = calculateCohensKappa(cm);
      expect(kappa).toBe(1);
    });

    it('should return 0 when agreement is by chance', () => {
      // Construct a case where P_o = P_e
      const cm: ConfusionMatrix = {
        true_positives: 25,
        true_negatives: 25,
        false_positives: 25,
        false_negatives: 25,
      };

      const kappa = calculateCohensKappa(cm);
      expect(kappa).toBeCloseTo(0, 1);
    });

    it('should handle negative kappa (worse than chance)', () => {
      // Extreme disagreement case
      const cm: ConfusionMatrix = {
        true_positives: 0,
        true_negatives: 0,
        false_positives: 50,
        false_negatives: 50,
      };

      const kappa = calculateCohensKappa(cm);
      expect(kappa).toBeLessThan(0);
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy correctly', () => {
      const cm: ConfusionMatrix = {
        true_positives: 5,
        true_negatives: 3,
        false_positives: 1,
        false_negatives: 1,
      };

      const accuracy = calculateAccuracy(cm);
      expect(accuracy).toBeCloseTo(0.8, 3); // (5+3)/10
    });

    it('should return 1 for perfect accuracy', () => {
      const cm: ConfusionMatrix = {
        true_positives: 50,
        true_negatives: 50,
        false_positives: 0,
        false_negatives: 0,
      };

      const accuracy = calculateAccuracy(cm);
      expect(accuracy).toBe(1);
    });

    it('should return 0 for zero accuracy', () => {
      const cm: ConfusionMatrix = {
        true_positives: 0,
        true_negatives: 0,
        false_positives: 50,
        false_negatives: 50,
      };

      const accuracy = calculateAccuracy(cm);
      expect(accuracy).toBe(0);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate all metrics correctly', () => {
      const cm: ConfusionMatrix = {
        true_positives: 5,
        true_negatives: 3,
        false_positives: 1,
        false_negatives: 1,
      };

      const metrics = calculateMetrics(cm);

      expect(metrics.precision).toBeCloseTo(0.833, 2);
      expect(metrics.recall).toBeCloseTo(0.833, 2);
      expect(metrics.f1_score).toBeCloseTo(0.833, 2);
      expect(metrics.accuracy).toBeCloseTo(0.8, 2);
      expect(metrics.cohens_kappa).toBeGreaterThan(0);
      expect(metrics.confusion_matrix).toEqual(cm);
    });

    it('should return valid metrics for edge case (all zeros)', () => {
      const cm: ConfusionMatrix = {
        true_positives: 0,
        true_negatives: 0,
        false_positives: 0,
        false_negatives: 0,
      };

      const metrics = calculateMetrics(cm);

      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
      expect(metrics.f1_score).toBe(0);
      expect(metrics.accuracy).toBe(0);
      expect(metrics.cohens_kappa).toBe(0);
    });

    it('should calculate metrics for real-world example', () => {
      // Example from spec: targeting F1 >= 0.80, Precision >= 0.89, Recall >= 0.73
      // Let's verify a scenario that meets these targets
      const cm: ConfusionMatrix = {
        true_positives: 89,
        true_negatives: 0,
        false_positives: 11,
        false_negatives: 0,
      };

      const metrics = calculateMetrics(cm);

      // Precision = 89 / (89 + 11) = 0.89
      expect(metrics.precision).toBeCloseTo(0.89, 2);
      // Recall = 89 / (89 + 0) = 1.0
      expect(metrics.recall).toBeCloseTo(1.0, 2);
      // F1 = 2 * (0.89 * 1.0) / (0.89 + 1.0) = 0.942
      expect(metrics.f1_score).toBeGreaterThanOrEqual(0.8);
    });
  });
});
