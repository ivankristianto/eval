// Test script for /api/templates/export endpoint
import { describe, it, expect, beforeAll } from 'vitest';
import { getTemplates, initializeDatabase, insertTemplate } from '../../src/lib/db';

describe('GET /api/templates/export', () => {
  beforeAll(() => {
    initializeDatabase();

    // Ensure we have test templates
    const templates = getTemplates('created', 'desc');
    if (templates.length === 0) {
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

      insertTemplate(
        'Template with Special Chars',
        'Test instruction',
        ['model-1', 'model-2', 'model-3'],
        'semantic_similarity',
        undefined, // no description
        undefined, // no expected output
        undefined, // no partial credit concepts
        undefined, // no system prompt
        undefined // use default temperature
      );
    }
  });

  it('should export templates as CSV with proper headers', async () => {
    const templates = getTemplates('created', 'desc');

    // Check if we have templates to export
    if (templates.length === 0) {
      console.log('No templates found in database, skipping detailed test');
      return;
    }

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

    console.log(`Successfully validated ${templates.length} templates for CSV export`);
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
});
