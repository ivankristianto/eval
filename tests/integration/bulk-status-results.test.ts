/**
 * Bulk Status and Results API Integration Tests
 * Tests for /api/bulk/status and /api/bulk/results endpoints
 *
 * Tests status polling and results retrieval with:
 * - Status updates during execution
 * - Results retrieval for completed runs
 * - Progress tracking
 * - Error cases (non-existent runs)
 * - Results organization by row and model
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { cleanupTestDb, getTestDatabase, initializeTestDatabase } from '../setup';
import {
  createBulkDataset,
  createEvaluationRun,
  createRowResult,
  getEvaluationRun,
  getRunWithResults,
  getRowResults,
  updateRunStatus,
  updateRowResult,
  getRunStatistics,
} from '@lib/db';

describe('Bulk Status and Results API Integration Tests', () => {
  let db: Database.Database;
  let testDatasetId: string;
  let testModelIds: string[];
  let testRunId: string;

  beforeEach(() => {
    initializeTestDatabase();
    db = getTestDatabase();

    // Create test models
    testModelIds = [];
    for (let i = 0; i < 3; i++) {
      const modelId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO ModelConfiguration (id, provider, model_name, api_key_encrypted, created_at, updated_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      ).run(
        modelId,
        i === 0 ? 'openai' : i === 1 ? 'anthropic' : 'google',
        i === 0 ? 'gpt-4' : i === 1 ? 'claude-3' : 'gemini-pro',
        'encrypted-key',
        new Date().toISOString(),
        new Date().toISOString()
      );
      testModelIds.push(modelId);
    }

    // Create test dataset with 5 rows
    const csvData = Array.from({ length: 5 }, (_, i) => ({
      question: `Question ${i}`,
      context: `Context ${i}`,
    }));
    const dataset = createBulkDataset('test.csv', csvData, db);
    testDatasetId = dataset.id;

    // Create test evaluation run
    const run = createEvaluationRun(
      {
        dataset_id: testDatasetId,
        system_prompt: 'Answer: {question}',
        temperature: 0.5,
        selected_models: testModelIds,
      },
      db
    );
    testRunId = run.id;
  });

  afterEach(() => {
    cleanupTestDb(db);
  });

  describe('Status Retrieval', () => {
    it('should retrieve initial pending status', () => {
      const run = getEvaluationRun(testRunId, db);

      expect(run).toBeDefined();
      expect(run!.status).toBe('pending');
      expect(run!.total_rows).toBe(5);
      expect(run!.processed_rows).toBe(0);
      // Calculate completion percentage
      const completionPercentage =
        run!.total_rows > 0 ? (run!.processed_rows / run!.total_rows) * 100 : 0;
      expect(completionPercentage).toBe(0);
    });

    it('should calculate completion percentage correctly', () => {
      // Update to running with 2 rows processed
      const updated = updateRunStatus(testRunId, 'running', 2, undefined, db);

      expect(updated.status).toBe('running');
      expect(updated.processed_rows).toBe(2);
      expect(updated.total_rows).toBe(5);
      // Calculate completion percentage
      const completionPercentage =
        updated.total_rows > 0 ? (updated.processed_rows / updated.total_rows) * 100 : 0;
      expect(completionPercentage).toBe(40);
    });

    it('should update status through execution lifecycle', () => {
      // Pending -> Running
      let run = updateRunStatus(testRunId, 'running', 0, undefined, db);
      expect(run.status).toBe('running');
      expect(run.started_at).toBeDefined();
      expect(run.completed_at).toBeNull();

      // Running -> Completed
      run = updateRunStatus(testRunId, 'completed', 5, undefined, db);
      expect(run.status).toBe('completed');
      expect(run.completed_at).toBeDefined();
      expect(run.error_message).toBeNull();

      // Verify final state
      const final = getEvaluationRun(testRunId, db);
      expect(final!.status).toBe('completed');
    });

    it('should handle failed status with error message', () => {
      const errorMsg = 'Model API timeout';
      const run = updateRunStatus(testRunId, 'failed', 3, errorMsg, db);

      expect(run.status).toBe('failed');
      expect(run.error_message).toBe(errorMsg);
      expect(run.processed_rows).toBe(3);
      expect(run.completed_at).toBeDefined();
    });

    it('should return undefined for non-existent run ID', () => {
      const run = getEvaluationRun('non-existent-id', db);
      // Note: getEvaluationRun is typed to return null, but SQLite's stmt.get() returns undefined
      expect(run).toBeUndefined();
    });

    it('should include all timestamp fields', () => {
      const run = getEvaluationRun(testRunId, db);

      expect(run!.created_at).toBeDefined();
      expect(run!.updated_at).toBeDefined();

      // Before running, these should be null
      expect(run!.started_at).toBeNull();
      expect(run!.completed_at).toBeNull();

      // Update to running
      updateRunStatus(testRunId, 'running', 1, undefined, db);
      const running = getEvaluationRun(testRunId, db);

      expect(running!.started_at).toBeDefined();
      expect(running!.completed_at).toBeNull();

      // Complete the run
      updateRunStatus(testRunId, 'completed', 5, undefined, db);
      const completed = getEvaluationRun(testRunId, db);

      expect(completed!.started_at).toBeDefined();
      expect(completed!.completed_at).toBeDefined();
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress from 0 to 100%', () => {
      const totalRows = 5;
      getEvaluationRun(testRunId, db);

      for (let processed = 0; processed <= totalRows; processed++) {
        const updated = updateRunStatus(testRunId, 'running', processed, undefined, db);
        const expectedPercentage = (processed / totalRows) * 100;
        const completionPercentage =
          updated.total_rows > 0 ? (updated.processed_rows / updated.total_rows) * 100 : 0;
        expect(completionPercentage).toBeCloseTo(expectedPercentage, 1);
      }
    });

    it('should handle zero total rows gracefully', () => {
      // Create dataset with 0 rows
      const emptyCsvData: Record<string, unknown>[] = [];
      const emptyDataset = createBulkDataset('empty.csv', emptyCsvData, db);

      const emptyRun = createEvaluationRun(
        {
          dataset_id: emptyDataset.id,
          system_prompt: 'Test',
          temperature: 0.5,
          selected_models: [testModelIds[0]],
        },
        db
      );

      expect(emptyRun.total_rows).toBe(0);
      const completionPercentage =
        emptyRun.total_rows > 0 ? (emptyRun.processed_rows / emptyRun.total_rows) * 100 : 0;
      expect(completionPercentage).toBe(0);
    });

    it('should update progress without changing status', () => {
      // Start running
      updateRunStatus(testRunId, 'running', 0, undefined, db);

      // Update progress multiple times
      const p1 = updateRunStatus(testRunId, 'running', 1, undefined, db);
      expect(p1.processed_rows).toBe(1);

      const p2 = updateRunStatus(testRunId, 'running', 2, undefined, db);
      expect(p2.processed_rows).toBe(2);

      const p3 = updateRunStatus(testRunId, 'running', 3, undefined, db);
      expect(p3.processed_rows).toBe(3);

      // Status should remain running
      expect(p3.status).toBe('running');
    });
  });

  describe('Results Retrieval', () => {
    beforeEach(() => {
      // Create sample row results for testing
      // Row 0: all models completed
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Q0',
          output_text: 'Answer from GPT-4',
          status: 'completed',
          duration_ms: 100,
        },
        db
      );
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[1],
          prompt_used: 'Q0',
          output_text: 'Answer from Claude',
          status: 'completed',
          duration_ms: 150,
        },
        db
      );
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[2],
          prompt_used: 'Q0',
          output_text: 'Answer from Gemini',
          status: 'completed',
          duration_ms: 120,
        },
        db
      );

      // Row 1: mixed status
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 1,
          model_id: testModelIds[0],
          prompt_used: 'Q1',
          output_text: 'Success',
          status: 'completed',
          duration_ms: 90,
        },
        db
      );
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 1,
          model_id: testModelIds[1],
          prompt_used: 'Q1',
          status: 'failed',
          error_message: 'API timeout',
        },
        db
      );
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 1,
          model_id: testModelIds[2],
          prompt_used: 'Q1',
          status: 'pending',
        },
        db
      );
    });

    it('should retrieve all row results for a run', () => {
      const results = getRowResults(testRunId, db);

      expect(results).toHaveLength(6);
      expect(results[0].run_id).toBe(testRunId);
    });

    it('should retrieve results organized by row and model', () => {
      const data = getRunWithResults(testRunId, db);

      expect(data).toBeDefined();
      expect(data!.results).toHaveLength(6);

      // Results should be ordered by row index then model ID
      expect(data!.results[0].original_row_index).toBe(0);
      expect(data!.results[1].original_row_index).toBe(0);
      expect(data!.results[2].original_row_index).toBe(0);

      // First row should have all 3 models
      const row0ModelIds = data!.results
        .filter((r) => r.original_row_index === 0)
        .map((r) => r.model_id);
      expect(row0ModelIds).toHaveLength(3);
      expect(row0ModelIds).toContain(testModelIds[0]);
      expect(row0ModelIds).toContain(testModelIds[1]);
      expect(row0ModelIds).toContain(testModelIds[2]);
    });

    it('should include dataset information', () => {
      const data = getRunWithResults(testRunId, db);

      expect(data!.dataset).toBeDefined();
      expect(data!.dataset.id).toBe(testDatasetId);
      expect(data!.dataset.filename).toBe('test.csv');
      expect(data!.dataset.row_count).toBe(5);
    });

    it('should include CSV data for display', () => {
      const data = getRunWithResults(testRunId, db);

      const csvData = JSON.parse(data!.dataset.csv_data) as Record<string, unknown>[];
      expect(csvData).toHaveLength(5);
      expect(csvData[0].question).toBe('Question 0');
      expect(csvData[0].context).toBe('Context 0');
    });

    it('should return null for non-existent run', () => {
      const data = getRunWithResults('non-existent-id', db);
      expect(data).toBeNull();
    });

    it('should handle completed row results with output', () => {
      const results = getRowResults(testRunId, db);
      const completedResults = results.filter((r) => r.status === 'completed');

      expect(completedResults).toHaveLength(4);
      expect(completedResults[0].output_text).toBeDefined();
      expect(completedResults[0].duration_ms).toBeDefined();
      // SQLite stores NULL for missing values
      expect(completedResults[0].error_message ?? undefined).toBeUndefined();
    });

    it('should handle failed row results with error message', () => {
      const results = getRowResults(testRunId, db);
      const failedResults = results.filter((r) => r.status === 'failed');

      expect(failedResults).toHaveLength(1);
      expect(failedResults[0].error_message).toBe('API timeout');
      // SQLite stores NULL for missing values
      expect(failedResults[0].output_text ?? undefined).toBeUndefined();
    });

    it('should handle pending row results', () => {
      const results = getRowResults(testRunId, db);
      const pendingResults = results.filter((r) => r.status === 'pending');

      expect(pendingResults).toHaveLength(1);
      // SQLite stores NULL for missing values
      expect(pendingResults[0].output_text ?? undefined).toBeUndefined();
      expect(pendingResults[0].error_message ?? undefined).toBeUndefined();
    });
  });

  describe('Statistics Calculation', () => {
    beforeEach(() => {
      // Create test results:
      // 3 completed, 1 failed, 2 pending
      for (let i = 0; i < 3; i++) {
        createRowResult(
          {
            run_id: testRunId,
            original_row_index: i,
            model_id: testModelIds[0],
            prompt_used: `Q${i}`,
            output_text: `Answer ${i}`,
            status: 'completed',
            duration_ms: 100 + i * 10,
          },
          db
        );
      }
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 3,
          model_id: testModelIds[0],
          prompt_used: 'Q3',
          status: 'failed',
          error_message: 'Error',
        },
        db
      );
      for (let i = 4; i < 6; i++) {
        createRowResult(
          {
            run_id: testRunId,
            original_row_index: i,
            model_id: testModelIds[0],
            prompt_used: `Q${i}`,
            status: 'pending',
          },
          db
        );
      }
    });

    it('should calculate run statistics', () => {
      const stats = getRunStatistics(testRunId, db);

      expect(stats.total_rows).toBe(5);
      expect(stats.processed_rows).toBe(0); // Not updated via status yet
      expect(stats.status_counts.pending).toBe(2);
      expect(stats.status_counts.completed).toBe(3);
      expect(stats.status_counts.failed).toBe(1);
    });

    it('should calculate completion percentage from status counts', () => {
      const stats = getRunStatistics(testRunId, db);
      const total =
        stats.status_counts.completed + stats.status_counts.failed + stats.status_counts.pending;

      expect(total).toBe(6); // 6 total results (not rows, since results are per model)
    });

    it('should throw error for non-existent run', () => {
      expect(() => getRunStatistics('non-existent-id', db)).toThrow('Evaluation run not found');
    });

    it('should reflect zero results for new run', () => {
      const newRun = createEvaluationRun(
        {
          dataset_id: testDatasetId,
          system_prompt: 'Test',
          temperature: 0.5,
          selected_models: [testModelIds[0]],
        },
        db
      );

      const stats = getRunStatistics(newRun.id, db);

      expect(stats.status_counts.pending).toBe(0);
      expect(stats.status_counts.completed).toBe(0);
      expect(stats.status_counts.failed).toBe(0);
    });
  });

  describe('Row Result Updates', () => {
    it('should update row result from pending to completed', () => {
      const result = createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Test',
          status: 'pending',
        },
        db
      );

      expect(result.status).toBe('pending');

      const updated = updateRowResult(
        result.id,
        {
          output_text: 'Final answer',
          status: 'completed',
          duration_ms: 250,
        },
        db
      );

      expect(updated.status).toBe('completed');
      expect(updated.output_text).toBe('Final answer');
      expect(updated.duration_ms).toBe(250);
    });

    it('should update row result with error', () => {
      const result = createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Test',
          status: 'pending',
        },
        db
      );

      const updated = updateRowResult(
        result.id,
        {
          status: 'failed',
          error_message: 'Connection lost',
        },
        db
      );

      expect(updated.status).toBe('failed');
      expect(updated.error_message).toBe('Connection lost');
    });

    it('should handle partial updates', () => {
      const result = createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Test',
          status: 'pending',
        },
        db
      );

      // Update only status
      const updated1 = updateRowResult(result.id, { status: 'completed' }, db);
      expect(updated1.status).toBe('completed');
      expect(updated1.prompt_used).toBe('Test'); // Unchanged

      // Update only output_text
      const updated2 = updateRowResult(result.id, { output_text: 'Answer' }, db);
      expect(updated2.status).toBe('completed');
      expect(updated2.output_text).toBe('Answer');
    });

    it('should throw error when updating non-existent result', () => {
      expect(() => updateRowResult('fake-id', { status: 'completed' }, db)).toThrow(
        'Row result not found'
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle results for all rows and all models', () => {
      // Create results for all 5 rows x 3 models = 15 results
      for (let row = 0; row < 5; row++) {
        for (const modelId of testModelIds) {
          createRowResult(
            {
              run_id: testRunId,
              original_row_index: row,
              model_id: modelId,
              prompt_used: `Row ${row}`,
              output_text: `Result from row ${row}`,
              status: 'completed',
              duration_ms: 100 + row * 10,
            },
            db
          );
        }
      }

      const results = getRowResults(testRunId, db);
      expect(results).toHaveLength(15);

      // Group by row
      const byRow: Record<number, number> = {};
      for (const result of results) {
        byRow[result.original_row_index] = (byRow[result.original_row_index] || 0) + 1;
      }

      expect(Object.keys(byRow)).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(byRow[i]).toBe(3); // 3 models per row
      }
    });

    it('should handle run with mixed success/failure', () => {
      // Row 0: all success
      for (const modelId of testModelIds) {
        createRowResult(
          {
            run_id: testRunId,
            original_row_index: 0,
            model_id: modelId,
            prompt_used: 'Q0',
            output_text: 'Success',
            status: 'completed',
          },
          db
        );
      }

      // Row 1: all fail
      for (const modelId of testModelIds) {
        createRowResult(
          {
            run_id: testRunId,
            original_row_index: 1,
            model_id: modelId,
            prompt_used: 'Q1',
            status: 'failed',
            error_message: 'API error',
          },
          db
        );
      }

      // Row 2: mixed
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 2,
          model_id: testModelIds[0],
          prompt_used: 'Q2',
          output_text: 'OK',
          status: 'completed',
        },
        db
      );
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 2,
          model_id: testModelIds[1],
          prompt_used: 'Q2',
          status: 'failed',
          error_message: 'Timeout',
        },
        db
      );
      createRowResult(
        {
          run_id: testRunId,
          original_row_index: 2,
          model_id: testModelIds[2],
          prompt_used: 'Q2',
          status: 'pending',
        },
        db
      );

      const results = getRowResults(testRunId, db);
      const completed = results.filter((r) => r.status === 'completed');
      const failed = results.filter((r) => r.status === 'failed');
      const pending = results.filter((r) => r.status === 'pending');

      expect(completed).toHaveLength(4);
      expect(failed).toHaveLength(4);
      expect(pending).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle run with no results', () => {
      const newRun = createEvaluationRun(
        {
          dataset_id: testDatasetId,
          system_prompt: 'Test',
          temperature: 0.5,
          selected_models: [testModelIds[0]],
        },
        db
      );

      const results = getRowResults(newRun.id, db);
      expect(results).toHaveLength(0);

      const data = getRunWithResults(newRun.id, db);
      expect(data!.results).toHaveLength(0);
    });

    it('should handle very long output text', () => {
      const longText = 'x'.repeat(100000);

      const result = createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Test',
          output_text: longText,
          status: 'completed',
        },
        db
      );

      expect(result.output_text).toHaveLength(100000);

      const retrieved = getRowResults(testRunId, db);
      expect(retrieved[0].output_text).toHaveLength(100000);
    });

    it('should handle special characters in output', () => {
      const specialText = 'Test with "quotes", \n newlines, \t tabs, emoji 😀';

      const result = createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Test',
          output_text: specialText,
          status: 'completed',
        },
        db
      );

      expect(result.output_text).toBe(specialText);
    });

    it('should handle null output_text for failed/pending results', () => {
      const result = createRowResult(
        {
          run_id: testRunId,
          original_row_index: 0,
          model_id: testModelIds[0],
          prompt_used: 'Test',
          status: 'failed',
          error_message: 'Error',
        },
        db
      );

      // SQLite stores NULL for missing values
      expect(result.output_text ?? undefined).toBeUndefined();
      expect(result.error_message).toBe('Error');
    });
  });
});
