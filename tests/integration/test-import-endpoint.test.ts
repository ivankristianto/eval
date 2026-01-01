// Test script for POST /api/templates/import endpoint
import { describe, it, expect, beforeAll } from 'vitest';
import { initializeDatabase, getTemplates, insertTemplate } from '../../src/lib/db';

describe('POST /api/templates/import', () => {
  beforeAll(() => {
    initializeDatabase();
  });

  it('should parse CSV with proper escaping', async () => {
    // Test CSV parsing with special characters
    // Using valid UUIDs for model_ids
    const model1 = '00000000-0000-0000-0000-000000000001';
    const model2 = '00000000-0000-0000-0000-000000000002';
    const model3 = '00000000-0000-0000-0000-000000000003';
    const timestamp = Date.now();

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,Simple Template ${timestamp},A simple description,This is a simple instruction,${model1};${model2},exact_match,,,Expected output,,,0,0.3,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
      `template-2,"Template with, comma ${timestamp}",Description with "quotes",Instruction with "quotes" and, commas,${model3},partial_credit,concept 1;concept 2,Expected with "quotes",System prompt,0.7,5,2024-01-02T00:00:00.000Z,2024-01-02T00:00:00.000Z`,
      `template-3,"Template with quotes and comma ${timestamp}","Description with ""escaped"" quotes","Instruction with ""quotes"" and commas",${model1};${model2},semantic_similarity,,,Expected,,,0,0.5,2024-01-03T00:00:00.000Z,2024-01-03T00:00:00.000Z`,
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
    const response = await POST({ request } as { request: Request });

    // Check response status
    expect(response.status).toBe(200);

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

    const quotesTemplate = templates.find((t) => t.name === `Template with quotes and comma ${timestamp}`);
    expect(quotesTemplate).toBeDefined();
    expect(quotesTemplate?.description).toBe('Description with "escaped" quotes');
    expect(quotesTemplate?.instruction_text).toBe('Instruction with "quotes" and commas');
  });

  it('should skip duplicate template names', async () => {
    const model1 = '00000000-0000-0000-0000-000000000001';
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
      `template-1,${uniqueName},This is a duplicate,Instruction,${model1},exact_match,,,Expected,,,0,0.3,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as { request: Request });
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
    const response = await POST({ request } as { request: Request });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('CSV_PARSE_ERROR');
    expect(result.details).toBeDefined();
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('should reject invalid template data', async () => {
    // CSV with missing required fields
    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      'template-1,,,Missing name and instruction,,,exact_match,,,Expected,,,0,0.3,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z',
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as { request: Request });
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

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
    const response = await POST({ request } as { request: Request });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('CSV_PARSE_ERROR');
  });

  it('should reject missing file', async () => {
    const formData = new FormData();
    // No file added

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as { request: Request });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('INVALID_INPUT');
    expect(result.message).toBe('No file provided');
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
    const response = await POST({ request } as { request: Request });
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('INVALID_FILE_TYPE');
  });

  it('should import templates with all field types', async () => {
    const model1 = '00000000-0000-0000-0000-000000000001';
    const model2 = '00000000-0000-0000-0000-000000000002';
    const model3 = '00000000-0000-0000-0000-000000000003';
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
    const response = await POST({ request } as { request: Request });
    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(200);
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
    const model1 = '00000000-0000-0000-0000-000000000001';
    const uniqueName = `Minimal Template ${Date.now()}`;

    const csvContent = [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      `template-1,${uniqueName},,Instruction here,${model1},exact_match,,,Expected output,0.3,0,2024-01-01T00:00:00.000Z,2024-01-01T00:00:00.000Z`,
    ].join('\n');

    const file = new File([csvContent], 'test-templates.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/templates/import', {
      method: 'POST',
      body: formData,
    });

    const { POST } = await import('../../src/pages/api/templates/import.ts');
    const response = await POST({ request } as { request: Request });

    console.log('Response status:', response.status);

    // Debug: check response
    if (response.status !== 200) {
      const errorResult = await response.clone().json();
      console.error('Error response:', JSON.stringify(errorResult, null, 2));
    }

    const result = (await response.json()) as {
      imported: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; name: string; error: string }>;
    };

    expect(response.status).toBe(200);
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
});
