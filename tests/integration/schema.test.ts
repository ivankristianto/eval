import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Schema integration tests for system prompt and temperature columns
 * Tests verify database schema changes from Phase 1 (T002):
 * - Evaluation table: system_prompt TEXT, temperature REAL with defaults and constraints
 * - EvaluationTemplate table: system_prompt TEXT, temperature REAL with defaults and constraints
 * - Result table: system_prompt_used TEXT, temperature_used REAL
 */

describe('Database Schema - System Prompt and Temperature', () => {
  let db: Database.Database;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(() => {
    // Create a fresh database and apply schema
    db = new Database(testDbPath);

    // Load and execute schema.sql
    const schemaPath = join(__dirname, '../../db/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute entire schema at once (better-sqlite3 handles multiple statements)
    db.exec(schema);
  });

  afterEach(() => {
    db.close();
  });

  describe('Evaluation table', () => {
    it('should have system_prompt column with TEXT type', () => {
      const columns = db.pragma('table_info(Evaluation)') as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>;

      const systemPromptCol = columns.find((col) => col.name === 'system_prompt');
      expect(systemPromptCol).toBeDefined();
      expect(systemPromptCol?.type).toBe('TEXT');
      expect(systemPromptCol?.notnull).toBe(0); // nullable
    });

    it('should have temperature column with REAL type', () => {
      const columns = db.pragma('table_info(Evaluation)') as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>;

      const temperatureCol = columns.find((col) => col.name === 'temperature');
      expect(temperatureCol).toBeDefined();
      expect(temperatureCol?.type).toBe('REAL');
      expect(temperatureCol?.notnull).toBe(0); // nullable
      expect(temperatureCol?.dflt_value).toBe('0.3'); // default value
    });

    it('should enforce temperature CHECK constraint (0.0 - 2.0 range)', () => {
      const id = 'test-eval-1';

      // Valid: temperature at lower boundary
      expect(() => {
        db.prepare(
          `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric, temperature)
           VALUES (?, 'Test', 'exact_match', 0.0)`
        ).run(id + '-1');
      }).not.toThrow();

      // Valid: temperature at upper boundary
      expect(() => {
        db.prepare(
          `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric, temperature)
           VALUES (?, 'Test', 'exact_match', 2.0)`
        ).run(id + '-2');
      }).not.toThrow();

      // Invalid: temperature below 0.0
      expect(() => {
        db.prepare(
          `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric, temperature)
           VALUES (?, 'Test', 'exact_match', -0.1)`
        ).run(id + '-3');
      }).toThrow(/constraint/i);

      // Invalid: temperature above 2.0
      expect(() => {
        db.prepare(
          `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric, temperature)
           VALUES (?, 'Test', 'exact_match', 2.1)`
        ).run(id + '-4');
      }).toThrow(/constraint/i);
    });

    it('should apply default temperature of 0.3 when not specified', () => {
      const id = 'test-eval-default';
      db.prepare(
        `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric)
         VALUES (?, 'Test', 'exact_match')`
      ).run(id);

      const row = db.prepare('SELECT temperature FROM Evaluation WHERE id = ?').get(id) as {
        temperature: number;
      };

      expect(row.temperature).toBe(0.3);
    });

    it('should allow null system_prompt', () => {
      const id = 'test-eval-null-prompt';
      expect(() => {
        db.prepare(
          `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric, system_prompt)
           VALUES (?, 'Test', 'exact_match', NULL)`
        ).run(id);
      }).not.toThrow();

      const row = db.prepare('SELECT system_prompt FROM Evaluation WHERE id = ?').get(id) as {
        system_prompt: string | null;
      };

      expect(row.system_prompt).toBeNull();
    });
  });

  describe('EvaluationTemplate table', () => {
    it('should have system_prompt column with TEXT type', () => {
      const columns = db.pragma('table_info(EvaluationTemplate)') as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>;

      const systemPromptCol = columns.find((col) => col.name === 'system_prompt');
      expect(systemPromptCol).toBeDefined();
      expect(systemPromptCol?.type).toBe('TEXT');
      expect(systemPromptCol?.notnull).toBe(0); // nullable
    });

    it('should have temperature column with REAL type and default 0.3', () => {
      const columns = db.pragma('table_info(EvaluationTemplate)') as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>;

      const temperatureCol = columns.find((col) => col.name === 'temperature');
      expect(temperatureCol).toBeDefined();
      expect(temperatureCol?.type).toBe('REAL');
      expect(temperatureCol?.notnull).toBe(0); // nullable
      expect(temperatureCol?.dflt_value).toBe('0.3'); // default value
    });

    it('should enforce temperature CHECK constraint (0.0 - 2.0 range)', () => {
      const baseInsert = `INSERT INTO EvaluationTemplate
        (id, name, instruction_text, model_ids, accuracy_rubric, temperature)
        VALUES (?, 'Test Template', 'Test instruction', '[]', 'exact_match', ?)`;

      // Valid: temperature at boundaries
      expect(() => {
        db.prepare(baseInsert).run('template-1', 0.0);
      }).not.toThrow();

      expect(() => {
        db.prepare(baseInsert).run('template-2', 2.0);
      }).not.toThrow();

      // Invalid: temperature out of range
      expect(() => {
        db.prepare(baseInsert).run('template-3', -0.1);
      }).toThrow(/constraint/i);

      expect(() => {
        db.prepare(baseInsert).run('template-4', 2.1);
      }).toThrow(/constraint/i);
    });

    it('should apply default temperature of 0.3 when not specified', () => {
      const id = 'template-default';
      db.prepare(
        `INSERT INTO EvaluationTemplate (id, name, instruction_text, model_ids, accuracy_rubric)
         VALUES (?, 'Test', 'Test instruction', '[]', 'exact_match')`
      ).run(id);

      const row = db.prepare('SELECT temperature FROM EvaluationTemplate WHERE id = ?').get(
        id
      ) as { temperature: number };

      expect(row.temperature).toBe(0.3);
    });
  });

  describe('Result table', () => {
    it('should have system_prompt_used column with TEXT type', () => {
      const columns = db.pragma('table_info(Result)') as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>;

      const systemPromptUsedCol = columns.find((col) => col.name === 'system_prompt_used');
      expect(systemPromptUsedCol).toBeDefined();
      expect(systemPromptUsedCol?.type).toBe('TEXT');
      expect(systemPromptUsedCol?.notnull).toBe(0); // nullable (audit field)
    });

    it('should have temperature_used column with REAL type', () => {
      const columns = db.pragma('table_info(Result)') as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }>;

      const temperatureUsedCol = columns.find((col) => col.name === 'temperature_used');
      expect(temperatureUsedCol).toBeDefined();
      expect(temperatureUsedCol?.type).toBe('REAL');
      expect(temperatureUsedCol?.notnull).toBe(0); // nullable (audit field)
    });

    it('should accept null values for audit fields (backward compatibility)', () => {
      // Create prerequisite records
      const modelId = 'model-1';
      const evalId = 'eval-1';

      db.prepare(
        `INSERT INTO ModelConfiguration
         (id, provider, model_name, api_key_encrypted)
         VALUES (?, 'openai', 'gpt-4', 'encrypted-key')`
      ).run(modelId);

      db.prepare(
        `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric)
         VALUES (?, 'Test', 'exact_match')`
      ).run(evalId);

      // Insert result with null audit fields
      const resultId = 'result-1';
      expect(() => {
        db.prepare(
          `INSERT INTO Result
           (id, evaluation_id, model_id, system_prompt_used, temperature_used)
           VALUES (?, ?, ?, NULL, NULL)`
        ).run(resultId, evalId, modelId);
      }).not.toThrow();

      const row = db
        .prepare('SELECT system_prompt_used, temperature_used FROM Result WHERE id = ?')
        .get(resultId) as {
        system_prompt_used: string | null;
        temperature_used: number | null;
      };

      expect(row.system_prompt_used).toBeNull();
      expect(row.temperature_used).toBeNull();
    });

    it('should store audit values correctly', () => {
      // Create prerequisite records
      const modelId = 'model-2';
      const evalId = 'eval-2';

      db.prepare(
        `INSERT INTO ModelConfiguration
         (id, provider, model_name, api_key_encrypted)
         VALUES (?, 'openai', 'gpt-4', 'encrypted-key')`
      ).run(modelId);

      db.prepare(
        `INSERT INTO Evaluation (id, instruction_text, accuracy_rubric)
         VALUES (?, 'Test', 'exact_match')`
      ).run(evalId);

      // Insert result with audit values
      const resultId = 'result-2';
      const testSystemPrompt = 'You are a helpful assistant';
      const testTemperature = 1.5;

      db.prepare(
        `INSERT INTO Result
         (id, evaluation_id, model_id, system_prompt_used, temperature_used)
         VALUES (?, ?, ?, ?, ?)`
      ).run(resultId, evalId, modelId, testSystemPrompt, testTemperature);

      const row = db
        .prepare('SELECT system_prompt_used, temperature_used FROM Result WHERE id = ?')
        .get(resultId) as {
        system_prompt_used: string;
        temperature_used: number;
      };

      expect(row.system_prompt_used).toBe(testSystemPrompt);
      expect(row.temperature_used).toBe(testTemperature);
    });
  });
});
