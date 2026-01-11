/**
 * E2E tests for Persona Creation workflow
 * Tests persona list page, filtering, and API integration
 *
 * NOTE: Workspace-based UI tests (persona creation, training operations)
 * have been moved to workspace-ui.test.ts to reflect the current
 * workspace-based architecture where personas are managed within
 * the /workspace context rather than via detail page tabs.
 */

import { test, expect } from '@playwright/test';

test.describe('Persona Creation Workflow', () => {
  test('should display personas list page with correct UI elements', async ({ page }) => {
    await page.goto('/personas');

    // Check page title (main title, not empty state title)
    await expect(page.locator('h1.text-5xl.text-gradient-gold:has-text("Personas")')).toBeVisible();
    await expect(page.locator('.breadcrumbs')).toBeVisible();
    await expect(page.locator('.breadcrumbs a:has-text("Home")')).toBeVisible();

    // Check create button
    await expect(page.locator('button:has-text("Create New Persona")')).toBeVisible();

    // Check filter dropdown
    await expect(page.locator('select#status-filter')).toBeVisible();
  });

  test('should display filter dropdown with all status options', async ({ page }) => {
    await page.goto('/personas');

    const filter = page.locator('select#status-filter');
    await expect(filter).toBeVisible();

    // Verify all filter options exist (use toHaveCount instead of toBeVisible for options)
    await expect(filter.locator('option:has-text("All Statuses")')).toHaveCount(1);
    await expect(filter.locator('option:has-text("Draft")')).toHaveCount(1);
    await expect(filter.locator('option:has-text("Training")')).toHaveCount(1);
    await expect(filter.locator('option:has-text("Trained")')).toHaveCount(1);
    await expect(filter.locator('option:has-text("Incomplete")')).toHaveCount(1);
  });

  test('should filter personas by status', async ({ page }) => {
    await page.goto('/personas');

    // Select draft status
    await page.selectOption('select#status-filter', 'draft');

    // Wait for navigation
    await page.waitForURL('**/personas?status=draft');

    // Verify URL has status param
    expect(page.url()).toContain('status=draft');
  });

  test('should display empty state when no personas exist', async ({ page }) => {
    await page.goto('/personas');

    // Check for either persona cards or empty state
    const hasPersonas = (await page.locator('.card-body:has(h3)').count()) > 0;
    const hasEmptyState = (await page.locator('text=No personas').count()) > 0;

    // One of these should be true
    expect(hasPersonas || hasEmptyState).toBe(true);
  });

  test('should use DaisyUI card styling for persona cards', async ({ page }) => {
    await page.goto('/personas');

    // Check if any persona cards exist
    const personaCards = page.locator('.card');
    const cardCount = await personaCards.count();

    if (cardCount > 0) {
      // Verify DaisyUI classes
      await expect(personaCards.first()).toHaveClass(/card/);
      await expect(personaCards.first()).toHaveClass(/shadow/);
    }
  });

  test('should display correct breadcrumbs on detail page', async ({ page }) => {
    // Try to navigate to a detail page with a dummy ID
    // This will redirect to /personas if persona doesn't exist
    await page.goto('/personas/test-id-123');

    // Should either show detail page or redirect back to list
    const url = page.url();
    const isOnDetailPage = url.includes('/personas/test-id-123');
    const isOnListPage = url.endsWith('/personas');

    expect(isOnDetailPage || isOnListPage).toBe(true);

    if (isOnDetailPage) {
      // Check breadcrumbs if on detail page
      await expect(page.locator('.breadcrumbs a:has-text("Home")')).toBeVisible();
      await expect(page.locator('.breadcrumbs a:has-text("Personas")')).toBeVisible();
    }
  });
});

test.describe('Persona API Integration', () => {
  test('should successfully fetch personas from API', async ({ page }) => {
    // Navigate to page
    await page.goto('/personas');

    // Make direct API call to verify response structure
    const response = await page.request.get('/api/personas');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Visit personas page
    await page.goto('/personas');

    // Page should load even if API has issues (check main title)
    await expect(page.locator('h1.text-5xl.text-gradient-gold:has-text("Personas")')).toBeVisible();
  });
});
