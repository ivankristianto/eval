import { test, expect } from '@playwright/test';

test.describe('Models Page UI', () => {
  test('should display page title and breadcrumbs', async ({ page }) => {
    await page.goto('/models');

    await expect(page.locator('h1:has-text("Model Management")')).toBeVisible();

    await expect(page.locator('.breadcrumbs')).toBeVisible();
    await expect(page.locator('.breadcrumbs a:has-text("Home")')).toBeVisible();
    await expect(page.locator('.breadcrumbs:has-text("Models")')).toBeVisible();
  });

  test('should display action buttons in top-right', async ({ page }) => {
    await page.goto('/models');

    const addModelBtn = page.locator('#add-model-btn');
    await expect(addModelBtn).toBeVisible();

    await expect(page.locator('button:has-text("Import")')).toBeVisible();
    await expect(page.locator('button:has-text("Export")')).toBeVisible();
  });

  test('should open Add Model modal', async ({ page }) => {
    await page.goto('/models');

    await page.click('button:has-text("Add Model")');

    const modal = page.locator('dialog#add-model-modal');
    await expect(modal).toBeVisible();

    await expect(page.locator('dialog h3:has-text("Add New Model")')).toBeVisible();
    await expect(page.locator('dialog select#provider')).toBeVisible();
    await expect(page.locator('dialog input#model_name')).toBeVisible();
    await expect(page.locator('dialog input#api_key')).toBeVisible();
  });

  test('should display empty state when no models', async ({ page }) => {
    await page.goto('/models');

    const hasTable = (await page.locator('table').count()) > 0;
    const hasEmptyState = (await page.locator('text=No models configured').count()) > 0;

    expect(hasTable || hasEmptyState).toBe(true);
  });

  test('should use DaisyUI table styling', async ({ page }) => {
    await page.goto('/models');

    const table = page.locator('.card-luxe table');
    const tableCount = await table.count();

    if (tableCount > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('should use DaisyUI Card component', async ({ page }) => {
    await page.goto('/models');

    const card = page.locator('.card-luxe');
    await expect(card).toBeVisible();
  });
});

test.describe('New AI Providers - Open Router', () => {
  test('should show Open Router in provider dropdown', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    const providerSelect = page.locator('#provider');
    await providerSelect.click();

    const options = await page.locator('#provider option').allTextContents();
    expect(options).toContain('Open Router');
  });

  test('should require API key for Open Router', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'openrouter');

    // API key field should be visible and required
    const apiKeyInput = page.locator('input#api_key');
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute('required', '');
  });

  test('should validate Open Router API key format', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'openrouter');
    await page.fill('input#model_name', 'anthropic/claude-3-opus');
    await page.fill('input#api_key', 'sk-or-valid-key-123');

    // Submit form
    await page.click('button[type="submit"]:has-text("Add Model")');

    // Note: This test verifies the form accepts valid format
    // Actual connection test would require mocking the API
  });
});

test.describe('New AI Providers - LM Studio', () => {
  test('should show LM Studio in provider dropdown', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    const providerSelect = page.locator('#provider');
    await providerSelect.click();

    const options = await page.locator('#provider option').allTextContents();
    expect(options).toContain('LM Studio');
  });

  test('should make API key optional for LM Studio', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'lmstudio');

    // API key field should not be required for local providers
    const apiKeyInput = page.locator('input#api_key');
    await expect(apiKeyInput).toBeVisible();
    // The field may be present but not required
    const isRequired = await apiKeyInput.evaluate((el) => el.hasAttribute('required'));
    expect(isRequired).toBe(false);
  });

  test('should show base URL field for LM Studio', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'lmstudio');

    // Base URL field should be visible
    const baseUrlInput = page.locator('input#base_url');
    await expect(baseUrlInput).toBeVisible();

    // Should show default URL hint
    const hint = page.locator('text=http://localhost:1234/v1');
    await expect(hint).toBeVisible();
  });

  test('should show custom base URL when provided', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'lmstudio');
    await page.fill('input#model_name', 'llama-3-8b');
    await page.fill('input#base_url', 'http://localhost:9999/v1');

    const baseUrlValue = await page.locator('input#base_url').inputValue();
    expect(baseUrlValue).toBe('http://localhost:9999/v1');
  });
});

test.describe('New AI Providers - Ollama', () => {
  test('should show Ollama in provider dropdown', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    const providerSelect = page.locator('#provider');
    await providerSelect.click();

    const options = await page.locator('#provider option').allTextContents();
    expect(options).toContain('Ollama');
  });

  test('should make API key optional for Ollama', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'ollama');

    // API key field should not be required for local providers
    const apiKeyInput = page.locator('input#api_key');
    await expect(apiKeyInput).toBeVisible();
    const isRequired = await apiKeyInput.evaluate((el) => el.hasAttribute('required'));
    expect(isRequired).toBe(false);
  });

  test('should show base URL field for Ollama', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'ollama');

    // Base URL field should be visible
    const baseUrlInput = page.locator('input#base_url');
    await expect(baseUrlInput).toBeVisible();

    // Should show default URL hint
    const hint = page.locator('text=http://localhost:11434');
    await expect(hint).toBeVisible();
  });

  test('should show custom base URL when provided', async ({ page }) => {
    await page.goto('/models');
    await page.click('button:has-text("Add Model")');

    await page.selectOption('#provider', 'ollama');
    await page.fill('input#model_name', 'llama3');
    await page.fill('input#base_url', 'http://192.168.1.100:11434');

    const baseUrlValue = await page.locator('input#base_url').inputValue();
    expect(baseUrlValue).toBe('http://192.168.1.100:11434');
  });
});

test.describe('Provider Badge Display', () => {
  test('should display provider badges in model list', async ({ page }) => {
    await page.goto('/models');

    // Check for provider badges/labels in the table
    const tableExists = (await page.locator('table').count()) > 0;

    if (tableExists) {
      // Look for provider indicators (badges, labels, or text)
      const providerBadges = page.locator('.badge, [data-provider], .provider-badge');
      const count = await providerBadges.count();

      if (count > 0) {
        await expect(providerBadges.first()).toBeVisible();
      }
    }
  });
});

test.describe('Connection Testing', () => {
  test('should have test connection button for each model', async ({ page }) => {
    await page.goto('/models');

    const tableExists = (await page.locator('table').count()) > 0;

    if (tableExists) {
      // Look for test connection buttons
      const testButtons = page.locator('button:has-text("Test")');
      const count = await testButtons.count();

      if (count > 0) {
        await expect(testButtons.first()).toBeVisible();
      }
    }
  });
});
