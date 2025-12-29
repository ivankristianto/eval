/**
 * Standard Error Codes for LLM-as-a-Judge System
 *
 * This module defines standardized error codes and factory functions for all API endpoints.
 * Error responses follow the format:
 * {
 *   error: string,           // Human-readable error message
 *   code: string,            // Machine-readable error code
 *   details?: unknown,       // Additional error context
 *   timestamp: string        // ISO 8601 timestamp
 * }
 *
 * @see {@link https://github.com/anthropics/eval-ai-models/tree/main/specs/007-llm-as-judge}
 */

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: unknown;
  timestamp: string;
}

/**
 * All error codes used in the LLM-as-a-Judge system
 */
export enum ErrorCode {
  // Model and Validation Errors
  MODEL_SEPARATION_VIOLATION = 'MODEL_SEPARATION_VIOLATION',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_INACTIVE = 'MODEL_INACTIVE',
  INVALID_PROVIDER = 'INVALID_PROVIDER',

  // CSV Upload Errors
  CSV_SIZE_INVALID = 'CSV_SIZE_INVALID',
  CSV_FORMAT_INVALID = 'CSV_FORMAT_INVALID',
  CSV_UPLOAD_FAILED = 'CSV_UPLOAD_FAILED',
  DUPLICATE_ROWS = 'DUPLICATE_ROWS',
  EMPTY_FILE = 'EMPTY_FILE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // Training Data Errors
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  INCOMPLETE_FEEDBACK = 'INCOMPLETE_FEEDBACK',

  // Persona and State Errors
  PERSONA_NOT_FOUND = 'PERSONA_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  DUPLICATE_PERSONA_NAME = 'DUPLICATE_PERSONA_NAME',

  // Training Session Errors
  ITERATION_IN_PROGRESS = 'ITERATION_IN_PROGRESS',
  CALCULATION_IN_PROGRESS = 'CALCULATION_IN_PROGRESS',
  TRAINING_ALREADY_ACTIVE = 'TRAINING_ALREADY_ACTIVE',
  TRAINING_NOT_STARTED = 'TRAINING_NOT_STARTED',
  CANNOT_CANCEL = 'CANNOT_CANCEL',
  CANNOT_UPDATE = 'CANNOT_UPDATE',
  CANNOT_DELETE = 'CANNOT_DELETE',

  // Iteration and Review Errors
  ITERATION_NOT_FOUND = 'ITERATION_NOT_FOUND',
  DECISION_NOT_FOUND = 'DECISION_NOT_FOUND',
  FEEDBACK_EXISTS = 'FEEDBACK_EXISTS',
  INVALID_REVIEW_STATE = 'INVALID_REVIEW_STATE',

  // API Errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
}

/**
 * Error code details with default messages
 */
