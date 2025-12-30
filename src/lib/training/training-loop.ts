/**
 * Training Loop Orchestration
 * Manages iterative training cycles with a two-phase approach:
 * - Iteration 1 (Human-Guided): Generate outputs → Judge → STOP for human review → Calculate metrics from human votes → LLM-based refinement of both prompts
 * - Iterations 2+ (Fully Automated): Generate outputs → Judge → Auto-metrics from ground truth → LLM-based refinement of both prompts → Next iteration
 */

import type { Database } from 'better-sqlite3';
import type {
  MetricsResult,
  Persona,
  TrainingPair,
  TrainingIteration,
  TrainingLoopState,
} from '@src-types/training';
import type {
  FailureAnalysisContext,
  FailureExample,
  FalseNegativeExample,
} from './failure-analysis';
import { calculateMetrics, buildConfusionMatrix } from '@lib/evaluation/metrics';
import { calculateIterationMetricsFromGroundTruth } from '@lib/evaluation/metrics-orchestrator';
import { getSemanticSimilarityScore } from '@lib/evaluation/semanticSimilarity';
import { TrainingStateError } from './training-errors';
import { callModel, extractJsonFromResponse } from '@lib/utils/api-clients';
import {
  buildTaskModelSystemPrompt,
  buildTaskModelInstruction,
  buildJudgeEvaluationInstruction,
} from './prompt-engineer';
import { createLogger } from '@lib/logger';

const logger = createLogger('TrainingLoop');

/**
 * Check if mock mode is enabled for development.
 * Reads from MOCK_JUDGE_MODE environment variable (defaults to true for safety).
 */
