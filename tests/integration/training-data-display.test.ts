/**
 * Training Data Display Integration Tests
 * Tests for training data display page rendering and functionality
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import {
  getTestDatabase,
  initializeTestDatabase,
  cleanTestDatabase,
  closeTestDatabase,
} from '../setup';

/** Type for training_pairs database row */
interface TrainingPairRow {
  id: string;
  persona_id: string;
  input: string;
  expected_output: string;
  created_at: string;
}

/** Type for COUNT query result */
interface CountRow {
  count: number;
}

let db: ReturnType<typeof getTestDatabase>;

describe('Training Data Display', () => {
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

  describe('Training pairs retrieval', () => {
    it('should retrieve all training pairs for display', () => {
      const personaId = 'persona-test';

      // Insert test pairs
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      for (let i = 0; i < 25; i++) {
        insertPair.run(randomUUID(), personaId, `Question ${i}`, `Answer ${i}`);
      }

      // Retrieve pairs (simulating page load)
      const pairs = db
        .prepare(
          `SELECT
            id,
            persona_id,
            input,
            expected_output,
            created_at
          FROM training_pairs
          WHERE persona_id = ?
          ORDER BY created_at ASC`
        )
        .all(personaId);

      expect(pairs).toHaveLength(25);
      expect(pairs[0]).toHaveProperty('input');
      expect(pairs[0]).toHaveProperty('expected_output');
      expect(pairs[0]).toHaveProperty('created_at');
    });

    it('should handle persona with no training pairs', () => {
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
      // Page should display "No training data uploaded yet" message
    });

    it('should order pairs by creation timestamp', () => {
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at) VALUES (?, ?, ?, ?, ?)'
      );

      // Insert pairs with specific timestamps
      const now = new Date();
      insertPair.run(
        randomUUID(),
        personaId,
        'Q1',
        'A1',
        new Date(now.getTime() - 3000).toISOString()
      );
      insertPair.run(
        randomUUID(),
        personaId,
        'Q2',
        'A2',
        new Date(now.getTime() - 2000).toISOString()
      );
      insertPair.run(
        randomUUID(),
        personaId,
        'Q3',
        'A3',
        new Date(now.getTime() - 1000).toISOString()
      );
      // Add more pairs to meet minimum
      for (let i = 4; i <= 10; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`, now.toISOString());
      }

      const pairs = db
        .prepare('SELECT input FROM training_pairs WHERE persona_id = ? ORDER BY created_at ASC')
        .all(personaId) as TrainingPairRow[];

      expect(pairs[0]!.input).toBe('Q1');
      expect(pairs[1]!.input).toBe('Q2');
      expect(pairs[2]!.input).toBe('Q3');
    });
  });

  describe('Search and filter functionality', () => {
    beforeEach(() => {
      // Insert diverse test pairs for search testing
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      const testPairs = [
        { input: 'What is TypeScript?', output: 'A typed superset of JavaScript' },
        { input: 'What is Python?', output: 'A high-level programming language' },
        { input: 'Explain React hooks', output: 'Functions that let you use state' },
        { input: 'What is REST API?', output: 'Representational State Transfer API' },
        { input: 'Define TypeScript generics', output: 'Type parameters for reusable code' },
        { input: 'What is Docker?', output: 'Container platform' },
        { input: 'Explain GraphQL', output: 'Query language for APIs' },
        { input: 'What is Kubernetes?', output: 'Container orchestration' },
        { input: 'Define microservices', output: 'Architectural style' },
        { input: 'What is CI/CD?', output: 'Continuous Integration/Deployment' },
      ];

      for (const pair of testPairs) {
        insertPair.run(randomUUID(), personaId, pair.input, pair.output);
      }
    });

    it('should filter pairs by case-insensitive input search', () => {
      const personaId = 'persona-test';

      // Simulate search for "typescript"
      const searchTerm = 'typescript';
      const pairs = db
        .prepare(
          `SELECT * FROM training_pairs
           WHERE persona_id = ? AND LOWER(input) LIKE ?
           ORDER BY created_at ASC`
        )
        .all(personaId, `%${searchTerm}%`);

      expect(pairs.length).toBeGreaterThanOrEqual(2); // "What is TypeScript?" and "Define TypeScript generics"
      const searchTermLower = searchTerm.toLowerCase();
      expect(
        pairs.every((p) => (p as TrainingPairRow).input.toLowerCase().includes(searchTermLower))
      ).toBe(true);
    });

    it('should return all pairs when search is empty', () => {
      const personaId = 'persona-test';

      const allPairs = db
        .prepare('SELECT * FROM training_pairs WHERE persona_id = ?')
        .all(personaId);

      expect(allPairs).toHaveLength(10);
    });

    it('should return empty results for non-matching search', () => {
      const personaId = 'persona-test';

      const searchTerm = 'nonexistent-term-xyz';
      const pairs = db
        .prepare(
          `SELECT * FROM training_pairs
           WHERE persona_id = ? AND LOWER(input) LIKE ?`
        )
        .all(personaId, `%${searchTerm}%`);

      expect(pairs).toHaveLength(0);
    });

    it('should handle special characters in search', () => {
      const personaId = 'persona-test';

      // Add pair with special characters
      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      ).run(randomUUID(), personaId, 'What is C++?', 'Programming language');

      const searchTerm = 'c++';
      const pairs = db
        .prepare(
          `SELECT * FROM training_pairs
           WHERE persona_id = ? AND LOWER(input) LIKE ?`
        )
        .all(personaId, `%${searchTerm}%`);

      expect(pairs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Pair count and statistics', () => {
    it('should accurately count training pairs', () => {
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      for (let i = 0; i < 50; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`);
      }

      const count = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get(personaId) as CountRow | undefined;

      expect(count!.count).toBe(50);
    });

    it('should reflect updated count after deletion', () => {
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      for (let i = 0; i < 20; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`);
      }

      let count = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get(personaId) as CountRow | undefined;
      expect(count!.count).toBe(20);

      // Delete all pairs
      db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(personaId);

      count = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get(personaId) as CountRow | undefined;
      expect(count!.count).toBe(0);
    });
  });

  describe('Training readiness validation', () => {
    it('should indicate when persona has sufficient training data (>= 10 pairs)', () => {
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      for (let i = 0; i < 10; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`);
      }

      const count = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get(personaId) as CountRow | undefined;

      expect(count!.count).toBeGreaterThanOrEqual(10);
      // Page should show "Start Training" button
    });

    it('should indicate when persona has insufficient training data (< 10 pairs)', () => {
      const personaId = 'persona-test';
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );

      for (let i = 0; i < 9; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`);
      }

      const count = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get(personaId) as CountRow | undefined;

      expect(count!.count).toBeLessThan(10);
      // Page should NOT show "Start Training" button
    });
  });

  describe('Data integrity', () => {
    it('should preserve multiline input and output values', () => {
      const personaId = 'persona-test';

      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      ).run(
        randomUUID(),
        personaId,
        'Question line 1\nQuestion line 2',
        'Answer line 1\nAnswer line 2'
      );

      // Add more pairs to meet minimum
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );
      for (let i = 0; i < 9; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`);
      }

      const pairs = db
        .prepare('SELECT * FROM training_pairs WHERE persona_id = ? ORDER BY created_at ASC')
        .all(personaId) as TrainingPairRow[];

      expect(pairs[0]!.input).toContain('\n');
      expect(pairs[0]!.expected_output).toContain('\n');
      // Page should render with whitespace-pre-wrap to preserve newlines
    });

    it('should preserve special characters and Unicode', () => {
      const personaId = 'persona-test';

      db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      ).run(
        randomUUID(),
        personaId,
        'Question with émojis 🎉 and 中文',
        'Answer with special chars: <>&"'
      );

      // Add more pairs to meet minimum
      const insertPair = db.prepare(
        'INSERT INTO training_pairs (id, persona_id, input, expected_output) VALUES (?, ?, ?, ?)'
      );
      for (let i = 0; i < 9; i++) {
        insertPair.run(randomUUID(), personaId, `Q${i}`, `A${i}`);
      }

      const pairs = db
        .prepare('SELECT * FROM training_pairs WHERE persona_id = ? ORDER BY created_at ASC')
        .all(personaId) as TrainingPairRow[];

      expect(pairs[0]!.input).toBe('Question with émojis 🎉 and 中文');
      expect(pairs[0]!.expected_output).toBe('Answer with special chars: <>&"');
    });
  });
});
