/**
 * MetricCard Trend Indicator Tests
 *
 * Tests for verifying trend indicator color logic based on metric semantics.
 *
 * Trend Color Logic:
 * - When higherIsBetter=true (F1, precision, recall): up=green (good), down=red (bad)
 * - When higherIsBetter=false (error rate): up=red (bad), down=green (good)
 * - stable: always gray (neutral)
 *
 * @see {@link https://github.com/anthropics/eval-ai-models/tree/main/specs/007-llm-as-judge}
 */

import { describe, it, expect } from 'vitest';

/**
 * Mock trend icon function matching the MetricCard implementation
 */
function getTrendIcon(t?: string, higherBetter: boolean = true): { icon: string; color: string } | null {
  if (!t) return null;

  switch (t) {
    case 'up':
      return {
        icon: 'M5 15l7-7 7 7',
        color: higherBetter ? 'text-success' : 'text-error',
      };
    case 'down':
      return {
        icon: 'M19 9l-7 7-7-7',
        color: higherBetter ? 'text-error' : 'text-success',
      };
    case 'stable':
      return {
        icon: 'M5 12h14',
        color: 'text-base-content/60',
      };
    default:
      return null;
  }
}

describe('MetricCard Trend Indicators', () => {
  describe('Higher-Is-Better Metrics (F1, Precision, Recall)', () => {
    it('should show up trend as green (good) when higherIsBetter=true', () => {
      const result = getTrendIcon('up', true);
      expect(result).not.toBeNull();
      expect(result?.color).toBe('text-success');
      expect(result?.icon).toBe('M5 15l7-7 7 7');
    });

    it('should show down trend as red (bad) when higherIsBetter=true', () => {
      const result = getTrendIcon('down', true);
      expect(result).not.toBeNull();
      expect(result?.color).toBe('text-error');
      expect(result?.icon).toBe('M19 9l-7 7-7-7');
    });

    it('should show stable trend as gray (neutral) when higherIsBetter=true', () => {
      const result = getTrendIcon('stable', true);
      expect(result).not.toBeNull();
      expect(result?.color).toBe('text-base-content/60');
      expect(result?.icon).toBe('M5 12h14');
    });
  });

  describe('Lower-Is-Better Metrics (Error Rate, FP Rate, FN Rate)', () => {
    it('should show up trend as red (bad) when higherIsBetter=false', () => {
      const result = getTrendIcon('up', false);
      expect(result).not.toBeNull();
      expect(result?.color).toBe('text-error');
      expect(result?.icon).toBe('M5 15l7-7 7 7');
    });

    it('should show down trend as green (good) when higherIsBetter=false', () => {
      const result = getTrendIcon('down', false);
      expect(result).not.toBeNull();
      expect(result?.color).toBe('text-success');
      expect(result?.icon).toBe('M19 9l-7 7-7-7');
    });

    it('should show stable trend as gray (neutral) when higherIsBetter=false', () => {
      const result = getTrendIcon('stable', false);
      expect(result).not.toBeNull();
      expect(result?.color).toBe('text-base-content/60');
      expect(result?.icon).toBe('M5 12h14');
    });
  });

  describe('No Trend', () => {
    it('should return null when trend is undefined', () => {
      const result = getTrendIcon(undefined, true);
      expect(result).toBeNull();
    });
  });

  describe('Trend Icon SVG Paths', () => {
    it('should use correct up arrow SVG path', () => {
      const result = getTrendIcon('up', true);
      expect(result?.icon).toBe('M5 15l7-7 7 7');
    });

    it('should use correct down arrow SVG path', () => {
      const result = getTrendIcon('down', true);
      expect(result?.icon).toBe('M19 9l-7 7-7-7');
    });

    it('should use correct horizontal line SVG path for stable', () => {
      const result = getTrendIcon('stable', true);
      expect(result?.icon).toBe('M5 12h14');
    });
  });

  describe('Default Behavior', () => {
    it('should default to higherIsBetter=true when not specified', () => {
      const result = getTrendIcon('up');
      expect(result?.color).toBe('text-success'); // Green because default is higherIsBetter=true
    });
  });

  describe('Use Cases', () => {
    it('F1 Score trend: up should be green (improvement)', () => {
      const result = getTrendIcon('up', true);
      expect(result?.color).toBe('text-success');
    });

    it('F1 Score trend: down should be red (decline)', () => {
      const result = getTrendIcon('down', true);
      expect(result?.color).toBe('text-error');
    });

    it('Error Rate trend: up should be red (worsening)', () => {
      const result = getTrendIcon('up', false);
      expect(result?.color).toBe('text-error');
    });

    it('Error Rate trend: down should be green (improvement)', () => {
      const result = getTrendIcon('down', false);
      expect(result?.color).toBe('text-success');
    });

    it('Precision trend: up should be green (improvement)', () => {
      const result = getTrendIcon('up', true);
      expect(result?.color).toBe('text-success');
    });

    it('Precision trend: down should be red (decline)', () => {
      const result = getTrendIcon('down', true);
      expect(result?.color).toBe('text-error');
    });

    it('Recall trend: up should be green (improvement)', () => {
      const result = getTrendIcon('up', true);
      expect(result?.color).toBe('text-success');
    });

    it('Recall trend: down should be red (decline)', () => {
      const result = getTrendIcon('down', true);
      expect(result?.color).toBe('text-error');
    });
  });
});
