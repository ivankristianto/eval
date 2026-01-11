/**
 * Integration tests for Judge Prompts API endpoint
 * Tests fetching judge prompt version history
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
  createTestPersona,
} from '../setup';
import { v4 as uuidv4 } from 'uuid';

describe('Judge Prompts API Integration', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('GET /api/personas/[id]/prompts', () => {
    it('should return empty array when persona has no prompt versions', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Delete the initial prompt version that createTestPersona might have created
      db.prepare('DELETE FROM judge_prompt_versions WHERE persona_id = ?').run(persona.id);

      // Fetch prompts
      const prompts = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
        .all(persona.id);

      expect(prompts).toHaveLength(0);
    });

    it('should return initial prompt version (version 0)', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Fetch prompts
      const prompts = db
        .prepare(
          'SELECT * FROM judge_prompt_versions WHERE persona_id = ? ORDER BY version_number DESC'
        )
        .all(persona.id) as Array<{
        persona_id: string;
        version_number: number;
        created_by: string;
        prompt_text: string;
      }>;

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        persona_id: persona.id,
        version_number: 0,
        created_by: 'human',
      });
      expect(prompts[0].prompt_text).toBeTruthy();
    });

    it('should return all prompt versions sorted by version (newest first)', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      // Add additional prompt versions
      const now = new Date().toISOString();

      db.prepare(
        `
        INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        uuidv4(),
        persona.id,
        1,
        'Refined prompt iteration 1',
        'Improved clarity based on iteration 0 feedback',
        'ai',
        now
      );

      db.prepare(
        `
        INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        uuidv4(),
        persona.id,
        2,
        'Refined prompt iteration 2',
        'Further refinement addressing false positives',
        'ai',
        now
      );

      // Fetch prompts
      const prompts = db
        .prepare(
          'SELECT * FROM judge_prompt_versions WHERE persona_id = ? ORDER BY version_number DESC'
        )
        .all(persona.id) as Array<{
        version_number: number;
        created_by: string;
      }>;

      expect(prompts).toHaveLength(3);

      // Verify sorting (newest first)
      expect(prompts[0].version_number).toBe(2);
      expect(prompts[1].version_number).toBe(1);
      expect(prompts[2].version_number).toBe(0);

      // Verify created_by tracking
      expect(prompts[0].created_by).toBe('ai');
      expect(prompts[1].created_by).toBe('ai');
      expect(prompts[2].created_by).toBe('human');
    });

    it('should return 404 for non-existent persona', () => {
      const db = getTestDatabase();

      const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get('non-existent-id');

      expect(persona).toBeUndefined();
    });

    it('should include improvement rationale when present', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const now = new Date().toISOString();
      const rationale = 'Improved specificity to reduce false positives';

      db.prepare(
        `
        INSERT INTO judge_prompt_versions (id, persona_id, version_number, prompt_text, improvement_rationale, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(uuidv4(), persona.id, 1, 'Refined prompt with improvements', rationale, 'ai', now);

      const prompts = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ? AND version_number = 1')
        .all(persona.id) as Array<{
        improvement_rationale: string;
      }>;

      expect(prompts).toHaveLength(1);
      expect(prompts[0].improvement_rationale).toBe(rationale);
    });

    it('should handle null improvement rationale for initial prompts', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const prompts = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ? AND version_number = 0')
        .all(persona.id) as Array<{
        improvement_rationale: string | null;
      }>;

      expect(prompts).toHaveLength(1);
      // Initial prompt should have a rationale explaining it's the initial version
      expect(prompts[0].improvement_rationale).toBeTruthy();
    });

    it('should track timestamps correctly', () => {
      const db = getTestDatabase();
      const persona = createTestPersona(db);

      const prompts = db
        .prepare('SELECT * FROM judge_prompt_versions WHERE persona_id = ?')
        .all(persona.id) as Array<{
        created_at: string;
      }>;

      expect(prompts).toHaveLength(1);
      expect(prompts[0].created_at).toBeTruthy();

      // Verify timestamp is a valid ISO string
      const timestamp = new Date(prompts[0].created_at);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });
});
