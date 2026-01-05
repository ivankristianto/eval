/**
 * Database access layer for LLM-as-Judge training tables
 * Provides connection helpers, transaction utilities, and CRUD operations
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './db';
import { validatePersonaCreation } from '@lib/validation/persona-validator';
import type {
  Persona,
  CreatePersonaInput,
  TrainingPair,
  CreateTrainingPairInput,
  TrainingIteration,
  JudgeDecision,
  HumanReview,
  CreateHumanReviewInput,
  IterationMetrics,
  JudgePromptVersion,
  TaskPromptVersion,
  TrainingLoopState,
  TrainingLoopCheckpoint,
  PersonaStatus,
  IterationStatus,
  SessionStatus,
  JudgeDecisionType,
  PromptSource,
} from '@src-types/training';

/**
 * Get database connection with training tables initialized.
 * @returns {Database.Database} The database instance.
 */
export function getTrainingDatabase(): Database.Database {
  return getDatabase();
}

/**
 * Execute a function within a database transaction.
 * Ensures atomicity: all-or-nothing persistence.
 * @param fn - Function to execute within the transaction
 * @param db - Optional database instance
 * @returns Result of the function
 */
export function withTransaction<T>(fn: (db: Database.Database) => T, db?: Database.Database): T {
  const database = db || getTrainingDatabase();

  const transaction = database.transaction(fn);

  return transaction(database);
}

// ===== Persona CRUD Operations =====

/**
 * Create a new persona (with individual parameters).
 * @param name - Persona name
 * @param description - Optional description
 * @param task_prompt - The task prompt to evaluate
 * @param initial_judge_prompt - The starting judge prompt
 * @param task_model_id - ID of the task model
 * @param judge_model_id - ID of the judge model
 * @param prompt_engineer_model_id - ID of the prompt engineer model
 * @param db - Optional database instance
 * @returns Created persona object
 */
export function createPersona(
  name: string,
  description: string | null | undefined,
  task_prompt: string,
  initial_judge_prompt: string,
  task_model_id: string,
  judge_model_id: string,
  prompt_engineer_model_id: string,
  db?: Database.Database
): Persona;

/**
 * Create a new persona (with input object).
 * @param input - Persona creation input object
 * @param db - Optional database instance
 * @returns Created persona object
 */
export function createPersona(input: CreatePersonaInput, db?: Database.Database): Persona;

/**
 * Create a new persona - implementation.
 * @param nameOrInput - Persona name or creation input object
 * @param descriptionOrDb - Description string or database instance
 * @param task_prompt - Task prompt
 * @param initial_judge_prompt - Initial judge prompt
 * @param task_model_id - Task model ID
 * @param judge_model_id - Judge model ID
 * @param prompt_engineer_model_id - Prompt engineer model ID
 * @param db - Database instance
 * @returns Created persona object
 */
