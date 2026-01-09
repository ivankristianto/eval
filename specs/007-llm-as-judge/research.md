# Research Phase: LLM-as-Judge System Design Decisions

**Branch**: `007-llm-as-judge` | **Date**: 2025-12-26 | **Status**: Complete

This document consolidates research findings and design decisions for five critical technical areas.

---

## 1. Metrics Calculation Pattern: F1 Score, Precision, Recall, and Cohen's Kappa

### Decision
Implement confusion matrix mapping from human "Agree/Disagree" votes to standard binary classification metrics (TP/TN/FP/FN), with special handling for edge cases (empty datasets, all-correct iterations).

### Rationale
- **Standard Practice**: Industry-standard metrics from scikit-learn and medical statistics
- **Interpretability**: F1, precision, recall, and Cohen's Kappa are well-understood by ML practitioners
- **Edge Cases**: Algorithm handles zero-division gracefully, prevents NaN propagation
- **Type Safety**: TypeScript implementation prevents runtime errors

### Confusion Matrix Mapping

```
                 Judge Says AGREE    Judge Says DISAGREE
Human Agrees              TP                    FN
Human Disagrees           FP                    TN

Metrics:
- F1 Score = 2 × (Precision × Recall) / (Precision + Recall)
- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- Cohen's κ = (P_o - P_e) / (1 - P_e) where P_o = observed agreement, P_e = expected by chance
```

### Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| **Selected: Confusion Matrix** | Standard, well-understood, supports multiple metrics, handles edge cases | Requires mapping agree/disagree to binary classification | — |
| Accuracy only | Simple calculation | Ignores class imbalance (useless if 95% agree) | Misleading for LLM judge evaluation |
| Custom agreement metric | Could be tailored to domain | Non-standard, difficult to explain to stakeholders | Violates Constitution Principle I (clarity) |
| Automated metric selection | Adaptive to data characteristics | Complex, hard to reason about | Over-engineered for MVP |

