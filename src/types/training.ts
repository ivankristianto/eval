/**
 * TypeScript types for LLM-as-Judge training system
 * Corresponds to database schema in db/migrations/001-add-judge-training-tables.sql
 */

/**
 * Persona status lifecycle
 */
export type PersonaStatus = 'draft' | 'training' | 'trained' | 'incomplete';

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
  task_prompt: string;
  task_model_id: string;
  judge_model_id: string;
  prompt_engineer_model_id: string;
  status: PersonaStatus;
  target_f1_score: number;
  max_iterations: number;
  current_iteration: number;
  best_f1_score: number | null;
  best_f1_iteration: number | null;
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
  task_prompt: string;
  initial_judge_prompt: string;
  task_model_id: string;
  judge_model_id: string;
  prompt_engineer_model_id: string;
  target_f1_score?: number;
  max_iterations?: number;
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
  iteration_number: number;
  prompt_text: string;
  improvement_rationale: string | null;
  created_by: PromptSource;
  created_at: string;
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