export function createPersona(
  nameOrInput: string | CreatePersonaInput,
  descriptionOrDb?: string | null | Database.Database,
  task_prompt?: string,
  initial_judge_prompt?: string,
  task_model_id?: string,
  judge_model_id?: string,
  prompt_engineer_model_id?: string,
  db?: Database.Database
): Persona {
  let input: CreatePersonaInput;
  let database: Database.Database | undefined;

  if (typeof nameOrInput === 'string') {
    input = {
      name: nameOrInput,
      description:
        typeof descriptionOrDb === 'string' || descriptionOrDb === null
          ? descriptionOrDb
          : undefined,
      initial_task_prompt: task_prompt!,
      initial_judge_prompt: initial_judge_prompt!,
      task_model_id: task_model_id!,
      judge_model_id: judge_model_id!,
      prompt_engineer_model_id: prompt_engineer_model_id!,
    };
    database = db;
  } else {
    input = nameOrInput;
    database = descriptionOrDb as Database.Database | undefined;
  }

  const dbInstance = database || getTrainingDatabase();

  const validation = validatePersonaCreation(input, dbInstance);

  if (!validation.isValid) {
    throw new Error(`Persona validation failed: ${validation.errors.join(', ')}`);
  }

  return withTransaction((transactionDb) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = transactionDb.prepare(`
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
      'draft' as PersonaStatus,
      input.target_pass_rate || 0.8,
      now,
      now,
      input.created_by || null
    );

    const taskPromptVersionId = uuidv4();
    const taskPromptVersionStmt = transactionDb.prepare(`
      INSERT INTO task_prompt_versions (
        id, persona_id, version_number, prompt_text,
        improvement_rationale, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    taskPromptVersionStmt.run(
      taskPromptVersionId,
      id,
      0,
      input.initial_task_prompt,
      'Initial task prompt provided during persona creation',
      'human',
      now
    );

    const judgePromptVersionId = uuidv4();
    const judgePromptVersionStmt = transactionDb.prepare(`
      INSERT INTO judge_prompt_versions (
        id, persona_id, version_number, prompt_text,
        improvement_rationale, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    judgePromptVersionStmt.run(
      judgePromptVersionId,
      id,
      0,
      input.initial_judge_prompt,
      'Initial judge prompt provided during persona creation',
      'human',
      now
    );

    // Update persona with current prompt version IDs
    const updatePersonaStmt = transactionDb.prepare(`
      UPDATE personas
      SET current_task_prompt_version_id = ?, current_judge_prompt_version_id = ?
      WHERE id = ?
    `);

    updatePersonaStmt.run(taskPromptVersionId, judgePromptVersionId, id);

    return getPersona(id, transactionDb)!;
  }, dbInstance);
}

/**
 * Get persona by ID.
 * @param id - Persona ID
 * @param db - Optional database instance
 * @returns Persona object or null if not found
 */
export function getPersona(id: string, db?: Database.Database): Persona | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM personas WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as Persona) : null;
}

/**
 * List all personas with optional status filter.
 * @param status - Optional status filter
 * @param db - Optional database instance
 * @returns Array of personas
 */
export function listPersonas(status?: PersonaStatus, db?: Database.Database): Persona[] {
  const database = db || getTrainingDatabase();
  let query = 'SELECT * FROM personas';
  const params: unknown[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  const stmt = database.prepare(query);
  return stmt.all(...params) as Persona[];
}

/**
 * Update persona fields.
 * @param id - Persona ID
 * @param updates - Fields to update
 * @param db - Optional database instance
 * @returns Updated persona object
 */
export function updatePersona(
  id: string,
  updates: Partial<
    Pick<
      Persona,
      | 'name'
      | 'description'
      | 'status'
      | 'best_pass_rate'
      | 'best_pass_rate_updated_at'
      | 'current_task_prompt_version_id'
      | 'current_judge_prompt_version_id'
    >
  >,
  db?: Database.Database
): Persona {
  const dbInstance = db || getTrainingDatabase();

  return withTransaction((database) => {
    const existing = getPersona(id, database);

    if (!existing) {
      throw new Error(`Persona not found: ${id}`);
    }

    if (updates.name !== undefined && updates.name !== existing.name) {
      const duplicate = database
        .prepare('SELECT id FROM personas WHERE name = ? AND id != ?')
        .get(updates.name, id);

      if (duplicate) {
        throw new Error(`Persona name already exists: ${updates.name}`);
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.best_pass_rate !== undefined) {
      fields.push('best_pass_rate = ?');
      values.push(updates.best_pass_rate);
    }

    if (updates.best_pass_rate_updated_at !== undefined) {
      fields.push('best_pass_rate_updated_at = ?');
      values.push(updates.best_pass_rate_updated_at);
    }

    if (updates.current_task_prompt_version_id !== undefined) {
      fields.push('current_task_prompt_version_id = ?');
      values.push(updates.current_task_prompt_version_id);
    }

    if (updates.current_judge_prompt_version_id !== undefined) {
      fields.push('current_judge_prompt_version_id = ?');
      values.push(updates.current_judge_prompt_version_id);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = database.prepare(`UPDATE personas SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return getPersona(id, database)!;
  }, dbInstance);
}

/**
 * Delete a persona and its associated data.
 * @param id - Persona ID
 * @param db - Optional database instance
 * @returns True if deleted, false otherwise
 */
export function deletePersona(id: string, db?: Database.Database): boolean {
  const database = db || getTrainingDatabase();

  const existing = getPersona(id, database);

  if (!existing) {
    throw new Error(`Persona not found: ${id}`);
  }

  const result = database.prepare('DELETE FROM personas WHERE id = ?').run(id);
  return result.changes > 0;
}

// ===== TrainingPair CRUD Operations =====

/**
 * Create multiple training pairs for a persona.
 * @param personaId - Persona ID
 * @param pairs - Array of training pairs to create
 * @param db - Optional database instance
 * @returns Array of created training pairs
 */
export function createTrainingPairs(
  personaId: string,
  pairs: CreateTrainingPairInput[],
  db?: Database.Database
): TrainingPair[] {
  return withTransaction((database) => {
    const stmt = database.prepare(`
      INSERT INTO training_pairs (id, persona_id, input, expected_output, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    for (const pair of pairs) {
      const id = uuidv4();
      stmt.run(id, personaId, pair.input, pair.expected_output, now);
    }

    return getTrainingPairs(personaId, database);
  }, db);
}

/**
 * Get all training pairs for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Array of training pairs
 */
export function getTrainingPairs(personaId: string, db?: Database.Database): TrainingPair[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT * FROM training_pairs WHERE persona_id = ? ORDER BY created_at'
  );
  return stmt.all(personaId) as TrainingPair[];
}

/**
 * Get a single training pair by ID.
 * @param id - Training pair ID
 * @param db - Optional database instance
 * @returns Training pair or null if not found
 */
export function getTrainingPair(id: string, db?: Database.Database): TrainingPair | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_pairs WHERE id = ?');
  return stmt.get(id) as TrainingPair | null;
}

/**
 * Delete all training pairs for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 */
export function deleteTrainingPairs(personaId: string, db?: Database.Database): void {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('DELETE FROM training_pairs WHERE persona_id = ?');
  stmt.run(personaId);
}

// ===== TrainingIteration CRUD Operations =====

/**
 * Create a new training iteration.
 * @param personaId - Persona ID
 * @param iterationNumber - Iteration number
 * @param judgeModelId - ID of judge model
 * @param judgePromptText - Judge prompt text used
 * @param db - Optional database instance
 * @returns Created training iteration
 */
export function createTrainingIteration(
  personaId: string,
  iterationNumber: number,
  judgeModelId: string,
  judgePromptText: string,
  db?: Database.Database
): TrainingIteration {
  return withTransaction((database) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = database.prepare(`
      INSERT INTO training_iterations (
        id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
        status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, personaId, iterationNumber, judgeModelId, judgePromptText, 'in_progress', now);

    return getTrainingIteration(id, database)!;
  }, db);
}

/**
 * Get training iteration by ID.
 * @param id - Iteration ID
 * @param db - Optional database instance
 * @returns Training iteration or null
 */
export function getTrainingIteration(id: string, db?: Database.Database): TrainingIteration | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_iterations WHERE id = ?');
  return stmt.get(id) as TrainingIteration | null;
}

/**
 * Get latest training iteration for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Latest iteration or null
 */
export function getLatestIteration(
  personaId: string,
  db?: Database.Database
): TrainingIteration | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT * FROM training_iterations
    WHERE persona_id = ?
    ORDER BY iteration_number DESC
    LIMIT 1
  `);
  return stmt.get(personaId) as TrainingIteration | null;
}

/**
 * List all iterations for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Array of training iterations
 */
export function listIterations(personaId: string, db?: Database.Database): TrainingIteration[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT * FROM training_iterations
    WHERE persona_id = ?
    ORDER BY iteration_number DESC
  `);
  return stmt.all(personaId) as TrainingIteration[];
}

