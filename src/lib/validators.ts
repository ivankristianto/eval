// src/lib/validators.ts
// Input validation functions for AI Model Evaluation Framework

import type { Provider, RubricType, ApiError } from './types';

const VALID_PROVIDERS: Provider[] = ['openai', 'anthropic', 'google'];
const VALID_RUBRIC_TYPES: RubricType[] = ['exact_match', 'partial_credit', 'semantic_similarity'];
const MAX_INSTRUCTION_LENGTH = 10000;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

export interface ValidationResult {
  valid: boolean;
  error?: ApiError;
}

export function validateInstruction(instruction: unknown): ValidationResult {
  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'instruction must be a non-empty string',
        field: 'instruction',
      },
    };
  }

  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: `instruction must be max ${MAX_INSTRUCTION_LENGTH} characters`,
        field: 'instruction',
      },
    };
  }

  return { valid: true };
}

export function validateRubricType(rubricType: unknown): ValidationResult {
  if (!VALID_RUBRIC_TYPES.includes(rubricType as RubricType)) {
    return {
      valid: false,
      error: {
        error: 'INVALID_RUBRIC',
        message: `rubric_type must be one of: ${VALID_RUBRIC_TYPES.join(', ')}`,
        field: 'rubric_type',
      },
    };
  }

  return { valid: true };
}

export function validateModelIds(modelIds: unknown): ValidationResult {
  if (!Array.isArray(modelIds) || modelIds.length === 0) {
    return {
      valid: false,
      error: {
        error: 'INVALID_MODEL_SELECTION',
        message: 'At least one model must be selected',
        field: 'model_ids',
      },
    };
  }

  for (const id of modelIds) {
    if (typeof id !== 'string' || !isValidUuid(id)) {
      return {
        valid: false,
        error: {
          error: 'INVALID_MODEL_SELECTION',
          message: 'All model_ids must be valid UUIDs',
          field: 'model_ids',
        },
      };
    }
  }

  return { valid: true };
}

