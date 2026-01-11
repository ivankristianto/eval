/**
 * Test setup and fixtures for LLM-as-Judge training tests
 * Provides database initialization, cleanup, and fixture data
 */

import { afterAll, beforeAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type {
  Persona,
  CreatePersonaInput,
  TrainingPair,
  TrainingIteration,
} from '../src/types/training';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use in-memory database for tests
let testDb: Database.Database | null = null;

/**
 * Get or create test database
 * @returns The test database instance
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');
  }
  return testDb;
}

/**
 * Initialize test database with schema
 */
export function initializeTestDatabase(): void {
  const db = getTestDatabase();

  // Load main schema (includes all training tables)
  const schemaPath = join(__dirname, '../db/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

/**
 * Clean all training-related tables
 */
export function cleanTestDatabase(): void {
  const db = getTestDatabase();

  // Delete in correct order to respect foreign keys
  db.exec('DELETE FROM training_loop_checkpoints');
  db.exec('DELETE FROM training_loop_state');
  db.exec('DELETE FROM task_prompt_versions');
  db.exec('DELETE FROM judge_prompt_versions');
  db.exec('DELETE FROM iteration_metrics');
  db.exec('DELETE FROM human_reviews');
  db.exec('DELETE FROM judge_decisions');
  db.exec('DELETE FROM training_iterations');
  db.exec('DELETE FROM training_pairs');
  db.exec('DELETE FROM personas');
  // Clean ModelConfiguration last (after personas are deleted due to FK constraints)
  db.exec('DELETE FROM ModelConfiguration');
}

/**
 * Close test database connection
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

// ===== Test Fixtures =====

/**
 * Create a test model configuration
 * @param db
 * @param provider
 * @returns The ID of the created model configuration
 */
export function createTestModelConfig(db: Database.Database, provider: string = 'openai'): string {
  const id = uuidv4();
  const modelName = `${provider}-test-model-${id.slice(0, 8)}`;
  const stmt = db.prepare(`
    INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  stmt.run(id, provider, modelName, 'encrypted-test-key');
  return id;
}

/**
 * Create test persona fixture
 * @param db
 * @param overrides
 * @returns The created persona object
 */
export function createTestPersona(
  db: Database.Database,
  overrides?: Partial<CreatePersonaInput>
): Persona {
  // Create three model configs from different providers
  const taskModelId = createTestModelConfig(db, 'openai');
  const judgeModelId = createTestModelConfig(db, 'anthropic');
  const promptEngineerModelId = createTestModelConfig(db, 'google');

  const id = uuidv4();
  const now = new Date().toISOString();

  const input: CreatePersonaInput = {
    name: `Test Persona ${id.slice(0, 8)}`,
    description: 'Test persona for automated tests',
    initial_task_prompt: 'Evaluate customer support responses',
    initial_judge_prompt: 'Judge the quality of the response',
    task_model_id: taskModelId,
    judge_model_id: judgeModelId,
    prompt_engineer_model_id: promptEngineerModelId,
    target_pass_rate: 0.8,
    ...overrides,
  };

  const stmt = db.prepare(`
    INSERT INTO personas (
      id, name, description,
      task_model_id, judge_model_id, prompt_engineer_model_id,
      status, target_pass_rate,
      created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.name,
    input.description || null,
    input.task_model_id,
    input.judge_model_id,
    input.prompt_engineer_model_id,
    'draft',
    input.target_pass_rate || 0.8,
    now,
    now,
    input.created_by || null
  );

  const taskPromptVersionId = uuidv4();
  const taskPromptStmt = db.prepare(`
    INSERT INTO task_prompt_versions (
      id, persona_id, version_number, prompt_text,
      improvement_rationale, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  taskPromptStmt.run(
    taskPromptVersionId,
    id,
    0,
    input.initial_task_prompt,
    'Initial task prompt provided during persona creation',
    'human',
    now
  );

  const judgePromptVersionId = uuidv4();
  const promptVersionStmt = db.prepare(`
    INSERT INTO judge_prompt_versions (
      id, persona_id, version_number, prompt_text,
      improvement_rationale, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  promptVersionStmt.run(
    judgePromptVersionId,
    id,
    0, // version 0 is the initial prompt
    input.initial_judge_prompt,
    'Initial judge prompt provided during persona creation',
    'human',
    now
  );

  db.prepare(
    `UPDATE personas
     SET current_task_prompt_version_id = ?, current_judge_prompt_version_id = ?
     WHERE id = ?`
  ).run(taskPromptVersionId, judgePromptVersionId, id);

  const selectStmt = db.prepare('SELECT * FROM personas WHERE id = ?');
  return selectStmt.get(id) as Persona;
}

/**
 * Create test training pairs
 * @param db
 * @param personaId
 * @param count
 * @returns Array of created training pairs
 */
export function createTestTrainingPairs(
  db: Database.Database,
  personaId: string,
  count: number = 10
): TrainingPair[] {
  const stmt = db.prepare(`
    INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const pairs: TrainingPair[] = [];

  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    stmt.run(id, personaId, `Test input ${i + 1}`, `Expected output ${i + 1}`, now);

    const selectStmt = db.prepare('SELECT * FROM training_pairs WHERE id = ?');
    pairs.push(selectStmt.get(id) as TrainingPair);
  }

  return pairs;
}

/**
 * Create test training iteration
 * @param db
 * @param personaId
 * @param iterationNumber
 * @param judgePromptText
 * @returns The created training iteration object
 */
export function createTestIteration(
  db: Database.Database,
  personaId: string,
  iterationNumber: number = 1,
  judgePromptText: string = 'Test judge prompt'
): TrainingIteration {
  // Get persona to get judge model ID
  const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as Persona;

  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO training_iterations (
      id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
      status, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    personaId,
    iterationNumber,
    persona.judge_model_id,
    judgePromptText,
    'in_progress',
    now
  );

  const selectStmt = db.prepare('SELECT * FROM training_iterations WHERE id = ?');
  return selectStmt.get(id) as TrainingIteration;
}

/**
 * Sample training data for CSV upload tests
 */
export const SAMPLE_CSV_DATA = `input,expected_output
"How do I reset my password?","Click 'Forgot Password' on the login page"
"What are your business hours?","We are open Monday-Friday 9am-5pm EST"
"Where is my order?","Track your order using the tracking number sent via email"
"How do I cancel my subscription?","Go to Account > Subscriptions > Cancel"
"What payment methods do you accept?","We accept Visa, Mastercard, American Express, and PayPal"
"Do you offer refunds?","Yes, we offer full refunds within 30 days of purchase"
"How do I contact support?","Email support@example.com or call 1-800-555-0100"
"Can I change my shipping address?","Yes, update your address in Account > Shipping Settings"
"What is your return policy?","30-day return policy with original receipt required"
"Do you ship internationally?","Yes, we ship to over 100 countries worldwide"`;

/**
 * Alternative CSV column names (for testing flexible parsing)
 */
export const ALTERNATIVE_CSV_DATA = `Input A,Correct Output
"Query 1","Response 1"
"Query 2","Response 2"
"Query 3","Response 3"
"Query 4","Response 4"
"Query 5","Response 5"
"Query 6","Response 6"
"Query 7","Response 7"
"Query 8","Response 8"
"Query 9","Response 9"
"Query 10","Response 10"`;

/**
 * Sample judge decisions for metrics tests
 */
export interface SampleDecisionData {
  judgeAgrees: boolean;
  humanAgrees: boolean;
}

export const SAMPLE_DECISIONS: SampleDecisionData[] = [
  { judgeAgrees: true, humanAgrees: true }, // TP
  { judgeAgrees: true, humanAgrees: true }, // TP
  { judgeAgrees: true, humanAgrees: true }, // TP
  { judgeAgrees: true, humanAgrees: false }, // FP
  { judgeAgrees: false, humanAgrees: true }, // FN
  { judgeAgrees: false, humanAgrees: false }, // TN
  { judgeAgrees: false, humanAgrees: false }, // TN
  { judgeAgrees: true, humanAgrees: true }, // TP
  { judgeAgrees: true, humanAgrees: true }, // TP
  { judgeAgrees: false, humanAgrees: false }, // TN
];

// Expected metrics for SAMPLE_DECISIONS:
// TP=5, TN=3, FP=1, FN=1
// Precision = 5/(5+1) = 0.833
// Recall = 5/(5+1) = 0.833
// F1 = 2 * (0.833 * 0.833) / (0.833 + 0.833) = 0.833
// Accuracy = (5+3)/10 = 0.8

/**
 * Default test lifecycle hooks
 */
export function setupTestLifecycle(): void {
  beforeAll(() => {
    initializeTestDatabase();
  });

  beforeEach(() => {
    cleanTestDatabase();
  });

  afterAll(() => {
    closeTestDatabase();
  });
}

/**
 * Initialize a test database (alias for convenience)
 * @returns The initialized test database
 */
export function initTestDb(): Database.Database {
  const db = getTestDatabase();
  // Re-initialize schema if needed
  try {
    db.prepare('SELECT 1 FROM personas LIMIT 1').get();
  } catch {
    initializeTestDatabase();
  }
  return db;
}

/**
 * Clean up test database (alias for convenience)
 * @param _db - Database to clean
 */
export function cleanupTestDb(_db: Database.Database): void {
  cleanTestDatabase();
}
