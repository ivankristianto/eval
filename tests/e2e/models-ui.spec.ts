import { test, expect } from "@playwright/test";

test.describe("Models Page UI", () => {
  test("should display page title and breadcrumbs", async ({ page }) => {
    await page.goto("/models");

    await expect(page.locator('h1:has-text("Model Management")')).toBeVisible();

    await expect(page.locator(".breadcrumbs")).toBeVisible();
    await expect(page.locator('.breadcrumbs a:has-text("Home")')).toBeVisible();
    await expect(page.locator('.breadcrumbs:has-text("Models")')).toBeVisible();
  });

  test("should display action buttons in top-right", async ({ page }) => {
    await page.goto("/models");

    const addModelBtn = page.locator('#add-model-btn');
    await expect(addModelBtn).toBeVisible();

    await expect(page.locator('button:has-text("Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
  });

  test("should open Add Model modal", async ({ page }) => {
    await page.goto("/models");

    await page.click('button:has-text("Add Model")');

    const modal = page.locator("dialog#add-model-modal");
    await expect(modal).toBeVisible();

    await expect(page.locator('dialog h3:has-text("Add New Model")')).toBeVisible();
    await expect(page.locator("dialog select#provider")).toBeVisible();
    await expect(page.locator("dialog input#model_name")).toBeVisible();
    await expect(page.locator("dialog input#api_key")).toBeVisible();
  });

  test("should display empty state when no models", async ({ page }) => {
    await page.goto("/models");

    const hasTable = (await page.locator("table").count()) > 0;
    const hasEmptyState = (await page.locator("text=No models configured").count()) > 0;

    expect(hasTable || hasEmptyState).toBe(true);
  });

  test("should use DaisyUI table styling", async ({ page }) => {
    await page.goto("/models");

    const table = page.locator(".card table");
    const tableCount = await table.count();

    if (tableCount > 0) {
      await expect(table).toHaveClass(/table/);
    }
  });

  test("should use DaisyUI Card component", async ({ page }) => {
    await page.goto("/models");

    const card = page.locator(".card");
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/bg-base-100/);
  });
});
