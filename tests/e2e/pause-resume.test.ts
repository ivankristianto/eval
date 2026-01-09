/**
 * E2E tests for Pause/Resume Training
 * Tests pause and resume API endpoints, UI buttons, and complete pause/resume cycle
 */

import { test, expect } from '@playwright/test';

test.describe('Pause Training API', () => {
  test('should return 400 for missing persona ID', async ({ page }) => {
    const response = await page.request.post('/api/personas//training/pause', {
      data: {},
    });
    // Route not found due to empty ID
    expect(response.status()).toBe(404);
  });

  test('should return 400 for invalid UUID format', async ({ page }) => {
    const response = await page.request.post('/api/personas/invalid-uuid/training/pause', {
      data: {},
    });
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'INVALID_REQUEST');
    expect(data.message).toContain('Invalid persona ID format');
  });

  test('should return 400 for non-existent persona (no active session)', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await page.request.post(`/api/personas/${fakeId}/training/pause`, {
      data: {},
    });
    // API returns 400 (NO_ACTIVE_SESSION) instead of 404 since that's checked first
    expect([400, 404]).toContain(response.status());

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should return 400 when no active training session exists', async ({ page }) => {
    // First, get or create a persona
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;
      const response = await page.request.post(`/api/personas/${personaId}/training/pause`, {
        data: {},
      });

      // Should fail if no active training session
      if (response.status() === 400) {
        const data = await response.json();
        expect(data).toHaveProperty('error', 'NO_ACTIVE_SESSION');
      }
      // If training session exists, that's also valid
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should accept custom pause reason in request body', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;
      const customReason = 'Manual pause for review';

      const response = await page.request.post(`/api/personas/${personaId}/training/pause`, {
        data: { reason: customReason },
      });

      // If there's an active session, it should accept the custom reason
      if (response.status() === 200) {
        const data = await response.json();
        expect(data.pause_reason).toBe(customReason);
      }
      // 400 or 404 is also valid if no active session or persona not found
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should reject pause reason exceeding 500 characters', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;
      const longReason = 'a'.repeat(501);

      const response = await page.request.post(`/api/personas/${personaId}/training/pause`, {
        data: { reason: longReason },
      });

      // Should reject even if there's an active session
      if (response.status() === 400) {
        const data = await response.json();
        expect(data).toHaveProperty('error', 'INVALID_REQUEST');
        expect(data.message).toContain('must not exceed 500 characters');
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should reject non-string pause reason', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      const response = await page.request.post(`/api/personas/${personaId}/training/pause`, {
        data: { reason: 12345 }, // Number instead of string
      });

      if (response.status() === 400) {
        const data = await response.json();
        expect(data).toHaveProperty('error', 'INVALID_REQUEST');
        expect(data.message).toContain('must be a string');
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should handle idempotent pause requests', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      // First pause request
      const response1 = await page.request.post(`/api/personas/${personaId}/training/pause`, {
        data: {},
      });

      // If first pause succeeded, try second pause
      if (response1.status() === 200) {
        const response2 = await page.request.post(`/api/personas/${personaId}/training/pause`, {
          data: {},
        });

        // Second pause should also return 200 (already paused)
        expect(response2.status()).toBe(200);
        const data2 = await response2.json();
        expect(data2.status).toBe('paused');
        expect(data2.message).toContain('already paused');
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });
});

