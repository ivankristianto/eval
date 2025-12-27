/**
 * Integration tests for prompt refinement with LLM
 * Tests the prompt engineer module with mocked LLM responses
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { refineJudgePrompt, type PromptRefinementResult } from '../../src/lib/prompt-engineer';
import type { FailureAnalysisContext } from '../../src/lib/failure-analysis';

// Mock the API clients
vi.mock('../../src/lib/api-clients', () => ({
  callModel: vi.fn(),
}));

import { callModel } from '../../src/lib/api-clients';

describe('Prompt Refinement Integration', () => {
  const mockFailureContext: FailureAnalysisContext = {
    current_metrics: {
      precision: 0.75,
      recall: 0.70,
      f1_score: 0.72,
      cohens_kappa: 0.65,
      accuracy: 0.73,
      confusion_matrix: { tp: 15, tn: 10, fp: 5, fn: 6 },
    },
    iteration_number: 2,
    false_positives: [
      {
        model_output: 'The answer is yes',
        expected_output: 'Yes, you can do that',
        why_it_should_have_disagreed: 'Too brief, lacks context',
      },
      {
        model_output: 'No',
        expected_output: 'No, that is not allowed',
        why_it_should_have_disagreed: 'Missing explanation',
      },
    ],
    false_negatives: [
      {
        model_output: 'Yes, you are allowed to do that',
        expected_output: 'Yes, you can do that',
        why_it_should_have_agreed: 'Semantically equivalent, just different wording',
      },
    ],
    correct_examples: [
      {
        model_output: 'Free shipping on orders over $50',
        expected_output: 'Yes, free shipping for orders above $50',
        decision: 'agree',
        reasoning: 'Semantically correct despite different wording',
      },
    ],
    current_prompt: 'Evaluate if the response is accurate and helpful',
    task_description: 'Customer support quality evaluation',
    evaluation_criteria: ['Accuracy', 'Helpfulness', 'Clarity'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully refine prompt with valid LLM response', async () => {
    const mockLLMResponse = {
      improved_prompt:
        'Evaluate if the response is semantically equivalent to the expected output. Focus on meaning rather than exact wording. The response should be complete, providing sufficient context and explanation.',
      rationale:
        'The judge is currently too strict on wording variations (false negatives) and too lenient on incomplete responses (false positives). The improved prompt emphasizes semantic equivalence while requiring completeness.',
      expected_impact:
        'This should reduce false positives by 30% (requiring more complete responses) and reduce false negatives by 40% (accepting semantic equivalence).',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockLLMResponse));

    const result = await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    expect(result.improved_prompt).toBe(mockLLMResponse.improved_prompt);
    expect(result.rationale).toBe(mockLLMResponse.rationale);
    expect(result.expected_impact).toBe(mockLLMResponse.expected_impact);
    expect(result.error).toBeUndefined();

    // Verify LLM was called with correct parameters
    expect(callModel).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(callModel).mock.calls[0];
    expect(callArgs[0]).toBe('model-engineer-1'); // modelId
    expect(callArgs[1]).toContain('F1 Score: 0.72'); // Metrics included
    expect(callArgs[1]).toContain('False Positives'); // Failure patterns included
    expect(callArgs[1]).toContain('Too brief, lacks context'); // Specific example included
  });

  it('should handle malformed JSON response from LLM', async () => {
    vi.mocked(callModel).mockResolvedValue('This is not JSON');

    const result = await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('Failed to parse');
    expect(result.rationale).toBeUndefined();
  });

  it('should handle LLM response missing required fields', async () => {
    const incompleteResponse = {
      improved_prompt: 'Better prompt',
      // Missing rationale and expected_impact
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(incompleteResponse));

    const result = await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    expect(result.improved_prompt).toBe('Better prompt');
    expect(result.rationale).toBeUndefined();
    expect(result.expected_impact).toBeUndefined();
  });

  it('should handle LLM API failures gracefully', async () => {
    vi.mocked(callModel).mockRejectedValue(new Error('API rate limit exceeded'));

    const result = await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    expect(result.improved_prompt).toBeNull();
    expect(result.error).toContain('API rate limit exceeded');
  });

  it('should include current metrics in prompt context', async () => {
    const mockResponse = {
      improved_prompt: 'Test',
      rationale: 'Test',
      expected_impact: 'Test',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockResponse));

    await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    const promptSent = vi.mocked(callModel).mock.calls[0][1];
    expect(promptSent).toContain('Precision: 0.75');
    expect(promptSent).toContain('Recall: 0.70');
    expect(promptSent).toContain('F1 Score: 0.72');
    expect(promptSent).toContain("Cohen's Kappa: 0.65");
  });

  it('should include false positive examples in prompt context', async () => {
    const mockResponse = {
      improved_prompt: 'Test',
      rationale: 'Test',
      expected_impact: 'Test',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockResponse));

    await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    const promptSent = vi.mocked(callModel).mock.calls[0][1];
    expect(promptSent).toContain('The answer is yes');
    expect(promptSent).toContain('Too brief, lacks context');
  });

  it('should include false negative examples in prompt context', async () => {
    const mockResponse = {
      improved_prompt: 'Test',
      rationale: 'Test',
      expected_impact: 'Test',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockResponse));

    await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    const promptSent = vi.mocked(callModel).mock.calls[0][1];
    expect(promptSent).toContain('Yes, you are allowed to do that');
    expect(promptSent).toContain('Semantically equivalent');
  });

  it('should include correct examples for few-shot learning', async () => {
    const mockResponse = {
      improved_prompt: 'Test',
      rationale: 'Test',
      expected_impact: 'Test',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockResponse));

    await refineJudgePrompt(mockFailureContext, 'model-engineer-1');

    const promptSent = vi.mocked(callModel).mock.calls[0][1];
    expect(promptSent).toContain('Free shipping on orders over $50');
    expect(promptSent).toContain('Semantically correct despite different wording');
  });

  it('should work with empty failure examples', async () => {
    const emptyContext: FailureAnalysisContext = {
      ...mockFailureContext,
      false_positives: [],
      false_negatives: [],
      correct_examples: [],
    };

    const mockResponse = {
      improved_prompt: 'Refined prompt without examples',
      rationale: 'Based on metrics alone',
      expected_impact: 'Should improve slightly',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockResponse));

    const result = await refineJudgePrompt(emptyContext, 'model-engineer-1');

    expect(result.improved_prompt).toBe(mockResponse.improved_prompt);
    expect(result.error).toBeUndefined();
  });
});
