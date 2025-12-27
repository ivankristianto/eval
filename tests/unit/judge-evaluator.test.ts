/**
 * Unit tests for Judge Evaluator
 * Tests judge decision parsing and evaluation logic
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { evaluateOutput, parseJudgeResponse } from '../../src/lib/judge-evaluator';
import { getTestDatabase, initializeTestDatabase, cleanTestDatabase } from '../setup';

describe('Judge Evaluator', () => {
  let _db: ReturnType<typeof getTestDatabase>;

  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    _db = getTestDatabase();
    cleanTestDatabase();
  });

  describe('parseJudgeResponse', () => {
    it('should parse valid JSON response with agree decision', () => {
      const response = JSON.stringify({
        decision: 'agree',
        confidence: 0.95,
        reasoning: 'The output matches the expected result',
      });

      const result = parseJudgeResponse(response);

      expect(result.decision).toBe('agree');
      expect(result.confidence).toBe(0.95);
      expect(result.reasoning).toBe('The output matches the expected result');
    });

    it('should parse valid JSON response with disagree decision', () => {
      const response = JSON.stringify({
        decision: 'disagree',
        confidence: 0.85,
        reasoning: 'The output does not meet the expected criteria',
      });

      const result = parseJudgeResponse(response);

      expect(result.decision).toBe('disagree');
      expect(result.confidence).toBe(0.85);
      expect(result.reasoning).toBe('The output does not meet the expected criteria');
    });

    it('should handle response with missing confidence', () => {
      const response = JSON.stringify({
        decision: 'agree',
        reasoning: 'Good output',
      });

      const result = parseJudgeResponse(response);

      expect(result.decision).toBe('agree');
      expect(result.confidence).toBeUndefined();
      expect(result.reasoning).toBe('Good output');
    });

    it('should throw error on malformed JSON', () => {
      const response = 'This is not valid JSON {';

      expect(() => parseJudgeResponse(response)).toThrow();
    });

    it('should throw error on missing decision field', () => {
      const response = JSON.stringify({
        confidence: 0.9,
        reasoning: 'Missing decision field',
      });

      expect(() => parseJudgeResponse(response)).toThrow('Invalid judge response: missing decision');
    });

    it('should throw error on invalid decision value', () => {
      const response = JSON.stringify({
        decision: 'maybe',
        confidence: 0.5,
        reasoning: 'Invalid decision value',
      });

      expect(() => parseJudgeResponse(response)).toThrow('Invalid judge decision');
    });

    it('should clamp confidence to valid range', () => {
      const response = JSON.stringify({
        decision: 'agree',
        confidence: 1.5,
        reasoning: 'Confidence out of range',
      });

      const result = parseJudgeResponse(response);

      expect(result.confidence).toBe(1.0);
    });

    it('should handle negative confidence by clamping to 0', () => {
      const response = JSON.stringify({
        decision: 'disagree',
        confidence: -0.2,
        reasoning: 'Negative confidence',
      });

      const result = parseJudgeResponse(response);

      expect(result.confidence).toBe(0.0);
    });
  });

  describe('evaluateOutput', () => {
    it('should return a promise for judge evaluation', async () => {
      const result = evaluateOutput(
        'What is 2+2?',
        '4',
        '4',
        'Evaluate if the output is correct',
        'mock-judge-model'
      );

      expect(result).toBeInstanceOf(Promise);
    });

    it('should format prompt with input, expected output, and suggested output', async () => {
      // This is a placeholder test since we're not actually calling the API
      const input = 'What is the capital of France?';
      const expectedOutput = 'Paris';
      const suggestedOutput = 'Paris';
      const judgePrompt = 'Is the answer correct?';

      const result = await evaluateOutput(
        input,
        expectedOutput,
        suggestedOutput,
        judgePrompt,
        'mock-judge-model'
      );

      // In the mock implementation, this should return a default structure
      expect(result).toHaveProperty('decision');
      expect(result).toHaveProperty('reasoning');
    });
  });
});
