# Phase 1: Data Model & Schema

**Status**: Complete
**Date**: 2025-12-18
**Feature**: AI Model Evaluation Framework

## Entity Relationship Diagram

```
ModelConfiguration ──┐
                     │
                     ├──→ Evaluation ──┬──→ Result
                     │                 │
                     │                 └──→ (implied accuracy_score from Result)
                     │
EvaluationTemplate ──┘
```

---

## Entities

### 1. ModelConfiguration

Represents a configured AI model provider and credentials.

**Fields**:
```typescript
{
  id: string (UUID, PRIMARY KEY),
  provider: 'openai' | 'anthropic' | 'google',
  model_name: string,           // e.g., 'gpt-4', 'claude-3-opus', 'gemini-pro'
  api_key_encrypted: string,    // Never stored as plaintext
  created_at: ISO8601,
  updated_at: ISO8601,
  is_active: boolean,           // Soft delete / disable model
  notes: string (optional)      // User-added description
}
```

**Validation Rules**:
- provider: Required, one of three allowed values
- model_name: Required, non-empty string, max 100 chars
- api_key_encrypted: Required, must decrypt successfully
- is_active: Defaults to true on creation

**State Machine**:
- Active → Inactive (disable model)
- Inactive → Active (re-enable model)
- No deletion (soft delete via is_active=false)

**Indexes**:
```sql
CREATE INDEX idx_model_provider_active ON ModelConfiguration(provider, is_active);
```

---

### 2. Evaluation

Represents a single evaluation run (one instruction evaluated against one or more models).

**Fields**:
```typescript
{
  id: string (UUID, PRIMARY KEY),
  instruction_text: string,           // User's prompt/question
  accuracy_rubric: 'exact_match' | 'partial_credit' | 'semantic_similarity',
  partial_credit_concepts: string (optional, JSON array),  // For partial_credit rubric
  expected_output: string (optional),  // For exact_match/partial_credit rubrics
  created_at: ISO8601,
  completed_at: ISO8601 (nullable),   // Null until evaluation finishes
  status: 'pending' | 'running' | 'completed' | 'failed',
  error_message: string (optional),   // If status='failed'
  template_id: string (UUID, FOREIGN KEY, nullable)  // If run from saved template
}
```

**Validation Rules**:
- instruction_text: Required, max 10,000 chars, non-empty
- accuracy_rubric: Required, one of three allowed values
- For 'exact_match' rubric: expected_output is required
- For 'partial_credit' rubric: expected_output required, partial_credit_concepts required
- For 'semantic_similarity': expected_output required
- template_id: Optional, but if provided must exist in EvaluationTemplate table
- created_at: Auto-set to current timestamp
- status: Defaults to 'pending' on creation

**State Machine**:
```
pending → running → completed
              ↓
            failed
```
- Can transition from running to completed or failed (final states)
- Can transition from pending directly to failed (e.g., validation error)

**Indexes**:
```sql
CREATE INDEX idx_evaluation_created_at ON Evaluation(created_at DESC);
CREATE INDEX idx_evaluation_status ON Evaluation(status);
CREATE INDEX idx_evaluation_template_id ON Evaluation(template_id);
```

---

### 3. Result

Represents the output from evaluating one model in an evaluation run.

**Fields**:
```typescript
{
  id: string (UUID, PRIMARY KEY),
  evaluation_id: string (UUID, FOREIGN KEY),  // Links to parent Evaluation
  model_id: string (UUID, FOREIGN KEY),       // Links to ModelConfiguration
  response_text: string,                      // Full response from model
  execution_time_ms: number,                  // Wall-clock time (milliseconds)
  input_tokens: number,                       // Tokens in instruction
  output_tokens: number,                      // Tokens in response
  total_tokens: number,                       // Computed: input + output
  accuracy_score: number (0-100),             // Score per selected rubric
  accuracy_reasoning: string (max 500 chars), // Why this score was assigned
  status: 'pending' | 'completed' | 'failed',
  error_message: string (optional),           // If status='failed'
  created_at: ISO8601
}
```

