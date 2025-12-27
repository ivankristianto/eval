/**
 * Training Data Upload API Endpoint
 * POST /api/personas/[id]/training/upload
 *
 * Uploads CSV file with training pairs and stores them in the database.
 */

import type { APIRoute } from 'astro';
import { getPersona } from '../../../../../lib/persona-db';
import { parseCSV } from '../../../../../lib/csv-parser';
import { getDatabase } from '../../../../../lib/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/personas/[id]/training/upload
 * Upload CSV file with training pairs
 *
 * Request body: multipart/form-data with 'file' field
 * Response: 201 with { count: number, pairs: TrainingPair[] }
 *          400 with { error: string, details: string[] }
 *          404 with { error: string }
 */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Persona ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify persona exists
    const persona = getPersona(id);
    if (!persona) {
      return new Response(
        JSON.stringify({
          error: 'PERSONA_NOT_FOUND',
          message: 'Persona does not exist',
          persona_id: id,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse multipart form data
    const contentType = request.headers.get('content-type') || '';

    let fileContent: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return new Response(
          JSON.stringify({
            error: 'INVALID_INPUT',
            message: 'No file provided. Expected multipart/form-data with "file" field.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      fileContent = await file.text();
    } else if (contentType.includes('application/json')) {
      // Handle JSON payload with CSV content
      const body = await request.json();
      fileContent = body.csv || body.content || '';

      if (!fileContent) {
        return new Response(
          JSON.stringify({
            error: 'INVALID_INPUT',
            message: 'No CSV content provided. Expected "csv" or "content" field in JSON body.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      // Assume raw CSV content
      fileContent = await request.text();
    }

    // Parse CSV
    const { rows, errors } = parseCSV(fileContent);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: 'CSV validation failed',
          details: errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
      console.error('Database error during training pair insertion:', dbError);

      return new Response(
        JSON.stringify({
          error: 'DATABASE_ERROR',
          message: 'Failed to insert training pairs',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('POST /api/personas/[id]/training/upload error:', error);

    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
