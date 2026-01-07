/**
 * Training Data Upload API Endpoint
 * POST /api/personas/[id]/training/upload
 *
 * Uploads CSV file with training pairs and stores them in the database.
 */

import type { APIRoute } from 'astro';
import { getPersona } from '@lib/db/persona-db';
import { parseCSV } from '@lib/utils/csv-parser';
import { getDatabase } from '@lib/db';
import { randomUUID } from 'crypto';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Training:Upload');

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/personas/[id]/training/upload
 * Upload CSV file with training pairs
 *
 * Request body: multipart/form-data with 'file' field
 * Response: 201 with { count: number, pairs: TrainingPair[] }
 *          400 with { error: string, details: string[] }
 *          404 with { error: string }
 */
/**
 * POST /api/personas/:id/training/upload
 * Processes a CSV file upload containing training pairs.
 * Validates the CSV format and pair count before replacing existing pairs in a transaction.
 * @param root0
 * @param root0.params
 * @param root0.request
 * @returns {Promise<Response>}
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/training/upload',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_INPUT');
    }

    // Verify persona exists
    const persona = getPersona(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/upload`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Parse multipart form data
    const contentType = request.headers.get('content-type') || '';

    let fileContent: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/upload`,
          400,
          Date.now() - startTime
        );
        return badRequest(
          'No file provided. Expected multipart/form-data with "file" field.',
          'INVALID_INPUT'
        );
      }

      // Validate file size before processing
      if (file.size > MAX_FILE_SIZE) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/upload`,
          413,
          Date.now() - startTime
        );
        return badRequest(
          `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          'FILE_TOO_LARGE'
        );
      }

      fileContent = await file.text();

      // Double-check file content size after reading (for compressed content)
      if (fileContent.length > MAX_FILE_SIZE) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/upload`,
          413,
          Date.now() - startTime
        );
        return badRequest(
          `CSV content too large after processing. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          'CONTENT_TOO_LARGE'
        );
      }
    } else if (contentType.includes('application/json')) {
      // Handle JSON payload with CSV content
      const body = await request.json();
      fileContent = body.csv || body.content || '';

      if (!fileContent) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/upload`,
          400,
          Date.now() - startTime
        );
        return badRequest(
          'No CSV content provided. Expected "csv" or "content" field in JSON body.',
          'INVALID_INPUT'
        );
      }

      // Validate content size
      if (fileContent.length > MAX_FILE_SIZE) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/upload`,
          413,
          Date.now() - startTime
        );
        return badRequest(
          `CSV content too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          'CONTENT_TOO_LARGE'
        );
      }
    } else {
      // Assume raw CSV content
      fileContent = await request.text();

      // Validate content size for raw text
      if (fileContent.length > MAX_FILE_SIZE) {
        logger.logApiRequest(
          'POST',
          `/api/personas/${id}/training/upload`,
          413,
          Date.now() - startTime
        );
        return badRequest(
          `CSV content too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
          'CONTENT_TOO_LARGE'
        );
      }
    }

    // Parse CSV
    const { rows, errors } = parseCSV(fileContent);

    if (errors.length > 0) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/upload`,
        400,
        Date.now() - startTime
      );
      return badRequest('CSV validation failed', 'CSV_VALIDATION_ERROR', errors);
    }

    // Insert training pairs in transaction
    const db = getDatabase();

    try {
      const transaction = db.transaction(() => {
        // Delete existing training pairs for this persona
        db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(id);

        // Insert new training pairs
        const insertPair = db.prepare(
          'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
        );

        for (const row of rows) {
          insertPair.run(randomUUID(), id, row.input, row.expected_output);
        }
      });

      transaction();

      // Retrieve inserted pairs
      const pairs = db
        .prepare(
          'SELECT id, persona_id, input, expected_output, created_at FROM training_pairs WHERE persona_id = ? ORDER BY created_at ASC'
        )
        .all(id);

      logger.info('Training pairs uploaded', {
        personaId: id,
        count: pairs.length,
      });
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/training/upload`,
        201,
        Date.now() - startTime
      );

      return new Response(
        JSON.stringify({
          count: pairs.length,
          pairs: pairs,
          message: `Successfully uploaded ${pairs.length} training pairs`,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (dbError) {
      logger.logApiError('POST', `/api/personas/${id}/training/upload`, dbError as Error);
      return createErrorResponse(dbError);
    }
  } catch (error) {
    logger.logApiError('POST', `/api/personas/${id}/training/upload`, error as Error);
    return createErrorResponse(error);
  }
};
