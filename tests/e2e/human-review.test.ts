/**
 * E2E tests for Human Review workflow
 * Tests MANDATORY iteration 1 review workflow and OPTIONAL iteration 2+ validation
 */

import { test, expect } from '@playwright/test';

test.describe('Human Review Workflow', () => {
  let personaId = '';
  let iterationNumber = 1;

  test.beforeAll(async ({ request }) => {
    // Try to find an existing persona with training iterations
    const response = await request.get('/api/personas');
    const personas = await response.json();

    // Find a persona with training iterations
    for (const persona of personas) {
      const iterResponse = await request.get(`/api/personas/${persona.id}/iterations`);
      const iterations = await iterResponse.json();
      if (iterations && iterations.length > 0) {
        personaId = persona.id;
        iterationNumber = iterations[0].iteration_number;
        break;
      }
    }
  });

  test.describe('Iteration 1 - MANDATORY Review', () => {
    test('should display MANDATORY review indicator for iteration 1', async ({ page }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Check for MANDATORY review indicator
      await expect(page.locator('text=REQUIRED FOR ITERATION 1')).toBeVisible();
      await expect(page.locator('text=100% required')).toBeVisible();
    });

    test('should display decision review interface with all required elements', async ({
      page,
    }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Check for split view layout
      await expect(page.locator('.decision-review')).toBeVisible();

      // Check for decision details display
      await expect(page.locator('.decision-details')).toBeVisible();

      // Check for feedback form
      await expect(page.locator('button:has-text("Agree with Judge")')).toBeVisible();
      await expect(page.locator('button:has-text("Disagree with Judge")')).toBeVisible();

      // Check for progress indicator
      await expect(page.locator('text=decisions reviewed')).toBeVisible();
    });

    test('should display input, expected_output, suggested_output, and judge reasoning', async ({
      page,
    }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Verify all decision elements are displayed
      await expect(page.locator('[data-test="input-field"]')).toBeVisible();
      await expect(page.locator('[data-test="expected-output-field"]')).toBeVisible();
      await expect(page.locator('[data-test="suggested-output-field"]')).toBeVisible();
      await expect(page.locator('[data-test="judge-reasoning-field"]')).toBeVisible();
    });

    test('should display automatic correctness badge from ground truth', async ({ page }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Check for automatic correctness badge (from ground truth comparison)
      await expect(page.locator('.correctness-badge')).toBeVisible();
    });

    test('should require notes when disagreeing with judge', async ({ page }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Click "Disagree with Judge" button
      await page.click('button:has-text("Disagree with Judge")');

      // Notes field should appear and be required
      await expect(page.locator('[data-test="reviewer-notes"]')).toBeVisible();

      // Submit button should be disabled until notes are provided
      await expect(page.locator('button[type="submit"]:not([disabled])')).not.toBeVisible();
    });

    test('should show Previous/Next navigation between decisions', async ({ page }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Check for navigation buttons
      const prevButton = page.locator('button:has-text("Previous")');
      const nextButton = page.locator('button:has-text("Next")');

      // At minimum, one should be visible (depending on current position)
      const hasNav = (await prevButton.count()) > 0 || (await nextButton.count()) > 0;
      expect(hasNav).toBe(true);
    });

    test('should update progress as decisions are reviewed', async ({ page }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Get initial progress text
      const initialProgress = await page.locator('[data-test="review-progress"]').textContent();

      // Submit a review (Agree with Judge)
      await page.click('button:has-text("Agree with Judge")');

      // Progress should update
      await page.waitForTimeout(500); // Wait for update
      const updatedProgress = await page.locator('[data-test="review-progress"]').textContent();

      expect(updatedProgress).not.toBe(initialProgress);
    });

    test('should show "Generate Refined Prompt" button when 100% complete (iteration 1 only)', async ({
      page,
    }) => {
      if (!personaId) test.skip();

      // This test assumes all decisions for iteration 1 have been reviewed
      // In practice, you'd need to set up the test data accordingly

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Check if review is complete (100%)
      const progressText = await page.locator('[data-test="review-progress"]').textContent();
      const isComplete = progressText && progressText.includes('100%');

      if (isComplete) {
        await expect(page.locator('button:has-text("Generate Refined Prompt")')).toBeVisible();
      }
    });

    test('should block navigation to other pages until iteration 1 review is complete', async ({
      page,
    }) => {
      if (!personaId) test.skip();

      await page.goto(`/personas/${personaId}/review/${iterationNumber}`);

      // Try to navigate away before review is complete
      // Should show warning or block navigation
      await page.goto(`/personas/${personaId}`);

      // Check if we're still on review page or if warning is shown
      const currentUrl = page.url();
      const isOnReviewPage = currentUrl.includes('/review/');

      // Either we're still on review page, or we see a warning
      const hasWarning = (await page.locator('text=complete review first').count()) > 0;

      expect(isOnReviewPage || hasWarning).toBe(true);
    });
  });

  test.describe('Iterations 2+ - OPTIONAL Validation', () => {
    let iteration2PlusNumber = 2;

    test.beforeEach(async ({ request }) => {
      // Find an iteration >= 2
      if (personaId) {
        const iterResponse = await request.get(`/api/personas/${personaId}/iterations`);
        const iterations = await iterResponse.json();

        const laterIteration = iterations.find((i: any) => i.iteration_number >= 2);
        if (laterIteration) {
          iteration2PlusNumber = laterIteration.iteration_number;
        }
      }
    });

    test('should display OPTIONAL indicator for iterations 2+', async ({ page }) => {
      if (!personaId || iteration2PlusNumber < 2) test.skip();

      await page.goto(`/personas/${personaId}/review/${iteration2PlusNumber}`);

      // Check for OPTIONAL validation indicator
      await expect(page.locator('text=OPTIONAL')).toBeVisible();
      await expect(page.locator('text=validation only')).toBeVisible();
    });

    test('should allow navigation away from review page for iterations 2+', async ({ page }) => {
      if (!personaId || iteration2PlusNumber < 2) test.skip();

      await page.goto(`/personas/${personaId}/review/${iteration2PlusNumber}`);

      // Navigate away should work without blocking
      await page.goto(`/personas/${personaId}`);

      // Should successfully navigate to persona detail
      expect(page.url()).toContain(`/personas/${personaId}`);
    });

    test('should display both automatic metrics and human validation side-by-side', async ({
      page,
    }) => {
      if (!personaId || iteration2PlusNumber < 2) test.skip();

      await page.goto(`/personas/${personaId}/review/${iteration2PlusNumber}`);

      // Check for automatic metrics display
      await expect(page.locator('[data-test="automatic-metrics"]')).toBeVisible();

      // Check for human validation section
      await expect(page.locator('[data-test="human-validation"]')).toBeVisible();
    });
  });

  test.describe('API Integration', () => {
    test('should submit human review feedback successfully', async ({ request }) => {
      if (!personaId) test.skip();

      // First, get a decision ID for testing
      const decisionsResponse = await request.get(
        `/api/personas/${personaId}/iterations/${iterationNumber}/decisions`
      );
      const decisions = await decisionsResponse.json();

      if (decisions && decisions.length > 0) {
        const decisionId = decisions[0].id;

        // Submit feedback
        const feedbackResponse = await request.post(
          `/api/personas/${personaId}/iterations/${iterationNumber}/feedback`,
          {
            data: {
              decision_id: decisionId,
              human_decision: 'agree',
              reviewer_notes: 'Test feedback for E2E',
            },
          }
        );

        expect(feedbackResponse.status()).toBe(201);
      }
    });

    test('should return 400 for invalid feedback submission', async ({ request }) => {
      if (!personaId) test.skip();

      // Submit feedback without required fields
      const feedbackResponse = await request.post(
        `/api/personas/${personaId}/iterations/${iterationNumber}/feedback`,
        {
          data: {}, // Missing required fields
        }
      );

      expect(feedbackResponse.status()).toBe(400);
    });
  });
});
