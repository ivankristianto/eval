/**
 * API Error Code Standardization Tests
 *
 * Tests for standardized error code definitions and factory functions.
 *
 * Standard Error Response Format:
 * {
 *   error: string,           // Human-readable error message
 *   code: string,            // Machine-readable error code (ErrorCode enum)
 *   details?: object,        // Additional error context
 *   timestamp: string        // ISO 8601 timestamp
 * }
 *
 * @see {@link https://github.com/anthropics/eval-ai-models/tree/main/specs/007-llm-as-judge}
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '@lib/error-codes';

describe('API Error Response Standardization', () => {
  describe('ErrorCode Enum', () => {
    it('should have all required error codes defined', () => {
      // Model and Validation Errors
      expect(ErrorCode.MODEL_SEPARATION_VIOLATION).toBeDefined();
      expect(ErrorCode.MODEL_NOT_FOUND).toBeDefined();
      expect(ErrorCode.MODEL_INACTIVE).toBeDefined();
      expect(ErrorCode.INVALID_PROVIDER).toBeDefined();

      // CSV Upload Errors
      expect(ErrorCode.CSV_SIZE_INVALID).toBeDefined();
      expect(ErrorCode.CSV_FORMAT_INVALID).toBeDefined();
      expect(ErrorCode.CSV_UPLOAD_FAILED).toBeDefined();
      expect(ErrorCode.DUPLICATE_ROWS).toBeDefined();
      expect(ErrorCode.EMPTY_FILE).toBeDefined();
      expect(ErrorCode.INVALID_FILE_TYPE).toBeDefined();

      // Training Data Errors
      expect(ErrorCode.INSUFFICIENT_DATA).toBeDefined();
      expect(ErrorCode.INCOMPLETE_FEEDBACK).toBeDefined();

      // Persona and State Errors
      expect(ErrorCode.PERSONA_NOT_FOUND).toBeDefined();
      expect(ErrorCode.INVALID_STATUS_TRANSITION).toBeDefined();
      expect(ErrorCode.DUPLICATE_PERSONA_NAME).toBeDefined();

      // Training Session Errors
      expect(ErrorCode.ITERATION_IN_PROGRESS).toBeDefined();
      expect(ErrorCode.TRAINING_ALREADY_ACTIVE).toBeDefined();
      expect(ErrorCode.TRAINING_NOT_STARTED).toBeDefined();
      expect(ErrorCode.CANNOT_CANCEL).toBeDefined();
      expect(ErrorCode.CANNOT_UPDATE).toBeDefined();
      expect(ErrorCode.CANNOT_DELETE).toBeDefined();

      // Iteration and Review Errors
      expect(ErrorCode.ITERATION_NOT_FOUND).toBeDefined();
      expect(ErrorCode.DECISION_NOT_FOUND).toBeDefined();
      expect(ErrorCode.FEEDBACK_EXISTS).toBeDefined();
      expect(ErrorCode.INVALID_REVIEW_STATE).toBeDefined();

      // API Errors
      expect(ErrorCode.INVALID_REQUEST).toBeDefined();
      expect(ErrorCode.VALIDATION_ERROR).toBeDefined();
      expect(ErrorCode.INTERNAL_ERROR).toBeDefined();
      expect(ErrorCode.NOT_FOUND).toBeDefined();
      expect(ErrorCode.CONFLICT).toBeDefined();
    });

    it('should have unique error code values', () => {
      const values = Object.values(ErrorCode);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });
  });

  describe('ERROR_CODE_DETAILS Mapping', () => {
    it('should have details for all error codes', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(ERROR_CODE_DETAILS[code]).toBeDefined();
        expect(ERROR_CODE_DETAILS[code].message).toBeDefined();
        expect(ERROR_CODE_DETAILS[code].description).toBeDefined();
      }
    });

    it('should have non-empty messages for all error codes', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(ERROR_CODE_DETAILS[code].message.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty descriptions for all error codes', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(ERROR_CODE_DETAILS[code].description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with required fields', () => {
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND);

      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('timestamp');
      expect(response.error).toBe(ERROR_CODE_DETAILS[ErrorCode.MODEL_NOT_FOUND].message);
      expect(response.code).toBe(ErrorCode.MODEL_NOT_FOUND);
    });

    it('should include details when provided', () => {
      const details = { model_id: 'test-model' };
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND, details);

      expect(response.details).toEqual(details);
    });

    it('should not include details when not provided', () => {
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND);

      expect(response.details).toBeUndefined();
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom error message';
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND, undefined, customMessage);

      expect(response.error).toBe(customMessage);
    });

    it('should generate ISO 8601 timestamp', () => {
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND);
      const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      expect(response.timestamp).toMatch(timestampPattern);
    });

    it('should parse as valid Date', () => {
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND);
      const date = new Date(response.timestamp);

      expect(date.getTime()).not.toBeNaN();
    });
  });

  describe('Factory Functions', () => {
    describe('modelSeparationViolation', () => {
      it('should create MODEL_SEPARATION_VIOLATION error', () => {
        const response = modelSeparationViolation();

        expect(response.code).toBe(ErrorCode.MODEL_SEPARATION_VIOLATION);
        expect(response.error).toBe(ERROR_CODE_DETAILS[ErrorCode.MODEL_SEPARATION_VIOLATION].message);
        expect(response.timestamp).toBeDefined();
      });

      it('should include details when provided', () => {
        const details = { task_model: 'gpt-4', judge_model: 'gpt-4' };
        const response = modelSeparationViolation(details);

        expect(response.details).toEqual(details);
      });
    });

    describe('csvSizeInvalid', () => {
      it('should create CSV_SIZE_INVALID error with min, max, actual', () => {
        const response = csvSizeInvalid(10, 200, 5);

        expect(response.code).toBe(ErrorCode.CSV_SIZE_INVALID);
        expect(response.details).toEqual({
          min: 10,
          max: 200,
          actual: 5,
          requirement: 'CSV must contain between 10 and 200 rows, but has 5 rows.',
        });
      });
    });

    describe('csvFormatInvalid', () => {
      it('should create CSV_FORMAT_INVALID error', () => {
        const response = csvFormatInvalid({ row: 5, error: 'Missing column' });

        expect(response.code).toBe(ErrorCode.CSV_FORMAT_INVALID);
        expect(response.details).toEqual({ row: 5, error: 'Missing column' });
      });
    });

    describe('insufficientData', () => {
      it('should create INSUFFICIENT_DATA error with required and actual counts', () => {
        const response = insufficientData(10, 5);

        expect(response.code).toBe(ErrorCode.INSUFFICIENT_DATA);
        expect(response.details).toEqual({
          required: 10,
          actual: 5,
          requirement: 'At least 10 training pairs required, but only 5 found.',
        });
      });
    });

    describe('personaNotFound', () => {
      it('should create PERSONA_NOT_FOUND error with persona_id', () => {
        const personaId = 'test-persona-id';
        const response = personaNotFound(personaId);

        expect(response.code).toBe(ErrorCode.PERSONA_NOT_FOUND);
        expect(response.details).toEqual({ persona_id: personaId });
      });
    });

    describe('invalidStatusTransition', () => {
      it('should create INVALID_STATUS_TRANSITION error with transition details', () => {
        const response = invalidStatusTransition('draft', 'trained', ['training']);

        expect(response.code).toBe(ErrorCode.INVALID_STATUS_TRANSITION);
        expect(response.details).toEqual({
          from: 'draft',
          to: 'trained',
          validTransitions: ['training'],
        });
      });
    });

    describe('trainingAlreadyActive', () => {
      it('should create TRAINING_ALREADY_ACTIVE error with status and iteration', () => {
        const response = trainingAlreadyActive('paused', 3);

        expect(response.code).toBe(ErrorCode.TRAINING_ALREADY_ACTIVE);
        expect(response.details).toEqual({
          status: 'paused',
          current_iteration: 3,
          message: 'Training is already paused. Please pause or wait for completion before starting a new session.',
        });
      });
    });

    describe('incompleteFeedback', () => {
      it('should create INCOMPLETE_FEEDBACK error with required and provided counts', () => {
        const response = incompleteFeedback(10, 5);

        expect(response.code).toBe(ErrorCode.INCOMPLETE_FEEDBACK);
        expect(response.details).toEqual({
          required: 10,
          provided: 5,
          message: 'Iteration 1 requires 100% human review (10 decisions), but only 5 have been reviewed.',
        });
      });
    });

    describe('iterationInProgress', () => {
      it('should create ITERATION_IN_PROGRESS error with iteration number', () => {
        const response = iterationInProgress(2);

        expect(response.code).toBe(ErrorCode.ITERATION_IN_PROGRESS);
        expect(response.details).toEqual({
          current_iteration: 2,
          message: 'Iteration 2 is already in progress. Please wait for it to complete.',
        });
      });
    });
  });

  describe('Error Response Format Validation', () => {
    function validateErrorResponse(body: unknown): void {
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('timestamp');

      // Validate timestamp is ISO 8601 format
      const timestamp = (body as { timestamp: string }).timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }

    it('should validate format for all error codes', () => {
      for (const code of Object.values(ErrorCode)) {
        const response = createErrorResponse(code);
        validateErrorResponse(response);
      }
    });

    it('should use consistent error code format', () => {
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND);
      expect(typeof response.code).toBe('string');
      expect(response.code).toBe(ErrorCode.MODEL_NOT_FOUND);
    });

    it('should include actionable details in error responses', () => {
      const response = csvSizeInvalid(10, 200, 5);
      expect(response.details).toBeDefined();
      expect(typeof response.details).toBe('object');
    });
  });

  describe('Timestamp Consistency', () => {
    it('should include ISO 8601 timestamp in all error responses', () => {
      const responses = [
        createErrorResponse(ErrorCode.MODEL_NOT_FOUND),
        modelSeparationViolation(),
        csvSizeInvalid(10, 200, 5),
        insufficientData(10, 5),
      ];

      for (const response of responses) {
        const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(response.timestamp).toMatch(timestampPattern);
      }
    });

    it('should generate timestamps within reasonable time range', () => {
      const before = Date.now();
      const response = createErrorResponse(ErrorCode.MODEL_NOT_FOUND);
      const after = Date.now();

      const timestamp = new Date(response.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before - 1000); // Allow 1s tolerance
      expect(timestamp).toBeLessThanOrEqual(after + 1000);
    });
  });
});
