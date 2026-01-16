import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Bulk Evaluation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to bulk evaluation page
    await page.goto('/bulk-eval');
  });

  test('should display bulk evaluation page header and steps indicator', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1:has-text("Bulk Evaluation")')).toBeVisible();

    // Check description
    await expect(
      page.locator('text=Upload CSV data, configure models, and run bulk evaluations')
    ).toBeVisible();

    // Check workflow steps indicator
    await expect(page.locator('[data-step="1"]')).toBeVisible();
    await expect(page.locator('[data-step="2"]')).toBeVisible();
    await expect(page.locator('[data-step="3"]')).toBeVisible();

    // Verify step labels
    await expect(page.locator('[data-step="1"] .step-label:has-text("Upload")')).toBeVisible();
    await expect(page.locator('[data-step="2"] .step-label:has-text("Configure")')).toBeVisible();
    await expect(page.locator('[data-step="3"] .step-label:has-text("Results")')).toBeVisible();
  });

  test('should upload CSV file and transition to configuration step', async ({ page }) => {
    // Read test CSV file
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');

    // Find the file input and upload the file
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Upload the file
    await fileInput.setInputFiles(csvPath);

    // Wait for upload to complete and transition to configuration step
    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    // Verify step indicator updated
    await expect(page.locator('[data-step="1"] .step-badge')).toHaveClass(/bg-luxe-emerald/);
    await expect(page.locator('[data-step="2"] .step-badge')).toHaveClass(/step-badge-active/);

    // Verify configuration panel is visible
    await expect(page.locator('h3:has-text("Evaluation Configuration")')).toBeVisible();
  });

  test('should configure evaluation and trigger run', async ({ page }) => {
    // Upload CSV file first
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for configuration step
    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    // Configure system prompt
    const systemPrompt = page.locator('#system-prompt');
    await expect(systemPrompt).toBeVisible();
    await systemPrompt.fill(
      'Analyze the following product information and provide a brief summary. Product: {product}, Description: {description}, Price: {price}'
    );

    // Set temperature
    const temperatureSlider = page.locator('#temperature');
    await temperatureSlider.evaluate((el) => ((el as HTMLInputElement).value = '0.7'));

    // Check if models are available
    const modelCheckboxes = page.locator('input[name="model_ids"]');
    const modelCount = await modelCheckboxes.count();

    if (modelCount === 0) {
      // Skip test if no models are configured
      test.skip(true, 'No models configured for testing');
      return;
    }

    // Select at least one model
    await modelCheckboxes.first().check();

    // Submit the configuration
    const submitBtn = page.locator('#submit-btn');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for transition to results step
    await expect(page.locator('#step-results')).toBeVisible({ timeout: 15000 });

    // Verify step indicator updated
    await expect(page.locator('[data-step="3"] .step-badge')).toHaveClass(/step-badge-active/);
  });

  test('should show evaluation status and progress during execution', async ({ page }) => {
    // Upload and configure evaluation
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    await page.locator('#system-prompt').fill('Summarize this product: {product} - {description}');
    await page.locator('input[name="model_ids"]').first().check();
    await page.locator('#submit-btn').click();

    // Wait for results step and status bar
    await expect(page.locator('#step-results')).toBeVisible({ timeout: 15000 });

    // Check if status bar appears (may be hidden if evaluation completes quickly)
    const statusBar = page.locator('#status-bar');
    const isStatusBarVisible = await statusBar.isVisible().catch(() => false);

    if (isStatusBarVisible) {
      // Verify status bar elements
      await expect(statusBar.locator('text=Evaluating...')).toBeVisible();
      await expect(page.locator('#progress-bar')).toBeAttached();
      await expect(page.locator('#progress-text')).toBeAttached();
    }
  });

  test('should display results in table after completion', async ({ page }) => {
    // Upload and configure evaluation
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    await page.locator('#system-prompt').fill('Summarize this product: {product} - {description}');
    await page.locator('input[name="model_ids"]').first().check();
    await page.locator('#submit-btn').click();

    // Wait for results step
    await expect(page.locator('#step-results')).toBeVisible({ timeout: 15000 });

    // Wait for results table to appear (polling completes)
    await expect(async () => {
      const resultsTableLocator = page.locator('#results-table');
      const isVisible = await resultsTableLocator.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    }).toPass({ timeout: 60000 }); // Increased timeout for evaluation completion

    // Verify table structure
    const resultsTable = page.locator('#results-table');
    await expect(resultsTable).toBeVisible();

    // Check for expected headers (CSV columns + model output columns)
    await expect(resultsTable.locator('th:has-text("#")')).toBeVisible();
    await expect(resultsTable.locator('th:has-text("product")')).toBeVisible();
    await expect(resultsTable.locator('th:has-text("description")')).toBeVisible();
    await expect(resultsTable.locator('th:has-text("price")')).toBeVisible();
    await expect(resultsTable.locator('th:has-text("category")')).toBeVisible();

    // Check for model output column
    await expect(resultsTable.locator('th:has-text("Output")')).toBeVisible();

    // Verify data rows are present
    const tableBody = resultsTable.locator('tbody');
    const tableRows = tableBody.locator('tr');
    await expect(tableRows.first()).toBeVisible();
  });

  test('should open detail drawer when clicking on model output cell', async ({ page }) => {
    // Upload and configure evaluation
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    await page.locator('#system-prompt').fill('Summarize this product: {product} - {description}');
    await page.locator('input[name="model_ids"]').first().check();
    await page.locator('#submit-btn').click();

    // Wait for results table
    await expect(page.locator('#results-table')).toBeVisible({ timeout: 60000 });

    // Click on the first model output cell
    const firstOutputCell = page
      .locator('#results-table tbody tr')
      .first()
      .locator('td[data-model-id]')
      .first();
    const hasOutputCell = (await firstOutputCell.count()) > 0;

    if (hasOutputCell) {
      await firstOutputCell.click();

      // Verify detail drawer appears
      const drawer = page.locator('#detail-drawer');
      await expect(drawer).toBeVisible({ timeout: 5000 });

      // Verify drawer contains expected content
      await expect(drawer.locator('h3:has-text("Row Details")')).toBeAttached();
    }
  });

  test('should validate system prompt template syntax', async ({ page }) => {
    // Upload CSV file
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    // Verify template syntax examples are shown
    await expect(page.locator('text=Template Syntax:')).toBeVisible();
    await expect(page.locator('text={column_name}')).toBeVisible();

    // Verify examples are displayed
    await expect(page.locator('text=Examples:')).toBeVisible();
    await expect(page.locator('text=Summarize the {description} field')).toBeVisible();
  });

  test('should handle temperature slider interaction', async ({ page }) => {
    // Upload CSV file to reach config step
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    // Verify temperature slider
    const temperatureSlider = page.locator('#temperature');
    await expect(temperatureSlider).toBeVisible();

    // Verify temperature value display
    const temperatureValue = page.locator('#temperature-value');
    await expect(temperatureValue).toBeVisible();
    await expect(temperatureValue).toHaveText('0.7');

    // Move slider and verify value updates
    await temperatureSlider.evaluate((el) => ((el as HTMLInputElement).value = '0.5'));
    await temperatureSlider.dispatchEvent('input');

    // Wait for value update
    await expect(async () => {
      const text = await temperatureValue.textContent();
      expect(text).toBe('0.5');
    }).toPass({ timeout: 2000 });
  });

  test('should reset form configuration', async ({ page }) => {
    // Upload CSV file
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    // Fill in form
    await page.locator('#system-prompt').fill('Test prompt with {column}');
    await page.locator('input[name="model_ids"]').first().check();

    // Click reset button
    const resetBtn = page.locator('#reset-btn');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify form is reset
    await expect(page.locator('#system-prompt')).toHaveValue('');
    const checkedCheckboxes = await page.locator('input[name="model_ids"]:checked').count();
    expect(checkedCheckboxes).toBe(0);
  });

  test('should show validation error when no models selected', async ({ page }) => {
    // Upload CSV file
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10000 });

    // Fill system prompt but don't select models
    await page.locator('#system-prompt').fill('Test prompt');

    // Try to submit
    const submitBtn = page.locator('#submit-btn');
    await submitBtn.click();

    // Verify error message appears
    const errorDiv = page.locator('#config-error');
    await expect(errorDiv).toBeVisible();
    await expect(errorDiv.locator('text=Please select at least one model')).toBeVisible();
  });

  test('should display new evaluation button after completion', async ({ page }) => {
    // Upload and configure evaluation
    const csvPath = join(__dirname, 'fixtures', 'bulk-eval-test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.locator('#step-config')).toBeVisible({ timeout: 10_000 });

    await page.locator('#system-prompt').fill('Summarize: {product}');
    await page.locator('input[name="model_ids"]').first().check();
    await page.locator('#submit-btn').click();

    // Wait for results
    await expect(page.locator('#results-table')).toBeVisible({ timeout: 60_000 });

    // Verify new evaluation button is visible
    const newEvalBtn = page.locator('#new-eval-btn');
    await expect(newEvalBtn).toBeVisible();

    // Click new evaluation button and verify reset
    await newEvalBtn.click();
    await expect(page.locator('#step-upload')).toBeVisible();
  });
});
