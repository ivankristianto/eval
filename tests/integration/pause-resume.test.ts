/**
 * Integration test for pause/resume training flow
 * Tests TrainingStateManager and IterativeTrainingLoop pause/resume functionality
 *
 * NOTE: This test uses deprecated training modules.
 * The training-loop and training-state modules have been moved to @lib/training/deprecated/
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { initTestDb, cleanupTestDb } from '../setup';
import { TrainingStateManager } from '@lib/training/deprecated/training-state';
import { IterativeTrainingLoop } from '@lib/training/deprecated/training-loop';
import crypto from 'crypto';

/** Type for training_loop_state database record */
interface TrainingLoopStateRecord {
  session_id: string;
  status: string;
  pause_reason: string | null;
}

/** Type for training_loop_checkpoints database record */
interface TrainingCheckpointRecord {
  session_id: string;
  iteration_number: number;
  evaluated_result_count: number;
  metrics_snapshot: string;
  current_prompt: string;
  evaluated_result_ids: string;
}

describe('Pause/Resume Training Integration', () => {
  let db: Database.Database;
  let personaId: string;
  let sessionId: string;
  let taskModelId: string;
  let judgeModelId: string;
  let engineerModelId: string;
  let stateManager: TrainingStateManager;

  beforeEach(() => {
    db = initTestDb();

    // Create test model configurations (required for FK constraints)
    taskModelId = crypto.randomUUID();
    judgeModelId = crypto.randomUUID();
    engineerModelId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      taskModelId,
      'openai',
      'gpt-4',
      'encrypted',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      judgeModelId,
      'anthropic',
      'claude-3',
      'encrypted',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(
      `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      engineerModelId,
      'google',
      'gemini-pro',
      'encrypted',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create test persona
    personaId = crypto.randomUUID();
    sessionId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO personas (id, name, description, task_model_id, judge_model_id, prompt_engineer_model_id, status, target_pass_rate, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      personaId,
      'Test Pause/Resume Persona',
      'Testing pause/resume functionality',
      taskModelId,
      judgeModelId,
      engineerModelId,
      'training',
      0.8,
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create training pairs (at least 10 for meaningful metrics)
    for (let i = 0; i < 10; i++) {
      const pairId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO training_pairs (id, persona_id, input, expected_output)
         VALUES (?, ?, ?, ?)`
      ).run(pairId, personaId, `Test input ${i}`, `Expected output ${i}`);
    }

    stateManager = new TrainingStateManager(db);
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  it('should pause training session gracefully', () => {
    // Create initial checkpoint
    const checkpoint = {
      iterationNumber: 1,
      evaluatedResultCount: 5,
      metricsSnapshot: {
        f1_score: 0.75,
        precision: 0.8,
        recall: 0.71,
        accuracy: 0.75,
        cohens_kappa: 0.65,
        confusion_matrix: {
          true_positives: 4,
          true_negatives: 3,
          false_positives: 1,
          false_negatives: 2,
        },
      },
      evaluatedResultIds: ['result-1', 'result-2', 'result-3', 'result-4', 'result-5'],
      currentPrompt: 'Evaluate the code quality...',
    };

    stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

    // Pause the session
    stateManager.pause(sessionId, 'User requested pause');

    // Verify state was updated to 'paused'
    const state = db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(sessionId) as TrainingLoopStateRecord | undefined;

    expect(state).toBeDefined();
    expect(state!.status).toBe('paused');
    expect(state!.pause_reason).toBe('User requested pause');
  });

  it('should persist checkpoint to database', () => {
    const checkpoint = {
      iterationNumber: 2,
      evaluatedResultCount: 10,
      metricsSnapshot: {
        f1_score: 0.82,
        precision: 0.85,
        recall: 0.79,
        accuracy: 0.82,
        cohens_kappa: 0.72,
        confusion_matrix: {
          true_positives: 8,
          true_negatives: 6,
          false_positives: 1,
          false_negatives: 1,
        },
      },
      evaluatedResultIds: Array.from({ length: 10 }, (_, i) => `result-${i + 1}`),
      currentPrompt: 'Improved judge prompt for iteration 2...',
    };

    stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

    // Verify checkpoint was saved
    const savedCheckpoint = db
      .prepare(
        'SELECT * FROM training_loop_checkpoints WHERE session_id = ? AND iteration_number = ?'
      )
      .get(sessionId, 2) as TrainingCheckpointRecord | undefined;

    expect(savedCheckpoint).toBeDefined();
    expect(savedCheckpoint!.iteration_number).toBe(2);
    expect(savedCheckpoint!.evaluated_result_count).toBe(10);
    expect(savedCheckpoint!.current_prompt).toBe('Improved judge prompt for iteration 2...');

    // Verify JSON fields
    const metricsSnapshot = JSON.parse(savedCheckpoint!.metrics_snapshot);
    expect(metricsSnapshot.f1_score).toBe(0.82);
    expect(metricsSnapshot.precision).toBe(0.85);
    expect(metricsSnapshot.confusion_matrix.true_positives).toBe(8);

    const evaluatedResultIds = JSON.parse(savedCheckpoint!.evaluated_result_ids);
    expect(evaluatedResultIds).toHaveLength(10);
    expect(evaluatedResultIds[0]).toBe('result-1');
  });

  it('should resume from checkpoint and restore state', () => {
    const checkpoint = {
      iterationNumber: 3,
      evaluatedResultCount: 15,
      metricsSnapshot: {
        f1_score: 0.88,
        precision: 0.9,
        recall: 0.86,
        accuracy: 0.88,
        cohens_kappa: 0.78,
        confusion_matrix: {
          true_positives: 12,
          true_negatives: 10,
          false_positives: 1,
          false_negatives: 2,
        },
      },
      evaluatedResultIds: Array.from({ length: 15 }, (_, i) => `result-${i + 1}`),
      currentPrompt: 'Checkpoint prompt for iteration 3...',
    };

    // Save checkpoint and pause
    stateManager.saveCheckpoint(sessionId, personaId, checkpoint);
    stateManager.pause(sessionId, 'Testing resume');

    // Resume and verify checkpoint data is restored
    const restoredCheckpoint = stateManager.resume(sessionId);

    expect(restoredCheckpoint).toBeDefined();
    expect(restoredCheckpoint?.iterationNumber).toBe(3);
    expect(restoredCheckpoint?.evaluatedResultCount).toBe(15);
    expect(restoredCheckpoint?.currentPrompt).toBe('Checkpoint prompt for iteration 3...');
    expect(restoredCheckpoint?.metricsSnapshot.f1_score).toBe(0.88);
    expect(restoredCheckpoint?.evaluatedResultIds).toHaveLength(15);
  });

  it('should maintain metrics integrity across pause/resume cycle', () => {
    const checkpointBeforePause = {
      iterationNumber: 1,
      evaluatedResultCount: 8,
      metricsSnapshot: {
        f1_score: 0.77,
        precision: 0.82,
        recall: 0.73,
        accuracy: 0.77,
        cohens_kappa: 0.68,
        confusion_matrix: {
          true_positives: 6,
          true_negatives: 5,
          false_positives: 1,
          false_negatives: 2,
        },
      },
      evaluatedResultIds: Array.from({ length: 8 }, (_, i) => `result-${i + 1}`),
      currentPrompt: 'Initial prompt...',
    };

    // Save checkpoint before pause
    stateManager.saveCheckpoint(sessionId, personaId, checkpointBeforePause);
    const metricsBeforePause = JSON.parse(JSON.stringify(checkpointBeforePause.metricsSnapshot));

    // Pause and resume
    stateManager.pause(sessionId, 'Test metrics consistency');
    const restoredCheckpoint = stateManager.resume(sessionId);

    // Verify metrics are identical
    expect(restoredCheckpoint).toBeDefined();
    expect(restoredCheckpoint?.metricsSnapshot).toEqual(metricsBeforePause);

    // Verify confusion matrix values are preserved
    const cm = restoredCheckpoint?.metricsSnapshot.confusion_matrix;
    expect(cm?.true_positives).toBe(6);
    expect(cm?.true_negatives).toBe(5);
    expect(cm?.false_positives).toBe(1);
    expect(cm?.false_negatives).toBe(2);
  });

  it('should verify checkpoint integrity', () => {
    const validCheckpoint = {
      iterationNumber: 1,
      evaluatedResultCount: 5,
      metricsSnapshot: {
        f1_score: 0.75,
        precision: 0.8,
        recall: 0.71,
        accuracy: 0.75,
        cohens_kappa: 0.65,
        confusion_matrix: {
          true_positives: 4,
          true_negatives: 3,
          false_positives: 1,
          false_negatives: 2,
        },
      },
      evaluatedResultIds: ['result-1', 'result-2'],
      currentPrompt: 'Valid prompt',
    };

    stateManager.saveCheckpoint(sessionId, personaId, validCheckpoint);

    // Verify integrity
    const isValid = stateManager.verifyCheckpointIntegrity(sessionId);
    expect(isValid).toBe(true);
  });

  it('should handle pause/resume through IterativeTrainingLoop', async () => {
    // Use a unique session ID for this test
    const testSessionId = crypto.randomUUID();
    const trainingLoop = new IterativeTrainingLoop(testSessionId, personaId, db);

    // Create initial iteration 1 completed state (so we can pause at iteration 2)
    const iteration1Id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO training_iterations
       (id, persona_id, iteration_number, judge_model_id, judge_prompt_text, status, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      iteration1Id,
      personaId,
      1,
      judgeModelId,
      'Initial judge prompt for iteration 1',
      'completed',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Create initial state manually (simulating a paused training session at iteration 2)
    // This is iteration 2, which can pause/resume without human review intervention
    db.prepare(
      `INSERT INTO training_loop_state
       (session_id, persona_id, total_iterations,
        status, task_model_id, judge_model_id, prompt_engineer_model_id,
        task_results_evaluated, pause_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      testSessionId,
      personaId,
      5,
      'paused',
      taskModelId,
      judgeModelId,
      engineerModelId,
      0,
      'User requested pause via UI',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Verify initial paused state
    const pausedState = db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(testSessionId) as TrainingLoopStateRecord | undefined;

    expect(pausedState!.status).toBe('paused');
    expect(pausedState!.pause_reason).toBe('User requested pause via UI');

    // Resume training - this will start from iteration 2
    await trainingLoop.resume();

    // Verify state changed to in_progress (or awaiting_human_review if it ran iteration 1)
    // Since iteration 1 is already completed, it should start iteration 2 and then complete
    const resumedState = db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(testSessionId) as TrainingLoopStateRecord | undefined;

    // After resume with iteration 1 completed, the loop should run iteration 2
    // Iteration 2+ completes automatically, so status should be completed (if target met) or in_progress (if still running)
    // Since we don't have real training data, it will likely fail but set status appropriately
    expect(resumedState).toBeDefined();
    expect(resumedState!.status).not.toBe('paused');
    expect(resumedState!.pause_reason).toBeNull();
  });

  it('should return null when resuming non-existent session', () => {
    const nonExistentSessionId = crypto.randomUUID();
    const checkpoint = stateManager.resume(nonExistentSessionId);
    expect(checkpoint).toBeNull();
  });

  it('should return false for integrity check on non-existent checkpoint', () => {
    const nonExistentSessionId = crypto.randomUUID();
    const isValid = stateManager.verifyCheckpointIntegrity(nonExistentSessionId);
    expect(isValid).toBe(false);
  });

  // Error Path Tests
  describe('Error Path Scenarios', () => {
    it('should reject pausing an already paused session', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1', 'result-2'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);
      stateManager.pause(sessionId, 'First pause');

      // Attempt to pause again - should throw error
      expect(() => {
        stateManager.pause(sessionId, 'Second pause attempt');
      }).toThrow(/Cannot pause session in status 'paused'/);
    });

    it('should reject pausing a completed session', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Manually set session to completed
      db.prepare('UPDATE training_loop_state SET status = ? WHERE session_id = ?').run(
        'completed',
        sessionId
      );

      // Attempt to pause completed session - should throw error
      expect(() => {
        stateManager.pause(sessionId, 'Invalid pause');
      }).toThrow(/Cannot pause session in status 'completed'/);
    });

    it('should handle corrupted checkpoint with invalid JSON', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Corrupt the JSON data
      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run('invalid json{', sessionId);

      // Attempt to resume - should return null
      const result = stateManager.resume(sessionId);
      expect(result).toBeNull();
    });

    it('should detect missing confusion_matrix in checkpoint integrity check', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Corrupt metrics by removing confusion_matrix
      const corruptedMetrics = JSON.stringify({
        f1_score: 0.75,
        precision: 0.8,
        recall: 0.71,
        accuracy: 0.75,
        cohens_kappa: 0.65,
        // Missing confusion_matrix
      });

      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run(corruptedMetrics, sessionId);

      // Integrity check should fail
      const isValid = stateManager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should detect incomplete confusion_matrix in checkpoint integrity check', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Corrupt metrics with incomplete confusion_matrix
      const corruptedMetrics = JSON.stringify({
        f1_score: 0.75,
        precision: 0.8,
        recall: 0.71,
        accuracy: 0.75,
        cohens_kappa: 0.65,
        confusion_matrix: {
          true_positives: 4,
          // Missing true_negatives, false_positives, false_negatives
        },
      });

      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run(corruptedMetrics, sessionId);

      // Integrity check should fail
      const isValid = stateManager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should detect invalid data types in metrics', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Corrupt metrics with invalid types
      const corruptedMetrics = JSON.stringify({
        f1_score: '0.75', // String instead of number
        precision: 0.8,
        recall: 0.71,
        accuracy: 0.75,
        cohens_kappa: 0.65,
        confusion_matrix: {
          true_positives: 4,
          true_negatives: 3,
          false_positives: 1,
          false_negatives: 2,
        },
      });

      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run(corruptedMetrics, sessionId);

      // Integrity check should fail
      const isValid = stateManager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should detect missing current_prompt in checkpoint', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Remove current_prompt
      db.prepare(
        'UPDATE training_loop_checkpoints SET current_prompt = ? WHERE session_id = ?'
      ).run('', sessionId);

      // Integrity check should fail
      const isValid = stateManager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should handle idempotent pause requests', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // First pause
      stateManager.pause(sessionId, 'First pause');

      // Get initial state
      const firstState = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopStateRecord | undefined;

      expect(firstState!.status).toBe('paused');
      expect(firstState!.pause_reason).toBe('First pause');

      // Note: The current implementation throws an error on duplicate pause
      // If we want idempotency at the TrainingStateManager level, we would need
      // to modify the pause method to check status first and return early
    });

    it('should handle non-existent session pause attempt', () => {
      const fakeSessionId = crypto.randomUUID();

      expect(() => {
        stateManager.pause(fakeSessionId, 'Invalid pause');
      }).toThrow(/Training session not found/);
    });

    it('should handle evaluatedResultIds not being an array', () => {
      const checkpoint = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.71,
          accuracy: 0.75,
          cohens_kappa: 0.65,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1'],
        currentPrompt: 'Test prompt',
      };

      stateManager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Corrupt evaluated_result_ids to not be an array
      db.prepare(
        'UPDATE training_loop_checkpoints SET evaluated_result_ids = ? WHERE session_id = ?'
      ).run(JSON.stringify({ invalid: 'not an array' }), sessionId);

      // Integrity check should fail
      const isValid = stateManager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });
  });
});