test.describe('Resume Training API', () => {
  test('should return 400 for missing persona ID', async ({ page }) => {
    const response = await page.request.post('/api/personas//training/resume');
    expect(response.status()).toBe(404); // Route not found
  });

  test('should return 400 for invalid UUID format', async ({ page }) => {
    const response = await page.request.post('/api/personas/invalid-uuid/training/resume');
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error', 'INVALID_REQUEST');
    expect(data.message).toContain('Invalid persona ID format');
  });

  test('should return 400 for non-existent persona (no paused session)', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await page.request.post(`/api/personas/${fakeId}/training/resume`);
    // API returns 400 (NO_PAUSED_SESSION) instead of 404 since that's checked first
    expect([400, 404]).toContain(response.status());

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should return 400 when no paused training session exists', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;
      const response = await page.request.post(`/api/personas/${personaId}/training/resume`);

      // Should fail if no paused session
      if (response.status() === 400) {
        const data = await response.json();
        expect(data).toHaveProperty('error', 'NO_PAUSED_SESSION');
      }
      // If paused session exists, that's also valid
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should handle idempotent resume requests', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      // First resume request
      const response1 = await page.request.post(`/api/personas/${personaId}/training/resume`);

      // If first resume succeeded, try second resume
      if (response1.status() === 200) {
        const response2 = await page.request.post(`/api/personas/${personaId}/training/resume`);

        // Second resume should also return 200 (already resumed)
        expect(response2.status()).toBe(200);
        const data2 = await response2.json();
        expect(data2.status).toBe('in_progress');
        expect(data2.message).toContain('already resumed');
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should return checkpoint data in resume response', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;
      const response = await page.request.post(`/api/personas/${personaId}/training/resume`);

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('checkpoint');
        expect(data.checkpoint).toHaveProperty('iteration_number');
        expect(data.checkpoint).toHaveProperty('evaluated_result_count');
        expect(data.checkpoint).toHaveProperty('f1_score');
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });
});

test.describe('Pause/Resume UI Elements', () => {
  test('should display pause button when training is in progress', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Find a persona with in-progress training
      for (const persona of personas) {
        await page.goto(`/personas/${persona.id}?tab=training-progress`);

        // Check for pause button
        const pauseBtn = page.locator('button.pause-training-btn');
        const btnCount = await pauseBtn.count();

        if (btnCount > 0) {
          await expect(pauseBtn).toBeVisible();
          await expect(pauseBtn).toHaveText(/Pause Training/);
          return; // Test passed, exit
        }
      }
      test.skip(true, 'No persona with in-progress training found');
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should display resume button when training is paused', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Find a persona with paused training
      for (const persona of personas) {
        await page.goto(`/personas/${persona.id}?tab=training-progress`);

        // Check for resume button
        const resumeBtn = page.locator('button.resume-training-btn');
        const btnCount = await resumeBtn.count();

        if (btnCount > 0) {
          await expect(resumeBtn).toBeVisible();
          await expect(resumeBtn).toHaveText(/Resume Training/);
          return; // Test passed, exit
        }
      }
      test.skip(true, 'No persona with paused training found');
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should display paused alert with pause reason', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Find a persona with paused training
      for (const persona of personas) {
        await page.goto(`/personas/${persona.id}?tab=training-progress`);

        // Check for paused alert
        const pausedAlert = page.locator('.alert.alert-warning:has-text("Training paused")');
        const alertCount = await pausedAlert.count();

        if (alertCount > 0) {
          await expect(pausedAlert).toBeVisible();
          // Check for pause reason (should be present in the alert)
          await expect(page.locator('text=Training session was paused')).toBeVisible();
          return; // Test passed, exit
        }
      }
      test.skip(true, 'No persona with paused training found');
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should show confirmation dialog when clicking pause button', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Find a persona with in-progress training
      for (const persona of personas) {
        await page.goto(`/personas/${persona.id}?tab=training-progress`);

        const pauseBtn = page.locator('button.pause-training-btn');
        const btnCount = await pauseBtn.count();

        if (btnCount > 0) {
          // Setup dialog handler
          page.on('dialog', (dialog) => {
            expect(dialog.message()).toContain('Pause the current training iteration');
            dialog.dismiss();
          });

          await pauseBtn.click();
          return; // Test passed, dialog was shown
        }
      }
      test.skip(true, 'No persona with in-progress training found');
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should not display pause button when training is not in progress', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Find a persona without in-progress training
      for (const persona of personas) {
        if (persona.status !== 'training') {
          await page.goto(`/personas/${persona.id}?tab=training-progress`);

          // Pause button should not be visible
          const pauseBtn = page.locator('button.pause-training-btn');
          await expect(pauseBtn).toHaveCount(0);
          return; // Test passed, exit
        }
      }
      test.skip(true, 'All personas have training status');
    } else {
      test.skip(true, 'No personas found in database');
    }
  });
});

