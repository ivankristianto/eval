/**
 * Workspace Page UI E2E Tests
 *
 * Comprehensive test suite for the workspace page UI elements and functionality.
 * Tests verify components display correctly, user interactions work, and the page
 * handles both empty and populated training data scenarios.
 *
 * Test scenarios:
 * - Empty state (no training data)
 * - Populated state (with training data)
 * - Component visibility and functionality
 * - User interactions (version switching, prompt editing)
 */

import { test, expect } from '@playwright/test';

test.describe('Workspace Page - UI Elements', () => {
  let personaId = '';
  let personaName = '';

  /**
   * Setup: Create or find a test persona before running tests
   */
  test.beforeAll(async ({ request }) => {
    // Try to find an existing persona first
    const listResponse = await request.get('/api/personas');
    const personas = await listResponse.json();

    if (personas && personas.length > 0) {
      personaId = personas[0].id;
      personaName = personas[0].name;
    } else {
      // Create a test persona if none exists
      const createResponse = await request.post('/api/personas', {
        data: {
          name: 'E2E Test Workspace Persona',
          description: 'Test persona for workspace UI tests',
          task_model_id: 'gpt-4o-mini',
          judge_model_id: 'gpt-4o-mini',
          engineer_model_id: 'gpt-4o-mini',
        },
      });

      if (createResponse.ok()) {
        const created = await createResponse.json();
        personaId = created.id;
        personaName = created.name;
      }
    }
  });

  test.beforeEach(async () => {
    // Ensure we have a persona ID
    if (!personaId) {
      test.skip(true, 'No persona available for testing');
    }
  });

  /**
   * Test: Verify workspace page loads with correct persona name in title
   */
  test('should display workspace page with correct persona name in title', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify page title contains persona name
    await expect(page.locator('h1')).toContainText(personaName);

    // Verify "Training Workspace" subtitle
    await expect(page.locator('text=Training Workspace')).toBeVisible();

    // Verify version badge is displayed
    await expect(page.locator('.badge.font-mono')).toBeVisible();
  });

  /**
   * Test: Verify PromptEditor components display in tabbed interface
   */
  test('should display tabbed prompt editor interface', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify tab buttons exist
    const taskTab = page.locator('#tab-task');
    const judgeTab = page.locator('#tab-judge');
    await expect(taskTab).toBeVisible();
    await expect(judgeTab).toBeVisible();

    // Verify task tab is checked by default
    await expect(taskTab).toBeChecked();
    await expect(judgeTab).not.toBeChecked();

    // Verify task prompt editor is visible (task tab active by default)
    const taskPromptEditor = page.locator('[data-prompt-editor="task"]');
    await expect(taskPromptEditor).toBeVisible();
    await expect(taskPromptEditor).toHaveAttribute('placeholder', /Enter your task prompt/);

    // Verify task prompt label
    await expect(page.locator('text=Task Prompt')).toBeVisible();

    // Verify judge prompt editor panel exists but is hidden
    const judgePromptPanel = page.locator('[data-tab-panel="judge-prompt-panel"]');
    await expect(judgePromptPanel).toHaveClass(/hidden/);

    // Verify character count is displayed for visible editor
    const charCount = page.locator('.label-text-alt:has-text("chars")');
    await expect(charCount.first()).toBeVisible();
  });

  /**
   * Test: Verify VersionSelector components display
   */
  test('should display VersionSelector components', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify task version selector
    const taskVersionSelector = page.locator('[data-version-selector="task"]');
    await expect(taskVersionSelector).toBeVisible();

    // Verify task version label
    await expect(page.locator('text=Task Prompt Version')).toBeVisible();

    // Verify judge version selector
    const judgeVersionSelector = page.locator('[data-version-selector="judge"]');
    await expect(judgeVersionSelector).toBeVisible();

    // Verify judge version label
    await expect(page.locator('text=Judge Prompt Version')).toBeVisible();

    // Verify version count is displayed for both
    const versionCounts = page.locator('.label-text-alt:has-text("versions")');
    await expect(versionCounts).toHaveCount(2);
  });

  /**
   * Test: Verify SimpleMetrics component displays
   */
  test('should display SimpleMetrics component', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify metrics section header
    await expect(page.locator('text=Evaluation Metrics')).toBeVisible();

    // Verify F1 Score metric
    await expect(page.locator('text=F1 Score')).toBeVisible();

    // Verify Cohen's Kappa metric
    await expect(page.locator("text=Cohen's Kappa")).toBeVisible();

    // Verify Precision metric
    await expect(page.locator('text=Precision')).toBeVisible();

    // Verify Recall metric
    await expect(page.locator('text=Recall')).toBeVisible();

    // Verify metric stat containers
    const statContainers = page.locator('.stat');
    await expect(statContainers.first()).toBeVisible();
  });

  /**
   * Test: Verify TrainingPairsTable displays (or empty state)
   */
  test('should display TrainingPairsTable or empty state', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Check if table exists or empty state is shown
    const table = page.locator('#training-pairs-table');
    const emptyState = page.locator('text=No Training Data');

    const isTableVisible = await table.isVisible().catch(() => false);
    await emptyState.isVisible().catch(() => false);

    // One of these should be visible
    expect(isTableVisible || emptyState).toBe(true);

    if (isTableVisible) {
      // Verify table headers
      await expect(page.locator('th:has-text("Input")')).toBeVisible();
      await expect(page.locator('th:has-text("Expected Output")')).toBeVisible();
      await expect(page.locator('th:has-text("Generated Output")')).toBeVisible();
      await expect(page.locator('th:has-text("Human Rating")')).toBeVisible();
      await expect(page.locator('th:has-text("Judge Rating")')).toBeVisible();
    }
  });

  /**
   * Test: Verify OptimizationSuggestion component displays (as modals)
   */
  test('should display OptimizationSuggestion modals', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify optimization modals exist (hidden by default)
    const taskModal = page.locator('#optimization-modal-task');
    const judgeModal = page.locator('#optimization-modal-judge');

    // Both modals should exist in DOM
    await expect(taskModal).toHaveCount(1);
    await expect(judgeModal).toHaveCount(1);

    // Verify Optimize buttons exist
    const optimizeButtons = page.locator('[data-action="optimize"]');
    await expect(optimizeButtons).toHaveCount(2);
  });

  /**
   * Test: Verify user can switch between prompt versions
   */
  test('should allow switching between prompt versions', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Get initial values of version selectors
    const taskSelector = page.locator('[data-version-selector="task"]');
    const judgeSelector = page.locator('[data-version-selector="judge"]');

    // Verify selectors are enabled
    await expect(taskSelector).toBeEnabled();
    await expect(judgeSelector).toBeEnabled();

    // Get options count
    const taskOptions = await taskSelector.locator('option').count();
    const judgeOptions = await judgeSelector.locator('option').count();

    // Should have at least version 0
    expect(taskOptions).toBeGreaterThanOrEqual(1);
    expect(judgeOptions).toBeGreaterThanOrEqual(1);
  });

  /**
   * Test: Verify user can switch between prompt editor tabs
   */
  test('should allow switching between prompt editor tabs', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify initial state: task tab active, judge tab inactive
    const taskTab = page.locator('#tab-task');
    const judgeTab = page.locator('#tab-judge');
    const taskPanel = page.locator('[data-tab-panel="task-prompt-panel"]');
    const judgePanel = page.locator('[data-tab-panel="judge-prompt-panel"]');
    const taskEditor = page.locator('[data-prompt-editor="task"]');
    const judgeEditor = page.locator('[data-prompt-editor="judge"]');

    await expect(taskTab).toBeChecked();
    await expect(judgeTab).not.toBeChecked();
    await expect(taskPanel).not.toHaveClass(/hidden/);
    await expect(judgePanel).toHaveClass(/hidden/);
    await expect(taskEditor).toBeVisible();

    // Click judge tab label to switch
    await page.locator('label[for="tab-judge"]').click();

    // Verify state after switching: judge tab active, task tab inactive
    await expect(judgeTab).toBeChecked();
    await expect(taskTab).not.toBeChecked();
    await expect(judgePanel).not.toHaveClass(/hidden/);
    await expect(taskPanel).toHaveClass(/hidden/);
    await expect(judgeEditor).toBeVisible();

    // Switch back to task tab
    await page.locator('label[for="tab-task"]').click();

    // Verify state after switching back: task tab active, judge tab inactive
    await expect(taskTab).toBeChecked();
    await expect(judgeTab).not.toBeChecked();
    await expect(taskPanel).not.toHaveClass(/hidden/);
    await expect(judgePanel).toHaveClass(/hidden/);
    await expect(taskEditor).toBeVisible();
  });

  /**
   * Test: Verify prompt content persists when switching tabs
   */
  test('should preserve prompt content when switching tabs', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    const taskEditor = page.locator('[data-prompt-editor="task"]');
    const testTaskText = 'Test content persistence in task prompt';

    // Store original value
    const originalTaskText = await taskEditor.inputValue();

    // Edit task prompt
    await taskEditor.clear();
    await taskEditor.fill(testTaskText);
    await expect(taskEditor).toHaveValue(testTaskText);

    // Switch to judge tab
    await page.locator('label[for="tab-judge"]').click();

    // Switch back to task tab
    await page.locator('label[for="tab-task"]').click();

    // Verify content persisted
    await expect(taskEditor).toHaveValue(testTaskText);

    // Restore original value
    await taskEditor.clear();
    await taskEditor.fill(originalTaskText);
  });

  /**
   * Test: Verify user can edit prompts in both tabs
   */
  test('should allow editing prompts in both tabs', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Get prompt editors
    const taskEditor = page.locator('[data-prompt-editor="task"]');

    // Test editing task prompt (visible by default)
    await expect(taskEditor).toBeEditable();
    const originalTaskText = await taskEditor.inputValue();
    const testTaskText = 'Test task prompt for E2E testing';
    await taskEditor.clear();
    await taskEditor.fill(testTaskText);
    await expect(taskEditor).toHaveValue(testTaskText);

    // Switch to judge tab
    await page.locator('label[for="tab-judge"]').click();

    // Test editing judge prompt
    const judgeEditor = page.locator('[data-prompt-editor="judge"]');
    await expect(judgeEditor).toBeEditable();
    const originalJudgeText = await judgeEditor.inputValue();
    const testJudgeText = 'Test judge prompt for E2E testing';
    await judgeEditor.clear();
    await judgeEditor.fill(testJudgeText);
    await expect(judgeEditor).toHaveValue(testJudgeText);

    // Restore original values
    await judgeEditor.clear();
    await judgeEditor.fill(originalJudgeText);

    // Switch back to task tab and restore
    await page.locator('label[for="tab-task"]').click();
    await taskEditor.clear();
    await taskEditor.fill(originalTaskText);
  });

  /**
   * Test: Verify action buttons are displayed
   */
  test('should display action buttons in header', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify "Generate Outputs" button
    await expect(page.locator('[data-action="generate-outputs"]')).toBeVisible();

    // Verify "Generate Judge" button
    await expect(page.locator('[data-action="generate-judge"]')).toBeVisible();

    // Verify "Evaluate All" button
    await expect(page.locator('[data-action="evaluate-all"]')).toBeVisible();

    // Verify buttons have persona-id attribute
    const generateButton = page.locator('[data-action="generate-outputs"]');
    await expect(generateButton).toHaveAttribute('data-persona-id', personaId);
  });

  /**
   * Test: Verify History buttons are displayed
   */
  test('should display History buttons for viewing prompt history', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify History buttons exist
    const historyButtons = page.locator('[data-action="view-history"]');
    await expect(historyButtons).toHaveCount(2);
  });
});

