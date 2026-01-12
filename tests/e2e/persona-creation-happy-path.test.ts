/**
 * Persona Creation Happy Path E2E Test
 *
 * Comprehensive end-to-end test for the complete persona creation workflow:
 * - Form filling with all required fields
 * - Model separation validation
 * - Successful creation
 * - Redirect to workspace page (not detail page)
 * - Workspace page UI verification
 *
 * This test runs independently without requiring existing personas.
 */

import { test, expect } from '@playwright/test';

test.describe('Persona Creation - Happy Path', () => {
  let personaId = '';
  let taskModelId = '';
  let judgeModelId = '';
  let promptEngineerModelId = '';

  /**
   * Setup: Get available models with different providers before running tests
   */
  test.beforeAll(async ({ request }) => {
    // Get available models for testing
    try {
      const modelsResponse = await request.get('/api/models');
      const modelsData = await modelsResponse.json();

      // Handle different response formats
      const models = Array.isArray(modelsData) ? modelsData : modelsData.models || [];

      // Find three different providers
      const providers = new Map<string, string>();
      for (const model of models) {
        if (!providers.has(model.provider)) {
          providers.set(model.provider, model.id);
        }
      }

      const providerIds = Array.from(providers.values());

      if (providerIds.length >= 3) {
        taskModelId = providerIds[0];
        judgeModelId = providerIds[1];
        promptEngineerModelId = providerIds[2];
      }
    } catch (error) {
      console.log('Could not fetch models:', error);
    }
  });

  /**
   * Test: Complete happy path for persona creation
   *
   * Acceptance Criteria:
   * - Test fills create persona form with all required fields
   * - Test validates model separation enforcement
   * - Test submits form successfully
   * - Test verifies redirect to /personas/{id}/workspace (NOT /personas/{id})
   * - Test verifies workspace page loads with correct UI elements
   * - Test verifies persona creation via API
   */
  test('should complete full persona creation happy path with workspace redirect', async ({
    page,
    request,
  }) => {
    // Skip if we don't have enough different providers
    if (!taskModelId || !judgeModelId || !promptEngineerModelId) {
      test.skip(true, 'Need at least 3 different model providers to run this test');
      return;
    }

    // Step 1: Navigate to personas list page
    await page.goto('/personas');

    // Verify we're on the personas list page
    await expect(page).toHaveURL(/\/personas$/);
    await expect(page.locator('h1.text-5xl.text-gradient-gold:has-text("Personas")')).toBeVisible();

    // Step 2: Click "Create New Persona" button
    const createButton = page.locator('button:has-text("Create New Persona")');
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify we're on the create persona page
    await expect(page).toHaveURL(/\/personas\/create$/);
    await expect(page.locator('h1:has-text("Create New Persona")')).toBeVisible();

    // Step 3: Fill in the form with all required fields
    // Persona Name
    const nameInput = page.locator('[data-test="persona-name"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('E2E Happy Path Test Persona');

    // Description (optional)
    const descriptionInput = page.locator('[data-test="persona-description"]');
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill(
      'Comprehensive E2E test persona created during happy path validation testing'
    );

    // Task Prompt
    const taskPromptInput = page.locator('[data-test="task-prompt"]');
    await expect(taskPromptInput).toBeVisible();
    await taskPromptInput.fill(
      'You are a helpful customer support agent. Respond to customer inquiries professionally, accurately, and concisely.'
    );

    // Judge Prompt
    const judgePromptInput = page.locator('[data-test="judge-prompt"]');
    await expect(judgePromptInput).toBeVisible();
    await judgePromptInput.fill(
      'Evaluate if the response is professional, accurate, and helpful. Mark as PASS if it meets all criteria, otherwise mark as FAIL.'
    );

    // Step 4: Select models (must be from different providers)
    const taskModelSelect = page.locator('[data-test="task-model"]');
    const judgeModelSelect = page.locator('[data-test="judge-model"]');
    const promptEngineerModelSelect = page.locator('[data-test="prompt-engineer-model"]');

    // Verify all model selects are visible
    await expect(taskModelSelect).toBeVisible();
    await expect(judgeModelSelect).toBeVisible();
    await expect(promptEngineerModelSelect).toBeVisible();

    // Select Task Model
    await taskModelSelect.selectOption(taskModelId);

    // Select Judge Model
    await judgeModelSelect.selectOption(judgeModelId);

    // Select Prompt Engineer Model
    await promptEngineerModelSelect.selectOption(promptEngineerModelId);

    // Step 5: Validate model separation enforcement
    // Verify validation error is hidden (models are from different providers)
    const validationError = page.locator('[data-test="validation-error"]');
    await expect(validationError).toBeHidden();

    // Verify selected models have different providers
    const taskModelOption = await taskModelSelect.inputValue();
    const judgeModelOption = await judgeModelSelect.inputValue();
    const promptEngineerModelOption = await promptEngineerModelSelect.inputValue();

    expect(taskModelOption).not.toBe(judgeModelOption);
    expect(taskModelOption).not.toBe(promptEngineerModelOption);
    expect(judgeModelOption).not.toBe(promptEngineerModelOption);

    // Step 6: Submit the form
    const submitButton = page.locator('[data-test="create-persona-submit"]');
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Step 7: Verify redirect to workspace page (NOT detail page)
    // Wait for navigation to complete
    await page.waitForURL(/\/personas\/[a-f0-9-]+\/workspace$/, { timeout: 5000 });

    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/personas\/[a-f0-9-]+\/workspace$/);
    expect(finalUrl).not.toMatch(/\/personas\/[a-f0-9-]+$/);

    // Extract persona ID from URL
    const urlMatch = finalUrl.match(/\/personas\/([a-f0-9-]+)\/workspace$/);
    expect(urlMatch).toBeTruthy();
    if (urlMatch) {
      personaId = urlMatch[1];
    }

    // Step 8: Verify workspace page loads with correct UI elements
    // Verify page title contains persona name
    await expect(page.locator('h1:has-text("E2E Happy Path Test Persona")')).toBeVisible();

    // Verify "Training Workspace" subtitle
    await expect(page.locator('text=Training Workspace')).toBeVisible();

    // Verify version badge is displayed
    await expect(page.locator('.badge.font-mono')).toBeVisible();

    // Verify PromptEditor components display
    await expect(page.locator('[data-prompt-editor="task"]')).toBeVisible();
    await expect(page.locator('[data-prompt-editor="judge"]')).toBeVisible();

    // Verify labels for prompt editors
    await expect(page.locator('text=Task Prompt')).toBeVisible();
    await expect(page.locator('text=Judge Prompt')).toBeVisible();

    // Verify VersionSelector components
    await expect(page.locator('[data-version-selector="task"]')).toBeVisible();
    await expect(page.locator('[data-version-selector="judge"]')).toBeVisible();

    // Verify action buttons in header
    await expect(page.locator('[data-action="generate-outputs"]')).toBeVisible();
    await expect(page.locator('[data-action="generate-judge"]')).toBeVisible();
    await expect(page.locator('[data-action="evaluate-all"]')).toBeVisible();

    // Verify buttons have correct persona-id attribute
    const generateButton = page.locator('[data-action="generate-outputs"]');
    await expect(generateButton).toHaveAttribute('data-persona-id', personaId);

    // Verify SimpleMetrics component displays
    await expect(page.locator('text=Evaluation Metrics')).toBeVisible();
    await expect(page.locator('text=F1 Score')).toBeVisible();
    await expect(page.locator("text=Cohen's Kappa")).toBeVisible();
    await expect(page.locator('text=Precision')).toBeVisible();
    await expect(page.locator('text=Recall')).toBeVisible();

    // Verify History buttons are displayed
    const historyButtons = page.locator('[data-action="view-history"]');
    await expect(historyButtons).toHaveCount(2);

    // Verify breadcrumbs
    await expect(page.locator('.breadcrumbs')).toBeVisible();
    await expect(page.locator('.breadcrumbs a:has-text("Home")')).toBeVisible();
    await expect(page.locator('.breadcrumbs a:has-text("Personas")')).toBeVisible();

    // Step 9: Verify persona creation via API
    const personaResponse = await request.get(`/api/personas/${personaId}`);
    expect(personaResponse.status()).toBe(200);

    const persona = await personaResponse.json();
    expect(persona.id).toBe(personaId);
    expect(persona.name).toBe('E2E Happy Path Test Persona');
    expect(persona.description).toBe(
      'Comprehensive E2E test persona created during happy path validation testing'
    );
    expect(persona.status).toBe('draft');
    expect(persona.task_model_id).toBe(taskModelId);
    expect(persona.judge_model_id).toBe(judgeModelId);
    expect(persona.prompt_engineer_model_id).toBe(promptEngineerModelId);
  });

  /**
   * Test: Verify model separation validation prevents submission
   *
   * This test ensures that when users select models from the same provider,
   * the validation error is shown and form submission is prevented.
   */
  test('should prevent submission when models are from the same provider', async ({ page }) => {
    // Skip if we don't have enough models
    if (!taskModelId || !judgeModelId) {
      test.skip(true, 'Need at least 2 different model providers to run this test');
      return;
    }

    // Navigate to create page
    await page.goto('/personas/create');

    // Fill required fields
    await page.fill('[data-test="persona-name"]', 'Invalid Model Separation Test');
    await page.fill('[data-test="task-prompt"]', 'Test task prompt');
    await page.fill('[data-test="judge-prompt"]', 'Test judge prompt');

    // Select same provider for task and judge models
    await page.selectOption('[data-test="task-model"]', taskModelId);
    await page.selectOption('[data-test="judge-model"]', taskModelId);

    // Select a different provider for prompt engineer to minimize errors
    if (promptEngineerModelId && promptEngineerModelId !== taskModelId) {
      await page.selectOption('[data-test="prompt-engineer-model"]', promptEngineerModelId);
    }

    // Verify validation error is visible
    const validationError = page.locator('[data-test="validation-error"]');
    await expect(validationError).toBeVisible();
    await expect(validationError).toContainText('must be from different providers');
  });

  /**
   * Test: Verify form validation for required fields
   */
  test('should show validation errors for missing required fields', async ({ page }) => {
    // Navigate to create page
    await page.goto('/personas/create');

    // Try to submit form without filling required fields
    const submitButton = page.locator('[data-test="create-persona-submit"]');
    await submitButton.click();

    // Verify HTML5 validation prevents submission
    // The form should not submit and we should still be on the create page
    await expect(page).toHaveURL(/\/personas\/create$/);

    // Verify required attribute is working
    const nameInput = page.locator('[data-test="persona-name"]');
    const taskPromptInput = page.locator('[data-test="task-prompt"]');
    const judgePromptInput = page.locator('[data-test="judge-prompt"]');

    // These inputs should have the 'required' attribute
    await expect(nameInput).toHaveAttribute('required', '');
    await expect(taskPromptInput).toHaveAttribute('required', '');
    await expect(judgePromptInput).toHaveAttribute('required', '');
  });

  /**
   * Test: Verify cancel button redirects back to personas list
   */
  test('should redirect to personas list when cancel button is clicked', async ({ page }) => {
    // Navigate to create page
    await page.goto('/personas/create');

    // Click cancel button
    const cancelButton = page.locator('a.btn.btn-ghost:has-text("Cancel")');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Verify redirect to personas list
    await expect(page).toHaveURL(/\/personas$/);
    await expect(page.locator('h1.text-5xl.text-gradient-gold:has-text("Personas")')).toBeVisible();
  });
});

