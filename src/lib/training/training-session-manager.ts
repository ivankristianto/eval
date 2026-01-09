/**
 * Training Session Manager
 *
 * Manages checkpoint save/resume, pause/resume, and state integrity for training sessions.
 * This class provides ACID-compliant checkpoint management and session state control,
 * using the current Persona schema fields and versioned prompt tables.
 *
 * This replaces the deprecated TrainingStateManager class (moved to deprecated/training-state.ts)
 * with current Persona schema alignment.
 *
 * @example
 * ```typescript
 * const manager = new TrainingSessionManager(db);
 *
 * // Create a new session
 * manager.createSession('session-123', 'persona-456', 5);
 *
 * // Save checkpoint
 * manager.saveCheckpoint('session-123', 'persona-456', checkpointData);
 *
 * // Pause and resume
 * manager.pause('session-123', 'User requested pause');
 * const resumed = manager.resume('session-123');
 * ```
 *
 * @see {@link https://github.com/ivankristianto/eval | Project Documentation}
 */
import type { Database } from 'better-sqlite3';
import type { CheckpointData, MetricsResult, TrainingLoopState } from '@src-types/training';
import { TrainingStateError } from './training-errors';

/**
 * Default maximum iterations for training loop (no longer in personas table)
 */
const DEFAULT_MAX_ITERATIONS = 5;

/**
 * Training Session Manager
 *
 * Manages checkpoint save/resume, pause/resume, and state integrity for training sessions.
 * Provides ACID-compliant checkpoint management and session state control using
 * the current Persona schema fields and versioned prompt tables.
 *
 * @class
 * @example
 * ```typescript
 * const manager = new TrainingSessionManager(db);
 * manager.createSession('session-123', 'persona-456', 5);
 * manager.saveCheckpoint('session-123', 'persona-456', checkpointData);
 * manager.pause('session-123', 'User requested pause');
 * const resumed = manager.resume('session-123');
 * ```
 */
export class TrainingSessionManager {
  private readonly db: Database;

