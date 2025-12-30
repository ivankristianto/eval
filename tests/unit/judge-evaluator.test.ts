/**
 * Unit tests for Judge Evaluator
 * Tests judge decision parsing and evaluation logic
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { evaluateOutput, parseJudgeResponse } from '@lib/evaluation/judge-evaluator';
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
        reasoning: 'The output matches the expected result',
      });

      const result = parseJudgeResponse(response);

      expect(result.decision).toBe('agree');
      expect(result.reasoning).toBe('The output matches the expected result');
    });

    it('should parse valid JSON response with disagree decision', () => {
      const response = JSON.stringify({
        decision: 'disagree',
        reasoning: 'The output does not meet the expected criteria',
      });

      const result = parseJudgeResponse(response);

      expect(result.decision).toBe('disagree');
      expect(result.reasoning).toBe('The output does not meet the expected criteria');
    });

    it('should handle response with missing reasoning', () => {
      const response = JSON.stringify({
        decision: 'agree',
      });

      const result = parseJudgeResponse(response);

      expect(result.decision).toBe('agree');
      expect(result.reasoning).toBe('');
    });

    it('should throw error on malformed JSON', () => {
      const response = 'This is not valid JSON {';

      expect(() => parseJudgeResponse(response)).toThrow();
    });

    it('should throw error on missing decision field', () => {
      const response = JSON.stringify({
        reasoning: 'Missing decision field',
      });

      expect(() => parseJudgeResponse(response)).toThrow(
        'Invalid judge response: missing decision'
      );
    });

    it('should throw error on invalid decision value', () => {
      const response = JSON.stringify({
        decision: 'maybe',
        reasoning: 'Invalid decision value',
      });

      expect(() => parseJudgeResponse(response)).toThrow('Invalid judge decision');
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
