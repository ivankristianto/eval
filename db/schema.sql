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
  run_count INTEGER NOT NULL DEFAULT 0
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
  FOREIGN KEY (evaluation_id) REFERENCES Evaluation(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_result_evaluation_id ON Result(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_result_model_id ON Result(model_id);
CREATE INDEX IF NOT EXISTS idx_result_created_at ON Result(created_at DESC);
