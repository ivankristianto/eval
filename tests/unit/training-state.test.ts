/**
 * Unit tests for training state manager
 * Tests checkpoint save/resume, pause/resume, and state integrity
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestPersona,
} from '../setup';
import { TrainingStateManager } from '../../src/lib/training-state';
import type { CheckpointData } from '../../src/types/training';

describe('Training State Manager', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Checkpoint Management', () => {
    it('should save checkpoint with all required data', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

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
        },
        evaluatedResultIds: ['result-1', 'result-2', 'result-3'],
        currentPrompt: 'Initial judge prompt',
      };

      manager.saveCheckpoint(sessionId, persona.id, checkpoint);

      // Verify checkpoint was saved
      const resumed = manager.resume(sessionId);
      expect(resumed).toBeDefined();
      expect(resumed?.iterationNumber).toBe(1);
      expect(resumed?.evaluatedResultCount).toBe(10);
      expect(resumed?.currentPrompt).toBe('Initial judge prompt');
      expect(resumed?.evaluatedResultIds).toHaveLength(3);
    });

    it('should create training loop state when saving first checkpoint', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

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
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Test prompt',
      };

      manager.saveCheckpoint(sessionId, persona.id, checkpoint);

      // Verify training loop state was created
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId);
      expect(state).toBeDefined();
    });

    it('should update existing checkpoint for same iteration', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-789';

      // Save initial checkpoint
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Initial',
      });

      // Update with more results
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id1', 'id2', 'id3', 'id4'],
        currentPrompt: 'Initial',
      });

      const resumed = manager.resume(sessionId);
      expect(resumed?.evaluatedResultCount).toBe(10);
      expect(resumed?.evaluatedResultIds).toHaveLength(4);
    });

    it('should save multiple checkpoints for different iterations', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-multi';

      // Iteration 1
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt v1',
      });

      // Iteration 2
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 2,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id2'],
        currentPrompt: 'Prompt v2',
      });

      // Iteration 3
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 3,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.8,
          precision: 0.85,
          recall: 0.75,
          accuracy: 0.8,
          cohens_kappa: 0.7,
        },
        evaluatedResultIds: ['id3'],
        currentPrompt: 'Prompt v3',
      });

      // Should resume from latest (iteration 3)
      const resumed = manager.resume(sessionId);
      expect(resumed?.iterationNumber).toBe(3);
      expect(resumed?.currentPrompt).toBe('Prompt v3');
    });

    it('should save checkpoint atomically', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

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

      manager.saveCheckpoint(sessionId, persona.id, checkpoint);

      // Count checkpoints after
      const afterCount = db
        .prepare('SELECT COUNT(*) as count FROM training_loop_checkpoints')
        .get() as {
        count: number;
      };

      expect(afterCount.count).toBe(beforeCount.count + 1);
    });
  });

  describe('Pause and Resume', () => {
    it('should pause training session', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-pause';

      // Save checkpoint first
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 2,
        evaluatedResultCount: 15,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt',
      });

      manager.pause(sessionId, 'User requested pause');

      // Verify state is paused
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as any;
      expect(state.status).toBe('paused');
      expect(state.pause_reason).toBe('User requested pause');
    });

    it('should resume from paused state', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

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
        },
        evaluatedResultIds: ['id1', 'id2', 'id3'],
        currentPrompt: 'Resume test prompt',
      };

      manager.saveCheckpoint(sessionId, persona.id, checkpoint);
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
      const db = getTestDatabase();
      const manager = new TrainingStateManager(db);

      const resumed = manager.resume('non-existent-session');
      expect(resumed).toBeNull();
    });

    it('should resume from running state', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-running';

      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Prompt',
      });

      // Don't pause - just resume
      const resumed = manager.resume(sessionId);
      expect(resumed).toBeDefined();
    });
  });

  describe('Checkpoint Integrity', () => {
    it('should verify intact checkpoint', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-verify';

      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Test',
      });

      const isValid = manager.verifyCheckpointIntegrity(sessionId);
      expect(isValid).toBe(true);
    });

    it('should detect missing checkpoint', () => {
      const db = getTestDatabase();
      const manager = new TrainingStateManager(db);

      const isValid = manager.verifyCheckpointIntegrity('non-existent-session');
      expect(isValid).toBe(false);
    });

    it('should detect corrupted checkpoint data', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-corrupt';

      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
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

    it('should verify checkpoint has all required fields', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-fields';

      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
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
  });

  describe('Error Handling', () => {
    it('should throw error when saving checkpoint without persona', () => {
      const db = getTestDatabase();
      const manager = new TrainingStateManager(db);

      expect(() => {
        manager.saveCheckpoint('session-error', 'non-existent-persona', {
          iterationNumber: 1,
          evaluatedResultCount: 10,
          metricsSnapshot: {
            f1_score: 0.75,
            precision: 0.8,
            recall: 0.7,
            accuracy: 0.75,
            cohens_kappa: 0.6,
          },
          evaluatedResultIds: ['id1'],
          currentPrompt: 'Test',
        });
      }).toThrow();
    });

    it('should throw error when pausing non-existent session', () => {
      const db = getTestDatabase();
      const manager = new TrainingStateManager(db);

      expect(() => {
        manager.pause('non-existent-session', 'Testing');
      }).toThrow();
    });

    it('should handle concurrent checkpoint saves', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-concurrent';

      // Save two checkpoints rapidly
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 5,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'First',
      });

      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id1', 'id2'],
        currentPrompt: 'Second',
      });

      // Should have the latest checkpoint
      const resumed = manager.resume(sessionId);
      expect(resumed?.evaluatedResultCount).toBe(10);
      expect(resumed?.currentPrompt).toBe('Second');
    });
  });
});