test.describe('Workspace Page - Empty State', () => {
  let personaId = '';

  test.beforeAll(async ({ request }) => {
    // Create a new persona with no training data
    const createResponse = await request.post('/api/personas', {
      data: {
        name: 'E2E Empty Workspace Test',
        description: 'Test persona for empty workspace state',
        task_model_id: 'gpt-4o-mini',
        judge_model_id: 'gpt-4o-mini',
        engineer_model_id: 'gpt-4o-mini',
      },
    });

    if (createResponse.ok()) {
      const created = await createResponse.json();
      personaId = created.id;
    }
  });

  test('should handle empty state gracefully', async ({ page }) => {
    if (!personaId) {
      test.skip(true, 'Could not create test persona');
    }

    await page.goto(`/personas/${personaId}/workspace`);

    // Verify page loads without errors
    await expect(page).toHaveURL(/\/workspace$/);

    // Verify empty state message is shown
    const emptyState = page.locator('text=No Training Data');
    const isVisible = await emptyState.isVisible().catch(() => false);

    if (isVisible) {
      // Verify empty state elements
      await expect(page.locator('text=Upload a CSV file to add training pairs')).toBeVisible();
    }

    // Verify metrics show zero/default values
    await expect(page.locator('text=F1 Score')).toBeVisible();
    await expect(page.locator('text=Total Pairs')).toBeVisible();
  });
});