/**
 * Update training iteration status.
 * @param id - Iteration ID
 * @param status - New status
 * @param errorMessage - Optional error message
 * @param db - Optional database instance
 * @returns Updated training iteration
 */
export function updateIterationStatus(
  id: string,
  status: IterationStatus,
  errorMessage?: string,
  db?: Database.Database
): TrainingIteration {
  return withTransaction((database) => {
    const now = new Date().toISOString();
    let query = 'UPDATE training_iterations SET status = ?';
    const params: unknown[] = [status];

    if (status === 'completed') {
      query += ', completed_at = ?';
      params.push(now);
    }

    if (errorMessage) {
      query += ', error_message = ?';
      params.push(errorMessage);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const stmt = database.prepare(query);
    stmt.run(...params);

    return getTrainingIteration(id, database)!;
  }, db);
}

/**
 * Update iteration pair counts.
 * @param id - Iteration ID
 * @param totalEvaluated - Total pairs evaluated by judge
 * @param humanReviewed - Total pairs reviewed by human
 * @param db - Optional database instance
 */
export function updateIterationCounts(
  id: string,
  totalEvaluated: number,
  humanReviewed: number,
  db?: Database.Database
): void {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    UPDATE training_iterations
    SET total_pairs_evaluated = ?, pairs_reviewed_by_human = ?
    WHERE id = ?
  `);
  stmt.run(totalEvaluated, humanReviewed, id);
}

// ===== JudgeDecision CRUD Operations =====

/**
 * Create a judge decision.
 * @param iterationId - Iteration ID
 * @param trainingPairId - Training pair ID
 * @param generatedOutput - Model output that was judged
 * @param decision - Judge's decision (agree/disagree)
 * @param reasoning - Judge's reasoning
 * @param resultId - Optional evaluation result reference
 * @param db - Optional database instance
 * @returns Created judge decision
 */
export function createJudgeDecision(
  iterationId: string,
  trainingPairId: string,
  generatedOutput: string,
  decision: JudgeDecisionType,
  reasoning: string | null,
  resultId?: string,
  db?: Database.Database
): JudgeDecision {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO judge_decisions (
      id, iteration_id, training_pair_id, result_id, generated_output,
      judge_decision, judge_reasoning, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    iterationId,
    trainingPairId,
    resultId || null,
    generatedOutput,
    decision,
    reasoning,
    now
  );

  return getJudgeDecision(id, database)!;
}

/**
 * Get judge decision by ID.
 * @param id - Decision ID
 * @param db - Optional database instance
 * @returns Judge decision or null
 */
export function getJudgeDecision(id: string, db?: Database.Database): JudgeDecision | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM judge_decisions WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as JudgeDecision) : null;
}

/**
 * Get all judge decisions for an iteration.
 * @param iterationId - Iteration ID
 * @param db - Optional database instance
 * @returns Array of judge decisions
 */
export function getIterationDecisions(
  iterationId: string,
  db?: Database.Database
): JudgeDecision[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM judge_decisions WHERE iteration_id = ?');
  return stmt.all(iterationId) as JudgeDecision[];
}

// ===== HumanReview CRUD Operations =====

/**
 * Create a human review for a judge decision.
 * @param input - Human review input data
 * @param db - Optional database instance
 * @returns Created human review
 */
export function createHumanReview(
  input: CreateHumanReviewInput,
  db?: Database.Database
): HumanReview {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO human_reviews (
      id, judge_decision_id, human_decision, human_notes, reviewer_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.judge_decision_id,
    input.human_decision,
    input.human_notes || null,
    input.reviewer_id || null,
    now
  );

  return getHumanReview(id, database)!;
}

/**
 * Get human review by ID.
 * @param id - Review ID
 * @param db - Optional database instance
 * @returns Human review or null
 */
export function getHumanReview(id: string, db?: Database.Database): HumanReview | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM human_reviews WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as HumanReview) : null;
}

/**
 * Get human review by judge decision ID.
 * @param judgeDecisionId - Judge decision ID
 * @param db - Optional database instance
 * @returns Human review or null
 */
export function getHumanReviewByDecision(
  judgeDecisionId: string,
  db?: Database.Database
): HumanReview | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM human_reviews WHERE judge_decision_id = ?');
  return stmt.get(judgeDecisionId) as HumanReview | null;
}

/**
 * Get all human reviews for an iteration.
 * @param iterationId - Iteration ID
 * @param db - Optional database instance
 * @returns Array of human reviews
 */
export function getIterationReviews(iterationId: string, db?: Database.Database): HumanReview[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT hr.* FROM human_reviews hr
    JOIN judge_decisions jd ON hr.judge_decision_id = jd.id
    WHERE jd.iteration_id = ?
  `);
  return stmt.all(iterationId) as HumanReview[];
}