export function validateProvider(provider: unknown): ValidationResult {
  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    return {
      valid: false,
      error: {
        error: 'INVALID_PROVIDER',
        message: `provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
        field: 'provider',
      },
    };
  }

  return { valid: true };
}

export function validateApiKeyFormat(apiKey: unknown, provider: Provider): ValidationResult {
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'INVALID_API_KEY',
        message: 'API key must be a non-empty string',
        field: 'api_key',
      },
    };
  }

  // Provider-specific format validation
  switch (provider) {
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        return {
          valid: false,
          error: {
            error: 'INVALID_API_KEY',
            message: 'OpenAI API key must start with "sk-"',
            field: 'api_key',
            details: { provider: 'openai', reason: 'key does not match expected format' },
          },
        };
      }
      break;
    case 'anthropic':
      if (!apiKey.startsWith('sk-ant-')) {
        return {
          valid: false,
          error: {
            error: 'INVALID_API_KEY',
            message: 'Anthropic API key must start with "sk-ant-"',
            field: 'api_key',
            details: { provider: 'anthropic', reason: 'key does not match expected format' },
          },
        };
      }
      break;
    case 'google':
      // Google API keys don't have a specific prefix requirement
      if (apiKey.length < 10) {
        return {
          valid: false,
          error: {
            error: 'INVALID_API_KEY',
            message: 'Google API key appears too short',
            field: 'api_key',
            details: { provider: 'google', reason: 'key does not match expected format' },
          },
        };
      }
      break;
  }

  return { valid: true };
}

export function validateModelName(modelName: unknown): ValidationResult {
  if (typeof modelName !== 'string' || modelName.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'model_name must be a non-empty string',
        field: 'model_name',
      },
    };
  }

  if (modelName.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: `model_name must be max ${MAX_NAME_LENGTH} characters`,
        field: 'model_name',
      },
    };
  }

  return { valid: true };
}

export function validateTemplateName(name: unknown): ValidationResult {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'name must be a non-empty string',
        field: 'name',
      },
    };
  }

  if (name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: `name must be max ${MAX_NAME_LENGTH} characters`,
        field: 'name',
      },
    };
  }

  return { valid: true };
}

export function validateDescription(description: unknown): ValidationResult {
  if (description === undefined || description === null) {
    return { valid: true }; // Optional field
  }

  if (typeof description !== 'string') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'description must be a string',
        field: 'description',
      },
    };
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: `description must be max ${MAX_DESCRIPTION_LENGTH} characters`,
        field: 'description',
      },
    };
  }

  return { valid: true };
}

export function validatePartialCreditConcepts(
  concepts: unknown,
  rubricType: RubricType
): ValidationResult {
  if (rubricType !== 'partial_credit') {
    return { valid: true }; // Only required for partial_credit
  }

  if (!Array.isArray(concepts) || concepts.length === 0) {
    return {
      valid: false,
      error: {
        error: 'MISSING_RUBRIC_CONFIG',
        message: "partial_credit_concepts required when rubric_type is 'partial_credit'",
        field: 'partial_credit_concepts',
      },
    };
  }

  for (const concept of concepts) {
    if (typeof concept !== 'string' || concept.trim().length === 0) {
      return {
        valid: false,
        error: {
          error: 'INVALID_INPUT',
          message: 'All concepts must be non-empty strings',
          field: 'partial_credit_concepts',
        },
      };
    }
  }

  return { valid: true };
}

export function validateExpectedOutput(
  expectedOutput: unknown,
  _rubricType: RubricType
): ValidationResult {
  // Required for all rubric types
  if (typeof expectedOutput !== 'string' || expectedOutput.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'expected_output is required for accuracy comparison',
        field: 'expected_output',
      },
    };
  }

  return { valid: true };
}

export function validateUuid(id: unknown): ValidationResult {
  if (typeof id !== 'string' || !isValidUuid(id)) {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'Invalid UUID format',
        field: 'id',
      },
    };
  }

  return { valid: true };
}

// Helper function to validate UUID format
function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Composite validation for evaluation creation
export function validateCreateEvaluation(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'Request body must be a valid JSON object',
      },
    };
  }

  const body = data as Record<string, unknown>;

  const instructionResult = validateInstruction(body.instruction);
  if (!instructionResult.valid) return instructionResult;

  const rubricResult = validateRubricType(body.rubric_type);
  if (!rubricResult.valid) return rubricResult;

  const modelIdsResult = validateModelIds(body.model_ids);
  if (!modelIdsResult.valid) return modelIdsResult;

  const expectedOutputResult = validateExpectedOutput(
    body.expected_output,
    body.rubric_type as RubricType
  );
  if (!expectedOutputResult.valid) return expectedOutputResult;

  const conceptsResult = validatePartialCreditConcepts(
    body.partial_credit_concepts,
    body.rubric_type as RubricType
  );
  if (!conceptsResult.valid) return conceptsResult;

  return { valid: true };
}

// Composite validation for model creation
export function validateCreateModel(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'Request body must be a valid JSON object',
      },
    };
  }

  const body = data as Record<string, unknown>;

  const providerResult = validateProvider(body.provider);
  if (!providerResult.valid) return providerResult;

  const modelNameResult = validateModelName(body.model_name);
  if (!modelNameResult.valid) return modelNameResult;

  const apiKeyResult = validateApiKeyFormat(body.api_key, body.provider as Provider);
  if (!apiKeyResult.valid) return apiKeyResult;

  return { valid: true };
}

// Validation for partial updates to a model configuration
export function validateUpdateModel(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'Request body must be a valid JSON object',
      },
    };
  }

  const body = data as Record<string, unknown>;

  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'is_active must be a boolean',
        field: 'is_active',
      },
    };
  }

  if (body.notes !== undefined && typeof body.notes !== 'string') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'notes must be a string',
        field: 'notes',
      },
    };
  }

  if (body.api_key !== undefined) {
    if (typeof body.api_key !== 'string' || body.api_key.trim().length === 0) {
      return {
        valid: false,
        error: {
          error: 'INVALID_API_KEY',
          message: 'API key must be a non-empty string',
          field: 'api_key',
        },
      };
    }
  }

  return { valid: true };
}

// Composite validation for template creation
export function validateCreateTemplate(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'Request body must be a valid JSON object',
      },
    };
  }

  const body = data as Record<string, unknown>;

  const nameResult = validateTemplateName(body.name);
  if (!nameResult.valid) return nameResult;

  const descriptionResult = validateDescription(body.description);
  if (!descriptionResult.valid) return descriptionResult;

  const instructionResult = validateInstruction(body.instruction_text);
  if (!instructionResult.valid) return instructionResult;

  const rubricResult = validateRubricType(body.accuracy_rubric);
  if (!rubricResult.valid) return rubricResult;

  const modelIdsResult = validateModelIds(body.model_ids);
  if (!modelIdsResult.valid) return modelIdsResult;

  const expectedOutputResult = validateExpectedOutput(
    body.expected_output,
    body.accuracy_rubric as RubricType
  );
  if (!expectedOutputResult.valid) return expectedOutputResult;

  const conceptsResult = validatePartialCreditConcepts(
    body.partial_credit_concepts,
    body.accuracy_rubric as RubricType
  );
  if (!conceptsResult.valid) return conceptsResult;

  return { valid: true };
}