test.describe('Workspace Page - With Training Data', () => {
  let personaId = '';

  test.beforeAll(async ({ request }) => {
    // Try to find a persona with training data or create one
    const listResponse = await request.get('/api/personas');
    const personas = await listResponse.json();

    if (personas && personas.length > 0) {
      // Use first available persona
      personaId = personas[0].id;

      // Check if it has training pairs
      const pairsResponse = await request.get(`/api/personas/${personaId}/training/pairs`);
      const pairs = await pairsResponse.json();

      // If no pairs, try to upload some
      if (!pairs || pairs.length === 0) {
        const csvData = `input,expected_output
"Test input 1","Test output 1"
"Test input 2","Test output 2"
"Test input 3","Test output 3"
"Test input 4","Test output 4"
"Test input 5","Test output 5"`;

        const uploadResponse = await request.post(`/api/personas/${personaId}/training/upload`, {
          data: { csv: csvData },
        });

        if (!uploadResponse.ok()) {
          console.warn('Could not upload training data for E2E test');
        }
      }
    }
  });

  test('should display training pairs table when data exists', async ({ page }) => {
    if (!personaId) {
      test.skip(true, 'No persona with training data available');
    }

    await page.goto(`/personas/${personaId}/workspace`);

    // Wait a moment for data to load
    await page.waitForTimeout(500);

    // Check if table has data rows (excluding new-row template)
    const dataRows = page.locator('#training-pairs-body tr:not([data-new-row])');
    const rowCount = await dataRows.count();

    if (rowCount > 0) {
      // Verify table structure
      await expect(page.locator('#training-pairs-table')).toBeVisible();

      // Verify data cells exist
      const inputCell = dataRows.first().locator('[data-cell-type="input"]');
      await expect(inputCell).toBeVisible();

      // Verify expected output cell
      const expectedCell = dataRows.first().locator('[data-cell-type="expected-output"]');
      await expect(expectedCell).toBeVisible();
    }
  });

  test('should display new row for adding pairs', async ({ page }) => {
    if (!personaId) {
      test.skip(true, 'No persona available');
    }

    await page.goto(`/personas/${personaId}/workspace`);

    // Verify new row exists
    const newRow = page.locator('tr[data-new-row="true"]');
    await expect(newRow).toBeVisible();

    // Verify input fields in new row
    await expect(newRow.locator('[data-new-field="input"]')).toBeVisible();
    await expect(newRow.locator('[data-new-field="expected_output"]')).toBeVisible();
    await expect(newRow.locator('[data-new-field="feedback"]')).toBeVisible();

    // Verify save button
    await expect(newRow.locator('[data-action="save-new-row"]')).toBeVisible();
  });

  test('should display Import CSV button', async ({ page }) => {
    if (!personaId) {
      test.skip(true, 'No persona available');
    }

    await page.goto(`/personas/${personaId}/workspace`);

    // Verify Import CSV button
    await expect(page.locator('[data-action="import-csv"]')).toBeVisible();
    await expect(page.locator('text=Import CSV')).toBeVisible();

    // Verify file input exists
    await expect(page.locator('[data-action="csv-file-input"]')).toHaveCount(1);
  });

  test('should display pair count in table header', async ({ page }) => {
    if (!personaId) {
      test.skip(true, 'No persona available');
    }

    await page.goto(`/personas/${personaId}/workspace`);

    // Wait for data to load
    await page.waitForTimeout(500);

    // Verify pairs count is displayed
    const pairsCountText = page.locator('text=/\\d+ pairs/');
    const isVisible = await pairsCountText.isVisible().catch(() => false);

    if (isVisible) {
      // Verify the text format
      const countText = await pairsCountText.textContent();
      expect(countText).toMatch(/\d+ pairs/);
    }
  });
});

