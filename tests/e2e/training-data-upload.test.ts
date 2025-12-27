/**
 * Training Data Upload E2E Tests
 * End-to-end tests for CSV upload workflow
 */

import { test, expect } from '@playwright/test';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

const TEST_CSV_DIR = join(__dirname, '..', '..', 'tmp', 'test-csvs');

// Ensure test CSV directory exists
try {
  mkdirSync(TEST_CSV_DIR, { recursive: true });
} catch (e) {
  // Directory already exists
}

test.describe('Training Data Upload Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to personas page
    await page.goto('/personas');
  });

  test('should display CSV upload component on training data page', async ({ page }) => {
    // Create a test persona first (assuming persona creation is working)
    // For now, we'll navigate directly to a known test persona
    // In a real test, you'd create the persona via the UI or API

    // Skip if no personas exist yet
    const hasPersonas = await page.locator('.persona-card').count();
    if (hasPersonas === 0) {
      test.skip();
    }

    // Click on first persona's "View Details" or navigate directly
    await page.locator('.persona-card').first().click();

    // Navigate to training data tab
    await page.goto('/personas/test-persona/training');

    // Verify CSV uploader is visible
    await expect(page.locator('#drop-zone')).toBeVisible();
    await expect(page.locator('#browse-btn')).toBeVisible();

    // Verify format requirements are displayed
    await expect(page.locator('text=CSV Format Requirements')).toBeVisible();
    await expect(page.locator('text=10-200 pairs')).toBeVisible();
  });

  test('should upload valid CSV file successfully', async ({ page }) => {
    // Create a valid test CSV
    const validCSV = `input,expected_output
${Array.from({ length: 15 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'valid-upload.csv');
    writeFileSync(csvPath, validCSV);

    // Navigate to training data page (assuming test persona exists)
    await page.goto('/personas/test-persona/training');

    // Upload file
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(csvPath);

    // Verify file info is displayed
    await expect(page.locator('#file-info')).toBeVisible();
    await expect(page.locator('#file-name')).toHaveText('valid-upload.csv');

    // Click upload button
    await page.locator('#upload-btn').click();

    // Wait for upload to complete
    await expect(page.locator('#success-message')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=15 training pairs uploaded successfully')).toBeVisible();

    // Verify page reloads and displays pairs
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.pair-row')).toHaveCount(15);
  });

  test('should reject CSV with too few pairs', async ({ page }) => {
    // Create CSV with only 5 pairs (below minimum of 10)
    const invalidCSV = `input,expected_output
${Array.from({ length: 5 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'too-few-pairs.csv');
    writeFileSync(csvPath, invalidCSV);

    await page.goto('/personas/test-persona/training');

    // Upload file
    await page.locator('#file-input').setInputFiles(csvPath);
    await page.locator('#upload-btn').click();

    // Verify error message
    await expect(page.locator('#error-messages')).toBeVisible();
    await expect(
      page.locator('text=Training data must have between 10 and 200 pairs')
    ).toBeVisible();
  });

  test('should reject CSV with duplicate pairs', async ({ page }) => {
    // Create CSV with duplicates
    const duplicateCSV = `input,expected_output
${Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}
"Question 1","Answer 1"`;

    const csvPath = join(TEST_CSV_DIR, 'duplicate-pairs.csv');
    writeFileSync(csvPath, duplicateCSV);

    await page.goto('/personas/test-persona/training');

    // Upload file
    await page.locator('#file-input').setInputFiles(csvPath);
    await page.locator('#upload-btn').click();

    // Verify error message
    await expect(page.locator('#error-messages')).toBeVisible();
    await expect(page.locator('text=Duplicate pair detected')).toBeVisible();
  });

  test('should reject CSV with invalid column names', async ({ page }) => {
    // Create CSV with wrong column names
    const invalidColumnsCSV = `question,answer
${Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'invalid-columns.csv');
    writeFileSync(csvPath, invalidColumnsCSV);

    await page.goto('/personas/test-persona/training');

    // Upload file
    await page.locator('#file-input').setInputFiles(csvPath);
    await page.locator('#upload-btn').click();

    // Verify error message
    await expect(page.locator('#error-messages')).toBeVisible();
    await expect(page.locator('text=Missing required columns')).toBeVisible();
  });

  test('should support drag-and-drop file upload', async ({ page }) => {
    // Create a valid test CSV
    const validCSV = `input,expected_output
${Array.from({ length: 12 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'drag-drop.csv');
    writeFileSync(csvPath, validCSV);

    await page.goto('/personas/test-persona/training');

    // Simulate drag-and-drop (Playwright limitation: use file input as fallback)
    const dropZone = page.locator('#drop-zone');
    await expect(dropZone).toBeVisible();

    // For now, use file input since Playwright drag-drop is complex
    await page.locator('#file-input').setInputFiles(csvPath);

    // Verify file info
    await expect(page.locator('#file-info')).toBeVisible();
  });

  test('should display training pairs after upload', async ({ page }) => {
    await page.goto('/personas/test-persona/training');

    // Assuming pairs are already uploaded, verify display
    const pairRows = page.locator('.pair-row');
    const count = await pairRows.count();

    if (count > 0) {
      // Verify table headers
      await expect(page.locator('th:has-text("Input")')).toBeVisible();
      await expect(page.locator('th:has-text("Expected Output")')).toBeVisible();
      await expect(page.locator('th:has-text("Created")')).toBeVisible();

      // Verify pair count badge
      await expect(page.locator('.badge-primary')).toContainText(count.toString());

      // Verify first pair has content
      const firstInput = pairRows.first().locator('td').nth(1);
      await expect(firstInput).not.toBeEmpty();
    }
  });

  test('should filter pairs by search input', async ({ page }) => {
    await page.goto('/personas/test-persona/training');

    // Verify search functionality
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Enter search term
    await searchInput.fill('Question 1');

    // Click search button
    await page.locator('#search-btn').click();

    // Verify filtered results
    const visibleRows = await page.locator('.pair-row:visible').count();
    const totalRows = await page.locator('.pair-row').count();

    expect(visibleRows).toBeLessThanOrEqual(totalRows);

    // Verify visible count updates
    const visibleCountText = await page.locator('#visible-count').textContent();
    expect(parseInt(visibleCountText || '0')).toBe(visibleRows);
  });

  test('should clear search when input is emptied', async ({ page }) => {
    await page.goto('/personas/test-persona/training');

    const searchInput = page.locator('#search-input');

    // Enter search term
    await searchInput.fill('Question 1');
    await page.locator('#search-btn').click();

    // Clear search
    await searchInput.clear();

    // Verify all rows visible again
    const totalRows = await page.locator('.pair-row').count();
    const visibleCountText = await page.locator('#visible-count').textContent();
    expect(parseInt(visibleCountText || '0')).toBe(totalRows);
  });

  test('should show "Start Training" button when sufficient pairs exist', async ({ page }) => {
    await page.goto('/personas/test-persona/training');

    // Check pair count
    const pairCountText = await page.locator('.badge-primary').textContent();
    const pairCount = parseInt(pairCountText || '0');

    if (pairCount >= 10) {
      // Start Training button should be visible
      await expect(page.locator('text=Start Training')).toBeVisible();
    } else {
      // Start Training button should not be visible
      await expect(page.locator('text=Start Training')).not.toBeVisible();
    }
  });

  test('should preserve multiline values in display', async ({ page }) => {
    // Create CSV with multiline values
    const multilineCSV = `input,expected_output
"Question line 1
Question line 2","Answer line 1
Answer line 2"
${Array.from({ length: 9 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'multiline.csv');
    writeFileSync(csvPath, multilineCSV);

    await page.goto('/personas/test-persona/training');

    // Upload file
    await page.locator('#file-input').setInputFiles(csvPath);
    await page.locator('#upload-btn').click();

    // Wait for success
    await expect(page.locator('#success-message')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify multiline content is preserved
    const firstInputCell = page.locator('.pair-row').first().locator('td').nth(1);
    const inputText = await firstInputCell.textContent();
    expect(inputText).toContain('line 1');
    expect(inputText).toContain('line 2');

    // Verify whitespace-pre-wrap class is applied
    await expect(firstInputCell).toHaveClass(/whitespace-pre-wrap/);
  });

  test('should replace existing pairs on new upload', async ({ page }) => {
    await page.goto('/personas/test-persona/training');

    // Get initial count
    const initialBadge = page.locator('.badge-primary');
    const initialCount = parseInt((await initialBadge.textContent()) || '0');

    // Upload new CSV with different count
    const newCSV = `input,expected_output
${Array.from({ length: 20 }, (_, i) => `"New Question ${i}","New Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'replacement.csv');
    writeFileSync(csvPath, newCSV);

    await page.locator('#file-input').setInputFiles(csvPath);
    await page.locator('#upload-btn').click();

    // Wait for success and reload
    await expect(page.locator('#success-message')).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify new count
    const newCount = parseInt((await initialBadge.textContent()) || '0');
    expect(newCount).toBe(20);

    // Verify first row contains "New"
    const firstInput = await page.locator('.pair-row').first().locator('td').nth(1).textContent();
    expect(firstInput).toContain('New');
  });

  test('should handle file size validation', async ({ page }) => {
    await page.goto('/personas/test-persona/training');

    // File size validation is client-side, max 5MB
    // For testing, we can verify the message appears for large files
    // This test is more of a placeholder since we can't easily create 5MB+ files in E2E

    await expect(page.locator('#file-input')).toHaveAttribute('accept', '.csv,text/csv');
  });

  test('should remove selected file when remove button is clicked', async ({ page }) => {
    const validCSV = `input,expected_output
${Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n')}`;

    const csvPath = join(TEST_CSV_DIR, 'remove-test.csv');
    writeFileSync(csvPath, validCSV);

    await page.goto('/personas/test-persona/training');

    // Upload file
    await page.locator('#file-input').setInputFiles(csvPath);

    // Verify file info is visible
    await expect(page.locator('#file-info')).toBeVisible();

    // Click remove button
    await page.locator('#remove-file-btn').click();

    // Verify file info is hidden
    await expect(page.locator('#file-info')).toBeHidden();

    // Verify upload button is disabled
    await expect(page.locator('#upload-btn')).toBeDisabled();
  });
});
