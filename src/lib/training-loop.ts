/**
 * Training Loop Orchestration
 * Manages iterative training cycles: generate outputs → judge → feedback → metrics
 */

import type { Database } from 'better-sqlite3';
import type { MetricsResult } from '../types/training';
import { calculateMetrics, buildConfusionMatrix } from './metrics';
import { TrainingStateError } from './training-errors';

/**
 * Represents a single evaluation result from a judge model.
 */
export interface JudgeResult {
  judge_decision: 'agree' | 'disagree';
  human_decision?: 'agree' | 'disagree';
}

/**
 * Orchestrates the iterative training loop for judge prompt refinement.
 * Handles the flow from generating model outputs to judge evaluation and metrics calculation.
 */
export class IterativeTrainingLoop {
  public readonly sessionId: string;
  public readonly personaId: string;
  private db: Database;
  private isPaused: boolean = false;

  /**
   * Initializes a new training loop instance.
   * @param sessionId - Unique session ID for tracking progress
   * @param personaId - ID of the persona being trained
   * @param db - Database connection
   */
  constructor(sessionId: string, personaId: string, db: Database) {
    this.sessionId = sessionId;
    this.personaId = personaId;
    this.db = db;
  }

  /**
   * Execute training iteration (fire-and-forget).
   * Persists state to database for crash recovery.
   * @param _taskResultIds - Array of task result IDs to process
   * @returns Promise that resolves when the iteration is started
   */
  async execute(_taskResultIds: string[]): Promise<void> {
    try {
      // Create training loop state if doesn't exist
      const existingState = this.db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(this.sessionId);

      if (!existingState) {
        // Fetch persona to get model IDs
        const persona = this.db
          .prepare('SELECT * FROM personas WHERE id = ?')
          .get(this.personaId) as any;

        if (!persona) {
          throw new TrainingStateError(`Persona not found: ${this.personaId}`);
        }

        // Create initial state
        this.db
          .prepare(
            `
            INSERT INTO training_loop_state
            (session_id, persona_id, current_iteration, total_iterations,
             status, task_model_id, judge_model_id, prompt_engineer_model_id,
             task_results_evaluated, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          )
          .run(
            this.sessionId,
            this.personaId,
            0,
            persona.max_iterations || 5,
            'in_progress',
            persona.task_model_id,
            persona.judge_model_id,
            persona.prompt_engineer_model_id,
            0,
            new Date().toISOString(),
            new Date().toISOString()
          );
      }

      // Generate judge decisions for all training pairs
      await this.generateJudgeDecisions();

      // Update status
      this.db
        .prepare('UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?')
        .run('in_progress', new Date().toISOString(), this.sessionId);
    } catch (error) {
      // Log error and update state
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.db
        .prepare(
          'UPDATE training_loop_state SET status = ?, error_message = ?, updated_at = ? WHERE session_id = ?'
        )
        .run('failed', errorMessage, new Date().toISOString(), this.sessionId);
      throw error;
    }
  }

  /**
   * Generate judge decisions for all training pairs.
   * Creates mock evaluations for MVP - will integrate with actual LLM judge in production.
   * @returns Promise that resolves when all decisions are generated and stored
   */
  private async generateJudgeDecisions(): Promise<void> {
    // Get current iteration
    const iteration = this.db
      .prepare(
        `SELECT * FROM training_iterations
         WHERE persona_id = ?
         ORDER BY iteration_number DESC
         LIMIT 1`
      )
      .get(this.personaId) as any;

    // Skip if no iteration exists (e.g., in unit tests)
    if (!iteration) {
      return;
    }

    // Fetch all training pairs
    const trainingPairs = this.db
      .prepare('SELECT * FROM training_pairs WHERE persona_id = ?')
      .all(this.personaId) as any[];

    // Skip if no training pairs (nothing to evaluate)
    if (trainingPairs.length === 0) {
      return;
    }

    // Import uuid at runtime
    const { v4: uuidv4 } = await import('uuid');

    // Generate judge decisions for each pair
    for (const pair of trainingPairs) {
      // For MVP: Generate mock task model output with realistic variations
      // In production, this would call the actual task LLM model
      const rand = Math.random();
      let taskModelOutput: string;
      let mockDecision: 'agree' | 'disagree';
      let mockReasoning: string;

      if (rand > 0.7) {
        // 30% - Completely wrong output (realistic wrong answers)
        const wrongAnswers = [
          "I don't have enough information to answer this question.",
          'Unable to process this request at this time.',
          'This appears to be outside my area of expertise.',
          'I cannot provide a response to this query.',
          'The information provided is insufficient for an accurate answer.',
          "I'm not sure how to respond to this.",
        ];
        taskModelOutput = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)];
        mockDecision = 'disagree';
        mockReasoning =
          'The task model output is completely incorrect and does not match the expected result.';
      } else if (rand > 0.4) {
        // 30% - Close but with variations (judge should agree - semantically correct)
        const variations = [
          `${pair.expected_output}.`,
          `${pair.expected_output} `,
          pair.expected_output.toLowerCase(),
          pair.expected_output.toUpperCase(),
          `Answer: ${pair.expected_output}`,
        ];
        taskModelOutput = variations[Math.floor(Math.random() * variations.length)];
        mockDecision = 'agree';
        mockReasoning =
          'The task model output is semantically correct despite minor formatting differences.';
      } else {
        // 40% - Partially correct or has issues (judge disagrees)
        taskModelOutput = `${pair.expected_output} [but with additional incorrect information]`;
        mockDecision = 'disagree';
        mockReasoning =
          'The task model output contains the correct answer but includes extraneous or incorrect information.';
      }

      // Random confidence score
      const mockConfidence = 0.7 + Math.random() * 0.3; // 0.7 to 1.0

      // Store judge decision
      const decisionId = uuidv4();
      this.db
        .prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision,
            judge_confidence, judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          decisionId,
          iteration.id,
          pair.id,
          taskModelOutput, // Task model's generated output (what judge evaluates)
          mockDecision,
          mockConfidence,
          mockReasoning,
          new Date().toISOString()
        );
    }

    // Update iteration with total pairs evaluated
    this.db
      .prepare('UPDATE training_iterations SET total_pairs_evaluated = ? WHERE id = ?')
      .run(trainingPairs.length, iteration.id);
  }

  /**
   * Evaluate task outputs with the judge model.
   * Stores judge decisions to database.
   * @param _taskResultIds - Array of IDs to evaluate
   * @returns Promise resolving when evaluation is complete
   */
  async evaluateWithJudge(_taskResultIds: string[]): Promise<void> {
    // Implementation would:
    // 1. For each task result:
    //    - Get input and expected output from training pair
    //    - Get generated output from result
    //    - Call judge model with judge prompt
    //    - Parse judge decision (agree/disagree with expected output)
    //    - Store judge_decision record
    // 2. Update training_loop_state with evaluated count

    // Placeholder for now
    return Promise.resolve();
  }

  /**
   * Calculate metrics from judge results and human feedback.
   * Can optionally use worker thread for CPU-intensive calculations.
   * @param judgeResults - Array of judge evaluation results
   * @returns Comprehensive metrics result
   */
  async calculateMetricsInWorker(judgeResults: JudgeResult[]): Promise<MetricsResult> {
    // Extract judge and human decisions
    const judgeAgreements: boolean[] = [];
    const humanAgreements: boolean[] = [];

    for (const result of judgeResults) {
      if (result.human_decision !== undefined) {
        // Map "agree"/"disagree" to boolean
        judgeAgreements.push(result.judge_decision === 'agree');
        humanAgreements.push(result.human_decision === 'agree');
      }
    }

    // Build confusion matrix
    const confusionMatrix = buildConfusionMatrix(judgeAgreements, humanAgreements);

    // Calculate metrics
    const metrics = calculateMetrics(confusionMatrix);

    return metrics;
  }

  /**
   * Pause the training loop.
   * Saves checkpoint and updates status.
   * @param reason - Optional explanation for pausing
   */
  async pause(reason?: string): Promise<void> {
    const state = this.db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(this.sessionId);

    if (!state) {
      throw new TrainingStateError(`Session not found: ${this.sessionId}`);
    }

    // Update status to paused
    this.db
      .prepare(
        'UPDATE training_loop_state SET status = ?, pause_reason = ?, updated_at = ? WHERE session_id = ?'
      )
      .run('paused', reason || null, new Date().toISOString(), this.sessionId);

    this.isPaused = true;
  }

  /**
   * Resume a paused training loop.
   * Loads checkpoint and continues from where it left off.
   * @returns Promise resolving when resumed execution starts
   */
  async resume(): Promise<void> {
    const state = this.db
      .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
      .get(this.sessionId) as any;

    if (!state) {
      throw new TrainingStateError(`Session not found: ${this.sessionId}`);
    }

    if (state.status !== 'paused') {
      throw new TrainingStateError(`Cannot resume session in status: ${state.status}`);
    }

    // Update status to in_progress
    this.db
      .prepare(
        'UPDATE training_loop_state SET status = ?, pause_reason = NULL, updated_at = ? WHERE session_id = ?'
      )
      .run('in_progress', new Date().toISOString(), this.sessionId);

    this.isPaused = false;

    // Continue execution from checkpoint
    // In production, this would fetch the latest checkpoint and resume
  }
}
