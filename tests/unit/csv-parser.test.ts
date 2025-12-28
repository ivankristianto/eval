/**
 * CSV Parser Unit Tests
 * Tests for CSV validation and parsing functionality
 */

import { describe, it, expect } from 'vitest';
import { parseCSV } from '@lib/utils/csv-parser';

describe('CSV Parser', () => {
  describe('Valid CSV parsing', () => {
    it('should parse valid CSV with "input" and "expected_output" columns', () => {
      // Generate 10 rows to meet minimum constraint
      const rows = [
        '"What is 2+2?","4"',
        '"Capital of France?","Paris"',
        '"Color of sky?","Blue"',
        '"Largest ocean?","Pacific"',
        '"Speed of light?","299792458 m/s"',
        '"Capital of Japan?","Tokyo"',
        '"Boiling point of water?","100°C"',
        '"First element?","Hydrogen"',
        '"Earth circumference?","40075 km"',
        '"Days in year?","365"',
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
      expect(result.rows[0]).toEqual({
        input: 'What is 2+2?',
        expected_output: '4',
      });
      expect(result.rows[1]).toEqual({
        input: 'Capital of France?',
        expected_output: 'Paris',
      });
      expect(result.rows[2]).toEqual({
        input: 'Color of sky?',
        expected_output: 'Blue',
      });
    });

    it('should parse valid CSV with flexible column names "Input A" and "Correct Output"', () => {
      const rows = Array.from(
        { length: 10 },
        (_, i) => `"Question ${i + 1}","Answer ${i + 1}"`
      ).join('\n');
      const csv = `Input A,Correct Output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
      expect(result.rows[0]).toEqual({
        input: 'Question 1',
        expected_output: 'Answer 1',
      });
    });

    it('should trim whitespace from values', () => {
      const rows = [
        '"  question with spaces  ","  answer with spaces  "',
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]).toEqual({
        input: 'question with spaces',
        expected_output: 'answer with spaces',
      });
    });

    it('should parse CSV with exactly 10 pairs (minimum)', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
    });

    it('should parse CSV with exactly 200 pairs (maximum)', () => {
      const rows = Array.from({ length: 200 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(200);
    });

    it('should handle multiline values in quotes', () => {
      const rows = [
        `"Line 1
Line 2","Answer with
multiple lines"`,
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].input).toContain('Line 1');
      expect(result.rows[0].input).toContain('Line 2');
    });
  });

  describe('CSV validation errors', () => {
    it('should reject CSV with missing columns', () => {
      const csv = `input
"question1"
"question2"`;

      const result = parseCSV(csv);

      expect(result.errors).toContain(
        'Missing required columns. Expected "input" and "expected_output" (or "Input A" and "Correct Output")'
      );
    });

    it('should reject CSV with wrong column names', () => {
      const csv = `question,answer
"Q1","A1"`;

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing required columns');
    });

    it('should reject CSV with fewer than 10 pairs', () => {
      const rows = Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain(
        'Training data must have between 10 and 200 pairs. Found 9 pairs.'
      );
    });

    it('should reject CSV with more than 200 pairs', () => {
      const rows = Array.from({ length: 201 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain(
        'Training data must have between 10 and 200 pairs. Found 201 pairs.'
      );
    });

    it('should reject CSV with empty input field', () => {
      const rows = [
        '"","Answer 1"',
        ...Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain('Row 1: Input cannot be empty');
    });

    it('should reject CSV with empty expected_output field', () => {
      const rows = [
        '"Question 1",""',
        ...Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain('Row 1: Expected output cannot be empty');
    });

    it('should detect duplicate pairs', () => {
      const rows = [
        ...Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`),
        '"Question 1","Answer 1"', // Duplicate at row 11 (0-indexed from header)
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain(
        'Duplicate pair detected at row 11: "Question 1" → "Answer 1"'
      );
    });

    it('should handle completely empty CSV', () => {
      const csv = '';

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle CSV with only headers', () => {
      const csv = 'input,expected_output';

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.some((e) => e.includes('Training data must have between 10 and 200 pairs'))
      ).toBe(true);
    });
  });

  describe('CSV normalization', () => {
    it('should normalize "Input A" to "input"', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n');
      const csv = `Input A,Correct Output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]).toHaveProperty('input');
      expect(result.rows[0]).toHaveProperty('expected_output');
    });

    it('should be case-insensitive for column matching', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`).join('\n');
      const csv = `INPUT,EXPECTED_OUTPUT\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]).toEqual({
        input: 'Question 0',
        expected_output: 'Answer 0',
      });
    });
  });
});
