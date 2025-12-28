-- Migration: 002-add-task-prompt-versions
-- Date: 2025-12-28
-- Description: Add support for tracking task prompt version history
-- Tables: task_prompt_versions

-- TaskPromptVersion table
-- History of task prompt refinements during training
CREATE TABLE IF NOT EXISTS task_prompt_versions (
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

CREATE INDEX IF NOT EXISTS idx_task_prompt_versions_persona ON task_prompt_versions(persona_id, iteration_number DESC);
