import { describe, expect, it } from 'vitest';
import {
  validateCreateEvaluation,
  validateCreateModel,
  validateCreateTemplate,
  validateUpdateModel,
  validateSystemPrompt,
  validateTemperature,
  isValidRating,
  parseRating,
} from '@lib/validation/validators';

const validUuid = '11111111-1111-4111-8111-111111111111';

describe('validateCreateModel', () => {
  it('accepts valid input', () => {
    const result = validateCreateModel({
      provider: 'openai',
      model_name: 'gpt-4',
      api_key: 'sk-test-123',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = validateCreateModel({});

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_PROVIDER');
  });

  it('rejects invalid providers', () => {
    const result = validateCreateModel({
      provider: 'invalid',
      model_name: 'gpt-4',
      api_key: 'sk-test-123',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_PROVIDER');
  });

  it('rejects model names longer than 100 characters', () => {
    const result = validateCreateModel({
      provider: 'openai',
      model_name: 'a'.repeat(101),
      api_key: 'sk-test-123',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('model_name');
  });
});

describe('validateUpdateModel', () => {
  it('accepts a valid partial update', () => {
    const result = validateUpdateModel({ is_active: false, notes: 'Update notes' });

    expect(result.valid).toBe(true);
  });

  it('rejects invalid field types', () => {
    const result = validateUpdateModel({ is_active: 'nope', notes: 12, api_key: 42 });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_INPUT');
  });

  it('accepts empty string api_key updates (for local providers)', () => {
    // Empty string is allowed for local providers to clear/remove an API key
    const result = validateUpdateModel({ api_key: '' });

    expect(result.valid).toBe(true);
  });

  it('rejects non-string api_key updates', () => {
    const result = validateUpdateModel({ api_key: 123 as unknown });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_API_KEY');
  });
});

describe('validateCreateEvaluation', () => {
  it('accepts valid input', () => {
    const result = validateCreateEvaluation({
      instruction: 'Summarize the article.',
      model_ids: [validUuid],
      rubric_type: 'exact_match',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects missing instructions', () => {
    const result = validateCreateEvaluation({
      model_ids: [validUuid],
      rubric_type: 'exact_match',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('instruction');
  });

  it('rejects instructions longer than 10,000 characters', () => {
    const result = validateCreateEvaluation({
      instruction: 'a'.repeat(10001),
      model_ids: [validUuid],
      rubric_type: 'exact_match',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('instruction');
  });

  it('rejects invalid rubric types', () => {
    const result = validateCreateEvaluation({
      instruction: 'Summarize the article.',
      model_ids: [validUuid],
      rubric_type: 'invalid',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_RUBRIC');
  });

  it('rejects partial credit without concepts', () => {
    const result = validateCreateEvaluation({
      instruction: 'Summarize the article.',
      model_ids: [validUuid],
      rubric_type: 'partial_credit',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('MISSING_RUBRIC_CONFIG');
  });

  it('rejects empty model selections', () => {
    const result = validateCreateEvaluation({
      instruction: 'Summarize the article.',
      model_ids: [],
      rubric_type: 'exact_match',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_MODEL_SELECTION');
  });

  it('rejects invalid model ids', () => {
    const result = validateCreateEvaluation({
      instruction: 'Summarize the article.',
      model_ids: ['not-a-uuid'],
      rubric_type: 'exact_match',
      expected_output: 'Summary',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_MODEL_SELECTION');
  });

  it('rejects missing expected output', () => {
    const result = validateCreateEvaluation({
      instruction: 'Summarize the article.',
      model_ids: [validUuid],
      rubric_type: 'exact_match',
      expected_output: ' ',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('expected_output');
  });
});

describe('validateCreateTemplate', () => {
  it('accepts valid template input', () => {
    const result = validateCreateTemplate({
      name: 'Template A',
      instruction_text: 'Explain the topic.',
      model_ids: [validUuid],
      accuracy_rubric: 'exact_match',
      expected_output: 'Expected output',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects missing name field', () => {
    const result = validateCreateTemplate({
      instruction_text: 'Explain the topic.',
      model_ids: [validUuid],
      accuracy_rubric: 'exact_match',
      expected_output: 'Expected output',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('name');
  });

  it('rejects names longer than 100 characters', () => {
    const result = validateCreateTemplate({
      name: 'a'.repeat(101),
      instruction_text: 'Explain the topic.',
      model_ids: [validUuid],
      accuracy_rubric: 'exact_match',
      expected_output: 'Expected output',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('name');
  });

  it('rejects invalid description types', () => {
    const result = validateCreateTemplate({
      name: 'Template A',
      description: 42,
      instruction_text: 'Explain the topic.',
      model_ids: [validUuid],
      accuracy_rubric: 'exact_match',
      expected_output: 'Expected output',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('description');
  });

  it('rejects non-object payloads', () => {
    const result = validateCreateTemplate('bad input');

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_INPUT');
  });
});

describe('validateCreateModel api key formats', () => {
  it('rejects invalid anthropic api key format', () => {
    const result = validateCreateModel({
      provider: 'anthropic',
      model_name: 'claude-3-opus',
      api_key: 'sk-123',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_API_KEY');
  });

  it('rejects short google api keys', () => {
    const result = validateCreateModel({
      provider: 'google',
      model_name: 'gemini-2.0',
      api_key: 'short',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_API_KEY');
  });

  it('rejects invalid openrouter api key format (not starting with sk-or-)', () => {
    const result = validateCreateModel({
      provider: 'openrouter',
      model_name: 'meta-llama/llama-3-70b',
      api_key: 'sk-123',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe('INVALID_API_KEY');
  });

  it('accepts valid openrouter api key format (starting with sk-or-)', () => {
    const result = validateCreateModel({
      provider: 'openrouter',
      model_name: 'meta-llama/llama-3-70b',
      api_key: 'sk-or-test-key-123',
    });

    expect(result.valid).toBe(true);
  });

  it('accepts empty api key for lmstudio (local provider)', () => {
    const result = validateCreateModel({
      provider: 'lmstudio',
      model_name: 'llama-3-8b',
      api_key: '',
    });

    expect(result.valid).toBe(true);
  });

  it('accepts empty api key for ollama (local provider)', () => {
    const result = validateCreateModel({
      provider: 'ollama',
      model_name: 'llama3',
      api_key: '',
    });

    expect(result.valid).toBe(true);
  });

  it('accepts omitting api_key for lmstudio (local provider)', () => {
    const result = validateCreateModel({
      provider: 'lmstudio',
      model_name: 'llama-3-8b',
    });

    expect(result.valid).toBe(true);
  });

  it('accepts omitting api_key for ollama (local provider)', () => {
    const result = validateCreateModel({
      provider: 'ollama',
      model_name: 'llama3',
    });

    expect(result.valid).toBe(true);
  });
});

describe('validateCreateModel new providers', () => {
  it('accepts openrouter provider', () => {
    const result = validateCreateModel({
      provider: 'openrouter',
      model_name: 'anthropic/claude-3-opus',
      api_key: 'sk-or-test-key-123',
    });

    expect(result.valid).toBe(true);
  });

  it('accepts lmstudio provider', () => {
    const result = validateCreateModel({
      provider: 'lmstudio',
      model_name: 'llama-3-8b',
      api_key: '',
    });

    expect(result.valid).toBe(true);
  });

  it('accepts ollama provider', () => {
    const result = validateCreateModel({
      provider: 'ollama',
      model_name: 'llama3',
      api_key: '',
    });

    expect(result.valid).toBe(true);
  });

  it('validates base_url format for local providers', () => {
    const result = validateCreateModel({
      provider: 'lmstudio',
      model_name: 'llama-3-8b',
      api_key: '',
      base_url: 'not-a-url',
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('base_url');
  });

  it('accepts valid base_url for local providers', () => {
    const result = validateCreateModel({
      provider: 'lmstudio',
      model_name: 'llama-3-8b',
      api_key: '',
      base_url: 'http://localhost:9999/v1',
    });

    expect(result.valid).toBe(true);
  });
});

describe('validateSystemPrompt', () => {
  it('accepts null (optional field)', () => {
    const result = validateSystemPrompt(null);
    expect(result.valid).toBe(true);
  });

  it('accepts undefined (optional field)', () => {
    const result = validateSystemPrompt(undefined);
    expect(result.valid).toBe(true);
  });

  it('accepts valid system prompt text', () => {
    const result = validateSystemPrompt('You are a helpful assistant');
    expect(result.valid).toBe(true);
  });

  it('accepts system prompt at boundary (4000 chars)', () => {
    const text4000 = 'a'.repeat(4000);
    const result = validateSystemPrompt(text4000);
    expect(result.valid).toBe(true);
  });

  it('rejects empty string', () => {
    const result = validateSystemPrompt('');
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('system_prompt');
    expect(result.error?.error).toBe('INVALID_INPUT');
  });

  it('rejects whitespace-only string', () => {
    const result = validateSystemPrompt('   ');
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('system_prompt');
    expect(result.error?.error).toBe('INVALID_INPUT');
  });

  it('rejects system prompt exceeding 4000 chars', () => {
    const text4001 = 'a'.repeat(4001);
    const result = validateSystemPrompt(text4001);
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('system_prompt');
    expect(result.error?.error).toBe('INVALID_INPUT');
    expect(result.error?.message).toContain('4,000 characters');
  });
});

describe('validateTemperature', () => {
  it('accepts null (will default to 0.3)', () => {
    const result = validateTemperature(null);
    expect(result.valid).toBe(true);
  });

  it('accepts undefined (will default to 0.3)', () => {
    const result = validateTemperature(undefined);
    expect(result.valid).toBe(true);
  });

  it('accepts temperature at lower boundary (0.0)', () => {
    const result = validateTemperature(0.0);
    expect(result.valid).toBe(true);
  });

  it('accepts temperature at upper boundary (2.0)', () => {
    const result = validateTemperature(2.0);
    expect(result.valid).toBe(true);
  });

  it('accepts temperature in valid range (0.1)', () => {
    const result = validateTemperature(0.1);
    expect(result.valid).toBe(true);
  });

  it('accepts temperature in valid range (1.5)', () => {
    const result = validateTemperature(1.5);
    expect(result.valid).toBe(true);
  });

  it('rejects temperature below 0.0 (-0.1)', () => {
    const result = validateTemperature(-0.1);
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('temperature');
    expect(result.error?.error).toBe('INVALID_INPUT');
  });

  it('rejects temperature above 2.0 (2.1)', () => {
    const result = validateTemperature(2.1);
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('temperature');
    expect(result.error?.error).toBe('INVALID_INPUT');
  });

  it('rejects NaN', () => {
    const result = validateTemperature(NaN);
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('temperature');
    expect(result.error?.error).toBe('INVALID_INPUT');
    expect(result.error?.message).toContain('valid number');
  });

  it('rejects non-numeric values (string)', () => {
    const result = validateTemperature('1.5' as unknown as number);
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('temperature');
    expect(result.error?.error).toBe('INVALID_INPUT');
  });
});

describe('isValidRating', () => {
  it('accepts "pass" rating', () => {
    expect(isValidRating('pass')).toBe(true);
  });

  it('accepts "fail" rating', () => {
    expect(isValidRating('fail')).toBe(true);
  });

  it('accepts null (unrated)', () => {
    expect(isValidRating(null)).toBe(true);
  });

  it('accepts undefined (unrated)', () => {
    expect(isValidRating(undefined)).toBe(true);
  });

  it('rejects invalid string values', () => {
    expect(isValidRating('pending')).toBe(false);
    expect(isValidRating('review')).toBe(false);
    expect(isValidRating('')).toBe(false);
    expect(isValidRating('Pass')).toBe(false); // case sensitive
    expect(isValidRating('FAIL')).toBe(false); // case sensitive
  });

  it('rejects non-string values', () => {
    expect(isValidRating(123)).toBe(false);
    expect(isValidRating(true)).toBe(false);
    expect(isValidRating(false)).toBe(false);
    expect(isValidRating({})).toBe(false);
    expect(isValidRating([])).toBe(false);
  });

  it('provides type narrowing for valid ratings', () => {
    const value = 'pass' as unknown;
    if (isValidRating(value)) {
      // TypeScript should know value is 'pass' | 'fail' | null | undefined
      expect(value === 'pass' || value === 'fail' || value === null || value === undefined).toBe(
        true
      );
    }
  });
});

describe('parseRating', () => {
  it('returns "pass" for valid pass rating', () => {
    expect(parseRating('pass')).toBe('pass');
  });

  it('returns "fail" for valid fail rating', () => {
    expect(parseRating('fail')).toBe('fail');
  });

  it('returns null for null (unrated)', () => {
    expect(parseRating(null)).toBe(null);
  });

  it('returns undefined for undefined', () => {
    expect(parseRating(undefined)).toBe(undefined);
  });

  it('returns undefined for invalid string values', () => {
    expect(parseRating('pending')).toBe(undefined);
    expect(parseRating('review')).toBe(undefined);
    expect(parseRating('')).toBe(undefined);
    expect(parseRating('Pass')).toBe(undefined); // case sensitive
  });

  it('returns undefined for non-string values', () => {
    expect(parseRating(123)).toBe(undefined);
    expect(parseRating(true)).toBe(undefined);
    expect(parseRating(false)).toBe(undefined);
    expect(parseRating({})).toBe(undefined);
    expect(parseRating([])).toBe(undefined);
  });

  it('works correctly in array map operations', () => {
    const data = [
      { id: 1, rating: 'pass' },
      { id: 2, rating: 'fail' },
      { id: 3, rating: null },
      { id: 4, rating: 'invalid' },
      { id: 5, rating: undefined },
    ];

    const result = data.map((item) => parseRating(item.rating));
    expect(result).toEqual(['pass', 'fail', null, undefined, undefined]);
  });
});
