// src/lib/db.ts
// Database initialization and query functions for AI Model Evaluation Framework

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  ModelConfiguration,
  Evaluation,
  Result,
  EvaluationTemplate,
  Provider,
  RubricType,
  EvaluationStatus,
  ResultStatus,
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../../db/evaluation.db');
const SCHEMA_PATH = join(__dirname, '../../db/schema.sql');

let db: Database.Database | null = null;

// ===== Database Initialization =====

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initializeDatabase(): void {
  const database = getDatabase();
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  database.exec(schema);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ===== Encryption Utilities =====

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = import.meta.env?.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }
  return Buffer.from(key, 'hex');
}

export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ===== Model Configuration Queries =====

export function insertModel(
  provider: Provider,
  modelName: string,
  apiKey: string,
  notes?: string
): ModelConfiguration {
  const database = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  const apiKeyEncrypted = encryptApiKey(apiKey);

  const stmt = database.prepare(`
    INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at, is_active, notes)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);

  stmt.run(id, provider, modelName, apiKeyEncrypted, now, now, notes || null);

  return {
    id,
    provider,
    model_name: modelName,
    api_key_encrypted: apiKeyEncrypted,
    created_at: now,
    updated_at: now,
    is_active: true,
    notes,
  };
}

export function getModels(activeOnly = false, provider?: Provider): ModelConfiguration[] {
  const database = getDatabase();

  let query = 'SELECT * FROM ModelConfiguration';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (activeOnly) {
    conditions.push('is_active = 1');
  }
  if (provider) {
    conditions.push('provider = ?');
    params.push(provider);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  const rows = database.prepare(query).all(...params) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    provider: row.provider as Provider,
    model_name: row.model_name as string,
    api_key_encrypted: row.api_key_encrypted as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    is_active: Boolean(row.is_active),
    notes: row.notes as string | undefined,
  }));
}

export function getModelById(id: string): ModelConfiguration | null {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM ModelConfiguration WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    provider: row.provider as Provider,
    model_name: row.model_name as string,
    api_key_encrypted: row.api_key_encrypted as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    is_active: Boolean(row.is_active),
    notes: row.notes as string | undefined,
  };
}

export function updateModel(
  id: string,
  updates: Partial<{ is_active: boolean; notes: string; api_key: string }>
): ModelConfiguration | null {
  const database = getDatabase();
  const existing = getModelById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (updates.is_active !== undefined) {
    setClauses.push('is_active = ?');
    params.push(updates.is_active ? 1 : 0);
  }
  if (updates.notes !== undefined) {
    setClauses.push('notes = ?');
    params.push(updates.notes);
  }
  if (updates.api_key !== undefined) {
    setClauses.push('api_key_encrypted = ?');
    params.push(encryptApiKey(updates.api_key));
  }

  params.push(id);
  const stmt = database.prepare(
    `UPDATE ModelConfiguration SET ${setClauses.join(', ')} WHERE id = ?`
  );
  stmt.run(...params);

  return getModelById(id);
}

export function deleteModel(id: string): boolean {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM ModelConfiguration WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getModelUsageCount(id: string): number {
  const database = getDatabase();
  const row = database
    .prepare('SELECT COUNT(*) as count FROM Result WHERE model_id = ?')
    .get(id) as { count: number };
  return row.count;
}

export function hasActiveEvaluations(modelId: string): boolean {
  const database = getDatabase();
  const row = database
    .prepare(
      `
    SELECT COUNT(*) as count FROM Result r
    JOIN Evaluation e ON r.evaluation_id = e.id
    WHERE r.model_id = ? AND e.status IN ('pending', 'running')
  `
    )
    .get(modelId) as { count: number };
  return row.count > 0;
}

// ===== Evaluation Queries =====

export function insertEvaluation(
  instructionText: string,
  accuracyRubric: RubricType,
  expectedOutput?: string,
  partialCreditConcepts?: string[],
  templateId?: string
): Evaluation {
  const database = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO Evaluation (id, instruction_text, accuracy_rubric, expected_output, partial_credit_concepts, created_at, status, template_id)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  stmt.run(
    id,
    instructionText,
    accuracyRubric,
    expectedOutput || null,
    partialCreditConcepts ? JSON.stringify(partialCreditConcepts) : null,
    now,
    templateId || null
  );

  return {
    id,
    instruction_text: instructionText,
    accuracy_rubric: accuracyRubric,
    expected_output: expectedOutput,
    partial_credit_concepts: partialCreditConcepts,
    created_at: now,
    status: 'pending',
    template_id: templateId,
  };
}

export function getEvaluation(id: string): Evaluation | null {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM Evaluation WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    instruction_text: row.instruction_text as string,
    accuracy_rubric: row.accuracy_rubric as RubricType,
    expected_output: row.expected_output as string | undefined,
    partial_credit_concepts: row.partial_credit_concepts
      ? JSON.parse(row.partial_credit_concepts as string)
      : undefined,
    created_at: row.created_at as string,
    completed_at: row.completed_at as string | undefined,
    status: row.status as EvaluationStatus,
    error_message: row.error_message as string | undefined,
    template_id: row.template_id as string | undefined,
  };
}

export function updateEvaluationStatus(
  id: string,
  status: EvaluationStatus,
  errorMessage?: string
): void {
  const database = getDatabase();
  const completedAt =
    status === 'completed' || status === 'failed' ? new Date().toISOString() : null;

  database
    .prepare(
      `
    UPDATE Evaluation SET status = ?, completed_at = ?, error_message = ? WHERE id = ?
  `
    )
    .run(status, completedAt, errorMessage || null, id);
}

export function getEvaluations(templateId?: string, limit = 50, offset = 0): Evaluation[] {
  const database = getDatabase();

  let query = 'SELECT * FROM Evaluation';
  const params: unknown[] = [];

  if (templateId) {
    query += ' WHERE template_id = ?';
    params.push(templateId);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = database.prepare(query).all(...params) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    instruction_text: row.instruction_text as string,
    accuracy_rubric: row.accuracy_rubric as RubricType,
    expected_output: row.expected_output as string | undefined,
    partial_credit_concepts: row.partial_credit_concepts
      ? JSON.parse(row.partial_credit_concepts as string)
      : undefined,
    created_at: row.created_at as string,
    completed_at: row.completed_at as string | undefined,
    status: row.status as EvaluationStatus,
    error_message: row.error_message as string | undefined,
    template_id: row.template_id as string | undefined,
  }));
}

// ===== Result Queries =====

export function insertResult(evaluationId: string, modelId: string): Result {
  const database = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO Result (id, evaluation_id, model_id, status, created_at)
    VALUES (?, ?, ?, 'pending', ?)
  `);

  stmt.run(id, evaluationId, modelId, now);

  return {
    id,
    evaluation_id: evaluationId,
    model_id: modelId,
    status: 'pending',
    created_at: now,
  };
}