const MOCK_JUDGE_MODE = import.meta.env?.MOCK_JUDGE_MODE !== 'false';

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
   * Execute training loop with two-phase approach:
   * - Iteration 1: Generate → Judge → STOP for human review
   * - Iterations 2+: Generate → Judge → Auto-metrics → Refine → Next iteration
   * Persists state to database for crash recovery.
   * @param _taskResultIds - Array of task result IDs to process (ignored for MVP)
   * @returns Promise that resolves when all iterations complete
   */
  async execute(_taskResultIds: string[]): Promise<void> {
    try {
      // Fetch persona details
      const persona = this.db.prepare('SELECT * FROM personas WHERE id = ?').get(this.personaId) as
        | Persona
        | undefined;

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

      logger.info('Starting training loop', {
        sessionId: this.sessionId,
        personaId: this.personaId,
        startIteration,
        maxIterations: persona.max_iterations,
      });

      // Run training loop with iteration 1 special handling
      let converged = false;
      let awaitingHumanReview = false;
      for (
        let iterationNumber = startIteration;
        iterationNumber <= persona.max_iterations && !this.isStopped && !this.isPaused;
        iterationNumber++
      ) {
        logger.logIterationStart(this.personaId, iterationNumber);
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

        // ITERATION 1: STOP after judge evaluation, wait for human review
        if (iterationNumber === 1) {
          // Mark iteration as awaiting human review
          this.db
            .prepare('UPDATE training_iterations SET status = ? WHERE id = ?')
            .run('awaiting_human_review', result.iterationId);

          this.db
            .prepare(
              'UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?'
            )
            .run('awaiting_human_review', new Date().toISOString(), this.sessionId);

          // Update persona status
          this.db
            .prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?')
            .run('awaiting_human_review', new Date().toISOString(), this.personaId);

          // STOP - wait for human to call acceptPromptsAndContinue()
          logger.info(
            'Iteration 1 complete. Awaiting human review and prompt acceptance before continuing.',
            {
              personaId: this.personaId,
              iterationId: result.iterationId,
            }
          );
          awaitingHumanReview = true;
          break;
        }

        // ITERATIONS 2+: Check convergence and continue automatically
        if (result.converged) {
          converged = true;
          logger.info('Training converged', {
            personaId: this.personaId,
            iterationNumber,
            f1Score: result.f1Score,
          });
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

      logger.info('Training loop finished', {
        sessionId: this.sessionId,
        personaId: this.personaId,
        converged,
        awaitingHumanReview,
        isPaused: this.isPaused,
      });

      // Update final state ONLY if not awaiting human review
      // (awaiting_human_review status is already set in the iteration 1 block)
      if (!awaitingHumanReview) {
        const finalStateStatus = this.isPaused ? 'paused' : converged ? 'completed' : 'completed';
        logger.info('Updating final state', {
          sessionId: this.sessionId,
          status: finalStateStatus,
        });
        this.db
          .prepare('UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?')
          .run(finalStateStatus, new Date().toISOString(), this.sessionId);

        // Update persona status if not converged
        if (!converged && !this.isPaused) {
          this.db
            .prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?')
            .run('incomplete', new Date().toISOString(), this.personaId);
        }
      } else {
        logger.info('Skipping final state update - awaiting human review', {
          sessionId: this.sessionId,
        });
      }
    } catch (error) {
      // Log error and update state
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.db
        .prepare(
          'UPDATE training_loop_state SET status = ?, error_message = ?, updated_at = ? WHERE session_id = ?'
        )
        .run('failed', errorMessage, new Date().toISOString(), this.sessionId);
      logger.error('Training loop failed', error as Error, {
        sessionId: this.sessionId,
        personaId: this.personaId,
      });
      throw error;
    }
  }

  /**
   * Run a single training iteration
   * For iteration 1: stops after judge evaluation (no metrics calculation)
   * For iterations 2+: calculates metrics automatically from ground truth
   * @param iterationNumber - The iteration number to run
   * @param persona - The persona configuration
   * @returns Iteration result with convergence status
   */
  private async runSingleIteration(
    iterationNumber: number,
    persona: Persona
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

    // Get current task prompt (from latest version or initial persona prompt)
    const taskPrompt = this.db
      .prepare(
        'SELECT prompt_text FROM task_prompt_versions WHERE persona_id = ? ORDER BY iteration_number DESC LIMIT 1'
      )
      .get(this.personaId) as { prompt_text: string } | undefined;

    const taskPromptText = taskPrompt?.prompt_text || persona.task_prompt;

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

    // ITERATION 1: Don't calculate metrics yet - wait for human review
    // Metrics will be calculated in acceptPromptsAndContinue() after human provides feedback
    if (iterationNumber === 1) {
      // Store prompt versions for iteration 1 (metrics will be updated later)
      this.storeTaskPromptVersion(iterationNumber, taskPromptText, 'ai', {
        f1_score: 0,
        precision: 0,
        recall: 0,
        cohens_kappa: 0,
        accuracy: 0,
        confusion_matrix: {
          true_positives: 0,
          true_negatives: 0,
          false_positives: 0,
          false_negatives: 0,
        },
      });
      this.storeJudgePromptVersion(iterationNumber, judgePromptText, 'ai', {
        f1_score: 0,
        precision: 0,
        recall: 0,
        cohens_kappa: 0,
        accuracy: 0,
        confusion_matrix: {
          true_positives: 0,
          true_negatives: 0,
          false_positives: 0,
          false_negatives: 0,
        },
      });

      return {
        iterationNumber,
        iterationId,
        f1Score: 0, // Will be calculated after human review
        converged: false, // Cannot determine convergence without metrics
      };
    }

    // ITERATIONS 2+: Calculate metrics AUTOMATICALLY from ground truth
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
      .all(this.personaId) as TrainingPair[];

    // Skip if no training pairs (nothing to evaluate)
    if (trainingPairs.length === 0) {
      return;
    }

    // Fetch persona and iteration for model IDs
    const persona = this.db.prepare('SELECT * FROM personas WHERE id = ?').get(this.personaId) as
      | Persona
      | undefined;

    const iteration = this.db
      .prepare('SELECT * FROM training_iterations WHERE id = ?')
      .get(iterationId) as TrainingIteration | undefined;

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

      if (MOCK_JUDGE_MODE) {
        // Use mock data for development (reduces token costs)
        const mockResult = await this.generateMockDecision(pair);
        taskModelOutput = mockResult.taskModelOutput;
        judgeDecision = mockResult.judgeDecision;
        judgeReasoning = mockResult.judgeReasoning;
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
          iteration.judge_prompt_text,
          pair.expected_output
        );
        judgeDecision = judgeResult.decision;
        judgeReasoning = judgeResult.reasoning;
      }

      // Store judge decision
      const decisionId = uuidv4();
      this.db
        .prepare(
          `INSERT INTO judge_decisions
           (id, iteration_id, training_pair_id, generated_output, judge_decision,
            judge_reasoning, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          decisionId,
          iterationId,
          pair.id,
          taskModelOutput,
          judgeDecision,
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
    const systemPrompt = buildTaskModelSystemPrompt(taskPrompt);
    const instruction = buildTaskModelInstruction(input);

    try {
      return await callModel(taskModelId, instruction, { systemPrompt, temperature: 0.7 });
    } catch (error) {
      logger.logLLMError('unknown', taskModelId, error as Error);
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
   * @param expectedOutput - Optional expected output for semantic similarity fallback
   * @returns Judge decision and reasoning
   */
  private async callJudgeModel(
    judgeModelId: string,
    input: string,
    generatedOutput: string,
    judgePrompt: string,
    expectedOutput?: string
  ): Promise<JudgeDecisionResult> {
    const instruction = buildJudgeEvaluationInstruction(judgePrompt, input, generatedOutput);

    try {
      const response = await callModel(judgeModelId, instruction, { temperature: 0.3 });
      const jsonContent = extractJsonFromResponse(response);
      return this.parseJudgeResponse(jsonContent, generatedOutput, expectedOutput);
    } catch (error) {
      logger.logLLMError('unknown', judgeModelId, error as Error);
      throw new TrainingStateError(
        `Failed to call judge model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse the judge model's response to extract decision and reasoning.
   * Uses semantic similarity as fallback when JSON parsing fails and expected output is provided.
   * @param response - Raw response from judge model
   * @param generatedOutput - The generated output for semantic similarity fallback
   * @param expectedOutput - The expected output for semantic similarity fallback
   * @returns Parsed decision and reasoning
   */
  private async parseJudgeResponse(
    response: string,
    generatedOutput?: string,
    expectedOutput?: string
  ): Promise<JudgeDecisionResult> {
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

    // Fallback 1: analyze the response text for decision keywords
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

    // Fallback 2: use semantic similarity if both generated and expected outputs are available
    if (generatedOutput && expectedOutput) {
      try {
        const similarityResult = await getSemanticSimilarityScore(generatedOutput, expectedOutput);
        const decision = similarityResult.overallMatch ? 'agree' : 'disagree';
        return {
          decision,
          reasoning: `Semantic similarity fallback (score: ${similarityResult.score}, ${similarityResult.reasoning})`,
        };
      } catch (error) {
        logger.warn('Semantic similarity fallback failed, using default', { error });
      }
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
    // Get persona's prompt engineer model ID and fallback task prompt
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
      .get(iterationId) as
      | {
          status: string;
          iteration_number: number;
          total_pairs_evaluated: number;
          judge_prompt_text: string;
          f1_score: number | null;
          precision: number | null;
          recall: number | null;
          cohens_kappa: number | null;
          accuracy: number | null;
          true_positives: number | null;
          true_negatives: number | null;
          false_positives: number | null;
          false_negatives: number | null;
        }
      | undefined;

    if (!iteration) {
      return;
    }

    // Get current task prompt from task_prompt_versions for this iteration
    const taskPromptVersion = this.db
      .prepare(
        'SELECT prompt_text FROM task_prompt_versions WHERE persona_id = ? AND iteration_number <= ? ORDER BY iteration_number DESC LIMIT 1'
      )
      .get(this.personaId, iteration.iteration_number) as { prompt_text: string } | undefined;

    const currentTaskPrompt = taskPromptVersion?.prompt_text || persona.task_prompt;

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
    const falsePositives: FailureExample[] = [];
    const falseNegatives: FalseNegativeExample[] = [];

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

    // Call the Prompt Engineer LLM to refine BOTH prompts
    try {
      const { refineBothPromptsFromFailureAnalysis } = await import('./prompt-engineer');

      // Build failure analysis context
      const failureContext: FailureAnalysisContext = {
        current_metrics: {
          f1_score: iteration.f1_score ?? 0,
          precision: iteration.precision ?? 0,
          recall: iteration.recall ?? 0,
          cohens_kappa: iteration.cohens_kappa ?? 0,
          accuracy: iteration.accuracy ?? 0,
          confusion_matrix: {
            true_positives: iteration.true_positives ?? 0,
            true_negatives: iteration.true_negatives ?? 0,
            false_positives: iteration.false_positives ?? 0,
            false_negatives: iteration.false_negatives ?? 0,
          },
        },
        iteration_number: iteration.iteration_number,
        false_positives: falsePositives,
        false_negatives: falseNegatives,
        correct_examples: [], // Could add some correct examples for calibration
        judge_prompt: iteration.judge_prompt_text,
        task_prompt: currentTaskPrompt,
        evaluation_criteria: [],
      };

      // Call the prompt engineer to refine BOTH prompts
      const result = await refineBothPromptsFromFailureAnalysis(
        failureContext,
        persona.prompt_engineer_model_id
      );

      const nextIterationNumber = iteration.iteration_number + 1;

      logger.info('Prompt refinement result', {
        iterationNumber: nextIterationNumber,
        refinedTaskPrompt: !!result.refined_task_prompt,
        refinedJudgePrompt: !!result.refined_judge_prompt,
      });

      if (result.refined_task_prompt) {
        // Store the refined task prompt for the NEXT iteration
        this.storeTaskPromptVersion(
          nextIterationNumber,
          result.refined_task_prompt,
          'ai',
          {
            f1_score: iteration.f1_score ?? 0,
            precision: iteration.precision ?? 0,
            recall: iteration.recall ?? 0,
            accuracy: iteration.accuracy ?? 0,
            cohens_kappa: iteration.cohens_kappa ?? 0,
            confusion_matrix: {
              true_positives: iteration.true_positives ?? 0,
              true_negatives: iteration.true_negatives ?? 0,
              false_positives: iteration.false_positives ?? 0,
              false_negatives: iteration.false_negatives ?? 0,
            },
          },
          result.task_rationale
        );

        logger.info('Refined task prompt', {
          iterationNumber: nextIterationNumber,
          rationale: result.task_rationale,
        });
      } else {
        // Keep current task prompt if refinement failed
        this.storeTaskPromptVersion(nextIterationNumber, persona.task_prompt, 'ai', {
          f1_score: iteration.f1_score ?? 0,
          precision: iteration.precision ?? 0,
          recall: iteration.recall ?? 0,
          accuracy: iteration.accuracy ?? 0,
          cohens_kappa: iteration.cohens_kappa ?? 0,
          confusion_matrix: {
            true_positives: iteration.true_positives ?? 0,
            true_negatives: iteration.true_negatives ?? 0,
            false_positives: iteration.false_positives ?? 0,
            false_negatives: iteration.false_negatives ?? 0,
          },
        });
      }

      if (result.refined_judge_prompt) {
        // Store the refined judge prompt for the NEXT iteration
        this.storeJudgePromptVersion(
          nextIterationNumber,
          result.refined_judge_prompt,
          'ai',
          {
            f1_score: iteration.f1_score ?? 0,
            precision: iteration.precision ?? 0,
            recall: iteration.recall ?? 0,
            accuracy: iteration.accuracy ?? 0,
            cohens_kappa: iteration.cohens_kappa ?? 0,
            confusion_matrix: {
              true_positives: iteration.true_positives ?? 0,
              true_negatives: iteration.true_negatives ?? 0,
              false_positives: iteration.false_positives ?? 0,
              false_negatives: iteration.false_negatives ?? 0,
            },
          },
          result.judge_rationale
        );

        logger.info('Refined judge prompt', {
          iterationNumber: nextIterationNumber,
          rationale: result.judge_rationale,
        });
      } else {
        logger.warn('Judge prompt refinement returned no improved prompt, keeping current prompt', {
          iterationNumber: nextIterationNumber,
        });
      }

      if (result.refined_task_prompt || result.refined_judge_prompt) {
        logger.info('Prompt refinement expected impact', {
          expectedImpact: result.expected_impact || 'N/A',
          iterationNumber: nextIterationNumber,
        });
      }
    } catch (error) {
      logger.error('Failed to refine prompts using LLM', error as Error, {
        personaId: this.personaId,
        iterationId,
      });
      // Fallback: store current prompts for next iteration with note about failure
      const nextIterationNumber = iteration.iteration_number + 1;
      const fallbackJudgePrompt = `${iteration.judge_prompt_text}\n\n[Note: Automatic refinement after iteration ${iteration.iteration_number} failed - manual review recommended. F1: ${iteration.f1_score?.toFixed(3) || 'N/A'}]`;
      this.storeJudgePromptVersion(nextIterationNumber, fallbackJudgePrompt, 'ai', {
        f1_score: iteration.f1_score ?? 0,
        precision: iteration.precision ?? 0,
        recall: iteration.recall ?? 0,
        accuracy: iteration.accuracy ?? 0,
        cohens_kappa: iteration.cohens_kappa ?? 0,
        confusion_matrix: {
          true_positives: iteration.true_positives ?? 0,
          true_negatives: iteration.true_negatives ?? 0,
          false_positives: iteration.false_positives ?? 0,
          false_negatives: iteration.false_negatives ?? 0,
        },
      });
      this.storeTaskPromptVersion(nextIterationNumber, persona.task_prompt, 'ai', {
        f1_score: iteration.f1_score ?? 0,
        precision: iteration.precision ?? 0,
        recall: iteration.recall ?? 0,
        accuracy: iteration.accuracy ?? 0,
        cohens_kappa: iteration.cohens_kappa ?? 0,
        confusion_matrix: {
          true_positives: iteration.true_positives ?? 0,
          true_negatives: iteration.true_negatives ?? 0,
          false_positives: iteration.false_positives ?? 0,
          false_negatives: iteration.false_negatives ?? 0,
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
   * @param rationale - Optional improvement rationale from prompt refinement
   */
  private storeTaskPromptVersion(
    iterationNumber: number,
    promptText: string,
    createdBy: 'human' | 'ai',
    metrics: MetricsResult,
    rationale?: string
  ): void {
    // Check if a version already exists for this iteration
    const existing = this.db
      .prepare('SELECT id FROM task_prompt_versions WHERE persona_id = ? AND iteration_number = ?')
      .get(this.personaId, iterationNumber);

    if (existing) {
      // Don't create duplicate versions
      return;
    }

    // Combine rationale with metrics summary
    const metricsSummary = `F1 Score: ${metrics.f1_score.toFixed(3)}, Precision: ${metrics.precision.toFixed(3)}, Recall: ${metrics.recall.toFixed(3)}`;
    const improvementRationale = rationale ? `${rationale} (${metricsSummary})` : metricsSummary;

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
        improvementRationale,
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
   * @param rationale - Optional improvement rationale from prompt refinement
   */
  private storeJudgePromptVersion(
    iterationNumber: number,
    promptText: string,
    createdBy: 'human' | 'ai',
    metrics: MetricsResult,
    rationale?: string
  ): void {
    // Check if a version already exists for this iteration
    const existing = this.db
      .prepare('SELECT id FROM judge_prompt_versions WHERE persona_id = ? AND iteration_number = ?')
      .get(this.personaId, iterationNumber);

    if (existing) {
      // Don't create duplicate versions
      return;
    }

    // Combine rationale with metrics summary
    const metricsSummary = `F1 Score: ${metrics.f1_score.toFixed(3)}, Precision: ${metrics.precision.toFixed(3)}, Recall: ${metrics.recall.toFixed(3)}`;
    const improvementRationale = rationale ? `${rationale} (${metricsSummary})` : metricsSummary;

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
        improvementRationale,
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
      .get(this.sessionId) as TrainingLoopState | undefined;

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

  /**
   * Handle iteration 1 human review completion and continue training.
   * This method is called after human has provided all Agree/Disagree feedback.
   * It calculates metrics from human votes, refines both prompts using LLM,
   * and continues to iteration 2.
   *
   * @param iterationId - The iteration 1 ID
   * @returns Promise resolving when prompts are refined and iteration 2 starts
   */
  async acceptPromptsAndContinue(iterationId: string): Promise<void> {
    // Verify this is iteration 1
    const iteration = this.db
      .prepare('SELECT * FROM training_iterations WHERE id = ?')
      .get(iterationId) as TrainingIteration | undefined;

    if (!iteration) {
      throw new TrainingStateError(`Iteration not found: ${iterationId}`);
    }

    if (iteration.iteration_number !== 1) {
      throw new TrainingStateError(
        `This method is only for iteration 1, got iteration ${iteration.iteration_number}`
      );
    }

    // Verify all decisions have human reviews
    const decisionsWithoutReview = this.db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM judge_decisions jd
        LEFT JOIN human_reviews hr ON hr.judge_decision_id = jd.id
        WHERE jd.iteration_id = ? AND hr.id IS NULL
      `
      )
      .get(iterationId) as { count: number };

    if (decisionsWithoutReview.count > 0) {
      throw new TrainingStateError(
        `Cannot proceed: ${decisionsWithoutReview.count} judge decisions have not been reviewed. All decisions must be reviewed before calculating metrics.`
      );
    }

    // Calculate metrics from human reviews
    const { metrics } = this.calculateMetricsFromHumanReviews(iterationId);

    // Store metrics to database
    const { calculateIterationMetrics } = await import('@lib/evaluation/metrics-orchestrator');
    calculateIterationMetrics(iterationId, this.db);

    // Update iteration status to completed
    this.db
      .prepare('UPDATE training_iterations SET status = ?, completed_at = ? WHERE id = ?')
      .run('completed', new Date().toISOString(), iterationId);

    // Refine both prompts based on human feedback
    await this.refinePromptsBasedOnHumanFeedback(iterationId);

    // Update training loop state to continue to iteration 2 BEFORE calling execute()
    // This ensures the status is updated even if execute() fails
    this.db
      .prepare('UPDATE training_loop_state SET status = ?, updated_at = ? WHERE session_id = ?')
      .run('in_progress', new Date().toISOString(), this.sessionId);

    // Update persona status
    this.db
      .prepare('UPDATE personas SET status = ?, updated_at = ? WHERE id = ?')
      .run('training', new Date().toISOString(), this.personaId);

    logger.info('Iteration 1 human review complete. Starting iteration 2...', {
      personaId: this.personaId,
      f1Score: metrics.f1_score,
    });

    // Get persona to check max_iterations
    const persona = this.db
      .prepare('SELECT max_iterations FROM personas WHERE id = ?')
      .get(this.personaId) as { max_iterations: number } | undefined;

    logger.info('Continuing training with iterations 2+', {
      personaId: this.personaId,
      maxIterations: persona?.max_iterations,
    });

    // Continue with iterations 2+
    // This will run synchronously and block until all iterations complete or stop condition is met
    await this.execute([]);

    // Log final state after execute completes
    const finalState = this.db
      .prepare('SELECT status FROM training_loop_state WHERE session_id = ?')
      .get(this.sessionId) as { status: string } | undefined;
    logger.info('Training loop completed', {
      sessionId: this.sessionId,
      finalState: finalState?.status,
    });
  }

  /**
   * Calculate metrics from human reviews for iteration 1.
   * Compares human's Agree/Disagree votes against the judge's original decisions.
   *
   * @param iterationId - The iteration ID
   * @returns Calculated metrics from human votes
   */
  private calculateMetricsFromHumanReviews(iterationId: string): { metrics: MetricsResult } {
    // Fetch all judge decisions with human reviews
    const decisions = this.db
      .prepare(
        `
        SELECT
          jd.judge_decision,
          hr.human_decision
        FROM judge_decisions jd
        JOIN human_reviews hr ON hr.judge_decision_id = jd.id
        WHERE jd.iteration_id = ?
      `
      )
      .all(iterationId) as Array<{
      judge_decision: 'agree' | 'disagree';
      human_decision: 'agree' | 'disagree';
    }>;

    if (decisions.length === 0) {
      throw new TrainingStateError(`No human reviews found for iteration: ${iterationId}`);
    }

    // Build confusion matrix from human votes
    // TP = human agrees with correct decision (judge said agree, human said agree)
    // TN = human agrees with incorrect decision (judge said disagree, human said disagree)
    // FP = human disagrees with correct decision (judge said agree, human said disagree)
    // FN = human disagrees with incorrect decision (judge said disagree, human said agree)
    const judgeAgreements: boolean[] = [];
    const humanAgreements: boolean[] = [];

    for (const decision of decisions) {
      judgeAgreements.push(decision.judge_decision === 'agree');
      humanAgreements.push(decision.human_decision === 'agree');
    }

    // Build confusion matrix
    const confusionMatrix = buildConfusionMatrix(judgeAgreements, humanAgreements);

    // Calculate metrics
    const metrics = calculateMetrics(confusionMatrix);

    return { metrics };
  }

  /**
   * Refine both Task and Judge prompts based on human feedback from iteration 1.
   * Uses LLM (Prompt Engineer Model) to analyze human feedback patterns and
   * generate improved versions of both prompts.
   *
   * @param iterationId - The iteration 1 ID
   * @returns Promise resolving when both prompts are refined
   */
  private async refinePromptsBasedOnHumanFeedback(iterationId: string): Promise<void> {
    // Get persona details
    const persona = this.db.prepare('SELECT * FROM personas WHERE id = ?').get(this.personaId) as
      | Persona
      | undefined;

    if (!persona) {
      return;
    }

    // Get iteration data
    const iteration = this.db
      .prepare('SELECT * FROM training_iterations WHERE id = ?')
      .get(iterationId) as TrainingIteration | undefined;

    if (!iteration) {
      return;
    }

    // Fetch human reviews with judge decisions and training pairs
    const reviews = this.db
      .prepare(
        `
        SELECT
          jd.judge_decision,
          jd.generated_output,
          jd.judge_reasoning,
          hr.human_decision,
          hr.human_notes,
          tp.input,
          tp.expected_output
        FROM judge_decisions jd
        JOIN human_reviews hr ON hr.judge_decision_id = jd.id
        JOIN training_pairs tp ON tp.id = jd.training_pair_id
        WHERE jd.iteration_id = ?
      `
      )
      .all(iterationId) as Array<{
      judge_decision: 'agree' | 'disagree';
      generated_output: string;
      judge_reasoning: string;
      human_decision: 'agree' | 'disagree';
      human_notes: string | null;
      input: string;
      expected_output: string;
    }>;

    // Separate cases where human disagreed with judge (for improvement)
    const humanDisagreements: Array<{
      judge_decision: 'agree' | 'disagree';
      human_decision: 'agree' | 'disagree';
      generated_output: string;
      expected_output: string;
      judge_reasoning: string;
      human_feedback: string;
      input: string;
    }> = [];

    // @TODO: We should analyze agreements too for calibration, but for MVP focus on disagreements.
    for (const review of reviews) {
      if (review.human_decision !== review.judge_decision) {
        // Human disagreed with judge - this is feedback for improvement
        humanDisagreements.push({
          judge_decision: review.judge_decision,
          human_decision: review.human_decision,
          generated_output: review.generated_output,
          expected_output: review.expected_output,
          judge_reasoning: review.judge_reasoning,
          human_feedback: review.human_notes || 'No notes provided',
          input: review.input,
        });
      }
    }

    // Get metrics for this iteration
    const metricsRow = this.db
      .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
      .get(iterationId) as
      | {
          f1_score: number | null;
          precision: number | null;
          recall: number | null;
          cohens_kappa: number | null;
          accuracy: number | null;
          true_positives: number | null;
          true_negatives: number | null;
          false_positives: number | null;
          false_negatives: number | null;
        }
      | undefined;

    const metrics = {
      f1_score: metricsRow?.f1_score ?? 0,
      precision: metricsRow?.precision ?? 0,
      recall: metricsRow?.recall ?? 0,
      cohens_kappa: metricsRow?.cohens_kappa ?? 0,
      accuracy: metricsRow?.accuracy ?? 0,
      confusion_matrix: {
        true_positives: metricsRow?.true_positives ?? 0,
        true_negatives: metricsRow?.true_negatives ?? 0,
        false_positives: metricsRow?.false_positives ?? 0,
        false_negatives: metricsRow?.false_negatives ?? 0,
      },
    };

    try {
      // Call the Prompt Engineer LLM to refine BOTH prompts
      const { refineBothPromptsFromHumanFeedback } = await import('./prompt-engineer');

      const result = await refineBothPromptsFromHumanFeedback(
        {
          current_task_prompt: persona.task_prompt,
          current_judge_prompt: iteration.judge_prompt_text,
          human_disagreements: humanDisagreements,
          metrics,
          iteration_number: 1,
          total_decisions: reviews.length,
          disagreements_count: humanDisagreements.length,
        },
        persona.prompt_engineer_model_id
      );

      logger.info('Prompt refinement from human feedback result', {
        personaId: this.personaId,
        iterationId,
        refinedTaskPromptExists: !!result.refined_task_prompt,
        refinedJudgePromptExists: !!result.refined_judge_prompt,
      });

      if (result.refined_task_prompt) {
        // Store refined task prompt for iteration 2
        this.storeTaskPromptVersion(2, result.refined_task_prompt, 'ai', metrics, result.task_rationale);
        logger.info('Refined task prompt for iteration 2', {
          personaId: this.personaId,
          rationale: result.task_rationale,
        });
      }

      if (result.refined_judge_prompt) {
        // Store refined judge prompt for iteration 2
        this.storeJudgePromptVersion(2, result.refined_judge_prompt, 'ai', metrics, result.judge_rationale);
        logger.info('Refined judge prompt for iteration 2', {
          personaId: this.personaId,
          rationale: result.judge_rationale,
        });
      }
    } catch (error) {
      logger.error('Failed to refine prompts based on human feedback', error as Error, {
        personaId: this.personaId,
        iterationId,
      });
      // Fallback: keep current prompts for iteration 2
      this.storeTaskPromptVersion(2, persona.task_prompt, 'ai', metrics);
      this.storeJudgePromptVersion(2, iteration.judge_prompt_text, 'ai', metrics);
    }
  }
}
