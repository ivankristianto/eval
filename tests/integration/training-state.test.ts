/**
 * Integration tests for training state manager
 * Tests simulated crash recovery scenarios and state persistence
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
import type { CheckpointData, TrainingLoopState } from '../../src/types/training';

describe('Training State Manager - Integration Tests', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('Crash Recovery Scenarios', () => {
    it('should recover from crash during checkpoint save', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-crash-during-save';

      // Simulate partial checkpoint save by directly inserting incomplete data
      // This simulates a crash that occurs mid-transaction
      try {
        db.transaction(() => {
          // Start saving checkpoint
          db.prepare(
            `
            INSERT INTO training_loop_state (
              session_id, persona_id, current_iteration, total_iterations, status,
              judge_model_id, prompt_engineer_model_id, task_model_id,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          ).run(
            sessionId,
            persona.id,
            1,
            5,
            'in_progress',
            persona.judge_model_id,
            persona.prompt_engineer_model_id,
            persona.task_model_id,
            new Date().toISOString(),
            new Date().toISOString()
          );

          // Simulate crash before checkpoint is saved
          throw new Error('Simulated crash');
        })();
      } catch {
        // Transaction rolled back
      }

      // Verify nothing was saved (transaction rolled back)
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId);
      expect(state).toBeUndefined();

      // Now save checkpoint properly
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

      // Verify checkpoint was saved successfully after recovery
      const resumed = manager.resume(sessionId);
      expect(resumed).toBeDefined();
      expect(resumed?.iterationNumber).toBe(1);
    });

    it('should recover from crash after checkpoint save', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-crash-after-save';

      // Save checkpoint
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 2,
        evaluatedResultCount: 15,
        metricsSnapshot: {
          f1_score: 0.8,
          precision: 0.85,
          recall: 0.75,
          accuracy: 0.8,
          cohens_kappa: 0.7,
        },
        evaluatedResultIds: ['id1', 'id2', 'id3'],
        currentPrompt: 'Checkpoint before crash',
      });

      // Simulate process termination by creating new manager instance
      // (simulates restart after crash)
      const managerAfterCrash = new TrainingStateManager(db);

      // Should be able to resume from saved checkpoint
      const resumed = managerAfterCrash.resume(sessionId);
      expect(resumed).toBeDefined();
      expect(resumed?.iterationNumber).toBe(2);
      expect(resumed?.evaluatedResultCount).toBe(15);
      expect(resumed?.currentPrompt).toBe('Checkpoint before crash');
    });

    it('should recover from crash during multi-iteration training', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-multi-iter-crash';

      // Save checkpoints for iterations 1-3
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
        evaluatedResultIds: ['iter1-id1'],
        currentPrompt: 'Iteration 1',
      });

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
        evaluatedResultIds: ['iter2-id1'],
        currentPrompt: 'Iteration 2',
      });

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
        evaluatedResultIds: ['iter3-id1'],
        currentPrompt: 'Iteration 3',
      });

      // Simulate crash during iteration 4 (before checkpoint saved)
      // New manager instance after restart
      const managerAfterCrash = new TrainingStateManager(db);

      // Should resume from iteration 3 (last successful checkpoint)
      const resumed = managerAfterCrash.resume(sessionId);
      expect(resumed?.iterationNumber).toBe(3);
      expect(resumed?.currentPrompt).toBe('Iteration 3');

      // Can continue training from iteration 4
      managerAfterCrash.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 4,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.82,
          precision: 0.87,
          recall: 0.77,
          accuracy: 0.82,
          cohens_kappa: 0.72,
        },
        evaluatedResultIds: ['iter4-id1'],
        currentPrompt: 'Iteration 4',
      });

      const resumedAfterContinue = managerAfterCrash.resume(sessionId);
      expect(resumedAfterContinue?.iterationNumber).toBe(4);
    });

    it('should handle crash during pause operation', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-crash-during-pause';

      // Save checkpoint first
      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 2,
        evaluatedResultCount: 20,
        metricsSnapshot: {
          f1_score: 0.75,
          precision: 0.8,
          recall: 0.7,
          accuracy: 0.75,
          cohens_kappa: 0.6,
        },
        evaluatedResultIds: ['id1'],
        currentPrompt: 'Before pause',
      });

      // Successfully pause
      manager.pause(sessionId, 'User requested');

      // Simulate crash and restart
      const managerAfterCrash = new TrainingStateManager(db);

      // Should still be able to resume from paused state
      const resumed = managerAfterCrash.resume(sessionId);
      expect(resumed).toBeDefined();
      expect(resumed?.currentPrompt).toBe('Before pause');

      // Verify state is still paused
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopState;
      expect(state.status).toBe('paused');
    });
  });

  describe('State Persistence Across Sessions', () => {
    it('should persist state across multiple manager instances', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const sessionId = 'session-multi-instance';
      const checkpoint: CheckpointData = {
        iterationNumber: 1,
        evaluatedResultCount: 25,
        metricsSnapshot: {
          f1_score: 0.85,
          precision: 0.9,
          recall: 0.8,
          accuracy: 0.85,
          cohens_kappa: 0.75,
        },
        evaluatedResultIds: ['id1', 'id2', 'id3'],
        currentPrompt: 'Persistent prompt',
      };

      // Instance 1: Save checkpoint
      const manager1 = new TrainingStateManager(db);
      manager1.saveCheckpoint(sessionId, persona.id, checkpoint);

      // Instance 2: Resume and verify
      const manager2 = new TrainingStateManager(db);
      const resumed = manager2.resume(sessionId);
      expect(resumed).toEqual(checkpoint);

      // Instance 3: Pause
      const manager3 = new TrainingStateManager(db);
      manager3.pause(sessionId, 'Testing persistence');

      // Verify still paused
      const state = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(sessionId) as TrainingLoopState;
      expect(state.status).toBe('paused');
    });

    it('should maintain checkpoint integrity across restarts', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const sessionId = 'session-integrity';

      // Save checkpoint with specific data
      const manager1 = new TrainingStateManager(db);
      manager1.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 3,
        evaluatedResultCount: 50,
        metricsSnapshot: {
          f1_score: 0.88,
          precision: 0.92,
          recall: 0.84,
          accuracy: 0.88,
          cohens_kappa: 0.8,
        },
        evaluatedResultIds: Array.from({ length: 50 }, (_, i) => `result-${i + 1}`),
        currentPrompt: 'Complex prompt with special chars: "quotes", \'apostrophes\', \nneeds\n',
      });

      // Verify integrity before restart
      expect(manager1.verifyCheckpointIntegrity(sessionId)).toBe(true);

      // Simulate restart with new manager
      const manager2 = new TrainingStateManager(db);

      // Verify integrity after restart
      expect(manager2.verifyCheckpointIntegrity(sessionId)).toBe(true);

      // Verify all data is intact
      const resumed = manager2.resume(sessionId);
      expect(resumed?.iterationNumber).toBe(3);
      expect(resumed?.evaluatedResultCount).toBe(50);
      expect(resumed?.evaluatedResultIds).toHaveLength(50);
      expect(resumed?.currentPrompt).toContain('special chars');
      expect(resumed?.metricsSnapshot.f1_score).toBe(0.88);
    });
  });

  describe('Concurrent Session Management', () => {
    it('should handle multiple concurrent training sessions', () => {
      const db = getTestDatabase();
      const persona1 = createTestPersona(db, { name: 'Persona 1' });
      const persona2 = createTestPersona(db, { name: 'Persona 2' });
      const manager = new TrainingStateManager(db);

      // Start two concurrent sessions
      manager.saveCheckpoint('session-1', persona1.id, {
        iterationNumber: 1,
        evaluatedResultCount: 10,
        metricsSnapshot: {
          f1_score: 0.7,
          precision: 0.75,
          recall: 0.65,
          accuracy: 0.7,
          cohens_kappa: 0.5,
        },
        evaluatedResultIds: ['s1-id1'],
        currentPrompt: 'Session 1 prompt',
      });

      manager.saveCheckpoint('session-2', persona2.id, {
        iterationNumber: 2,
        evaluatedResultCount: 20,
        metricsSnapshot: {
          f1_score: 0.8,
          precision: 0.85,
          recall: 0.75,
          accuracy: 0.8,
          cohens_kappa: 0.7,
        },
        evaluatedResultIds: ['s2-id1'],
        currentPrompt: 'Session 2 prompt',
      });

      // Verify both sessions can be resumed independently
      const session1Data = manager.resume('session-1');
      const session2Data = manager.resume('session-2');

      expect(session1Data?.iterationNumber).toBe(1);
      expect(session1Data?.currentPrompt).toBe('Session 1 prompt');

      expect(session2Data?.iterationNumber).toBe(2);
      expect(session2Data?.currentPrompt).toBe('Session 2 prompt');

      // Pause one session
      manager.pause('session-1', 'Pausing session 1');

      // Verify session 2 is still running
      const state2 = db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get('session-2') as TrainingLoopState;
      expect(state2.status).toBe('in_progress');
    });

    it('should isolate checkpoints between sessions', () => {
      const db = getTestDatabase();
      const persona1 = createTestPersona(db, { name: 'Persona A' });
      const persona2 = createTestPersona(db, { name: 'Persona B' });
      const manager = new TrainingStateManager(db);

      // Session 1: Save multiple checkpoints
      for (let i = 1; i <= 3; i++) {
        manager.saveCheckpoint('session-isolated-1', persona1.id, {
          iterationNumber: i,
          evaluatedResultCount: i * 10,
          metricsSnapshot: {
            f1_score: 0.7 + i * 0.05,
            precision: 0.75,
            recall: 0.65,
            accuracy: 0.7,
            cohens_kappa: 0.5,
          },
          evaluatedResultIds: [`s1-iter${i}`],
          currentPrompt: `Session 1 Iteration ${i}`,
        });
      }

      // Session 2: Save different checkpoints
      for (let i = 1; i <= 2; i++) {
        manager.saveCheckpoint('session-isolated-2', persona2.id, {
          iterationNumber: i,
          evaluatedResultCount: i * 5,
          metricsSnapshot: {
            f1_score: 0.8 + i * 0.02,
            precision: 0.85,
            recall: 0.75,
            accuracy: 0.8,
            cohens_kappa: 0.7,
          },
          evaluatedResultIds: [`s2-iter${i}`],
          currentPrompt: `Session 2 Iteration ${i}`,
        });
      }

      // Verify session 1 has latest checkpoint from iteration 3
      const session1 = manager.resume('session-isolated-1');
      expect(session1?.iterationNumber).toBe(3);

      // Verify session 2 has latest checkpoint from iteration 2
      const session2 = manager.resume('session-isolated-2');
      expect(session2?.iterationNumber).toBe(2);

      // Verify checkpoint counts
      const session1Checkpoints = db
        .prepare('SELECT COUNT(*) as count FROM training_loop_checkpoints WHERE session_id = ?')
        .get('session-isolated-1') as { count: number };
      expect(session1Checkpoints.count).toBe(3);

      const session2Checkpoints = db
        .prepare('SELECT COUNT(*) as count FROM training_loop_checkpoints WHERE session_id = ?')
        .get('session-isolated-2') as { count: number };
      expect(session2Checkpoints.count).toBe(2);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle rapid successive checkpoint updates', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-rapid-updates';

      // Rapidly save checkpoints for same iteration (simulating incremental progress)
      for (let i = 1; i <= 10; i++) {
        manager.saveCheckpoint(sessionId, persona.id, {
          iterationNumber: 1,
          evaluatedResultCount: i * 5,
          metricsSnapshot: {
            f1_score: 0.7,
            precision: 0.75,
            recall: 0.65,
            accuracy: 0.7,
            cohens_kappa: 0.5,
          },
          evaluatedResultIds: Array.from({ length: i }, (_, idx) => `id-${idx}`),
          currentPrompt: `Progress: ${i * 10}%`,
        });
      }

      // Should have latest state
      const resumed = manager.resume(sessionId);
      expect(resumed?.evaluatedResultCount).toBe(50);
      expect(resumed?.currentPrompt).toBe('Progress: 100%');

      // Should only have one checkpoint (updates, not inserts)
      const checkpoints = db
        .prepare('SELECT COUNT(*) as count FROM training_loop_checkpoints WHERE session_id = ?')
        .get(sessionId) as { count: number };
      expect(checkpoints.count).toBe(1);
    });

    it('should detect and handle corrupted state after recovery', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-corrupted';

      // Save valid checkpoint
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
        currentPrompt: 'Valid',
      });

      // Corrupt the checkpoint data (simulate disk corruption)
      db.prepare(
        'UPDATE training_loop_checkpoints SET metrics_snapshot = ? WHERE session_id = ?'
      ).run('CORRUPTED DATA NOT JSON', sessionId);

      // Integrity check should detect corruption
      expect(manager.verifyCheckpointIntegrity(sessionId)).toBe(false);

      // Resume should fail gracefully
      const resumed = manager.resume(sessionId);
      expect(resumed).toBeNull();
    });

    it('should handle empty result IDs array', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);
      const manager = new TrainingStateManager(db);

      const sessionId = 'session-empty-results';

      manager.saveCheckpoint(sessionId, persona.id, {
        iterationNumber: 1,
        evaluatedResultCount: 0,
        metricsSnapshot: { f1_score: 0, precision: 0, recall: 0, accuracy: 0, cohens_kappa: 0 },
        evaluatedResultIds: [],
        currentPrompt: 'No results yet',
      });

      const resumed = manager.resume(sessionId);
      expect(resumed?.evaluatedResultIds).toEqual([]);
      expect(manager.verifyCheckpointIntegrity(sessionId)).toBe(true);
    });
  });
});
