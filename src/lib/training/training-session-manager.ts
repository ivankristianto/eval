/**
 * Training Session Manager
 * Manages checkpoint save/resume, pause/resume, and state integrity for training sessions
 *
 * This replaces the deprecated TrainingStateManager class (moved to deprecated/training-state.ts)
 * with current Persona schema alignment.
 */

import type { Database } from 'better-sqlite3';
import type { CheckpointData, MetricsResult, TrainingLoopState } from '@src-types/training';
import { TrainingStateError } from './training-errors';

/**
 * Default maximum iterations for training loop (no longer in personas table)
 */
const DEFAULT_MAX_ITERATIONS = 5;

/**
 * TrainingSessionManager class
 * Provides ACID-compliant checkpoint management and session state control
 * Uses current Persona schema fields and versioned prompt tables
 */
export class TrainingSessionManager {
  private readonly db: Database;

  /**
   * Initializes a new training session manager.
   * @param db - Database instance (required)
   */
  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Save checkpoint with ACID transaction guarantee
   * Creates training loop state if it doesn't exist
   *
   * @param sessionId - Unique session identifier
   * @param personaId - Persona being trained
   * @param checkpoint - Checkpoint data to save
   * @throws {TrainingStateError} If persona not found or transaction fails
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
   * Pause training session
   * Updates state to 'paused' with reason
   *
   * @param sessionId - Session to pause
   * @param reason - Reason for pausing
   * @throws {TrainingStateError} If session not found or not in pausable state
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
   * Resume training session from latest checkpoint
   * Returns checkpoint data to continue training
   *
   * @param sessionId - Session to resume
   * @returns CheckpointData or null if no checkpoint exists
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
   * Verify checkpoint integrity
   * Checks that checkpoint data is complete and valid
   *
   * @param sessionId - Session to verify
   * @returns true if checkpoint is intact, false otherwise
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
   * Get training session state
   *
   * @param sessionId - Session to query
   * @returns TrainingLoopState or null if not found
   */
  getSessionState(sessionId: string): TrainingLoopState | null {
    const state = this.db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as TrainingLoopState | undefined;

    return state || null;
  }

  /**
   * Create a new training session state
   *
   * @param sessionId - Unique session identifier
   * @param personaId - Persona being trained
   * @param maxIterations - Maximum iterations (defaults to DEFAULT_MAX_ITERATIONS)
   * @throws {TrainingStateError} If persona not found
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
   * Update training session status
   *
   * @param sessionId - Session to update
   * @param status - New status
   * @param errorMessage - Optional error message for failed status
   * @throws {TrainingStateError} If session not found
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
   * Get the current prompt version for a persona
   * Uses versioned prompt tables (task_prompt_versions or judge_prompt_versions)
   *
   * @param personaId - Persona ID
   * @param promptType - Type of prompt ('task' or 'judge')
   * @returns Current prompt text or null if not found
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
   * Get all checkpoints for a session
   *
   * @param sessionId - Session to query
   * @returns Array of checkpoints sorted by iteration number
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
   * Delete a training session and all its checkpoints
   * Use with caution - this is irreversible
   *
   * @param sessionId - Session to delete
   * @returns true if session was deleted, false if not found
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
