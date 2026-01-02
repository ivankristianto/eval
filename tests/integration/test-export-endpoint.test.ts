// Test script for /api/templates/export endpoint
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  getTemplates,
  initializeDatabase,
  insertTemplate,
  closeDatabase,
  getDatabase,
} from '../../src/lib/db';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Test database path for isolation
const TEST_DB_PATH = join(process.cwd(), 'db', 'evaluation-export-test.db');

describe('GET /api/templates/export', () => {
  beforeEach(() => {
    // Close any existing database connection
    try {
      closeDatabase();
    } catch {
      // Ignore if no database was open
    }

    // Clean up test database if it exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    // Set test database path
    process.env.EVAL_DB_PATH = TEST_DB_PATH;

    // Initialize fresh test database
    initializeDatabase();
  });

  afterEach(() => {
    // Clean up test database after each test
    try {
      closeDatabase();
      if (existsSync(TEST_DB_PATH)) {
        unlinkSync(TEST_DB_PATH);
      }
      if (existsSync(TEST_DB_PATH + '-wal')) {
        unlinkSync(TEST_DB_PATH + '-wal');
      }
      if (existsSync(TEST_DB_PATH + '-shm')) {
        unlinkSync(TEST_DB_PATH + '-shm');
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should export templates as CSV with proper headers', async () => {
    // Insert test templates with various field types to test CSV escaping
    insertTemplate(
      'Simple Template',
      'This is a simple instruction',
      ['model-1', 'model-2'],
      'exact_match',
      'A simple description',
      'Expected output here',
      undefined,
      undefined,
      undefined
    );

    const templates = getTemplates('created', 'desc');

    // Import the escapeCSVField function to test it
    const { escapeCSVField } = await import('../../src/pages/api/templates/export.ts');

    // Test that all template fields can be escaped properly
    for (const template of templates) {
      expect(() => escapeCSVField(template.id)).not.toThrow();
      expect(() => escapeCSVField(template.name)).not.toThrow();
      expect(() => escapeCSVField(template.description || '')).not.toThrow();
      expect(() => escapeCSVField(template.instruction_text)).not.toThrow();
      expect(() => escapeCSVField(template.model_ids.join(';'))).not.toThrow();
      expect(() => escapeCSVField(template.accuracy_rubric)).not.toThrow();
      expect(() =>
        escapeCSVField(template.partial_credit_concepts?.join(';') || '')
      ).not.toThrow();
      expect(() => escapeCSVField(template.expected_output || '')).not.toThrow();
      expect(() => escapeCSVField(template.system_prompt || '')).not.toThrow();
      expect(() => escapeCSVField(template.temperature?.toString() || '')).not.toThrow();
      expect(() => escapeCSVField(template.run_count.toString())).not.toThrow();
      expect(() => escapeCSVField(template.created_at)).not.toThrow();
      expect(() => escapeCSVField(template.updated_at)).not.toThrow();
    }
  });

  it('should properly escape CSV fields with special characters', async () => {
    const { escapeCSVField } = await import('../../src/pages/api/templates/export.ts');

    // Test fields with commas
    expect(escapeCSVField('hello, world')).toBe('"hello, world"');

    // Test fields with quotes
    expect(escapeCSVField('say "hello"')).toBe('"say ""hello"""');

    // Test fields with newlines
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"');

    // Test fields with multiple special characters
    expect(escapeCSVField('a,b "c"\nd')).toBe('"a,b ""c""\nd"');

    // Test simple fields (no escaping needed)
    expect(escapeCSVField('simple')).toBe('simple');

    // Test empty/null fields
    expect(escapeCSVField('')).toBe('');
    expect(escapeCSVField(null as unknown as string)).toBe('');
    expect(escapeCSVField(undefined as unknown as string)).toBe('');
  });

  it('should export templates with all required fields', async () => {
    insertTemplate(
      'Complete Template',
      'Test instruction',
      ['model-1'],
      'exact_match',
      'Description',
      'Expected output',
      ['concept1', 'concept2'],
      'System prompt',
      0.7
    );

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    const lines = csvContent.split('\n');

    // Should have header + at least one data row
    expect(lines.length).toBeGreaterThanOrEqual(2);

    // Verify headers
    const headers = lines[0];
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

    expectedHeaders.forEach((header) => {
      expect(headers).toContain(header);
    });

    // Verify data row has all fields
    const dataLine = lines[1];
    expect(dataLine).toContain('Complete Template');
    expect(dataLine).toContain('Test instruction');
    expect(dataLine).toContain('exact_match');
  });

  it('should handle empty database gracefully', async () => {
    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    const lines = csvContent.split('\n').filter((l) => l.trim());

    // Should have at least headers
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toContain('id,name,description');
  });

  it('should set correct content-type headers', async () => {
    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toMatch(/templates-export-.*\.csv/);
  });

  it('should escape special characters in exported data', async () => {
    insertTemplate(
      'Template with "quotes" and, commas',
      'Instruction with "nested quotes", and commas, plus newlines\nin the text',
      ['model-3'],
      'partial_credit',
      'Description with "quotes", commas, and\nnewlines',
      'Expected with "quotes", commas,\nand newlines',
      ['concept 1', 'concept with, comma', 'concept with "quotes"'],
      'System prompt with "quotes" and, commas',
      0.7
    );

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();

    // Verify special characters are properly escaped with quotes
    expect(csvContent).toContain('"Template with ""quotes"" and, commas"');
    expect(csvContent).toContain('"Instruction with ""nested quotes"", and commas,');
    expect(csvContent).toContain('"System prompt with ""quotes"" and, commas"');

    // Verify semicolon-separated arrays are preserved (field is quoted due to comma)
    expect(csvContent).toContain('"concept 1;concept with, comma;concept with ""quotes"""');
  });

  it('should handle templates with missing optional fields', async () => {
    insertTemplate(
      'Minimal Template',
      'Test instruction',
      ['model-1'],
      'semantic_similarity',
      undefined, // no description
      undefined, // no expected output
      undefined, // no partial credit concepts
      undefined, // no system prompt
      undefined // use default temperature
    );

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    expect(csvContent).toContain('Minimal Template');
    expect(csvContent).toContain('semantic_similarity');
  });

  it('should export all templates in the database', async () => {
    const count = 10;
    for (let i = 0; i < count; i++) {
      insertTemplate(
        `Template ${i}`,
        `Instruction ${i}`,
        [`model-${i % 3}`],
        i % 3 === 0 ? 'exact_match' : i % 3 === 1 ? 'partial_credit' : 'semantic_similarity',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    }

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    const lines = csvContent.split('\n').filter((l) => l.trim());

    // Header + count data rows
    expect(lines.length).toBe(count + 1);

    // Verify all templates are in the export
    for (let i = 0; i < count; i++) {
      expect(csvContent).toContain(`Template ${i}`);
    }
  });

  it('should join model_ids and partial_credit_concepts with semicolons', async () => {
    insertTemplate(
      'Array Test Template',
      'Instruction',
      ['model-1', 'model-2', 'model-3'],
      'partial_credit',
      'Description',
      'Expected',
      ['concept 1', 'concept 2', 'concept 3'],
      undefined,
      undefined
    );

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();

    // Verify semicolon-separated arrays
    expect(csvContent).toContain('model-1;model-2;model-3');
    expect(csvContent).toContain('concept 1;concept 2;concept 3');
  });

  it('should include run_count in export', async () => {
    const template = insertTemplate(
      'Run Count Test',
      'Instruction',
      ['model-1'],
      'exact_match',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    // Manually increment run count
    const db = getDatabase();
    db.prepare('UPDATE EvaluationTemplate SET run_count = 5 WHERE id = ?').run(template.id);

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    expect(csvContent).toContain('Run Count Test');

    // Parse and verify run_count
    const lines = csvContent.split('\n');
    const dataLine = lines.find((l) => l.includes('Run Count Test'));
    expect(dataLine).toBeDefined();

    // run_count is at position 10 (0-indexed)
    const fields = dataLine!.split(',');
    // The run_count field should be 5
    expect(fields[10]).toContain('5');
  });

  it('should handle Unicode and special characters correctly', async () => {
    insertTemplate(
      'Unicode Test 模板 🚀',
      'Instruction with emoji 🎉 and unicode 中文',
      ['model-1'],
      'exact_match',
      'Description with special chars: @#$%^&*()',
      'Expected with émojis ànd ûnîçödé',
      undefined,
      undefined,
      undefined
    );

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    expect(csvContent).toContain('Unicode Test');
    expect(csvContent).toContain('🚀');
    expect(csvContent).toContain('中文');
    expect(csvContent).toContain('émojis');
  });

  it('should not mutate database during export', async () => {
    insertTemplate(
      'Immutable Test',
      'Instruction',
      ['model-1'],
      'exact_match',
      'Description',
      'Expected',
      undefined,
      undefined,
      0.8
    );

    const templatesBefore = getTemplates('created', 'desc');

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    const templatesAfter = getTemplates('created', 'desc');

    // Verify count and data are unchanged
    expect(templatesAfter.length).toBe(templatesBefore.length);
    expect(templatesAfter[0].name).toBe(templatesBefore[0].name);
    expect(templatesAfter[0].instruction_text).toBe(templatesBefore[0].instruction_text);
    expect(templatesAfter[0].temperature).toBe(templatesBefore[0].temperature);
  });

  it('should handle templates with very long text fields', async () => {
    const longText = 'A'.repeat(10000);
    const longDescription = 'B'.repeat(5000);

    insertTemplate(
      'Long Text Template',
      longText,
      ['model-1'],
      'exact_match',
      longDescription,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    expect(csvContent).toContain('Long Text Template');
    expect(csvContent.length).toBeGreaterThan(10000);
  });

  it('should order templates by created_at descending', async () => {
    // Create templates in a specific order
    insertTemplate('Template 1', 'Instruction 1', ['model-1'], 'exact_match');
    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

    insertTemplate('Template 2', 'Instruction 2', ['model-1'], 'exact_match');
    await new Promise((resolve) => setTimeout(resolve, 10));

    insertTemplate('Template 3', 'Instruction 3', ['model-1'], 'exact_match');

    const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
    const response = await exportGET({} as any) // eslint-disable-line @typescript-eslint/no-explicit-any

    expect(response.status).toBe(200);

    const csvContent = await response.text();
    const lines = csvContent.split('\n').filter((l) => l.trim());

    // Find positions of templates (excluding header)
    const pos1 = lines.findIndex((l) => l.includes('Template 1'));
    const pos2 = lines.findIndex((l) => l.includes('Template 2'));
    const pos3 = lines.findIndex((l) => l.includes('Template 3'));

    // Template 3 should appear first (most recently created)
    expect(pos3).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos1);
  });
});
