/**
 * Generic CSV Parser Unit Tests
 * Tests for generic CSV parsing functionality (any column structure)
 */

import { describe, it, expect } from 'vitest';
import { parseGenericCSV, MAX_ROWS } from '@lib/utils/generic-csv-parser';

describe('Generic CSV Parser', () => {
  describe('Valid CSV parsing', () => {
    it('should parse CSV with simple headers and values', () => {
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

    it('should parse CSV with any header structure (no column requirements)', () => {
      const csv = `product_id,product_name,price,in_stock,category
101,"Widget A",19.99,true,"Electronics"
102,"Gadget B",29.50,false,"Accessories"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.headers).toEqual([
        'product_id',
        'product_name',
        'price',
        'in_stock',
        'category',
      ]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        product_id: '101',
        product_name: 'Widget A',
        price: '19.99',
        in_stock: 'true',
        category: 'Electronics',
      });
    });

    it('should handle CSV with quoted fields containing commas', () => {
      const csv = `title,description
"Product A","A great product, with many features"
"Product B","Another product, also with commas"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].description).toBe('A great product, with many features');
      expect(result.rows[1].description).toBe('Another product, also with commas');
    });

    it('should handle multiline values in quotes', () => {
      const csv = `question,answer
"What is AI?","Artificial Intelligence
is a field of computer science"
"What is ML?","Machine Learning
is a subset of AI"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].answer).toContain('Artificial Intelligence');
      expect(result.rows[0].answer).toContain('is a field of computer science');
    });

    it('should handle escaped quotes (double quotes)', () => {
      const csv = `text,quoted
"He said ""Hello""","A quoted ""value"""`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].text).toBe('He said "Hello"');
      expect(result.rows[0].quoted).toBe('A quoted "value"');
    });

    it('should trim whitespace from values', () => {
      const csv = `name,value
"  spaced name  ","  spaced value  "`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].name).toBe('spaced name');
      expect(result.rows[0].value).toBe('spaced value');
    });

    it('should handle empty values in cells', () => {
      const csv = `name,email,phone
"John","john@example.com",
"Jane","","555-1234"
"Bob","bob@example.com","555-5678"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].phone).toBe('');
      expect(result.rows[1].email).toBe('');
    });

    it('should skip empty rows', () => {
      const csv = `name,value
"A","1"

"B","2"


"C","3"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].value).toBe('1');
      expect(result.rows[1].value).toBe('2');
      expect(result.rows[2].value).toBe('3');
    });

    it('should handle different line endings (Windows CRLF)', () => {
      const csv = 'name,value\r\n"A","1"\r\n"B","2"';

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });

    it('should handle different line endings (Mac CR)', () => {
      const csv = 'name,value\r"A","1"\r"B","2"';

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('Row limit validation', () => {
    it('should parse CSV with exactly MAX_ROWS rows', () => {
      const rows = Array.from({ length: MAX_ROWS }, (_, i) => `"Name ${i}","Value ${i}"`).join(
        '\n'
      );
      const csv = `name,value\n${rows}`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(MAX_ROWS);
    });

    it('should reject CSV with more than MAX_ROWS rows', () => {
      const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `"Name ${i}","Value ${i}"`).join(
        '\n'
      );
      const csv = `name,value\n${rows}`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(`CSV file exceeds maximum row limit of ${MAX_ROWS}`);
      // Should only process up to the limit
      expect(result.rows).toHaveLength(MAX_ROWS);
    });

    it('should accept custom maxRows parameter', () => {
      const rows = Array.from({ length: 5 }, (_, i) => `"Name ${i}","Value ${i}"`).join('\n');
      const csv = `name,value\n${rows}`;

      const result = parseGenericCSV(csv, 3);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('exceeds maximum row limit of 3');
      expect(result.rows).toHaveLength(3);
    });
  });

  describe('CSV validation errors', () => {
    it('should reject completely empty CSV', () => {
      const csv = '';

      const result = parseGenericCSV(csv);

      expect(result.errors).toContain('CSV file is empty');
      expect(result.headers).toEqual([]);
      expect(result.rows).toEqual([]);
    });

    it('should reject CSV with only whitespace', () => {
      const csv = '   \n  \n  ';

      const result = parseGenericCSV(csv);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject CSV with only headers (no data rows)', () => {
      const csv = 'name,value';

      const result = parseGenericCSV(csv);

      expect(result.errors).toContain('CSV file must contain at least one data row');
      expect(result.headers).toEqual(['name', 'value']);
      expect(result.rows).toEqual([]);
    });

    it('should reject CSV with missing headers', () => {
      const csv = ',,,\n1,2,3,4';

      const result = parseGenericCSV(csv);

      expect(result.errors).toContain('CSV file is missing headers');
    });

    it('should handle CSV with only empty data rows', () => {
      const csv = `name,value


      `;

      const result = parseGenericCSV(csv);

      expect(result.errors).toContain('CSV file must contain at least one data row');
    });
  });

  describe('Edge cases', () => {
    it('should handle CSV with single column', () => {
      const csv = `name
"John"
"Jane"
"Bob"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.headers).toEqual(['name']);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual({ name: 'John' });
    });

    it('should handle CSV with many columns', () => {
      const headers = Array.from({ length: 20 }, (_, i) => `col${i}`).join(',');
      const row1 = Array.from({ length: 20 }, (_, i) => `"value${i}"`).join(',');
      const csv = `${headers}\n${row1}`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.headers).toHaveLength(20);
      expect(result.rows[0]).toHaveProperty('col0', 'value0');
      expect(result.rows[0]).toHaveProperty('col19', 'value19');
    });

    it('should handle rows with fewer columns than headers', () => {
      const csv = `a,b,c,d
1,2,3
4,5,6,7`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ a: '1', b: '2', c: '3', d: '' });
      expect(result.rows[1]).toEqual({ a: '4', b: '5', c: '6', d: '7' });
    });

    it('should handle special characters in values', () => {
      const csv = `text,special
"Email: test@example.com","Special: !@#$%^&*()"
"Unicode: café","Emoji: 🎉"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].text).toBe('Email: test@example.com');
      expect(result.rows[1].special).toBe('Emoji: 🎉');
    });

    it('should handle numeric values as strings', () => {
      const csv = `int,float,negative
42,3.14,-100
0,0.001,9999`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].int).toBe('42');
      expect(result.rows[0].float).toBe('3.14');
      expect(result.rows[0].negative).toBe('-100');
    });

    it('should preserve header case sensitivity', () => {
      const csv = `Name,Email,Phone
"John","john@example.com","555-1234"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.headers).toEqual(['Name', 'Email', 'Phone']);
      expect(result.rows[0]).toHaveProperty('Name', 'John');
      expect(result.rows[0]).toHaveProperty('Email', 'john@example.com');
    });
  });

  describe('RFC 4180 compliance', () => {
    it('should handle quoted fields at start of line', () => {
      const csv = `a,b
"quoted",unquoted
"also quoted","also unquoted"`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].a).toBe('quoted');
      expect(result.rows[1].a).toBe('also quoted');
    });

    it('should handle fields with leading/trailing spaces outside quotes', () => {
      const csv = `a,b
  "spaced"  ,  unspaced`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].a).toBe('spaced');
      expect(result.rows[0].b).toBe('unspaced');
    });

    it('should handle consecutive double quotes as escaped quote', () => {
      const csv = `text
"She said ""hello"" to me"
"""Quoted start"""`;

      const result = parseGenericCSV(csv);

      expect(result.errors).toHaveLength(0);
      expect(result.rows[0].text).toBe('She said "hello" to me');
      expect(result.rows[1].text).toBe('"Quoted start"');
    });
  });
});
