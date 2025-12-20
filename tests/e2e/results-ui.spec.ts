import { test, expect } from '@playwright/test';

test.describe('Results Visualization UI', () => {
  test('should display Evaluation Results heading on home page', async ({ page }) => {
    await page.goto('/');

    // Check for results heading
    await expect(page.locator('h1:has-text("Evaluation Results")')).toBeVisible();
  });

  test('should use DaisyUI Card component for results', async ({ page }) => {
    await page.goto('/');

    // Check for card component
    const card = page.locator('.card');
    await expect(card.first()).toBeVisible();
  });

  test('should display empty state when no results', async ({ page }) => {
    await page.goto('/');

    // Check for empty state
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeVisible();
    await expect(page.locator('text=No evaluation results yet')).toBeVisible();
    await expect(page.locator('text=Click "New Evaluation" to compare AI models')).toBeVisible();
  });

  test('should have results table structure', async ({ page }) => {
    await page.goto('/');

    // Results table should exist (hidden when no results)
    const resultsContainer = page.locator('#results-container');
    await expect(resultsContainer).toBeAttached();

    // Check table structure
    const table = resultsContainer.locator('table');
    await expect(table).toBeAttached();
    await expect(table).toHaveClass(/table/);
  });

  test('should have correct table columns', async ({ page }) => {
    await page.goto('/');

    // Check table headers
    const headers = page.locator('#results-container th');
    const expectedHeaders = ['Model Name', 'Status', 'Time (ms)', 'Total Tokens', 'Accuracy Score'];

    for (const header of expectedHeaders) {
      await expect(page.locator(`#results-container th:has-text("${header}")`)).toBeAttached();
    }
  });

  test('should have evaluation details drawer', async ({ page }) => {
    await page.goto('/');

    // Details drawer should exist (hidden by default)
    const drawer = page.locator('#details-drawer');
    await expect(drawer).toBeAttached();

    // Should be off-screen initially
    await expect(drawer).toHaveClass(/translate-x-full/);
  });

  test('should have polling state element', async ({ page }) => {
    await page.goto('/');

    // Polling state should exist (hidden by default)
    const pollingState = page.locator('#polling-state');
    await expect(pollingState).toBeAttached();
    await expect(pollingState).toHaveClass(/hidden/);
  });

  test('should have Save as Template button (hidden by default)', async ({ page }) => {
    await page.goto('/');

    // Save as Template button should exist
    const saveTemplateBtn = page.locator('#save-template-btn');
    await expect(saveTemplateBtn).toBeAttached();
    await expect(saveTemplateBtn).toHaveClass(/hidden/);
  });
});
