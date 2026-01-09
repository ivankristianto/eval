/**
 * Unit tests for TrainingSessionManager
 * Tests checkpoint save/resume, pause/resume, and state integrity
 *
 * This tests the NEW TrainingSessionManager that uses current Persona schema
 * replacing the deprecated TrainingStateManager in deprecated/training-state.ts
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestPersona,
} from '../../setup';
import { TrainingSessionManager } from '@lib/training/training-session-manager';
import { TrainingStateError } from '@lib/training/training-errors';
import type { CheckpointData, TrainingLoopState } from '@src-types/training';

describe('TrainingSessionManager', () => {
  let db: ReturnType<typeof getTestDatabase>;
  let manager: TrainingSessionManager;
  let personaId: string;

  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
    db = getTestDatabase();
    manager = new TrainingSessionManager(db);
    personaId = createTestPersona(db).id;
  });

  afterEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Checkpoint Management', () => {
    it('should save checkpoint with all required data', () => {
      const sessionId = 'session-123';
      const checkpoint: CheckpointData = {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['result-1', 'result-2', 'result-3'],
        currentPrompt: 'Initial judge prompt',
      };

      manager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Verify checkpoint was saved
      const resumed = manager.resume(sessionId);
      expect(resumed).toBeDefined();
      expect(resumed?.iterationNumber).toBe(1);
      expect(resumed?.evaluatedResultCount).toBe(10);
      expect(resumed?.currentPrompt).toBe('Initial judge prompt');
      expect(resumed?.evaluatedResultIds).toHaveLength(3);
    });

    it('should create training loop state when saving first checkpoint', () => {
      const sessionId = 'session-456';
      const checkpoint: CheckpointData = {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Test prompt',
      };

      manager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Verify training loop state was created
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopState;
      expect(state).toBeDefined();
      expect(state.session_id).toBe(sessionId);
      expect(state.persona_id).toBe(personaId);
      expect(state.status).toBe('in_progress');
      expect(state.current_iteration).toBe(1);
    });

    it('should update existing checkpoint for same iteration', () => {
      const sessionId = 'session-789';

      // Save initial checkpoint
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Initial',
      });

      // Update with more results
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2', 'id3', 'id4'],
        currentPrompt: 'Initial',
      });

      const resumed = manager.resume(sessionId);
      expect(resumed?.evaluatedResultCount).toBe(10);
      expect(resumed?.evaluatedResultIds).toHaveLength(4);
    });

    it('should save multiple checkpoints for different iterations', () => {
      const sessionId = 'session-multi';

      // Iteration 1
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt v1',
      });

      // Iteration 2
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 2,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id2'],
        currentPrompt: 'Prompt v2',
      });

      // Iteration 3
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 3,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.8,
          precision: 0.85,
          recall: 0.75,
          accuracy: 0.8,
          cohens_kappa: 0.7,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id3'],
        currentPrompt: 'Prompt v3',
      });

      // Should resume from latest (iteration 3)
      const resumed = manager.resume(sessionId);
      expect(resumed?.iterationNumber).toBe(3);
      expect(resumed?.currentPrompt).toBe('Prompt v3');

      // Should have all checkpoints
      const checkpoints = manager.getCheckpoints(sessionId);
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].iterationNumber).toBe(1);
      expect(checkpoints[1].iterationNumber).toBe(2);
      expect(checkpoints[2].iterationNumber).toBe(3);
    });

    it('should save checkpoint atomically', () => {
      const sessionId = 'session-atomic';
      const checkpoint: CheckpointData = {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Test',
      };

      // Count checkpoints before
      const beforeCount = db
        .prepare('SELECT COUNT(*) as count FROM training_loop_checkpoints')
        .get() as {
        count: number;
      };

      manager.saveCheckpoint(sessionId, personaId, checkpoint);

      // Count checkpoints after
      const afterCount = db
        .prepare('SELECT COUNT(*) as count FROM training_loop_checkpoints')
        .get() as {
        count: number;
      };

      expect(afterCount.count).toBe(beforeCount.count + 1);
    });

    it('should throw error when saving checkpoint without persona', () => {
      const sessionId = 'session-error';
      const checkpoint: CheckpointData = {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      };

      expect(() => {
        manager.saveCheckpoint(sessionId, 'non-existent-persona', checkpoint);
      }).toThrow(TrainingStateError);
      expect(() => {
        manager.saveCheckpoint(sessionId, 'non-existent-persona', checkpoint);
      }).toThrow('Persona not found');
    });
  });

  describe('Pause and Resume', () => {
    it('should pause training session', () => {
      const sessionId = 'session-pause';

      // Save checkpoint first
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 2,
        evaluatedResultCount: 15,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt',
      });

      manager.pause(sessionId, 'User requested pause');

      // Verify state is paused
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopState;
      expect(state.status).toBe('paused');
      expect(state.pause_reason).toBe('User requested pause');
    });

    it('should resume from paused state', () => {
      const sessionId = 'session-resume';
      const checkpoint: CheckpointData = {
        iterationNumber: 2,
        evaluatedResultCount: 20,
        metricsSnapshot: {
          f1_score: 0.8,
          precision: 0.85,
          recall: 0.75,
          accuracy: 0.8,
          cohens_kappa: 0.7,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2', 'id3'],
        currentPrompt: 'Resume test prompt',
      };

      manager.saveCheckpoint(sessionId, personaId, checkpoint);
      manager.pause(sessionId, 'Testing');

      // Resume
      const resumed = manager.resume(sessionId);

      expect(resumed).toBeDefined();
      expect(resumed?.iterationNumber).toBe(2);
      expect(resumed?.evaluatedResultCount).toBe(20);
      expect(resumed?.currentPrompt).toBe('Resume test prompt');
      expect(resumed?.evaluatedResultIds).toEqual(['id1', 'id2', 'id3']);
    });

    it('should return null when resuming non-existent session', () => {
      const resumed = manager.resume('non-existent-session');
      expect(resumed).toBeNull();
    });

    it('should return null when session exists but has no checkpoints', () => {
      const sessionId = 'session-no-checkpoints';

      // Create a session without saving any checkpoints
      manager.createSession(sessionId, personaId, 3);

      const resumed = manager.resume(sessionId);
      expect(resumed).toBeNull();
    });

    it('should resume from running state', () => {
      const sessionId = 'session-running';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt',
      });

      // Don't pause - just resume
      const resumed = manager.resume(sessionId);
      expect(resumed).toBeDefined();
    });

    it('should throw error when pausing non-existent session', () => {
      expect(() => {
        manager.pause('non-existent-session', 'Testing');
      }).toThrow(TrainingStateError);
      expect(() => {
        manager.pause('non-existent-session', 'Testing');
      }).toThrow('Training session not found');
    });

    it('should throw error when pausing session not in progress', () => {
      const sessionId = 'session-completed';

      // Create session in completed state
      manager.createSession(sessionId, personaId, 3);
      manager.updateSessionStatus(sessionId, 'completed');

      expect(() => {
        manager.pause(sessionId, 'Testing');
      }).toThrow(TrainingStateError);
      expect(() => {
        manager.pause(sessionId, 'Testing');
      }).toThrow("Cannot pause session in status 'completed'");
    });
  });

  describe('Checkpoint Integrity', () => {
    it('should verify intact checkpoint', () => {
      const sessionId = 'session-verify';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Test',
      });

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(true);
    });

    it('should detect missing checkpoint', () => {
      const isValid = manager.verifyCheckpointIntegrity('non-existent-session');
      expect(isValid).toBe(false);
    });

    it('should detect corrupted checkpoint data', () => {
      const sessionId = 'session-corrupt';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Corrupt the checkpoint by updating metrics_snapshot to invalid JSON
      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run('INVALID JSON', sessionId);

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should return null when resume encounters corrupted JSON', () => {
      const sessionId = 'session-json-error';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Corrupt the metrics_snapshot JSON
      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run('INVALID JSON', sessionId);

      const resumed = manager.resume(sessionId);
      expect(resumed).toBeNull();
    });

    it('should verify checkpoint has all required fields', () => {
      const sessionId = 'session-fields';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Corrupt metrics_snapshot by removing required f1_score field
      const corruptedMetrics = JSON.stringify({ precision: 0.8, recall: 0.7 });
      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run(corruptedMetrics, sessionId);

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should detect missing current_prompt field', () => {
      const sessionId = 'session-missing-prompt';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Set current_prompt to empty string (falsy but not null due to DB constraint)
      db.prepare(
        'UPDATE training_loop_checkpoints SET current_prompt = ? WHERE session_id = ?'
      ).run('', sessionId);

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should detect invalid confusion_matrix structure', () => {
      const sessionId = 'session-invalid-matrix';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Corrupt confusion_matrix by removing a required field
      const corruptedMetrics = JSON.stringify({
        f1_score: 0.75,
        precision: 0.8,
        recall: 0.7,
        accuracy: 0.75,
        cohens_kappa: 0.6,
        confusion_matrix: {
          true_positives: 4,
          true_negatives: 3,
          false_positives: 1,
          // Missing false_negatives
        },
      });
      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run(corruptedMetrics, sessionId);

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });

    it('should detect evaluated_result_ids that is not an array', () => {
      const sessionId = 'session-invalid-ids';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Set evaluated_result_ids to a non-array value
      db.prepare(
        'UPDATE training_loop_checkpoints SET evaluated_result_ids = ? WHERE session_id = ?'
      ).run(JSON.stringify('not-an-array'), sessionId);

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should create new session', () => {
      const sessionId = 'session-create';

      manager.createSession(sessionId, personaId, 5);

      const state = manager.getSessionState(sessionId);
      expect(state).toBeDefined();
      expect(state?.session_id).toBe(sessionId);
      expect(state?.persona_id).toBe(personaId);
      expect(state?.total_iterations).toBe(5);
      expect(state?.status).toBe('pending');
      expect(state?.current_iteration).toBe(1);
    });

    it('should use default max iterations when not provided', () => {
      const sessionId = 'session-default';

      manager.createSession(sessionId, personaId);

      const state = manager.getSessionState(sessionId);
      expect(state?.total_iterations).toBe(5); // DEFAULT_MAX_ITERATIONS
    });

    it('should throw error when creating session without persona', () => {
      const sessionId = 'session-error';

      expect(() => {
        manager.createSession(sessionId, 'non-existent-persona');
      }).toThrow(TrainingStateError);
      expect(() => {
        manager.createSession(sessionId, 'non-existent-persona');
      }).toThrow('Persona not found');
    });

    it('should get session state', () => {
      const sessionId = 'session-get';

      manager.createSession(sessionId, personaId, 3);

      const state = manager.getSessionState(sessionId);
      expect(state).toBeDefined();
      expect(state?.session_id).toBe(sessionId);
    });

    it('should return null when getting non-existent session', () => {
      const state = manager.getSessionState('non-existent');
      expect(state).toBeNull();
    });

    it('should update session status', () => {
      const sessionId = 'session-update';

      manager.createSession(sessionId, personaId, 3);
      manager.updateSessionStatus(sessionId, 'in_progress');

      const state = manager.getSessionState(sessionId);
      expect(state?.status).toBe('in_progress');
    });

    it('should update session status with error message', () => {
      const sessionId = 'session-error';

      manager.createSession(sessionId, personaId, 3);
      manager.updateSessionStatus(sessionId, 'failed', 'API timeout');

      const state = manager.getSessionState(sessionId);
      expect(state?.status).toBe('failed');
      expect(state?.error_message).toBe('API timeout');
    });

    it('should throw error when updating non-existent session', () => {
      expect(() => {
        manager.updateSessionStatus('non-existent', 'in_progress');
      }).toThrow(TrainingStateError);
      expect(() => {
        manager.updateSessionStatus('non-existent', 'in_progress');
      }).toThrow('Training session not found');
    });

    it('should delete session and checkpoints', () => {
      const sessionId = 'session-delete';

      // Create session with checkpoints
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Verify session exists
      expect(manager.getSessionState(sessionId)).toBeDefined();

      // Delete session
      const deleted = manager.deleteSession(sessionId);
      expect(deleted).toBe(true);

      // Verify session is gone
      expect(manager.getSessionState(sessionId)).toBeNull();
      expect(manager.resume(sessionId)).toBeNull();
    });

    it('should return false when deleting non-existent session', () => {
      const deleted = manager.deleteSession('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Prompt Version Management', () => {
    it('should get current task prompt', () => {
      const promptText = 'This is the task prompt';
      const version = 1;

      db.prepare(
        'INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        personaId,
        version,
        promptText,
        'Initial prompt',
        'human',
        new Date().toISOString()
      );

      const prompt = manager.getCurrentPrompt(personaId, 'task');
      expect(prompt).toBe(promptText);
    });

    it('should get current judge prompt', () => {
      const promptText = 'This is the judge prompt';
      const version = 1;

      db.prepare(
        'INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        personaId,
        version,
        promptText,
        'Initial prompt',
        'human',
        new Date().toISOString()
      );

      const prompt = manager.getCurrentPrompt(personaId, 'judge');
      expect(prompt).toBe(promptText);
    });

    it('should return null when no prompt exists', () => {
      const prompt = manager.getCurrentPrompt(personaId, 'task');
      expect(prompt).toBeNull();
    });

    it('should get latest prompt version', () => {
      // Create multiple versions
      db.prepare(
        'INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        personaId,
        1,
        'Version 1',
        'Initial',
        'human',
        new Date().toISOString()
      );

      db.prepare(
        'INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        personaId,
        2,
        'Version 2',
        'Improved',
        'ai',
        new Date().toISOString()
      );

      const prompt = manager.getCurrentPrompt(personaId, 'task');
      expect(prompt).toBe('Version 2');
    });
  });

  describe('Get Checkpoints', () => {
    it('should get all checkpoints for a session', () => {
      const sessionId = 'session-get-all';

      // Create multiple checkpoints
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt v1',
      });

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 2,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id2'],
        currentPrompt: 'Prompt v2',
      });

      const checkpoints = manager.getCheckpoints(sessionId);
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].iterationNumber).toBe(1);
      expect(checkpoints[1].iterationNumber).toBe(2);
      expect(checkpoints[0].currentPrompt).toBe('Prompt v1');
      expect(checkpoints[1].currentPrompt).toBe('Prompt v2');
    });

    it('should return empty array when no checkpoints exist', () => {
      const checkpoints = manager.getCheckpoints('non-existent');
      expect(checkpoints).toHaveLength(0);
    });

    it('should include created_at timestamp in checkpoints', () => {
      const sessionId = 'session-timestamp';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      const checkpoints = manager.getCheckpoints(sessionId);
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].createdAt).toBeDefined();
      expect(checkpoints[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent checkpoint saves', () => {
      const sessionId = 'session-concurrent';

      // Save two checkpoints rapidly
      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'First',
      });

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Second',
      });

      // Should have the latest checkpoint
      const resumed = manager.resume(sessionId);
      expect(resumed?.evaluatedResultCount).toBe(10);
      expect(resumed?.currentPrompt).toBe('Second');
    });

    it('should handle missing persona gracefully', () => {
      const sessionId = 'session-missing-persona';
      const checkpoint: CheckpointData = {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      };

      expect(() => {
        manager.saveCheckpoint(sessionId, 'missing-persona', checkpoint);
      }).toThrow(TrainingStateError);
    });
  });

  describe('Schema Alignment', () => {
    it('should use current schema fields (not deprecated ones)', () => {
      const sessionId = 'session-schema';

      manager.saveCheckpoint(sessionId, personaId, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
          confusion_matrix: {
            true_positives: 4,
            true_negatives: 3,
            false_positives: 1,
            false_negatives: 2,
          },
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Test',
      });

      // Verify that the state was created with current schema fields
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopState;

      // Should have model IDs from current schema
      expect(state.task_model_id).toBeDefined();
      expect(state.judge_model_id).toBeDefined();
      expect(state.prompt_engineer_model_id).toBeDefined();

      // Should not have deprecated fields
      // (max_iterations is now stored in training_loop_state, not personas)
      expect(state.total_iterations).toBeDefined();
    });

    it('should work with versioned prompt tables', () => {
      // Create versioned prompts
      db.prepare(
        'INSERT INTO task_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        personaId,
        1,
        'Task prompt v1',
        'Initial prompt',
        'human',
        new Date().toISOString()
      );

      db.prepare(
        'INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        personaId,
        1,
        'Judge prompt v1',
        'Initial prompt',
        'human',
        new Date().toISOString()
      );

      // Verify getCurrentPrompt works
      const taskPrompt = manager.getCurrentPrompt(personaId, 'task');
      const judgePrompt = manager.getCurrentPrompt(personaId, 'judge');

      expect(taskPrompt).toBe('Task prompt v1');
      expect(judgePrompt).toBe('Judge prompt v1');
    });
  });
});
