-- AI Model Evaluation Framework - SQLite Schema
-- Version: 1.0.0

-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- ModelConfiguration table
CREATE TABLE IF NOT EXISTS ModelConfiguration (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  model_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_model_provider_active ON ModelConfiguration(provider, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_provider_name ON ModelConfiguration(provider, model_name);

-- EvaluationTemplate table (must come before Evaluation due to foreign key)
CREATE TABLE IF NOT EXISTS EvaluationTemplate (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instruction_text TEXT NOT NULL,
  model_ids TEXT NOT NULL,  -- JSON array
  accuracy_rubric TEXT NOT NULL CHECK (accuracy_rubric IN ('exact_match', 'partial_credit', 'semantic_similarity')),
  partial_credit_concepts TEXT,  -- JSON array
  expected_output TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  run_count INTEGER NOT NULL DEFAULT 0,
  system_prompt TEXT,
  temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0)
);

CREATE INDEX IF NOT EXISTS idx_template_created_at ON EvaluationTemplate(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_name ON EvaluationTemplate(name);

-- Evaluation table
CREATE TABLE IF NOT EXISTS Evaluation (
  id TEXT PRIMARY KEY,
  instruction_text TEXT NOT NULL,
  accuracy_rubric TEXT NOT NULL CHECK (accuracy_rubric IN ('exact_match', 'partial_credit', 'semantic_similarity')),
  partial_credit_concepts TEXT,  -- JSON array
  expected_output TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  template_id TEXT,
  system_prompt TEXT,
  temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0),
  FOREIGN KEY (template_id) REFERENCES EvaluationTemplate(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_created_at ON Evaluation(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_status ON Evaluation(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_template_id ON Evaluation(template_id);

-- Result table
CREATE TABLE IF NOT EXISTS Result (
  id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  response_text TEXT,
  execution_time_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  accuracy_score INTEGER CHECK (accuracy_score >= 0 AND accuracy_score <= 100),
  accuracy_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  system_prompt_used TEXT,
  temperature_used REAL,
  FOREIGN KEY (evaluation_id) REFERENCES Evaluation(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_result_evaluation_id ON Result(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_result_model_id ON Result(model_id);
CREATE INDEX IF NOT EXISTS idx_result_created_at ON Result(created_at DESC);

-- ============================================
-- LLM-as-Judge Training System Tables
-- ============================================

-- 1. Persona table
-- Represents a trained (or in-training) judge configuration for evaluating specific tasks
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  task_model_id TEXT NOT NULL,
  judge_model_id TEXT NOT NULL,
  prompt_engineer_model_id TEXT NOT NULL,
  current_task_prompt_version_id TEXT,
  current_judge_prompt_version_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft', 'training', 'awaiting_human_review', 'trained', 'incomplete')),
  target_f1_score REAL NOT NULL DEFAULT 0.80 CHECK(target_f1_score >= 0.0 AND target_f1_score <= 1.0),
  best_f1_score REAL DEFAULT NULL,
  best_f1_score_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  CHECK (task_model_id != '' AND judge_model_id != '' AND prompt_engineer_model_id != ''),
  FOREIGN KEY (task_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT,
  FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT,
  FOREIGN KEY (prompt_engineer_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT,
  FOREIGN KEY (current_task_prompt_version_id) REFERENCES task_prompt_versions(id) ON DELETE SET NULL,
  FOREIGN KEY (current_judge_prompt_version_id) REFERENCES judge_prompt_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_personas_status ON personas(status);
CREATE INDEX IF NOT EXISTS idx_personas_judge_model ON personas(judge_model_id);

-- 2. TrainingPair table
-- Individual input/expected_output pairs used for training the judge
CREATE TABLE IF NOT EXISTS training_pairs (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_pairs_persona ON training_pairs(persona_id);

-- 3. TrainingIteration table
-- Records each iteration cycle (generate → judge → feedback → metrics)
CREATE TABLE IF NOT EXISTS training_iterations (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  iteration_number INTEGER NOT NULL,
  judge_model_id TEXT NOT NULL,
  judge_prompt_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('in_progress', 'paused', 'completed', 'failed', 'awaiting_human_review')),
  total_pairs_evaluated INTEGER NOT NULL DEFAULT 0,
  pairs_reviewed_by_human INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error_message TEXT,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT,
  UNIQUE(persona_id, iteration_number)
);

CREATE INDEX IF NOT EXISTS idx_training_iterations_persona ON training_iterations(persona_id, iteration_number DESC);
CREATE INDEX IF NOT EXISTS idx_training_iterations_status ON training_iterations(status);

-- 4. JudgeDecision table
-- Judge model's decision for each training pair
CREATE TABLE IF NOT EXISTS judge_decisions (
  id TEXT PRIMARY KEY,
  iteration_id TEXT NOT NULL,
  training_pair_id TEXT NOT NULL,
  result_id TEXT,
  generated_output TEXT NOT NULL,
  judge_decision TEXT NOT NULL CHECK(judge_decision IN ('agree', 'disagree')),
  judge_reasoning TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (iteration_id) REFERENCES training_iterations(id) ON DELETE CASCADE,
  FOREIGN KEY (training_pair_id) REFERENCES training_pairs(id) ON DELETE CASCADE,
  FOREIGN KEY (result_id) REFERENCES Result(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_judge_decisions_iteration ON judge_decisions(iteration_id);
CREATE INDEX IF NOT EXISTS idx_judge_decisions_pair ON judge_decisions(training_pair_id);

-- 5. HumanReview table
-- Human reviewer's feedback on judge decisions
CREATE TABLE IF NOT EXISTS human_reviews (
  id TEXT PRIMARY KEY,
  judge_decision_id TEXT NOT NULL UNIQUE,
  human_decision TEXT NOT NULL CHECK(human_decision IN ('agree', 'disagree')),
  human_notes TEXT,
  reviewer_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (judge_decision_id) REFERENCES judge_decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_human_reviews_decision ON human_reviews(judge_decision_id);
CREATE INDEX IF NOT EXISTS idx_human_reviews_reviewer ON human_reviews(reviewer_id);

-- 6. IterationMetrics table
-- Calculated metrics for each iteration (confusion matrix, F1, Cohen's Kappa)
CREATE TABLE IF NOT EXISTS iteration_metrics (
  id TEXT PRIMARY KEY,
  iteration_id TEXT NOT NULL UNIQUE,
  true_positives INTEGER NOT NULL DEFAULT 0,
  true_negatives INTEGER NOT NULL DEFAULT 0,
  false_positives INTEGER NOT NULL DEFAULT 0,
  false_negatives INTEGER NOT NULL DEFAULT 0,
  precision REAL,
  recall REAL,
  f1_score REAL,
  cohens_kappa REAL,
  accuracy REAL,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (iteration_id) REFERENCES training_iterations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_iteration_metrics_f1 ON iteration_metrics(f1_score DESC);
CREATE INDEX IF NOT EXISTS idx_iteration_metrics_kappa ON iteration_metrics(cohens_kappa DESC);

-- 7. JudgePromptVersion table
-- History of judge prompt refinements
CREATE TABLE IF NOT EXISTS judge_prompt_versions (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  improvement_rationale TEXT,
  label TEXT,  -- Optional display name (e.g., "v3 - Added explicit criteria")
  created_by TEXT NOT NULL CHECK(created_by IN ('human', 'ai')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_judge_prompt_versions_persona_version ON judge_prompt_versions(persona_id, version_number);
CREATE INDEX IF NOT EXISTS idx_judge_prompt_versions_persona ON judge_prompt_versions(persona_id, version_number DESC);

-- 8. TaskPromptVersion table
-- History of task prompt refinements during training
CREATE TABLE IF NOT EXISTS task_prompt_versions (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  improvement_rationale TEXT,
  label TEXT,  -- Optional display name (e.g., "v3 - Better examples")
  created_by TEXT NOT NULL CHECK(created_by IN ('human', 'ai')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_prompt_versions_persona_version ON task_prompt_versions(persona_id, version_number);
CREATE INDEX IF NOT EXISTS idx_task_prompt_versions_persona ON task_prompt_versions(persona_id, version_number DESC);

-- 9. TrainingLoopState table
-- Tracks overall training session state for pause/resume functionality
CREATE TABLE IF NOT EXISTS training_loop_state (
  session_id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  current_iteration INTEGER NOT NULL,
  total_iterations INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'paused', 'completed', 'failed', 'awaiting_human_review')),
  task_results_evaluated INTEGER NOT NULL DEFAULT 0,
  judge_model_id TEXT NOT NULL,
  prompt_engineer_model_id TEXT NOT NULL,
  task_model_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  pause_reason TEXT,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id),
  FOREIGN KEY (prompt_engineer_model_id) REFERENCES ModelConfiguration(id),
  FOREIGN KEY (task_model_id) REFERENCES ModelConfiguration(id)
);

CREATE INDEX IF NOT EXISTS idx_training_loop_state_status ON training_loop_state(status);
CREATE INDEX IF NOT EXISTS idx_training_loop_state_persona ON training_loop_state(persona_id);

-- 10. TrainingLoopCheckpoint table
-- Snapshots of training state for crash recovery
CREATE TABLE IF NOT EXISTS training_loop_checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  iteration_number INTEGER NOT NULL,
  evaluated_result_count INTEGER NOT NULL,
  metrics_snapshot TEXT NOT NULL,  -- JSON-serialized MetricsResult
  evaluated_result_ids TEXT NOT NULL,  -- JSON array of result IDs
  current_prompt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES training_loop_state(session_id) ON DELETE CASCADE,
  UNIQUE(session_id, iteration_number)
);

CREATE INDEX IF NOT EXISTS idx_training_loop_checkpoints_session ON training_loop_checkpoints(session_id, iteration_number DESC);

-- ============================================
-- Training Workspace Redesign Tables
-- ============================================

-- 11. evaluation_runs table
-- Tracks a single evaluation session (e.g., "Generate outputs for all pairs")
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  run_type TEXT NOT NULL CHECK(run_type IN ('task_generate', 'judge_evaluate', 'full_evaluation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_pairs INTEGER NOT NULL DEFAULT 0,
  processed_pairs INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_id TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_persona ON evaluation_runs(persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_status ON evaluation_runs(status);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_type ON evaluation_runs(run_type);

-- 12. training_pair_results table
-- Stores evaluation results for each training pair
CREATE TABLE IF NOT EXISTS training_pair_results (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  evaluation_run_id TEXT,
  training_pair_id TEXT NOT NULL,
  generated_output TEXT,
  judge_rating TEXT CHECK(judge_rating IN ('pass', 'fail')),
  judge_feedback TEXT,
  judge_reasoning TEXT,
  human_rating TEXT CHECK(human_rating IN ('pass', 'fail')),
  human_feedback TEXT,
  execution_time_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluation_run_id) REFERENCES evaluation_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (training_pair_id) REFERENCES training_pairs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_pair_results_persona ON training_pair_results(persona_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_pair_results_run ON training_pair_results(evaluation_run_id);
CREATE INDEX IF NOT EXISTS idx_training_pair_results_pair ON training_pair_results(training_pair_id);
CREATE INDEX IF NOT EXISTS idx_training_pair_results_judge_rating ON training_pair_results(judge_rating);
CREATE INDEX IF NOT EXISTS idx_training_pair_results_human_rating ON training_pair_results(human_rating);

-- 13. persona_metrics table
-- Aggregated metrics snapshots for a persona at a point in time
CREATE TABLE IF NOT EXISTS persona_metrics (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  evaluation_run_id TEXT,
  snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('iteration', 'manual', 'auto_checkpoint')),
  total_pairs INTEGER NOT NULL DEFAULT 0,
  judge_pass_count INTEGER NOT NULL DEFAULT 0,
  judge_fail_count INTEGER NOT NULL DEFAULT 0,
  human_pass_count INTEGER NOT NULL DEFAULT 0,
  human_fail_count INTEGER NOT NULL DEFAULT 0,
  f1_score REAL,
  precision REAL,
  recall REAL,
  cohens_kappa REAL,
  accuracy REAL,
  confusion_matrix TEXT,  -- JSON: {true_positives, true_negatives, false_positives, false_negatives}
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluation_run_id) REFERENCES evaluation_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_persona_metrics_persona ON persona_metrics(persona_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_persona_metrics_run ON persona_metrics(evaluation_run_id);
CREATE INDEX IF NOT EXISTS idx_persona_metrics_type ON persona_metrics(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_persona_metrics_f1 ON persona_metrics(f1_score DESC);

