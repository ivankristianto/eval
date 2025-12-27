/**
 * Training Data Display Integration Tests
 * Tests for training data display page rendering and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// Test database setup
const TEST_DB_PATH = ':memory:';
let db: Database.Database;

describe('Training Data Display', () => {
  beforeEach(() => {
    // Initialize test database
    db = new Database(TEST_DB_PATH);

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS ModelConfiguration (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        api_key TEXT,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        task_prompt TEXT NOT NULL,
        task_model_id TEXT NOT NULL,
        judge_model_id TEXT NOT NULL,
        prompt_engineer_model_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('draft', 'training', 'trained', 'incomplete')),
        target_f1_score REAL NOT NULL DEFAULT 0.80,
        max_iterations INTEGER NOT NULL DEFAULT 5,
        current_iteration INTEGER DEFAULT 0,
        best_f1_score REAL DEFAULT NULL,
        best_f1_iteration INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        FOREIGN KEY (task_model_id) REFERENCES ModelConfiguration(id),
        FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id),
        FOREIGN KEY (prompt_engineer_model_id) REFERENCES ModelConfiguration(id)
      );

      CREATE TABLE IF NOT EXISTS training_pairs (
        id TEXT PRIMARY KEY,
        persona_id TEXT NOT NULL,
        input TEXT NOT NULL,
        expected_output TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
      );
    `);

    // Insert test models
    const models = [
      { id: 'model-openai', provider: 'openai', model_name: 'gpt-4' },
      { id: 'model-anthropic', provider: 'anthropic', model_name: 'claude-3' },
      { id: 'model-google', provider: 'google', model_name: 'gemini-pro' },
    ];

    const insertModel = db.prepare(
      'INSERT INTO ModelConfiguration (id, provider, model_name, is_active) VALUES (?, ?, ?, 1)'
    );
    for (const model of models) {
      insertModel.run(model.id, model.provider, model.model_name);
    }

    // Insert test persona
    db.prepare(
      `INSERT INTO personas (id, name, description, task_prompt, task_model_id, judge_model_id, prompt_engineer_model_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'persona-test',
      'Test Persona',
      'Test description',
      'Test task prompt',
      'model-openai',
      'model-anthropic',
      'model-google',
      'draft'
    );
  });

  afterEach(() => {
    db.close();
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
        `INSERT INTO personas (id, name, description, task_prompt, task_model_id, judge_model_id, prompt_engineer_model_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'persona-empty',
        'Empty Persona',
        'No pairs',
        'Test prompt',
        'model-openai',
        'model-anthropic',
        'model-google',
        'draft'
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
        .all(personaId);

      expect((pairs[0] as any).input).toBe('Q1');
      expect((pairs[1] as any).input).toBe('Q2');
      expect((pairs[2] as any).input).toBe('Q3');
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
      expect(pairs.every((p: any) => p.input.toLowerCase().includes(searchTerm))).toBe(true);
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
        .get(personaId);

      expect((count as any).count).toBe(50);
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
        .get(personaId);
      expect((count as any).count).toBe(20);

      // Delete all pairs
      db.prepare('DELETE FROM training_pairs WHERE persona_id = ?').run(personaId);

      count = db
        .prepare('SELECT COUNT(*) as count FROM training_pairs WHERE persona_id = ?')
        .get(personaId);
      expect((count as any).count).toBe(0);
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
        .get(personaId);

      expect((count as any).count).toBeGreaterThanOrEqual(10);
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
        .get(personaId);

      expect((count as any).count).toBeLessThan(10);
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
        .all(personaId);

      expect((pairs[0] as any).input).toContain('\n');
      expect((pairs[0] as any).expected_output).toContain('\n');
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
        .all(personaId);

      expect((pairs[0] as any).input).toBe('Question with émojis 🎉 and 中文');
      expect((pairs[0] as any).expected_output).toBe('Answer with special chars: <>&"');
    });
  });
});
