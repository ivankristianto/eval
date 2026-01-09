# Data Model: LLM-as-Judge Training System

**Branch**: `007-llm-as-judge` | **Date**: 2025-12-26 | **Status**: Phase 1 Design

## Overview

The data model extends the existing eval-ai-models database schema with new tables for persona management, training iterations, judge decisions, human feedback, and metrics calculation.

## Entity Relationship Diagram

```
ModelConfiguration (existing)
    ├─── Persona (1..∞)
    │    └─── TrainingPair (1..∞)
    │         └─── JudgeDecision (1..∞)
    │              └─── HumanReview (1..∞)
    │
    ├─── TrainingIteration (1..∞)
    │    └─── JudgeDecision (1..∞)
    │
    └─── IterationMetrics (1..∞)
         └─── JudgePromptVersion (1..∞)

Result (existing)
    └─── JudgeDecision (1..∞)

TrainingLoopState (NEW - Session tracking)
    └─── TrainingLoopCheckpoint (1..∞)
```

## Core Tables

### 1. Persona

Represents a trained (or in-training) judge configuration for evaluating specific tasks.

```sql
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
```

**Attributes**:

- `id`: Unique identifier for the persona
- `name`: Display name (must be unique)
- `description`: What this judge evaluates
- `task_prompt`: Original prompt used to generate outputs (for context)
- `task_model_id`: Model that generates outputs (FK to ModelConfiguration)
- `judge_model_id`: Model that evaluates outputs (FK to ModelConfiguration)
- `prompt_engineer_model_id`: Model that refines judge prompts (FK to ModelConfiguration)
- `status`: Lifecycle state (draft → training → trained or incomplete)
- `target_f1_score`: Convergence target (default 0.80)
- `max_iterations`: Maximum training iterations before stopping (default 5 for MVP; production deployments may configure up to 20-50 per domain requirements)
- `current_iteration`: Current iteration number during training
- `best_f1_score`: Best F1 score achieved so far
- `best_f1_iteration`: Iteration number where best F1 was achieved

**Constraints**:

- All three model IDs must be provided (non-empty)
- F1 target between 0.0 and 1.0
- Max iterations >= 1
- Model IDs are FKs with DELETE RESTRICT (prevent orphaned personas)

---

### 2. TrainingPair

Individual input/expected_output pairs used for training the judge.

```sql
CREATE TABLE IF NOT EXISTS training_pairs (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_pairs_persona ON training_pairs(persona_id);
```

**Attributes**:

- `id`: Unique identifier
- `persona_id`: FK to persona
- `input`: Task input (e.g., customer query, problem statement)
- `expected_output`: Ground truth / expected answer

**Constraints**:

- 10-200 pairs per persona (enforced at API layer)
- Non-empty input and expected_output

---

### 3. TrainingIteration

Records each iteration cycle (generate → judge → feedback → metrics).

```sql
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
```

**Attributes**:

- `id`: Unique identifier
- `persona_id`: FK to persona
- `iteration_number`: Sequential iteration number (1, 2, 3...)
- `judge_model_id`: Which judge model was used (for audit trail)
- `judge_prompt_text`: Exact prompt text used for this iteration
- `status`: Iteration state (in_progress → completed or paused or failed)
- `total_pairs_evaluated`: Count of pairs evaluated by judge
- `pairs_reviewed_by_human`: Count of pairs reviewed by human
- `started_at`: Timestamp when iteration started
- `completed_at`: Timestamp when iteration completed (null if paused/failed)
- `error_message`: If status='failed', error details

---

### 4. JudgeDecision

Judge model's decision for each training pair.

```sql
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
```

**Attributes**:

- `id`: Unique identifier
- `iteration_id`: FK to iteration
- `training_pair_id`: FK to training pair
- `result_id`: Optional FK to Result table (for audit trail)
- `generated_output`: Model output being evaluated
- `judge_decision`: Judge's assessment (agree/disagree with expected output)
- `judge_reasoning`: Explanation of decision

---

### 5. HumanReview

Human reviewer's feedback on judge decisions.

```sql
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
```

**Attributes**:

