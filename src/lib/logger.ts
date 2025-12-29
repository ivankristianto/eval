/**
 * Structured logging utility for the LLM-as-Judge training system
 * Provides consistent logging across training loop, API endpoints, and database operations
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Get the minimum log level from environment variable.
 * Defaults to INFO if not set or invalid.
 * @returns The minimum log level to output
 */
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel && Object.values(LogLevel).includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  return LogLevel.INFO;
}

/** Minimum log level - logs below this level will be suppressed */
const MIN_LOG_LEVEL = getMinLogLevel();

/** Log level hierarchy (lower value = higher priority) */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
};

/**
 * Check if a log level should be output based on minimum log level
 * @param level - The log level to check
 * @returns true if the log should be output, false otherwise
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Create a log entry
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    // Skip logging if level is below minimum
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      data,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // In production, this would send to a logging service
    // For now, console with structured output
    const logOutput = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(logOutput);
        break;
      case LogLevel.WARN:
        console.warn(logOutput);
        break;
      case LogLevel.DEBUG:
        console.debug(logOutput);
        break;
      default:
        console.log(logOutput);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  /**
   * Log training iteration start
   */
  logIterationStart(personaId: string, iterationNumber: number): void {
    this.info('Starting training iteration', {
      personaId,
      iterationNumber,
    });
  }

  /**
   * Log training iteration complete
   */
  logIterationComplete(
    personaId: string,
    iterationNumber: number,
    metrics: {
      f1_score: number;
      precision: number;
      recall: number;
      cohens_kappa: number;
    }
  ): void {
    this.info('Training iteration complete', {
      personaId,
      iterationNumber,
      metrics,
    });
  }

  /**
   * Log API request
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode?: number,
    durationMs?: number
  ): void {
    const message = statusCode
      ? `API ${method} ${path} - ${statusCode}`
      : `API ${method} ${path}`;

    this.info(message, {
      method,
      path,
      statusCode,
      durationMs,
    });
  }

  /**
   * Log API error
   */
  logApiError(
    method: string,
    path: string,
    error: Error,
    statusCode?: number
  ): void {
    this.error(`API ${method} ${path} failed`, error, {
      method,
      path,
      statusCode,
    });
  }

  /**
   * Log database query
   */
  logDatabaseQuery(query: string, params?: unknown[], durationMs?: number): void {
    this.debug('Database query', {
      query: query.substring(0, 200), // Truncate long queries
      params,
      durationMs,
    });
  }

  /**
   * Log database error
   */
  logDatabaseError(query: string, error: Error): void {
    this.error('Database query failed', error, {
      query: query.substring(0, 200),
    });
  }

  /**
   * Log LLM API call
   */
  logLLMCall(provider: string, model: string, promptTokens: number, completionTokens: number): void {
    this.info('LLM API call', {
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });
  }

  /**
   * Log LLM API error
   */
  logLLMError(provider: string, model: string, error: Error): void {
    this.error('LLM API call failed', error, {
      provider,
      model,
    });
  }
}

/**
 * Create a logger instance for a specific context
 * @param context - The context/module name for the logger
 * @returns Logger instance
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Pre-configured loggers for common contexts
export const trainingLoopLogger = new Logger('TrainingLoop');
export const apiLogger = new Logger('API');
export const dbLogger = new Logger('Database');
export const llmLogger = new Logger('LLM');
