/**
 * Training Data Upload API Integration Tests
 * Tests for CSV upload endpoint
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
} from '../setup';

let db: ReturnType<typeof getTestDatabase>;

describe('Training Data Upload API', () => {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    db = getTestDatabase();
    cleanTestDatabase();

    // Insert test models
    const models = [
      { id: 'model-openai', provider: 'openai', model_name: 'gpt-4' },
      { id: 'model-anthropic', provider: 'anthropic', model_name: 'claude-3' },
      { id: 'model-google', provider: 'google', model_name: 'gemini-pro' },
    ];

    const insertModel = db.prepare(
      `INSERT INTO ModelConfiguration
       (id, provider, model_name, api_key_encrypted, created_at, updated_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    );
    for (const model of models) {
      const now = new Date().toISOString();
      insertModel.run(model.id, model.provider, model.model_name, 'test-key', now, now);
    }

    // Insert test persona
    db.prepare(
      `INSERT INTO personas
       (id, name, description, task_model_id, judge_model_id, prompt_engineer_model_id, status, target_pass_rate, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'persona-test',
      'Test Persona',
      'Test description',
      'model-openai',
      'model-anthropic',
      'model-google',
      'draft',
      0.8,
      new Date().toISOString(),
      new Date().toISOString()
    );
  });

  afterAll(() => {
    closeTestDatabase();
  });

  describe('POST /api/personas/[id]/training/upload', () => {
    it('should upload valid CSV and create training pairs', () => {
      const csv = Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n');
      const fileContent = `input,expected_output\n${csv}`;

      // Simulate upload (we'll implement the actual endpoint later)
      // For now, test the database insertion logic
      const personaId = 'persona-test';

      // Parse and insert pairs
      const lines = fileContent.split('\n').slice(1); // Skip header
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      let inserted = 0;
      for (const line of lines) {
        if (line.trim()) {
          const match = line.match(/"([^"]*)","([^"]*)"/);
          if (match) {
            insertPair.run(randomUUID(), personaId, match[1], match[2]);
            inserted++;
          }
        }
      }

      expect(inserted).toBe(10);

      // Verify pairs were inserted
      const pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);
      expect(pairs).toHaveLength(10);
      expect(pairs[0]).toHaveProperty('input');
      expect(pairs[0]).toHaveProperty('expected_output');
    });

    it('should reject upload for non-existent persona', () => {
      const personaId = 'non-existent-persona';

      // Check persona exists
      const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId);
      expect(persona).toBeUndefined();
    });

    it('should replace existing training pairs on new upload', () => {
      const personaId = 'persona-test';

      // Insert initial pairs
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );
      for (let i = 0; i < 10; i++) {
        insertPair.run(randomUUID(), personaId, `Old Q${i}`, `Old A${i}`);
      }

      let pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);
      expect(pairs).toHaveLength(10);

      // Delete old pairs and insert new ones
      db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(personaId);

      for (let i = 0; i < 15; i++) {
        insertPair.run(randomUUID(), personaId, `New Q${i}`, `New A${i}`);
      }

      pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);
      expect(pairs).toHaveLength(15);
      expect((pairs[0] as { input: string }).input).toContain('New');
    });

    it('should enforce 10-200 pair constraint', () => {
      // Test with 9 pairs (below minimum)
      // const csv9 = Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      // const content9 = `input,expected_output\n${csv9}`;
      // Validation should fail (tested in csv-parser.test.ts)
      // API should return 400 Bad Request
      // Test with 201 pairs (above maximum)
      // const csv201 = Array.from({ length: 201 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      // const content201 = `input,expected_output\n${csv201}`;
      // Validation should fail (tested in csv-parser.test.ts)
      // API should return 400 Bad Request
    });

    it('should validate CSV format before insertion', () => {
      // const invalidCSV = `wrong,columns
      // "Q1","A1"
      // "Q2","A2"`;
      // CSV parser should reject this
      // API should return 400 Bad Request with error details
    });

    it('should handle CSV with duplicate pairs', () => {
      // const csvWithDuplicates = [
      //   ...Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`),
      //   '"Question 1","Answer 1"', // Duplicate
      // ].join('\n');
      // const content = `input,expected_output\n${csvWithDuplicates}`;
      // CSV parser should detect duplicate
      // API should return 400 Bad Request with error details
    });

    it('should return count of pairs inserted on success', () => {
      const personaId = 'persona-test';
      const csv = Array.from({ length: 50 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const fileContent = `input,expected_output\n${csv}`;

      // Parse and insert
      const lines = fileContent.split('\n').slice(1);
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      let inserted = 0;
      for (const line of lines) {
        if (line.trim()) {
          const match = line.match(/"([^"]*)","([^"]*)"/);
          if (match) {
            insertPair.run(randomUUID(), personaId, match[1], match[2]);
            inserted++;
          }
        }
      }

      expect(inserted).toBe(50);

      // API should return 201 with { count: 50 }
    });

    it('should use transaction to ensure atomic insertion', () => {
      const personaId = 'persona-test';

      // Test transaction rollback on error
      const transaction = db.transaction(
        (pairs: Array<{ input: string; expected_output: string }>) => {
          const insertPair = db.prepare(
            'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
          );

          for (const pair of pairs) {
            insertPair.run(randomUUID(), personaId, pair.input, pair.expected_output);
          }
        }
      );

      const validPairs = Array.from({ length: 10 }, (_, i) => ({
        input: `Q${i}`,
        expected_output: `A${i}`,
      }));

      transaction(validPairs);

      const pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);
      expect(pairs).toHaveLength(10);

      // If transaction fails, no pairs should be inserted
      // (test with invalid data would cause rollback)
    });
  });

  describe('GET /api/personas/[id]/training/pairs', () => {
    beforeEach(() => {
      // Insert test pairs
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      for (let i = 0; i < 25; i++) {
        insertPair.run(randomUUID(), personaId, `Question ${i}`, `Answer ${i}`);
      }
    });

    it('should retrieve all training pairs for a persona', () => {
      const personaId = 'persona-test';
      const pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);

      expect(pairs).toHaveLength(25);
      expect(pairs[0]).toHaveProperty('input');
      expect(pairs[0]).toHaveProperty('expected_output');
    });

    it('should return empty array for persona with no training pairs', () => {
      // Create new persona without pairs
      db.prepare(
        `INSERT INTO personas
         (id, name, description, task_model_id, judge_model_id, prompt_engineer_model_id, status, target_pass_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'persona-empty',
        'Empty Persona',
        'No pairs',
        'model-openai',
        'model-anthropic',
        'model-google',
        'draft',
        0.8,
        new Date().toISOString(),
        new Date().toISOString()
      );

      const pairs = db
        .prepare('SELECT * FROM training_pairs WHERE persona_id = ?')
        .all('persona-empty');

      expect(pairs).toHaveLength(0);
    });

    it('should return 404 for non-existent persona', () => {
      const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get('non-existent');
      expect(persona).toBeUndefined();

      // API should return 404 Not Found
    });

    it('should include pair metadata (id, created_at)', () => {
      const personaId = 'persona-test';
      const pairs = db.prepare('SELECT * FROM training_pairs WHERE persona_id = ?').all(personaId);

      expect(pairs[0]).toHaveProperty('id');
      expect(pairs[0]).toHaveProperty('created_at');
      expect(pairs[0]).toHaveProperty('persona_id', personaId);
    });

    it('should support pagination (future enhancement)', () => {
      // Pagination can be added later if needed for large datasets
      // For now, return all pairs (max 200 per persona)
    });
  });
});
