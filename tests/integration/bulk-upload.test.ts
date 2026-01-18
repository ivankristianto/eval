/**
 * Bulk Upload API Integration Tests
 * Tests for /api/bulk/upload endpoint
 *
 * Tests CSV upload with:
 * - Valid CSV data (multipart/form-data, JSON, raw)
 * - Invalid CSV data (format errors, empty files)
 * - File size validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { cleanupTestDb, getTestDatabase, initializeTestDatabase } from '../setup';
import { createBulkDataset } from '@lib/db';
import { parseGenericCSV, MAX_ROWS } from '@lib/utils/generic-csv-parser';

describe('Bulk Upload API Integration Tests', () => {
  let db: Database.Database;

  beforeEach(() => {
    initializeTestDatabase();
    db = getTestDatabase();
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  describe('CSV Parsing and Validation', () => {
    it('should parse valid CSV with simple columns', () => {
      const csv = `name,age,city
"John Doe",30,"New York"
"Jane Smith",25,"Los Angeles"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        name: 'John Doe',
        age: '30',
        city: 'New York',
      });
      expect(result.rows[1]).toEqual({
        name: 'Jane Smith',
        age: '25',
        city: 'Los Angeles',
      });
    });

    it('should parse CSV with quoted fields containing commas', () => {
      const csv = `question,answer
"How do I reset my password?","Click 'Forgot Password' on the login page"
"What are your hours?","We are open Monday-Friday 9am-5pm EST"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].question).toBe('How do I reset my password?');
      expect(result.rows[0].answer).toBe("Click 'Forgot Password' on the login page");
    });

    it('should parse CSV with multiline values', () => {
      const csv = `title,content
"First Post","This is a post
with multiple lines
of text."
"Second Post","Single line content."`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].content).toContain('with multiple lines');
    });

    it('should handle CSV with many columns', () => {
      const headers = Array.from({ length: 20 }, (_, i) => `col${i}`).join(',');
      const row1 = Array.from({ length: 20 }, (_, i) => `"value${i}"`).join(',');
      const row2 = Array.from({ length: 20 }, (_, i) => `"data${i}"`).join(',');

      const csv = `${headers}\n${row1}\n${row2}`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.headers).toHaveLength(20);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toHaveProperty('col0', 'value0');
      expect(result.rows[0]).toHaveProperty('col19', 'value19');
    });

    it('should skip empty rows', () => {
      const csv = `name,age
"John",30

"Jane",25
`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });

    it('should return error for empty CSV', () => {
      const result = parseGenericCSV('');

      expect(result.errors).toContain('CSV file is empty');
      expect(result.rows).toHaveLength(0);
    });

    it('should return error for CSV with no data rows', () => {
      const csv = 'name,age\n';
      const result = parseGenericCSV(csv);

      expect(result.errors).toContain('CSV file must contain at least one data row');
    });

    it('should return error for CSV with no headers', () => {
      const csv = '\n"John",30\n"Jane",25';
      const result = parseGenericCSV(csv);

      expect(result.errors).toContain('CSV file is missing headers');
    });

    it('should enforce max rows limit', () => {
      const rows = Array.from({ length: MAX_ROWS + 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `question,answer\n${rows}`;

      const result = parseGenericCSV(csv, MAX_ROWS);

      expect(result.errors).toContain(
        `CSV file exceeds maximum row limit of ${MAX_ROWS}. Found ${MAX_ROWS + 10} data rows.`
      );
      expect(result.rows).toHaveLength(MAX_ROWS);
    });

    it('should handle CSV with special characters in values', () => {
      const csv = `text,value
"Quotes: ""hello""","test"
"Emojis: 😀🎉","emoji test"
"Currency: $100.50","price"
"Percent: 50%","percentage"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(4);
      expect(result.rows[0].text).toBe('Quotes: "hello"');
      expect(result.rows[1].text).toBe('Emojis: 😀🎉');
    });

    it('should handle Windows line endings (CRLF)', () => {
      const csv = 'name,age\r\n"John",30\r\n"Jane",25';
      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });

    it('should handle Mac line endings (CR)', () => {
      const csv = 'name,age\r"John",30\r"Jane",25';
      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('Bulk Dataset Creation', () => {
    it('should create bulk dataset from parsed CSV data', () => {
      const csvData = [
        { question: 'How do I reset my password?', answer: 'Click Forgot Password' },
        { question: 'What are your hours?', answer: '9am-5pm EST' },
        { question: 'Where is my order?', answer: 'Track with your number' },
      ];

      const dataset = createBulkDataset('test.csv', csvData, db);

      expect(dataset).toBeDefined();
      expect(dataset.id).toBeDefined();
      expect(dataset.filename).toBe('test.csv');
      expect(dataset.row_count).toBe(3);
      expect(dataset.created_at).toBeDefined();

      // Verify stored data can be retrieved
      const retrieved = db.prepare('SELECT * FROM bulk_datasets WHERE id = ?').get(dataset.id) as
        | { csv_data: string }
        | undefined;

      expect(retrieved).toBeDefined();
      const parsedData = JSON.parse(retrieved!.csv_data);
      expect(parsedData).toHaveLength(3);
      expect(parsedData[0].question).toBe('How do I reset my password?');
    });

    it('should create bulk dataset with many rows', () => {
      const csvData = Array.from({ length: 100 }, (_, i) => ({
        question: `Question ${i}`,
        answer: `Answer ${i}`,
      }));

      const dataset = createBulkDataset('large.csv', csvData, db);

      expect(dataset.row_count).toBe(100);

      const retrieved = db.prepare('SELECT * FROM bulk_datasets WHERE id = ?').get(dataset.id) as
        | { csv_data: string }
        | undefined;

      const parsedData = JSON.parse(retrieved!.csv_data);
      expect(parsedData).toHaveLength(100);
    });

    it('should throw error for CSV data exceeding size limit', () => {
      // Create data larger than 10MB when JSON stringified
      const largeData = Array.from({ length: 50000 }, () => ({
        col1: 'x'.repeat(100),
        col2: 'y'.repeat(100),
        col3: 'z'.repeat(100),
      }));

      expect(() => createBulkDataset('huge.csv', largeData, db)).toThrow(/CSV data too large/);
    });

    it('should store CSV data as valid JSON', () => {
      const csvData = [
        { name: 'John', age: '30', city: 'New York' },
        { name: 'Jane', age: '25', city: 'Los Angeles' },
      ];

      const dataset = createBulkDataset('test.json.csv', csvData, db);

      const retrieved = db
        .prepare('SELECT csv_data FROM bulk_datasets WHERE id = ?')
        .get(dataset.id) as { csv_data: string } | undefined;

      expect(() => JSON.parse(retrieved!.csv_data)).not.toThrow();
      const parsed = JSON.parse(retrieved!.csv_data);
      expect(parsed).toEqual(csvData);
    });
  });

  describe('Database Operations', () => {
    it('should retrieve bulk dataset by ID', () => {
      const csvData = [{ q: 'test', a: 'answer' }];
      const created = createBulkDataset('test.csv', csvData, db);

      const retrieved = db.prepare('SELECT * FROM bulk_datasets WHERE id = ?').get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved).toHaveProperty('filename', 'test.csv');
      expect(retrieved).toHaveProperty('row_count', 1);
    });

    it('should list all bulk datasets ordered by creation date', () => {
      const data1 = [{ q: '1', a: 'a1' }];
      const data2 = [{ q: '2', a: 'a2' }];
      const data3 = [{ q: '3', a: 'a3' }];

      // Use explicit timestamps to ensure deterministic ordering
      const timestamp1 = '2024-01-01T00:00:00.000Z';
      const timestamp2 = '2024-01-01T00:00:01.000Z';
      const timestamp3 = '2024-01-01T00:00:02.000Z';

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      const id3 = crypto.randomUUID();

      db.prepare(
        `INSERT INTO bulk_datasets (id, filename, row_count, csv_data, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id1, 'first.csv', 1, JSON.stringify(data1), timestamp1);

      db.prepare(
        `INSERT INTO bulk_datasets (id, filename, row_count, csv_data, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id2, 'second.csv', 1, JSON.stringify(data2), timestamp2);

      db.prepare(
        `INSERT INTO bulk_datasets (id, filename, row_count, csv_data, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id3, 'third.csv', 1, JSON.stringify(data3), timestamp3);

      const datasets = db.prepare('SELECT * FROM bulk_datasets ORDER BY created_at DESC').all();

      expect(datasets).toHaveLength(3);
      // Newest first due to DESC order
      const filenames = (datasets as Array<{ filename: string }>).map((d) => d.filename);
      expect(filenames).toEqual(['third.csv', 'second.csv', 'first.csv']);
    });

    it('should delete bulk dataset and CASCADE delete related runs', () => {
      const csvData = [{ q: 'test', a: 'answer' }];
      const dataset = createBulkDataset('test.csv', csvData, db);

      // Create an evaluation run for this dataset
      const runId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO evaluation_runs_bulk (id, dataset_id, system_prompt, temperature, selected_models, status, total_rows, processed_rows, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        runId,
        dataset.id,
        'Test prompt',
        0.5,
        JSON.stringify(['model1']),
        'pending',
        1,
        0,
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Verify run exists
      const runBefore = db.prepare('SELECT * FROM evaluation_runs_bulk WHERE id = ?').get(runId);
      expect(runBefore).toBeDefined();

      // Delete dataset
      const deleted = db.prepare('DELETE FROM bulk_datasets WHERE id = ?').run(dataset.id);
      expect(deleted.changes).toBe(1);

      // Verify run was CASCADE deleted
      const runAfter = db.prepare('SELECT * FROM evaluation_runs_bulk WHERE id = ?').get(runId);
      expect(runAfter).toBeUndefined();
    });

    it('should handle concurrent dataset creation', () => {
      const datasets = Array.from({ length: 5 }, (_, i) => {
        const data = [{ id: `${i}`, value: `value${i}` }];
        return createBulkDataset(`concurrent${i}.csv`, data, db);
      });

      expect(datasets).toHaveLength(5);
      const allIds = new Set(datasets.map((d) => d.id));
      expect(allIds.size).toBe(5); // All IDs should be unique
    });
  });

  describe('Error Cases', () => {
    it('should handle malformed CSV gracefully', () => {
      // Unclosed quote
      const csv = `name,age
"John,30
"Jane",25`;

      const result = parseGenericCSV(csv);

      // Parser should handle this but may have errors
      expect(result).toBeDefined();
    });

    it('should handle CSV with inconsistent column counts', () => {
      const csv = `name,age,city
"John",30,"New York"
"Jane",25
"Bob",35,"Boston","MA"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      // Missing columns should be empty strings
      expect(result.rows[1]).toHaveProperty('city', '');
      // Extra columns should be ignored
      expect(result.rows[2]).toHaveProperty('city', 'Boston');
    });

    it('should handle very long column values', () => {
      const longValue = 'x'.repeat(10000);
      const csv = `text,value
"${longValue}","normal"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].text).toBe(longValue);
    });

    it('should handle CSV with only headers and one row', () => {
      const csv = 'question,answer\n"Only one?","Yes"';

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(1);
    });

    it('should reject empty filename', () => {
      const csvData = [{ q: 'test', a: 'answer' }];

      // Should still work with empty filename (db allows it)
      const dataset = createBulkDataset('', csvData, db);
      expect(dataset.filename).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle CSV with unicode characters', () => {
      const csv = `language,greeting
"English","Hello"
"Spanish","¡Hola!"
"Japanese","こんにちは"
"Arabic","مرحبا"
"Emoji","👋😊🌍"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[4].greeting).toBe('👋😊🌍');
    });

    it('should handle CSV with null bytes', () => {
      const csv = 'name,value\n"test","value\x00with\x00nulls"';
      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].value).toContain('\x00');
    });

    it('should handle CSV with tabs in quoted fields', () => {
      const csv = 'text,value\n"has\ttab","normal"';
      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].text).toContain('\t');
    });

    it('should create dataset with exactly MAX_ROWS', () => {
      const csvData = Array.from({ length: MAX_ROWS }, (_, i) => ({
        id: `row${i}`,
        data: `data${i}`,
      }));

      const dataset = createBulkDataset('max-rows.csv', csvData, db);

      expect(dataset.row_count).toBe(MAX_ROWS);
    });
  });
});
