/**
 * Metrics Polling Hook for Client-Side Status Tracking
 *
 * Provides reactive polling for metrics calculation status.
 * Implements exponential backoff and automatic cleanup.
 *
 * Usage:
 * ```typescript
 * const { status, metrics, isLoading, error, stopPolling } = useMetricsPolling(
 *   personaId,
 *   iteration,
 *   { initialInterval: 1000, maxInterval: 2000 }
 * );
 * ```
 */

export interface MetricsStatus {
  status: 'calculating' | 'completed' | 'error';
  iteration: number;
  persona_id: string;
  message: string;
  progress_percent?: number;
  metrics?: {
    f1_score: number;
    precision: number;
    recall: number;
    cohens_kappa: number;
    accuracy: number;
    confusion_matrix: {
      true_positives: number;
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
    };
  };
  duration_ms?: number;
  calculated_at?: string;
}

export interface UseMetricsPollingOptions {
  /** Initial polling interval in ms (default: 1000) */
  initialInterval?: number;
  /** Maximum polling interval in ms (default: 2000) */
  maxInterval?: number;
  /** Number of retry attempts on error (default: 3) */
  maxRetries?: number;
  /** Callback when status changes */
  onStatusChange?: (status: MetricsStatus['status']) => void;
  /** Callback when metrics are ready */
  onComplete?: (metrics: MetricsStatus['metrics']) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseMetricsPollingReturn {
  /** Current status */
  status: MetricsStatus['status'] | null;
  /** Current metrics (if completed) */
  metrics: MetricsStatus['metrics'] | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Progress percentage (if calculating) */
  progressPercent: number | null;
  /** Message from server */
  message: string | null;
  /** Stop polling manually */
  stopPolling: () => void;
  /** Force refresh status */
  refresh: () => Promise<void>;
  /** Reset hook state */
  reset: () => void;
}

/**
 * Create a metrics polling controller
 */
export class MetricsPollingController {
  private personaId: string;
  private iteration: number;
  private options: Required<UseMetricsPollingOptions>;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentStatus: MetricsStatus['status'] | null = null;
  private retryCount = 0;
  private currentInterval: number;
  private listeners: Set<(status: MetricsStatus) => void> = new Set();
  private isStopped = false;