- `id`: Unique identifier
- `judge_decision_id`: FK to judge decision (1:1 relationship)
- `human_decision`: Human's vote (agree/disagree with judge)
- `human_notes`: Comments or reasoning
- `reviewer_id`: Optional user ID of reviewer
- `created_at`: When review was submitted

**Semantics**:

- `human_decision = 'agree'`: Human affirms judge's assessment
- `human_decision = 'disagree'`: Human contradicts judge's assessment

---

### 6. IterationMetrics

Calculated metrics for each iteration (confusion matrix, F1, Cohen's Kappa).

```sql
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
```

**Attributes**:

- `id`: Unique identifier
- `iteration_id`: FK to iteration (1:1 relationship)
- `true_positives`: Definition depends on iteration phase:
  - **Iteration 1**: human_agrees AND judge_decision = "correct" (human affirms correct judgment)
  - **Iterations 2+**: judge_decision = "correct" AND is_correct = true (where `is_correct = suggested_output.trim() === expected_output.trim()`)
- `true_negatives`: Definition depends on iteration phase:
  - **Iteration 1**: human_agrees AND judge_decision = "incorrect" (human affirms incorrect judgment)
  - **Iterations 2+**: judge_decision = "incorrect" AND is_correct = false
- `false_positives`: Definition depends on iteration phase:
  - **Iteration 1**: human_disagrees AND judge_decision = "correct" (human contradicts - judge was wrong)
  - **Iterations 2+**: judge_decision = "correct" BUT is_correct = false (judge wrong)
- `false_negatives`: Definition depends on iteration phase:
  - **Iteration 1**: human_disagrees AND judge_decision = "incorrect" (human contradicts - judge was wrong)
  - **Iterations 2+**: judge_decision = "incorrect" BUT is_correct = true (judge wrong)
- `precision`: TP / (TP + FP)
- `recall`: TP / (TP + FN)
- `f1_score`: 2 × (precision × recall) / (precision + recall)
- `cohens_kappa`: Inter-rater reliability (target ≥ 0.66)
- `accuracy`: (TP + TN) / Total

**Correctness Algorithm (Iterations 2+)**:

```
is_correct = (suggested_output.trim() === expected_output.trim())
```

- Uses exact string match after trimming leading/trailing whitespace
- No semantic similarity or fuzzy matching for MVP (deferred to Phase 3)

---

### 7. JudgePromptVersion

History of judge prompt refinements.

```sql
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
```

**Attributes**:

- `id`: Unique identifier
- `persona_id`: FK to persona
- `iteration_number`: Which iteration this prompt was used for
- `prompt_text`: The actual prompt
- `improvement_rationale`: Why this version was created (if AI-refined)
- `created_by`: 'human' or 'ai'
- `created_at`: Timestamp

**Design Note**: Stores only "significant" prompts (not every formatting change), per spec clarification Q1.

---

### 8. TrainingLoopState

Tracks overall training session state for pause/resume functionality.

```sql
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
```

**Attributes**:

- `session_id`: Unique session identifier
- `persona_id`: FK to persona being trained
- `current_iteration`: Current iteration number (0 = not started)
- `total_iterations`: Max iterations configured
- `status`: Session state machine (pending → in_progress → completed/paused/failed)
- `task_results_evaluated`: Count of task results evaluated so far
- `judge_model_id`: Judge model being used (audit trail)
- `prompt_engineer_model_id`: Prompt engineer model (audit trail)
- `task_model_id`: Task model (audit trail)
- `created_at`: Session created
- `updated_at`: Last update
- `error_message`: If status='failed'
- `pause_reason`: If status='paused'

---

### 9. TrainingLoopCheckpoint

Snapshots of training state for crash recovery.

```sql
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
```

**Attributes**:

- `id`: Unique identifier
- `session_id`: FK to training session
- `iteration_number`: Which iteration this checkpoint is for
- `evaluated_result_count`: How many results evaluated
- `metrics_snapshot`: JSON blob of metrics at checkpoint
- `evaluated_result_ids`: JSON array of evaluated result IDs
- `current_prompt`: Active judge prompt at checkpoint
- `created_at`: When checkpoint was saved

**Purpose**: Enable crash recovery by storing complete state after each iteration.

---

## Key Design Decisions

### 1. Agree/Disagree vs. Correct/Incorrect

The `judge_decision` and `human_decision` fields use `agree`/`disagree` semantics per spec clarification Q2:

- Judge evaluates: "Does this output meet the expected quality?"
- Human reviews: "Does the judge's assessment match my judgment?"
- This enables confusion matrix mapping for fair evaluation

### 2. Significant Prompt Versioning

Only store prompts that represent "significant changes" (semantic changes, not formatting), per spec clarification Q1. This reduces noise while maintaining audit trail.

### 3. Model Separation Enforcement

Three separate model IDs (`task_model_id`, `judge_model_id`, `prompt_engineer_model_id`) are all REQUIRED and must be from different providers. Enforced by:

- NOT NULL constraints in database
- CHECK constraints ensuring non-empty
- Foreign key constraints to ModelConfiguration
- API-level validation in TypeScript

### 4. JSON Storage for Snapshots

Metrics snapshots and result IDs are stored as JSON blobs in checkpoints to avoid normalization complexity for ephemeral data (only used for resume, not queried separately).

### 5. Cascading Deletes

Most FKs use `ON DELETE CASCADE` (e.g., deleting a persona deletes all training pairs, iterations, decisions). Only `ModelConfiguration` FKs use `ON DELETE RESTRICT` to prevent accidental model deletion.

---

## Database Initialization

All tables are created via migrations in `db/schema.sql`. Use:

```bash
npm run db:init    # Initialize database
npm run db:reset   # Reset database (development only)
```

---

## Integration with Existing Schema

This feature extends but does not modify existing tables:

- ✅ `ModelConfiguration`: Referenced for task/judge/prompt engineer models
- ✅ `Result`: JudgeDecision optionally references evaluated results
- ✅ `Evaluation`: Parent context for training tasks
- ➡️ No existing tables are modified

---

## Performance Considerations

### Indexes

- `personas(status)`: Fast filtering by training state
- `training_pairs(persona_id)`: Quick pair retrieval per persona
- `training_iterations(persona_id, iteration_number DESC)`: Fast latest iteration lookup
- `judge_decisions(iteration_id)`: Find all decisions for an iteration
- `iteration_metrics(f1_score DESC)`: Find best-performing personas
- `training_loop_checkpoints(session_id, iteration_number DESC)`: Fast checkpoint recovery

### Scale Targets

- **Personas**: 10-50 per system
- **Training pairs per persona**: 10-200
- **Iterations per persona**: 5-20 (typical 8-12)
- **Judge decisions per iteration**: 10-200 (matches pair count)
- **Metrics per iteration**: 1 record

Estimated maximum storage: ~50 personas × 200 pairs × 20 iterations × 1KB per decision = 200MB (negligible for SQLite)

---

## Migration Path (If Schema Changes)

Document any schema changes using standard migration format:

```sql
-- Migration: 001-add-judge-training-tables
-- Date: 2025-12-26
-- Description: Add support for LLM-as-Judge training

CREATE TABLE IF NOT EXISTS personas (
  ... [full definition]
);
-- ... [other tables]
```

Store migrations in `db/migrations/` directory for reproducibility.

---

## State Machine Documentation

### Persona Lifecycle State Machine

The `personas.status` field follows a strict state machine to ensure data integrity and predictable behavior.

**States**: `draft` → `training` → `trained` | `incomplete`

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Persona State Machine                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐                                                        │
│  │  draft  │  Initial state after creation                          │
│  └────┬────┘                                                        │
│       │                                                             │
│       │  User clicks "Start Training" AND                          │
│       │  persona has ≥10 training pairs                            │
│       ▼                                                             │
│  ┌──────────────────┐                                              │
│  │   training       │  Active training in progress                 │
│  │                  │  - Iterations running                         │
│  │                  │  - Can be paused/resumed                      │
│  └──────┬───────────┘                                              │
│         │                                                            │
│         │  ┌───────────────────────────────────────────────────┐   │
│         │  │                                                   │   │
│         │  │  F1 ≥ target_f1_score                             │   │
│         │  │  OR user stops early after convergence            │   │
│         ▼  ▼                                                   │   │
│  ┌──────────────┐   ┌────────────────┐                          │
│  │   trained    │   │  incomplete    │                          │
│  │              │   │                │                          │
│  │  - F1 ≥ 0.80 │   │  - Max iterations│                         │
│  │  - Best prompt│   │    reached     │                          │
│  │    exported   │   │  - F1 < target  │                          │
│  └──────────────┘   │  - Failed       │                          │
│                     └────────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Valid Transitions**:

| From State   | To State     | Trigger              | Guard Conditions                                       |
| ------------ | ------------ | -------------------- | ------------------------------------------------------ |
| `draft`      | `training`   | User starts training | persona has ≥10 training pairs                         |
| `training`   | `trained`    | Training completed   | F1 ≥ target_f1_score OR user accepts early convergence |
| `training`   | `incomplete` | Training stopped     | max_iterations reached AND F1 < target_f1_score        |
| `training`   | `training`   | Pause/Resume         | Training session paused then resumed                   |
| `trained`    | `training`   | User re-trains       | User explicitly starts new training session            |
| `incomplete` | `training`   | User re-trains       | User explicitly starts new training session            |

**Invalid Transitions** (must be prevented):

| From State   | To State     | Reason                                         |
| ------------ | ------------ | ---------------------------------------------- |
| `draft`      | `trained`    | Cannot be trained without running iterations   |
| `draft`      | `incomplete` | Cannot be incomplete without starting training |
| `trained`    | `draft`      | Cannot return to draft after training          |
| `incomplete` | `draft`      | Cannot return to draft after training          |
| `trained`    | `incomplete` | Cannot transition from terminal state          |

**State Transition Validation** (to be implemented in `persona-db.ts`):

```typescript
/**
 * Validates if a persona status transition is allowed
 * @param currentState Current persona status
 * @param newState Desired new status
 * @returns true if transition is valid, false otherwise
 */
export function isValidPersonaStatusTransition(
  currentState: PersonaStatus,
  newState: PersonaStatus
): boolean {
  const validTransitions: Record<PersonaStatus, PersonaStatus[]> = {
    draft: ['training'],
    training: ['trained', 'incomplete'], // training → training allowed for pause/resume via separate mechanism
    trained: ['training'], // Can re-train trained personas
    incomplete: ['training'], // Can re-train incomplete personas
  };

  return validTransitions[currentState]?.includes(newState) ?? false;
}

/**
 * Transitions persona to training state with guard checks
 * @throws {Error} if transition is invalid or guard conditions fail
 */
export function transitionToTraining(personaId: string): void {
  const persona = getPersona(personaId);
  if (!isValidPersonaStatusTransition(persona.status, 'training')) {
    throw new Error(`Cannot transition from ${persona.status} to training`);
  }

  // Guard: Must have ≥10 training pairs
  const pairCount = getTrainingPairCount(personaId);
  if (pairCount < 10) {
    throw new Error('Persona requires at least 10 training pairs to start training');
  }

  // Execute transition
  updatePersonaStatus(personaId, 'training');
}
```

**Terminal States**: `trained`, `incomplete` - These are end states. From here, users can only re-train (transition back to `training`).

---

### TrainingIteration State Machine

The `training_iterations.status` field tracks iteration-level state.

**States**: `in_progress` → `completed` | `paused` | `failed`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TrainingIteration State Machine                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                                                    │
│  │ in_progress │  Iteration actively running                        │
│  └───┬────┬────┘                                                    │
│      │    │                                                         │
│      │    │  ┌───────────────────────────────────────────────┐     │
│      │    │  │                                               │     │
│      │    │  │  Completion                Pause              │     │
│      │    │  │  - All pairs evaluated      - User clicks     │     │
│      │    │  │  - Metrics calculated       "Pause"           │     │
│      │    ▼  ▼                         │                      │     │
│      │  ┌────────┐  ┌──────────┐         │                      │     │
│      │  │completed│  │  paused  │         │                      │     │
│      │  └────────┘  └────┬─────┘         │                      │     │
│      │                    │               │                      │     │
│      │                    │               │  User clicks         │     │
│      │                    │               │  "Resume"           │     │
│      │                    │               └──────────────────────┘     │
│      │                    │               ▼                              │
│      │                    │          ┌─────────────┐                    │
│      │                    │          │ in_progress  │                   │
│      │                    │          └──────────────┘                   │
│      │                    │                                                 │
│      │    API Failure     │                                                 │
│      └────────────────────┼─────────────────┐                              │
│                            ▼                 ▼                              │
│                         ┌────────┐      ┌──────────┐                         │
│                         │ failed │      │  failed  │                         │
│                         │        │      │          │                         │
│                         │- API   │      │- Resume  │                         │
│                         │  error │      │  error   │                         │
│                         └────────┘      └──────────┘                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Valid Transitions**:

| From State    | To State      | Trigger                                       |
| ------------- | ------------- | --------------------------------------------- |
| `in_progress` | `completed`   | All pairs evaluated, metrics calculated       |
| `in_progress` | `paused`      | User clicks "Pause" button                    |
| `in_progress` | `failed`      | Unrecoverable API error (3 retries exhausted) |
| `paused`      | `in_progress` | User clicks "Resume" button                   |
| `paused`      | `failed`      | Resume fails with unrecoverable error         |

**Terminal States**: `completed`, `failed`

**State Persistence**:

- `status`: Current iteration state
- `started_at`: Set when entering `in_progress`
- `completed_at`: Set when entering `completed` or `failed`
- `error_message`: Set when entering `failed` state

---

### TrainingLoopState State Machine

The `training_loop_state.status` field tracks overall session state for pause/resume.

**States**: `pending` → `in_progress` → `paused` → `completed` | `failed`

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TrainingLoopState State Machine                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐                                                        │
│  │ pending │  Session initialized, awaiting first iteration         │
│  └────┬────┘                                                        │
│       │                                                             │
│       │  User starts training                                       │
│       ▼                                                             │
│  ┌──────────────────┐                                              │
│  │   in_progress    │  Training session running                     │
│  └──────┬───────────┘                                              │
│         │                                                            │
│         │  ┌───────────────────────────────────────────────────┐   │
│         │  │                                                   │   │
│         ▼  ▼                                                   │   │
│  ┌────────────┐   ┌──────────┐   ┌──────────┐                   │
│  │ completed  │   │  paused  │   │  failed  │                   │
│  │            │   │          │   │          │                   │
│  │ - F1 target│   │ - User   │   │ - API    │                   │
│  │   reached  │   │   pause  │   │   error  │                   │
│  │ - Max iter │   │          │   │          │                   │
│  └────────────┘   └────┬─────┘   └──────────┘                   │
│                        │                                            │
│                        │  Resume                                    │
│                        └──────────────────┐                          │
│                                           ▼                          │
│                                    ┌──────────────────┐             │
│                                    │   in_progress     │             │
│                                    └──────────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Valid Transitions**:

| From State    | To State      | Trigger                                        |
| ------------- | ------------- | ---------------------------------------------- |
| `pending`     | `in_progress` | User starts training loop                      |
| `in_progress` | `paused`      | User clicks "Pause" button                     |
| `in_progress` | `completed`   | Convergence achieved OR max iterations reached |
| `in_progress` | `failed`      | Unrecoverable error during training            |
| `paused`      | `in_progress` | User clicks "Resume" button                    |

**State Persistence**:

- `session_id`: Unique identifier for training session
- `persona_id`: FK to persona being trained
- `status`: Current session state
- `current_iteration`: Last completed iteration number
- `created_at`: Session start timestamp
- `updated_at`: Last state change timestamp
- `converged`: Boolean flag if training converged (F1 ≥ target)
- `awaiting_human_review`: Boolean flag if waiting for iteration 1 human review
- `error_message`: Error details if status='failed'
- `pause_reason`: Reason for pause if status='paused'

**Checkpoint Integration**:

TrainingLoopState integrates with `training_loop_checkpoints` table:

- Checkpoint saved after each iteration completion
- Checkpoint includes: iteration state, metrics, prompt versions, next iteration number
- Resume loads latest checkpoint and restores training loop state

---

### Timestamp Handling

All timestamps stored in **UTC** using ISO 8601 format with `Z` suffix:

- `created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))`
- Display in user's local timezone using JavaScript `toLocaleString()`
- Ensures consistent sorting across timezones

**Implementation Note**: Database schema uses UTC storage; UI components convert to local time for display using:

```javascript
new Date(timestamp).toLocaleString(); // Displays in user's local timezone
```
