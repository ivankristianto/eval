// Integration tests for template import/export roundtrip operations
import { describe, it, expect, beforeAll, afterEach, beforeEach } from 'vitest';
import {
  initializeDatabase,
  getTemplates,
  insertTemplate,
  closeDatabase,
  getDatabase,
} from '../../src/lib/db';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Test database path for isolation
const TEST_DB_PATH = join(process.cwd(), 'db', 'evaluation-roundtrip-test.db');

describe('Import/Export Roundtrip Integration Tests', () => {
  beforeAll(() => {
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

  beforeEach(() => {
    // Reinitialize database before each test
    initializeDatabase();
  });

  describe('Full Roundtrip: Export → Import', () => {
    it('should successfully export and re-import templates preserving all data', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const model2 = '00000000-0000-1000-8000-000000000002';
      const timestamp = Date.now();

      // Create test templates with various field configurations
      insertTemplate(
        `Template ${timestamp} - Simple`,
        'Simple instruction',
        [model1],
        'exact_match',
        'Simple description',
        'Expected output',
        undefined,
        undefined,
        undefined
      );

      insertTemplate(
        `Template ${timestamp} - Complex`,
        'Complex instruction with "quotes" and, commas',
        [model1, model2],
        'partial_credit',
        'Description with newlines\nand special chars',
        'Expected with "quotes",\ncommas,\nand newlines',
        ['concept 1', 'concept with, comma', 'concept with "quotes"'],
        'System prompt with "quotes" and, commas',
        0.7
      );

      insertTemplate(
        `Template ${timestamp} - Minimal`,
        'Minimal instruction',
        [model2],
        'semantic_similarity',
        undefined, // no description
        undefined, // no expected output
        undefined, // no partial credit
        undefined, // no system prompt
        undefined // default temperature
      );

      // Step 1: Export templates
      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const exportResponse = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(exportResponse.status).toBe(200);

      const csvContent = await exportResponse.text();
      expect(csvContent).toBeTruthy();
      expect(csvContent.length).toBeGreaterThan(0);

      // Verify CSV has proper headers
      const lines = csvContent.split('\n');
      const headers = lines[0];
      expect(headers).toContain('id,name,description,instruction_text,model_ids');

      // Step 2: Clear database
      const db = getDatabase();
      db.prepare('DELETE FROM EvaluationTemplate').run();
      expect(getTemplates('created', 'desc')).toHaveLength(0);

      // Step 3: Import exported CSV
      const file = new File([csvContent], 'exported-templates.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const importResponse = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(importResponse.status).toBe(200);

      const importResult = (await importResponse.json()) as {
        imported: number;
        failed: number;
        skipped: number;
        errors: Array<{ row: number; name: string; error: string }>;
      };

      expect(importResult.imported).toBe(3);
      expect(importResult.failed).toBe(0);
      expect(importResult.skipped).toBe(0);

      // Step 4: Verify imported templates match original data
      const templates = getTemplates('created', 'desc');
      expect(templates).toHaveLength(3);

      const simpleTemplate = templates.find((t) => t.name === `Template ${timestamp} - Simple`);
      expect(simpleTemplate).toBeDefined();
      expect(simpleTemplate?.description).toBe('Simple description');
      expect(simpleTemplate?.instruction_text).toBe('Simple instruction');
      expect(simpleTemplate?.model_ids).toEqual([model1]);
      expect(simpleTemplate?.accuracy_rubric).toBe('exact_match');
      expect(simpleTemplate?.expected_output).toBe('Expected output');

      const complexTemplate = templates.find((t) => t.name === `Template ${timestamp} - Complex`);
      expect(complexTemplate).toBeDefined();
      expect(complexTemplate?.description).toBe('Description with newlines\nand special chars');
      expect(complexTemplate?.instruction_text).toBe(
        'Complex instruction with "quotes" and, commas'
      );
      expect(complexTemplate?.model_ids).toEqual([model1, model2]);
      expect(complexTemplate?.accuracy_rubric).toBe('partial_credit');
      expect(complexTemplate?.partial_credit_concepts).toEqual([
        'concept 1',
        'concept with, comma',
        'concept with "quotes"',
      ]);
      expect(complexTemplate?.expected_output).toBe(
        'Expected with "quotes",\ncommas,\nand newlines'
      );
      expect(complexTemplate?.system_prompt).toBe('System prompt with "quotes" and, commas');
      expect(complexTemplate?.temperature).toBe(0.7);

      const minimalTemplate = templates.find((t) => t.name === `Template ${timestamp} - Minimal`);
      expect(minimalTemplate).toBeDefined();
      expect(minimalTemplate?.description).toBeNull(); // Empty fields are null in DB
      expect(minimalTemplate?.instruction_text).toBe('Minimal instruction');
      expect(minimalTemplate?.model_ids).toEqual([model2]);
      expect(minimalTemplate?.accuracy_rubric).toBe('semantic_similarity');
      expect(minimalTemplate?.expected_output).toBeNull(); // Empty fields are null in DB
      expect(minimalTemplate?.partial_credit_concepts).toBeUndefined(); // Array fields are undefined when null
      expect(minimalTemplate?.system_prompt).toBeNull(); // Empty fields are null in DB
      expect(minimalTemplate?.temperature).toBe(0.3); // default value
    });

    it('should handle empty database export gracefully', async () => {
      // Database is empty from beforeEach

      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const exportResponse = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(exportResponse.status).toBe(200);

      const csvContent = await exportResponse.text();
      expect(csvContent).toBeTruthy();

      // Should have headers only (or headers + empty rows)
      const lines = csvContent.split('\n').filter((l) => l.trim());
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines[0]).toContain('id,name,description,instruction_text');
    });

    it('should skip duplicates during import without failing', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      // Create a template
      insertTemplate(
        `Original ${timestamp}`,
        'Original instruction',
        [model1],
        'exact_match',
        'Original description',
        undefined,
        undefined,
        undefined,
        undefined
      );

      // Export it
      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const exportResponse = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const csvContent = await exportResponse.text();

      // Try to import the same CSV (should skip duplicate)
      const file = new File([csvContent], 'exported-templates.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const importResponse = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const importResult = (await importResponse.json()) as {
        imported: number;
        failed: number;
        skipped: number;
        errors: Array<{ row: number; name: string; error: string }>;
      };

      expect(importResult.imported).toBe(0);
      expect(importResult.skipped).toBe(1);
      expect(importResult.failed).toBe(0);

      // Should still have only 1 template
      const templates = getTemplates('created', 'desc');
      expect(templates).toHaveLength(1);
    });
  });

  describe('Import Error Handling', () => {
    it('should reject CSV with invalid file type', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('INVALID_FILE_TYPE');
      expect(result.message).toBe('File must be a CSV file');
    });

    it('should reject import with missing file', async () => {
      const formData = new FormData();
      // No file added

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('INVALID_INPUT');
      expect(result.message).toBe('No file provided');
    });

    it('should reject CSV with malformed structure', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';

      // CSV with wrong number of columns
      const csvContent = [
        'id,name,description,instruction_text,model_ids', // Missing columns
        `template-1,Test,Description,Instruction,${model1}`,
      ].join('\n');

      const file = new File([csvContent], 'malformed.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('CSV_PARSE_ERROR');
      expect(result.details).toBeDefined();
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should reject CSV with invalid header names', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';

      // CSV with wrong header names
      const csvContent = [
        'id,wrong_name,wrong_description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
        `template-1,Test,Description,Instruction,${model1},exact_match,,,Expected,,,0,0.3,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      ].join('\n');

      const file = new File([csvContent], 'wrong-headers.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('CSV_PARSE_ERROR');
      expect(result.details).toBeDefined();
    });

    it('should handle CSV with validation errors gracefully', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      // CSV with multiple rows, some valid, some invalid
      const csvContent = [
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
        // Valid row
        `template-1,Valid Template ${timestamp},Description,Instruction,${model1},exact_match,,Expected,Valid prompt,0.5,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
        // Invalid: missing name
        `template-2,,,Instruction,${model1},exact_match,,,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
        // Invalid: temperature out of range
        `template-3,Invalid Temp ${timestamp},Description,Instruction,${model1},exact_match,,,,3.0,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
        // Another valid row
        `template-4,Another Valid ${timestamp},Description,Instruction,${model1},partial_credit,concept1;concept2,Expected,Prompt,0.7,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      ].join('\n');

      const file = new File([csvContent], 'mixed-validation.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = (await response.json()) as {
        imported: number;
        failed: number;
        skipped: number;
        errors: Array<{ row: number; name: string; error: string }>;
      };

      expect(response.status).toBe(200);
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(2);

      // Verify error details
      const errorRows = result.errors.map((e) => e.row).sort();
      expect(errorRows).toEqual([3, 4]); // Rows 3 and 4 failed (row 1 is header)

      // Verify only valid templates were imported
      const templates = getTemplates('created', 'desc');
      expect(templates).toHaveLength(2);
      expect(templates.some((t) => t.name === `Valid Template ${timestamp}`)).toBe(true);
      expect(templates.some((t) => t.name === `Another Valid ${timestamp}`)).toBe(true);
    });

    it('should reject empty CSV file', async () => {
      // CSV with only headers, no data rows
      const csvContent =
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at';

      const file = new File([csvContent], 'empty.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('CSV_PARSE_ERROR');
    });

    it('should reject CSV with no data rows after filtering empty ones', async () => {
      // CSV with headers and only empty data rows
      const csvContent = [
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
        ',,,,,,,,,,,,,', // Empty row
        '  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ', // Whitespace-only row
      ].join('\n');

      const file = new File([csvContent], 'no-data.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const response = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('EMPTY_CSV');
    });
  });

  describe('Export Edge Cases', () => {
    it('should handle templates with special characters in export', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      // Insert template with all kinds of special characters
      insertTemplate(
        `Template "with" special, chars ${timestamp}`,
        'Instruction with "quotes", commas,\nnewlines, and tabs\t',
        [model1],
        'partial_credit',
        'Description with multiple "quotes" and, commas\nand newlines',
        'Expected with "quotes", commas,\nnewlines, and "mixed" special chars',
        ['concept with, comma', 'concept with "quotes"', 'concept with\nnewline'],
        'System prompt with "quotes", commas,\nand newlines',
        1.5
      );

      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const response = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(response.status).toBe(200);

      const csvContent = await response.text();

      // Verify CSV is properly escaped and can be parsed
      const lines = csvContent.split('\n');
      expect(lines.length).toBeGreaterThan(1); // At least header + 1 data row

      // Import the exported CSV to verify it works
      const db = getDatabase();
      db.prepare('DELETE FROM EvaluationTemplate').run();

      const file = new File([csvContent], 're-export.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const importResponse = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const importResult = (await importResponse.json()) as {
        imported: number;
        failed: number;
        skipped: number;
        errors: Array<{ row: number; name: string; error: string }>;
      };

      expect(importResult.imported).toBe(1);
      expect(importResult.failed).toBe(0);

      const templates = getTemplates('created', 'desc');
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toContain('special, chars');
      expect(templates[0].description).toContain('multiple "quotes"');
    });

    it('should include all templates in export regardless of run_count', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      // Insert templates with different run counts
      insertTemplate(
        `Never Run ${timestamp}`,
        'Instruction',
        [model1],
        'exact_match',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );

      const template2 = insertTemplate(
        `Run Once ${timestamp}`,
        'Instruction',
        [model1],
        'exact_match',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );

      // Manually increment run count
      const db = getDatabase();
      db.prepare('UPDATE EvaluationTemplate SET run_count = 1 WHERE id = ?').run(template2.id);

      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const response = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const csvContent = await response.text();

      const lines = csvContent.split('\n');
      // Should have header + 2 data rows
      expect(lines.length).toBeGreaterThanOrEqual(3);

      // Both templates should be in the export
      expect(csvContent).toContain(`Never Run ${timestamp}`);
      expect(csvContent).toContain(`Run Once ${timestamp}`);
    });

    it('should return proper CSV content-type headers', async () => {
      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const response = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('.csv');
    });
  });

  describe('Database State Verification', () => {
    it('should not modify original templates during export', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      const originalTemplate = insertTemplate(
        `Test Template ${timestamp}`,
        'Test instruction',
        [model1],
        'exact_match',
        'Test description',
        'Expected output',
        undefined,
        undefined,
        0.8
      );

      // Export
      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Verify template unchanged
      const templates = getTemplates('created', 'desc');
      const template = templates.find((t) => t.id === originalTemplate.id);

      expect(template).toBeDefined();
      expect(template?.name).toBe(`Test Template ${timestamp}`);
      expect(template?.instruction_text).toBe('Test instruction');
      expect(template?.description).toBe('Test description');
      expect(template?.temperature).toBe(0.8);
      expect(template?.run_count).toBe(0);
    });

    it('should create new IDs during import but preserve data', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      // Create and export
      insertTemplate(
        `Original ${timestamp}`,
        'Original instruction',
        [model1],
        'exact_match',
        'Original description',
        undefined,
        undefined,
        undefined,
        undefined
      );

      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const exportResponse = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const csvContent = await exportResponse.text();

      // Clear database
      const db = getDatabase();
      db.prepare('DELETE FROM EvaluationTemplate').run();

      // Import - should generate new IDs
      const file = new File([csvContent], 'reimport.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Verify new template was created
      const templates = getTemplates('created', 'desc');
      expect(templates).toHaveLength(1);

      // Template should have a different ID (newly generated)
      // but same data
      expect(templates[0].name).toBe(`Original ${timestamp}`);
      expect(templates[0].instruction_text).toBe('Original instruction');
      expect(templates[0].description).toBe('Original description');
    });

    it('should handle large number of templates in roundtrip', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const templateCount = 50;

      // Create many templates
      for (let i = 0; i < templateCount; i++) {
        const rubricType =
          i % 3 === 0 ? 'exact_match' : i % 3 === 1 ? 'partial_credit' : 'semantic_similarity';
        insertTemplate(
          `Bulk Template ${i}`,
          `Instruction ${i}`,
          [model1],
          rubricType,
          `Description ${i}`,
          undefined,
          rubricType === 'partial_credit' ? [`concept ${i}`] : undefined,
          undefined,
          undefined
        );
      }

      // Export
      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      const exportResponse = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const csvContent = await exportResponse.text();

      const lines = csvContent.split('\n').filter((l) => l.trim());
      // Header + templateCount rows
      expect(lines.length).toBe(templateCount + 1);

      // Clear and re-import
      const db = getDatabase();
      db.prepare('DELETE FROM EvaluationTemplate').run();

      const file = new File([csvContent], 'bulk.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const importResponse = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const importResult = (await importResponse.json()) as {
        imported: number;
        failed: number;
        skipped: number;
        errors: Array<{ row: number; name: string; error: string }>;
      };

      expect(importResult.imported).toBe(templateCount);
      expect(importResult.failed).toBe(0);

      const templates = getTemplates('created', 'desc');
      expect(templates).toHaveLength(templateCount);

      // Verify all templates imported correctly
      for (let i = 0; i < templateCount; i++) {
        expect(templates.some((t) => t.name === `Bulk Template ${i}`)).toBe(true);
      }
    });
  });

  describe('Concurrent and Sequential Operations', () => {
    it('should handle multiple sequential export/import cycles', async () => {
      const model1 = '00000000-0000-1000-8000-000000000001';
      const timestamp = Date.now();

      // Cycle 1: Create and export
      insertTemplate(
        `Cycle 1 - ${timestamp}`,
        'Instruction 1',
        [model1],
        'exact_match',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );

      const { GET: exportGET } = await import('../../src/pages/api/templates/export.ts');
      let response = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      let csvContent = await response.text();

      // Cycle 2: Add more templates and export again
      insertTemplate(
        `Cycle 2 - ${timestamp}`,
        'Instruction 2',
        [model1],
        'partial_credit',
        undefined,
        undefined,
        ['concept 2'],
        undefined,
        undefined
      );

      response = await exportGET({} as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      csvContent = await response.text();

      // Verify both templates are in the export
      expect(csvContent).toContain(`Cycle 1 - ${timestamp}`);
      expect(csvContent).toContain(`Cycle 2 - ${timestamp}`);

      // Clear and import
      const db = getDatabase();
      db.prepare('DELETE FROM EvaluationTemplate').run();

      const file = new File([csvContent], 'cycles.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost/api/templates/import', {
        method: 'POST',
        body: formData,
      });

      const { POST: importPOST } = await import('../../src/pages/api/templates/import.ts');
      const importResponse = await importPOST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      const importResult = (await importResponse.json()) as {
        imported: number;
        failed: number;
        skipped: number;
        errors: Array<{ row: number; name: string; error: string }>;
      };

      expect(importResult.imported).toBe(2);
    });
  });
});
