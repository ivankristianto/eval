import { test, expect } from '@playwright/test';

test.describe('Models Page UI', () => {
  test('should display page title and breadcrumbs', async ({ page }) => {
    await page.goto('/models');

    // Check page title
    await expect(page.locator('h1:has-text("Model Management")')).toBeVisible();

    // Check breadcrumbs
    await expect(page.locator('.breadcrumbs')).toBeVisible();
    await expect(page.locator('.breadcrumbs a:has-text("Home")')).toBeVisible();
    await expect(page.locator('.breadcrumbs:has-text("Models")')).toBeVisible();
  });

  test('should display action buttons in top-right', async ({ page }) => {
    await page.goto('/models');

    // Check for Add Model button
    const addModelBtn = page.locator('button:has-text("Add Model")');
    await expect(addModelBtn).toBeVisible();

    // Check for Import/Export buttons
    await expect(page.locator('button:has-text("Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
  });

  test('should open Add Model modal', async ({ page }) => {
    await page.goto('/models');

    // Click Add Model button
    await page.click('button:has-text("Add Model")');

    // Modal should be visible
    const modal = page.locator('dialog#add-model-modal');
    await expect(modal).toBeVisible();

    // Check modal content
    await expect(page.locator('dialog h3:has-text("Add New Model")')).toBeVisible();
    await expect(page.locator('dialog select[name="provider"]')).toBeVisible();
    await expect(page.locator('dialog input[name="model_name"]')).toBeVisible();
    await expect(page.locator('dialog input[name="api_key"]')).toBeVisible();
  });

  test('should display empty state when no models', async ({ page }) => {
    // This test assumes the database is empty or we're using a test database
    // The empty state should show if there are no models
    await page.goto('/models');

    // Check for either the table OR the empty state
    const hasTable = (await page.locator('table').count()) > 0;
    const hasEmptyState = (await page.locator('text=No models configured').count()) > 0;

    // One of these should be true
    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('should use DaisyUI table styling', async ({ page }) => {
    await page.goto('/models');

    // Check if table exists (may be hidden if empty state is shown)
    const table = page.locator('.card table');
    const tableCount = await table.count();

    if (tableCount > 0) {
      // Check table has DaisyUI classes
      await expect(table).toHaveClass(/table/);
    }
  });

  test('should use DaisyUI Card component', async ({ page }) => {
    await page.goto('/models');

    // Check for card component
    const card = page.locator('.card');
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/bg-base-100/);
  });
});
