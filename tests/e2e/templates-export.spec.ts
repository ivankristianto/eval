// E2E test for /api/templates/export endpoint
import { test, expect } from '@playwright/test';

test.describe('GET /api/templates/export', () => {
  test('should export templates as CSV file', async ({ request }) => {
    const response = await request.get('/api/templates/export');

    expect(response.status()).toBe(200);

    // Check content type is CSV
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/csv');

    // Check content disposition header
    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toMatch(/filename="templates-export-.*\.csv"/);

    // Get CSV content
    const csvContent = await response.text();

    // Verify CSV has content
    expect(csvContent.length).toBeGreaterThan(0);

    // Verify CSV structure
    const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

    // First line should be headers
    const headers = lines[0];
    expect(headers).toContain('id');
    expect(headers).toContain('name');
    expect(headers).toContain('description');
    expect(headers).toContain('instruction_text');
    expect(headers).toContain('model_ids');
    expect(headers).toContain('accuracy_rubric');
    expect(headers).toContain('partial_credit_concepts');
    expect(headers).toContain('expected_output');
    expect(headers).toContain('system_prompt');
    expect(headers).toContain('temperature');
    expect(headers).toContain('run_count');
    expect(headers).toContain('created_at');
    expect(headers).toContain('updated_at');

    // If there are templates, verify data rows
    if (lines.length > 1) {
      // At least one data row
      expect(lines.length).toBeGreaterThan(1);

      // Verify data rows are not empty
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i].trim().length).toBeGreaterThan(0);
        // Each row should have at least some content (commas, quotes, data)
        expect(lines[i].length).toBeGreaterThan(10);
      }
    }
  });

  test('should handle empty templates list', async ({ request }) => {
    // This test assumes the database might be empty
    const response = await request.get('/api/templates/export');

    expect(response.status()).toBe(200);

    const csvContent = await response.text();
    const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

    // Should at least have headers
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // First line should be headers
    expect(lines[0]).toContain('id,name');
  });
});
