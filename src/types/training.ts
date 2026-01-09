/**
 * TypeScript types for LLM-as-Judge training system
 * Corresponds to database schema in db/schema.sql
 */

/**
 * Persona status lifecycle
 */
export type PersonaStatus =
  | 'draft'
  | 'training'
  | 'awaiting_human_review'
  | 'trained'
  | 'incomplete';

/**
 * Training iteration status
 */
export type IterationStatus = 'in_progress' | 'paused' | 'completed' | 'failed';

/**
 * Training loop session status
 */
export type SessionStatus = 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';

/**
 * Judge decision: agree or disagree with expected output
 */
export type JudgeDecisionType = 'agree' | 'disagree';

/**
 * Human review decision: agree or disagree with judge's assessment
 */
export type HumanDecisionType = 'agree' | 'disagree';

/**
 * Source of prompt version (human-created or AI-generated)
 */
export type PromptSource = 'human' | 'ai';

/**
 * Persona - trained judge configuration
 */
export interface Persona {
  id: string;
  name: string;
  description: string | null;
  task_model_id: string;
  judge_model_id: string;
  prompt_engineer_model_id: string;
  current_task_prompt_version_id: string | null;
  current_judge_prompt_version_id: string | null;
  status: PersonaStatus;
  target_pass_rate: number;
  best_pass_rate: number | null;
  best_pass_rate_updated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Input for creating a new persona
 */
export interface CreatePersonaInput {
  name: string;
  description?: string | null;
  initial_task_prompt: string;
  initial_judge_prompt: string;
  task_model_id: string;
  judge_model_id: string;
  prompt_engineer_model_id: string;
  target_pass_rate?: number;
  created_by?: string;
}

/**
 * Alias for persona creation input (used in validation)
 */
export type PersonaCreationInput = CreatePersonaInput;

/**
 * TrainingPair - individual input/expected_output pair
 */
export interface TrainingPair {
  id: string;
  persona_id: string;
  input: string;
  expected_output: string;
  created_at: string;
}

/**
 * Input for creating training pairs (from CSV upload)
 */
export interface CreateTrainingPairInput {
  input: string;
  expected_output: string;
}

/**
 * TrainingIteration - single training cycle
 */
export interface TrainingIteration {
  id: string;
  persona_id: string;
  iteration_number: number;
  judge_model_id: string;
  judge_prompt_text: string;
  status: IterationStatus;
  total_pairs_evaluated: number;
  pairs_reviewed_by_human: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

/**
 * JudgeDecision - judge model's assessment of output
 */
export interface JudgeDecision {
  id: string;
  iteration_id: string;
  training_pair_id: string;
  result_id: string | null;
  generated_output: string;
  judge_decision: JudgeDecisionType;
  judge_reasoning: string | null;
  created_at: string;
}

/**
 * HumanReview - human feedback on judge decision
 */
export interface HumanReview {
  id: string;
  judge_decision_id: string;
  human_decision: HumanDecisionType;
  human_notes: string | null;
  reviewer_id: string | null;
  created_at: string;
}

/**
 * Input for submitting human review feedback
 */
export interface CreateHumanReviewInput {
  judge_decision_id: string;
  human_decision: HumanDecisionType;
  human_notes?: string;
  reviewer_id?: string;
}

/**
 * ConfusionMatrix - 2x2 matrix for binary classification
 */
export interface ConfusionMatrix {
  true_positives: number; // Judge agreed, human agreed
  true_negatives: number; // Judge disagreed, human disagreed
  false_positives: number; // Judge agreed, human disagreed
  false_negatives: number; // Judge disagreed, human agreed
}

/**
 * IterationMetrics - calculated performance metrics
 */
export interface IterationMetrics {
  id: string;
  iteration_id: string;
  true_positives: number;
  true_negatives: number;
  false_positives: number;
  false_negatives: number;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  cohens_kappa: number | null;
  accuracy: number | null;
  calculated_at: string;
}

/**
 * Metrics calculation result (before persisting to database)
 */
export interface MetricsResult {
  precision: number;
  recall: number;
  f1_score: number;
  cohens_kappa: number;
  accuracy: number;
  confusion_matrix: ConfusionMatrix;
}

/**
 * JudgePromptVersion - history of prompt refinements
 */
export interface JudgePromptVersion {
  id: string;
  persona_id: string;
  version_number: number;
  prompt_text: string;
  improvement_rationale: string | null;
  label: string | null;
  created_by: PromptSource;
  created_at: string;
}

/**
 * TaskPromptVersion - history of task prompt refinements
 */
export interface TaskPromptVersion {
  id: string;
  persona_id: string;
  version_number: number;
  prompt_text: string;
  improvement_rationale: string | null;
  label: string | null;
  created_by: PromptSource;
  created_at: string;
}

// ============================================
// Training Workspace Redesign Types
// ============================================

/**
 * Evaluation run type
 */
export type EvaluationRunType = 'task_generate' | 'judge_evaluate' | 'full_evaluation';

/**
 * Evaluation run status
 */
export type EvaluationRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Snapshot type for persona metrics
 */
export type MetricsSnapshotType = 'iteration' | 'manual' | 'auto_checkpoint';

/**
 * EvaluationRun - tracks a single evaluation session
 */
export interface EvaluationRun {
  id: string;
  persona_id: string;
  run_type: EvaluationRunType;
  status: EvaluationRunStatus;
  total_pairs: number;
  processed_pairs: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  model_id: string;
  prompt_version_id: string;
}

/**
 * Judge rating for training pair result
 */
export type JudgeRating = 'pass' | 'fail';

/**
 * Human rating for training pair result
 */
export type HumanRating = 'pass' | 'fail';

/**
 * TrainingPairResult - evaluation result for a training pair
 */
export interface TrainingPairResult {
  id: string;
  persona_id: string;
  evaluation_run_id: string | null;
  training_pair_id: string;
  generated_output: string | null;
  judge_rating: JudgeRating | null;
  judge_feedback: string | null;
  judge_reasoning: string | null;
  human_rating: HumanRating | null;
  human_feedback: string | null;
  execution_time_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * PersonaMetrics - aggregated metrics snapshot
 */
export interface PersonaMetrics {
  id: string;
  persona_id: string;
  evaluation_run_id: string | null;
  snapshot_type: MetricsSnapshotType;
  total_pairs: number;
  judge_pass_count: number;
  judge_fail_count: number;
  human_pass_count: number;
  human_fail_count: number;
  f1_score: number | null;
  precision: number | null;
  recall: number | null;
  cohens_kappa: number | null;
  accuracy: number | null;
  confusion_matrix: string | null; // JSON serialized
  calculated_at: string;
}

/**
 * TrainingLoopState - session tracking for pause/resume
 */
export interface TrainingLoopState {
  session_id: string;
  persona_id: string;
  current_iteration: number;
  total_iterations: number;
  status: SessionStatus;
  task_results_evaluated: number;
  judge_model_id: string;
  prompt_engineer_model_id: string;
  task_model_id: string;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  pause_reason: string | null;
}

/**
 * Checkpoint snapshot (stored as JSON in database)
 */
export interface CheckpointSnapshot {
  metrics: MetricsResult;
  evaluated_result_ids: string[];
}

/**
 * TrainingLoopCheckpoint - state snapshot for crash recovery
 */
export interface TrainingLoopCheckpoint {
  id: string;
  session_id: string;
  iteration_number: number;
  evaluated_result_count: number;
  metrics_snapshot: string; // JSON-serialized CheckpointSnapshot
  evaluated_result_ids: string; // JSON array
  current_prompt: string;
  created_at: string;
}

/**
 * Failure analysis context for prompt refinement
 */
export interface FailureExample {
  model_output: string;
  expected_output: string;
  reason: string;
}

export interface CorrectExample {
  model_output: string;
  expected_output: string;
  decision: JudgeDecisionType;
  reasoning: string;
}

export interface FailureAnalysisContext {
  current_metrics: MetricsResult;
  iteration_number: number;
  false_positives: FailureExample[];
  false_negatives: FailureExample[];
  correct_examples: CorrectExample[];
  current_prompt: string;
  task_description: string;
  evaluation_criteria: string[];
}

/**
 * Failure case for automatic prompt refinement
 * Used when iterating on judge prompts based on ground truth comparison
 */
export type FailureCaseType = 'false_positive' | 'false_negative';

export interface FailureCase {
  type: FailureCaseType;
  input: string;
  generated_output: string;
  expected_output: string;
  judge_reasoning: string;
}

/**
 * Prompt refinement result from LLM
 */
export interface PromptRefinementResult {
  improved_prompt: string | null;
  rationale: string;
  expected_impact: string;
}

/**
 * Validation result for model separation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  models?: {
    task: { id: string; provider: string };
    judge: { id: string; provider: string };
    promptEngineer: { id: string; provider: string };
  };
}

/**
 * Checkpoint data for training session resume
 */
export interface CheckpointData {
  iterationNumber: number;
  evaluatedResultCount: number;
  metricsSnapshot: MetricsResult;
  evaluatedResultIds: string[];
  currentPrompt: string;
}