**Validation Rules**:
- evaluation_id: Required, must exist in Evaluation table
- model_id: Required, must exist in ModelConfiguration table, is_active=true
- response_text: Required if status='completed', nullable if status='pending'
- execution_time_ms: Required if completed, >= 0
- input_tokens, output_tokens: Required if completed, >= 0
- total_tokens: Auto-computed (input + output)
- accuracy_score: Required if completed, must be 0-100 inclusive, integer
- accuracy_reasoning: Optional, max 500 chars to keep storage efficient
- status: Defaults to 'pending' when created

**State Machine**:
```
pending → completed
      ↓
    failed
```
- Transitions depend on API call outcome

**Indexes**:
```sql
CREATE INDEX idx_result_evaluation_id ON Result(evaluation_id);
CREATE INDEX idx_result_model_id ON Result(model_id);
CREATE INDEX idx_result_created_at ON Result(created_at DESC);
```

---

### 4. EvaluationTemplate

Represents a saved evaluation configuration for reuse.

**Fields**:
```typescript
{
  id: string (UUID, PRIMARY KEY),
  name: string,                    // User-provided name (e.g., "Compare GPT-4 vs Claude")
  description: string (optional),  // User-provided description
  instruction_text: string,        // The instruction to evaluate
  model_ids: string (JSON array),  // Array of model UUIDs to evaluate
  accuracy_rubric: 'exact_match' | 'partial_credit' | 'semantic_similarity',
  partial_credit_concepts: string (optional, JSON array),
  expected_output: string (optional),
  created_at: ISO8601,
  updated_at: ISO8601,
  run_count: number                // How many times this template has been used
}
```

**Validation Rules**:
- name: Required, max 100 chars, non-empty
- instruction_text: Required, max 10,000 chars
- model_ids: Required, array of valid model UUIDs, at least 1 model
- accuracy_rubric: Required, one of three allowed values
- All rubric-specific fields follow same rules as Evaluation entity

**State Machine**:
- No state transitions; purely a CRUD entity
- Updated whenever user modifies template
- run_count incremented when template is used to run evaluation

**Indexes**:
```sql
CREATE INDEX idx_template_created_at ON EvaluationTemplate(created_at DESC);
CREATE INDEX idx_template_name ON EvaluationTemplate(name);
```

---

## Database Schema (SQLite)

### DDL Statements

```sql
-- ModelConfiguration table
CREATE TABLE ModelConfiguration (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),
  model_name TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  notes TEXT
);

CREATE INDEX idx_model_provider_active ON ModelConfiguration(provider, is_active);

-- Evaluation table
CREATE TABLE Evaluation (
  id TEXT PRIMARY KEY,
  instruction_text TEXT NOT NULL,
  accuracy_rubric TEXT NOT NULL CHECK (accuracy_rubric IN ('exact_match', 'partial_credit', 'semantic_similarity')),
  partial_credit_concepts TEXT,  -- JSON array
  expected_output TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  template_id TEXT,
  FOREIGN KEY (template_id) REFERENCES EvaluationTemplate(id) ON DELETE SET NULL
);

CREATE INDEX idx_evaluation_created_at ON Evaluation(created_at DESC);
CREATE INDEX idx_evaluation_status ON Evaluation(status);
CREATE INDEX idx_evaluation_template_id ON Evaluation(template_id);

-- Result table
CREATE TABLE Result (
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evaluation_id) REFERENCES Evaluation(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES ModelConfiguration(id) ON DELETE RESTRICT
);

CREATE INDEX idx_result_evaluation_id ON Result(evaluation_id);
CREATE INDEX idx_result_model_id ON Result(model_id);
CREATE INDEX idx_result_created_at ON Result(created_at DESC);

-- EvaluationTemplate table
CREATE TABLE EvaluationTemplate (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instruction_text TEXT NOT NULL,
  model_ids TEXT NOT NULL,  -- JSON array
  accuracy_rubric TEXT NOT NULL CHECK (accuracy_rubric IN ('exact_match', 'partial_credit', 'semantic_similarity')),
  partial_credit_concepts TEXT,  -- JSON array
  expected_output TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  run_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_template_created_at ON EvaluationTemplate(created_at DESC);
CREATE INDEX idx_template_name ON EvaluationTemplate(name);
```

