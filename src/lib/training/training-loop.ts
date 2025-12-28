/**
 * Training Loop Orchestration
 * Manages FULLY AUTOMATED iterative training cycles:
 * - Generate outputs → Judge → Auto-metrics from ground truth → Prompt refinement → Next iteration
 * - Continues until F1 ≥ target OR max iterations reached
 */

import type { Database } from 'better-sqlite3';
import type { MetricsResult } from '@src-types/training';
import { calculateMetrics, buildConfusionMatrix } from '@lib/evaluation/metrics';
import { calculateIterationMetricsFromGroundTruth } from '@lib/evaluation/metrics-orchestrator';
import { TrainingStateError } from './training-errors';
import { callModel } from '@lib/utils/api-clients';

/**
 * Check if mock mode is enabled for development.
 * Reads from MOCK_JUDGE_MODE environment variable (defaults to true for safety).
 */
const MOCK_JUDGE_MODE = process.env.MOCK_JUDGE_MODE !== 'false';

/**
 * Judge decision result from parsing LLM response.
 */
interface JudgeDecisionResult {
  decision: 'agree' | 'disagree';
  reasoning: string;
}

/**
 * Represents a single evaluation result from a judge model.
 */
export interface JudgeResult {
  judge_decision: 'agree' | 'disagree';
  human_decision?: 'agree' | 'disagree';
}

/**
 * Result from running a single iteration
 */
export interface IterationResult {
  iterationNumber: number;
  iterationId: string;
  f1Score: number;
  converged: boolean;
}

/**
 * Orchestrates the FULLY AUTOMATED iterative training loop for judge prompt refinement.
 * Handles the flow: generate → judge → auto-metrics → refine prompts → next iteration
 * Continues automatically until F1 ≥ target OR max iterations reached.
 */
