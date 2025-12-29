/**
 * Integration tests for prompt refinement API endpoints
 * Tests the complete flow: refine → accept → verify version stored
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import type { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestModelConfig,
  createTestPersona,
  createTestIteration,
} from '../setup';

// Mock the API clients
vi.mock('@lib/utils/api-clients', () => ({
  callModel: vi.fn(),
}));

import { callModel } from '@lib/utils/api-clients';

describe.skip('Prompt Refinement API Integration', () => {
  let db: Database;
  let personaId: string;
  let iterationId: string;

  beforeAll(() => {
    initializeTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();

    // Clean up before each test
    cleanTestDatabase();

    // Create test model configurations using fixture
    const modelTaskId = createTestModelConfig(db, 'openai');
    const modelJudgeId = createTestModelConfig(db, 'anthropic');
    const modelEngineerId = createTestModelConfig(db, 'google');

    // Create test persona using fixture
    const persona = createTestPersona(db, {
      name: 'Test Persona',
      description: 'Customer support evaluation',
      task_prompt: 'Evaluate customer support quality',
      task_model_id: modelTaskId,
      judge_model_id: modelJudgeId,
      prompt_engineer_model_id: modelEngineerId,
    });
    personaId = persona.id;

    // Create test iteration using fixture
    const iteration = createTestIteration(db, personaId, 2, 'Evaluate if response is accurate');
    iterationId = iteration.id;

    // Update iteration to completed status with full evaluation counts
    db.prepare(
      `
      UPDATE training_iterations
      SET status = 'completed',
          total_pairs_evaluated = 10,
          pairs_reviewed_by_human = 10,
          completed_at = ?
      WHERE id = ?
    `
    ).run(new Date().toISOString(), iterationId);

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
    // Clean up after each test
    cleanTestDatabase();
    vi.clearAllMocks();
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
