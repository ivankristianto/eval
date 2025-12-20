# Data Model: AI Model Evaluation Framework

**Phase**: 1 (Design & Contracts)
**Date**: 2025-12-20
**Database**: SQLite via better-sqlite3

## Entity Relationship Diagram

\`\`\`
┌──────────────────────┐
│ ModelConfiguration   │
├──────────────────────┤
│ id (PK, UUID)        │
│ provider             │ (openai | anthropic | google)
│ model_name           │
│ api_key_encrypted    │
│ active               │
│ created_at           │
│ updated_at           │
└──────────────────────┘
         ↑
         │ 1:N
         │
┌──────────────────────────┐
│ Evaluation               │
├──────────────────────────┤
│ id (PK, UUID)            │
│ instruction_text         │
│ expected_output          │
│ accuracy_rubric          │
│ partial_credit_concepts  │
│ status                   │
│ created_at               │
│ started_at               │
│ completed_at             │
└──────────────────────────┘
         ↑
         │ 1:N
         │
┌──────────────────────────┐
│ Result                   │
├──────────────────────────┤
│ id (PK, UUID)            │
│ evaluation_id (FK)       │
│ model_id (FK)            │
│ response_text            │
│ execution_time_ms        │
│ input_tokens             │
│ output_tokens            │
│ accuracy_score           │
│ accuracy_reasoning       │
│ status                   │
│ error_message            │
│ completed_at             │
└──────────────────────────┘

┌──────────────────────────┐
│ EvaluationTemplate       │
├──────────────────────────┤
│ id (PK, UUID)            │
│ name                     │
│ description              │
│ instruction_text         │
│ expected_output          │
│ accuracy_rubric          │
│ partial_credit_concepts  │
│ model_ids (JSON array)   │
│ created_at               │
│ updated_at               │
└──────────────────────────┘
\`\`\`

---

## Entity Definitions

### 1. ModelConfiguration

Represents a specific AI model provider and connection configuration.

**Table**: \`ModelConfiguration\`

| Field | Type | Constraints | Validation | Notes |
|-------|------|-------------|-----------|-------|
| \`id\` | UUID | PK, NOT NULL | UUID v4 generated | Primary key |
| \`provider\` | VARCHAR(20) | NOT NULL, CHECK(provider IN ('openai', 'anthropic', 'google')) | Enum: openai \| anthropic \| google | Provider name |
| \`model_name\` | VARCHAR(255) | NOT NULL | Non-empty string, max 255 chars | e.g., "gpt-4", "claude-3-opus", "gemini-2.0" |
| \`api_key_encrypted\` | TEXT | NOT NULL | Non-empty, encrypted AES-256-GCM | Encrypted with env ENCRYPTION_KEY |
| \`active\` | BOOLEAN | NOT NULL, DEFAULT true | Boolean | true if enabled, false if disabled |
| \`created_at\` | DATETIME | NOT NULL | ISO 8601 timestamp | Record creation time |
| \`updated_at\` | DATETIME | NOT NULL | ISO 8601 timestamp | Last update time |

**Indexes**:
- PK on \`id\`
- UNIQUE on \`(provider, model_name)\` - prevent duplicate model entries
- Index on \`active\` - filter active models in queries

---

### 2. Evaluation

Represents a single run of one or more models against an instruction.

**Table**: \`Evaluation\`

| Field | Type | Constraints | Validation | Notes |
|-------|------|-------------|-----------|-------|
| \`id\` | UUID | PK, NOT NULL | UUID v4 generated | Primary key |
| \`instruction_text\` | TEXT | NOT NULL | Non-empty, max 10,000 chars | User-provided prompt |
| \`expected_output\` | TEXT | NULL | Optional, max 10,000 chars | For accuracy scoring |
| \`accuracy_rubric\` | VARCHAR(20) | NOT NULL, CHECK(rubric IN ('exact_match', 'partial_credit', 'semantic_similarity')) | Enum selection | Rubric for scoring |
| \`partial_credit_concepts\` | JSON | NULL | JSON array of strings or NULL | For partial_credit rubric only |
| \`status\` | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK(status IN ('pending', 'running', 'completed', 'failed')) | Enum | Evaluation lifecycle |
| \`created_at\` | DATETIME | NOT NULL | ISO 8601 timestamp | When created |
| \`started_at\` | DATETIME | NULL | ISO 8601 timestamp or NULL | When evaluation began |
| \`completed_at\` | DATETIME | NULL | ISO 8601 timestamp or NULL | When evaluation finished |

---

### 3. Result

Represents the output from evaluating one model.

**Table**: \`Result\`

| Field | Type | Constraints | Validation | Notes |
|-------|------|-------------|-----------|-------|
| \`id\` | UUID | PK, NOT NULL | UUID v4 generated | Primary key |
| \`evaluation_id\` | UUID | FK NOT NULL, references Evaluation(id) | UUID | Links to parent evaluation |
| \`model_id\` | UUID | FK NOT NULL, references ModelConfiguration(id) | UUID | Links to model used |
| \`response_text\` | TEXT | NULL | Optional, unbounded | Raw model response |
| \`execution_time_ms\` | INTEGER | NULL | Non-negative integer | Wall-clock time in milliseconds |
| \`input_tokens\` | INTEGER | NULL | Non-negative integer or NULL | Input token count (N/A for some models) |
| \`output_tokens\` | INTEGER | NULL | Non-negative integer or NULL | Output token count (N/A for some models) |
| \`accuracy_score\` | INTEGER | NULL | 0-100 or NULL | Percentage score from rubric |
| \`accuracy_reasoning\` | TEXT | NULL | Optional, unbounded | Explanation of score |
| \`status\` | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK(status IN ('pending', 'completed', 'failed')) | Enum | Result state |
| \`error_message\` | TEXT | NULL | Optional | Error details if failed (timeout, API error, etc.) |
| \`completed_at\` | DATETIME | NULL | ISO 8601 timestamp or NULL | When result completed |

---

### 4. EvaluationTemplate

Represents a saved evaluation configuration for reuse.

**Table**: \`EvaluationTemplate\`

| Field | Type | Constraints | Validation | Notes |
|-------|------|-------------|-----------|-------|
| \`id\` | UUID | PK, NOT NULL | UUID v4 generated | Primary key |
| \`name\` | VARCHAR(100) | NOT NULL, UNIQUE | Non-empty, max 100 chars | Template display name |
| \`description\` | VARCHAR(500) | NULL | Optional, max 500 chars | User-provided description |
| \`instruction_text\` | TEXT | NOT NULL | Non-empty, max 10,000 chars | Reusable prompt |
| \`expected_output\` | TEXT | NULL | Optional, max 10,000 chars | Reusable expected output |
| \`accuracy_rubric\` | VARCHAR(20) | NOT NULL, CHECK(rubric IN ('exact_match', 'partial_credit', 'semantic_similarity')) | Enum selection | Rubric template |
| \`partial_credit_concepts\` | JSON | NULL | JSON array of strings or NULL | For partial_credit rubric |
| \`model_ids\` | JSON | NOT NULL | JSON array of UUIDs, non-empty | Models to run template against |
| \`created_at\` | DATETIME | NOT NULL | ISO 8601 timestamp | When created |
| \`updated_at\` | DATETIME | NOT NULL | ISO 8601 timestamp | Last update |

---

## Validation Rules

### Input Validation (API Level)

| Field | Rules | Error Code |
|-------|-------|-----------|
| instruction_text | Required, 1-10000 chars | INVALID_INPUT |
| expected_output | Optional, 0-10000 chars | INVALID_INPUT |
| accuracy_rubric | Required enum | INVALID_RUBRIC |
| model_ids | Non-empty UUID array | INVALID_MODEL_SELECTION |

---

## Performance Considerations

### Expected Data Volumes

- **Evaluations**: Hundreds per month (single user)
- **Results**: 3-10 per evaluation (one per model)
- **Models**: 5-15 configured
- **Templates**: 10-30 saved

MVP scope: No batch operations required.