test.describe('Persona Creation - Independent Execution', () => {
  /**
   * Test: Verify test runs independently without requiring existing personas
   *
   * This test ensures the persona creation workflow can be executed
   * from scratch without any pre-existing data.
   */
  test('should run independently without requiring existing personas', async ({
    page,
    request,
  }) => {
    // Verify we start with a clean state (or at least can function independently)
    // Get available models
    const modelsResponse = await request.get('/api/models');
    const modelsData = await modelsResponse.json();
    const models = Array.isArray(modelsData) ? modelsData : modelsData.models || [];

    // We need at least 3 different providers
    const providers = new Set(models.map((m: { provider: string }) => m.provider));

    if (providers.size < 3) {
      test.skip(true, 'Need at least 3 different model providers to run this test');
      return;
    }

    // Find three different provider model IDs
    const providerIds: string[] = [];
    const usedProviders = new Set<string>();

    for (const model of models) {
      if (!usedProviders.has(model.provider)) {
        providerIds.push(model.id);
        usedProviders.add(model.provider);
        if (providerIds.length === 3) break;
      }
    }

    // Navigate to create page directly (no setup required)
    await page.goto('/personas/create');

    // Verify page loads successfully
    await expect(page.locator('h1:has-text("Create New Persona")')).toBeVisible();

    // Verify form is functional
    await expect(page.locator('[data-test="persona-name"]')).toBeVisible();
    await expect(page.locator('[data-test="task-model"]')).toBeVisible();
    await expect(page.locator('[data-test="judge-model"]')).toBeVisible();
    await expect(page.locator('[data-test="prompt-engineer-model"]')).toBeVisible();

    // Verify model selects have options
    const taskModelSelect = page.locator('[data-test="task-model"]');
    const taskOptionCount = await taskModelSelect.locator('option').count();
    expect(taskOptionCount).toBeGreaterThan(1); // At least placeholder + 1 model
  });
});
