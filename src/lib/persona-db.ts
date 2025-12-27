/**
 * Database access layer for LLM-as-Judge training tables
 * Provides connection helpers, transaction utilities, and CRUD operations
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './db';
import { validatePersonaCreation } from './persona-validator';
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
  TrainingLoopState,
  TrainingLoopCheckpoint,
  PersonaStatus,
  IterationStatus,
  SessionStatus,
  JudgeDecisionType,
  PromptSource,
} from '../types/training';

/**
 * Get database connection with training tables initialized
 */
export function getTrainingDatabase(): Database.Database {
  return getDatabase();
}

/**
 * Execute a function within a database transaction
 * Ensures atomicity: all-or-nothing persistence
 */
export function withTransaction<T>(fn: (db: Database.Database) => T, db?: Database.Database): T {
  const database = db || getTrainingDatabase();
  const transaction = database.transaction(fn);
  return transaction(database);
}

// ===== Persona CRUD Operations =====

/**
 * Create a new persona (with individual parameters)
 */
export function createPersona(
  name: string,
  description: string | null | undefined,
  task_prompt: string,
  task_model_id: string,
  judge_model_id: string,
  prompt_engineer_model_id: string,
  db?: Database.Database
): Persona;

/**
 * Create a new persona (with input object)
 */
export function createPersona(input: CreatePersonaInput, db?: Database.Database): Persona;

/**
 * Create a new persona - implementation
 */