// ===== IterationMetrics CRUD Operations =====

/**
 * Create iteration metrics.
 * @param iterationId - Iteration ID
 * @param metrics - Calculated metrics values
 * @param metrics.tp - True positives
 * @param metrics.tn - True negatives
 * @param metrics.fp - False positives
 * @param metrics.fn - False negatives
 * @param metrics.precision - Precision value
 * @param metrics.recall - Recall value
 * @param metrics.f1_score - F1 score value
 * @param metrics.cohens_kappa - Cohen's kappa value
 * @param metrics.accuracy - Accuracy value
 * @param db - Optional database instance
 * @returns Created iteration metrics
 */
export function createIterationMetrics(
  iterationId: string,
  metrics: {
    tp: number;
    tn: number;
    fp: number;
    fn: number;
    precision: number;
    recall: number;
    f1_score: number;
    cohens_kappa: number;
    accuracy: number;
  },
  db?: Database.Database
): IterationMetrics {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO iteration_metrics (
      id, iteration_id, true_positives, true_negatives, false_positives, false_negatives,
      precision, recall, f1_score, cohens_kappa, accuracy, calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    iterationId,
    metrics.tp,
    metrics.tn,
    metrics.fp,
    metrics.fn,
    metrics.precision,
    metrics.recall,
    metrics.f1_score,
    metrics.cohens_kappa,
    metrics.accuracy,
    now
  );

  return getIterationMetrics(iterationId, database)!;
}

