/**
 * Integration tests for new AI providers (Open Router, LM Studio, Ollama)
 * Tests the complete flow: add model → test connection → run evaluation
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { POST as createModel, GET as listModels } from '../../src/pages/api/models';
import { GET as getModel, PATCH as patchModel } from '../../src/pages/api/models/[id]';
import { POST as testConnection } from '../../src/pages/api/models/[id]/test-connection';
import { POST as createEvaluation } from '../../src/pages/api/evaluate';
import { GET as getEvaluationStatus } from '../../src/pages/api/evaluation-status';
import { ClientFactory } from '@lib/utils/api-clients';
import * as db from '@lib/db';
import { createMockDb } from '../helpers/mock-db';
import { createJsonRequest, readJson } from '../helpers/requests';
import type { Provider } from '@lib/utils/types';

const mockDb = createMockDb();

beforeEach(() => {
  mockDb.reset();
  vi.spyOn(db, 'insertModel').mockImplementation(mockDb.insertModel);
  vi.spyOn(db, 'getModels').mockImplementation(mockDb.getModels);
  vi.spyOn(db, 'getModelById').mockImplementation(mockDb.getModelById);
  vi.spyOn(db, 'updateModel').mockImplementation(mockDb.updateModel);
  vi.spyOn(db, 'deleteModel').mockImplementation(mockDb.deleteModel);
  vi.spyOn(db, 'getModelUsageCount').mockImplementation(mockDb.getModelUsageCount);
  vi.spyOn(db, 'hasActiveEvaluations').mockImplementation(mockDb.hasActiveEvaluations);
  vi.spyOn(db, 'decryptApiKey').mockImplementation(mockDb.decryptApiKey);
  vi.spyOn(ClientFactory, 'testConnection').mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Integration Tests: New AI Providers', () => {
  describe('Open Router Provider', () => {
    it('creates Open Router model with valid API key', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'openrouter',
        model_name: 'anthropic/claude-3-opus',
        api_key: 'sk-or-test-123456789',
        notes: 'Open Router model',
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        provider: 'openrouter',
        model_name: 'anthropic/claude-3-opus',
        is_active: true,
        validation_status: 'valid',
      });
      expect(typeof body.id).toBe('string');
    });

    it('rejects Open Router model with invalid API key format', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'openrouter',
        model_name: 'anthropic/claude-3-opus',
        api_key: 'sk-invalid-key', // Should start with sk-or-
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('creates Open Router model without base_url (uses default)', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'openrouter',
        model_name: 'openai/gpt-4',
        api_key: 'sk-or-test-123',
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      // Open Router uses default base URL from the provider implementation
      expect(body.provider).toBe('openrouter');
    });
  });

  describe('LM Studio Provider', () => {
    it('creates LM Studio model without API key (local provider)', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'lmstudio',
        model_name: 'llama-3-8b',
        api_key: '', // Empty API key allowed for local providers
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        provider: 'lmstudio',
        model_name: 'llama-3-8b',
        is_active: true,
        validation_status: 'valid',
      });
    });

    it('creates LM Studio model with default base URL', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'lmstudio',
        model_name: 'mistral-7b',
        api_key: '',
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      // Should use default base URL: http://localhost:1234/v1
      expect(body.provider).toBe('lmstudio');
    });

    it('creates LM Studio model with custom base URL', async () => {
      const customBaseUrl = 'http://localhost:9999/v1';
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'lmstudio',
        model_name: 'llama-3-70b',
        api_key: '',
        base_url: customBaseUrl,
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      expect(body.base_url).toBe(customBaseUrl);
    });

    it('tests connection for LM Studio model with custom base URL', async () => {
      const model = mockDb.insertModel('lmstudio', 'llama-3-8b', '', 'http://localhost:1234/v1');

      const request = createJsonRequest(
        `http://localhost/api/models/${model.id}/test-connection`,
        {}
      );
      const response = await testConnection({ params: { id: model.id }, request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.status).toBe('valid');
      expect(body.base_url).toBe('http://localhost:1234/v1');
    });
  });

  describe('Ollama Provider', () => {
    it('creates Ollama model without API key (local provider)', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'ollama',
        model_name: 'llama3',
        api_key: '', // Empty API key allowed for local providers
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        provider: 'ollama',
        model_name: 'llama3',
        is_active: true,
        validation_status: 'valid',
      });
    });

    it('creates Ollama model with default base URL', async () => {
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'ollama',
        model_name: 'mistral',
        api_key: '',
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      // Should use default base URL: http://localhost:11434
      expect(body.provider).toBe('ollama');
    });

    it('creates Ollama model with custom base URL', async () => {
      const customBaseUrl = 'http://192.168.1.100:11434';
      const request = createJsonRequest('http://localhost/api/models', {
        provider: 'ollama',
        model_name: 'llama3',
        api_key: '',
        base_url: customBaseUrl,
      });

      const response = await createModel({ request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(201);
      expect(body.base_url).toBe(customBaseUrl);
    });

    it('tests connection for Ollama model with custom base URL', async () => {
      const model = mockDb.insertModel('ollama', 'llama3', '', 'http://localhost:11434');

      const request = createJsonRequest(
        `http://localhost/api/models/${model.id}/test-connection`,
        {}
      );
      const response = await testConnection({ params: { id: model.id }, request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.status).toBe('valid');
      expect(body.base_url).toBe('http://localhost:11434');
    });
  });

  describe('Model Updates with base_url Changes', () => {
    it('updates LM Studio model base URL', async () => {
      const model = mockDb.insertModel('lmstudio', 'llama-3-8b', '', 'http://localhost:1234/v1');

      const newBaseUrl = 'http://localhost:9999/v1';
      const request = createJsonRequest(`http://localhost/api/models/${model.id}`, {
        base_url: newBaseUrl,
      });

      const response = await patchModel({ params: { id: model.id }, request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.base_url).toBe(newBaseUrl);

      // Verify the update persisted
      const getModelResponse = await getModel({ params: { id: model.id } } as never);
      const getBody = await readJson(getModelResponse);
      expect(getBody.base_url).toBe(newBaseUrl);
    });

    it('updates Ollama model base URL', async () => {
      const model = mockDb.insertModel('ollama', 'llama3', '', 'http://localhost:11434');

      const newBaseUrl = 'http://192.168.1.100:11434';
      const request = createJsonRequest(`http://localhost/api/models/${model.id}`, {
        base_url: newBaseUrl,
      });

      const response = await patchModel({ params: { id: model.id }, request } as never);
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.base_url).toBe(newBaseUrl);
    });

    it('tests connection with updated base URL', async () => {
      const model = mockDb.insertModel('lmstudio', 'llama-3-8b', '', 'http://localhost:1234/v1');

      // Update base URL
      const newBaseUrl = 'http://localhost:9999/v1';
      mockDb.updateModel(model.id, { base_url: newBaseUrl });

      // Test connection with updated URL
      const testRequest = createJsonRequest(
        `http://localhost/api/models/${model.id}/test-connection`,
        {
          base_url: newBaseUrl,
        }
      );
      const response = await testConnection({
        params: { id: model.id },
        request: testRequest,
      } as never);
      const body = await readJson(response);

      expect(response.status).toBe(200);
      expect(body.base_url).toBe(newBaseUrl);
    });
  });
});

describe('Cross-Provider Evaluations', () => {
  const providers: Provider[] = ['openai', 'anthropic', 'openrouter', 'lmstudio', 'ollama'];

  beforeEach(() => {
    // Mock evaluation and result operations
    vi.spyOn(db, 'insertEvaluation').mockImplementation(
      (instructionText, accuracyRubric, expectedOutput) => {
        return mockDb.insertEvaluation(instructionText, accuracyRubric, expectedOutput);
      }
    );
    vi.spyOn(db, 'insertResult').mockImplementation((evaluationId, modelId) => {
      return mockDb.insertResult(evaluationId, modelId);
    });
    vi.spyOn(db, 'getEvaluationStatus').mockImplementation((evaluationId) => {
      return mockDb.getEvaluationStatus(evaluationId);
    });
  });

  it('creates models from all providers', () => {
    const models = providers.map((provider) =>
      mockDb.insertModel(
        provider,
        `${provider}-model`,
        provider === 'lmstudio' || provider === 'ollama' ? '' : `sk-${provider}-key`
      )
    );

    expect(models).toHaveLength(providers.length);
    models.forEach((model, index) => {
      expect(model.provider).toBe(providers[index]);
    });
  });

  it('lists models filtered by provider', async () => {
    // Create models from different providers
    mockDb.insertModel('openai', 'gpt-4', 'sk-openai-key');
    mockDb.insertModel('openrouter', 'anthropic/claude-3', 'sk-or-key');
    mockDb.insertModel('lmstudio', 'llama-3', '');
    mockDb.insertModel('ollama', 'llama3', '');

    // List all models
    const allUrl = new URL('http://localhost/api/models');
    const allResponse = await listModels({ url: allUrl } as never);
    const allBody = await readJson(allResponse);

    expect(allResponse.status).toBe(200);
    expect(allBody.models).toHaveLength(4);

    // Filter by local providers
    const localUrl = new URL('http://localhost/api/models?provider=lmstudio');
    const localResponse = await listModels({ url: localUrl } as never);
    const localBody = await readJson(localResponse);

    expect(localResponse.status).toBe(200);
    expect(localBody.models).toHaveLength(1);
    expect(localBody.models[0].provider).toBe('lmstudio');
  });

  it('creates evaluation with models from different providers', async () => {
    // Create models from different providers
    const openaiModel = mockDb.insertModel('openai', 'gpt-4', 'sk-openai-key');
    const openrouterModel = mockDb.insertModel('openrouter', 'anthropic/claude-3', 'sk-or-key');
    const lmstudioModel = mockDb.insertModel('lmstudio', 'llama-3', '', 'http://localhost:1234/v1');

    const modelIds = [openaiModel.id, openrouterModel.id, lmstudioModel.id];

    const request = createJsonRequest('http://localhost/api/evaluate', {
      instruction: 'Test instruction',
      expected_output: 'Expected output',
      rubric_type: 'exact_match',
      model_ids: modelIds,
    });

    const response = await createEvaluation({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.evaluation_id).toBeDefined();

    // Verify results were created for all models
    const evaluationStatus = mockDb.getEvaluationStatus(body.evaluation_id);
    expect(evaluationStatus?.results).toHaveLength(3);

    // Verify each result has the correct provider
    const providers = evaluationStatus!.results.map((r) => r.provider);
    expect(providers).toContain('openai');
    expect(providers).toContain('openrouter');
    expect(providers).toContain('lmstudio');
  });
});

describe('Full Flow Tests', () => {
  it('completes full flow: add model → test connection → use in evaluation', async () => {
    // Step 1: Add model
    const createRequest = createJsonRequest('http://localhost/api/models', {
      provider: 'ollama',
      model_name: 'llama3',
      api_key: '',
    });

    const createResponse = await createModel({ request: createRequest } as never);
    const createBody = await readJson(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createBody.provider).toBe('ollama');
    const modelId = createBody.id;

    // Step 2: Test connection
    const testRequest = createJsonRequest(
      `http://localhost/api/models/${modelId}/test-connection`,
      {}
    );
    const testResponse = await testConnection({
      params: { id: modelId },
      request: testRequest,
    } as never);
    const testBody = await readJson(testResponse);

    expect(testResponse.status).toBe(200);
    expect(testBody.status).toBe('valid');

    // Step 3: Use in evaluation
    vi.spyOn(db, 'insertEvaluation').mockImplementation(
      (instructionText, accuracyRubric, expectedOutput) => {
        return mockDb.insertEvaluation(instructionText, accuracyRubric, expectedOutput);
      }
    );
    vi.spyOn(db, 'insertResult').mockImplementation((evaluationId, modelId) => {
      return mockDb.insertResult(evaluationId, modelId);
    });
    vi.spyOn(db, 'getEvaluationStatus').mockImplementation((evaluationId) => {
      return mockDb.getEvaluationStatus(evaluationId);
    });

    const evalRequest = createJsonRequest('http://localhost/api/evaluate', {
      instruction: 'What is 2 + 2?',
      expected_output: '4',
      rubric_type: 'exact_match',
      model_ids: [modelId],
    });

    const evalResponse = await createEvaluation({ request: evalRequest } as never);
    const evalBody = await readJson(evalResponse);

    expect(evalResponse.status).toBe(201);
    expect(evalBody.evaluation_id).toBeDefined();

    // Step 4: Check evaluation status
    const statusResponse = await getEvaluationStatus({
      url: new URL(
        `http://localhost/api/evaluation-status?evaluation_id=${evalBody.evaluation_id}`
      ),
    } as never);
    const statusBody = await readJson(statusResponse);

    expect(statusResponse.status).toBe(200);
    expect(statusBody.results).toHaveLength(1);
    expect(statusBody.results[0].provider).toBe('ollama');
  });
});
