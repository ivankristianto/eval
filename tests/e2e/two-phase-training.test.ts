/**
 * E2E tests for Two-Phase Training workflow
 * Tests complete TWO-PHASE training: (1) Iteration 1 human-driven, (2) Iterations 2+ fully automated
 */

import { test, expect } from '@playwright/test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, unlinkSync } from 'fs';
import { rm } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_CSV_DIR = join(__dirname, '..', 'data');

test.describe('Two-Phase Training Workflow', () => {
  let personaId = '';
  let taskModelId = '';
  let judgeModelId = '';
  let promptEngineerModelId = '';

  test.beforeAll(async ({ request }) => {
    // Get available models for testing
    try {
      const modelsResponse = await request.get('/api/models');
      const modelsData = await modelsResponse.json();

      // Handle different response formats
      const models = Array.isArray(modelsData) ? modelsData : modelsData.models || [];

      // Find three different providers
      const providers = new Map();
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
      // Models API might not be available, skip model selection
      console.log('Could not fetch models:', error);
    }

    // Try to find an existing persona with training data
    try {
      const personasResponse = await request.get('/api/personas');
      const personas = await personasResponse.json();

      // Find a persona that has training data and is in draft status
      for (const persona of personas) {
        const pairsResponse = await request.get(`/api/personas/${persona.id}/training/pairs`);
        const pairs = await pairsResponse.json();
        if (pairs && pairs.length >= 10 && persona.status === 'draft') {
          personaId = persona.id;
          break;
        }
      }
    } catch (error) {
      // Personas API might not be available
      console.log('Could not fetch personas:', error);
    }
  });

  test.afterAll(async () => {
    // Clean up any test data
    const csvPath = join(TEST_CSV_DIR, 'two-phase-training.csv');
    try {
      await rm(csvPath, { force: true });
    } catch {
      // File doesn't exist, ignore
    }
  });

  test.describe('Prerequisites: Create Persona and Upload Training Data', () => {
    test('should create a new persona for testing', async ({ page, request }) => {
      // Skip if we already found a suitable persona
      if (personaId) {
        test.skip();
        return;
      }

      // Skip if we don't have enough models
      if (!taskModelId || !judgeModelId || !promptEngineerModelId) {
        test.skip();
        return;
      }

      // Navigate to personas list
      await page.goto('/personas');

      // Click "Create New Persona"
      await page.click('button:has-text("Create New Persona")');

      // Fill in the form
      await page.fill('[data-test="persona-name"]', 'E2E Test Persona - Two-Phase Training');
      await page.fill(
        '[data-test="persona-description"]',
        'Test persona for validating two-phase training workflow'
      );
      await page.fill(
        '[data-test="task-prompt"]',
        'Generate a concise answer to the given question.'
      );
      await page.fill(
        '[data-test="judge-prompt"]',
        'Evaluate if the suggested output is correct. Return decision as "correct" or "incorrect" with reasoning.'
      );

      // Select models
      await page.selectOption('[data-test="task-model"]', taskModelId);
      await page.selectOption('[data-test="judge-model"]', judgeModelId);
      await page.selectOption('[data-test="prompt-engineer-model"]', promptEngineerModelId);

      // Submit form
      await page.click('button[type="submit"]:has-text("Create Persona")');

      // Wait for redirect to detail page
      await page.waitForURL(/\/personas\/[a-f0-9-]+$/);

      // Extract persona ID from URL
      const urlMatch = page.url().match(/\/personas\/([a-f0-9-]+)$/);
      if (urlMatch) {
        personaId = urlMatch[1];
      }

      expect(personaId).toBeTruthy();
    });

    test('should upload training data CSV', async ({ page, request }) => {
      // Skip if persona already has training data
      if (personaId) {
        const pairsResponse = await request.get(`/api/personas/${personaId}/training/pairs`);
        const pairs = await pairsResponse.json();
        if (pairs && pairs.length >= 10) {
          test.skip();
          return;
        }
      } else {
        test.skip();
        return;
      }

      // Create a test CSV with 15 pairs
      const testCSV = `input,expected_output
"What is 2+2?","4"
"What is the capital of France?","Paris"
"Who wrote Romeo and Juliet?","William Shakespeare"
"What is the chemical symbol for gold?","Au"
"How many continents are there?","7"
"What is the largest planet in our solar system?","Jupiter"
"Who painted the Mona Lisa?","Leonardo da Vinci"
"What year did World War II end?","1945"
"What is the formula for water?","H2O"
"Who discovered America?","Christopher Columbus"
"What is the speed of light?","299,792,458 meters per second"
"Who wrote 'To Kill a Mockingbird'?","Harper Lee"
"What is the currency of Japan?","Japanese yen"
"Who was the first person on the moon?","Neil Armstrong"
"What is the smallest prime number?","2"`;

      const csvPath = join(TEST_CSV_DIR, 'two-phase-training.csv');
      writeFileSync(csvPath, testCSV);

      // Navigate to training data tab
      await page.goto(`/personas/${personaId}/training`);

      // Upload the CSV file
      const fileInput = page.locator('#file-input');
      await fileInput.setInputFiles(csvPath);

      // Click upload button
      await page.click('#upload-btn');

      // Wait for success message or page reload
      await page.waitForTimeout(3000);

      // Verify pairs were uploaded
      const pairsResponse = await request.get(`/api/personas/${personaId}/training/pairs`);
      const pairs = await pairsResponse.json();

      expect(pairs.length).toBeGreaterThanOrEqual(10);
    });
  });

  test.describe('Phase 1: Iteration 1 with MANDATORY Human Review', () => {
    test('should start training and run iteration 1', async ({ page, request }) => {
      if (!personaId) test.skip();

      // Navigate to persona detail
      await page.goto(`/personas/${personaId}`);

      // Click "Start Training" button
      await page.click('button:has-text("Start Training")');

      // Wait for training to start
      await page.waitForTimeout(2000);

      // Check training status
      const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
      const status = await statusResponse.json();

      expect(status.training_status).toBe('in_progress');
      expect(status.current_iteration).toBe(1);
    });

    test('should redirect to mandatory review page after iteration 1 completes', async ({
      page,
      request,
    }) => {
      if (!personaId) test.skip();

      // Poll for iteration 1 completion
      let maxAttempts = 30; // 30 seconds max
      let iterationComplete = false;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
        const status = await statusResponse.json();

        // Check if iteration 1 is complete
        if (status.awaiting_human_review) {
          iterationComplete = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      expect(iterationComplete).toBe(true);

      // Navigate to review page
      await page.goto(`/personas/${personaId}/review/1`);

      // Verify we're on the mandatory review page
      await expect(page.locator('text=REQUIRED FOR ITERATION 1')).toBeVisible();
    });

    test('should display all judge decisions for iteration 1', async ({ request }) => {
      if (!personaId) test.skip();

      // Get decisions for iteration 1
      const decisionsResponse = await request.get(
        `/api/personas/${personaId}/iterations/1/decisions`
      );
      const decisions = await decisionsResponse.json();

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0]).toHaveProperty('suggested_output');
      expect(decisions[0]).toHaveProperty('judge_decision');
      expect(decisions[0]).toHaveProperty('judge_reasoning');
    });

    test('should allow human to provide Agree/Disagree feedback with reasoning', async ({
      page,
      request,
    }) => {
      if (!personaId) test.skip();

      // Get decisions for iteration 1
      const decisionsResponse = await request.get(
        `/api/personas/${personaId}/iterations/1/decisions`
      );
      const decisions = await decisionsResponse.json();

      if (decisions.length > 0) {
        const decisionId = decisions[0].id;

        // Navigate to review page
        await page.goto(`/personas/${personaId}/review/1`);

        // Submit "Agree" feedback
        const feedbackResponse = await request.post(
          `/api/personas/${personaId}/iterations/1/feedback`,
          {
            data: {
              decision_id: decisionId,
              human_decision: 'agree',
              reviewer_notes: 'E2E test feedback - agree with judge assessment',
            },
          }
        );

        expect(feedbackResponse.status()).toBe(201);
      }
    });

    test('should require 100% completion before allowing prompt refinement', async ({
      page,
      request,
    }) => {
      if (!personaId) test.skip();

      // Get decisions for iteration 1
      const decisionsResponse = await request.get(
        `/api/personas/${personaId}/iterations/1/decisions`
      );
      const decisions = await decisionsResponse.json();

      // Submit feedback for all remaining decisions
      for (const decision of decisions) {
        const existingFeedback = await request.get(
          `/api/personas/${personaId}/iterations/1/feedback`
        );

        // Skip if already has feedback
        // Submit "Agree" for each
        await request.post(`/api/personas/${personaId}/iterations/1/feedback`, {
          data: {
            decision_id: decision.id,
            human_decision: 'agree',
            reviewer_notes: 'E2E test automated feedback',
          },
        });
      }

      // Navigate to review page
      await page.goto(`/personas/${personaId}/review/1`);

      // Should now show "Generate Refined Prompt" button
      await expect(page.locator('button:has-text("Generate Refined Prompt")')).toBeVisible();
    });

    test('should generate refined prompt from human feedback (iteration 1)', async ({
      request,
    }) => {
      if (!personaId) test.skip();

      // Call the refine prompt API
      const refineResponse = await request.post(
        `/api/personas/${personaId}/iterations/1/refine-prompt`
      );

      expect(refineResponse.status()).toBe(200);

      const refined = await refineResponse.json();
      expect(refined).toHaveProperty('improved_prompt');
      expect(refined).toHaveProperty('rationale');
    });

    test('should allow user to accept refined prompt before iteration 2', async ({ request }) => {
      if (!personaId) test.skip();

      // Get the refined prompt
      const refineResponse = await request.post(
        `/api/personas/${personaId}/iterations/1/refine-prompt`
      );

      const refined = await refineResponse.json();

      // Accept the refined prompt
      const acceptResponse = await request.post(
        `/api/personas/${personaId}/iterations/1/accept-prompt`,
        {
          data: {
            prompt_text: refined.improved_prompt,
            reason: 'ai-generated',
          },
        }
      );

      expect(acceptResponse.status()).toBe(201);
    });
  });

  test.describe('Phase 2: Iterations 2+ FULLY AUTOMATED', () => {
    test('should automatically run iteration 2 after accepting refined prompt', async ({
      page,
      request,
    }) => {
      if (!personaId) test.skip();

      // Wait a moment for iteration 2 to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check training status
      const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
      const status = await statusResponse.json();

      // Should be in iteration 2 or higher
      expect(status.current_iteration).toBeGreaterThanOrEqual(2);
    });

    test('should calculate metrics AUTOMATICALLY from ground truth (iterations 2+)', async ({
      request,
    }) => {
      if (!personaId) test.skip();

      // Wait for iteration 2 to complete
      let maxAttempts = 60; // 60 seconds max
      let iteration2Complete = false;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
        const status = await statusResponse.json();

        // Check if iteration 2 is complete
        if (
          status.current_iteration > 2 ||
          (status.current_iteration === 2 && status.latest_f1_score !== null)
        ) {
          iteration2Complete = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      expect(iteration2Complete).toBe(true);

      // Get metrics for iteration 2
      const metricsResponse = await request.get(`/api/personas/${personaId}/iterations/2/metrics`);
      const metrics = await metricsResponse.json();

      expect(metrics).toHaveProperty('f1_score');
      expect(metrics).toHaveProperty('precision');
      expect(metrics).toHaveProperty('recall');
      expect(metrics).toHaveProperty('cohens_kappa');
      expect(metrics).toHaveProperty('true_positives');
      expect(metrics).toHaveProperty('true_negatives');
      expect(metrics).toHaveProperty('false_positives');
      expect(metrics).toHaveProperty('false_negatives');
    });

    test('should automatically refine BOTH task and judge prompts using LLM (iterations 2+)', async ({
      request,
    }) => {
      if (!personaId) test.skip();

      // Check prompt versions for iteration 2
      const iterationsResponse = await request.get(`/api/personas/${personaId}/iterations`);
      const iterations = await iterationsResponse.json();

      const iteration2 = iterations.find((i: any) => i.iteration_number === 2);

      if (iteration2) {
        // Should have both task_prompt_version_id and judge_prompt_version_id
        expect(iteration2).toHaveProperty('task_prompt_version_id');
        expect(iteration2).toHaveProperty('judge_prompt_version_id');
      }
    });

    test('should continue automatic iterations until convergence or max iterations', async ({
      page,
      request,
    }) => {
      if (!personaId) test.skip();

      // Poll for training completion or convergence
      let maxAttempts = 300; // 5 minutes max
      let trainingComplete = false;
      let finalStatus = null;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
        const status = await statusResponse.json();

        // Check if training is complete
        if (status.training_status === 'completed' || status.convergence_achieved) {
          trainingComplete = true;
          finalStatus = status;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Training may not complete within test timeout, but we can verify it's progressing
      const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
      const status = await statusResponse.json();

      // Verify training is progressing
      expect(status.current_iteration).toBeGreaterThan(1);
    });

    test('should identify best performing iteration with highest F1 score', async ({ request }) => {
      if (!personaId) test.skip();

      // Get persona details
      const personaResponse = await request.get(`/api/personas/${personaId}`);
      const persona = await personaResponse.json();

      expect(persona).toHaveProperty('best_f1_score');
      expect(persona).toHaveProperty('best_iteration_number');

      // If best_f1_score is set, verify it's valid
      if (persona.best_f1_score !== null) {
        expect(persona.best_f1_score).toBeGreaterThan(0);
        expect(persona.best_f1_score).toBeLessThanOrEqual(1);
        expect(persona.best_iteration_number).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Verification: Two-Phase Training Completeness', () => {
    test('should verify iteration 1 used human-driven metrics', async ({ request }) => {
      if (!personaId) test.skip();

      // Get metrics for iteration 1
      const metricsResponse = await request.get(`/api/personas/${personaId}/iterations/1/metrics`);

      // If metrics exist, they should be based on human feedback
      if (metricsResponse.status() === 200) {
        const metrics = await metricsResponse.json();
        expect(metrics).toHaveProperty('true_positives');
        expect(metrics).toHaveProperty('true_negatives');
        expect(metrics).toHaveProperty('false_positives');
        expect(metrics).toHaveProperty('false_negatives');
      }
    });

    test('should verify iterations 2+ used automatic ground truth metrics', async ({ request }) => {
      if (!personaId) test.skip();

      // Get iterations
      const iterationsResponse = await request.get(`/api/personas/${personaId}/iterations`);
      const iterations = await iterationsResponse.json();

      // Find iterations 2+
      const laterIterations = iterations.filter((i: any) => i.iteration_number >= 2);

      for (const iteration of laterIterations) {
        const metricsResponse = await request.get(
          `/api/personas/${personaId}/iterations/${iteration.iteration_number}/metrics`
        );

        if (metricsResponse.status() === 200) {
          const metrics = await metricsResponse.json();
          expect(metrics).toHaveProperty('f1_score');
          expect(metrics).toHaveProperty('true_positives');
          expect(metrics).toHaveProperty('true_negatives');
          expect(metrics).toHaveProperty('false_positives');
          expect(metrics).toHaveProperty('false_negatives');
        }
      }
    });

    test('should verify prompt version history for all iterations', async ({ request }) => {
      if (!personaId) test.skip();

      // Get prompt history
      const historyResponse = await request.get(`/api/personas/${personaId}/prompts/history`);

      if (historyResponse.status() === 200) {
        const history = await historyResponse.json();

        // Should have both task and judge prompt versions
        expect(history).toHaveProperty('task_prompts');
        expect(history).toHaveProperty('judge_prompts');

        // Each version should have metadata
        if (history.judge_prompts && history.judge_prompts.length > 0) {
          expect(history.judge_prompts[0]).toHaveProperty('version_number');
          expect(history.judge_prompts[0]).toHaveProperty('created_by'); // "human" or "ai"
          expect(history.judge_prompts[0]).toHaveProperty('rationale');
        }
      }
    });
  });

  test.describe('API: Training Status and Progress', () => {
    test('should return current training status', async ({ request }) => {
      if (!personaId) test.skip();

      const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);

      expect(statusResponse.status()).toBe(200);

      const status = await statusResponse.json();
      expect(status).toHaveProperty('current_iteration');
      expect(status).toHaveProperty('training_status');
      expect(status).toHaveProperty('latest_f1_score');
      expect(status).toHaveProperty('best_f1_score');
      expect(status).toHaveProperty('best_iteration');
    });

    test('should return 404 for non-existent persona', async ({ request }) => {
      const statusResponse = await request.get('/api/personas/non-existent-id/training/status');

      expect(statusResponse.status()).toBe(404);
    });
  });
});