/**
 * Get iteration metrics by iteration ID.
 * @param iterationId - Iteration ID
 * @param db - Optional database instance
 * @returns Iteration metrics or null
 */
export function getIterationMetrics(
  iterationId: string,
  db?: Database.Database
): IterationMetrics | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?');
  const result = stmt.get(iterationId);
  return result ? (result as IterationMetrics) : null;
}

/**
 * Get all metrics for a persona (across all iterations).
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Array of iteration metrics
 */
export function getPersonaMetrics(personaId: string, db?: Database.Database): IterationMetrics[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT m.* FROM iteration_metrics m
    JOIN training_iterations i ON m.iteration_id = i.id
    WHERE i.persona_id = ?
    ORDER BY i.iteration_number
  `);
  return stmt.all(personaId) as IterationMetrics[];
}

// ===== JudgePromptVersion CRUD Operations =====

/**
 * Create a new judge prompt version.
 * @param personaId - Persona ID
 * @param versionNumber - Version number (auto-incremented if not provided)
 * @param promptText - Prompt text content
 * @param rationale - Improvement rationale
 * @param createdBy - Source of the prompt (human/ai)
 * @param label - Optional display label
 * @param db - Optional database instance
 * @returns Created prompt version
 */
export function createJudgePromptVersion(
  personaId: string,
  versionNumber: number,
  promptText: string,
  rationale: string | null,
  createdBy: PromptSource,
  label?: string | null,
  db?: Database.Database
): JudgePromptVersion {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO judge_prompt_versions (
      id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, personaId, versionNumber, promptText, rationale, label || null, createdBy, now);

  return getJudgePromptVersion(id, database)!;
}

/**
 * Get next version number for a persona's judge prompt.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Next version number
 */
export function getNextJudgeVersionNumber(personaId: string, db?: Database.Database): number {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM judge_prompt_versions WHERE persona_id = ?'
  );
  const result = stmt.get(personaId) as { next_version: number };
  return result.next_version;
}

/**
 * Get judge prompt version by ID.
 * @param id - Version ID
 * @param db - Optional database instance
 * @returns Prompt version or null
 */
export function getJudgePromptVersion(id: string, db?: Database.Database): JudgePromptVersion | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM judge_prompt_versions WHERE id = ?');
  return stmt.get(id) as JudgePromptVersion | null;
}

/**
 * Get judge prompt version by persona and version number.
 * @param personaId - Persona ID
 * @param versionNumber - Version number
 * @param db - Optional database instance
 * @returns Prompt version or null
 */
export function getJudgePromptVersionByNumber(
  personaId: string,
  versionNumber: number,
  db?: Database.Database
): JudgePromptVersion | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT * FROM judge_prompt_versions WHERE persona_id = ? AND version_number = ?'
  );
  return stmt.get(personaId, versionNumber) as JudgePromptVersion | null;
}

/**
 * Get all judge prompt versions for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Array of prompt versions
 */
export function getJudgePromptHistory(personaId: string, db?: Database.Database): JudgePromptVersion[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT * FROM judge_prompt_versions
    WHERE persona_id = ?
    ORDER BY version_number DESC
  `);
  return stmt.all(personaId) as JudgePromptVersion[];
}

