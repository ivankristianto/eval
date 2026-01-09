// src/pages/api/templates/export.ts
// Export templates as CSV

import type { APIRoute } from 'astro';
import { getTemplates } from '../../../lib/db';

/**
 * GET /api/templates/export - Export all templates as CSV.
 * @returns CSV file response with all templates
 */
export const GET: APIRoute = async () => {
  try {
    const templates = getTemplates('created', 'desc');

    // Define CSV headers
    const headers = [
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

    // Convert templates to CSV rows
    const rows = templates.map((template) => {
      return [
        template.id,
        template.name,
        template.description || '',
        template.instruction_text,
        // Join model_ids with semicolon for CSV
        template.model_ids.join(';'),
        template.accuracy_rubric,
        // Join partial_credit_concepts with semicolon for CSV
        template.partial_credit_concepts?.join(';') || '',
        template.expected_output || '',
        template.system_prompt || '',
        template.temperature?.toString() || '',
        template.run_count.toString(),
        template.created_at,
        template.updated_at,
      ];
    });

    // Build CSV content
    const csvLines: string[] = [];

    // Add header row
    csvLines.push(headers.map(escapeCSVField).join(','));

    // Add data rows
    for (const row of rows) {
      csvLines.push(row.map(escapeCSVField).join(','));
    }

    const csvContent = csvLines.join('\n');

    // Return CSV file with proper headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="templates-export-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('GET /api/templates/export error:', error);
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

/**
 * Escapes a CSV field by handling special characters and quoting when necessary.
 * Wraps in quotes if it contains commas, quotes, or newlines, and escapes any existing quotes by doubling them.
 * @param field - The field value to escape
 * @returns The escaped CSV field value
 */
export function escapeCSVField(field: string): string {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return '"' + stringField.replace(/"/g, '""') + '"';
  }

  return stringField;
}
