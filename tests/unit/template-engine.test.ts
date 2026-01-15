/**
 * Template Engine Unit Tests
 * Tests for template interpolation with {{key}} placeholder syntax
 */

import { describe, it, expect } from 'vitest';
import {
  interpolateTemplate,
  extractTemplateKeys,
  validateTemplate,
} from '@lib/utils/template-engine';

describe('Template Engine', () => {
  describe('interpolateTemplate - Basic interpolation', () => {
    it('should replace simple {{key}} placeholders', () => {
      const result = interpolateTemplate('Hello {{name}}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('should replace multiple placeholders in one template', () => {
      const result = interpolateTemplate('Hello {{firstName}} {{lastName}}', {
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result).toBe('Hello John Doe');
    });

    it('should handle placeholders at start of string', () => {
      const result = interpolateTemplate('{{greeting}} World', {
        greeting: 'Hello',
      });
      expect(result).toBe('Hello World');
    });

    it('should handle placeholders at end of string', () => {
      const result = interpolateTemplate('Hello {{name}}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('should handle placeholder-only string', () => {
      const result = interpolateTemplate('{{value}}', { value: '42' });
      expect(result).toBe('42');
    });

    it('should convert numbers to strings', () => {
      const result = interpolateTemplate('Count: {{count}}', { count: 42 });
      expect(result).toBe('Count: 42');
    });

    it('should convert booleans to strings', () => {
      const result = interpolateTemplate('Active: {{active}}', { active: true });
      expect(result).toBe('Active: true');
    });

    it('should convert null to string', () => {
      const result = interpolateTemplate('Value: {{value}}', { value: null });
      expect(result).toBe('Value: null');
    });

    it('should handle empty string values', () => {
      const result = interpolateTemplate('Name: {{name}}', { name: '' });
      expect(result).toBe('Name: ');
    });
  });

  describe('interpolateTemplate - Nested object access', () => {
    it('should access nested properties with dot notation', () => {
      const result = interpolateTemplate('User: {{user.name}}', {
        user: { name: 'Alice' },
      });
      expect(result).toBe('User: Alice');
    });

    it('should access deeply nested properties', () => {
      const result = interpolateTemplate('Profile: {{user.profile.age}}', {
        user: { profile: { age: 30 } },
      });
      expect(result).toBe('Profile: 30');
    });

    it('should handle multiple nested placeholders', () => {
      const result = interpolateTemplate('User: {{user.name}}, Email: {{user.email}}', {
        user: { name: 'Bob', email: 'bob@example.com' },
      });
      expect(result).toBe('User: Bob, Email: bob@example.com');
    });

    it('should mix nested and simple placeholders', () => {
      const result = interpolateTemplate('{{greeting}} {{user.name}}, your role is {{role}}', {
        greeting: 'Hello',
        user: { name: 'Charlie' },
        role: 'Admin',
      });
      expect(result).toBe('Hello Charlie, your role is Admin');
    });

    it('should handle keys with dots as direct property names', () => {
      const result = interpolateTemplate('Value: {{user.name}}', {
        'user.name': 'Direct key value',
      });
      expect(result).toBe('Value: Direct key value');
    });

    it('should prefer direct key match over nested traversal', () => {
      const result = interpolateTemplate('Value: {{user.name}}', {
        'user.name': 'Direct key',
        user: { name: 'Nested value' },
      });
      expect(result).toBe('Value: Direct key');
    });
  });

  describe('interpolateTemplate - Missing key handling', () => {
    it('should replace missing key with empty string by default', () => {
      const result = interpolateTemplate('Hello {{name}}', {});
      expect(result).toBe('Hello ');
    });

    it('should replace only missing keys and keep present ones', () => {
      const result = interpolateTemplate('Hello {{firstName}} {{lastName}}', { firstName: 'John' });
      expect(result).toBe('Hello John ');
    });

    it('should leave placeholder intact when leavePlaceholder is true', () => {
      const result = interpolateTemplate(
        'Hello {{name}}',
        {},
        {
          leavePlaceholder: true,
        }
      );
      expect(result).toBe('Hello {{name}}');
    });

    it('should handle mix of missing and present keys with leavePlaceholder', () => {
      const result = interpolateTemplate(
        'Hello {{firstName}} {{lastName}}',
        { firstName: 'John' },
        { leavePlaceholder: true }
      );
      expect(result).toBe('Hello John {{lastName}}');
    });

    it('should return empty string for template with only missing placeholder', () => {
      const result = interpolateTemplate('{{missing}}', {});
      expect(result).toBe('');
    });

    it('should handle nested missing key', () => {
      const result = interpolateTemplate('User: {{user.name}}', {
        user: { email: 'test@example.com' },
      });
      expect(result).toBe('User: ');
    });

    it('should handle missing intermediate key in nested path', () => {
      const result = interpolateTemplate('Profile: {{user.profile.age}}', {
        user: { name: 'Alice' },
      });
      expect(result).toBe('Profile: ');
    });

    it('should handle null values in nested path', () => {
      const result = interpolateTemplate('Profile: {{user.profile.age}}', {
        user: null,
      });
      expect(result).toBe('Profile: ');
    });
  });

  describe('interpolateTemplate - Unicode and emoji support', () => {
    it('should handle emoji in values', () => {
      const result = interpolateTemplate('Emoji: {{emoji}}', { emoji: '🎉' });
      expect(result).toBe('Emoji: 🎉');
    });

    it('should handle multiple emojis', () => {
      const result = interpolateTemplate('Mood: {{emoji1}} {{emoji2}}', {
        emoji1: '😀',
        emoji2: '🚀',
      });
      expect(result).toBe('Mood: 😀 🚀');
    });

    it('should handle Unicode text', () => {
      const result = interpolateTemplate('Greeting: {{greeting}}', {
        greeting: 'こんにちは',
      });
      expect(result).toBe('Greeting: こんにちは');
    });

    it('should handle mixed Unicode and ASCII', () => {
      const result = interpolateTemplate('{{emoji}} Hello {{name}}', {
        emoji: '👋',
        name: '世界',
      });
      expect(result).toBe('👋 Hello 世界');
    });

    it('should handle emoji with skin tone modifiers', () => {
      const result = interpolateTemplate('Wave: {{wave}}', {
        wave: '👋🏽',
      });
      expect(result).toBe('Wave: 👋🏽');
    });

    it('should handle complex emoji sequences (ZWJ)', () => {
      const result = interpolateTemplate('Family: {{family}}', {
        family: '👨‍👩‍👧‍👦',
      });
      expect(result).toBe('Family: 👨‍👩‍👧‍👦');
    });
  });

  describe('interpolateTemplate - Special characters and edge cases', () => {
    it('should handle newlines in values', () => {
      const result = interpolateTemplate('Text: {{text}}', {
        text: 'Line 1\nLine 2',
      });
      expect(result).toBe('Text: Line 1\nLine 2');
    });

    it('should handle tabs in values', () => {
      const result = interpolateTemplate('Text: {{text}}', { text: 'Col1\tCol2' });
      expect(result).toBe('Text: Col1\tCol2');
    });

    it('should handle special regex characters in values', () => {
      const result = interpolateTemplate('Pattern: {{pattern}}', {
        pattern: '$1.00',
      });
      expect(result).toBe('Pattern: $1.00');
    });

    it('should handle curly braces in values', () => {
      const result = interpolateTemplate('JSON: {{json}}', {
        json: '{"key": "value"}',
      });
      expect(result).toBe('JSON: {"key": "value"}');
    });

    it('should handle values with placeholder-like patterns', () => {
      const result = interpolateTemplate('Template: {{template}}', {
        template: 'Use {{name}} here',
      });
      expect(result).toBe('Template: Use {{name}} here');
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(10000);
      const result = interpolateTemplate('Text: {{text}}', { text: longValue });
      expect(result).toBe(`Text: ${longValue}`);
    });

    it('should handle zero as a value', () => {
      const result = interpolateTemplate('Count: {{count}}', { count: 0 });
      expect(result).toBe('Count: 0');
    });

    it('should handle false as a value', () => {
      const result = interpolateTemplate('Active: {{active}}', { active: false });
      expect(result).toBe('Active: false');
    });

    it('should handle empty template string', () => {
      const result = interpolateTemplate('', { name: 'Test' });
      expect(result).toBe('');
    });

    it('should handle template with no placeholders', () => {
      const result = interpolateTemplate('Hello World', { name: 'Test' });
      expect(result).toBe('Hello World');
    });

    it('should handle consecutive placeholders', () => {
      const result = interpolateTemplate('{{a}}{{b}}{{c}}', {
        a: 'A',
        b: 'B',
        c: 'C',
      });
      expect(result).toBe('ABC');
    });

    it('should handle placeholder with underscore in key name', () => {
      const result = interpolateTemplate('Value: {{first_name}}', {
        first_name: 'John',
      });
      expect(result).toBe('Value: John');
    });

    it('should handle placeholder with numbers in key name', () => {
      const result = interpolateTemplate('Value: {{item1}}', { item1: 'first' });
      expect(result).toBe('Value: first');
    });

    it('should handle values with leading/trailing whitespace', () => {
      const result = interpolateTemplate('Text: {{text}}', {
        text: '  padded  ',
      });
      expect(result).toBe('Text:   padded  ');
    });
  });

  describe('interpolateTemplate - Array handling', () => {
    it('should convert array to comma-separated string', () => {
      const result = interpolateTemplate('Items: {{items}}', {
        items: ['apple', 'banana', 'cherry'],
      });
      expect(result).toBe('Items: apple,banana,cherry');
    });

    it('should convert empty array to empty string', () => {
      const result = interpolateTemplate('Items: {{items}}', { items: [] });
      expect(result).toBe('Items: ');
    });

    it('should handle array of numbers', () => {
      const result = interpolateTemplate('Numbers: {{nums}}', { nums: [1, 2, 3] });
      expect(result).toBe('Numbers: 1,2,3');
    });

    it('should handle nested arrays', () => {
      const result = interpolateTemplate('Nested: {{nested}}', {
        nested: [
          [1, 2],
          [3, 4],
        ],
      });
      expect(result).toBe('Nested: 1,2,3,4');
    });
  });

  describe('extractTemplateKeys', () => {
    it('should extract single placeholder key', () => {
      const keys = extractTemplateKeys('Hello {{name}}');
      expect(keys).toEqual(['name']);
    });

    it('should extract multiple unique keys', () => {
      const keys = extractTemplateKeys('Hello {{firstName}} {{lastName}}');
      expect(keys).toEqual(['firstName', 'lastName']);
    });

    it('should return only unique keys (no duplicates)', () => {
      const keys = extractTemplateKeys('{{name}} is {{name}}');
      expect(keys).toEqual(['name']);
    });

    it('should extract nested keys', () => {
      const keys = extractTemplateKeys('{{user.name}} and {{user.email}}');
      expect(keys).toEqual(['user.name', 'user.email']);
    });

    it('should return empty array for template with no placeholders', () => {
      const keys = extractTemplateKeys('Hello World');
      expect(keys).toEqual([]);
    });

    it('should return empty array for empty template', () => {
      const keys = extractTemplateKeys('');
      expect(keys).toEqual([]);
    });

    it('should handle keys with underscores and numbers', () => {
      const keys = extractTemplateKeys('{{item_1}} and {{item_2}}');
      expect(keys).toEqual(['item_1', 'item_2']);
    });
  });

  describe('validateTemplate', () => {
    it('should return valid when all keys are present', () => {
      const result = validateTemplate('Hello {{name}}', { name: 'World' });
      expect(result.valid).toBe(true);
      expect(result.missingKeys).toEqual([]);
    });

    it('should return invalid when key is missing', () => {
      const result = validateTemplate('Hello {{name}}', {});
      expect(result.valid).toBe(false);
      expect(result.missingKeys).toEqual(['name']);
    });

    it('should list all missing keys', () => {
      const result = validateTemplate('Hello {{firstName}} {{lastName}}', { firstName: 'John' });
      expect(result.valid).toBe(false);
      expect(result.missingKeys).toEqual(['lastName']);
    });

    it('should validate nested keys', () => {
      const result = validateTemplate('{{user.name}} and {{user.email}}', {
        user: { name: 'Alice' },
      });
      expect(result.valid).toBe(false);
      expect(result.missingKeys).toEqual(['user.email']);
    });

    it('should be valid when nested keys exist', () => {
      const result = validateTemplate('{{user.name}} and {{user.email}}', {
        user: { name: 'Alice', email: 'alice@example.com' },
      });
      expect(result.valid).toBe(true);
      expect(result.missingKeys).toEqual([]);
    });

    it('should handle template with no placeholders', () => {
      const result = validateTemplate('Hello World', {});
      expect(result.valid).toBe(true);
      expect(result.missingKeys).toEqual([]);
    });

    it('should handle empty template', () => {
      const result = validateTemplate('', {});
      expect(result.valid).toBe(true);
      expect(result.missingKeys).toEqual([]);
    });
  });

  describe('interpolateTemplate - Real-world bulk evaluation scenarios', () => {
    it('should handle CSV-style evaluation template', () => {
      const template = 'Evaluate the following: "{{question}}"\nExpected: {{answer}}';
      const data = {
        question: 'What is the capital of France?',
        answer: 'Paris',
      };
      const result = interpolateTemplate(template, data);
      expect(result).toContain('What is the capital of France?');
      expect(result).toContain('Paris');
    });

    it('should handle template with multiple row data', () => {
      const template = 'Task: {{task}}\nInput: {{input}}\nContext: {{context}}';
      const data = {
        task: 'Summarize',
        input: 'Long text about AI...',
        context: 'Technical documentation',
      };
      const result = interpolateTemplate(template, data);
      expect(result).toBe(
        'Task: Summarize\nInput: Long text about AI...\nContext: Technical documentation'
      );
    });

    it('should handle product description template', () => {
      const template =
        'Product: {{product.name}}\nPrice: ${{product.price}}\nCategory: {{product.category}}';
      const data = {
        product: {
          name: 'Wireless Mouse',
          price: '29.99',
          category: 'Electronics',
        },
      };
      const result = interpolateTemplate(template, data);
      expect(result).toContain('Wireless Mouse');
      expect(result).toContain('29.99');
      expect(result).toContain('Electronics');
    });

    it('should handle missing optional fields in bulk data', () => {
      const template = 'Name: {{name}}, Email: {{email}}, Phone: {{phone}}';
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        // phone is missing
      };
      const result = interpolateTemplate(template, data);
      expect(result).toContain('John Doe');
      expect(result).toContain('john@example.com');
      expect(result).toContain('Phone: '); // Empty string for missing phone
    });
  });
});