// ===== TaskPromptVersion CRUD Operations =====

/**
 * Create a new task prompt version.
 * @param personaId - Persona ID
 * @param versionNumber - Version number (auto-incremented if not provided)
 * @param promptText - Prompt text content
 * @param rationale - Improvement rationale
 * @param createdBy - Source of the prompt (human/ai)
 * @param label - Optional display label
 * @param db - Optional database instance
 * @returns Created prompt version
 */
export function createTaskPromptVersion(
  personaId: string,
  versionNumber: number,
  promptText: string,
  rationale: string | null,
  createdBy: PromptSource,
  label?: string | null,
  db?: Database.Database
): TaskPromptVersion {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO task_prompt_versions (
      id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, personaId, versionNumber, promptText, rationale, label || null, createdBy, now);

  return getTaskPromptVersion(id, database)!;
}

/**
 * Get next version number for a persona's task prompt.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Next version number
 */
export function getNextTaskVersionNumber(personaId: string, db?: Database.Database): number {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM task_prompt_versions WHERE persona_id = ?'
  );
  const result = stmt.get(personaId) as { next_version: number };
  return result.next_version;
}

/**
 * Get task prompt version by ID.
 * @param id - Version ID
 * @param db - Optional database instance
 * @returns Prompt version or null
 */
export function getTaskPromptVersion(id: string, db?: Database.Database): TaskPromptVersion | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM task_prompt_versions WHERE id = ?');
  return stmt.get(id) as TaskPromptVersion | null;
}

/**
 * Get task prompt version by persona and version number.
 * @param personaId - Persona ID
 * @param versionNumber - Version number
 * @param db - Optional database instance
 * @returns Prompt version or null
 */
export function getTaskPromptVersionByNumber(
  personaId: string,
  versionNumber: number,
  db?: Database.Database
): TaskPromptVersion | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT * FROM task_prompt_versions WHERE persona_id = ? AND version_number = ?'
  );
  return stmt.get(personaId, versionNumber) as TaskPromptVersion | null;
}

/**
 * Get all task prompt versions for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Array of prompt versions
 */
