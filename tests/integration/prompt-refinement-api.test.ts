/**
 * Integration tests for prompt refinement API endpoints
 * Tests the complete flow: refine → accept → verify version stored
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDatabase } from '@lib/db';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Mock the API clients
vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(),
}));

import { callModel } from '@lib/utils/api-clients';

describe('Prompt Refinement API Integration', () => {
  let db: Database;
  let personaId: string;
  let iterationId: string;

  beforeEach(() => {
    db = getDatabase();

    // Create test model configurations
    db.prepare(
      `
      INSERT OR REPLACE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run('model-task-1', 'openai', 'gpt-4', 'fake-key', 1);

    db.prepare(
      `
      INSERT OR REPLACE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run('model-judge-1', 'anthropic', 'claude-3', 'fake-key', 1);

    db.prepare(
      `
      INSERT OR REPLACE INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
    ).run('model-engineer-1', 'google', 'gemini-pro', 'fake-key', 1);

    // Create test persona
    personaId = uuidv4();
    db.prepare(
      `
      INSERT INTO personas
      (id, name, description, task_prompt, task_model_id, judge_model_id,
       prompt_engineer_model_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      personaId,
      'Test Persona',
      'Customer support evaluation',
      'Evaluate customer support quality',
      'model-task-1',
      'model-judge-1',
      'model-engineer-1',
      'training',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create test iteration
    iterationId = uuidv4();
    db.prepare(
      `
      INSERT INTO training_iterations
      (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
       status, total_pairs_evaluated, pairs_reviewed_by_human, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      iterationId,
      personaId,
      2,
      'model-judge-1',
      'Evaluate if response is accurate',
      'completed',
      10,
      10,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create metrics for iteration
    const metricsId = uuidv4();
    db.prepare(
      `
      INSERT INTO iteration_metrics
      (id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
       precision, recall, f1_score, cohens_kappa, accuracy, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(metricsId, iterationId, 6, 3, 2, 1, 0.75, 0.86, 0.8, 0.7, 0.75, new Date().toISOString());

    // Create some judge decisions with human reviews (for failure analysis)
    const pairId = uuidv4();
    db.prepare(
      `
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(pairId, personaId, 'Test question', 'Test answer', new Date().toISOString());

    const decisionId = uuidv4();
    db.prepare(
      `
      INSERT INTO judge_decisions
      (id, iteration_id, training_pair_id, generated_output, judge_decision,
       judge_confidence, judge_reasoning, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      decisionId,
      iterationId,
      pairId,
      'Test output',
      'agree',
      0.9,
      'Looks good',
      new Date().toISOString()
    );

    const reviewId = uuidv4();
    db.prepare(
      `
      INSERT INTO human_reviews
      (id, judge_decision_id, human_decision, human_confidence, human_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(reviewId, decisionId, 'disagree', 0.8, 'Too lenient', new Date().toISOString());
  });

  afterEach(() => {
    vi.clearAllMocks();

    // Clean up in reverse dependency order
    db.prepare(
      'DELETE FROM human_reviews WHERE judge_decision_id IN (SELECT id FROM judge_decisions WHERE iteration_id = ?)'
    ).run(iterationId);
    db.prepare('DELETE FROM judge_decisions WHERE iteration_id = ?').run(iterationId);
    db.prepare('DELETE FROM iteration_metrics WHERE iteration_id = ?').run(iterationId);
    db.prepare('DELETE FROM training_iterations WHERE id = ?').run(iterationId);
    db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(personaId);
    db.prepare('DELETE FROM judge_prompt_versions WHERE persona_id = ?').run(personaId);
    db.prepare('DELETE FROM personas WHERE id = ?').run(personaId);
    db.prepare('DELETE FROM ModelConfiguration WHERE id IN (?, ?, ?)').run(
      'model-task-1',
      'model-judge-1',
      'model-engineer-1'
    );
  });

  it('should successfully refine prompt via API', async () => {
    const mockLLMResponse = {
      improved_prompt: 'Evaluate if response is semantically equivalent and complete',
      rationale: 'Added completeness requirement to reduce false positives',
      expected_impact: 'Should reduce FP by 30%',
    };

    vi.mocked(callModel).mockResolvedValue(JSON.stringify(mockLLMResponse));

    // Import the API handler (we'll create this)
    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/refine-prompt.ts');

    const request = new Request('http://localhost/api/personas/test/iterations/2/refine-prompt', {
      method: 'POST',
    });

    const response = await POST({
      params: { id: personaId, num: '2' },
      request,
    } as any);

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.improved_prompt).toBe(mockLLMResponse.improved_prompt);
    expect(data.rationale).toBe(mockLLMResponse.rationale);
    expect(data.expected_impact).toBe(mockLLMResponse.expected_impact);
  });

  it('should handle LLM failure gracefully', async () => {
    vi.mocked(callModel).mockRejectedValue(new Error('API rate limit'));

    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/refine-prompt.ts');

    const request = new Request('http://localhost/api/personas/test/iterations/2/refine-prompt', {
      method: 'POST',
    });

    const response = await POST({
      params: { id: personaId, num: '2' },
      request,
    } as any);

    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.message).toContain('API rate limit');
  });

  it('should accept and store refined prompt', async () => {
    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/accept-prompt.ts');

    const requestBody = {
      prompt_text: 'New improved prompt',
      reason: 'ai-generated',
    };

    const request = new Request('http://localhost/api/personas/test/iterations/2/accept-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST({
      params: { id: personaId, num: '2' },
      request,
    } as any);

    expect(response.status).toBe(201);

    // Verify version was stored
    const versions = db
      .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
      .all(personaId) as any[];

    expect(versions).toHaveLength(1);
    expect(versions[0].prompt_text).toBe('New improved prompt');
    expect(versions[0].created_by).toBe('ai');
    expect(versions[0].iteration_number).toBe(2);
  });

  it('should validate iteration exists before refining', async () => {
    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/refine-prompt.ts');

    const request = new Request('http://localhost/api/personas/test/iterations/999/refine-prompt', {
      method: 'POST',
    });

    const response = await POST({
      params: { id: personaId, num: '999' },
      request,
    } as any);

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('NOT_FOUND');
  });

  it('should validate persona exists before accepting prompt', async () => {
    const fakePersonaId = uuidv4();

    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/accept-prompt.ts');

    const requestBody = {
      prompt_text: 'Test prompt',
      reason: 'human',
    };

    const request = new Request('http://localhost/api/personas/test/iterations/2/accept-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST({
      params: { id: fakePersonaId, num: '2' },
      request,
    } as any);

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBe('NOT_FOUND');
  });

  it('should require prompt_text when accepting', async () => {
    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/accept-prompt.ts');

    const requestBody = {
      reason: 'ai-generated',
      // Missing prompt_text
    };

    const request = new Request('http://localhost/api/personas/test/iterations/2/accept-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST({
      params: { id: personaId, num: '2' },
      request,
    } as any);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('INVALID_REQUEST');
  });

  it('should validate reason is either ai-generated or manual-edit', async () => {
    const { POST } =
      await import('../../src/pages/api/personas/[id]/iterations/[num]/accept-prompt.ts');

    const requestBody = {
      prompt_text: 'Test prompt',
      reason: 'invalid-reason',
    };

    const request = new Request('http://localhost/api/personas/test/iterations/2/accept-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST({
      params: { id: personaId, num: '2' },
      request,
    } as any);

    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('INVALID_REQUEST');
    expect(data.message).toContain('ai-generated');
  });
});
