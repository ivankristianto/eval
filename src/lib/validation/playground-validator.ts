/**
 * Validation for playground API endpoints
 */

import type { ValidationResult } from './validators';

/**
 * Request body for POST /api/playground/run
 */
export interface PlaygroundRunRequest {
  personaId: string;
  pairId: string;
  taskPrompt?: string;
  judgePrompt?: string;
}

/**
 * Validates a playground run request
 * @param data - Raw request body
 * @returns Validation result
 */
export function validatePlaygroundRun(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'Request body must be a valid JSON object',
        field: 'body',
      },
    };
  }

  const body = data as Record<string, unknown>;

  // Validate personaId
  if (!body.personaId || typeof body.personaId !== 'string') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'personaId is required and must be a string',
        field: 'personaId',
      },
    };
  }

  // Validate pairId
  if (!body.pairId || typeof body.pairId !== 'string') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'pairId is required and must be a string',
        field: 'pairId',
      },
    };
  }

  // Validate optional taskPrompt
  if (body.taskPrompt !== undefined && typeof body.taskPrompt !== 'string') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'taskPrompt must be a string if provided',
        field: 'taskPrompt',
      },
    };
  }

  // Validate optional judgePrompt
  if (body.judgePrompt !== undefined && typeof body.judgePrompt !== 'string') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'judgePrompt must be a string if provided',
        field: 'judgePrompt',
      },
    };
  }

  // Check that at least personaId or pairId is not empty
  if (body.personaId.trim() === '') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'personaId cannot be empty',
        field: 'personaId',
      },
    };
  }

  if (body.pairId.trim() === '') {
    return {
      valid: false,
      error: {
        error: 'INVALID_INPUT',
        message: 'pairId cannot be empty',
        field: 'pairId',
      },
    };
  }

  return { valid: true };
}
