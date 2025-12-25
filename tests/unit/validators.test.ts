import { describe, expect, it } from 'vitest';
import {
  validateCreateEvaluation,
  validateCreateModel,
  validateCreateTemplate,
  validateUpdateModel,
  validateSystemPrompt,
  validateTemperature,
} from '../../src/lib/validators';

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

  it('rejects empty api_key updates', () => {
    const result = validateUpdateModel({ api_key: '  ' });

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
