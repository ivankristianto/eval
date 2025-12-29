/**
 * Unit tests for metrics polling hook
 *
 * Tests client-side polling logic for metrics status tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

describe('MetricsPollingController', () => {
  let mockFetch: any;
  let originalFetch: typeof fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create controller with correct parameters', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      const controller = new MetricsPollingController('persona-1', 1);

      expect(controller).toBeDefined();
    });

    it('should use custom options when provided', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 500,
        maxInterval: 1000,
        maxRetries: 5,
      });

      expect(controller).toBeDefined();
    });
  });

  describe('Status Fetching', () => {
    it('should fetch status from correct endpoint', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'calculating',
          iteration: 1,
          persona_id: 'persona-1',
          message: 'The training in progress',
        }),
      });

      const controller = new MetricsPollingController('persona-1', 1);
      const status = await controller.fetchStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/personas/persona-1/iterations/1/status'
      );
      expect(status).toBeDefined();
      expect(status?.status).toBe('calculating');
    });

    it('should handle API errors gracefully', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockRejectedValue(new Error('Network error'));

      const controller = new MetricsPollingController('persona-1', 1);
      const status = await controller.fetchStatus();

      expect(status).toBeNull();
    });

    it('should handle non-OK responses', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const controller = new MetricsPollingController('persona-1', 1);
      const status = await controller.fetchStatus();

      expect(status).toBeNull();
    });
  });

  describe('Polling Behavior', () => {
    it('should start polling when start() is called', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'calculating',
          iteration: 1,
          persona_id: 'persona-1',
          message: 'The training in progress',
        }),
      });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
      });

      controller.start();

      // Advance timer to allow first fetch
      await vi.advanceTimersByTimeAsync(150);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should stop polling when stop() is called', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'calculating',
          iteration: 1,
          persona_id: 'persona-1',
          message: 'The training in progress',
        }),
      });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
      });

      controller.start();
      await vi.advanceTimersByTimeAsync(150);

      const callCountBefore = mockFetch.mock.calls.length;

      controller.stop();
      await vi.advanceTimersByTimeAsync(300);

      expect(mockFetch.mock.calls.length).toBe(callCountBefore);
    });

    it('should stop polling when status is completed', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'completed',
          iteration: 1,
          persona_id: 'persona-1',
          message: 'Metrics calculated successfully',
          metrics: {
            f1_score: 0.85,
            precision: 0.88,
            recall: 0.82,
            cohens_kappa: 0.78,
            accuracy: 0.87,
            confusion_matrix: {
              true_positives: 45,
              true_negatives: 35,
              false_positives: 8,
              false_negatives: 7,
            },
          },
        }),
      });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
      });

      const stopSpy = vi.spyOn(controller, 'stop');

      controller.start();
      await vi.advanceTimersByTimeAsync(150);

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should stop polling on error status', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'error',
          iteration: 1,
          persona_id: 'persona-1',
          message: 'Database connection failed',
        }),
      });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
      });

      const stopSpy = vi.spyOn(controller, 'stop');

      controller.start();
      await vi.advanceTimersByTimeAsync(150);

      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Listeners', () => {
    it('should notify listeners on status update', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      const mockStatus: any = {
        status: 'calculating',
        iteration: 1,
        persona_id: 'persona-1',
        message: 'The training in progress',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus,
      });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
      });

      const listener = vi.fn();
      const unsubscribe = controller.addListener(listener);

      controller.start();
      await vi.advanceTimersByTimeAsync(150);

      expect(listener).toHaveBeenCalledWith(mockStatus);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      await vi.advanceTimersByTimeAsync(150);

      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on fetch error with exponential backoff', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            status: 'calculating',
            iteration: 1,
            persona_id: 'persona-1',
            message: 'The training in progress',
          }),
        });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
        maxRetries: 3,
      });

      controller.start();

      // First call fails
      await vi.advanceTimersByTimeAsync(150);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Retry with backoff (200ms)
      await vi.advanceTimersByTimeAsync(250);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Success on retry
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should stop after max retries', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockRejectedValue(new Error('Network error'));

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 50,
        maxInterval: 100,
        maxRetries: 3,
      });

      const onError = vi.fn();
      controller.addListener(() => {});

      // Override onError
      (controller as any).options.onError = onError;

      controller.start();

      // First call
      await vi.advanceTimersByTimeAsync(100);
      // Retry
      await vi.advanceTimersByTimeAsync(150);
      // Retry
      await vi.advanceTimersByTimeAsync(250);
      // Stop after max retries
      await vi.advanceTimersByTimeAsync(500);

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase interval on each retry', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockRejectedValue(new Error('Network error'));

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 800,
        maxRetries: 5,
      });

      controller.start();

      // First call (0ms)
      await vi.advanceTimersByTimeAsync(50);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // First retry (100ms)
      await vi.advanceTimersByTimeAsync(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second retry with backoff (200ms)
      await vi.advanceTimersByTimeAsync(250);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Third retry with backoff (400ms)
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      // Fourth retry with backoff (800ms)
      await vi.advanceTimersByTimeAsync(900);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on destroy', async () => {
      const { MetricsPollingController } = await import(
        '../../src/lib/metrics-polling-hook'
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'calculating',
          iteration: 1,
          persona_id: 'persona-1',
          message: 'The training in progress',
        }),
      });

      const controller = new MetricsPollingController('persona-1', 1, {
        initialInterval: 100,
        maxInterval: 200,
      });

      controller.start();
      await vi.advanceTimersByTimeAsync(150);

      const callCount = mockFetch.mock.calls.length;

      controller.destroy();

      // Make more calls that should not happen
      await vi.advanceTimersByTimeAsync(500);

      expect(mockFetch.mock.calls.length).toBe(callCount);
    });
  });
});

describe('useMetricsPolling Hook', () => {
  let mockFetch: any;
  let originalFetch: typeof fetch;

  beforeAll(() => {
    originalFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should return correct initial state', async () => {
    const { useMetricsPolling } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    const result = useMetricsPolling('persona-1', 1);

    expect(result.status).toBeNull();
    expect(result.metrics).toBeNull();
    expect(result.isLoading).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should provide stopPolling function', async () => {
    const { useMetricsPolling } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'calculating',
        iteration: 1,
        persona_id: 'persona-1',
        message: 'The training in progress',
      }),
    });

    const result = useMetricsPolling('persona-1', 1, {
      initialInterval: 100,
    });

    expect(typeof result.stopPolling).toBe('function');
  });

  it('should provide refresh function', async () => {
    const { useMetricsPolling } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'calculating',
        iteration: 1,
        persona_id: 'persona-1',
        message: 'The training in progress',
      }),
    });

    const result = useMetricsPolling('persona-1', 1);

    expect(typeof result.refresh).toBe('function');
  });

  it('should provide reset function', async () => {
    const { useMetricsPolling } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'calculating',
        iteration: 1,
        persona_id: 'persona-1',
        message: 'The training in progress',
      }),
    });

    const result = useMetricsPolling('persona-1', 1);

    expect(typeof result.reset).toBe('function');
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('isCalculationInProgress should return true for calculating status', async () => {
    const { isCalculationInProgress } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    expect(isCalculationInProgress('calculating')).toBe(true);
    expect(isCalculationInProgress('completed')).toBe(false);
    expect(isCalculationInProgress('error')).toBe(false);
  });

  it('isCalculationComplete should return true for completed status', async () => {
    const { isCalculationComplete } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    expect(isCalculationComplete('completed')).toBe(true);
    expect(isCalculationComplete('calculating')).toBe(false);
    expect(isCalculationComplete('error')).toBe(false);
  });

  it('isCalculationError should return true for error status', async () => {
    const { isCalculationError } = await import(
      '../../src/lib/metrics-polling-hook'
    );

    expect(isCalculationError('error')).toBe(true);
    expect(isCalculationError('calculating')).toBe(false);
    expect(isCalculationError('completed')).toBe(false);
  });
});
