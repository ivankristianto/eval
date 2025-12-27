-- Migration: 001-add-judge-training-tables
-- Date: 2025-12-26
-- Description: Add support for LLM-as-Judge training system
-- Tables: personas, training_pairs, training_iterations, judge_decisions, human_reviews,
--         iteration_metrics, judge_prompt_versions, training_loop_state, training_loop_checkpoints

-- 1. Persona table
-- Represents a trained (or in-training) judge configuration for evaluating specific tasks
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  task_prompt TEXT NOT NULL,
  task_model_id TEXT NOT NULL,
  judge_model_id TEXT NOT NULL,
  prompt_engineer_model_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'training', 'trained', 'incomplete')),
  target_f1_score REAL NOT NULL DEFAULT 0.80 CHECK(target_f1_score >= 0.0 AND target_f1_score <= 1.0),
  max_iterations INTEGER NOT NULL DEFAULT 5 CHECK(max_iterations >= 1),
  current_iteration INTEGER DEFAULT 0,
  best_f1_score REAL DEFAULT NULL,
  best_f1_iteration INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  CHECK (task_model_id != '' AND judge_model_id != '' AND prompt_engineer_model_id != ''),
  FOREIGN KEY (task_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT,
  FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT,
  FOREIGN KEY (prompt_engineer_model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT
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
  status TEXT NOT NULL CHECK(status IN ('in_progress', 'paused', 'completed', 'failed')),
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
  judge_confidence REAL CHECK(judge_confidence >= 0.0 AND judge_confidence <= 1.0),
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
  human_confidence REAL CHECK(human_confidence >= 0.0 AND human_confidence <= 1.0),
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
  iteration_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  improvement_rationale TEXT,
  created_by TEXT NOT NULL CHECK(created_by IN ('human', 'ai')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  UNIQUE(persona_id, iteration_number)
);

CREATE INDEX IF NOT EXISTS idx_judge_prompt_versions_persona ON judge_prompt_versions(persona_id, iteration_number DESC);

-- 8. TrainingLoopState table
-- Tracks overall training session state for pause/resume functionality
CREATE TABLE IF NOT EXISTS training_loop_state (
  session_id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  current_iteration INTEGER NOT NULL,
  total_iterations INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'paused', 'completed', 'failed')),
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

-- 9. TrainingLoopCheckpoint table
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