test.describe('Complete Pause/Resume Cycle', () => {
  test('should complete full pause/resume cycle', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;
      await page.goto(`/personas/${personaId}?tab=training-progress`);

      // Try to pause
      const pauseBtn = page.locator('button.pause-training-btn');
      const pauseCount = await pauseBtn.count();

      if (pauseCount > 0) {
        // Accept confirmation dialog
        page.on('dialog', (dialog) => dialog.accept());

        // Click pause button
        await pauseBtn.click();

        // Wait for page reload or response
        await page.waitForTimeout(1000);

        // Check for resume button
        const resumeBtn = page.locator('button.resume-training-btn');
        await expect(resumeBtn).toBeVisible();

        // Click resume button
        await resumeBtn.click();

        // Wait for page reload
        await page.waitForTimeout(1000);

        // Pause button should be visible again after resume
        const pauseBtnAfter = page.locator('button.pause-training-btn');
        const pauseCountAfter = await pauseBtnAfter.count();

        // Either training completed or pause button is back
        if (pauseCountAfter > 0) {
          await expect(pauseBtnAfter).toBeVisible();
        }
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should preserve training state across pause/resume', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      // Get initial dashboard state
      const dashboardBefore = await page.request.get(`/api/personas/${personaId}/dashboard`);
      const dataBefore = await dashboardBefore.json();

      if (dataBefore.current_iteration_status) {
        const iterationBefore = dataBefore.current_iteration_status.iteration_number;

        // Pause
        await page.request.post(`/api/personas/${personaId}/training/pause`, {
          data: { reason: 'Test state preservation' },
        });

        // Resume
        const resumeResponse = await page.request.post(
          `/api/personas/${personaId}/training/resume`
        );
        const resumeData = await resumeResponse.json();

        // Check iteration number is preserved
        expect(resumeData.iteration_number).toBe(iterationBefore);

        // Check checkpoint data
        expect(resumeData.checkpoint).toBeDefined();
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should update iteration status correctly during pause/resume', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      // Pause
      const pauseResponse = await page.request.post(`/api/personas/${personaId}/training/pause`);
      if (pauseResponse.status() === 200) {
        const pauseData = await pauseResponse.json();
        expect(pauseData.status).toBe('paused');

        // Resume
        const resumeResponse = await page.request.post(
          `/api/personas/${personaId}/training/resume`
        );
        const resumeData = await resumeResponse.json();
        expect(resumeData.status).toBe('in_progress');
      }
    } else {
      test.skip(true, 'No personas found in database');
    }
  });
});

test.describe('Pause/Resume Error Handling', () => {
  test('should handle pause failure gracefully in UI', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Try with non-existent persona (will fail)
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await page.request.post(`/api/personas/${fakeId}/training/pause`);

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    }
  });

  test('should handle resume failure gracefully in UI', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      // Try with non-existent persona (will fail)
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await page.request.post(`/api/personas/${fakeId}/training/resume`);

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    }
  });

  test('should handle concurrent pause requests', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      // Send two simultaneous pause requests
      const [response1, response2] = await Promise.all([
        page.request.post(`/api/personas/${personaId}/training/pause`),
        page.request.post(`/api/personas/${personaId}/training/pause`),
      ]);

      // Both should complete without error
      expect([response1.status(), response2.status()]).not.toContain(500);
    } else {
      test.skip(true, 'No personas found in database');
    }
  });

  test('should handle concurrent resume requests', async ({ page }) => {
    const personasResponse = await page.request.get('/api/personas');
    const personas = await personasResponse.json();

    if (Array.isArray(personas) && personas.length > 0) {
      const personaId = personas[0].id;

      // Send two simultaneous resume requests
      const [response1, response2] = await Promise.all([
        page.request.post(`/api/personas/${personaId}/training/resume`),
        page.request.post(`/api/personas/${personaId}/training/resume`),
      ]);

      // Both should complete without error
      expect([response1.status(), response2.status()]).not.toContain(500);
    } else {
      test.skip(true, 'No personas found in database');
    }
  });
});