export function getTaskPromptHistory(personaId: string, db?: Database.Database): TaskPromptVersion[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT * FROM task_prompt_versions
    WHERE persona_id = ?
    ORDER BY version_number DESC
  `);
  return stmt.all(personaId) as TaskPromptVersion[];
}

// ===== Persona Current Version Management =====

/**
 * Set the current judge prompt version for a persona.
 * @param personaId - Persona ID
 * @param versionId - Judge prompt version ID
 * @param db - Optional database instance
 * @returns Updated persona
 */
export function setCurrentJudgeVersion(
  personaId: string,
  versionId: string,
  db?: Database.Database
): Persona {
  const dbInstance = db || getTrainingDatabase();

  return withTransaction((database) => {
    const persona = getPersona(personaId, database);
    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`);
    }

    const version = getJudgePromptVersion(versionId, database);
    if (!version) {
      throw new Error(`Judge prompt version not found: ${versionId}`);
    }

    if (version.persona_id !== personaId) {
      throw new Error(`Judge prompt version ${versionId} does not belong to persona ${personaId}`);
    }

    const stmt = database.prepare(
      'UPDATE personas SET current_judge_prompt_version_id = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(versionId, new Date().toISOString(), personaId);

    return getPersona(personaId, database)!;
  }, dbInstance);
}

/**
 * Set the current task prompt version for a persona.
 * @param personaId - Persona ID
 * @param versionId - Task prompt version ID
 * @param db - Optional database instance
 * @returns Updated persona
 */
export function setCurrentTaskVersion(
  personaId: string,
  versionId: string,
  db?: Database.Database
): Persona {
  const dbInstance = db || getTrainingDatabase();

  return withTransaction((database) => {
    const persona = getPersona(personaId, database);
    if (!persona) {
      throw new Error(`Persona not found: ${personaId}`);
    }

    const version = getTaskPromptVersion(versionId, database);
    if (!version) {
      throw new Error(`Task prompt version not found: ${versionId}`);
    }

    if (version.persona_id !== personaId) {
      throw new Error(`Task prompt version ${versionId} does not belong to persona ${personaId}`);
    }

    const stmt = database.prepare(
      'UPDATE personas SET current_task_prompt_version_id = ?, updated_at = ? WHERE id = ?'
    );
    stmt.run(versionId, new Date().toISOString(), personaId);

    return getPersona(personaId, database)!;
  }, dbInstance);
}

/**
 * Get the current judge prompt version for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Current judge prompt version or null
 */
export function getCurrentJudgeVersion(
  personaId: string,
  db?: Database.Database
): JudgePromptVersion | null {
  const persona = getPersona(personaId, db);
  if (!persona || !persona.current_judge_prompt_version_id) {
    return null;
  }
  return getJudgePromptVersion(persona.current_judge_prompt_version_id, db);
}

/**
 * Get the current task prompt version for a persona.
 * @param personaId - Persona ID
 * @param db - Optional database instance
 * @returns Current task prompt version or null
 */
export function getCurrentTaskVersion(
  personaId: string,
  db?: Database.Database
): TaskPromptVersion | null {
  const persona = getPersona(personaId, db);
  if (!persona || !persona.current_task_prompt_version_id) {
    return null;
  }
  return getTaskPromptVersion(persona.current_task_prompt_version_id, db);
}

// ===== TrainingLoopState CRUD Operations =====

/**
 * Create training loop state.
 * @param sessionId - Unique session ID
 * @param personaId - Persona ID
 * @param totalIterations - Target iteration count
 * @param judgeModelId - Judge model ID
 * @param promptEngineerModelId - Prompt engineer model ID
 * @param taskModelId - Task model ID
 * @param db - Optional database instance
 * @returns Created training loop state
 */
export function createTrainingLoopState(
  sessionId: string,
  personaId: string,
  totalIterations: number,
  judgeModelId: string,
  promptEngineerModelId: string,
  taskModelId: string,
  db?: Database.Database
): TrainingLoopState {
  const database = db || getTrainingDatabase();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO training_loop_state (
      session_id, persona_id, current_iteration, total_iterations, status,
      judge_model_id, prompt_engineer_model_id, task_model_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    sessionId,
    personaId,
    0,
    totalIterations,
    'pending',
    judgeModelId,
    promptEngineerModelId,
    taskModelId,
    now,
    now
  );

  return getTrainingLoopState(sessionId, database)!;
}

