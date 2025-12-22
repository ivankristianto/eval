import { test, expect } from "@playwright/test";

test.describe("Results Visualization UI", () => {
  test("should show evaluation history or empty state on home", async ({ page }) => {
    await page.goto("/");

    const hasTable = (await page.locator("table").count()) > 0;
    const hasEmptyState = (await page.locator("text=No evaluations yet").count()) > 0;

    expect(hasTable || hasEmptyState).toBe(true);
  });

  test("should navigate to evaluation results page when available", async ({ page }) => {
    await page.goto("/");

    const viewLinks = page.locator('table a:has-text("View")');
    const viewCount = await viewLinks.count();

    if (viewCount === 0) {
      await expect(page.locator("text=No evaluations yet")).toBeVisible();
      return;
    }

    await viewLinks.first().click();
    await expect(page).toHaveURL(/\/evaluations\//);
    await expect(page.locator('h1:has-text("Evaluation Results")')).toBeVisible();

    const table = page.locator("#results-table");
    await expect(table).toBeVisible();
    await expect(table).toHaveClass(/table/);

    const expectedHeaders = ["Model", "Status", "Time (ms)", "Total Tokens", "Accuracy", "Actions"];
    for (const header of expectedHeaders) {
      await expect(page.locator(`#results-table th:has-text("${header}")`)).toBeAttached();
    }

    const drawer = page.locator("#details-drawer");
    await expect(drawer).toBeAttached();
    await expect(drawer).toHaveClass(/translate-x-full/);

    const pollingIndicator = page.locator("#polling-indicator");
    await expect(pollingIndicator).toBeAttached();

    const saveTemplateBtn = page.locator("#save-template-btn");
    await expect(saveTemplateBtn).toBeAttached();
  });
});
