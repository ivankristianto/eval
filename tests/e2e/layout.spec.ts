import { test, expect } from "@playwright/test";

test.describe("Global Layout", () => {
  test("should display navbar with links on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    const navbar = page.locator(".navbar");
    await expect(navbar).toBeVisible();

    const links = ["Eval", "Models", "Templates"];
    for (const link of links) {
      await expect(page.locator(`.navbar-center a:has-text("${link}")`)).toBeVisible();
    }
  });

  test("should display hamburger menu on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const navbar = page.locator(".navbar");
    await expect(navbar).toBeVisible();

    const hamburgerButton = page.locator('.navbar div[role="button"]');
    await expect(hamburgerButton.first()).toBeVisible();

    const desktopNav = page.locator(".navbar-center");
    await expect(desktopNav).toHaveClass(/hidden/);
  });

  test("should have theme controller", async ({ page }) => {
    await page.goto("/");
    const themeController = page.locator(".swap input.theme-controller");
    await expect(themeController).toBeAttached();
  });

  test("should navigate between pages", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    await page.click('.navbar-center a:has-text("Models")');
    await expect(page).toHaveURL("/models");
    await expect(page.locator('h1:has-text("Model Management")')).toBeVisible();

    await page.click('.navbar-center a:has-text("Templates")');
    await expect(page).toHaveURL("/templates");
    await expect(page.locator('h1:has-text("Evaluation Templates")')).toBeVisible();

    await page.click('.navbar-center a:has-text("Eval")');
    await expect(page).toHaveURL("/");
    await expect(page.locator('h1:has-text("Evaluation History")')).toBeVisible();
  });

  test("should open New Evaluation modal from page header button", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    await page.click('button:has-text("New Evaluation")');

    const modal = page.locator("#new-evaluation-modal");
    await expect(modal).toBeVisible();

    await expect(page.locator('#new-evaluation-modal h3:has-text("New Evaluation")')).toBeVisible();
    await expect(page.locator("#new-evaluation-modal textarea#instruction")).toBeVisible();
    await expect(page.locator("#new-evaluation-modal select#rubric_type")).toBeVisible();
  });
});
