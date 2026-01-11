// Test script for POST /api/templates/import endpoint
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { initializeDatabase, getTemplates, insertTemplate, closeDatabase } from '../../src/lib/db';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Test database path for isolation
const TEST_DB_PATH = join(process.cwd(), 'db', 'evaluation-import-test.db');

describe('POST /api/templates/import', () => {
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

  it('should parse CSV with proper escaping', async () => {
    // Test CSV parsing with special characters
    // Using valid UUIDs for model_ids (version 1, variant 1 UUIDs)
    const model1 = '00000000-0000-1000-8000-000000000001';
    const model2 = '00000000-0000-1000-8000-000000000002';
    const model3 = '00000000-0000-1000-8000-000000000003';
    const timestamp = Date.now();

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,Simple Template ${timestamp},A simple description,This is a simple instruction,${model1};${model2},exact_match,,Expected output,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      `template-2,"Template with, comma ${timestamp}","Description with ""quotes""","Instruction with ""quotes"" and, commas",${model3},partial_credit,concept 1;concept 2,"Expected with ""quotes""",System prompt,0.7,5,2024-01-02T00:00:00.000Z,2024-01-02T00:00:00.000Z`,
      `template-3,"Template with quotes and comma ${timestamp}","Description with ""escaped"" quotes","Instruction with ""quotes"" and commas",${model1};${model2},semantic_similarity,,Expected,,0.5,0,2024-01-03T00:00:00.000Z,2024-01-03T00:00:00.000Z`,
    ].join('\n');

    // Create a mock File object
    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    // Create mock request
    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    // Import the handler function
    const { POST } = await import('../../src/pages/api/templates/import.ts');

    // Call the handler
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Check response status
    expect(response.status).toBe(201);

    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    // Should import all 3 templates
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify templates were created in database
    const templates = getTemplates('created', 'desc');

    // Find the imported templates by name
    const simpleTemplate = templates.find((t) => t.name === `Simple Template ${timestamp}`);
    expect(simpleTemplate).toBeDefined();
    expect(simpleTemplate?.description).toBe('A simple description');
    expect(simpleTemplate?.instruction_text).toBe('This is a simple instruction');
    expect(simpleTemplate?.model_ids).toEqual([model1, model2]);

    const commaTemplate = templates.find((t) => t.name === `Template with, comma ${timestamp}`);
    expect(commaTemplate).toBeDefined();
    expect(commaTemplate?.description).toBe('Description with "quotes"');
    expect(commaTemplate?.instruction_text).toBe('Instruction with "quotes" and, commas');

    const quotesTemplate = templates.find(
      (t) => t.name === `Template with quotes and comma ${timestamp}`
    );
    expect(quotesTemplate).toBeDefined();
    expect(quotesTemplate?.description).toBe('Description with "escaped" quotes');
    expect(quotesTemplate?.instruction_text).toBe('Instruction with "quotes" and commas');
  });

  it('should skip duplicate template names', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const uniqueName = `Duplicate Template ${Date.now()}`;

    // Create a template first
    insertTemplate(
      uniqueName,
      'Test instruction',
      [model1],
      'exact_match',
      'Test description',
      'Expected output',
      undefined,
      undefined,
      undefined
    );

    // Create CSV with duplicate name
    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,${uniqueName},This is a duplicate,Instruction,${model1},exact_match,,Expected,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    // Should skip the duplicate
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should reject invalid CSV format', async () => {
    // Invalid CSV - wrong number of columns
    const csvContent =
      'id,name,description\n' + 'template-1,Test,Description\n' + 'template-2,Test2,Description2';

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.code).toBe('CSV_VALIDATION_ERROR');
    expect(result.error).toBe('Failed to parse CSV file');
    expect(result.details).toBeDefined();
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('should reject invalid template data', async () => {
    // CSV with missing required fields
    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      'template-1,,,Missing name and instruction,,exact_match,,Expected,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z',
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Parse JSON once
    const json = await response.json();
    const result = json as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    // Debug: if response indicates a parsing error, log it
    if (response.status !== 201) {
      console.error('Response status:', response.status);
      console.error('Response body:', JSON.stringify(json, null, 2));
    }

    expect(response.status).toBe(201);

    // Should fail validation
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].error).toContain('name must be a non-empty string');
  });

  it('should handle empty CSV file', async () => {
    const csvContent =
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at';

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.code).toBe('CSV_VALIDATION_ERROR');
    expect(result.error).toBe('Failed to parse CSV file');
  });

  it('should reject missing file', async () => {
    const formData = new FormData();
    // No file added

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.code).toBe('INVALID_INPUT');
    expect(result.error).toContain('No file provided');
  });

  it('should reject non-CSV file', async () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.code).toBe('INVALID_FILE_TYPE');
    expect(result.error).toBe('File must be a CSV file');
  });

  it('should import templates with all field types', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const model2 = '00000000-0000-1000-8000-000000000002';
    const model3 = '00000000-0000-1000-8000-000000000003';
    const uniqueName = `Full Template ${Date.now()}`;

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,${uniqueName},Complete description,Complete instruction,${model1};${model2};${model3},partial_credit,concept1;concept2;concept3,Expected output,Custom system prompt,1.5,10,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(0);

    // Verify the template was imported correctly
    const templates = getTemplates('created', 'desc');
    const template = templates.find((t) => t.name === uniqueName);

    expect(template).toBeDefined();
    expect(template?.description).toBe('Complete description');
    expect(template?.instruction_text).toBe('Complete instruction');
    expect(template?.model_ids).toEqual([model1, model2, model3]);
    expect(template?.accuracy_rubric).toBe('partial_credit');
    expect(template?.partial_credit_concepts).toEqual(['concept1', 'concept2', 'concept3']);
    expect(template?.expected_output).toBe('Expected output');
    expect(template?.system_prompt).toBe('Custom system prompt');
    expect(template?.temperature).toBe(1.5);
  });

  it('should handle templates with optional fields missing', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const uniqueName = `Minimal Template ${Date.now()}`;

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,${uniqueName},,Instruction here,${model1},exact_match,,Expected output,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    // Should succeed - optional fields can be empty
    expect(result.imported).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should parse CSV line with various edge cases', async () => {
    // Test the parseCSVLine function directly
    const { parseCSVLine } = await import('../../src/pages/api/templates/import.ts');

    // Simple line
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);

    // Line with quoted fields containing commas
    expect(parseCSVLine('"a,b",c,d')).toEqual(['a,b', 'c', 'd']);

    // Line with escaped quotes
    expect(parseCSVLine('"a""b",c,d')).toEqual(['a"b', 'c', 'd']);

    // Line with mixed quoted and unquoted fields
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);

    // Empty fields
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);

    // All quoted
    expect(parseCSVLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
  });

  it('should reject invalid temperature values', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const timestamp = Date.now();

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      // Temperature too high (> 2.0)
      `template-1,Invalid High ${timestamp},Description,Instruction,${model1},exact_match,,Expected,Invalid,3.5,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      // Temperature negative (< 0)
      `template-2,Invalid Low ${timestamp},Description,Instruction,${model1},exact_match,,Expected,Invalid,-0.5,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'invalid-temp.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].error).toMatch(/[Tt]emperature/);
    expect(result.errors[1].error).toMatch(/[Tt]emperature/);
  });

  it('should reject invalid system prompts', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const timestamp = Date.now();

    // Create a very long system prompt (> 10000 chars)
    const longPrompt = 'A'.repeat(10001);

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,Long Prompt ${timestamp},Description,Instruction,${model1},exact_match,,Expected,"${longPrompt}",0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'long-prompt.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toMatch(/system.?prompt/i);
  });

  it('should reject invalid accuracy_rubric values', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const timestamp = Date.now();

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,Invalid Rubric ${timestamp},Description,Instruction,${model1},invalid_rubric,,Expected,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'invalid-rubric.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain('accuracy_rubric');
  });

  it('should handle very large CSV files', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const rowCount = 100;

    const rows = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
    ];

    for (let i = 0; i < rowCount; i++) {
      rows.push(
        `template-${i},Batch Template ${i},Description ${i},Instruction ${i},${model1},exact_match,,Expected ${i},,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`
      );
    }

    const csvContent = rows.join('\n');

    const file = new File([csvContent], 'large-batch.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(rowCount);
    expect(result.failed).toBe(0);

    const templates = getTemplates('created', 'desc');
    expect(templates).toHaveLength(rowCount);
  });

  it('should handle mixed valid and invalid rows gracefully', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const timestamp = Date.now();

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      // Valid
      `template-1,Valid ${timestamp},Description,Instruction,${model1},exact_match,,Expected,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      // Invalid: missing name
      `template-2,,,Instruction,${model1},exact_match,,Expected,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      // Valid
      `template-3,Valid 2 ${timestamp},Description,Instruction,${model1},partial_credit,concept1,Expected,,0.5,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      // Invalid: wrong temperature
      `template-4,Invalid Temp ${timestamp},Description,Instruction,${model1},exact_match,,Expected,,5.0,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      // Valid
      `template-5,Valid 3 ${timestamp},Description,Instruction,${model1},semantic_similarity,,Expected,,0.7,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'mixed.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(2);

    // Verify valid templates were imported
    const templates = getTemplates('created', 'desc');
    expect(templates).toHaveLength(3);
    expect(templates.some((t) => t.name === `Valid ${timestamp}`)).toBe(true);
    expect(templates.some((t) => t.name === `Valid 2 ${timestamp}`)).toBe(true);
    expect(templates.some((t) => t.name === `Valid 3 ${timestamp}`)).toBe(true);
  });

  it('should handle CSV with various rubric types correctly', async () => {
    const model1 = '00000000-0000-1000-8000-000000000001';
    const timestamp = Date.now();

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,Exact Match ${timestamp},Description,Instruction,${model1},exact_match,,Expected,,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      `template-2,Partial Credit ${timestamp},Description,Instruction,${model1},partial_credit,concept1;concept2;concept3,Expected,,0.5,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      `template-3,Semantic Sim ${timestamp},Description,Instruction,${model1},semantic_similarity,,Expected,,0.7,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'rubrics.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(201);
    expect(result.imported).toBe(3);

    const templates = getTemplates('created', 'desc');

    const exactTemplate = templates.find((t) => t.name === `Exact Match ${timestamp}`);
    expect(exactTemplate?.accuracy_rubric).toBe('exact_match');

    const partialTemplate = templates.find((t) => t.name === `Partial Credit ${timestamp}`);
    expect(partialTemplate?.accuracy_rubric).toBe('partial_credit');
    expect(partialTemplate?.partial_credit_concepts).toEqual(['concept1', 'concept2', 'concept3']);

    const semanticTemplate = templates.find((t) => t.name === `Semantic Sim ${timestamp}`);
    expect(semanticTemplate?.accuracy_rubric).toBe('semantic_similarity');
  });
});