export function updateResult(
  id: string,
  updates: Partial<{
    response_text: string;
    execution_time_ms: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    accuracy_score: number;
    accuracy_reasoning: string;
    status: ResultStatus;
    error_message: string;
  }>
): void {
  const database = getDatabase();
  const setClauses: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) return;

  params.push(id);
  database.prepare(`UPDATE Result SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
}

export function getResults(
  evaluationId: string
): (Result & { model_name: string; provider: Provider })[] {
  const database = getDatabase();

  const rows = database
    .prepare(
      `
    SELECT r.*, m.model_name, m.provider
    FROM Result r
    JOIN ModelConfiguration m ON r.model_id = m.id
    WHERE r.evaluation_id = ?
    ORDER BY r.accuracy_score DESC NULLS LAST
  `
    )
    .all(evaluationId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    evaluation_id: row.evaluation_id as string,
    model_id: row.model_id as string,
    response_text: row.response_text as string | undefined,
    execution_time_ms: row.execution_time_ms as number | undefined,
    input_tokens: row.input_tokens as number | undefined,
    output_tokens: row.output_tokens as number | undefined,
    total_tokens: row.total_tokens as number | undefined,
    accuracy_score: row.accuracy_score as number | undefined,
    accuracy_reasoning: row.accuracy_reasoning as string | undefined,
    status: row.status as ResultStatus,
    error_message: row.error_message as string | undefined,
    created_at: row.created_at as string,
    model_name: row.model_name as string,
    provider: row.provider as Provider,
  }));
}

export function getEvaluationStatus(evaluationId: string): {
  overall_status: EvaluationStatus;
  created_at: string;
  completed_at?: string;
  results: {
    model_id: string;
    model_name: string;
    provider: string;
    status: ResultStatus;
    execution_time_ms?: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    accuracy_score?: number;
    error_message?: string;
  }[];
} | null {
  const evaluation = getEvaluation(evaluationId);
  if (!evaluation) return null;

  const results = getResults(evaluationId);

  return {
    overall_status: evaluation.status,
    created_at: evaluation.created_at,
    completed_at: evaluation.completed_at,
    results: results.map((r) => ({
      model_id: r.model_id,
      model_name: r.model_name,
      provider: r.provider,
      status: r.status,
      execution_time_ms: r.execution_time_ms,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      total_tokens: r.total_tokens,
      accuracy_score: r.accuracy_score,
      error_message: r.error_message,
    })),
  };
}

// ===== Template Queries =====

export function insertTemplate(
  name: string,
  instructionText: string,
  modelIds: string[],
  accuracyRubric: RubricType,
  description?: string,
  expectedOutput?: string,
  partialCreditConcepts?: string[]
): EvaluationTemplate {
  const database = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO EvaluationTemplate (id, name, description, instruction_text, model_ids, accuracy_rubric, expected_output, partial_credit_concepts, created_at, updated_at, run_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  stmt.run(
    id,
    name,
    description || null,
    instructionText,
    JSON.stringify(modelIds),
    accuracyRubric,
    expectedOutput || null,
    partialCreditConcepts ? JSON.stringify(partialCreditConcepts) : null,
    now,
    now
  );

  return {
    id,
    name,
    description,
    instruction_text: instructionText,
    model_ids: modelIds,
    accuracy_rubric: accuracyRubric,
    expected_output: expectedOutput,
    partial_credit_concepts: partialCreditConcepts,
    created_at: now,
    updated_at: now,
    run_count: 0,
  };
}

export function getTemplates(
  sortBy: 'created' | 'name' | 'run_count' = 'created',
  order: 'asc' | 'desc' = 'desc'
): EvaluationTemplate[] {
  const database = getDatabase();

  const sortColumn = sortBy === 'created' ? 'created_at' : sortBy === 'name' ? 'name' : 'run_count';
  const query = `SELECT * FROM EvaluationTemplate ORDER BY ${sortColumn} ${order.toUpperCase()}`;

  const rows = database.prepare(query).all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    instruction_text: row.instruction_text as string,
    model_ids: JSON.parse(row.model_ids as string),
    accuracy_rubric: row.accuracy_rubric as RubricType,
    expected_output: row.expected_output as string | undefined,
    partial_credit_concepts: row.partial_credit_concepts
      ? JSON.parse(row.partial_credit_concepts as string)
      : undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    run_count: row.run_count as number,
  }));
}

export function getTemplateById(id: string): EvaluationTemplate | null {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM EvaluationTemplate WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    instruction_text: row.instruction_text as string,
    model_ids: JSON.parse(row.model_ids as string),
    accuracy_rubric: row.accuracy_rubric as RubricType,
    expected_output: row.expected_output as string | undefined,
    partial_credit_concepts: row.partial_credit_concepts
      ? JSON.parse(row.partial_credit_concepts as string)
      : undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    run_count: row.run_count as number,
  };
}

export function updateTemplate(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    instruction_text: string;
    model_ids: string[];
    accuracy_rubric: RubricType;
    expected_output: string;
    partial_credit_concepts: string[];
  }>
): EvaluationTemplate | null {
  const database = getDatabase();
  const existing = getTemplateById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'model_ids' || key === 'partial_credit_concepts') {
      setClauses.push(`${key} = ?`);
      params.push(JSON.stringify(value));
    } else {
      setClauses.push(`${key} = ?`);
      params.push(value);
    }
  }

  params.push(id);
  database
    .prepare(`UPDATE EvaluationTemplate SET ${setClauses.join(', ')} WHERE id = ?`)
    .run(...params);

  return getTemplateById(id);
}

export function deleteTemplate(id: string): boolean {
  const database = getDatabase();
  const result = database.prepare('DELETE FROM EvaluationTemplate WHERE id = ?').run(id);
  return result.changes > 0;
}

export function incrementTemplateRunCount(id: string): void {
  const database = getDatabase();
  database
    .prepare('UPDATE EvaluationTemplate SET run_count = run_count + 1, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id);
}

export function getTemplateHistory(
  templateId: string,
  limit = 20,
  offset = 0
): {
  evaluation_id: string;
  created_at: string;
  status: EvaluationStatus;
  completed_at?: string;
  best_accuracy?: number;
  fastest_model?: { model_name: string; execution_time_ms: number };
  result_count: number;
}[] {
  const evaluations = getEvaluations(templateId, limit, offset);

  return evaluations.map((evaluation) => {
    const results = getResults(evaluation.id);
    const completedResults = results.filter((r) => r.status === 'completed');

    let bestAccuracy: number | undefined;
    let fastestModel: { model_name: string; execution_time_ms: number } | undefined;

    if (completedResults.length > 0) {
      const best = completedResults.reduce((a, b) =>
        (a.accuracy_score || 0) > (b.accuracy_score || 0) ? a : b
      );
      bestAccuracy = best.accuracy_score;

      const fastest = completedResults.reduce((a, b) =>
        (a.execution_time_ms || Infinity) < (b.execution_time_ms || Infinity) ? a : b
      );
      if (fastest.execution_time_ms !== undefined) {
        fastestModel = {
          model_name: fastest.model_name,
          execution_time_ms: fastest.execution_time_ms,
        };
      }
    }

    return {
      evaluation_id: evaluation.id,
      created_at: evaluation.created_at,
      status: evaluation.status,
      completed_at: evaluation.completed_at,
      best_accuracy: bestAccuracy,
      fastest_model: fastestModel,
      result_count: results.length,
    };
  });
}
