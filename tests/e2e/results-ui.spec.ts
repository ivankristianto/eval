import { test, expect } from '@playwright/test';

test.describe('Results Visualization UI', () => {
  test('should display evaluation form on home page', async ({ page }) => {
    await page.goto('/');

    // Check for evaluation form
    const form = page.locator('#evaluation-form');
    await expect(form).toBeVisible();

    // Check for form elements with DaisyUI styling
    await expect(page.locator('textarea#instruction')).toBeVisible();
    await expect(page.locator('select#rubric_type')).toBeVisible();
    await expect(page.locator('textarea#expected_output')).toBeVisible();
  });

  test('should use DaisyUI Card components for form and results', async ({ page }) => {
    await page.goto('/');

    // Check for card components
    const cards = page.locator('.card');
    await expect(cards.first()).toBeVisible();

    // Should have at least 2 cards (form and results)
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);
  });

  test('should use DaisyUI form controls', async ({ page }) => {
    await page.goto('/');

    // Check textarea has DaisyUI classes
    const textarea = page.locator('textarea.textarea');
    await expect(textarea.first()).toBeVisible();

    // Check select has DaisyUI classes
    const select = page.locator('select.select');
    await expect(select.first()).toBeVisible();

    // Check button has DaisyUI classes
    const button = page.locator('button.btn');
    await expect(button.first()).toBeVisible();
  });

  test('should display empty state when no results', async ({ page }) => {
    await page.goto('/');

    // Check for empty state
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeVisible();
    await expect(page.locator('text=No evaluation results yet')).toBeVisible();
  });

  test('should use DaisyUI table for results', async ({ page }) => {
    await page.goto('/');

    // The results table should exist (hidden initially)
    const resultsContainer = page.locator('#results-container');
    await expect(resultsContainer).toBeAttached();

    // Check table structure
    const table = resultsContainer.locator('table');
    await expect(table).toBeAttached();
    await expect(table).toHaveClass(/table/);
  });

  test('should use DaisyUI alert for errors', async ({ page }) => {
    await page.goto('/');

    // Error banner should exist (hidden by default)
    const errorBanner = page.locator('#error-banner');
    await expect(errorBanner).toBeAttached();
    await expect(errorBanner).toHaveClass(/alert/);
    await expect(errorBanner).toHaveClass(/alert-error/);
  });

  test('should use DaisyUI modal for response viewer', async ({ page }) => {
    await page.goto('/');

    // Modal should exist
    const modal = page.locator('#response-modal');
    await expect(modal).toBeAttached();
    await expect(modal).toHaveClass(/modal/);
  });

  test('should have badge component for status', async ({ page }) => {
    await page.goto('/');

    // Status badge should exist (hidden by default)
    const statusBadge = page.locator('#status-badge');
    await expect(statusBadge).toBeAttached();
    await expect(statusBadge).toHaveClass(/badge/);
  });
});
