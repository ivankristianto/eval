/**
 * CSV Parser Edge Cases Tests
 * Tests for unusual input conditions and boundary cases
 */

import { describe, it, expect } from 'vitest';
import { parseCSV } from '../../src/lib/csv-parser';

describe('CSV Parser Edge Cases', () => {
  describe('Column name flexibility', () => {
    it('should accept "Input A" and "Correct Output" column names', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `Input A,Correct Output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
      expect(result.rows[0]).toHaveProperty('input');
      expect(result.rows[0]).toHaveProperty('expected_output');
    });

    it('should normalize "expected output" (with space) to "expected_output"', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]).toHaveProperty('expected_output');
    });

    it('should be case-insensitive for all column variations', () => {
      const testCases = [
        'INPUT,EXPECTED_OUTPUT',
        'Input,Expected_Output',
        'INPUT A,CORRECT OUTPUT',
        'input a,correct output',
      ];

      for (const headers of testCases) {
        const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
        const csv = `${headers}\n${rows}`;

        const result = parseCSV(csv);

        expect(result.errors).toHaveLength(0);
        expect(result.rows).toHaveLength(10);
      }
    });
  });

  describe('Boundary conditions', () => {
    it('should accept exactly 10 pairs (minimum boundary)', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
    });

    it('should accept exactly 200 pairs (maximum boundary)', () => {
      const rows = Array.from({ length: 200 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(200);
    });

    it('should reject 9 pairs (below minimum)', () => {
      const rows = Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain(
        'Training data must have between 10 and 200 pairs. Found 9 pairs.'
      );
    });

    it('should reject 201 pairs (above maximum)', () => {
      const rows = Array.from({ length: 201 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain(
        'Training data must have between 10 and 200 pairs. Found 201 pairs.'
      );
    });
  });

  describe('Malformed CSV', () => {
    it('should reject CSV with missing "expected_output" column', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}"`).join('\n');
      const csv = `input\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing required columns');
    });

    it('should reject CSV with missing "input" column', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"A${i}"`).join('\n');
      const csv = `expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing required columns');
    });

    it('should reject CSV with completely wrong column names', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `question,answer\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Missing required columns');
    });

    it('should handle CSV with extra columns gracefully', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}","Extra${i}"`).join('\n');
      const csv = `input,expected_output,extra_column\n${rows}`;

      const result = parseCSV(csv);

      // Should ignore extra column and parse successfully
      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
      expect(result.rows[0]).toEqual({
        input: 'Q0',
        expected_output: 'A0',
      });
    });
  });

  describe('Empty and whitespace handling', () => {
    it('should reject rows with empty input after trimming', () => {
      const rows = [
        '"","Answer 1"',
        '"   ","Answer 2"', // Whitespace only
        ...Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain('Row 1: Input cannot be empty');
      expect(result.errors).toContain('Row 2: Input cannot be empty');
    });

    it('should reject rows with empty expected_output after trimming', () => {
      const rows = [
        '"Question 1",""',
        '"Question 2","   "', // Whitespace only
        ...Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toContain('Row 1: Expected output cannot be empty');
      expect(result.errors).toContain('Row 2: Expected output cannot be empty');
    });

    it('should trim leading and trailing whitespace from values', () => {
      const rows = [
        '"  Question with spaces  ","  Answer with spaces  "',
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]).toEqual({
        input: 'Question with spaces',
        expected_output: 'Answer with spaces',
      });
    });

    it('should preserve internal whitespace', () => {
      const rows = [
        '"Question  with  internal  spaces","Answer  with  internal  spaces"',
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].input).toBe('Question  with  internal  spaces');
      expect(result.rows[0].expected_output).toBe('Answer  with  internal  spaces');
    });
  });

  describe('Duplicate detection', () => {
    it('should detect exact duplicates', () => {
      const rows = [
        ...Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`),
        '"Question 5","Answer 5"', // Exact duplicate
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Duplicate pair detected'))).toBe(true);
    });

    it('should not flag similar but different pairs as duplicates', () => {
      const rows = [
        '"Question 1","Answer 1"',
        '"Question 1","Answer 2"', // Same input, different output
        '"Question 2","Answer 1"', // Different input, same output
        ...Array.from({ length: 8 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(11);
    });

    it('should detect multiple duplicate pairs', () => {
      const rows = [
        ...Array.from({ length: 10 }, (_, i) => `"Question ${i}","Answer ${i}"`),
        '"Question 1","Answer 1"', // Duplicate 1
        '"Question 2","Answer 2"', // Duplicate 2
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      const duplicateErrors = result.errors.filter((e) => e.includes('Duplicate pair detected'));
      expect(duplicateErrors.length).toBe(2);
    });
  });

  describe('Special characters and encoding', () => {
    it('should handle quotes in values correctly', () => {
      const rows = [
        '"Question with ""quoted"" text","Answer with ""quoted"" text"',
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].input).toBe('Question with "quoted" text');
      expect(result.rows[0].expected_output).toBe('Answer with "quoted" text');
    });

    it('should handle commas in values correctly', () => {
      const rows = [
        '"Question with, commas, in it","Answer with, commas, too"',
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].input).toBe('Question with, commas, in it');
      expect(result.rows[0].expected_output).toBe('Answer with, commas, too');
    });

    it('should handle newlines in quoted values correctly', () => {
      const rows = [
        `"Question with
newline","Answer with
newline"`,
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].input).toContain('\n');
      expect(result.rows[0].expected_output).toContain('\n');
    });

    it('should handle Unicode characters correctly', () => {
      const rows = [
        '"Question with émojis 🎉","Answer with 中文字符"',
        ...Array.from({ length: 9 }, (_, i) => `"Q${i}","A${i}"`),
      ].join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].input).toBe('Question with émojis 🎉');
      expect(result.rows[0].expected_output).toBe('Answer with 中文字符');
    });
  });

  describe('Line ending variations', () => {
    it('should handle Unix line endings (\\n)', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\n');
      const csv = `input,expected_output\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
    });

    it('should handle Windows line endings (\\r\\n)', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\r\n');
      const csv = `input,expected_output\r\n${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
    });

    it('should handle Mac line endings (\\r)', () => {
      const rows = Array.from({ length: 10 }, (_, i) => `"Q${i}","A${i}"`).join('\r');
      const csv = `input,expected_output\r${rows}`;

      const result = parseCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(10);
    });
  });
});
