#!/usr/bin/env node
// Template seeder script for AI Model Evaluation Framework
// Seeds the database with useful evaluation templates using all active models

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { RubricType } from '../src/lib/utils/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use EVAL_DB_PATH env var if set, otherwise default to evaluation.db
const DB_PATH = import.meta.env?.EVAL_DB_PATH || process.env.EVAL_DB_PATH || join(__dirname, 'evaluation.db');

/**
 * Template definition for seeding.
 * model_ids will be populated dynamically from active models.
 */
interface TemplateDefinition {
  name: string;
  description: string;
  instruction_text: string;
  accuracy_rubric: RubricType;
  expected_output?: string;
  partial_credit_concepts?: string[];
  system_prompt?: string;
  temperature: number;
}

/**
 * Template definitions to seed.
 * model_ids will be populated dynamically from active models.
 */
const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: 'Code Generation - Binary Search',
    description: 'Evaluate models on implementing binary search algorithm',
    instruction_text: 'Write a function in JavaScript that performs binary search on a sorted array. The function should take a sorted array of numbers and a target value, then return the index of the target if found, or -1 if not found.',
    accuracy_rubric: 'exact_match',
    expected_output: 'function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}',
    partial_credit_concepts: undefined,
    system_prompt: 'You are an expert software developer. Write clean, efficient, and well-documented code.',
    temperature: 0.3,
  },
  {
    name: 'Code Generation - Fetch with Retry',
    description: 'Evaluate models on implementing async fetch with retry logic',
    instruction_text: 'Write a JavaScript function that fetches data from a URL with automatic retry on failure. The function should accept a URL, maximum retry count, and delay between retries. It should throw an error if all retries fail.',
    accuracy_rubric: 'partial_credit',
    expected_output: undefined,
    partial_credit_concepts: ['async_await', 'error_handling', 'retry_logic', 'type_safety'],
    system_prompt: 'You are a computer science expert. Implement robust solutions with proper error handling and modern JavaScript patterns.',
    temperature: 0.2,
  },
  {
    name: 'Text Summarization - Article',
    description: 'Evaluate models on summarizing a technical article',
    instruction_text: 'Summarize the following article in 2-3 sentences:\n\nTypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale. It adds static type definitions, allowing developers to catch errors during development rather than at runtime. TypeScript compiles to plain JavaScript that runs on any browser, in Node.js, or in any JavaScript engine. Major frameworks like Angular, React, and Vue have strong TypeScript support.',
    accuracy_rubric: 'semantic_similarity',
    expected_output: 'TypeScript is a typed superset of JavaScript that enables static type checking for early error detection. It compiles to standard JavaScript for cross-platform compatibility. Major frameworks including Angular, React, and Vue provide robust TypeScript support.',
    partial_credit_concepts: undefined,
    system_prompt: 'You are a professional editor. Create concise, accurate summaries that capture key information.',
    temperature: 0.5,
  },
  {
    name: 'Question Answering - Context Based',
    description: 'Evaluate models on answering questions from provided context',
    instruction_text: 'Answer the following question based only on the context below.\n\nContext: The Photosynthesis process occurs in plant leaves, specifically within chloroplasts. Plants absorb sunlight through chlorophyll, convert CO2 and water into glucose and oxygen. This process requires light energy and typically occurs during daylight hours.\n\nQuestion: Where does photosynthesis primarily occur in plants?',
    accuracy_rubric: 'semantic_similarity',
    expected_output: 'Photosynthesis primarily occurs in plant leaves, specifically within chloroplasts.',
    partial_credit_concepts: undefined,
    system_prompt: 'You are a helpful assistant. Answer questions accurately based only on the provided context.',
    temperature: 0.3,
  },
  {
    name: 'Creative Writing - Short Story',
    description: 'Evaluate models on writing a short science fiction story',
    instruction_text: 'Write a short science fiction story (approximately 150 words) about an astronaut who discovers a mysterious signal while alone on a space station.',
    accuracy_rubric: 'semantic_similarity',
    expected_output: undefined,
    partial_credit_concepts: ['narrative_creativity', 'story_structure', 'character_development', 'atmosphere'],
    system_prompt: 'You are a creative writer. Craft engaging stories with vivid descriptions and compelling narratives.',
    temperature: 0.8,
  },
  {
    name: 'SQL Query - Join Aggregation',
    description: 'Evaluate models on generating SQL queries with joins and aggregations',
    instruction_text: 'Write a SQL query to find the top 3 customers who have spent the most money. Use the tables: customers(id, name, email) and orders(id, customer_id, total). Return customer name and total amount spent.',
    accuracy_rubric: 'exact_match',
    expected_output: 'SELECT c.name, SUM(o.total) as total_spent FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY total_spent DESC LIMIT 3;',
    partial_credit_concepts: ['join_syntax', 'aggregation', 'ordering', 'limit'],
    system_prompt: 'You are a database expert. Write efficient, correct SQL queries following best practices.',
    temperature: 0.2,
  },
  {
    name: 'JSON API Response - User Profile',
    description: 'Evaluate models on generating properly formatted JSON API responses',
    instruction_text: 'Generate a JSON API response for a successful user profile retrieval. Include status, data (with id, name, email, createdAt fields), and error fields. Use realistic sample data.',
    accuracy_rubric: 'exact_match',
    expected_output: '{"status":"success","data":{"id":"usr_12345","name":"Jane Doe","email":"jane.doe@example.com","createdAt":"2024-01-15T10:30:00Z"},"error":null}',
    partial_credit_concepts: undefined,
    system_prompt: 'You are a backend API developer. Return properly formatted JSON responses following REST conventions.',
    temperature: 0.1,
  },
  {
    name: 'Code Explanation - Array Reduce',
    description: 'Evaluate models on explaining array reduce method to beginners',
    instruction_text: 'Explain the following JavaScript code in simple terms suitable for a beginner programmer:\n\nconst sum = numbers.reduce((acc, num) => acc + num, 0);',
    accuracy_rubric: 'semantic_similarity',
    expected_output: 'The reduce method processes an array to produce a single value. It takes a function that runs on each element. The accumulator (acc) holds the running total, starting at 0. For each number, it adds to the accumulator. The final result is the sum of all numbers in the array.',
    partial_credit_concepts: ['clarity', 'accuracy', 'beginner_friendly'],
    system_prompt: 'You are a programming instructor. Explain code concepts clearly and patiently.',
    temperature: 0.4,
  },
];