  /**
   * Creates a new TrainingSessionManager instance.
   *
   * @param db - Database instance (required). Must be a better-sqlite3 Database instance.
   * @throws {TypeError} If db is not provided or is not a valid Database instance
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Saves a training checkpoint with ACID transaction guarantee.
   *
   * Creates training loop state if it doesn't exist and updates the checkpoint
   * for the current iteration. This method is transactional - all operations
   * succeed or all fail together.
   *
   * @param sessionId - Unique session identifier (e.g., UUID)
   * @param personaId - ID of the persona being trained
   * @param checkpoint - Checkpoint data including iteration number, metrics, and evaluated results
   * @throws {TrainingStateError} If persona is not found or transaction fails
   *
   * @example
   * ```typescript
   * const checkpoint: CheckpointData = {
   *   iterationNumber: 1,
   *   evaluatedResultCount: 10,
   *   metricsSnapshot: { f1_score: 0.8, ... },
   *   evaluatedResultIds: ['result-1', 'result-2'],
   *   currentPrompt: 'Evaluate this response...'
   * };
   * manager.saveCheckpoint('session-123', 'persona-456', checkpoint);
   * ```
   */
  saveCheckpoint(sessionId: string, personaId: string, checkpoint: CheckpointData): void {
    const transaction = this.db.transaction(() => {
      // Check if training loop state exists
      let state = this.db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopState | undefined;

      if (!state) {
        // Get persona to get model IDs (using current schema)
        const persona = this.db
          .prepare(
            'SELECT task_model_id, judge_model_id, prompt_engineer_model_id FROM personas WHERE id = ?'
          )
          .get(personaId) as
          | {
              task_model_id: string;
              judge_model_id: string;
              prompt_engineer_model_id: string;
            }
          | undefined;

        if (!persona) {
          throw new TrainingStateError(`Persona not found: ${personaId}`);
        }

        // Create training loop state (using current schema without max_iterations)
        const maxIterations = DEFAULT_MAX_ITERATIONS;
        this.db
          .prepare(
            `
            INSERT INTO training_loop_state
            (session_id, persona_id, total_iterations, current_iteration, status,
             task_model_id, judge_model_id, prompt_engineer_model_id,
             task_results_evaluated, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            sessionId,
            personaId,
            maxIterations,
            checkpoint.iterationNumber,
            'in_progress',
            persona.task_model_id,
            persona.judge_model_id,
            persona.prompt_engineer_model_id,
            checkpoint.evaluatedResultCount,
            new Date().toISOString(),
            new Date().toISOString()
          );
      }

      // Update training loop state with current iteration
      this.db
        .prepare(
          `
          UPDATE training_loop_state
          SET current_iteration = ?,
              task_results_evaluated = ?,
              updated_at = ?
          WHERE session_id = ?
        `
        )
        .run(
          checkpoint.iterationNumber,
          checkpoint.evaluatedResultCount,
          new Date().toISOString(),
          sessionId
        );

      // Save or update checkpoint (UPSERT)
      // Check if checkpoint already exists for this session and iteration
      const existingCheckpoint = this.db
        .prepare(
          'SELECT id FROM training_loop_checkpoints WHERE session_id = ? AND iteration_number = ?'
        )
        .get(sessionId, checkpoint.iterationNumber) as { id: string } | undefined;

      if (existingCheckpoint) {
        // Update existing checkpoint
        this.db
          .prepare(
            `
            UPDATE training_loop_checkpoints
            SET evaluated_result_count = ?,
                metrics_snapshot = ?,
                evaluated_result_ids = ?,
                current_prompt = ?
            WHERE session_id = ? AND iteration_number = ?
          `
          )
          .run(
            checkpoint.evaluatedResultCount,
            JSON.stringify(checkpoint.metricsSnapshot),
            JSON.stringify(checkpoint.evaluatedResultIds),
            checkpoint.currentPrompt,
            sessionId,
            checkpoint.iterationNumber
          );
      } else {
        // Create new checkpoint
        this.db
          .prepare(
            `
            INSERT INTO training_loop_checkpoints
            (id, session_id, iteration_number, evaluated_result_count,
             metrics_snapshot, evaluated_result_ids, current_prompt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            crypto.randomUUID(),
            sessionId,
            checkpoint.iterationNumber,
            checkpoint.evaluatedResultCount,
            JSON.stringify(checkpoint.metricsSnapshot),
            JSON.stringify(checkpoint.evaluatedResultIds),
            checkpoint.currentPrompt,
            new Date().toISOString()
          );
      }
    });

    transaction();
  }

  /**
   * Pauses a training session.
   *
   * Updates the session status to 'paused' and records the reason for pausing.
   * Only sessions with status 'in_progress' can be paused.
   *
   * @param sessionId - Unique session identifier to pause
   * @param reason - Human-readable reason for pausing (e.g., 'User requested', 'Maintenance')
   * @throws {TrainingStateError} If session is not found or not in a pausable state
   *
   * @example
   * ```typescript
   * manager.pause('session-123', 'User requested pause');
   * ```
   */
  pause(sessionId: string, reason: string): void {
    const state = this.db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as TrainingLoopState | undefined;

    if (!state) {
      throw new TrainingStateError(`Training session not found: ${sessionId}`);
    }

    // Validate that session can be paused
    if (state.status !== 'in_progress') {
      throw new TrainingStateError(
        `Cannot pause session in status '${state.status}'. Only 'in_progress' sessions can be paused.`
      );
    }

    this.db
      .prepare(
        'UPDATE training_loop_state SET status = ?, pause_reason = ?, updated_at = ? WHERE session_id = ?'
      )
      .run('paused', reason, new Date().toISOString(), sessionId);
  }

  /**
   * Resumes a training session from the latest checkpoint.
   *
   * Retrieves the most recent checkpoint data for the session, allowing
   * training to continue from where it left off. Returns null if the session
   * doesn't exist or has no checkpoints.
   *
   * @param sessionId - Unique session identifier to resume
   * @returns Checkpoint data from the latest iteration, or null if session/checkpoint not found
   *
   * @example
   * ```typescript
   * const checkpoint = manager.resume('session-123');
   * if (checkpoint) {
   *   console.log(`Resuming from iteration ${checkpoint.iterationNumber}`);
   * } else {
   *   console.log('No checkpoint found');
   * }
   * ```
   */
  resume(sessionId: string): CheckpointData | null {
    const state = this.db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as TrainingLoopState | undefined;

    if (!state) {
      return null;
    }

    const checkpoint = this.db
      .prepare(
        'SELECT * FROM training_loop_checkpoints WHERE session_id = ? ORDER BY iteration_number DESC LIMIT 1'
      )
      .get(sessionId) as
      | {
          iteration_number: number;
          evaluated_result_count: number;
          metrics_snapshot: string;
          evaluated_result_ids: string;
          current_prompt: string;
        }
      | undefined;

    if (!checkpoint) {
      return null;
    }

    // Parse checkpoint data
    try {
      const metricsSnapshot = JSON.parse(checkpoint.metrics_snapshot) as MetricsResult;
      const evaluatedResultIds = JSON.parse(checkpoint.evaluated_result_ids) as string[];

      return {
        iterationNumber: checkpoint.iteration_number,
        evaluatedResultCount: checkpoint.evaluated_result_count,
        metricsSnapshot,
        evaluatedResultIds,
        currentPrompt: checkpoint.current_prompt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Verifies the integrity of the latest checkpoint for a session.
   *
   * Checks that checkpoint data is complete and valid by verifying:
   * - Checkpoint exists
   * - Required fields are present (current_prompt, metrics_snapshot, evaluated_result_ids)
   * - JSON fields can be parsed successfully
   * - Metrics snapshot contains all required numeric fields
   * - Confusion matrix exists and has required numeric fields
   * - Evaluated result IDs is an array
   *
   * @param sessionId - Unique session identifier to verify
   * @returns true if checkpoint is intact and valid, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = manager.verifyCheckpointIntegrity('session-123');
   * if (!isValid) {
   *   console.error('Checkpoint data is corrupted or incomplete');
   * }
   * ```
   */
  verifyCheckpointIntegrity(sessionId: string): boolean {
    try {
      const checkpoint = this.db
        .prepare(
          'SELECT * FROM training_loop_checkpoints WHERE session_id = ? ORDER BY iteration_number DESC LIMIT 1'
        )
        .get(sessionId) as
        | {
            current_prompt: string;
            metrics_snapshot: string;
            evaluated_result_ids: string;
          }
        | undefined;

      if (!checkpoint) {
        return false;
      }

      // Verify required fields exist
      if (!checkpoint.current_prompt) {
        return false;
      }

      // Verify JSON fields can be parsed
      const metricsSnapshot = JSON.parse(checkpoint.metrics_snapshot) as MetricsResult;
      const evaluatedResultIds = JSON.parse(checkpoint.evaluated_result_ids) as string[];

      // Verify metrics snapshot has required fields
      if (
        typeof metricsSnapshot.f1_score !== 'number' ||
        typeof metricsSnapshot.precision !== 'number' ||
        typeof metricsSnapshot.recall !== 'number' ||
        typeof metricsSnapshot.accuracy !== 'number' ||
        typeof metricsSnapshot.cohens_kappa !== 'number'
      ) {
        return false;
      }

      // Verify confusion matrix exists and has required fields
      if (
        !metricsSnapshot.confusion_matrix ||
        typeof metricsSnapshot.confusion_matrix !== 'object' ||
        typeof metricsSnapshot.confusion_matrix.true_positives !== 'number' ||
        typeof metricsSnapshot.confusion_matrix.true_negatives !== 'number' ||
        typeof metricsSnapshot.confusion_matrix.false_positives !== 'number' ||
        typeof metricsSnapshot.confusion_matrix.false_negatives !== 'number'
      ) {
        return false;
      }

      // Verify evaluated result IDs is an array
      if (!Array.isArray(evaluatedResultIds)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the current state of a training session.
   *
   * Returns the complete training loop state including status, iteration numbers,
   * model IDs, and metadata. Returns null if the session doesn't exist.
   *
   * @param sessionId - Unique session identifier to query
   * @returns Training loop state object, or null if session not found
   *
   * @example
   * ```typescript
   * const state = manager.getSessionState('session-123');
   * if (state) {
   *   console.log(`Status: ${state.status}, Iteration: ${state.current_iteration}`);
   * }
   * ```
   */
  getSessionState(sessionId: string): TrainingLoopState | null {
    const state = this.db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as TrainingLoopState | undefined;

    return state || null;
  }

  /**
   * Creates a new training session.
   *
   * Initializes a new training session state with the given parameters.
   * The session starts in 'pending' status with current_iteration set to 1.
   *
   * @param sessionId - Unique session identifier (e.g., UUID)
   * @param personaId - ID of the persona to train
   * @param maxIterations - Maximum number of training iterations (defaults to 5)
   * @throws {TrainingStateError} If persona is not found
   *
   * @example
   * ```typescript
   * manager.createSession('session-123', 'persona-456', 10);
   * ```
   */
  createSession(
    sessionId: string,
    personaId: string,
    maxIterations: number = DEFAULT_MAX_ITERATIONS
  ): void {
    // Get persona to get model IDs (using current schema)
    const persona = this.db
      .prepare(
        'SELECT task_model_id, judge_model_id, prompt_engineer_model_id FROM personas WHERE id = ?'
      )
      .get(personaId) as
      | {
          task_model_id: string;
          judge_model_id: string;
          prompt_engineer_model_id: string;
        }
      | undefined;

    if (!persona) {
      throw new TrainingStateError(`Persona not found: ${personaId}`);
    }

    // Create training loop state (using current schema)
    this.db
      .prepare(
        `
        INSERT INTO training_loop_state
        (session_id, persona_id, total_iterations, current_iteration, status,
         task_model_id, judge_model_id, prompt_engineer_model_id,
         task_results_evaluated, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        sessionId,
        personaId,
        maxIterations,
        1,
        'pending',
        persona.task_model_id,
        persona.judge_model_id,
        persona.prompt_engineer_model_id,
        0,
        new Date().toISOString(),
        new Date().toISOString()
      );
  }

  /**
   * Updates the status of a training session.
   *
   * Changes the session status and optionally adds an error message.
   * Common statuses: 'pending', 'in_progress', 'paused', 'completed', 'failed'.
   *
   * @param sessionId - Unique session identifier to update
   * @param status - New status value (must be a valid TrainingLoopState status)
   * @param errorMessage - Optional error message (typically used when status is 'failed')
   * @throws {TrainingStateError} If session is not found
   *
   * @example
   * ```typescript
   * manager.updateSessionStatus('session-123', 'in_progress');
   * manager.updateSessionStatus('session-123', 'failed', 'API timeout');
   * ```
   */
  updateSessionStatus(
    sessionId: string,
    status: TrainingLoopState['status'],
    errorMessage?: string
  ): void {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new TrainingStateError(`Training session not found: ${sessionId}`);
    }

    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const values: (string | number)[] = [status, new Date().toISOString()];

    if (errorMessage) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    }

    values.push(sessionId);

    this.db
      .prepare(`UPDATE training_loop_state SET ${updates.join(', ')} WHERE session_id = ?`)
      .run(...values);
  }

  /**
   * Retrieves the current prompt version for a persona.
   *
   * Fetches the latest prompt text from the versioned prompt tables
   * (task_prompt_versions or judge_prompt_versions). Returns the most
   * recent version based on version_number.
   *
   * @param personaId - ID of the persona
   * @param promptType - Type of prompt to retrieve: 'task' or 'judge'
   * @returns Current prompt text, or null if no prompt exists
   *
   * @example
   * ```typescript
   * const taskPrompt = manager.getCurrentPrompt('persona-123', 'task');
   * const judgePrompt = manager.getCurrentPrompt('persona-123', 'judge');
   * ```
   */
  getCurrentPrompt(personaId: string, promptType: 'task' | 'judge'): string | null {
    const tableName = promptType === 'task' ? 'task_prompt_versions' : 'judge_prompt_versions';

    const result = this.db
      .prepare(
        `SELECT prompt_text FROM ${tableName} WHERE persona_id = ? ORDER BY version_number DESC LIMIT 1`
      )
      .get(personaId) as { prompt_text: string } | undefined;

    return result?.prompt_text || null;
  }

  /**
   * Retrieves all checkpoints for a session.
   *
   * Returns an array of all checkpoints for the given session, sorted by
   * iteration number in ascending order. Each checkpoint includes the
   * iteration data, metrics, and creation timestamp.
   *
   * @param sessionId - Unique session identifier to query
   * @returns Array of checkpoint objects sorted by iteration number (empty array if none found)
   *
   * @example
   * ```typescript
   * const checkpoints = manager.getCheckpoints('session-123');
   * checkpoints.forEach(cp => {
   *   console.log(`Iteration ${cp.iterationNumber}: F1=${cp.metricsSnapshot.f1_score}`);
   * });
   * ```
   */
  getCheckpoints(sessionId: string): Array<{
    iterationNumber: number;
    evaluatedResultCount: number;
    metricsSnapshot: MetricsResult;
    evaluatedResultIds: string[];
    currentPrompt: string;
    createdAt: string;
  }> {
    const checkpoints = this.db
      .prepare(
        'SELECT * FROM training_loop_checkpoints WHERE session_id = ? ORDER BY iteration_number ASC'
      )
      .all(sessionId) as Array<{
      iteration_number: number;
      evaluated_result_count: number;
      metrics_snapshot: string;
      evaluated_result_ids: string;
      current_prompt: string;
      created_at: string;
    }>;

    return checkpoints.map((checkpoint) => ({
      iterationNumber: checkpoint.iteration_number,
      evaluatedResultCount: checkpoint.evaluated_result_count,
      metricsSnapshot: JSON.parse(checkpoint.metrics_snapshot) as MetricsResult,
      evaluatedResultIds: JSON.parse(checkpoint.evaluated_result_ids) as string[],
      currentPrompt: checkpoint.current_prompt,
      createdAt: checkpoint.created_at,
    }));
  }

  /**
   * Deletes a training session and all its checkpoints.
   *
   * **WARNING:** This operation is irreversible. All session data including
   * checkpoints will be permanently deleted from the database.
   *
   * The deletion is performed within a transaction to ensure atomicity.
   * Checkpoints are deleted first due to foreign key constraints, then
   * the session state is removed.
   *
   * @param sessionId - Unique session identifier to delete
   * @returns true if session was deleted, false if session was not found
   *
   * @example
   * ```typescript
   * const deleted = manager.deleteSession('session-123');
   * if (deleted) {
   *   console.log('Session and all checkpoints deleted');
   * } else {
   *   console.log('Session not found');
   * }
   * ```
   */
  deleteSession(sessionId: string): boolean {
    const state = this.getSessionState(sessionId);
    if (!state) {
      return false;
    }

    const transaction = this.db.transaction(() => {
      // Delete checkpoints first (due to FK constraint)
      this.db.prepare('DELETE FROM training_loop_checkpoints WHERE session_id = ?').run(sessionId);
      // Delete session state
      this.db.prepare('DELETE FROM training_loop_state WHERE session_id = ?').run(sessionId);
    });

    transaction();
    return true;
  }
}
