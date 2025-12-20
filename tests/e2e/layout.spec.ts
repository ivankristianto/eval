import { test, expect } from '@playwright/test';

test.describe('Global Layout', () => {
  test('should display navbar with links on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Check for navbar
    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();

    // Check for links (desktop view)
    const links = ['Home', 'Models', 'Templates', 'History'];
    for (const link of links) {
      await expect(page.locator(`.navbar-center a:has-text("${link}")`)).toBeVisible();
    }
  });

  test('should display hamburger menu on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check navbar exists
    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();

    // Check hamburger menu button is visible (has aria-label="Menu")
    const hamburgerButton = page.locator('.navbar button[aria-label="Menu"], .navbar div[role="button"]');
    await expect(hamburgerButton.first()).toBeVisible();

    // Desktop nav should be hidden
    const desktopNav = page.locator('.navbar-center');
    await expect(desktopNav).toHaveClass(/hidden/);
  });

  test('should have theme controller', async ({ page }) => {
    await page.goto('/');
    const themeController = page.locator('.swap input.theme-controller');
    await expect(themeController).toBeAttached();
  });

  test('should navigate between pages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Navigate to Models page
    await page.click('.navbar-center a:has-text("Models")');
    await expect(page).toHaveURL('/models');
    await expect(page.locator('h1:has-text("Model Management")')).toBeVisible();

    // Navigate to Templates page
    await page.click('.navbar-center a:has-text("Templates")');
    await expect(page).toHaveURL('/templates');
    await expect(page.locator('h1:has-text("Evaluation Templates")')).toBeVisible();

    // Navigate to History page
    await page.click('.navbar-center a:has-text("History")');
    await expect(page).toHaveURL('/history');
    await expect(page.locator('h1:has-text("Evaluation History")')).toBeVisible();

    // Navigate back to Home
    await page.click('.navbar-center a:has-text("Home")');
    await expect(page).toHaveURL('/');
  });
});