export class IterativeTrainingLoop {
  public readonly sessionId: string;
  public readonly personaId: string;
  private db: Database;
  private isPaused: boolean = false;
  private isStopped: boolean = false;

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
   * Execute FULLY AUTOMATED training loop.
   * Runs ALL iterations until convergence or max iterations reached.
   * Persists state to database for crash recovery.
   * @param _taskResultIds - Array of task result IDs to process (ignored for MVP)
   * @returns Promise that resolves when all iterations complete
   */
  async execute(_taskResultIds: string[]): Promise<void> {
    try {
      // Fetch persona details
      const persona = this.db
        .prepare('SELECT * FROM personas WHERE id = ?')
        .get(this.personaId) as any;

      if (!persona) {
        throw new TrainingStateError(`Persona not found: ${this.personaId}`);
      }

      // Create training loop state if doesn't exist
      const existingState = this.db
        .prepare('SELECT * FROM training_loop_state WHERE session_id = ?')
        .get(this.sessionId);

      if (!existingState) {
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

      // Get current iteration number
      const currentIteration = this.db
        .prepare(
          `SELECT MAX(iteration_number) as max_iteration FROM training_iterations WHERE persona_id = ?`
        )
        .get(this.personaId) as { max_iteration: number | null };

      const startIteration = (currentIteration.max_iteration || 0) + 1;

      // Run FULLY AUTOMATED training loop
      let converged = false;
      for (
        let iterationNumber = startIteration;
        iterationNumber <= persona.max_iterations && !this.isStopped && !this.isPaused;
        iterationNumber++
      ) {
        // Check if paused from outside
        const state = this.db
          .prepare('SELECT status FROM training_loop_state WHERE session_id = ?')
          .get(this.sessionId) as { status: string } | undefined;

        if (state?.status === 'paused') {
          this.isPaused = true;
          break;
        }

        // Run single iteration
        const result = await this.runSingleIteration(iterationNumber, persona);

        // Update current iteration in state
        this.db
          .prepare(
            'UPDATE training_loop_state SET current_iteration = ?, updated_at = ? WHERE session_id = ?'
          )
          .run(iterationNumber, new Date().toISOString(), this.sessionId);

        // Check convergence
        if (result.converged) {
          converged = true;
          // Update persona status to trained
          this.db
            .prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?')
            .run('trained', new Date().toISOString(), this.personaId);
          break;
        }

        // Refine prompts for next iteration (if not converged and not at max)
        if (iterationNumber < persona.max_iterations) {
          await this.refinePrompts(result.iterationId);
        }
      }

      // Update final state (training_loop_state uses different statuses than personas)
      const finalStateStatus = this.isPaused ? 'paused' : converged ? 'completed' : 'completed';
      this.db
        .prepare('UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?')
        .run(finalStateStatus, new Date().toISOString(), this.sessionId);

      // Update persona status if not converged
      if (!converged && !this.isPaused) {
        this.db
          .prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?')
          .run('incomplete', new Date().toISOString(), this.personaId);
      }
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
   * Run a single training iteration
   * @param iterationNumber - The iteration number to run
   * @param persona - The persona configuration
   * @returns Iteration result with convergence status
   */
  private async runSingleIteration(
    iterationNumber: number,
    persona: any
  ): Promise<IterationResult> {
    // Create training iteration record
    const iterationId = crypto.randomUUID();

    // Get current judge prompt (either from latest prompt version or initial)
    const judgePrompt = this.db
      .prepare(
        'SELECT prompt_text FROM judge_prompt_versions WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1'
      )
      .get(this.personaId) as { prompt_text: string } | undefined;

    const judgePromptText = judgePrompt?.prompt_text || persona.task_prompt;

    // Get current task prompt
    const taskPromptText = persona.task_prompt;

    this.db
      .prepare(
        `
        INSERT INTO training_iterations
        (id, persona_id, iteration_number, judge_model_id, judge_prompt_text,
         status, total_pairs_evaluated, pairs_reviewed_by_human, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        iterationId,
        this.personaId,
        iterationNumber,
        persona.judge_model_id,
        judgePromptText,
        'in_progress',
        0,
        0,
        new Date().toISOString()
      );

    // Update persona current iteration
    this.db
      .prepare('UPDATE personas SET current_iteration = ?, updated_at = ? WHERE id = ?')
      .run(iterationNumber, new Date().toISOString(), this.personaId);

    // Generate judge decisions for all training pairs
    await this.generateJudgeDecisions(iterationId);

    // Calculate metrics AUTOMATICALLY from ground truth (no human review required)
    const { metrics } = calculateIterationMetricsFromGroundTruth(iterationId, this.db);

    // Update iteration status to completed
    this.db
      .prepare('UPDATE training_iterations SET status = ?, completed_at = ? WHERE id = ?')
      .run('completed', new Date().toISOString(), iterationId);

    // Check convergence
    const converged = metrics.f1_score >= persona.target_f1_score;

    // Store prompt versions for this iteration (both task and judge prompts)
    this.storeTaskPromptVersion(iterationNumber, taskPromptText, 'ai', metrics);
    this.storeJudgePromptVersion(iterationNumber, judgePromptText, 'ai', metrics);

    return {
      iterationNumber,
      iterationId,
      f1Score: metrics.f1_score,
      converged,
    };
  }

  /**
   * Generate judge decisions for all training pairs.
   * Uses mock data when MOCK_JUDGE_MODE is true, otherwise calls real LLM models.
   * @param iterationId - The iteration ID
   * @returns Promise that resolves when all decisions are generated and stored
   */
  private async generateJudgeDecisions(iterationId: string): Promise<void> {
    // Fetch all training pairs
    const trainingPairs = this.db
      .prepare('SELECT * FROM training_pairs WHERE persona_id = ?')
      .all(this.personaId) as any[];

    // Skip if no training pairs (nothing to evaluate)
    if (trainingPairs.length === 0) {
      return;
    }

    // Fetch persona and iteration for model IDs
    const persona = this.db
      .prepare('SELECT * FROM personas WHERE id = ?')
      .get(this.personaId) as any;

    const iteration = this.db
      .prepare('SELECT * FROM training_iterations WHERE id = ?')
      .get(iterationId) as any;

    if (!persona || !iteration) {
      throw new TrainingStateError('Persona or iteration not found');
    }

    // Import uuid at runtime
    const { v4: uuidv4 } = await import('uuid');

    // Generate judge decisions for each pair
    for (const pair of trainingPairs) {
      let taskModelOutput: string;
      let judgeDecision: 'agree' | 'disagree';
      let judgeReasoning: string;
      let judgeConfidence: number;

      if (MOCK_JUDGE_MODE) {
        // Use mock data for development (reduces token costs)
        const mockResult = await this.generateMockDecision(pair);
        taskModelOutput = mockResult.taskModelOutput;
        judgeDecision = mockResult.judgeDecision;
        judgeReasoning = mockResult.judgeReasoning;
        judgeConfidence = mockResult.judgeConfidence;
      } else {
        // Use real LLM calls for production
        // Step 1: Call task model to generate output
        taskModelOutput = await this.callTaskModel(
          persona.task_model_id,
          pair.input,
          persona.task_prompt
        );

        // Step 2: Call judge model to evaluate the output
        const judgeResult = await this.callJudgeModel(
          persona.judge_model_id,
          pair.input,
          taskModelOutput,
          iteration.judge_prompt_text
        );
        judgeDecision = judgeResult.decision;
        judgeReasoning = judgeResult.reasoning;
        judgeConfidence = 0.85; // Default confidence for LLM-based judge
      }

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
          iterationId,
          pair.id,
          taskModelOutput,
          judgeDecision,
          judgeConfidence,
          judgeReasoning,
          new Date().toISOString()
        );
    }

    // Update iteration with total pairs evaluated
    this.db
      .prepare('UPDATE training_iterations SET total_pairs_evaluated = ? WHERE id = ?')
      .run(trainingPairs.length, iterationId);
  }

  /**
   * Generate mock decision for development/testing (reduces token costs).
   * @param pair - Training pair with input and expected output
   * @returns Mock decision result
   */
  private async generateMockDecision(pair: { input: string; expected_output: string }): Promise<{
    taskModelOutput: string;
    judgeDecision: 'agree' | 'disagree';
    judgeReasoning: string;
    judgeConfidence: number;
  }> {
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

    return {
      taskModelOutput,
      judgeDecision: mockDecision,
      judgeReasoning: mockReasoning,
      judgeConfidence: 0.7 + Math.random() * 0.3, // 0.7 to 1.0
    };
  }

  /**
   * Call the task model to generate output for the given input.
   * @param taskModelId - Model ID for the task model
   * @param input - Input to generate response for
   * @param taskPrompt - Task prompt to guide generation
   * @returns Generated output
   */
  private async callTaskModel(
    taskModelId: string,
    input: string,
    taskPrompt: string
  ): Promise<string> {
    const systemPrompt = `You are a task model. Follow these instructions: ${taskPrompt}`;
    const instruction = `Input: ${input}\n\nGenerate a response following the task instructions above.`;

    try {
      return await callModel(taskModelId, instruction, { systemPrompt, temperature: 0.7 });
    } catch (error) {
      console.error('Task model call failed:', error);
      throw new TrainingStateError(
        `Failed to call task model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Call the judge model to evaluate the generated output.
   * @param judgeModelId - Model ID for the judge model
   * @param input - Original input
   * @param generatedOutput - Output from task model
   * @param judgePrompt - Judge prompt to guide evaluation
   * @returns Judge decision and reasoning
   */
  private async callJudgeModel(
    judgeModelId: string,
    input: string,
    generatedOutput: string,
    judgePrompt: string
  ): Promise<JudgeDecisionResult> {
    const instruction = `Judge Prompt: ${judgePrompt}

Input: ${input}
Generated Output: ${generatedOutput}

Evaluate whether the generated output correctly addresses the input according to the judge prompt.

Respond with a JSON object containing:
{
  "decision": "agree" or "disagree",
  "reasoning": "Brief explanation of your decision (1-2 sentences)"
}`;

    try {
      const response = await callModel(judgeModelId, instruction, { temperature: 0.3 });
      return this.parseJudgeResponse(response);
    } catch (error) {
      console.error('Judge model call failed:', error);
      throw new TrainingStateError(
        `Failed to call judge model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse the judge model's response to extract decision and reasoning.
   * @param response - Raw response from judge model
   * @returns Parsed decision and reasoning
   */
  private parseJudgeResponse(response: string): JudgeDecisionResult {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response.trim());
      if (parsed.decision === 'agree' || parsed.decision === 'disagree') {
        return {
          decision: parsed.decision,
          reasoning: parsed.reasoning || 'No reasoning provided',
        };
      }
    } catch {
      // If JSON parsing fails, fall back to text analysis
    }

    // Fallback: analyze the response text
    const lowerResponse = response.toLowerCase();
    if (
      lowerResponse.includes('"decision": "agree"') ||
      lowerResponse.includes('decision: agree')
    ) {
      return {
        decision: 'agree',
        reasoning: 'Parsed from response text',
      };
    } else if (
      lowerResponse.includes('"decision": "disagree"') ||
      lowerResponse.includes('decision: disagree')
    ) {
      return {
        decision: 'disagree',
        reasoning: 'Parsed from response text',
      };
    }

    // Last resort: default to disagree
    return {
      decision: 'disagree',
      reasoning: 'Could not parse judge response clearly, defaulting to disagree',
    };
  }

  /**
   * Refine prompts based on failure analysis using the Prompt Engineer LLM
   * @param iterationId - The iteration ID to analyze
   * @returns Promise that resolves when prompts are refined
   */
  private async refinePrompts(iterationId: string): Promise<void> {
    // Get persona's current task prompt and prompt engineer model ID
    const persona = this.db
      .prepare('SELECT task_prompt, prompt_engineer_model_id FROM personas WHERE id = ?')
      .get(this.personaId) as { task_prompt: string; prompt_engineer_model_id: string } | undefined;

    if (!persona) {
      return;
    }

    // Get current iteration data with metrics
    const iteration = this.db
      .prepare(
        `
        SELECT ti.*, im.f1_score, im.precision, im.recall, im.cohens_kappa, im.accuracy,
               im.true_positives, im.true_negatives, im.false_positives, im.false_negatives
        FROM training_iterations ti
        LEFT JOIN iteration_metrics im ON im.iteration_id = ti.id
        WHERE ti.id = ?
      `
      )
      .get(iterationId) as any;

    if (!iteration) {
      return;
    }

    // Build failure context from ground truth comparison
    // This requires fetching judge decisions with expected outputs
    const decisions = this.db
      .prepare(
        `
        SELECT
          jd.judge_decision,
          jd.generated_output,
          jd.judge_reasoning,
          tp.input,
          tp.expected_output
        FROM judge_decisions jd
        JOIN training_pairs tp ON tp.id = jd.training_pair_id
        WHERE jd.iteration_id = ?
      `
      )
      .all(iterationId) as Array<{
      judge_decision: 'agree' | 'disagree';
      generated_output: string;
      judge_reasoning: string;
      input: string;
      expected_output: string;
    }>;

    // Separate false positives and false negatives
    const falsePositives: any[] = [];
    const falseNegatives: any[] = [];

    for (const decision of decisions) {
      const isCorrect = this.isOutputCorrect(decision.generated_output, decision.expected_output);

      if (!isCorrect && decision.judge_decision === 'agree') {
        // False Positive: Judge said agree but output is wrong
        falsePositives.push({
          model_output: decision.generated_output,
          expected_output: decision.expected_output,
          why_it_should_have_disagreed: `The generated output "${decision.generated_output}" does not match the expected output "${decision.expected_output}"`,
        });
      } else if (isCorrect && decision.judge_decision === 'disagree') {
        // False Negative: Judge said disagree but output is correct
        falseNegatives.push({
          model_output: decision.generated_output,
          expected_output: decision.expected_output,
          why_it_should_have_agreed: `The generated output "${decision.generated_output}" correctly matches the expected output "${decision.expected_output}"`,
        });
      }
    }

    // Call the Prompt Engineer LLM to refine the judge prompt
    try {
      const { refineJudgePrompt } = await import('./prompt-engineer');

      // Build failure analysis context
      const failureContext: any = {
        current_metrics: {
          f1_score: iteration.f1_score || 0,
          precision: iteration.precision || 0,
          recall: iteration.recall || 0,
          cohens_kappa: iteration.cohens_kappa || 0,
          accuracy: iteration.accuracy || 0,
          confusion_matrix: {
            true_positives: iteration.true_positives || 0,
            true_negatives: iteration.true_negatives || 0,
            false_positives: iteration.false_positives || 0,
            false_negatives: iteration.false_negatives || 0,
          },
        },
        iteration_number: iteration.iteration_number,
        false_positives: falsePositives,
        false_negatives: falseNegatives,
        correct_examples: [], // Could add some correct examples for calibration
        current_prompt: iteration.judge_prompt_text,
        task_description: persona.task_prompt,
      };

      // Call the prompt engineer to refine the judge prompt
      const result = await refineJudgePrompt(failureContext, persona.prompt_engineer_model_id);

      if (result.improved_prompt) {
        // Store the refined judge prompt for the NEXT iteration
        // This ensures startNextIteration() will pick up the refined prompt
        const nextIterationNumber = iteration.iteration_number + 1;
        this.storeJudgePromptVersion(nextIterationNumber, result.improved_prompt, 'ai', {
          f1_score: iteration.f1_score || 0,
          precision: iteration.precision || 0,
          recall: iteration.recall || 0,
          accuracy: iteration.accuracy || 0,
          cohens_kappa: iteration.cohens_kappa || 0,
          confusion_matrix: {
            true_positives: iteration.true_positives || 0,
            true_negatives: iteration.true_negatives || 0,
            false_positives: iteration.false_positives || 0,
            false_negatives: iteration.false_negatives || 0,
          },
        });

        console.info(
          `Refined judge prompt for iteration ${nextIterationNumber}: ${result.rationale}`
        );
      } else {
        console.warn('Prompt refinement returned no improved prompt, keeping current prompt');
      }
    } catch (error) {
      console.error('Failed to refine prompt using LLM:', error);
      // Fallback: store current prompt for next iteration with note about failure
      const nextIterationNumber = iteration.iteration_number + 1;
      const fallbackPrompt = `${iteration.judge_prompt_text}\n\n[Note: Automatic refinement after iteration ${iteration.iteration_number} failed - manual review recommended. F1: ${iteration.f1_score?.toFixed(3) || 'N/A'}]`;
      this.storeJudgePromptVersion(nextIterationNumber, fallbackPrompt, 'ai', {
        f1_score: iteration.f1_score || 0,
        precision: iteration.precision || 0,
        recall: iteration.recall || 0,
        accuracy: iteration.accuracy || 0,
        cohens_kappa: iteration.cohens_kappa || 0,
        confusion_matrix: {
          true_positives: iteration.true_positives || 0,
          true_negatives: iteration.true_negatives || 0,
          false_positives: iteration.false_positives || 0,
          false_negatives: iteration.false_negatives || 0,
        },
      });
    }
  }

  /**
   * Determine if generated output matches expected output
   * Uses exact string comparison for MVP - could use semantic similarity in production
   * @param generatedOutput - The output generated by the task model
   * @param expectedOutput - The ground truth expected output
   * @returns True if outputs match, false otherwise
   */
  private isOutputCorrect(generatedOutput: string, expectedOutput: string): boolean {
    // Normalize both strings for comparison (trim, lowercase)
    const normalizedGenerated = generatedOutput.trim().toLowerCase();
    const normalizedExpected = expectedOutput.trim().toLowerCase();

    // Exact match after normalization
    return normalizedGenerated === normalizedExpected;
  }

  /**
   * Store task prompt version for history tracking
   * @param iterationNumber - The iteration number
   * @param promptText - The prompt text to store
   * @param createdBy - Who created this version (human/ai)
   * @param metrics - The metrics for this iteration
   */
  private storeTaskPromptVersion(
    iterationNumber: number,
    promptText: string,
    createdBy: 'human' | 'ai',
    metrics: MetricsResult
  ): void {
    // Check if a version already exists for this iteration
    const existing = this.db
      .prepare('SELECT id FROM task_prompt_versions WHERE persona_id = ? AND iteration_number = ?')
      .get(this.personaId, iterationNumber);

    if (existing) {
      // Don't create duplicate versions
      return;
    }

    // Create new task prompt version
    this.db
      .prepare(
        `
        INSERT INTO task_prompt_versions
        (id, persona_id, iteration_number, prompt_text, improvement_rationale, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        crypto.randomUUID(),
        this.personaId,
        iterationNumber,
        promptText,
        `F1 Score: ${metrics.f1_score.toFixed(3)}, Precision: ${metrics.precision.toFixed(3)}, Recall: ${metrics.recall.toFixed(3)}`,
        createdBy,
        new Date().toISOString()
      );
  }

  /**
   * Store judge prompt version for history tracking
   * @param iterationNumber - The iteration number
   * @param promptText - The prompt text to store
   * @param createdBy - Who created this version (human/ai)
   * @param metrics - The metrics for this iteration
   */
  private storeJudgePromptVersion(
    iterationNumber: number,
    promptText: string,
    createdBy: 'human' | 'ai',
    metrics: MetricsResult
  ): void {
    // Check if a version already exists for this iteration
    const existing = this.db
      .prepare('SELECT id FROM judge_prompt_versions WHERE persona_id = ? AND iteration_number = ?')
      .get(this.personaId, iterationNumber);

    if (existing) {
      // Don't create duplicate versions
      return;
    }

    // Create new judge prompt version
    this.db
      .prepare(
        `
        INSERT INTO judge_prompt_versions
        (id, persona_id, iteration_number, prompt_text, improvement_rationale, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        crypto.randomUUID(),
        this.personaId,
        iterationNumber,
        promptText,
        `F1 Score: ${metrics.f1_score.toFixed(3)}, Precision: ${metrics.precision.toFixed(3)}, Recall: ${metrics.recall.toFixed(3)}`,
        createdBy,
        new Date().toISOString()
      );
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
    // For MVP, we restart the loop which will continue from the last completed iteration
    await this.execute([]);
  }

  /**
   * Stop the training loop (used for graceful shutdown)
   */
  stop(): void {
    this.isStopped = true;
  }
}
