/**
 * Integration tests for metrics status polling endpoint
 *
 * Tests GET /api/personas/{personaId}/iterations/{iteration}/status
 * Verifies status responses for different calculation states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

type StatusEndpointContext = APIContext<
  { id: string; num: string },
  Record<string, string | undefined>
>;

// Mock database module
const mockDb = {
  prepare: vi.fn(),
  transaction: vi.fn(),
  close: vi.fn(),
};

vi.mock('@lib/db', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('@lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    logApiRequest: vi.fn(),
    logApiError: vi.fn(),
  }),
}));

// Import after mocking
const { GET } = await import('../../src/pages/api/personas/[id]/iterations/[num]/status');

describe('GET /api/personas/{id}/iterations/{iteration}/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.prepare = vi.fn().mockReturnValue({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when persona ID is missing', async () => {
      const response = await GET({
        params: { id: '', num: '1' },
        request: new Request('http://localhost/api/personas//iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 when iteration number is invalid', async () => {
      const response = await GET({
        params: { id: 'persona-1', num: 'abc' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/abc/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('Resource Not Found', () => {
    it('should return 404 when persona does not exist', async () => {
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(null),
      });

      const response = await GET({
        params: { id: 'persona-1', num: '1' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    it('should return 404 when iteration does not exist', async () => {
      const getMock = vi.fn();
      getMock
        .mockReturnValueOnce({ id: 'persona-1', name: 'Test' }) // Persona exists
        .mockReturnValueOnce(null); // Iteration does not exist

      mockDb.prepare = vi.fn().mockReturnValue({
        get: getMock,
      });

      const response = await GET({
        params: { id: 'persona-1', num: '1' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe('NOT_FOUND');
    });
  });

  describe('Status Responses', () => {
    it('should return calculating status when metrics are being computed', async () => {
      const getMock = vi.fn();

      // Persona exists
      getMock.mockReturnValue({ id: 'persona-1', name: 'Test Persona' });

      // Iteration is calculating
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValueOnce({ id: 'persona-1', name: 'Test' }).mockReturnValueOnce({
          id: 'iter-1',
          iteration_number: 1,
          status: 'calculating_metrics',
        }),
      });

      // No metrics yet
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(null),
      });

      // Mock query chain for training state
      const trainingStateStmt = {
        get: vi.fn().mockReturnValue({ status: 'calculating_metrics' }),
      };

      mockDb.prepare = vi.fn().mockImplementation((query) => {
        if (query.includes('iteration_metrics')) {
          return { get: vi.fn().mockReturnValue(null) };
        }
        if (query.includes('training_loop_state')) {
          return trainingStateStmt;
        }
        return { get: getMock };
      });

      const response = await GET({
        params: { id: 'persona-1', num: '1' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('calculating');
      expect(body.iteration).toBe(1);
      expect(body.message).toBe('The training in progress');
    });

    it('should return completed status with metrics when calculation is done', async () => {
      const getMock = vi.fn();

      // Persona exists - first call returns persona
      getMock.mockReturnValueOnce({ id: 'persona-1', name: 'Test Persona' });

      // Iteration record - second call returns iteration with status completed
      getMock.mockReturnValueOnce({
        id: 'iter-1',
        iteration_number: 1,
        status: 'completed',
        completed_at: '2025-12-29T10:00:00Z',
        started_at: '2025-12-29T09:00:00Z',
      });

      // Metrics - third call returns metrics data
      getMock.mockReturnValueOnce({
        f1_score: 0.85,
        precision: 0.88,
        recall: 0.82,
        cohens_kappa: 0.78,
        accuracy: 0.87,
        true_positives: 45,
        true_negatives: 35,
        false_positives: 8,
        false_negatives: 7,
        calculated_at: '2025-12-29T10:00:01Z',
      });

      mockDb.prepare = vi.fn().mockReturnValue({
        get: getMock,
      });

      const response = await GET({
        params: { id: 'persona-1', num: '1' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('completed');
      expect(body.metrics).toBeDefined();
      expect(body.metrics.f1_score).toBe(0.85);
      expect(body.metrics.precision).toBe(0.88);
      expect(body.metrics.recall).toBe(0.82);
      expect(body.metrics.cohens_kappa).toBe(0.78);
      expect(body.metrics.accuracy).toBe(0.87);
      expect(body.metrics.confusion_matrix).toEqual({
        true_positives: 45,
        true_negatives: 35,
        false_positives: 8,
        false_negatives: 7,
      });
      expect(body.duration_ms).toBeDefined();
    });

    it('should return error status when calculation failed', async () => {
      const getMock = vi.fn();

      // Persona exists
      getMock.mockReturnValue({ id: 'persona-1', name: 'Test Persona' });

      // Iteration has failed
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValueOnce({ id: 'persona-1', name: 'Test' }).mockReturnValueOnce({
          id: 'iter-1',
          iteration_number: 1,
          status: 'failed',
          error_message: 'Database connection failed',
          completed_at: '2025-12-29T10:00:00Z',
        }),
      });

      const response = await GET({
        params: { id: 'persona-1', num: '1' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body.message).toBe('Database connection failed');
    });
  });

  describe('Progress Tracking', () => {
    it('should return progress percent for in-progress calculations', async () => {
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValueOnce({ id: 'persona-1', name: 'Test' }).mockReturnValueOnce({
          id: 'iter-1',
          iteration_number: 1,
          status: 'calculating_metrics',
          total_pairs_evaluated: 15,
        }),
      });

      // No metrics yet
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(null),
      });

      // Training state with progress
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({
          status: 'calculating_metrics',
          task_results_evaluated: 15,
        }),
      });

      const response = await GET({
        params: { id: 'persona-1', num: '1' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/1/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('calculating');
      expect(body.progress_percent).toBeDefined();
    });

    it('should persist completed status on multiple GET requests', async () => {
      // First request returns completed
      mockDb.prepare = vi.fn().mockReturnValue({
        get: vi
          .fn()
          // First GET request: persona, iteration, metrics
          .mockReturnValueOnce({ id: 'persona-1', name: 'Test' })
          .mockReturnValueOnce({
            id: 'iter-1',
            iteration_number: 2,
            status: 'completed',
            completed_at: '2025-12-29T10:00:00Z',
            started_at: '2025-12-29T09:00:00Z',
          })
          .mockReturnValueOnce({
            f1_score: 0.92,
            precision: 0.94,
            recall: 0.9,
            cohens_kappa: 0.85,
            accuracy: 0.91,
            true_positives: 85,
            true_negatives: 75,
            false_positives: 10,
            false_negatives: 8,
            calculated_at: '2025-12-29T10:00:01Z',
          })
          // Second GET request: persona, iteration, metrics (same data)
          .mockReturnValueOnce({ id: 'persona-1', name: 'Test' })
          .mockReturnValueOnce({
            id: 'iter-1',
            iteration_number: 2,
            status: 'completed',
            completed_at: '2025-12-29T10:00:00Z',
            started_at: '2025-12-29T09:00:00Z',
          })
          .mockReturnValueOnce({
            f1_score: 0.92,
            precision: 0.94,
            recall: 0.9,
            cohens_kappa: 0.85,
            accuracy: 0.91,
            true_positives: 85,
            true_negatives: 75,
            false_positives: 10,
            false_negatives: 8,
            calculated_at: '2025-12-29T10:00:01Z',
          }),
      });

      const response = await GET({
        params: { id: 'persona-1', num: '2' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/2/status'),
      } as unknown as StatusEndpointContext);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('completed');
      expect(body.metrics.f1_score).toBe(0.92);

      // Second request should also return completed (persisted state)
      const response2 = await GET({
        params: { id: 'persona-1', num: '2' },
        request: new Request('http://localhost/api/personas/persona-1/iterations/2/status'),
      } as unknown as StatusEndpointContext);

      expect(response2.status).toBe(200);
      const body2 = await response2.json();
      expect(body2.status).toBe('completed');
    });
  });
});
