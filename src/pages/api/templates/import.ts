// src/pages/api/templates/import.ts
// Import templates from CSV file

import type { APIRoute } from 'astro';
import { insertTemplate, getTemplates } from '../../../lib/db';
import {
  validateCreateTemplate,
  validateSystemPrompt,
  validateTemperature,
} from '@lib/validation/validators';
import type { RubricType } from '@lib/utils/types';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Templates:Import');

/**
 * POST /api/templates/import - Import templates from CSV file.
 * @param request - The Astro API request containing the CSV file
 * @returns JSON response with import results
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      logger.logApiRequest('POST', '/api/templates/import', 400, Date.now() - startTime);
      return badRequest(
        'No file provided. Expected multipart/form-data with "file" field.',
        'INVALID_INPUT'
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      logger.logApiRequest('POST', '/api/templates/import', 400, Date.now() - startTime);
      return badRequest('File must be a CSV file', 'INVALID_FILE_TYPE');
    }

    // Read file content
    const text = await file.text();

    // Parse CSV
    const result = parseCSV(text);

    if (result.errors.length > 0) {
      logger.logApiRequest('POST', '/api/templates/import', 400, Date.now() - startTime);
      return badRequest('Failed to parse CSV file', 'CSV_PARSE_ERROR', result.errors);
    }

    if (result.templates.length === 0) {
      logger.logApiRequest('POST', '/api/templates/import', 400, Date.now() - startTime);
      return badRequest('CSV file contains no valid template rows', 'EMPTY_CSV');
    }

    // Import templates
    const importResult = await importTemplates(result.templates);

    logger.info('Templates imported', {
      imported: importResult.imported,
      failed: importResult.failed,
      skipped: importResult.skipped,
    });
    logger.logApiRequest('POST', '/api/templates/import', 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        imported: importResult.imported,
        failed: importResult.failed,
        skipped: importResult.skipped,
        errors: importResult.errors,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('POST', '/api/templates/import', error as Error);
    return createErrorResponse(error);
  }
};

export interface CSVTemplate {
  id: string;
  name: string;
  description: string;
  instruction_text: string;
  model_ids: string[];
  accuracy_rubric: string;
  partial_credit_concepts: string[];
  expected_output: string;
  system_prompt: string;
  temperature: number;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface ParseResult {
  templates: CSVTemplate[];
  errors: string[];
}

export interface ImportResult {
  imported: number;
  failed: number;
  skipped: number;
  errors: Array<{ row: number; name: string; error: string }>;
}

/**
 * Parse CSV content into template objects
 * Handles quoted fields with commas, quotes, and newlines
 * Exported for testing
 */
export function parseCSV(content: string): ParseResult {
  const templates: CSVTemplate[] = [];
  const errors: string[] = [];

  // Split into rows (handling quoted fields with newlines)
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator (only outside quotes)
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      // Row separator (only outside quotes)
      // Add the last field to the current row
      currentRow.push(currentField);

      // Only add non-empty rows
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }

      // Reset for next row
      currentRow = [];
      currentField = '';

      // Skip \n if we're at \r\n
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      // Regular character (or newline/quote inside quoted field)
      currentField += char;
    }
  }

  // Add the last field and row
  currentRow.push(currentField);
  if (currentRow.some((field) => field.length > 0)) {
    rows.push(currentRow);
  }

  // Check if we have at least a header row
  if (rows.length === 0) {
    errors.push('CSV file is empty');
    return { templates, errors };
  }

  // Define expected headers
  const expectedHeaders = [
    'id',
    'name',
    'description',
    'instruction_text',
    'model_ids',
    'accuracy_rubric',
    'partial_credit_concepts',
    'expected_output',
    'system_prompt',
    'temperature',
    'run_count',
    'created_at',
    'updated_at',
  ];

  // Parse header row
  const headers = rows[0];

  // Check if we have data rows
  if (rows.length < 2) {
    errors.push('CSV file must have at least a header row and one data row');
    return { templates, errors };
  }

  // Validate headers
  if (headers.length !== expectedHeaders.length) {
    errors.push(
      `Invalid header count. Expected ${expectedHeaders.length} columns, got ${headers.length}`
    );
    return { templates, errors };
  }

  for (let i = 0; i < expectedHeaders.length; i++) {
    if (headers[i] !== expectedHeaders[i]) {
      errors.push(
        `Invalid header at column ${i + 1}. Expected "${expectedHeaders[i]}", got "${headers[i]}"`
      );
      return { templates, errors };
    }
  }

  // Parse data rows
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];

    // Skip completely empty rows (all fields are empty/whitespace)
    if (values.every((v) => v.trim() === '')) {
      continue;
    }

    if (values.length !== expectedHeaders.length) {
      errors.push(
        `Row ${i + 1}: Invalid column count. Expected ${expectedHeaders.length}, got ${values.length}`
      );
      continue;
    }

    try {
      const template: CSVTemplate = {
        id: values[0],
        name: values[1],
        description: values[2],
        instruction_text: values[3],
        model_ids: values[4] ? values[4].split(';').filter((id) => id.trim()) : [],
        accuracy_rubric: values[5],
        partial_credit_concepts: values[6] ? values[6].split(';').filter((c) => c.trim()) : [],
        expected_output: values[7],
        system_prompt: values[8],
        temperature: values[9] ? parseFloat(values[9]) : 0.3,
        run_count: values[10] ? parseInt(values[10], 10) : 0,
        created_at: values[11],
        updated_at: values[12],
      };

      templates.push(template);
    } catch (error) {
      errors.push(
        `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown parse error'}`
      );
    }
  }

  return { templates, errors };
}

