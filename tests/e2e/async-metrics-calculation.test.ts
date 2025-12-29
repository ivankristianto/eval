/**
 * E2E Test for Async Metrics Calculation Flow
 *
 * Tests the complete end-to-end flow:
 * 1. Navigate to human review page for iteration 1
 * 2. Complete human review
 * 3. Click "Calculate Metrics" button
 * 4. Verify redirect to /personas/{personaId}/metrics
 * 5. Verify "The training in progress" message appears
 * 6. Verify loading spinner visible
 * 7. Wait for metrics to complete and verify update
 * 8. Verify F1 score, precision, recall, Cohen's Kappa display correctly
 */

import { test, expect } from '@playwright/test';

test.describe('Async Metrics Calculation E2E', () => {
  test('should complete full async metrics calculation flow', async ({ page }) => {
    // Step 1: Mock API endpoints
    await page.route('/api/personas/**', async (route) => {
      const url = route.request().url();
      const response = getMockResponse(url);
      await route.fulfill(response);
    });

    // Step 2: Navigate to human review page for iteration 1
    await page.goto('/personas/test-persona-1/review/1');

    // Verify page loaded with correct title
    await expect(page.locator('h1')).toContainText('Review');
    await expect(page.locator('h1')).toContainText('Iteration 1');

    // Verify all decisions are shown
    const decisionCards = page.locator('.decision-card, [data-testid="decision"]');
    const decisionCount = await decisionCards.count();
    expect(decisionCount).toBeGreaterThan(0);

    // Step 3: Complete human review (simulate all decisions reviewed)
    // Mark all decisions as reviewed
    const reviewButtons = page.locator('button:has-text("Agree"), button:has-text("Disagree")');
    for (let i = 0; i < (await reviewButtons.count()); i++) {
      await reviewButtons.nth(i).click();
      // Fill in optional notes
      const notesField = page.locator('textarea[name="notes"]').first();
      if (await notesField.isVisible()) {
        await notesField.fill('Review complete');
      }
      // Submit review
      const submitBtn = page.locator('button:has-text("Submit Review")').first();
      await submitBtn.click();
    }

    // Step 4: Verify "All decisions reviewed" message appears
    const completeMessage = page.locator('text=/All \\d+ decisions reviewed/i');
    await expect(completeMessage).toBeVisible();

    // Verify "Generate Refined Prompt" button appears (iteration 1 specific)
    const generatePromptBtn = page.locator('#generate-prompt-btn');
    await expect(generatePromptBtn).toBeVisible();

    // Step 5: Click "Calculate Metrics" button
    const calculateMetricsBtn = page.locator('#calculate-metrics-btn');
    await expect(calculateMetricsBtn).toBeVisible();
    await expect(calculateMetricsBtn).toBeEnabled();
    await calculateMetricsBtn.click();

    // Step 6: Verify redirect to metrics page
    await expect(page).toHaveURL(/\/personas\/test-persona-1\/metrics/);

    // Verify URL contains iteration query parameter
    await expect(page).toHaveURL(/iteration=1/);

    // Step 7: Verify "The training in progress" message
    const progressMessage = page.locator('text=The training in progress');
    await expect(progressMessage).toBeVisible();

    // Step 8: Verify loading spinner is visible
    const loadingSpinner = page.locator('svg animate-spin, .loading-spinner');
    await expect(loadingSpinner.first()).toBeVisible();

    // Step 9: Wait for metrics calculation to complete
    // The mock will return completed status after a delay
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return body.includes('Metrics Calculated') || body.includes('F1 Score');
      },
      { timeout: 20000 }
    );

    // Step 10: Verify F1 score displays correctly
    const f1Card = page.locator('.metric-card:has-text("F1 Score")');
    await expect(f1Card).toBeVisible();

    // Verify F1 value is present
    const f1Value = page.locator(
      '.metric-card:has-text("F1 Score") .metric-value, .metric-card:has-text("F1 Score") .value'
    );
    await expect(f1Value.first()).not.toBeEmpty();

    // Step 11: Verify precision, recall, Cohen's Kappa display
    const metricCards = [
      { name: 'Precision', expectedPattern: /0\.\d+/ },
      { name: 'Recall', expectedPattern: /0\.\d+/ },
      { name: "Cohen's Kappa", expectedPattern: /0\.\d+/ },
      { name: 'Accuracy', expectedPattern: /0\.\d+/ },
    ];

    for (const metric of metricCards) {
      const card = page.locator(`.metric-card:has-text("${metric.name}")`);
      await expect(card).toBeVisible({ timeout: 5000 });
    }

    // Step 12: Verify confusion matrix visualization
    const confusionMatrix = page.locator('.confusion-matrix, [class*="confusion"]');
    await expect(confusionMatrix).toBeVisible();

    // Verify TP, TN, FP, FN values
    const tpLabel = page.locator('text=/True Positives.*\\d+/i');
    await expect(tpLabel.first()).toBeVisible();
  });

  test('should handle retry on calculation failure', async ({ page }) => {
    // Mock API to initially fail, then succeed on retry
    let attempt = 0;
    await page.route('/api/personas/test-persona-1/iterations/1/status', (route) => {
      attempt++;
      if (attempt === 1) {
        // First request - return calculating
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'calculating',
            iteration: 1,
            persona_id: 'test-persona-1',
            message: 'The training in progress',
            progress_percent: 50,
          }),
        });
      } else if (attempt === 2) {
        // Second request - return error
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'error',
            iteration: 1,
            persona_id: 'test-persona-1',
            message: 'Temporary database connection issue',
          }),
        });
      } else {
        // Third request and beyond - return completed
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            iteration: 1,
            persona_id: 'test-persona-1',
            metrics: {
              f1_score: 0.85,
              precision: 0.88,
              recall: 0.82,
              cohens_kappa: 0.78,
              accuracy: 0.87,
              confusion_matrix: {
                true_positives: 45,
                true_negatives: 35,
                false_positives: 8,
                false_negatives: 7,
              },
            },
          }),
        });
      }
    });

    // Navigate to metrics page
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Wait for error state
    await page.waitForFunction(() => document.body.textContent?.includes('Calculation Failed'), {
      timeout: 15000,
    });

    // Verify error message
    const errorMsg = page.locator('text=Temporary database connection issue');
    await expect(errorMsg).toBeVisible();

    // Click retry button
    const retryBtn = page.locator('button:has-text("Retry")');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Wait for completion after retry
    await page.waitForFunction(() => document.body.textContent?.includes('F1 Score'), {
      timeout: 15000,
    });

    // Verify metrics are displayed
    const f1Card = page.locator('.metric-card:has-text("F1 Score")');
    await expect(f1Card).toBeVisible();
  });

  test('should show progress bar during calculation', async ({ page }) => {
    // Mock status with progress percentage
    await page.route('/api/personas/test-persona-1/iterations/1/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'calculating',
          iteration: 1,
          persona_id: 'test-persona-1',
          message: 'The training in progress',
          progress_percent: 67,
        }),
      })
    );

    // Navigate to metrics page
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Verify progress bar is visible
    const progressBar = page.locator('progress, [class*="progress"]');
    await expect(progressBar).toBeVisible();

    // Verify progress percentage is displayed
    const progressText = page.locator('text=/67%.*complete/i');
    await expect(progressText.first()).toBeVisible();
  });
});

// Mock response generator
function getMockResponse(url: string): { status: number; contentType: string; body: string } {
  if (url.includes('/calculate-metrics')) {
    return {
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'in_progress',
        iteration: 1,
        persona_id: 'test-persona-1',
        message: 'Metrics calculation started',
        started_at: new Date().toISOString(),
      }),
    };
  }

  if (url.includes('/status')) {
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'calculating',
        iteration: 1,
        persona_id: 'test-persona-1',
        message: 'The training in progress',
        progress_percent: 45,
      }),
    };
  }

  if (url.includes('/decisions')) {
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decisions: [
          {
            id: 'decision-1',
            input: 'Test input 1',
            expected_output: 'Expected output 1',
            suggested_output: 'Model output 1',
            judge_decision: 'agree',
            judge_reasoning: 'Output matches criteria',
            automatic_correctness: true,
          },
        ],
        total: 1,
        reviewed: 0,
      }),
    };
  }

  if (url.includes('/feedback')) {
    return {
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        decision_id: 'decision-1',
      }),
    };
  }

  return {
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'Not found' }),
  };
}