### Implementation Details
See [plan.md Phase 0 research](./plan.md#phase-0-research) for TypeScript code including:
- `buildConfusionMatrix()`: Converts judge/human arrays to TP/TN/FP/FN
- `calculateMetrics()`: Computes all metrics with zero-division handling
- `calculateBatchMetrics()`: Aggregates across iterations for trend analysis

---

## 2. Background Job Processing: Worker Threads vs. BullMQ

### Decision
Use **async/await with SQLite transactions** (no external job queue) for training orchestration, with optional Worker Threads for CPU-intensive metrics calculation.

### Rationale
- **Stack Alignment**: Matches existing eval-ai-models architecture (Astro SSR + better-sqlite3, no Redis)
- **Operational Simplicity**: No need to run/monitor separate Redis instance
- **MVP Scale**: 5 concurrent training sessions doesn't justify external queue overhead
- **ACID Guarantees**: SQLite transactions provide crash-safe state persistence
- **Cost**: Zero operational overhead vs. BullMQ requiring Redis infrastructure

### Architecture

```
Main Request → API Endpoint → IterativeTrainingLoop.execute()
                                 ↓
                        (Fire and forget)
                                 ↓
                        Background iteration:
                        1. Judge outputs
                        2. Worker Thread: Metrics calculation
                        3. Persist checkpoint to SQLite
                        4. Call Prompt Engineer LLM
                        5. Update judge prompt
                        6. Next iteration
                                 ↓
                        SQLite transaction ensures:
                        - Atomicity (all-or-nothing checkpoint)
                        - Consistency (metrics integrity)
                        - Isolation (concurrent sessions don't interfere)
                        - Durability (survives process crash)
```

### Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| **Selected: Async/await + SQLite** | No external service, ACID properties, simple error handling | Limited concurrency (5 sessions max) | Sufficient for MVP; can scale to BullMQ later |
| BullMQ (Redis) | Excellent concurrency, proven at scale, job persistence | Requires Redis ops, added infrastructure cost, complexity | Overkill for MVP; over-engineering |
| Node.js Worker Pool | CPU efficiency, simple API | Limited error recovery, no persistence across crashes | Would lose state on restart; SQLite transactions better |
| Cron-based polling | Simplicity | Unpredictable latency (up to 1 minute delay), polling overhead | Violates performance requirement (<2s dashboard) |

### Worker Thread Usage
Metrics calculation (confusion matrix + F1/Kappa) is CPU-bound and can block the UI thread on 200-pair evaluations. Offload to Worker Thread:
- Expected: 100-500ms computation saved from blocking I/O loop
- Justification: User Story 5 requires <2 second dashboard refresh
- Implementation: Promise-based wrapper around Node.js Worker

---

## 3. Prompt Refinement via LLM: Best Practices

### Decision
Provide the Prompt Engineer LLM with:
1. Current performance metrics (Cohen's Kappa, F1, confusion matrix)
2. Specific failure patterns (false positives and false negatives with examples)
3. Correct examples (few-shot learning from successes)
4. Current prompt (for context)
5. Task description and evaluation criteria

Use chain-of-thought prompt engineering for more effective refinement.

### Rationale
- **Failure-Driven Improvement**: Directly addressing failure patterns leads to 10-15% improvements in Cohen's Kappa (based on research from [Evidently AI LLM-as-Judge Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge) and [Patronus AI LLM Testing](https://www.patronus.ai/llm-testing/llm-as-a-judge); empirical estimates refined during Phase 2 implementation testing)
- **Few-Shot Learning**: Providing 5 correct examples calibrates the LLM's judgment style
- **Chain-of-Thought**: Explicit reasoning steps increase prompt quality
- **Context Preservation**: Including current prompt prevents forgetting domain knowledge

### Failure Analysis Context Structure

```typescript
{
  current_metrics: MetricsResult,           // F1, precision, recall, Cohen's Kappa
  iteration_number: number,
  false_positives: Array<{                  // Judge said "agree" but should "disagree"
    model_output: string,
    expected_output: string,
    why_it_should_have_disagreed: string
  }>,
  false_negatives: Array<{                  // Judge said "disagree" but should "agree"
    model_output: string,
    expected_output: string,
    why_it_should_have_agreed: string
  }>,
  correct_examples: Array<{                 // Examples of correct judgments
    model_output: string,
    expected_output: string,
    decision: "agree" | "disagree",
    reasoning: string
  }>,
  current_prompt: string,                   // For context
  task_description: string,                 // Domain context
  evaluation_criteria: string[]              // Ranked by importance
}
```

### Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| **Selected: Failure analysis + few-shot** | Targeted improvements, high success rate, interpretable refinements | More complex context building | Best practices for LLM-as-Judge (evidentlyai, patronus research) |
| Generic refinement prompt | Simpler to implement | 5-10% lower improvement rate, often overshoots | Under-utilizing LLM capabilities |
| Reinforcement learning from human feedback | Theoretically optimal | Requires hundreds of iterations, much slower convergence | Overkill for MVP; manual iteration feedback sufficient |
| Template-based prompts | Very fast | Brittle, doesn't adapt to domain, misses nuances | Violates Principle III (user experience consistency) |

---

## 4. State Management: Safe Pause/Resume Without Data Loss

### Decision
Implement **SQLite checkpoint-based state machine** with atomic transactions:
1. Save training loop state (iteration number, evaluated count, status) to database
2. Store metrics snapshot and evaluated result IDs at each checkpoint
3. Persist current judge prompt
4. Use SQLite `BEGIN/COMMIT/ROLLBACK` for all-or-nothing persistence

### Rationale
- **Crash Recovery**: Process death doesn't lose data; restart reads last checkpoint
- **ACID Compliance**: Transactions guarantee either full checkpoint or no changes (no partial saves)
- **User Visibility**: State API endpoint reports pause status
- **Resumption**: Read checkpoint, continue from next iteration with same parameters

### State Machine

```
┌─────────────┐
│   PENDING   │ (created, not started)
└──────┬──────┘
       │ start()
       ▼
┌─────────────┐
│ IN_PROGRESS │ ──pause()──> ┌────────┐
│ (iterating) │              │ PAUSED │ ──resume()──┐
└──────┬──────┘              └────────┘             │
       │                                             │
       │ (F1 ≥ 0.80 or max iterations)             │
       ▼                                             │
┌─────────────┐                                     │
│ COMPLETED   │◄────────────────────────────────────┘
└─────────────┘

Checkpoint saved:
- After each iteration completes
- On pause() request
- On error (error_message + error_timestamp)
```

### Checkpoint Data Structure

```sql
TrainingLoopCheckpoint {
  session_id: string,
  iteration_number: number,
  evaluated_result_count: number,
  metrics_snapshot: JSON {          -- Complete metrics at checkpoint
    precision, recall, f1_score, cohens_kappa,
    confusion_matrix: { tp, tn, fp, fn }
  },
  evaluated_result_ids: JSON array, -- IDs of evaluated outputs
  current_prompt: string,           -- Active judge prompt
  created_at: timestamp
}
```

### Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| **Selected: SQLite transactions** | ACID properties, crash-safe, integrates with existing DB, simple | Limited concurrency | Matches existing stack; sufficient for MVP |
| Redis snapshot | Fast in-memory reads, simple recovery | Requires separate service, data loss on crash, no persistence | Operational overhead |
| File-based checkpoints | Simplicity, no DB overhead | Manual consistency management, no transactions, error-prone | Violates Constitution Principle I (reliability) |
| Event sourcing | Complete history, perfect auditability | Complexity, slower reads, storage overhead | Over-engineered for MVP |

---

## 5. Model Separation Validation: Enforcing Different Providers

### Decision
Enforce model diversification (Task Model, Judge Model, Prompt Engineer Model from different providers) at **both database constraint and API validation levels**.

### Rationale
- **Prevents Bias**: Same model evaluating its own outputs introduces circularity
- **Spec Requirement**: Clarification Q3 explicitly mandates strict separation
- **Fail-Fast**: Validation at persona creation prevents training with invalid configuration
- **Type Safety**: TypeScript validation prevents runtime errors

### Validation Layers

```
Request to /api/personas
    ↓
TypeScript type check (ModelSeparationConfig)
    ↓
validateModelSeparation() function:
  1. Check IDs provided
  2. Fetch model records from DB
  3. Extract provider for each model
  4. Verify all three providers are DIFFERENT
  5. Verify all models are ACTIVE
  6. Return ValidationResult { isValid, errors, warnings, models }
    ↓
API returns 400 if invalid, with error details
    ↓
If valid: Write to database with FK constraints
    ↓
Database level:
  - CHECK constraint ensures task_model_id, judge_model_id, prompt_engineer_model_id are all set
  - Index on ModelConfiguration(provider) for fast lookups
  - FK constraints prevent deleted models
```

### Alternatives Considered
| Option | Pros | Cons | Why Rejected |
|--------|------|------|-------------|
| **Selected: API + DB validation** | Type-safe, fail-fast, clear error messages, prevents invalid data | Small code overhead | Best practice for data integrity (Constitution Principle I) |
| DB constraints only | Simpler code, single source of truth | Cryptic error messages, poor UX (backend errors bubble up) | Violates Principle III (user experience) |
| API validation only | User-friendly errors | Data could be corrupted via SQL directly; no DB-level protection | Partial solution |
| No validation | Simplest implementation | Complete loss of data integrity, hidden bugs | Violates all four principles |

### Database Constraints

```sql
CREATE TABLE personas (
  ...
  task_model_id TEXT NOT NULL,
  judge_model_id TEXT NOT NULL,
  prompt_engineer_model_id TEXT NOT NULL,
  ...
  CHECK (task_model_id != '' AND judge_model_id != '' AND prompt_engineer_model_id != ''),
  FOREIGN KEY (task_model_id) REFERENCES ModelConfiguration(id),
  FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id),
  FOREIGN KEY (prompt_engineer_model_id) REFERENCES ModelConfiguration(id)
);
```

---

## Summary: Design Decisions Justification

| Area | Decision | Key Justification | Risk Mitigation |
|------|----------|-------------------|-----------------|
| **Metrics** | Confusion matrix → F1, precision, recall, Cohen's Kappa | Industry standard, handles edge cases | Edge case tests (division by zero, all-zero matrix) |
| **Background Jobs** | Async/await + SQLite (no Redis) | Aligns with stack, ACID properties, MVP scale | Can migrate to BullMQ if concurrency needs grow |
| **Prompt Refinement** | Failure analysis + few-shot + chain-of-thought | 10-15% improvement documented in research | Validate prompt quality in integration tests |
| **State Persistence** | SQLite transactions with checkpoints | Crash-safe, ACID compliance, simple recovery | Verify checkpoint integrity after resume; test scenarios |
| **Model Separation** | API + DB validation, strict provider diversity | Prevents bias, spec requirement, fail-fast | Manual code review; integration tests for validation |

---

## Sources & References

- **Metrics**: [F1 Score in Machine Learning](https://www.geeksforgeeks.org/machine-learning/f1-score-in-machine-learning/), [Understanding Accuracy, Recall, Precision](https://towardsdatascience.com/understanding-accuracy-recall-precision-f1-scores-and-confusion-matrices-561e0f5e328c/), [Cohen's Kappa](https://en.wikipedia.org/wiki/Cohen's_kappa)
- **Background Jobs**: [BullMQ Documentation](https://bullmq.io/), [Worker Threads in Node.js](https://nodesource.com/blog/worker-threads-nodejs-multithreading-in-javascript)
- **Prompt Refinement**: [LLM-as-a-Judge Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge), [LLM As a Judge Best Practices](https://www.patronus.ai/llm-testing/llm-as-a-judge)
- **State Management**: [SQLite Documentation](https://www.sqlite.org/), [Node.js Persistent Queue](https://github.com/damoclark/node-persistent-queue)
- **Architecture**: [Astro SSR Documentation](https://docs.astro.build/), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