export const ERROR_CODE_DETAILS: Record<ErrorCode, { message: string; description: string }> = {
  // Model and Validation Errors
  [ErrorCode.MODEL_SEPARATION_VIOLATION]: {
    message: 'Task, Judge, and Prompt Engineer models must be from different providers',
    description: 'The system requires strict model separation to prevent bias from the same model evaluating its own outputs.',
  },
  [ErrorCode.MODEL_NOT_FOUND]: {
    message: 'Model not found',
    description: 'The specified model ID does not exist in the system.',
  },
  [ErrorCode.MODEL_INACTIVE]: {
    message: 'Model is not active or does not exist',
    description: 'The specified model is disabled and cannot be used for training.',
  },
  [ErrorCode.INVALID_PROVIDER]: {
    message: 'Invalid model provider',
    description: 'The specified provider is not supported. Must be one of: openai, anthropic, google.',
  },

  // CSV Upload Errors
  [ErrorCode.CSV_SIZE_INVALID]: {
    message: 'CSV must contain between 10 and 200 rows',
    description: 'Training data must have at least 10 pairs and no more than 200 pairs per session.',
  },
  [ErrorCode.CSV_FORMAT_INVALID]: {
    message: 'CSV format is invalid',
    description: 'The CSV file is missing required columns or has malformed rows.',
  },
  [ErrorCode.CSV_UPLOAD_FAILED]: {
    message: 'CSV upload failed',
    description: 'An error occurred while uploading or processing the CSV file.',
  },
  [ErrorCode.DUPLICATE_ROWS]: {
    message: 'CSV contains duplicate rows',
    description: 'The CSV file contains duplicate input/output pairs.',
  },
  [ErrorCode.EMPTY_FILE]: {
    message: 'File is empty or corrupted',
    description: 'The uploaded file is too small to be valid (less than 10 bytes).',
  },
  [ErrorCode.INVALID_FILE_TYPE]: {
    message: 'Only CSV files are accepted',
    description: 'The uploaded file does not have a .csv extension.',
  },

  // Training Data Errors
  [ErrorCode.INSUFFICIENT_DATA]: {
    message: 'Insufficient training data',
    description: 'At least 10 training pairs are required to start training.',
  },
  [ErrorCode.INCOMPLETE_FEEDBACK]: {
    message: 'Incomplete feedback for iteration',
    description: 'Iteration 1 requires 100% human review before metrics can be calculated.',
  },

  // Persona and State Errors
  [ErrorCode.PERSONA_NOT_FOUND]: {
    message: 'Persona not found',
    description: 'The specified persona ID does not exist.',
  },
  [ErrorCode.INVALID_STATUS_TRANSITION]: {
    message: 'Invalid persona status transition',
    description: 'The requested status transition is not allowed.',
  },
  [ErrorCode.DUPLICATE_PERSONA_NAME]: {
    message: 'Persona name already exists',
    description: 'A persona with this name already exists. Please choose a unique name.',
  },

  // Training Session Errors
  [ErrorCode.ITERATION_IN_PROGRESS]: {
    message: 'Cannot start new iteration while one is running',
    description: 'An iteration is already in progress for this persona.',
  },
  [ErrorCode.CALCULATION_IN_PROGRESS]: {
    message: 'Metrics calculation is already in progress',
    description: 'A metrics calculation is already running for this iteration.',
  },
  [ErrorCode.TRAINING_ALREADY_ACTIVE]: {
    message: 'Training is already active',
    description: 'A training session is already in progress or paused.',
  },
  [ErrorCode.TRAINING_NOT_STARTED]: {
    message: 'Training has not been started',
    description: 'No active training session found for this persona.',
  },
  [ErrorCode.CANNOT_CANCEL]: {
    message: 'Cannot cancel completed evaluation',
    description: 'The evaluation has already completed or failed and cannot be cancelled.',
  },
  [ErrorCode.CANNOT_UPDATE]: {
    message: 'Cannot update model',
    description: 'The model is being used and cannot be updated.',
  },
  [ErrorCode.CANNOT_DELETE]: {
    message: 'Cannot delete model',
    description: 'The model has existing evaluation results and cannot be deleted.',
  },

  // Iteration and Review Errors
  [ErrorCode.ITERATION_NOT_FOUND]: {
    message: 'Iteration not found',
    description: 'The specified iteration does not exist for this persona.',
  },
  [ErrorCode.DECISION_NOT_FOUND]: {
    message: 'Judge decision not found',
    description: 'The specified judge decision ID does not exist.',
  },
  [ErrorCode.FEEDBACK_EXISTS]: {
    message: 'Feedback already exists for this decision',
    description: 'Human review feedback has already been provided for this decision.',
  },
  [ErrorCode.INVALID_REVIEW_STATE]: {
    message: 'Invalid review state',
    description: 'The review page is not in a valid state for this operation.',
  },

  // API Errors
  [ErrorCode.INVALID_REQUEST]: {
    message: 'Invalid request',
    description: 'The request is malformed or missing required parameters.',
  },
  [ErrorCode.VALIDATION_ERROR]: {
    message: 'Validation failed',
    description: 'The request data failed validation.',
  },
  [ErrorCode.INTERNAL_ERROR]: {
    message: 'Internal server error',
    description: 'An unexpected error occurred on the server.',
  },
  [ErrorCode.NOT_FOUND]: {
    message: 'Resource not found',
    description: 'The requested resource does not exist.',
  },
  [ErrorCode.CONFLICT]: {
    message: 'Resource conflict',
    description: 'The request conflicts with the current state of the resource.',
  },
};

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: unknown,
  customMessage?: string
): ErrorResponse {
  return {
    error: customMessage || ERROR_CODE_DETAILS[code].message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a model separation violation error
 */
export function modelSeparationViolation(details?: unknown): ErrorResponse {
  return createErrorResponse(ErrorCode.MODEL_SEPARATION_VIOLATION, details);
}

/**
 * Create a CSV size validation error
 */
export function csvSizeInvalid(min: number, max: number, actual: number): ErrorResponse {
  return createErrorResponse(ErrorCode.CSV_SIZE_INVALID, {
    min,
    max,
    actual,
    requirement: `CSV must contain between ${min} and ${max} rows, but has ${actual} rows.`,
  });
}

/**
 * Create a CSV format validation error
 */
export function csvFormatInvalid(details?: unknown): ErrorResponse {
  return createErrorResponse(ErrorCode.CSV_FORMAT_INVALID, details);
}

/**
 * Create an insufficient data error
 */
export function insufficientData(required: number, actual: number): ErrorResponse {
  return createErrorResponse(ErrorCode.INSUFFICIENT_DATA, {
    required,
    actual,
    requirement: `At least ${required} training pairs required, but only ${actual} found.`,
  });
}

/**
 * Create a persona not found error
 */
export function personaNotFound(id: string): ErrorResponse {
  return createErrorResponse(ErrorCode.PERSONA_NOT_FOUND, {
    persona_id: id,
  });
}

/**
 * Create an invalid status transition error
 */
export function invalidStatusTransition(
  from: string,
  to: string,
  validTransitions: string[]
): ErrorResponse {
  return createErrorResponse(ErrorCode.INVALID_STATUS_TRANSITION, {
    from,
    to,
    validTransitions,
  });
}

/**
 * Create a training already active error
 */
export function trainingAlreadyActive(status: string, currentIteration?: number): ErrorResponse {
  return createErrorResponse(ErrorCode.TRAINING_ALREADY_ACTIVE, {
    status,
    current_iteration: currentIteration,
    message: `Training is already ${status}. Please pause or wait for completion before starting a new session.`,
  });
}

/**
 * Create an incomplete feedback error
 */
export function incompleteFeedback(required: number, provided: number): ErrorResponse {
  return createErrorResponse(ErrorCode.INCOMPLETE_FEEDBACK, {
    required,
    provided,
    message: `Iteration 1 requires 100% human review (${required} decisions), but only ${provided} have been reviewed.`,
  });
}

/**
 * Create an iteration in progress error
 */
export function iterationInProgress(iterationNumber: number): ErrorResponse {
  return createErrorResponse(ErrorCode.ITERATION_IN_PROGRESS, {
    current_iteration: iterationNumber,
    message: `Iteration ${iterationNumber} is already in progress. Please wait for it to complete.`,
  });
}

/**
 * Export error codes for use in other modules
 */
export default {
  ErrorCode,
  ERROR_CODE_DETAILS,
  createErrorResponse,
  modelSeparationViolation,
  csvSizeInvalid,
  csvFormatInvalid,
  insufficientData,
  personaNotFound,
  invalidStatusTransition,
  trainingAlreadyActive,
  incompleteFeedback,
  iterationInProgress,
};