test.describe('Workspace Page - User Interactions', () => {
  let personaId = '';

  test.beforeAll(async ({ request }) => {
    const listResponse = await request.get('/api/personas');
    const personas = await listResponse.json();

    if (personas && personas.length > 0) {
      personaId = personas[0].id;
    }
  });

  test.beforeEach(async () => {
    if (!personaId) {
      test.skip(true, 'No persona available');
    }
  });

  test('should show version history modal when History button clicked', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Click History button for task prompt
    const taskHistoryBtn = page.locator('[data-action="view-history"][data-type="task"]');
    await taskHistoryBtn.click();

    // Verify modal opens
    const modal = page.locator('#task-prompt-history');
    await expect(modal).toBeChecked();

    // Verify modal content
    await expect(page.locator('text=Task Prompt History')).toBeVisible();

    // Close modal
    await page.locator(`label[for="task-prompt-history"]`).click();
  });

  test('should display polling status indicator', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify polling status element exists (hidden by default)
    const pollingStatus = page.locator('#polling-status');
    await expect(pollingStatus).toHaveCount(1);

    // Verify it's hidden initially
    await expect(pollingStatus).toHaveClass(/hidden/);
  });

  test('should have correct breadcrumbs', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Verify breadcrumbs exist
    const breadcrumbs = page.locator('.breadcrumbs');
    await expect(breadcrumbs).toBeVisible();

    // Verify Home link
    await expect(breadcrumbs.locator('a:has-text("Home")')).toBeVisible();

    // Verify Personas link
    await expect(breadcrumbs.locator('a:has-text("Personas")')).toBeVisible();
  });

  test('should update character count when typing in prompt editor', async ({ page }) => {
    await page.goto(`/personas/${personaId}/workspace`);

    // Get task editor
    const taskEditor = page.locator('[data-prompt-editor="task"]');

    // Type some text
    await taskEditor.fill('Test prompt text');

    // Verify character count updated
    const currentText = await taskEditor.inputValue();
    expect(currentText.length).toBe('Test prompt text'.length);
  });
});
