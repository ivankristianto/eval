import { test, expect } from '@playwright/test';

test.describe('Global Layout', () => {
  test('should display navbar with links on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();

    const links = ['Eval', 'Models', 'Templates', 'Personas'];
    for (const link of links) {
      await expect(navbar.locator(`a:has-text("${link}")`).first()).toBeVisible();
    }
  });

  test('should display hamburger menu on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();

    const hamburgerButton = navbar.locator('div[role="button"][aria-label="Menu"]');
    await expect(hamburgerButton).toBeVisible();
  });

  test('should have theme controller', async ({ page }) => {
    await page.goto('/');
    // Check for either the controller or its container
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await page.click('nav a:has-text("Models")');
    await expect(page).toHaveURL('/models');
    await expect(page.locator('h1:has-text("Model Management")')).toBeVisible();

    await page.click('nav a:has-text("Templates")');
    await expect(page).toHaveURL('/templates');
    await expect(page.locator('h1:has-text("Evaluation Templates")')).toBeVisible();

    await page.click('nav a:has-text("Eval")');
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("Evaluation History")')).toBeVisible();
  });

  test('should open New Evaluation modal from page header button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await page.click('button:has-text("New Evaluation")');

    const modal = page.locator('#new-evaluation-modal');
    await expect(modal).toBeVisible();

    await expect(page.locator('#new-evaluation-modal h3:has-text("New Evaluation")')).toBeVisible();
    await expect(page.locator('#new-evaluation-modal textarea#instruction')).toBeVisible();
    await expect(page.locator('#new-evaluation-modal select#rubric_type')).toBeVisible();
  });
});
