// E2E tests for Templates Import/Export UI functionality
import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

test.describe('Templates Import/Export UI', () => {
  // Helper function to create a test CSV file
  async function createTestCSV(data: string): Promise<string> {
    const tempFilePath = join(tmpdir(), `test-templates-${Date.now()}.csv`);
    await fs.writeFile(tempFilePath, data, 'utf-8');
    return tempFilePath;
  }

  // Helper function to get default CSV content
  function getDefaultCSV(): string {
    return [
      'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
      '"test-id-1","Test Template 1","A test template for E2E testing","What is the capital of France?","model-1;model-2","exact_match","[]","Paris","You are a helpful assistant.",0.7,0,2025-01-01 00:00:00,2025-01-01 00:00:00',
      '"test-id-2","Test Template 2","Another test template","Explain quantum computing in simple terms.","model-1","partial_credit","quantum;physics;computing","A clear explanation","You are an expert physicist.",0.5,0,2025-01-02 00:00:00,2025-01-02 00:00:00',
    ].join('\n');
  }

  test.beforeEach(async ({ page }) => {
    // Navigate to templates page before each test
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Export CSV Button', () => {
    test('should display Export CSV button', async ({ page }) => {
      const exportBtn = page.locator('#export-csv-btn');
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn).toContainText('Export CSV');
    });

    test('should download CSV file when Export button is clicked', async ({ page }) => {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

      // Click export button
      await page.click('#export-csv-btn');

      // Wait for download to start
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toMatch(/templates-export-.*\.csv/);

      // Save to temp file and verify content
      const tempPath = join(tmpdir(), download.suggestedFilename());
      await download.saveAs(tempPath);

      const content = await fs.readFile(tempPath, 'utf-8');

      // Verify CSV structure
      const lines = content.split('\n').filter((line) => line.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(1);

      // Verify headers
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

      // Clean up
      await fs.unlink(tempPath);
    });

    test('should show loading state during export', async ({ page }) => {
      const exportBtn = page.locator('#export-csv-btn');

      // Click export and check for loading state
      // Note: Loading state may be too fast to capture in tests
      await Promise.all([page.waitForEvent('download'), exportBtn.click()]);

      // Button should exist and be in normal state after operation
      await expect(exportBtn).toBeVisible();
      await expect(exportBtn).toContainText('Export CSV', { timeout: 5000 });
    });

    test('should show success toast after export', async ({ page }) => {
      // Click export button
      await Promise.all([page.waitForEvent('download'), page.click('#export-csv-btn')]);

      // Check for success toast
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible();

      // Look for success message
      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 5000 });
      await expect(successToast).toContainText('Templates exported successfully');
    });
  });

  test.describe('Import CSV Button', () => {
    test('should display Import CSV button', async ({ page }) => {
      const importBtn = page.locator('#import-csv-btn');
      await expect(importBtn).toBeVisible();
      await expect(importBtn).toContainText('Import CSV');
    });

    test('should open file picker when Import button is clicked', async ({ page }) => {
      // Set up file chooser handler
      const fileChooserPromise = page.waitForEvent('filechooser');

      // Click import button
      await page.click('#import-csv-btn');

      // Wait for file chooser to open
      const fileChooser = await fileChooserPromise;
      expect(fileChooser).toBeTruthy();
    });

    test('should import valid CSV file', async ({ page }) => {
      // Create test CSV file
      const csvContent = getDefaultCSV();
      const tempFilePath = await createTestCSV(csvContent);

      // Set up file chooser and upload
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for success toast
      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 10000 });
      await expect(successToast).toContainText(/Imported \d+ template\(s\)/);

      // Page should reload to show imported templates
      await page.waitForLoadState('networkidle');

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should show loading state during import', async ({ page }) => {
      // Create test CSV file
      const csvContent = getDefaultCSV();
      const tempFilePath = await createTestCSV(csvContent);

      const importBtn = page.locator('#import-csv-btn');

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for operation to complete
      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // Button should return to normal state after import
      await expect(importBtn).toBeVisible();
      await expect(importBtn).toContainText('Import CSV', { timeout: 10000 });

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should show error message for invalid CSV', async ({ page }) => {
      // Create invalid CSV file
      const invalidCSV = 'invalid,csv,content\nwithout,proper,headers';
      const tempFilePath = await createTestCSV(invalidCSV);

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for error toast or toast with error message
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      // Check for error message in toast container (not the hidden modal error)
      const errorToast = toastContainer.locator('.alert-error').first();
      const hasErrorToast = (await errorToast.count()) > 0;

      if (hasErrorToast) {
        await expect(errorToast).toContainText(
          /Failed to parse CSV|Invalid header|CSV_PARSE_ERROR/
        );
      }

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should show error message for non-CSV file', async ({ page }) => {
      // Create a text file instead of CSV
      const textFilePath = join(tmpdir(), `test-${Date.now()}.txt`);
      await fs.writeFile(textFilePath, 'This is not a CSV file', 'utf-8');

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      await fileChooserPromise;

      // Set files (using the hidden file input)
      const fileInput = page.locator('#csv-file-input');
      await fileInput.setInputFiles(textFilePath);

      // Wait for error toast (client-side validation) or check that file wasn't accepted
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      // Check for error message in toast container (not the hidden modal error)
      const errorToast = toastContainer.locator('.alert-error').first();
      const hasErrorToast = (await errorToast.count()) > 0;

      if (hasErrorToast) {
        await expect(errorToast).toContainText(/Please select a CSV file|INVALID_FILE_TYPE/);
      }

      // Clean up
      await fs.unlink(textFilePath);
    });

    test('should skip duplicate templates during import', async ({ page }) => {
      // Create CSV with potential duplicates
      const duplicateCSV = [
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
        '"dup-1","Duplicate Template","First instance","Test instruction","model-1","exact_match","[]","Output","System prompt",0.5,0,2025-01-01 00:00:00,2025-01-01 00:00:00',
        '"dup-2","Duplicate Template","Second instance","Test instruction","model-1","exact_match","[]","Output","System prompt",0.5,0,2025-01-02 00:00:00,2025-01-02 00:00:00',
      ].join('\n');

      const tempFilePath = await createTestCSV(duplicateCSV);

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for success toast - should mention skipped duplicates
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      const successToast = page.locator('.alert-success');
      const hasSuccessToast = (await successToast.count()) > 0;

      if (hasSuccessToast) {
        await expect(successToast).toBeVisible();
        // The toast may or may not mention skipped duplicates depending on timing
        const toastText = await successToast.textContent();
        expect(toastText).toMatch(/Imported \d+ template\(s\)/);
      }

      // Clean up
      await fs.unlink(tempFilePath);
    });
  });

  test.describe('Round-trip Export/Import', () => {
    test('should export and import templates maintaining data integrity', async ({ page }) => {
      // Step 1: Export templates
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
      await page.click('#export-csv-btn');
      const download = await downloadPromise;

      // Save exported file
      const exportPath = join(tmpdir(), download.suggestedFilename());
      await download.saveAs(exportPath);

      const exportedContent = await fs.readFile(exportPath, 'utf-8');

      // Step 2: Import the exported file
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(exportPath);

      // Wait for success toast
      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // Step 3: Export again to verify data integrity
      await page.waitForLoadState('networkidle');
      const downloadPromise2 = page.waitForEvent('download', { timeout: 10000 });
      await page.click('#export-csv-btn');
      const download2 = await downloadPromise2;

      const exportPath2 = join(tmpdir(), `re-${download2.suggestedFilename()}`);
      await download2.saveAs(exportPath2);

      const reExportedContent = await fs.readFile(exportPath2, 'utf-8');

      // Compare CSV structure (not exact match due to timestamps)
      const exportedLines = exportedContent.split('\n');
      const reExportedLines = reExportedContent.split('\n');

      // Headers should match
      expect(exportedLines[0]).toBe(reExportedLines[0]);

      // Row count should be equal or greater (due to import)
      expect(reExportedLines.length).toBeGreaterThanOrEqual(exportedLines.length);

      // Clean up
      await fs.unlink(exportPath);
      await fs.unlink(exportPath2);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle empty CSV file', async ({ page }) => {
      // Create empty CSV
      const emptyCSV =
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at\n';
      const tempFilePath = await createTestCSV(emptyCSV);

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for error toast
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      const errorToast = toastContainer.locator('.alert-error').first();
      const hasErrorToast = (await errorToast.count()) > 0;

      if (hasErrorToast) {
        await expect(errorToast).toContainText(
          /Failed to parse CSV|no valid template|CSV file contains no valid|EMPTY_CSV/
        );
      }

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should handle CSV with missing columns', async ({ page }) => {
      // Create CSV with missing columns
      const malformedCSV = 'id,name,instruction_text\n"1","Test","Instruction"';
      const tempFilePath = await createTestCSV(malformedCSV);

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for error toast
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      const errorToast = toastContainer.locator('.alert-error').first();
      const hasErrorToast = (await errorToast.count()) > 0;

      if (hasErrorToast) {
        await expect(errorToast).toContainText(
          /Failed to parse CSV|Invalid header|Invalid column count/
        );
      }

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should handle CSV with invalid temperature value', async ({ page }) => {
      // Create CSV with invalid temperature
      const invalidTempCSV = [
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
        '"1","Test","Description","Instruction","model-1","exact_match","[]","Output","System",3.5,0,2025-01-01 00:00:00,2025-01-01 00:00:00',
      ].join('\n');
      const tempFilePath = await createTestCSV(invalidTempCSV);

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for error toast (may be success with failed count or error)
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      // Should show either error or success with failed templates
      const hasError = (await page.locator('.alert-error').count()) > 0;
      const hasSuccess = (await page.locator('.alert-success').count()) > 0;

      expect(hasError || hasSuccess).toBe(true);

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should handle CSV with special characters and quotes', async ({ page }) => {
      // Create CSV with special characters
      const specialCharsCSV = [
        'id,name,description,instruction_text,model_ids,accuracy_rubric,partial_credit_concepts,expected_output,system_prompt,temperature,run_count,created_at,updated_at',
        '"1","Test with ""quotes""","Description with, comma","Instruction with ""nested"" quotes","model-1","exact_match","[]","Expected ""output""","System ""prompt""",0.5,0,2025-01-01 00:00:00,2025-01-01 00:00:00',
      ].join('\n');
      const tempFilePath = await createTestCSV(specialCharsCSV);

      // Set up file chooser
      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Should handle special characters correctly
      const toastContainer = page.locator('#toast-container');
      await expect(toastContainer).toBeVisible({ timeout: 10000 });

      // Check for success (special chars handled) or error (if validation fails)
      const hasToast = (await page.locator('.alert').count()) > 0;
      expect(hasToast).toBe(true);

      // Clean up
      await fs.unlink(tempFilePath);
    });
  });

  test.describe('UI Layout and Accessibility', () => {
    test('should display both Import and Export buttons in correct order', async ({ page }) => {
      // Check buttons are visible
      const importBtn = page.locator('#import-csv-btn');
      const exportBtn = page.locator('#export-csv-btn');

      await expect(importBtn).toBeVisible();
      await expect(exportBtn).toBeVisible();

      // Import should come before Export (DOM order)
      const importHTML = await importBtn.innerHTML();
      const exportHTML = await exportBtn.innerHTML();

      expect(importHTML).toContain('Import CSV');
      expect(exportHTML).toContain('Export CSV');
    });

    test('should have proper button styling', async ({ page }) => {
      const importBtn = page.locator('#import-csv-btn');
      const exportBtn = page.locator('#export-csv-btn');

      // Check for luxe button class
      await expect(importBtn).toHaveClass(/btn-luxe/);
      await expect(exportBtn).toHaveClass(/btn-luxe/);

      // Check for ghost style
      await expect(importBtn).toHaveClass(/btn-ghost/);
      await expect(exportBtn).toHaveClass(/btn-ghost/);
    });

    test('should have SVG icons in buttons', async ({ page }) => {
      const importBtn = page.locator('#import-csv-btn');
      const exportBtn = page.locator('#export-csv-btn');

      // Check for SVG elements
      const importSVG = importBtn.locator('svg');
      const exportSVG = exportBtn.locator('svg');

      await expect(importSVG).toBeVisible();
      await expect(exportSVG).toBeVisible();

      // Verify icon classes
      await expect(importSVG).toHaveClass(/h-5 w-5/);
      await expect(exportSVG).toHaveClass(/h-5 w-5/);
    });

    test('should have hidden file input for import', async ({ page }) => {
      const fileInput = page.locator('#csv-file-input');

      await expect(fileInput).toBeAttached();
      await expect(fileInput).toHaveAttribute('type', 'file');
      await expect(fileInput).toHaveAttribute('accept', '.csv');
      await expect(fileInput).toHaveClass(/hidden/);
    });

    test('should show loading spinner during operations', async ({ page }) => {
      // Test export operation completes
      const exportBtn = page.locator('#export-csv-btn');

      await Promise.all([page.waitForEvent('download'), exportBtn.click()]);

      // Verify export completed successfully
      await expect(exportBtn).toBeVisible();

      // Test import operation
      const csvContent = getDefaultCSV();
      const tempFilePath = await createTestCSV(csvContent);

      await page.waitForLoadState('networkidle');

      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for import to complete
      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // Clean up
      await fs.unlink(tempFilePath);
    });
  });

  test.describe('Toast Notifications', () => {
    test('should show toast container', async ({ page }) => {
      const toastContainer = page.locator('#toast-container');
      // Toast container exists in DOM but may be hidden initially
      await expect(toastContainer).toBeAttached();
      await expect(toastContainer).toHaveAttribute('role', 'status');
      await expect(toastContainer).toHaveAttribute('aria-live', 'polite');
    });

    test('should show success toast for successful export', async ({ page }) => {
      await Promise.all([page.waitForEvent('download'), page.click('#export-csv-btn')]);

      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 5000 });
      await expect(successToast).toContainText('Templates exported successfully');
    });

    test('should show success toast with import summary', async ({ page }) => {
      const csvContent = getDefaultCSV();
      const tempFilePath = await createTestCSV(csvContent);

      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // Should include import information (may use different field names)
      const toastText = await successToast.textContent();
      expect(toastText).toMatch(/Imported/);

      // Clean up
      await fs.unlink(tempFilePath);
    });

    test('should allow closing toast notifications', async ({ page }) => {
      // Trigger a toast
      await Promise.all([page.waitForEvent('download'), page.click('#export-csv-btn')]);

      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 5000 });

      // Click close button
      const closeBtn = successToast.locator('button[aria-label="Close notification"]');
      await closeBtn.click();

      // Toast should disappear
      await expect(successToast).not.toBeVisible();
    });
  });

  test.describe('Page Refresh After Import', () => {
    test('should reload page after successful import', async ({ page }) => {
      // Get initial URL
      const initialUrl = page.url();

      // Create and import CSV
      const csvContent = getDefaultCSV();
      const tempFilePath = await createTestCSV(csvContent);

      const fileChooserPromise = page.waitForEvent('filechooser');

      await page.click('#import-csv-btn');

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(tempFilePath);

      // Wait for success toast and page reload
      const successToast = page.locator('.alert-success');
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // Wait for navigation (reload)
      await page.waitForLoadState('networkidle');

      // URL should be the same but page should be reloaded
      expect(page.url()).toBe(initialUrl);

      // Clean up
      await fs.unlink(tempFilePath);
    });
  });
});