/**
 * Parse a CSV line, handling quoted fields with commas, quotes, and newlines
 * Exported for testing
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  fields.push(current);

  return fields;
}

/**
 * Import templates into database, handling duplicates and validation
 */
async function importTemplates(templates: CSVTemplate[]): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Get existing template names
  const existingTemplates = getTemplates('name', 'asc');
  const existingNames = new Set(existingTemplates.map((t) => t.name));

  for (let i = 0; i < templates.length; i++) {
    const csvTemplate = templates[i];
    const rowNum = i + 2; // +2 for header (row 1) and 0-based index

    try {
      // Validate required fields
      const validation = validateCreateTemplate({
        name: csvTemplate.name,
        description: csvTemplate.description || undefined,
        instruction_text: csvTemplate.instruction_text,
        model_ids: csvTemplate.model_ids,
        accuracy_rubric: csvTemplate.accuracy_rubric as RubricType,
        expected_output: csvTemplate.expected_output || undefined,
        partial_credit_concepts:
          csvTemplate.partial_credit_concepts.length > 0
            ? csvTemplate.partial_credit_concepts
            : undefined,
      });

      if (!validation.valid) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          name: csvTemplate.name,
          error: validation.error?.message || 'Validation failed',
        });
        continue;
      }

      // Validate system prompt if provided
      const systemPromptValidation = validateSystemPrompt(csvTemplate.system_prompt || undefined);
      if (!systemPromptValidation.valid) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          name: csvTemplate.name,
          error: systemPromptValidation.error?.message || 'System prompt validation failed',
        });
        continue;
      }

      // Validate temperature if provided
      const temperatureValidation = validateTemperature(csvTemplate.temperature);
      if (!temperatureValidation.valid) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          name: csvTemplate.name,
          error: temperatureValidation.error?.message || 'Temperature validation failed',
        });
        continue;
      }

      // Handle duplicate names
      let finalName = csvTemplate.name;
      if (existingNames.has(finalName)) {
        // Skip duplicates
        result.skipped++;
        continue;
      }

      // Insert template (generates new ID)
      insertTemplate(
        finalName,
        csvTemplate.instruction_text,
        csvTemplate.model_ids,
        csvTemplate.accuracy_rubric as RubricType,
        csvTemplate.description || undefined,
        csvTemplate.expected_output || undefined,
        csvTemplate.partial_credit_concepts.length > 0
          ? csvTemplate.partial_credit_concepts
          : undefined,
        csvTemplate.system_prompt || undefined,
        csvTemplate.temperature
      );

      result.imported++;
      existingNames.add(finalName);
    } catch (error) {
      result.failed++;
      result.errors.push({
        row: rowNum,
        name: csvTemplate.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}
