/**
 * Performance Tests
 * Validates performance success criteria from spec.md:
 * SC-006: Dashboard renders in <2 seconds
 * SC-007: No timeout on 200-pair batch
 * SC-008: Human can review 50 decisions in <10 minutes (measured as API response time)
 */

import { test, expect } from '@playwright/test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import { rm } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_CSV_DIR = join(__dirname, '..', 'data');

test.describe('Performance Tests', () => {
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
      console.log('Could not fetch models:', error);
    }
  });

  test.afterAll(async () => {
    // Clean up test data
    const csvPath = join(TEST_CSV_DIR, 'performance-test.csv');
    try {
      await rm(csvPath, { force: true });
    } catch {
      // File doesn't exist, ignore
    }
  });

  test.describe('SC-006: Dashboard renders in <2 seconds', () => {
    test('should load metrics dashboard in under 2 seconds', async ({ page, request }) => {
      // Use an existing persona or skip if none available
      try {
        const personasResponse = await request.get('/api/personas');
        const personas = await personasResponse.json();

        if (personas.length > 0) {
          personaId = personas[0].id;
        }
      } catch (error) {
        test.skip();
        return;
      }

      if (!personaId) {
        test.skip();
        return;
      }

      // Navigate to training progress tab
      const startTime = Date.now();
      await page.goto(`/personas/${personaId}/training`);
      const loadTime = Date.now() - startTime;

      // Wait for page to fully load
      await page.waitForLoadState('networkidle');

      // Verify dashboard loaded
      await expect(page.locator('body')).toBeVisible();

      // SC-006: Dashboard should render in <2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should fetch metrics API in under 1 second', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      // Measure API response time
      const startTime = Date.now();
      const metricsResponse = await request.get(`/api/personas/${personaId}/metrics`);
      const responseTime = Date.now() - startTime;

      expect(metricsResponse.status()).toBe(200);

      // API should respond in <1 second for good UX
      expect(responseTime).toBeLessThan(1000);
    });

    test('should fetch dashboard API in under 1 second', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      // Measure API response time
      const startTime = Date.now();
      const dashboardResponse = await request.get(`/api/personas/${personaId}/dashboard`);
      const responseTime = Date.now() - startTime;

      expect(dashboardResponse.status()).toBe(200);

      // API should respond in <1 second for good UX
      expect(responseTime).toBeLessThan(1000);
    });
  });

  test.describe('SC-007: No timeout on 200-pair batch', () => {
    let largePersonaId = '';

    test('should create persona with 200 training pairs', async ({ request }) => {
      if (!taskModelId || !judgeModelId || !promptEngineerModelId) {
        test.skip();
        return;
      }

      // Create persona
      const createResponse = await request.post('/api/personas', {
        data: {
          name: 'Performance Test Persona - 200 Pairs',
          description: 'Testing performance with maximum pair count',
          task_prompt: 'Generate a concise answer.',
          judge_prompt: 'Evaluate correctness.',
          task_model_id: taskModelId,
          judge_model_id: judgeModelId,
          prompt_engineer_model_id: promptEngineerModelId,
        },
      });

      const persona = await createResponse.json();
      largePersonaId = persona.id;
      expect(largePersonaId).toBeTruthy();

      // Create 200 training pairs (maximum allowed)
      const rows: { input: string; expected_output: string }[] = [];
      for (let i = 1; i <= 200; i++) {
        rows.push({
          input: `Test question ${i}: What is ${i} + ${i}?`,
          expected_output: `${i + i}`,
        });
      }

      // Create CSV content
      const csvContent =
        `input,expected_output\n` +
        rows.map((r) => `"${r.input}","${r.expected_output}"`).join('\n');

      const csvPath = join(TEST_CSV_DIR, 'performance-test.csv');
      writeFileSync(csvPath, csvContent);

      // Upload CSV
      const formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'performance-test.csv');

      const uploadResponse = await request.post(`/api/personas/${largePersonaId}/training/upload`, {
        data: formData,
      });

      expect(uploadResponse.status()).toBe(201);

      const uploadResult = await uploadResponse.json();
      expect(uploadResult.count).toBe(200);
    });

    test('should process 200 pairs without timeout', async ({ request }) => {
      if (!largePersonaId) {
        test.skip();
        return;
      }

      // Start training with 200 pairs
      const startTime = Date.now();
      const startResponse = await request.post(`/api/personas/${largePersonaId}/training/start`);

      // Should return immediately (async operation)
      expect(startResponse.status()).toBe(202);

      const timeToStart = Date.now() - startTime;

      // Starting training should be fast (<5 seconds)
      expect(timeToStart).toBeLessThan(5000);

      // Wait for iteration to complete (may take several minutes)
      let maxAttempts = 600; // 10 minutes max
      let iterationComplete = false;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await request.get(`/api/personas/${largePersonaId}/training/status`);
        const status = await statusResponse.json();

        if (status.awaiting_human_review || status.current_iteration > 1) {
          iterationComplete = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // SC-007: Should complete without timeout
      expect(iterationComplete).toBe(true);
    });

    test('should retrieve 200 decisions without timeout', async ({ request }) => {
      if (!largePersonaId) {
        test.skip();
        return;
      }

      // Wait for decisions to be available
      let maxAttempts = 120;
      let decisionsReady = false;

      for (let i = 0; i < maxAttempts; i++) {
        const statusResponse = await request.get(`/api/personas/${largePersonaId}/training/status`);
        const status = await statusResponse.json();

        if (status.awaiting_human_review) {
          decisionsReady = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!decisionsReady) {
        test.skip();
        return;
      }

      // Measure time to fetch all 200 decisions
      const startTime = Date.now();
      const decisionsResponse = await request.get(
        `/api/personas/${largePersonaId}/iterations/1/decisions`
      );
      const fetchTime = Date.now() - startTime;

      expect(decisionsResponse.status()).toBe(200);

      const decisions = await decisionsResponse.json();
      expect(decisions.length).toBe(200);

      // Fetching 200 decisions should be fast (<2 seconds)
      expect(fetchTime).toBeLessThan(2000);
    });
  });

  test.describe('SC-008: API response times for human review workflow', () => {
    test('should fetch decisions page quickly (50 decisions)', async ({ request }) => {
      // Use existing persona with decisions
      try {
        const personasResponse = await request.get('/api/personas');
        const personas = await personasResponse.json();

        // Find a persona with completed iterations
        for (const persona of personas) {
          const iterationsResponse = await request.get(`/api/personas/${persona.id}/iterations`);
          const iterations = await iterationsResponse.json();

          if (iterations.length > 0) {
            const iteration = iterations[0];
            if (iteration.status === 'completed' || iteration.status === 'awaiting_human_review') {
              personaId = persona.id;
              break;
            }
          }
        }
      } catch (error) {
        test.skip();
        return;
      }

      if (!personaId) {
        test.skip();
        return;
      }

      // Measure time to fetch first 50 decisions
      const startTime = Date.now();
      const decisionsResponse = await request.get(
        `/api/personas/${personaId}/iterations/1/decisions?limit=50`
      );
      const fetchTime = Date.now() - startTime;

      expect(decisionsResponse.status()).toBe(200);

      // Fetching 50 decisions should be very fast (<500ms)
      expect(fetchTime).toBeLessThan(500);
    });

    test('should submit feedback quickly', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      // Get a decision to provide feedback on
      const decisionsResponse = await request.get(
        `/api/personas/${personaId}/iterations/1/decisions?limit=1`
      );

      if (decisionsResponse.status() !== 200) {
        test.skip();
        return;
      }

      const decisions = await decisionsResponse.json();

      if (decisions.length === 0) {
        test.skip();
        return;
      }

      const decision = decisions[0];

      // Measure time to submit feedback
      const startTime = Date.now();
      const feedbackResponse = await request.post(
        `/api/personas/${personaId}/iterations/1/feedback`,
        {
          data: {
            decision_id: decision.id,
            human_decision: 'agree',
            reviewer_notes: 'Performance test feedback',
          },
        }
      );
      const submitTime = Date.now() - startTime;

      expect(feedbackResponse.status()).toBe(201);

      // Submitting feedback should be very fast (<200ms)
      expect(submitTime).toBeLessThan(200);
    });

    test('should calculate metrics quickly from human feedback', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      // Measure time to calculate metrics
      const startTime = Date.now();
      const metricsResponse = await request.get(`/api/personas/${personaId}/iterations/1/metrics`);
      const calcTime = Date.now() - startTime;

      // Metrics may or may not exist yet
      if (metricsResponse.status() === 200) {
        // Calculating metrics should be fast (<1 second)
        expect(calcTime).toBeLessThan(1000);
      }
    });
  });

  test.describe('Additional Performance Benchmarks', () => {
    test('should load persona list page quickly', async ({ page, request }) => {
      const startTime = Date.now();
      await page.goto('/personas');
      const loadTime = Date.now() - startTime;

      await page.waitForLoadState('networkidle');

      // Page should load in <2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should load persona detail page quickly', async ({ page, request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      const startTime = Date.now();
      await page.goto(`/personas/${personaId}`);
      const loadTime = Date.now() - startTime;

      await page.waitForLoadState('networkidle');

      // Page should load in <2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should return training status quickly', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      const startTime = Date.now();
      const statusResponse = await request.get(`/api/personas/${personaId}/training/status`);
      const responseTime = Date.now() - startTime;

      expect(statusResponse.status()).toBe(200);

      // Status API should be very fast (<200ms)
      expect(responseTime).toBeLessThan(200);
    });

    test('should return prompt history quickly', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      const startTime = Date.now();
      const historyResponse = await request.get(`/api/personas/${personaId}/prompts/history`);
      const responseTime = Date.now() - startTime;

      expect(historyResponse.status()).toBe(200);

      // History API should be fast (<500ms)
      expect(responseTime).toBeLessThan(500);
    });
  });

  test.describe('Performance Regression Prevention', () => {
    test('should handle concurrent API requests efficiently', async ({ request }) => {
      if (!personaId) {
        test.skip();
        return;
      }

      // Send multiple concurrent requests
      const startTime = Date.now();

      const promises = [
        request.get(`/api/personas/${personaId}`),
        request.get(`/api/personas/${personaId}/training/status`),
        request.get(`/api/personas/${personaId}/metrics`),
        request.get(`/api/personas/${personaId}/prompts/history`),
      ];

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      for (const response of responses) {
        expect(response.status()).toBe(200);
      }

      // Concurrent requests should complete in <2 seconds total
      expect(totalTime).toBeLessThan(2000);
    });
  });
});