---

## Key Relationships

### Evaluation → Result (1:N)
- One evaluation can have multiple results (one per model)
- Deleting evaluation cascades to results
- Critical for P1: Results display depends on evaluation_id

### EvaluationTemplate → Evaluation (1:N)
- One template can spawn multiple evaluations
- Deleting template doesn't delete evaluation history
- Used for P2: Historical trend analysis

### ModelConfiguration → Result (1:N)
- One model can have results from many evaluations
- Deleting model is blocked if results exist (RESTRICT)
- Ensures data integrity for historical comparisons

---

## Storage Estimates

**Per Evaluation** (with 3 models, 2KB instruction, 500 tokens per response):
- Evaluation record: ~500 bytes
- 3 Result records: ~1.5 KB each = 4.5 KB
- Total per evaluation: ~5 KB

**Per 1000 Evaluations**: ~5 MB
**Per Template**: ~1 KB (minimal data)

**Target Scale**: 1000 evaluations + 50 templates ≈ 10 MB database
**Performance**: Query all results for an evaluation: <10ms with indexes

---

## Migration Strategy

### v0 (Initial)
- Create all four tables with schema above
- Create all indexes

### v1+ (Future)
- Add new rubrics
- Add new providers
- Archive old results (create Results_Archive table, move old rows)

No migrations needed for MVP launch.

---

## TypeScript Interfaces

```typescript
// src/lib/types.ts

export type Provider = 'openai' | 'anthropic' | 'google';
export type RubricType = 'exact_match' | 'partial_credit' | 'semantic_similarity';
export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ResultStatus = 'pending' | 'completed' | 'failed';

export interface ModelConfiguration {
  id: string;
  provider: Provider;
  model_name: string;
  api_key_encrypted: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  notes?: string;
}

export interface Evaluation {
  id: string;
  instruction_text: string;
  accuracy_rubric: RubricType;
  partial_credit_concepts?: string[];
  expected_output?: string;
  created_at: string;
  completed_at?: string;
  status: EvaluationStatus;
  error_message?: string;
  template_id?: string;
}

export interface Result {
  id: string;
  evaluation_id: string;
  model_id: string;
  response_text?: string;
  execution_time_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  accuracy_score?: number;
  accuracy_reasoning?: string;
  status: ResultStatus;
  error_message?: string;
  created_at: string;
}

export interface EvaluationTemplate {
  id: string;
  name: string;
  description?: string;
  instruction_text: string;
  model_ids: string[];
  accuracy_rubric: RubricType;
  partial_credit_concepts?: string[];
  expected_output?: string;
  created_at: string;
  updated_at: string;
  run_count: number;
}

export interface EvaluationWithResults extends Evaluation {
  results: (Result & { model_name: string; provider: Provider })[];
}
```

---

## Consistency & Constraints

### Data Integrity
- Foreign key constraints enforce referential integrity
- CHECK constraints ensure valid values for enums
- CASCADE delete on Evaluation → Results (clean deletion)
- RESTRICT delete on Model (prevents orphaned results)

### Accuracy of Measurements
- execution_time_ms stored as INTEGER (millisecond precision)
- Token counts stored as INTEGER
- accuracy_score stored as INTEGER (0-100) to avoid floating point errors

### Performance Considerations
- All foreign key columns indexed
- Timestamp columns indexed for range queries (trend analysis)
- Evaluation status indexed for fast filtering
- Template run_count denormalized for query speed
