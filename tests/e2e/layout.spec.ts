import { test, expect } from '@playwright/test';

test.describe('Global Layout', () => {
  test('should display navbar with links on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Check for navbar
    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();

    // Check for links (desktop view) - Models is now in mobile menu only
    const links = ['Home', 'Templates', 'History'];
    for (const link of links) {
      await expect(page.locator(`.navbar-center a:has-text("${link}")`)).toBeVisible();
    }

    // Check for New Evaluation button in navbar
    const newEvalBtn = page.locator('.navbar-end button:has-text("New Evaluation")');
    await expect(newEvalBtn).toBeVisible();
  });

  test('should display hamburger menu on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check navbar exists
    const navbar = page.locator('.navbar');
    await expect(navbar).toBeVisible();

    // Check hamburger menu button is visible
    const hamburgerButton = page.locator('.navbar div[role="button"]');
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

  test('should open New Evaluation modal from navbar button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Click New Evaluation button
    await page.click('.navbar-end button:has-text("New Evaluation")');

    // Modal should be visible
    const modal = page.locator('#new-evaluation-modal');
    await expect(modal).toBeVisible();

    // Check modal content
    await expect(page.locator('#new-evaluation-modal h3:has-text("New Evaluation")')).toBeVisible();
    await expect(page.locator('#new-evaluation-modal textarea#instruction')).toBeVisible();
    await expect(page.locator('#new-evaluation-modal select#rubric_type')).toBeVisible();
  });
});
