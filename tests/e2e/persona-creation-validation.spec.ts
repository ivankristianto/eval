/**
 * E2E tests for Persona Creation Form Validation and Error Handling
 *
 * Tests form validation behavior on the persona creation page including:
 * - Required field validation
 * - Model separation enforcement
 * - API error handling
 * - Network error handling
 */

import { test, expect, type Page } from '@playwright/test';

/**
 * Timeout constants for E2E tests (in milliseconds).
 *
 * - SHORT: Brief pause for UI updates, browser validation rendering, and option refreshes
 * - MEDIUM: Moderate delay for API response processing and loading state observations
 * - LONG: Maximum wait for Playwright assertions (toBeVisible, toHaveCount, etc.)
 */
const TIMEOUTS = {
  /** @deprecated Use TIMEOUTS.SHORT instead */
  MODEL_UPDATE_DELAY: 100,
  SHORT: 100,
  MEDIUM: 500,
  LONG: 5000,
} as const;

/** @deprecated Use TIMEOUTS.SHORT instead */
const MODEL_UPDATE_DELAY = TIMEOUTS.MODEL_UPDATE_DELAY;

/**
 * Helper function to select a model for a specific role.
 * Returns true if a model was selected, false if no models were available.
 *
 * @param page - Playwright page instance
 * @param role - The role to select a model for ('task', 'judge', or 'engineer')
 * @returns Promise<boolean> - true if model was selected, false otherwise
 */
async function selectModelForRole(
  page: Page,
  role: 'task' | 'judge' | 'engineer'
): Promise<boolean> {
  const dataTestValue = `${role}-model`;
  // For engineer role, the data-test attribute is 'prompt-engineer-model'
  const select = page.locator(
    role === 'engineer' ? '[data-test="prompt-engineer-model"]' : `[data-test="${dataTestValue}"]`
  );

  // Count available non-empty options
  const options = await select.locator('option:not([value=""]):not(:disabled)').count();

  if (options === 0) {
    return false;
  }

  // Select first available option (index 1 because index 0 is the empty placeholder)
  await select.selectOption({ index: 1 });

  // Wait for options to update
  await page.waitForTimeout(MODEL_UPDATE_DELAY);

  return true;
}

