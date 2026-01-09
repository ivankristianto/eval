/**
 * Training State Manager
 * Manages checkpoint save/resume, pause/resume, and state integrity for training sessions
 */

import Database from 'better-sqlite3';
import { getDatabase } from '@lib/db';
import {
  getTrainingLoopState,
  createTrainingLoopState,
  updateTrainingLoopState,
  createCheckpoint,
  getLatestCheckpoint,
} from '@lib/db/persona-db';
import type { CheckpointData } from '@src-types/training';

/**
 * TrainingStateManager class
 * Provides ACID-compliant checkpoint management and session state control
 */
export class TrainingStateManager {
  private db: Database.Database;

  /**
   * Initializes a new training state manager.
   * @param db - Optional database instance
   */
  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Save checkpoint with ACID transaction guarantee
   * Creates training loop state if it doesn't exist
   *
   * @param sessionId - Unique session identifier
   * @param personaId - Persona being trained
   * @param checkpoint - Checkpoint data to save
   */
  saveCheckpoint(sessionId: string, personaId: string, checkpoint: CheckpointData): void {
    const transaction = this.db.transaction(() => {
      // Check if training loop state exists
      let state = getTrainingLoopState(sessionId, this.db);

      if (!state) {
        // Get persona to get model IDs
        const persona = this.db
          .prepare(
            'SELECT task_model_id, judge_model_id, prompt_engineer_model_id, max_iterations FROM personas WHERE id = ?'
          )
          .get(personaId) as
          | {
              task_model_id: string;
              judge_model_id: string;
              prompt_engineer_model_id: string;
              max_iterations: number;
            }
          | undefined;

        if (!persona) {
          throw new Error(`Persona not found: ${personaId}`);
        }

        // Create training loop state
        createTrainingLoopState(
          sessionId,
          personaId,
          persona.max_iterations,
          persona.judge_model_id,
          persona.prompt_engineer_model_id,
          persona.task_model_id,
          this.db
        );
      }

      // Update training loop state with current iteration
      updateTrainingLoopState(
        sessionId,
        {
          current_iteration: checkpoint.iterationNumber,
          status: 'in_progress',
          task_results_evaluated: checkpoint.evaluatedResultCount,
        },
        this.db
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
        createCheckpoint(
          sessionId,
          checkpoint.iterationNumber,
          checkpoint.evaluatedResultCount,
          JSON.stringify(checkpoint.metricsSnapshot),
          JSON.stringify(checkpoint.evaluatedResultIds),
          checkpoint.currentPrompt,
          this.db
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
   * @throws Error if session not found or not in pausable state
   */
  pause(sessionId: string, reason: string): void {
    const state = getTrainingLoopState(sessionId, this.db);
    if (!state) {
      throw new Error(`Training session not found: ${sessionId}`);
    }

    // Validate that session can be paused
    if (state.status !== 'in_progress') {
      throw new Error(
        `Cannot pause session in status '${state.status}'. Only 'in_progress' sessions can be paused.`
      );
    }

    updateTrainingLoopState(
      sessionId,
      {
        status: 'paused',
        pause_reason: reason,
      },
      this.db
    );
  }

  /**
   * Resume training session from latest checkpoint
   * Returns checkpoint data to continue training
   *
   * @param sessionId - Session to resume
   * @returns CheckpointData or null if no checkpoint exists
   */
  resume(sessionId: string): CheckpointData | null {
    const state = getTrainingLoopState(sessionId, this.db);
    if (!state) {
      return null;
    }

    const checkpoint = getLatestCheckpoint(sessionId, this.db);
    if (!checkpoint) {
      return null;
    }

    // Parse checkpoint data
    try {
      const metricsSnapshot = JSON.parse(checkpoint.metrics_snapshot);
      const evaluatedResultIds = JSON.parse(checkpoint.evaluated_result_ids);

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
      const checkpoint = getLatestCheckpoint(sessionId, this.db);
      if (!checkpoint) {
        return false;
      }

      // Verify required fields exist
      if (!checkpoint.current_prompt) {
        return false;
      }

      // Verify JSON fields can be parsed
      const metricsSnapshot = JSON.parse(checkpoint.metrics_snapshot);
      const evaluatedResultIds = JSON.parse(checkpoint.evaluated_result_ids);

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
}
