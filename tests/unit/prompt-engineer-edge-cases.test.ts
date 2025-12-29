/**
 * Unit tests for prompt engineer edge cases
 * Tests handling of malformed responses, empty contexts, and error scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refineJudgePrompt } from '@lib/training/prompt-engineer';
import type { FailureAnalysisContext } from '@lib/training/failure-analysis';

// Mock the API clients
vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(),
}));

import { callModel } from '@lib/utils/api-clients';

describe('Prompt Engineer Edge Cases', () => {
  const baseContext: FailureAnalysisContext = {
    current_metrics: {
      precision: 0.8,
      recall: 0.75,
      f1_score: 0.77,
      cohens_kappa: 0.7,
      accuracy: 0.78,
      confusion_matrix: {
        true_positives: 20,
        true_negatives: 15,
        false_positives: 5,
        false_negatives: 7,
      },
    },
    iteration_number: 1,
    false_positives: [],
    false_negatives: [],
    correct_examples: [],
    judge_prompt: 'Evaluate accuracy',
    task_prompt: 'Test task',
    evaluation_criteria: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle empty string response from LLM', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue('');

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('empty or invalid');
  });

  it('should handle null response from LLM', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(null as unknown as string);

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('should handle response with only whitespace', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue('   \n\t  ');

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('Failed to parse');
  });

  it('should handle response with HTML instead of JSON', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      '<html><body>Error 500</body></html>'
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('Failed to parse');
  });

  it('should handle response with JSON-like but invalid JSON', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      '{ "improved_prompt": "test", invalid }'
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('Failed to parse');
  });

  it('should handle response with empty JSON object', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue('{}');

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.rationale).toBeUndefined();
    expect(result.expected_impact).toBeUndefined();
  });

  it('should handle response with null improved_prompt field', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        improved_prompt: null,
        rationale: 'Could not generate improvement',
        expected_impact: 'None',
      })
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.rationale).toBe('Could not generate improvement');
    expect(result.expected_impact).toBe('None');
  });

  it('should handle response with extra fields (ignore them)', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        improved_prompt: 'Better prompt',
        rationale: 'Reason',
        expected_impact: 'Impact',
        extra_field: 'Should be ignored',
        another_field: 123,
      })
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBe('Better prompt');
    expect(result.rationale).toBe('Reason');
    expect(result.expected_impact).toBe('Impact');
    expect(result).not.toHaveProperty('extra_field');
  });

  it('should handle network timeout error', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ETIMEDOUT: Connection timed out')
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('ETIMEDOUT');
  });

  it('should handle rate limit error', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('429: Too Many Requests'));

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('429');
  });

  it('should handle model not found error', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Model model-1 not found'));

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('not found');
  });

  it('should handle generic Error object', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Something went wrong'));

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toBe('Something went wrong');
  });

  it('should handle non-Error rejection', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockRejectedValue('String error');

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('Unknown error');
  });

  it('should handle very long improved_prompt (>10000 chars)', async () => {
    const veryLongPrompt = 'A'.repeat(15000);
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        improved_prompt: veryLongPrompt,
        rationale: 'Very detailed',
        expected_impact: 'Significant',
      })
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toBe(veryLongPrompt);
    expect(result.improved_prompt?.length).toBe(15000);
  });

  it('should handle unicode characters in response', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        improved_prompt: 'Evaluate 评估 качество 🎯',
        rationale: 'Added multilingual support',
        expected_impact: 'Better global coverage',
      })
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toContain('评估');
    expect(result.improved_prompt).toContain('качество');
    expect(result.improved_prompt).toContain('🎯');
  });

  it('should handle escaped quotes in improved_prompt', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        improved_prompt: 'Evaluate if output "matches" the expected result',
        rationale: 'Clarified matching criteria',
        expected_impact: 'Reduced ambiguity',
      })
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toContain('"matches"');
  });

  it('should handle newlines and formatting in improved_prompt', async () => {
    (callModel as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({
        improved_prompt: 'Evaluate:\n1. Accuracy\n2. Completeness\n3. Clarity',
        rationale: 'Structured criteria',
        expected_impact: 'More consistent evaluations',
      })
    );

    const result = await refineJudgePrompt(baseContext, 'model-1');

    expect(result.improved_prompt).toContain('\n1. Accuracy');
    expect(result.improved_prompt).toContain('\n2. Completeness');
  });
});
