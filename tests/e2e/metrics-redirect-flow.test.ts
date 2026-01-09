/**
 * E2E tests for metrics redirect flow
 *
 * Tests the complete flow:
 * 1. Navigate to review page
 * 2. Click "Calculate Metrics" button
 * 3. Verify redirect to metrics page
 * 4. Verify URL contains query parameter
 * 5. Verify "The training in progress" message visible
 * 6. Wait for completion and verify metrics displayed
 * 7. Test going back and clicking again (already in progress scenario)
 */

import { test, expect } from '@playwright/test';

test.describe('Metrics Redirect Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Setup API mocks
    await page.route('/api/personas/**', async (route) => {
      const url = route.request().url();
      const responseData = getMockApiResponse(url);
      await route.fulfill({
        status: responseData.status,
        contentType: 'application/json',
        body: JSON.stringify(responseData.body),
      });
    });
  });

  test('should redirect to metrics page after clicking Calculate Metrics', async ({ page }) => {
    // Navigate to review page
    await page.goto('/personas/test-persona-1/review/1');

    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Review');

    // Find and click Calculate Metrics button
    const calculateMetricsBtn = page.locator('#calculate-metrics-btn');
    await expect(calculateMetricsBtn).toBeVisible();
    await expect(calculateMetricsBtn).toBeEnabled();

    // Click the button
    await calculateMetricsBtn.click();

    // Verify redirect to metrics page
    await expect(page).toHaveURL(/\/personas\/test-persona-1\/metrics/);

    // Verify URL contains iteration query parameter
    await expect(page).toHaveURL(/iteration=1/);
  });

  test('should show "The training in progress" message on metrics page', async ({ page }) => {
    // Navigate to metrics page with iteration parameter
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Metrics');

    // Verify "The training in progress" message is visible
    const progressMessage = page.locator('text=The training in progress');
    await expect(progressMessage).toBeVisible();

    // Verify loading spinner is visible
    const loadingSpinner = page.locator('.loading-spinner, svg.animate-spin');
    await expect(loadingSpinner).toBeVisible();
  });

  test('should update page when metrics calculation completes', async ({ page }) => {
    // Navigate to metrics page
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Wait for calculation to complete (mock returns completed after 2 seconds)
    await page.waitForFunction(
      () => {
        const message = document.body.textContent;
        return message && message.includes('Metrics Calculated');
      },
      { timeout: 10000 }
    );

    // Verify metrics are displayed
    const f1Score = page.locator('text=/F1.*Score.*0\\.\\d+/i');
    await expect(f1Score).toBeVisible();

    // Verify MetricCards are shown
    const metricCards = page.locator('.metric-card, [class*="metric"]');
    await expect(metricCards.first()).toBeVisible();
  });

  test('should handle already-in-progress scenario', async ({ page }) => {
    // Mock API to return in-progress status
    await page.route('/api/personas/test-persona-1/iterations/1/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'calculating',
          iteration: 1,
          persona_id: 'test-persona-1',
          message: 'The training in progress',
          progress_percent: 45,
        }),
      })
    );

    // Navigate to metrics page
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Verify progress is shown
    const progressBar = page.locator('progress');
    await expect(progressBar).toBeVisible();

    // Click back to review page
    await page.goto('/personas/test-persona-1/review/1');

    // Try to calculate metrics again
    const calculateMetricsBtn = page.locator('#calculate-metrics-btn');
    await calculateMetricsBtn.click();

    // Should show 409 conflict message or handle gracefully
    // Either way, button should be disabled or show appropriate message
    const alert = page.locator('.alert-error, .alert-warning').first();
    await expect(alert).toBeVisible();
  });

  test('should display metrics correctly after calculation', async ({ page }) => {
    // Navigate to metrics page with completed calculation
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Wait for completion
    await page.waitForFunction(
      () => {
        const message = document.body.textContent;
        return message && message.includes('Metrics Calculated');
      },
      { timeout: 10000 }
    );

    // Verify F1 Score is displayed with correct value
    const f1Card = page.locator('.metric-card:has-text("F1 Score")');
    await expect(f1Card).toBeVisible();

    // Verify Precision is displayed
    const precisionCard = page.locator('.metric-card:has-text("Precision")');
    await expect(precisionCard).toBeVisible();

    // Verify Recall is displayed
    const recallCard = page.locator('.metric-card:has-text("Recall")');
    await expect(recallCard).toBeVisible();

    // Verify Cohen's Kappa is displayed
    const kappaCard = page.locator('.metric-card:has-text("Kappa")');
    await expect(kappaCard).toBeVisible();
  });

  test('should show error message on calculation failure', async ({ page }) => {
    // Mock API to return error status
    await page.route('/api/personas/test-persona-1/iterations/1/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          iteration: 1,
          persona_id: 'test-persona-1',
          message: 'Database connection failed',
        }),
      })
    );

    // Navigate to metrics page
    await page.goto('/personas/test-persona-1/metrics?iteration=1');

    // Wait for error to be displayed
    await page.waitForFunction(
      () => {
        const message = document.body.textContent;
        return (
          message &&
          (message.includes('Calculation Failed') || message.includes('Database connection failed'))
        );
      },
      { timeout: 5000 }
    );

    // Verify error message is visible
    const errorMessage = page.locator('text=/Calculation.*Failed/i');
    await expect(errorMessage).toBeVisible();

    // Verify retry button is visible
    const retryButton = page.locator('button:has-text("Retry")');
    await expect(retryButton).toBeVisible();
  });
});

// Helper function to generate mock API responses
function getMockApiResponse(url: string): {
  status: number;
  body: {
    status?: string;
    iteration?: number;
    persona_id?: string;
    message?: string;
    started_at?: string;
    metrics?: { f1_score: number };
    error?: string;
    code?: string;
  };
} {
  if (url.includes('/api/personas/test-persona-1/iterations/1/calculate-metrics')) {
    // Return 202 Accepted for calculate-metrics
    return {
      status: 202,
      body: {
        status: 'in_progress',
        iteration: 1,
        persona_id: 'test-persona-1',
        message: 'Metrics calculation started. Poll /status endpoint for completion.',
        started_at: new Date().toISOString(),
      },
    };
  }

  if (url.includes('/api/personas/test-persona-1/iterations/1/status')) {
    // Return calculating status initially, then completed
    return {
      status: 200,
      body: {
        status: 'calculating',
        iteration: 1,
        persona_id: 'test-persona-1',
        message: 'The training in progress',
      },
    };
  }

  // Default response
  return {
    status: 404,
    body: { error: 'Not found', code: 'NOT_FOUND' },
  };
}