export function createPersona(
  nameOrInput: string | CreatePersonaInput,
  descriptionOrDb?: string | null | Database.Database,
  task_prompt?: string,
  task_model_id?: string,
  judge_model_id?: string,
  prompt_engineer_model_id?: string,
  db?: Database.Database
): Persona {
  // Normalize to CreatePersonaInput object
  let input: CreatePersonaInput;
  let database: Database.Database | undefined;

  if (typeof nameOrInput === 'string') {
    // Called with individual parameters
    input = {
      name: nameOrInput,
      description:
        typeof descriptionOrDb === 'string' || descriptionOrDb === null
          ? descriptionOrDb
          : undefined,
      task_prompt: task_prompt!,
      task_model_id: task_model_id!,
      judge_model_id: judge_model_id!,
      prompt_engineer_model_id: prompt_engineer_model_id!,
    };
    database = db;
  } else {
    // Called with input object
    input = nameOrInput;
    database = descriptionOrDb as Database.Database | undefined;
  }

  const dbInstance = database || getTrainingDatabase();

  // Validate input
  const validation = validatePersonaCreation(input, dbInstance);
  if (!validation.isValid) {
    throw new Error(`Persona validation failed: ${validation.errors.join(', ')}`);
  }

  // Create persona
  return withTransaction((transactionDb) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = transactionDb.prepare(`
      INSERT INTO personas (
        id, name, description, task_prompt,
        task_model_id, judge_model_id, prompt_engineer_model_id,
        status, target_f1_score, max_iterations, current_iteration,
        created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.description || null,
      input.task_prompt,
      input.task_model_id,
      input.judge_model_id,
      input.prompt_engineer_model_id,
      'draft' as PersonaStatus,
      input.target_f1_score || 0.8,
      input.max_iterations || 5,
      0,
      now,
      now,
      input.created_by || null
    );

    return getPersona(id, transactionDb)!;
  }, dbInstance);
}

/**
 * Get persona by ID
 */
export function getPersona(id: string, db?: Database.Database): Persona | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM personas WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as Persona) : null;
}

/**
 * List all personas with optional status filter
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
 * Update persona fields
 */
export function updatePersona(
  id: string,
  updates: Partial<
    Pick<
      Persona,
      | 'name'
      | 'description'
      | 'task_prompt'
      | 'status'
      | 'current_iteration'
      | 'best_f1_score'
      | 'best_f1_iteration'
    >
  >,
  db?: Database.Database
): Persona {
  const dbInstance = db || getTrainingDatabase();

  return withTransaction((database) => {
    // Check if persona exists
    const existing = getPersona(id, database);
    if (!existing) {
      throw new Error(`Persona not found: ${id}`);
    }

    // Check for name uniqueness if name is being updated
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
    if (updates.task_prompt !== undefined) {
      fields.push('task_prompt = ?');
      values.push(updates.task_prompt);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.current_iteration !== undefined) {
      fields.push('current_iteration = ?');
      values.push(updates.current_iteration);
    }
    if (updates.best_f1_score !== undefined) {
      fields.push('best_f1_score = ?');
      values.push(updates.best_f1_score);
    }
    if (updates.best_f1_iteration !== undefined) {
      fields.push('best_f1_iteration = ?');
      values.push(updates.best_f1_iteration);
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
 * Delete persona (cascades to all training data)
 */
export function deletePersona(id: string, db?: Database.Database): void {
  const database = db || getTrainingDatabase();

  // Check if persona exists
  const existing = getPersona(id, database);
  if (!existing) {
    throw new Error(`Persona not found: ${id}`);
  }

  const stmt = database.prepare('DELETE FROM personas WHERE id = ?');
  stmt.run(id);
}

// ===== TrainingPair CRUD Operations =====

/**
 * Create multiple training pairs for a persona
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
    const ids: string[] = [];

    for (const pair of pairs) {
      const id = uuidv4();
      stmt.run(id, personaId, pair.input, pair.expected_output, now);
      ids.push(id);
    }

    return getTrainingPairs(personaId, database);
  }, db);
}

/**
 * Get all training pairs for a persona
 */
export function getTrainingPairs(personaId: string, db?: Database.Database): TrainingPair[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT * FROM training_pairs WHERE persona_id = ? ORDER BY created_at'
  );
  return stmt.all(personaId) as TrainingPair[];
}

/**
 * Get a single training pair by ID
 */
export function getTrainingPair(id: string, db?: Database.Database): TrainingPair | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_pairs WHERE id = ?');
  return stmt.get(id) as TrainingPair | null;
}

/**
 * Delete all training pairs for a persona
 */
export function deleteTrainingPairs(personaId: string, db?: Database.Database): void {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('DELETE FROM training_pairs WHERE persona_id = ?');
  stmt.run(personaId);
}

// ===== TrainingIteration CRUD Operations =====

/**
 * Create a new training iteration
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
 * Get training iteration by ID
 */
export function getTrainingIteration(id: string, db?: Database.Database): TrainingIteration | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_iterations WHERE id = ?');
  return stmt.get(id) as TrainingIteration | null;
}

/**
 * Get latest training iteration for a persona
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
 * List all iterations for a persona
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
 * Update training iteration status
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
 * Update iteration pair counts
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
 * Create a judge decision
 */
export function createJudgeDecision(
  iterationId: string,
  trainingPairId: string,
  generatedOutput: string,
  decision: JudgeDecisionType,
  confidence: number | null,
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
      judge_decision, judge_confidence, judge_reasoning, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    iterationId,
    trainingPairId,
    resultId || null,
    generatedOutput,
    decision,
    confidence,
    reasoning,
    now
  );

  return getJudgeDecision(id, database)!;
}

/**
 * Get judge decision by ID
 */
export function getJudgeDecision(id: string, db?: Database.Database): JudgeDecision | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM judge_decisions WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as JudgeDecision) : null;
}

/**
 * Get all judge decisions for an iteration
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
 * Create a human review for a judge decision
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
      id, judge_decision_id, human_decision, human_confidence, human_notes, reviewer_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.judge_decision_id,
    input.human_decision,
    input.human_confidence || null,
    input.human_notes || null,
    input.reviewer_id || null,
    now
  );

  return getHumanReview(id, database)!;
}

/**
 * Get human review by ID
 */
export function getHumanReview(id: string, db?: Database.Database): HumanReview | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM human_reviews WHERE id = ?');
  const result = stmt.get(id);
  return result ? (result as HumanReview) : null;
}

/**
 * Get human review by judge decision ID
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
 * Get all human reviews for an iteration
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
 * Create iteration metrics
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
 * Get iteration metrics by iteration ID
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
 * Get all metrics for a persona (across all iterations)
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
 * Create a new judge prompt version
 */
export function createPromptVersion(
  personaId: string,
  iterationNumber: number,
  promptText: string,
  rationale: string | null,
  createdBy: PromptSource,
  db?: Database.Database
): JudgePromptVersion {
  const database = db || getTrainingDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO judge_prompt_versions (
      id, persona_id, iteration_number, prompt_text, improvement_rationale, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, personaId, iterationNumber, promptText, rationale, createdBy, now);

  return getPromptVersion(id, database)!;
}

/**
 * Get prompt version by ID
 */
export function getPromptVersion(id: string, db?: Database.Database): JudgePromptVersion | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM judge_prompt_versions WHERE id = ?');
  return stmt.get(id) as JudgePromptVersion | null;
}

/**
 * Get prompt version by persona and iteration number
 */
export function getPromptVersionByIteration(
  personaId: string,
  iterationNumber: number,
  db?: Database.Database
): JudgePromptVersion | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(
    'SELECT * FROM judge_prompt_versions WHERE persona_id = ? AND iteration_number = ?'
  );
  return stmt.get(personaId, iterationNumber) as JudgePromptVersion | null;
}

/**
 * Get all prompt versions for a persona
 */
export function getPromptHistory(personaId: string, db?: Database.Database): JudgePromptVersion[] {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare(`
    SELECT * FROM judge_prompt_versions
    WHERE persona_id = ?
    ORDER BY iteration_number DESC
  `);
  return stmt.all(personaId) as JudgePromptVersion[];
}

// ===== TrainingLoopState CRUD Operations =====

/**
 * Create training loop state
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
 * Get training loop state by session ID
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
 * Update training loop state
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
 * Create a checkpoint
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
 * Get checkpoint by ID
 */
export function getCheckpoint(id: string, db?: Database.Database): TrainingLoopCheckpoint | null {
  const database = db || getTrainingDatabase();
  const stmt = database.prepare('SELECT * FROM training_loop_checkpoints WHERE id = ?');
  return stmt.get(id) as TrainingLoopCheckpoint | null;
}

/**
 * Get latest checkpoint for a session
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
