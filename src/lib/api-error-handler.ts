/**
 * Centralized API error handler utility
 * Provides consistent error responses and HTTP status code mapping for all API endpoints
 */

import type { APIRoute } from 'astro';
import { toErrorResponse } from './training/deprecated/training-errors';

/**
 * HTTP status codes for different error types
 */
const ERROR_STATUS_CODES: Record<string, number> = {
  VALIDATION_ERROR: 400,
  MODEL_SEPARATION_ERROR: 400,
  CSV_VALIDATION_ERROR: 400,
  TRAINING_STATE_ERROR: 400,
  DUPLICATE_NAME: 400,
  INVALID_PARAMETER: 400,
  DATABASE_ERROR: 500,
  METRICS_CALCULATION_ERROR: 500,
  LLM_API_ERROR: 500,
  PROMPT_REFINEMENT_ERROR: 500,
  INTERNAL_ERROR: 500,
  NOT_FOUND: 404,
};

/**
 * Standard API error response structure
 */
export interface APIErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Create a standardized error response with appropriate HTTP status code
 * @param error - The caught error object
 * @returns Response with appropriate status code and error body
 */
export function createErrorResponse(error: unknown): Response {
  const errorResponse = toErrorResponse(error instanceof Error ? error : new Error(String(error)));
  const statusCode = ERROR_STATUS_CODES[errorResponse.code] ?? 500;

  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create a 400 Bad Request response
 * @param message - Error message
 * @param code - Error code (default: VALIDATION_ERROR)
 * @param details - Optional additional details
 * @returns Response with 400 status
 */
export function badRequest(
  message: string,
  code = 'VALIDATION_ERROR',
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code,
      details,
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create a 404 Not Found response
 * @param resource - The resource that was not found
 * @returns Response with 404 status
 */
export function notFound(resource = 'Resource'): Response {
  return new Response(
    JSON.stringify({
      error: `${resource} not found`,
      code: 'NOT_FOUND',
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create a 409 Conflict response
 * @param message - Error message
 * @param code - Error code (default: CONFLICT)
 * @param details - Optional additional details
 * @returns Response with 409 status
 */
export function conflict(message: string, code = 'CONFLICT', details?: unknown): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code,
      details,
    }),
    {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create a 500 Internal Server Error response
 * @param message - Error message
 * @param details - Optional additional details
 * @returns Response with 500 status
 */
export function internalError(message: string, details?: unknown): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: 'INTERNAL_ERROR',
      details,
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Wrap an API route handler with error handling
 * Automatically catches errors and returns appropriate error responses
 * @param handler - The API route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<T extends APIRoute>(handler: T): T {
  return async function (...args: unknown[]) {
    try {
      // @ts-expect-error - Dynamic spread of tuple type
      return await handler(...(args as Parameters<T>));
    } catch (error) {
      // Log error for monitoring
      console.error('API Error:', error);

      // Return standardized error response
      return createErrorResponse(error);
    }
  } as T;
}

/**
 * Parse JSON request body with error handling
 * @param request - The API request object
 * @returns Parsed JSON body or throws ValidationError
 */
export async function parseJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON in request body');
  }
}
