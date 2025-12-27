/**
 * Error classes for LLM-as-Judge training system
 * Provides specific error types for different failure modes
 */

/**
 * Base error class for all training-related errors
 */
export class TrainingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TrainingError';
  }
}

/**
 * Error when model separation validation fails
 * Thrown when task, judge, and prompt engineer models are not from different providers
 */
export class ModelSeparationError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'MODEL_SEPARATION_ERROR', details);
    this.name = 'ModelSeparationError';
  }
}

/**
 * Error when CSV validation fails
 * Thrown for invalid CSV format, wrong columns, or constraint violations
 */
export class CSVValidationError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'CSV_VALIDATION_ERROR', details);
    this.name = 'CSVValidationError';
  }
}

/**
 * Error when training state is invalid for requested operation
 * Thrown when trying to start training without data, or resume when not paused
 */
export class TrainingStateError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'TRAINING_STATE_ERROR', details);
    this.name = 'TrainingStateError';
  }
}

/**
 * Error when metrics calculation fails
 * Thrown when human feedback is incomplete or metrics computation encounters edge cases
 */
export class MetricsCalculationError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'METRICS_CALCULATION_ERROR', details);
    this.name = 'MetricsCalculationError';
  }
}

/**
 * Error when LLM API call fails
 * Thrown for model API failures (rate limits, timeouts, parsing errors)
 */
export class LLMAPIError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'LLM_API_ERROR', details);
    this.name = 'LLMAPIError';
  }
}

/**
 * Error when prompt refinement fails
 * Thrown when prompt engineer LLM fails to generate improved prompt
 */
export class PromptRefinementError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROMPT_REFINEMENT_ERROR', details);
    this.name = 'PromptRefinementError';
  }
}

/**
 * Error when database transaction fails
 * Thrown for constraint violations, FK errors, or transaction rollbacks
 */
export class DatabaseError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

/**
 * Error when validation fails
 * Generic validation error for input validation
 */
export class ValidationError extends TrainingError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Convert error to API error response format.
 * @param error - The caught error object
 * @returns Standardized error response object
 */
export function toErrorResponse(error: Error): {
  error: string;
  code: string;
  details?: unknown;
} {
  if (error instanceof TrainingError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
    };
  }

  // Generic error
  return {
    error: error.message || 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  };
}

/**
 * Check if error is a specific training error type.
 * @param error - Unknown error object
 * @returns True if it is a TrainingError
 */
export function isTrainingError(error: unknown): error is TrainingError {
  return error instanceof TrainingError;
}

/**
 * Check if error is a ModelSeparationError.
 * @param error - Unknown error object
 * @returns True if it is a ModelSeparationError
 */
export function isModelSeparationError(error: unknown): error is ModelSeparationError {
  return error instanceof ModelSeparationError;
}

/**
 * Check if error is a CSVValidationError.
 * @param error - Unknown error object
 * @returns True if it is a CSVValidationError
 */
export function isCSVValidationError(error: unknown): error is CSVValidationError {
  return error instanceof CSVValidationError;
}

/**
 * Check if error is a TrainingStateError.
 * @param error - Unknown error object
 * @returns True if it is a TrainingStateError
 */
export function isTrainingStateError(error: unknown): error is TrainingStateError {
  return error instanceof TrainingStateError;
}

/**
 * Check if error is a MetricsCalculationError.
 * @param error - Unknown error object
 * @returns True if it is a MetricsCalculationError
 */
export function isMetricsCalculationError(error: unknown): error is MetricsCalculationError {
  return error instanceof MetricsCalculationError;
}

/**
 * Check if error is a LLMAPIError.
 * @param error - Unknown error object
 * @returns True if it is a LLMAPIError
 */
export function isLLMAPIError(error: unknown): error is LLMAPIError {
  return error instanceof LLMAPIError;
}

/**
 * Check if error is a PromptRefinementError.
 * @param error - Unknown error object
 * @returns True if it is a PromptRefinementError
 */
export function isPromptRefinementError(error: unknown): error is PromptRefinementError {
  return error instanceof PromptRefinementError;
}

/**
 * Check if error is a DatabaseError.
 * @param error - Unknown error object
 * @returns True if it is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Check if error is a ValidationError.
 * @param error - Unknown error object
 * @returns True if it is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