/**
 * Get training loop state by session ID.
 * @param sessionId - Session ID
 * @param db - Optional database instance
 * @returns Training loop state or null
 */
export function getTrainingLoopState(
  sessionId: string,
  db?: Database.Database
): TrainingLoopState | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_loop_state WHERE session_id = ?');
  return stmt.get(sessionId) as TrainingLoopState | null;
}

/**
 * Update training loop state.
 * @param sessionId - Session ID
 * @param updates - State updates
 * @param updates.current_iteration - Current iteration number
 * @param updates.status - Session status
 * @param updates.task_results_evaluated - Count of evaluated results
 * @param updates.error_message - Optional error message
 * @param updates.pause_reason - Optional pause reason
 * @param db - Optional database instance
 * @returns Updated training loop state
 */
export function updateTrainingLoopState(
  sessionId: string,
  updates: {
    current_iteration?: number;
    status?: SessionStatus;
    task_results_evaluated?: number;
    error_message?: string;
    pause_reason?: string;
  },
  db?: Database.Database
): TrainingLoopState {
  return withTransaction((database) => {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.current_iteration !== undefined) {
      fields.push('current_iteration = ?');
      values.push(updates.current_iteration);
    }

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (updates.task_results_evaluated !== undefined) {
      fields.push('task_results_evaluated = ?');
      values.push(updates.task_results_evaluated);
    }

    if (updates.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.error_message);
    }

    if (updates.pause_reason !== undefined) {
      fields.push('pause_reason = ?');
      values.push(updates.pause_reason);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(sessionId);

    const stmt = database.prepare(
      `UPDATE training_loop_state SET ${fields.join(', ')} WHERE session_id = ?`
    );

    stmt.run(...values);

    return getTrainingLoopState(sessionId, database)!;
  }, db);
}

// ===== TrainingLoopCheckpoint CRUD Operations =====

/**
 * Create a checkpoint.
 * @param sessionId - Session ID
 * @param iterationNumber - Iteration number
 * @param evaluatedResultCount - Evaluated count
 * @param metricsSnapshot - JSON metrics snapshot
 * @param evaluatedResultIds - JSON array of IDs
 * @param currentPrompt - Active prompt text
 * @param db - Optional database instance
 * @returns Created checkpoint
 */
export function createCheckpoint(
  sessionId: string,
  iterationNumber: number,
  evaluatedResultCount: number,
  metricsSnapshot: string,
  evaluatedResultIds: string,
  currentPrompt: string,
  db?: Database.Database
): TrainingLoopCheckpoint {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO training_loop_checkpoints (
      id, session_id, iteration_number, evaluated_result_count,
      metrics_snapshot, evaluated_result_ids, current_prompt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    sessionId,
    iterationNumber,
    evaluatedResultCount,
    metricsSnapshot,
    evaluatedResultIds,
    currentPrompt,
    now
  );

  return getCheckpoint(id, database)!;
}

/**
 * Get checkpoint by ID.
 * @param id - Checkpoint ID
 * @param db - Optional database instance
 * @returns Checkpoint or null
 */
export function getCheckpoint(id: string, db?: Database.Database): TrainingLoopCheckpoint | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_loop_checkpoints WHERE id = ?');
  return stmt.get(id) as TrainingLoopCheckpoint | null;
}

/**
 * Get latest checkpoint for a session.
 * @param sessionId - Session ID
 * @param db - Optional database instance
 * @returns Latest checkpoint or null
 */
export function getLatestCheckpoint(
  sessionId: string,
  db?: Database.Database
): TrainingLoopCheckpoint | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT * FROM training_loop_checkpoints
    WHERE session_id = ?
    ORDER BY iteration_number DESC
    LIMIT 1
  `);
  return stmt.get(sessionId) as TrainingLoopCheckpoint | null;
}
