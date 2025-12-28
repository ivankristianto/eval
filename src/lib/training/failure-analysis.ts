/**
 * Failure Analysis Module
 * Analyzes iteration failures to identify patterns for prompt refinement
 */

import type { Database } from 'better-sqlite3';
import type { MetricsResult } from '@src-types/training';

/**
 * Example of a model output that the judge incorrectly agreed with (False Positive).
 */
export interface FailureExample {
  model_output: string;
  expected_output: string;
  why_it_should_have_disagreed: string;
}

/**
 * Example of a model output that the judge incorrectly disagreed with (False Negative).
 */
export interface FalseNegativeExample {
  model_output: string;
  expected_output: string;
  why_it_should_have_agreed: string;
}

/**
 * Example of a model output that the judge correctly classified.
 */
export interface CorrectExample {
  model_output: string;
  expected_output: string;
  decision: 'agree' | 'disagree';
  reasoning: string;
}

/**
 * Contextual data required for prompt refinement analysis.
 */
export interface FailureAnalysisContext {
  current_metrics: MetricsResult;
  iteration_number: number;
  false_positives: FailureExample[];
  false_negatives: FalseNegativeExample[];
  correct_examples: CorrectExample[];
  current_prompt: string;
  task_description: string;
  evaluation_criteria: string[];
}

/**
 * Analyze iteration failures to extract patterns for prompt refinement
 *
 * @param iterationId - ID of the training iteration
 * @param db - Database connection
 * @returns FailureAnalysisContext with examples and metrics
 * @throws Error if iteration not found
 */
export async function analyzeIterationFailures(
  iterationId: string,
  db: Database
): Promise<FailureAnalysisContext> {
  // Fetch iteration details
  const iteration = db
    .prepare('SELECT * FROM training_iterations WHERE id = ?')
    .get(iterationId) as any;

  if (!iteration) {
    throw new Error(`Iteration not found: ${iterationId}`);
  }

  // Fetch persona details
  const persona = db
    .prepare('SELECT * FROM personas WHERE id = ?')
    .get(iteration.persona_id) as any;

  if (!persona) {
    throw new Error(`Persona not found: ${iteration.persona_id}`);
  }

  // Fetch metrics for iteration
  const metrics = db
    .prepare('SELECT * FROM iteration_metrics WHERE iteration_id = ?')
    .get(iterationId) as any;

  const currentMetrics: MetricsResult = metrics
    ? {
        precision: metrics.precision,
        recall: metrics.recall,
        f1_score: metrics.f1_score,
        cohens_kappa: metrics.cohens_kappa,
        accuracy: metrics.accuracy,
        confusion_matrix: {
          true_positives: metrics.true_positives,
          true_negatives: metrics.true_negatives,
          false_positives: metrics.false_positives,
          false_negatives: metrics.false_negatives,
        },
      }
    : {
        precision: 0,
        recall: 0,
        f1_score: 0,
        cohens_kappa: 0,
        accuracy: 0,
        confusion_matrix: {
          true_positives: 0,
          true_negatives: 0,
          false_positives: 0,
          false_negatives: 0,
        },
      };

  // Fetch all judge decisions with human reviews and training pairs
  const decisionsWithReviews = db
    .prepare(
      `
      SELECT
        jd.id as decision_id,
        jd.generated_output,
        jd.judge_decision,
        jd.judge_reasoning,
        hr.human_decision,
        hr.human_notes,
        tp.expected_output,
        tp.input
      FROM judge_decisions jd
      JOIN human_reviews hr ON hr.judge_decision_id = jd.id
      JOIN training_pairs tp ON tp.id = jd.training_pair_id
      WHERE jd.iteration_id = ?
    `
    )
    .all(iterationId) as any[];

  // Extract false positives (judge agreed, human disagreed)
  const falsePositives: FailureExample[] = decisionsWithReviews
    .filter((d) => d.judge_decision === 'agree' && d.human_decision === 'disagree')
    .slice(0, 5) // Limit to 5 for token efficiency
    .map((d) => ({
      model_output: d.generated_output,
      expected_output: d.expected_output,
      why_it_should_have_disagreed:
        d.human_notes || 'Human reviewer disagreed with judge assessment',
    }));

  // Extract false negatives (judge disagreed, human agreed)
  const falseNegatives: FalseNegativeExample[] = decisionsWithReviews
    .filter((d) => d.judge_decision === 'disagree' && d.human_decision === 'agree')
    .slice(0, 5) // Limit to 5 for token efficiency
    .map((d) => ({
      model_output: d.generated_output,
      expected_output: d.expected_output,
      why_it_should_have_agreed:
        d.human_notes || 'Human reviewer agreed despite judge disagreement',
    }));

  // Extract correct examples (judge and human both agreed)
  const correctExamples: CorrectExample[] = decisionsWithReviews
    .filter((d) => d.judge_decision === d.human_decision)
    .slice(0, 5) // Limit to 5 for few-shot learning
    .map((d) => ({
      model_output: d.generated_output,
      expected_output: d.expected_output,
      decision: d.judge_decision as 'agree' | 'disagree',
      reasoning: d.judge_reasoning || 'Correct classification',
    }));

  return {
    current_metrics: currentMetrics,
    iteration_number: iteration.iteration_number,
    false_positives: falsePositives,
    false_negatives: falseNegatives,
    correct_examples: correctExamples,
    current_prompt: iteration.judge_prompt_text,
    task_description: persona.description || persona.name,
    evaluation_criteria: [], // Will be extracted from task_prompt in future enhancement
  };
}
