/**
 * Database access layer for bulk evaluation tables
 * Provides CRUD operations for bulk_datasets, evaluation_runs_bulk, and row_results
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './db';

// ===== Types =====

/**
 * Bulk dataset status and metadata
 */
export interface BulkDataset {
  id: string;
  filename: string;
  row_count: number;
  csv_data: string; // JSON stringified array of row objects
  created_at: string;
}

/**
 * Evaluation run configuration
 */
export interface EvaluationConfig {
  dataset_id: string;
  system_prompt: string;
  temperature: number;
  selected_models: string[];
}

/**
 * Evaluation run status tracking
 */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Evaluation run with all metadata
 */
export interface EvaluationRun {
  id: string;
  dataset_id: string;
  system_prompt: string;
  temperature: number;
  selected_models: string; // JSON stringified array
  status: RunStatus;
  total_rows: number;
  processed_rows: number;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

/**
 * Row result status
 */
export type RowResultStatus = 'pending' | 'completed' | 'failed';

/**
 * Single row evaluation result
 */
export interface RowResult {
  id: string;
  run_id: string;
  original_row_index: number;
  model_id: string;
  prompt_used: string;
  output_text?: string;
  status: RowResultStatus;
  error_message?: string;
  duration_ms?: number;
  created_at: string;
}

/**
 * Evaluation run with its associated dataset and results
 */
export interface EvaluationRunWithResults extends EvaluationRun {
  dataset: BulkDataset;
  results: RowResult[];
}

/**
 * Input type for creating bulk datasets
 */
export interface CreateBulkDatasetInput {
  filename: string;
  csv_data: object[];
}

// ===== Database Connection =====

/**
 * Get database connection with bulk evaluation tables initialized.
 * @returns {Database.Database} The database instance.
 */
function getBulkDatabase(): Database.Database {
  return getDatabase();
}

/**
 * Execute a function within a database transaction.
 * Ensures atomicity: all-or-nothing persistence.
 * @param fn - Function to execute within the transaction
 * @param db - Optional database instance
 * @returns Result of the function
 */
function withTransaction<T>(fn: (db: Database.Database) => T, db?: Database.Database): T {
  const database = db || getBulkDatabase();
  const transaction = database.transaction(fn);
  return transaction(database);
}

// ===== BulkDataset CRUD Operations =====

/**
 * Create a new bulk dataset from CSV data.
 * @param filename - Original filename
 * @param csvData - Array of row objects parsed from CSV
 * @param db - Optional database instance
 * @returns Created bulk dataset
 */
export function createBulkDataset(
  filename: string,
  csvData: object[],
  db?: Database.Database
): BulkDataset {
  const database = db || getBulkDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO bulk_datasets (id, filename, row_count, csv_data, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, filename, csvData.length, JSON.stringify(csvData), now);

  return getBulkDataset(id, database)!;
}

/**
 * Get a bulk dataset by ID.
 * @param id - Dataset ID
 * @param db - Optional database instance
 * @returns Bulk dataset or null if not found
 */
export function getBulkDataset(id: string, db?: Database.Database): BulkDataset | null {
  const database = db || getBulkDatabase();
  const stmt = database.prepare('SELECT * FROM bulk_datasets WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as BulkDataset) : null;
}

/**
 * List all bulk datasets ordered by creation date (newest first).
 * @param db - Optional database instance
 * @returns Array of bulk datasets
 */
export function listBulkDatasets(db?: Database.Database): BulkDataset[] {
  const database = db || getBulkDatabase();
  const stmt = database.prepare('SELECT * FROM bulk_datasets ORDER BY created_at DESC');
  return stmt.all() as BulkDataset[];
}

/**
 * Delete a bulk dataset by ID.
 * @param id - Dataset ID
 * @param db - Optional database instance
 * @returns True if deleted, false otherwise
 */
export function deleteBulkDataset(id: string, db?: Database.Database): boolean {
  const database = db || getBulkDatabase();
  const result = database.prepare('DELETE FROM bulk_datasets WHERE id = ?').run(id);
  return result.changes > 0;
}

// ===== EvaluationRun CRUD Operations =====

/**
 * Create a new evaluation run with the provided configuration.
 * @param config - Evaluation configuration
 * @param db - Optional database instance
 * @returns Created evaluation run
 */
export function createEvaluationRun(config: EvaluationConfig, db?: Database.Database): EvaluationRun {
  const database = db || getBulkDatabase();

  // Verify dataset exists
  const dataset = getBulkDataset(config.dataset_id, database);
  if (!dataset) {
    throw new Error(`Dataset not found: ${config.dataset_id}`);
  }

  return withTransaction((transactionDb) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = transactionDb.prepare(`
      INSERT INTO evaluation_runs_bulk (
        id, dataset_id, system_prompt, temperature, selected_models,
        status, total_rows, processed_rows, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      config.dataset_id,
      config.system_prompt,
      config.temperature,
      JSON.stringify(config.selected_models),
      'pending',
      dataset.row_count,
      0,
      now,
      now
    );

    return getEvaluationRun(id, transactionDb)!;
  }, db);
}

/**
 * Get an evaluation run by ID.
 * @param id - Run ID
 * @param db - Optional database instance
 * @returns Evaluation run or null if not found
 */
export function getEvaluationRun(id: string, db?: Database.Database): EvaluationRun | null {
  const database = db || getBulkDatabase();
  const stmt = database.prepare('SELECT * FROM evaluation_runs_bulk WHERE id = ?');
  return stmt.get(id) as EvaluationRun | null;
}

/**
 * Update the status and progress of an evaluation run.
 * @param id - Run ID
 * @param status - New status
 * @param processedCount - Number of rows processed
 * @param errorMessage - Optional error message (for failed status)
 * @param db - Optional database instance
 * @returns Updated evaluation run
 */
export function updateRunStatus(
  id: string,
  status: RunStatus,
  processedCount: number,
  errorMessage?: string,
  db?: Database.Database
): EvaluationRun {
  const database = db || getBulkDatabase();
  const now = new Date().toISOString();

  const existing = getEvaluationRun(id, database);
  if (!existing) {
    throw new Error(`Evaluation run not found: ${id}`);
  }

  let query = 'UPDATE evaluation_runs_bulk SET status = ?, processed_rows = ?, updated_at = ?';
  const params: unknown[] = [status, processedCount, now];

  // Update started_at when transitioning to running
  if (status === 'running' && existing.status === 'pending') {
    query += ', started_at = ?';
    params.push(now);
  }

  // Update completed_at when transitioning to completed or failed
  if ((status === 'completed' || status === 'failed') && existing.status !== 'completed' && existing.status !== 'failed') {
    query += ', completed_at = ?';
    params.push(now);
  }

  // Add error message if provided
  if (errorMessage) {
    query += ', error_message = ?';
    params.push(errorMessage);
  }

  query += ' WHERE id = ?';
  params.push(id);

  const stmt = database.prepare(query);
  stmt.run(...params);

  return getEvaluationRun(id, database)!;
}

/**
 * List evaluation runs with optional filtering.
 * @param datasetId - Optional dataset ID filter
 * @param status - Optional status filter
 * @param db - Optional database instance
 * @returns Array of evaluation runs
 */
export function listEvaluationRuns(
  datasetId?: string,
  status?: RunStatus,
  db?: Database.Database
): EvaluationRun[] {
  const database = db || getBulkDatabase();

  let query = 'SELECT * FROM evaluation_runs_bulk';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (datasetId) {
    conditions.push('dataset_id = ?');
    params.push(datasetId);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  const stmt = database.prepare(query);
  return stmt.all(...params) as EvaluationRun[];
}

/**
 * Delete an evaluation run by ID.
 * @param id - Run ID
 * @param db - Optional database instance
 * @returns True if deleted, false otherwise
 */
export function deleteEvaluationRun(id: string, db?: Database.Database): boolean {
  const database = db || getBulkDatabase();
  const result = database.prepare('DELETE FROM evaluation_runs_bulk WHERE id = ?').run(id);
  return result.changes > 0;
}

// ===== RowResult CRUD Operations =====

/**
 * Create a row result record.
 * @param result - Row result data
 * @param db - Optional database instance
 * @returns Created row result
 */
export function createRowResult(result: Omit<RowResult, 'id' | 'created_at'>, db?: Database.Database): RowResult {
  const database = db || getBulkDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO row_results (
      id, run_id, original_row_index, model_id, prompt_used,
      output_text, status, error_message, duration_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    result.run_id,
    result.original_row_index,
    result.model_id,
    result.prompt_used,
    result.output_text || null,
    result.status,
    result.error_message || null,
    result.duration_ms || null,
    now
  );

  return getRowResult(id, database)!;
}

/**
 * Get a row result by ID.
 * @param id - Result ID
 * @param db - Optional database instance
 * @returns Row result or null if not found
 */
export function getRowResult(id: string, db?: Database.Database): RowResult | null {
  const database = db || getBulkDatabase();
  const stmt = database.prepare('SELECT * FROM row_results WHERE id = ?');
  return stmt.get(id) as RowResult | null;
}

/**
 * Get all row results for an evaluation run.
 * @param runId - Run ID
 * @param db - Optional database instance
 * @returns Array of row results
 */
export function getRowResults(runId: string, db?: Database.Database): RowResult[] {
  const database = db || getBulkDatabase();
  const stmt = database.prepare('SELECT * FROM row_results WHERE run_id = ? ORDER BY original_row_index, model_id');
  return stmt.all(runId) as RowResult[];
}

/**
 * Get all row results for a specific row and model in a run.
 * @param runId - Run ID
 * @param rowIndex - Original row index
 * @param modelId - Model ID
 * @param db - Optional database instance
 * @returns Row result or null
 */
export function getRowResultForModel(
  runId: string,
  rowIndex: number,
  modelId: string,
  db?: Database.Database
): RowResult | null {
  const database = db || getBulkDatabase();
  const stmt = database.prepare(
    'SELECT * FROM row_results WHERE run_id = ? AND original_row_index = ? AND model_id = ?'
  );
  return stmt.get(runId, rowIndex, modelId) as RowResult | null;
}

/**
 * Update a row result's status and output.
 * @param id - Result ID
 * @param updates - Fields to update
 * @param db - Optional database instance
 * @returns Updated row result
 */
export function updateRowResult(
  id: string,
  updates: Partial<Pick<RowResult, 'output_text' | 'status' | 'error_message' | 'duration_ms'>>,
  db?: Database.Database
): RowResult {
  const database = db || getBulkDatabase();

  const existing = getRowResult(id, database);
  if (!existing) {
    throw new Error(`Row result not found: ${id}`);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.output_text !== undefined) {
    fields.push('output_text = ?');
    values.push(updates.output_text);
  }

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (updates.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.error_message);
  }

  if (updates.duration_ms !== undefined) {
    fields.push('duration_ms = ?');
    values.push(updates.duration_ms);
  }

  if (fields.length === 0) {
    return existing;
  }

  values.push(id);
  const stmt = database.prepare(`UPDATE row_results SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getRowResult(id, database)!;
}

/**
 * Delete all row results for an evaluation run.
 * @param runId - Run ID
 * @param db - Optional database instance
 * @returns Count of deleted records
 */
export function deleteRowResultsForRun(runId: string, db?: Database.Database): number {
  const database = db || getBulkDatabase();
  const result = database.prepare('DELETE FROM row_results WHERE run_id = ?').run(runId);
  return result.changes;
}

// ===== Composite Queries =====

/**
 * Get an evaluation run with its associated dataset and all results.
 * @param id - Run ID
 * @param db - Optional database instance
 * @returns Evaluation run with dataset and results, or null if not found
 */
export function getRunWithResults(id: string, db?: Database.Database): EvaluationRunWithResults | null {
  const database = db || getBulkDatabase();

  const run = getEvaluationRun(id, database);
  if (!run) {
    return null;
  }

  const dataset = getBulkDataset(run.dataset_id, database);
  if (!dataset) {
    throw new Error(`Dataset not found for run: ${run.dataset_id}`);
  }

  const results = getRowResults(id, database);

  return {
    ...run,
    dataset,
    results,
  };
}

/**
 * Get evaluation run statistics.
 * @param runId - Run ID
 * @param db - Optional database instance
 * @returns Statistics including status breakdown and completion percentage
 */
export function getRunStatistics(
  runId: string,
  db?: Database.Database
): {
  total_rows: number;
  processed_rows: number;
  completion_percentage: number;
  status_counts: {
    pending: number;
    completed: number;
    failed: number;
  };
} | null {
  const database = db || getBulkDatabase();

  const run = getEvaluationRun(runId, database);
  if (!run) {
    return null;
  }

  const results = getRowResults(runId, database);
  const statusCounts = {
    pending: 0,
    completed: 0,
    failed: 0,
  };

  for (const result of results) {
    statusCounts[result.status]++;
  }

  return {
    total_rows: run.total_rows,
    processed_rows: run.processed_rows,
    completion_percentage: run.total_rows > 0 ? (run.processed_rows / run.total_rows) * 100 : 0,
    status_counts: statusCounts,
  };
}