/**
 * Options for seeding templates.
 */
interface SeedOptions {
  dryRun?: boolean;
  verbose?: boolean;
  reset?: boolean;
}

/**
 * Model record from database.
 */
interface ModelRecord {
  id: string;
  model_name: string;
  provider: string;
}

/**
 * Deletes all templates from the database.
 *
 * @param db - Database instance
 * @returns Number of templates deleted
 */
function deleteAllTemplates(db: Database.Database): number {
  const result = db.prepare('DELETE FROM EvaluationTemplate').run();
  return result.changes;
}

/**
 * Seeds templates into the database.
 * Checks for existing models and uses all active models.
 *
 * @param options - Seeder options
 */
function seedTemplates(options: SeedOptions = {}): void {
  const { dryRun = false, verbose = false, reset = false } = options;

  console.log(reset ? 'Resetting evaluation templates...' : 'Seeding evaluation templates...');
  console.log(`Database path: ${DB_PATH}`);

  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Get all active models
    const models = db
      .prepare('SELECT id, model_name, provider FROM ModelConfiguration WHERE is_active = 1')
      .all() as ModelRecord[];

    if (models.length === 0) {
      console.error('No active models found in database. Please add models first.');
      console.log('You can add models via the UI or API.');
      db.close();
      process.exit(1);
    }

    console.log(`Found ${models.length} active model(s):`);
    models.forEach((model) => {
      console.log(`  - ${model.provider}/${model.model_name} (id: ${model.id})`);
    });

    const modelIds = models.map((m) => m.id);

    if (dryRun) {
      console.log('\n[Dry run] Would create the following templates:');
      TEMPLATE_DEFINITIONS.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name}`);
        console.log(`     Description: ${template.description}`);
        console.log(`     Models: ${modelIds.length} model(s)`);
      });
      db.close();
      return;
    }

    // If reset mode, delete all existing templates first
    let existingTemplateNames: string[] = [];
    if (reset) {
      const deletedCount = deleteAllTemplates(db);
      console.log(`Deleted ${deletedCount} existing template(s).`);
    } else {
      // Check for existing templates to avoid duplicates
      existingTemplateNames = (db
        .prepare('SELECT name FROM EvaluationTemplate')
        .all() as { name: string }[])
        .map((t) => t.name);
    }

    let createdCount = 0;
    let skippedCount = 0;

    // Seed templates
    for (const template of TEMPLATE_DEFINITIONS) {
      if (!reset && existingTemplateNames.includes(template.name)) {
        if (verbose) {
          console.log(`  Skipped: "${template.name}" (already exists)`);
        }
        skippedCount++;
        continue;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO EvaluationTemplate (
          id, name, description, instruction_text, model_ids, accuracy_rubric,
          expected_output, partial_credit_concepts, created_at, updated_at,
          run_count, system_prompt, temperature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);

      stmt.run(
        id,
        template.name,
        template.description,
        template.instruction_text,
        JSON.stringify(modelIds),
        template.accuracy_rubric,
        template.expected_output || null,
        template.partial_credit_concepts ? JSON.stringify(template.partial_credit_concepts) : null,
        now,
        now,
        template.system_prompt || null,
        template.temperature ?? 0.3
      );

      console.log(`  Created: "${template.name}"`);
      createdCount++;
    }

    // Get total count before closing
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM EvaluationTemplate').get() as {
      count: number;
    };

    db.close();

    console.log(`\n${reset ? 'Reset' : 'Seeding'} complete:`);
    console.log(`  - Created: ${createdCount} template(s)`);
    if (!reset) {
      console.log(`  - Skipped: ${skippedCount} existing template(s)`);
    }
    console.log(`  - Total templates available: ${totalCount.count}`);
  } catch (error) {
    console.error('Failed to seed templates:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// CLI entry point
function main(): void {
  const args = process.argv.slice(2);
  const options: SeedOptions = {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    reset: args.includes('--reset') || args.includes('-r'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run db:seed:templates [options]

Options:
  --reset, -r       Delete all existing templates before seeding (fresh start)
  --dry-run, -n     Show what would be created without making changes
  --verbose, -v     Show detailed output including skipped templates
  --help, -h        Show this help message

Environment variables:
  EVAL_DB_PATH      Path to database file (default: ./db/evaluation.db)

Examples:
  npm run db:seed:templates              # Seed templates (skip existing)
  npm run db:seed:templates -- --reset   # Delete all templates and reseed
  npm run db:seed:templates -- --dry-run # Preview what would be created
`);
    return;
  }

  seedTemplates(options);
}

// Run if executed directly
main();

export { seedTemplates, type SeedOptions, type TemplateDefinition };
