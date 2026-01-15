/**
 * Bulk Dataset Upload API Endpoint
 * POST /api/bulk/upload
 *
 * Uploads CSV file and stores parsed data for bulk evaluation.
 * Accepts multipart/form-data or raw CSV content.
 */

import type { APIRoute } from 'astro';
import { createBulkDataset } from '@lib/db';
import { parseGenericCSV, MAX_ROWS } from '@lib/utils/generic-csv-parser';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Bulk:Upload');

// Maximum file size: 10MB (matching training upload)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Extract MIME type from Content-Type header, ignoring parameters.
 * @param contentType - Full Content-Type header value
 * @returns Pure MIME type
 */
function extractMimeType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

/**
 * POST /api/bulk/upload
 * Upload CSV file for bulk evaluation
 *
 * Request: multipart/form-data with 'file' field, or raw CSV content
 * Response: 201 with { dataset_id, filename, row_count, preview }
 *          400 with { error: string, details?: string[] }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const contentType = request.headers.get('content-type') || '';
    const mimeType = extractMimeType(contentType);

    let fileContent: string;
    let filename = 'upload.csv';

    if (mimeType === 'multipart/form-data') {
      // Handle multipart/form-data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        logger.logApiRequest('POST', '/api/bulk/upload', 400, Date.now() - startTime);
        return badRequest(
          'No file provided. Expected multipart/form-data with "file" field.',
          'INVALID_INPUT'
        );
      }

      // Validate file size before processing
      if (file.size > MAX_FILE_SIZE) {
        logger.logApiRequest('POST', '/api/bulk/upload', 413, Date.now() - startTime);
        return badRequest(
          `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          'FILE_TOO_LARGE'
        );
      }

      fileContent = await file.text();
      filename = file.name || filename;

      // Double-check file content size after reading
      if (fileContent.length > MAX_FILE_SIZE) {
        logger.logApiRequest('POST', '/api/bulk/upload', 413, Date.now() - startTime);
        return badRequest(
          `CSV content too large after processing. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          'CONTENT_TOO_LARGE'
        );
      }
    } else if (mimeType === 'application/json') {
      // Handle JSON payload with CSV content
      const body = await request.json();
      fileContent = body.csv || body.content || '';
      filename = body.filename || filename;

      if (!fileContent) {
        logger.logApiRequest('POST', '/api/bulk/upload', 400, Date.now() - startTime);
        return badRequest(
          'No CSV content provided. Expected "csv" or "content" field in JSON body.',
          'INVALID_INPUT'
        );
      }

      // Validate content size
      if (fileContent.length > MAX_FILE_SIZE) {
        logger.logApiRequest('POST', '/api/bulk/upload', 413, Date.now() - startTime);
        return badRequest(
          `CSV content too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          'CONTENT_TOO_LARGE'
        );
      }
    } else {
      // Assume raw CSV content
      fileContent = await request.text();

      // Validate content size for raw text
      if (fileContent.length > MAX_FILE_SIZE) {
        logger.logApiRequest('POST', '/api/bulk/upload', 413, Date.now() - startTime);
        return badRequest(
          `CSV content too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          'CONTENT_TOO_LARGE'
        );
      }
    }

    // Parse CSV using generic parser
    const { headers, rows, errors } = parseGenericCSV(fileContent, MAX_ROWS);

    if (errors.length > 0) {
      logger.logApiRequest('POST', '/api/bulk/upload', 400, Date.now() - startTime);
      return badRequest('CSV validation failed', 'CSV_VALIDATION_ERROR', errors);
    }

    // Create bulk dataset in database
    const dataset = createBulkDataset(filename, rows);

    // Return preview (first 5 rows)
    const preview = rows.slice(0, 5).map((row) => {
      const previewRow: Record<string, string> = {};
      for (const header of headers) {
        previewRow[header] = row[header] || '';
      }
      return previewRow;
    });

    logger.info('Bulk dataset uploaded', {
      datasetId: dataset.id,
      filename,
      rowCount: rows.length,
      headers,
    });
    logger.logApiRequest('POST', '/api/bulk/upload', 201, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        dataset_id: dataset.id,
        filename: dataset.filename,
        row_count: dataset.row_count,
        headers,
        preview,
        created_at: dataset.created_at,
        message: `Successfully uploaded dataset with ${rows.length} rows`,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/bulk/upload', error as Error);
    return createErrorResponse(error);
  }
};