  /**
   * Creates a metrics polling hook for monitoring calculation progress
   * @param personaId - The persona ID to poll metrics for
   * @param iteration - The iteration number to poll
   * @param options - Polling configuration options
   */
  constructor(personaId: string, iteration: number, options: UseMetricsPollingOptions = {}) {
    this.personaId = personaId;
    this.iteration = iteration;
    this.options = {
      initialInterval: options.initialInterval ?? 1000,
      maxInterval: options.maxInterval ?? 2000,
      maxRetries: options.maxRetries ?? 3,
      onStatusChange: options.onStatusChange ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
    this.currentInterval = this.options.initialInterval;
  }

  /**
   * Fetch current status from API
   */
  async fetchStatus(): Promise<MetricsStatus | null> {
    if (this.isStopped) return null;

    try {
      const response = await fetch(
        `/api/personas/${this.personaId}/iterations/${this.iteration}/status`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const status = (await response.json()) as MetricsStatus;
      this.retryCount = 0; // Reset retry count on successful request

      return status;
    } catch (error) {
      this.retryCount++;

      if (this.retryCount >= this.options.maxRetries) {
        this.options.onError(error instanceof Error ? error : new Error('Unknown error'));
        // Stop polling after max retries exceeded
        this.stop();
        return null;
      }

      // Exponential backoff for retries
      this.currentInterval = Math.min(this.currentInterval * 2, this.options.maxInterval);

      return null;
    }
  }

  /**
   * Start polling
   */
  start(): void {
    if (this.intervalId !== null) {
      return; // Already polling
    }

    this.isStopped = false;
    this.currentInterval = this.options.initialInterval;
    this.retryCount = 0;

    const poll = async () => {
      if (this.isStopped) return;

      const status = await this.fetchStatus();

      if (!status) {
        // Continue polling with backoff
        if (!this.isStopped) {
          this.intervalId = setTimeout(poll, this.currentInterval);
        }
        return;
      }

      // Notify listeners
      this.listeners.forEach((listener) => listener(status));

      // Handle status changes
      if (status.status !== this.currentStatus) {
        this.currentStatus = status.status;
        this.options.onStatusChange(status.status);

        if (status.status === 'completed' && status.metrics) {
          this.options.onComplete(status.metrics);
          this.stop(); // Stop polling when complete
          return;
        }

        if (status.status === 'error') {
          this.stop(); // Stop polling on error
          return;
        }
      }

      // Continue polling
      if (!this.isStopped) {
        this.intervalId = setTimeout(poll, this.currentInterval);
      }
    };

    // Start first poll immediately
    poll();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.isStopped = true;
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Add a listener for status updates
   */
  addListener(listener: (status: MetricsStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current status
   */
  getStatus(): MetricsStatus['status'] | null {
    return this.currentStatus;
  }

  /**
   * Destroy the controller and cleanup
   */
  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}

/**
 * React-like hook for metrics polling (works in vanilla JS)
 */
export function useMetricsPolling(
  personaId: string,
  iteration: number,
  options: UseMetricsPollingOptions = {}
): UseMetricsPollingReturn {
  let controller: MetricsPollingController | null = null;

  let _status: MetricsStatus['status'] | null = null;
  let _metrics: MetricsStatus['metrics'] | null = null;
  let _isLoading = true;
  let _error: string | null = null;
  let _progressPercent: number | null = null;
  let _message: string | null = null;

  // State management
  const state = {
    get status() {
      return _status;
    },
    get metrics() {
      return _metrics;
    },
    get isLoading() {
      return _isLoading;
    },
    get error() {
      return _error;
    },
    get progressPercent() {
      return _progressPercent;
    },
    get message() {
      return _message;
    },
  };

  const updateState = (status: MetricsStatus) => {
    _status = status.status;
    _message = status.message;
    _progressPercent = status.progress_percent ?? null;
    _metrics = status.metrics ?? null;
    _error = status.status === 'error' ? status.message : null;
    _isLoading = false;

    // Trigger reactivity (call listeners)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('metrics-polling-update', { detail: state }));
    }
  };

  const initialize = () => {
    if (controller) return;

    controller = new MetricsPollingController(personaId, iteration, {
      ...options,
      onStatusChange: (status) => {
        options.onStatusChange?.(status);
        // Trigger reactivity
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('metrics-status-change', { detail: status }));
        }
      },
      onComplete: (metrics) => {
        options.onComplete?.(metrics);
      },
      onError: (error) => {
        _error = error.message;
        _isLoading = false;
        options.onError?.(error);
      },
    });

    controller.addListener(updateState);
    controller.start();
  };

  const stopPolling = () => {
    controller?.stop();
  };

  const refresh = async () => {
    if (!controller) {
      initialize();
      return;
    }
    const status = await controller.fetchStatus();
    if (status) {
      updateState(status);
    }
  };

  const reset = () => {
    controller?.destroy();
    controller = null;
    _status = null;
    _metrics = null;
    _isLoading = true;
    _error = null;
    _progressPercent = null;
    _message = null;
  };

  // Initialize immediately
  if (typeof window !== 'undefined') {
    initialize();
  }

  // Return hook interface
  return {
    get status() {
      return state.status;
    },
    get metrics() {
      return state.metrics;
    },
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get progressPercent() {
      return state.progressPercent;
    },
    get message() {
      return state.message;
    },
    stopPolling,
    refresh,
    reset,
  };
}

/**
 * Utility function to check if calculation is still in progress
 */
export function isCalculationInProgress(status: MetricsStatus['status']): boolean {
  return status === 'calculating';
}

/**
 * Utility function to check if calculation is complete
 */
export function isCalculationComplete(status: MetricsStatus['status']): boolean {
  return status === 'completed';
}

/**
 * Utility function to check if calculation failed
 */
export function isCalculationError(status: MetricsStatus['status']): boolean {
  return status === 'error';
}
