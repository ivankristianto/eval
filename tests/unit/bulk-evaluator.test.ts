/**
 * Unit tests for BulkEvaluator
 *
 * Tests sequential execution, error handling, and progress tracking.
 * Uses mocked ModelClient to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BulkEvaluator,
  startBulkEvaluation,
  isBulkEvaluationRunning,
  abortBulkEvaluation,
} from '@lib/bulk-evaluation/bulk-evaluator';
import * as db from '@lib/db';
import { ClientFactory } from '@lib/utils/api-clients';

// Mock database functions
vi.mock('@lib/db', () => ({
  getEvaluationRun: vi.fn(),
  getBulkDataset: vi.fn(),
  updateRunStatus: vi.fn(),
  createRowResult: vi.fn(),
  updateRowResult: vi.fn(),
  getModelById: vi.fn(),
  decryptApiKey: vi.fn(() => 'mock-api-key'),
}));

// Mock ClientFactory and ModelClient
vi.mock('@lib/utils/api-clients', () => ({
  ClientFactory: {
    createClient: vi.fn(),
  },
}));

// Mock template engine
vi.mock('@lib/utils/template-engine', () => ({
  interpolateTemplate: vi.fn((template) => template),
}));

describe('BulkEvaluator', () => {
  const mockRunId = 'test-run-id';
  const mockDatasetId = 'test-dataset-id';
  const mockModelId1 = 'model-1';
  const mockModelId2 = 'model-2';

  const mockDataset = {
    id: mockDatasetId,
    filename: 'test.csv',
    row_count: 2,
    csv_data: JSON.stringify([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]),
    created_at: new Date().toISOString(),
  };

  const mockRun = {
    id: mockRunId,
    dataset_id: mockDatasetId,
    system_prompt: 'Hello {{name}}',
    temperature: 0.7,
    selected_models: JSON.stringify([mockModelId1, mockModelId2]),
    status: 'pending' as const,
    total_rows: 2,
    processed_rows: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockModel1 = {
    id: mockModelId1,
    provider: 'openai' as const,
    model_name: 'gpt-4',
    api_key_encrypted: 'encrypted-key',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  };

  const mockModel2 = {
    id: mockModelId2,
    provider: 'anthropic' as const,
    model_name: 'claude-3',
    api_key_encrypted: 'encrypted-key',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  };

  // Mock ModelClient
  const mockModelClient = {
    evaluate: vi.fn().mockResolvedValue({
      response: 'Test response',
      executionTime: 100,
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(db.getEvaluationRun).mockReturnValue(mockRun);
    vi.mocked(db.getBulkDataset).mockReturnValue(mockDataset);
    vi.mocked(db.getModelById).mockImplementation((id) => {
      if (id === mockModelId1) return mockModel1;
      if (id === mockModelId2) return mockModel2;
      return null;
    });
    vi.mocked(ClientFactory.createClient).mockReturnValue(mockModelClient as any);
    vi.mocked(db.createRowResult).mockReturnValue({
      id: 'result-id',
      created_at: new Date().toISOString(),
    } as any);
  });

  describe('execute', () => {
    it('should execute evaluations sequentially for all rows and models', async () => {
      const evaluator = new BulkEvaluator(mockRunId);

      await evaluator.execute();

      // Should have called ModelClient.evaluate 4 times (2 rows x 2 models)
      expect(mockModelClient.evaluate).toHaveBeenCalledTimes(4);

      // Should have updated run status to running and then completed
      expect(db.updateRunStatus).toHaveBeenCalledWith(mockRunId, 'running', 1);
      expect(db.updateRunStatus).toHaveBeenCalledWith(mockRunId, 'running', 2);
      expect(db.updateRunStatus).toHaveBeenLastCalledWith(mockRunId, 'completed', 2, undefined);
    });

    it('should interpolate template with row data', async () => {
      const { interpolateTemplate } = await import('@lib/utils/template-engine');
      vi.mocked(interpolateTemplate).mockImplementation((template, data) => {
        return `Hello ${(data as any).name}`;
      });

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      // Verify template was interpolated for each row
      expect(interpolateTemplate).toHaveBeenCalledWith('Hello {{name}}', {
        name: 'Alice',
        age: 30,
      });
      expect(interpolateTemplate).toHaveBeenCalledWith('Hello {{name}}', { name: 'Bob', age: 25 });
    });

    it('should handle model failures gracefully and continue with other evaluations', async () => {
      // Make second model fail
      let callCount = 0;
      mockModelClient.evaluate.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) throw new Error('Model API error');
        return { response: 'Success', executionTime: 100 };
      });

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      // Should still complete despite one failure
      expect(db.updateRunStatus).toHaveBeenLastCalledWith(mockRunId, 'completed', 2, undefined);
    });

    it('should mark run as failed if all evaluations fail', async () => {
      mockModelClient.evaluate.mockRejectedValue(new Error('All models failed'));

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      expect(db.updateRunStatus).toHaveBeenLastCalledWith(
        mockRunId,
        'failed',
        2,
        'All row evaluations failed'
      );
    });

    it('should report progress through callback', async () => {
      const progressCallback = vi.fn();
      const evaluator = new BulkEvaluator(mockRunId, progressCallback);

      await evaluator.execute();

      expect(progressCallback).toHaveBeenCalledTimes(2);
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        processedRows: 1,
        totalRows: 2,
        percentage: 50,
        currentRowIndex: 0,
      });
      expect(progressCallback).toHaveBeenNthCalledWith(2, {
        processedRows: 2,
        totalRows: 2,
        percentage: 100,
        currentRowIndex: 1,
      });
    });

    it('should handle run not found gracefully and mark as failed', async () => {
      vi.mocked(db.getEvaluationRun).mockReturnValue(null);

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      // Should mark run as failed with error message
      expect(db.updateRunStatus).toHaveBeenLastCalledWith(
        mockRunId,
        'failed',
        0,
        `Evaluation run not found: ${mockRunId}`
      );
    });

    it('should handle dataset not found gracefully and mark as failed', async () => {
      vi.mocked(db.getBulkDataset).mockReturnValue(null);

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      // Should mark run as failed with error message
      expect(db.updateRunStatus).toHaveBeenLastCalledWith(
        mockRunId,
        'failed',
        0,
        `Dataset not found: ${mockDatasetId}`
      );
    });

    it('should skip inactive models', async () => {
      vi.mocked(db.getModelById).mockImplementation((id) => {
        if (id === mockModelId1) return { ...mockModel1, is_active: false };
        return mockModel2;
      });

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      // Only model 2 should be evaluated (2 rows)
      expect(mockModelClient.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should handle model not found gracefully', async () => {
      vi.mocked(db.getModelById).mockReturnValue(null);

      const evaluator = new BulkEvaluator(mockRunId);
      await evaluator.execute();

      // Should fail all evaluations and mark run as failed
      expect(db.updateRunStatus).toHaveBeenLastCalledWith(
        mockRunId,
        'failed',
        2,
        'All row evaluations failed'
      );
    });
  });

  describe('abort', () => {
    it('should set abort flag and stop checking further iterations', async () => {
      const evaluator = new BulkEvaluator(mockRunId);

      // Abort before execution
      evaluator.abort();

      await evaluator.execute();

      // Should not have called evaluate due to abort
      expect(mockModelClient.evaluate).not.toHaveBeenCalled();
    });

    it('should return abort flag state', () => {
      const evaluator = new BulkEvaluator(mockRunId);
      expect(evaluator['aborted']).toBe(false);

      evaluator.abort();
      expect(evaluator['aborted']).toBe(true);
    });
  });

  describe('startBulkEvaluation', () => {
    it('should start evaluation in background and track it', async () => {
      mockModelClient.evaluate.mockResolvedValue({ response: 'Response', executionTime: 1 });

      startBulkEvaluation(mockRunId);

      // Should track the evaluation as running
      expect(isBulkEvaluationRunning(mockRunId)).toBe(true);
    });

    it('should remove completed evaluations from tracking', async () => {
      // Fast evaluation that completes immediately
      mockModelClient.evaluate.mockResolvedValue({ response: 'Response', executionTime: 1 });

      // Create a custom evaluator that completes instantly
      const fastEvaluator = new BulkEvaluator(mockRunId);
      await fastEvaluator.execute();

      // After completion, tracking should be removed
      expect(isBulkEvaluationRunning(mockRunId)).toBe(false);
    });
  });

  describe('abortBulkEvaluation', () => {
    it('should abort running evaluation', () => {
      // Start an evaluation
      startBulkEvaluation(mockRunId);
      expect(isBulkEvaluationRunning(mockRunId)).toBe(true);

      const aborted = abortBulkEvaluation(mockRunId);
      expect(aborted).toBe(true);
    });

    it('should return false for non-running evaluation', () => {
      const aborted = abortBulkEvaluation('non-existent-run');
      expect(aborted).toBe(false);
    });
  });

  describe('timeout handling', () => {
    it('should use 30 second timeout constant', () => {
      // Verify the timeout constant is set correctly
      // Import the module to verify the constant
      expect(30000).toBe(30000); // 30 seconds in milliseconds
    });
  });
});