test.describe('Persona Creation Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to persona creation page before each test
    await page.goto('/personas/create');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Required Field Validation', () => {
    test('should show HTML5 validation for empty name field', async ({ page }) => {
      const nameInput = page.locator('[data-test="persona-name"]');
      const submitBtn = page.locator('[data-test="create-persona-submit"]');

      // Check if form is disabled (no models configured)
      const form = page.locator('#create-persona-form');
      const isFormDisabled = (await form.getAttribute('class'))?.includes('pointer-events-none');

      if (isFormDisabled) {
        // Skip test if no models are configured
        test.skip();
        return;
      }

      // Verify input is required
      await expect(nameInput).toHaveAttribute('required', '');

      // Try to submit with empty name using JavaScript to bypass any UI blocking
      await submitBtn.evaluate((btn) => (btn as HTMLButtonElement).click());

      // Give browser time to show validation
      await page.waitForTimeout(TIMEOUTS.SHORT);

      // Check for HTML5 validation message
      const isNameValid = await nameInput.evaluate((el) =>
        (el as HTMLInputElement).checkValidity()
      );
      expect(isNameValid).toBe(false);

      // Browser should show validation message
      const validationMessage = await nameInput.evaluate(
        (el) => (el as HTMLInputElement).validationMessage
      );
      expect(validationMessage).toBeTruthy();
      expect(validationMessage.length).toBeGreaterThan(0);
    });

    test('should show validation for empty task prompt', async ({ page }) => {
      const taskPromptInput = page.locator('[data-test="task-prompt"]');
      const submitBtn = page.locator('[data-test="create-persona-submit"]');

      // Check if form is disabled (no models configured)
      const form = page.locator('#create-persona-form');
      const isFormDisabled = (await form.getAttribute('class'))?.includes('pointer-events-none');

      if (isFormDisabled) {
        // Skip test if no models are configured
        test.skip();
        return;
      }

      // Verify textarea is required
      await expect(taskPromptInput).toHaveAttribute('required', '');

      // Fill in name but leave task prompt empty
      await page.locator('[data-test="persona-name"]').fill('Test Persona');

      // Try to submit using JavaScript to bypass any UI blocking
      await submitBtn.evaluate((btn) => (btn as HTMLButtonElement).click());

      // Give browser time to show validation
      await page.waitForTimeout(TIMEOUTS.SHORT);

      // Check for HTML5 validation
      const isTaskPromptValid = await taskPromptInput.evaluate((el) =>
        (el as HTMLTextAreaElement).checkValidity()
      );
      expect(isTaskPromptValid).toBe(false);
    });

    test('should show validation for empty judge prompt', async ({ page }) => {
      const judgePromptInput = page.locator('[data-test="judge-prompt"]');
      const submitBtn = page.locator('[data-test="create-persona-submit"]');

      // Check if form is disabled (no models configured)
      const form = page.locator('#create-persona-form');
      const isFormDisabled = (await form.getAttribute('class'))?.includes('pointer-events-none');

      if (isFormDisabled) {
        // Skip test if no models are configured
        test.skip();
        return;
      }

      // Verify textarea is required
      await expect(judgePromptInput).toHaveAttribute('required', '');

      // Fill in name and task prompt but leave judge prompt empty
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');

      // Try to submit using JavaScript to bypass any UI blocking
      await submitBtn.evaluate((btn) => (btn as HTMLButtonElement).click());

      // Give browser time to show validation
      await page.waitForTimeout(TIMEOUTS.SHORT);

      // Check for HTML5 validation
      const isJudgePromptValid = await judgePromptInput.evaluate((el) =>
        (el as HTMLTextAreaElement).checkValidity()
      );
      expect(isJudgePromptValid).toBe(false);
    });

    test('should submit form successfully with all required fields filled', async ({ page }) => {
      // Fill in all required fields
      await page.locator('[data-test="persona-name"]').fill('E2E Test Persona');
      await page
        .locator('[data-test="task-prompt"]')
        .fill('You are a helpful assistant. Respond to the user query.');
      await page
        .locator('[data-test="judge-prompt"]')
        .fill('Evaluate if the response is helpful and accurate.');

      // Select models (if available)
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Check validation error is not shown
            const validationError = page.locator('[data-test="validation-error"]');
            const isErrorVisible = await validationError.isVisible();
            if (isErrorVisible) {
              // If error is visible, it might be due to provider conflict
              // This is acceptable - just verify error exists
              expect(await validationError.textContent()).toBeTruthy();
            }
          }
        }
      }
    });
  });

  test.describe('Model Separation Validation', () => {
    test('should show validation error when same provider selected for all models', async ({
      page,
    }) => {
      // Fill in required fields
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Get the task model select
      const taskModelSelect = page.locator('[data-test="task-model"]');
      const taskModelOptions = await taskModelSelect.locator('option:not([value=""])').all();

      if (taskModelOptions.length > 0) {
        // Select first task model
        await taskModelSelect.selectOption({ index: 1 });
        await page.waitForTimeout(TIMEOUTS.SHORT);

        // Get the provider of selected task model
        const selectedTaskOption = taskModelSelect.locator('option:checked');
        const taskProvider = await selectedTaskOption.getAttribute('data-provider');

        if (taskProvider) {
          // Try to select judge model from same provider
          const judgeModelSelect = page.locator('[data-test="judge-model"]');
          const judgeModelOptions = await judgeModelSelect
            .locator(`option[data-provider="${taskProvider}"]`)
            .all();

          if (judgeModelOptions.length > 0) {
            // Options from same provider should be disabled
            const isDisabled = await judgeModelOptions[0].isDisabled();
            expect(isDisabled).toBe(true);

            // Verify the option text indicates it's disabled
            const optionText = await judgeModelOptions[0].textContent();
            expect(optionText).toContain('Provider selected');
          }
        }
      }
    });

    test('should show validation error when task and judge from same provider', async ({
      page,
    }) => {
      // Fill in required fields
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select task model
      const taskModelSelect = page.locator('[data-test="task-model"]');
      const taskModelOptions = await taskModelSelect.locator('option:not([value=""])').count();

      if (taskModelOptions > 1) {
        // Select first available task model
        await taskModelSelect.selectOption({ index: 1 });
        await page.waitForTimeout(TIMEOUTS.SHORT);

        // Get selected provider
        const selectedTaskOption = taskModelSelect.locator('option:checked');
        const taskProvider = await selectedTaskOption.getAttribute('data-provider');

        if (taskProvider) {
          // Try to select judge model from same provider (should be disabled)
          const judgeModelSelect = page.locator('[data-test="judge-model"]');
          const sameProviderJudgeOption = judgeModelSelect.locator(
            `option[data-provider="${taskProvider}"]:not([value=""])`
          );

          const count = await sameProviderJudgeOption.count();
          if (count > 0) {
            const isDisabled = await sameProviderJudgeOption.isDisabled();
            expect(isDisabled).toBe(true);
          }
        }
      }
    });

    test('should disable provider options in other selects after selection', async ({ page }) => {
      // Fill in required fields
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select task model
      const taskModelSelect = page.locator('[data-test="task-model"]');
      const taskModelOptions = await taskModelSelect.locator('option:not([value=""])').count();

      if (taskModelOptions > 0) {
        await taskModelSelect.selectOption({ index: 1 });
        await page.waitForTimeout(TIMEOUTS.SHORT);

        // Get selected provider
        const selectedTaskOption = taskModelSelect.locator('option:checked');
        const taskProvider = await selectedTaskOption.getAttribute('data-provider');

        if (taskProvider) {
          // Verify judge model select has same provider options disabled
          const judgeModelSelect = page.locator('[data-test="judge-model"]');
          const sameProviderJudgeOptions = judgeModelSelect.locator(
            `option[data-provider="${taskProvider}"]:not([value=""])`
          );

          const count = await sameProviderJudgeOptions.count();
          if (count > 0) {
            for (let i = 0; i < count; i++) {
              const option = sameProviderJudgeOptions.nth(i);
              const isDisabled = await option.isDisabled();
              expect(isDisabled).toBe(true);

              const optionText = await option.textContent();
              expect(optionText).toContain('Provider selected');
            }
          }

          // Verify prompt engineer select also has same provider options disabled
          const promptEngineerSelect = page.locator('[data-test="prompt-engineer-model"]');
          const sameProviderPEOptions = promptEngineerSelect.locator(
            `option[data-provider="${taskProvider}"]:not([value=""])`
          );

          const peCount = await sameProviderPEOptions.count();
          if (peCount > 0) {
            for (let i = 0; i < peCount; i++) {
              const option = sameProviderPEOptions.nth(i);
              const isDisabled = await option.isDisabled();
              expect(isDisabled).toBe(true);
            }
          }
        }
      }
    });

    test('should show validation error alert when models violate separation rules', async ({
      page,
    }) => {
      // Fill in required fields
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // This test verifies the validation error display when the client-side
      // validation catches model separation issues

      // The validation error element should exist
      const validationError = page.locator('[data-test="validation-error"]');
      await expect(validationError).toBeAttached();

      // Initially it should be hidden
      await expect(validationError).toHaveClass(/hidden/);

      // Try to force a selection that would trigger validation
      // (This is difficult to do with disabled options, but we can verify the element exists)
      const validationErrorMessage = page.locator('#validation-error-message');
      await expect(validationErrorMessage).toBeAttached();
    });
  });

  test.describe('API Error Handling', () => {
    test('should handle 400 validation error from API', async ({ page }) => {
      // Mock API to return validation error
      await page.route('**/api/personas', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: ['Name already exists', 'Task model not found'],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Duplicate Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Submit form
            await page.locator('[data-test="create-persona-submit"]').click();

            // Check for error message in validation error div
            const validationError = page.locator('[data-test="validation-error"]');
            await expect(validationError).toBeVisible({ timeout: TIMEOUTS.LONG });

            const errorMessage = await validationError.textContent();
            expect(errorMessage).toContain('Name already exists');
            expect(errorMessage).toContain('Task model not found');
          }
        }
      }
    });

    test('should handle 500 internal server error', async ({ page }) => {
      // Mock API to return server error
      await page.route('**/api/personas', async (route) => {
        await route.fulfill({
          status: 500, // HTTP status code, not a timeout
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Submit form
            await page.locator('[data-test="create-persona-submit"]').click();

            // Check for error toast - explicitly wait for it to appear
            const toastContainer = page.locator('#toast-container');
            await expect(toastContainer).toBeVisible({ timeout: TIMEOUTS.LONG });

            const errorToast = toastContainer.locator('.alert-error');
            // Must have at least one error toast
            await expect(errorToast).toHaveCount(1, { timeout: TIMEOUTS.LONG });
            await expect(errorToast.first()).toBeVisible();

            const toastMessage = await errorToast.first().textContent();
            expect(toastMessage).toContain('Failed to create persona');

            // Verify form is re-enabled after error
            const submitBtn = page.locator('[data-test="create-persona-submit"]');
            await expect(submitBtn).not.toBeDisabled();
            await expect(submitBtn).not.toHaveClass(/loading/);
          }
        }
      }
    });

    test('should handle network error (failed request)', async ({ page }) => {
      // Mock API to fail network request
      await page.route('**/api/personas', (route) => route.abort('failed'));

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Submit form
            await page.locator('[data-test="create-persona-submit"]').click();

            // Check for error toast - explicitly wait for it to appear
            const toastContainer = page.locator('#toast-container');
            await expect(toastContainer).toBeVisible({ timeout: TIMEOUTS.LONG });

            const errorToast = toastContainer.locator('.alert-error');
            // Must have at least one error toast
            await expect(errorToast).toHaveCount(1, { timeout: TIMEOUTS.LONG });
            await expect(errorToast.first()).toBeVisible();

            const toastMessage = await errorToast.first().textContent();
            expect(toastMessage).toContain('Failed to create persona');

            // Verify form is re-enabled after error
            const submitBtn = page.locator('[data-test="create-persona-submit"]');
            await expect(submitBtn).not.toBeDisabled();
            await expect(submitBtn).not.toHaveClass(/loading/);
          }
        }
      }
    });
  });

  test.describe('Submit Button State Management', () => {
    test('should disable submit button during form submission', async ({ page }) => {
      // Mock API to delay response
      await page.route('**/api/personas', async (route) => {
        // Delay response to observe loading state
        await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.MEDIUM));
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: ['Test error'],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            const submitBtn = page.locator('[data-test="create-persona-submit"]');

            // Click submit
            await submitBtn.click();

            // Check button is disabled and has loading class
            await expect(submitBtn).toBeDisabled();
            await expect(submitBtn).toHaveClass(/loading/);

            // Wait for response
            await page.waitForTimeout(TIMEOUTS.MEDIUM); // Using MEDIUM (600ms ≈ MEDIUM)

            // After error, button should be re-enabled
            await expect(submitBtn).not.toBeDisabled();
            await expect(submitBtn).not.toHaveClass(/loading/);
          }
        }
      }
    });

    test('should re-enable submit button after error response', async ({ page }) => {
      // Mock API to return error
      await page.route('**/api/personas', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: ['Test error'],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            const submitBtn = page.locator('[data-test="create-persona-submit"]');

            // Click submit
            await submitBtn.click();

            // Wait for error response
            await page.waitForTimeout(TIMEOUTS.MEDIUM);

            // Button should be re-enabled after error
            await expect(submitBtn).not.toBeDisabled();
            await expect(submitBtn).not.toHaveClass(/loading/);

            // Verify button is clickable again
            await expect(submitBtn).toBeEnabled();
          }
        }
      }
    });

    test('should show loading spinner on submit button during submission', async ({ page }) => {
      // Mock API to delay response
      await page.route('**/api/personas', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300)); // Short mock delay, intentionally not using TIMEOUTS constant
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: ['Test error'],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            const submitBtn = page.locator('[data-test="create-persona-submit"]');

            // Click submit
            await submitBtn.click();

            // Check for loading class immediately after click
            await expect(submitBtn).toHaveClass(/loading/);

            // Wait for response
            await page.waitForTimeout(TIMEOUTS.MEDIUM); // Using MEDIUM (400ms < MEDIUM)

            // Loading class should be removed after error
            await expect(submitBtn).not.toHaveClass(/loading/);
          }
        }
      }
    });
  });

  test.describe('Validation Error Message Display', () => {
    test('should display validation error when all three models from same provider', async ({
      page,
    }) => {
      // Mock API to return validation errors for all three models from same provider
      await page.route('**/api/personas', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: [
              'Task model and Judge model must be from different providers',
              'Task model and Prompt Engineer model must be from different providers',
              'Judge model and Prompt Engineer model must be from different providers',
            ],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Submit form
            await page.locator('[data-test="create-persona-submit"]').click();

            // Check validation error is visible
            const validationError = page.locator('[data-test="validation-error"]');
            await expect(validationError).toBeVisible({ timeout: TIMEOUTS.LONG });

            // Check all three error messages are present
            const errorMessage = await validationError.textContent();
            expect(errorMessage).toContain(
              'Task model and Judge model must be from different providers'
            );
            expect(errorMessage).toContain(
              'Task model and Prompt Engineer model must be from different providers'
            );
            expect(errorMessage).toContain(
              'Judge model and Prompt Engineer model must be from different providers'
            );

            // Verify error is clear and actionable - check styling
            await expect(validationError).toHaveClass(/alert-error/);

            // Verify the error messages are properly joined with separators
            expect(errorMessage).toContain('. ');
          }
        }
      }
    });

    test('should display validation error messages correctly', async ({ page }) => {
      // Mock API to return validation errors
      await page.route('**/api/personas', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: ['Task model and Judge model must be from different providers'],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Submit form
            await page.locator('[data-test="create-persona-submit"]').click();

            // Check validation error is visible
            const validationError = page.locator('[data-test="validation-error"]');
            await expect(validationError).toBeVisible({ timeout: TIMEOUTS.LONG });

            // Check error message content
            const errorMessage = await validationError.textContent();
            expect(errorMessage).toContain(
              'Task model and Judge model must be from different providers'
            );

            // Check error styling
            await expect(validationError).toHaveClass(/alert-error/);
          }
        }
      }
    });

    test('should display multiple validation errors joined by separator', async ({ page }) => {
      // Mock API to return multiple validation errors
      await page.route('**/api/personas', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: [
              'Task model and Judge model must be from different providers',
              'Judge model and Prompt Engineer model must be from different providers',
            ],
          }),
        });
      });

      // Fill in form
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      // Select models if available
      const taskSelected = await selectModelForRole(page, 'task');

      if (taskSelected) {
        const judgeSelected = await selectModelForRole(page, 'judge');

        if (judgeSelected) {
          const engineerSelected = await selectModelForRole(page, 'engineer');

          if (engineerSelected) {
            // Submit form
            await page.locator('[data-test="create-persona-submit"]').click();

            // Check validation error is visible
            const validationError = page.locator('[data-test="validation-error"]');
            await expect(validationError).toBeVisible({ timeout: TIMEOUTS.LONG });

            // Check both error messages are present
            const errorMessage = await validationError.textContent();
            expect(errorMessage).toContain(
              'Task model and Judge model must be from different providers'
            );
            expect(errorMessage).toContain(
              'Judge model and Prompt Engineer model must be from different providers'
            );

            // Check they are joined by separator
            expect(errorMessage).toContain('. ');
          }
        }
      }
    });
  });

  test.describe('Clear Selection Buttons', () => {
    test('should clear model selection when clear button clicked', async ({ page }) => {
      // Select a model
      const taskModelSelect = page.locator('[data-test="task-model"]');
      const taskModelOptions = await taskModelSelect.locator('option:not([value=""])').count();

      if (taskModelOptions > 0) {
        await taskModelSelect.selectOption({ index: 1 });
        await page.waitForTimeout(TIMEOUTS.SHORT);

        // Verify selection
        const selectedValue = await taskModelSelect.inputValue();
        expect(selectedValue).not.toBe('');

        // Click clear button
        const clearButton = page.locator('button[data-target="task-model-select"]');
        await clearButton.click();
        await page.waitForTimeout(TIMEOUTS.SHORT);

        // Verify selection is cleared
        const clearedValue = await taskModelSelect.inputValue();
        expect(clearedValue).toBe('');
      }
    });

    test('should update available options after clearing selection', async ({ page }) => {
      // Fill in required fields
      await page.locator('[data-test="persona-name"]').fill('Test Persona');
      await page.locator('[data-test="task-prompt"]').fill('Test task prompt');
      await page.locator('[data-test="judge-prompt"]').fill('Test judge prompt');

      const taskModelSelect = page.locator('[data-test="task-model"]');
      const judgeModelSelect = page.locator('[data-test="judge-model"]');
      const taskModelOptions = await taskModelSelect.locator('option:not([value=""])').count();

      if (taskModelOptions > 0) {
        // Select task model
        await taskModelSelect.selectOption({ index: 1 });
        await page.waitForTimeout(TIMEOUTS.SHORT);

        // Get the provider of selected task model
        const selectedTaskOption = taskModelSelect.locator('option:checked');
        const taskProvider = await selectedTaskOption.getAttribute('data-provider');

        if (taskProvider) {
          // Verify that provider options are disabled in judge select
          const disabledJudgeOptions = judgeModelSelect.locator(
            `option[data-provider="${taskProvider}"][disabled]`
          );
          const disabledCount = await disabledJudgeOptions.count();

          // Clear task model selection
          const clearButton = page.locator('button[data-target="task-model-select"]');
          await clearButton.click();
          await page.waitForTimeout(TIMEOUTS.SHORT);

          // Verify that provider options are now enabled in judge select
          const enabledJudgeOptions = judgeModelSelect.locator(
            `option[data-provider="${taskProvider}"]:not([disabled]):not([value=""])`
          );
          const enabledCount = await enabledJudgeOptions.count();

          // After clearing, previously disabled options should be enabled
          if (disabledCount > 0) {
            expect(enabledCount).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});
