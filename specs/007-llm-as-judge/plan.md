# Implementation Plan: LLM-as-a-Judge System

**Branch**: `007-llm-as-judge` | **Date**: 2025-12-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-llm-as-judge/spec.md`

## Summary

Implement an iterative training system for AI judge personas that evaluates non-deterministic LLM outputs through human feedback loops. The system trains judge LLMs to achieve >80% F1 score alignment with human judgment by:

1. Running iterative cycles: generate outputs → judge with current prompt → collect human agreement/disagreement feedback → calculate metrics (F1, precision, recall, Cohen's Kappa)
2. Using a Prompt Engineer LLM to automatically refine judge prompts based on failure analysis
3. Maintaining strict model provider diversification (Task Model, Judge Model, and Prompt Engineer Model from different providers) to prevent bias
4. Supporting pause/resume functionality with SQLite-backed state persistence for crash recovery
5. Enforcing training dataset constraints (10-200 pairs per session) for data quality and cost management

Technical approach: Async/await with SQLite transactions for state persistence (no external job queue needed), confusion matrix calculation, and background worker threads for CPU-intensive metrics computation.

## Technical Context

**Language/Version**: TypeScript 5.6+ on Node.js 22+
**Primary Dependencies**: Astro 5.x (SSR with Node adapter), better-sqlite3, OpenAI SDK, Anthropic SDK, Google Generative AI SDK
**Storage**: SQLite (better-sqlite3) with new tables for training state, judge decisions, metrics, prompt versions
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Node.js server-side (Astro SSR application)
**Project Type**: Web application (single monorepo)
**Performance Goals**: <2 seconds for dashboard metric visualization; human reviewer can complete 50-200 decisions in <15 minutes; no timeout failures on 200-pair batches
**Constraints**: Training dataset size 10-200 pairs per session; no external job queues (SQLite-backed persistence only); model provider diversification enforced at API level
**Scale/Scope**: MVP supports up to 5 concurrent training sessions; handles 10+ model configurations; training completion in 8-12 iterations typical case

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Code Quality Standards
- ✅ **SRP**: Training loop, metrics calculation, state management, and model validation will be separate modules with single responsibilities
- ✅ **Documentation**: Commit messages will reference user stories and functional requirements
- ✅ **Code Review**: All changes reviewed against architectural fit and readability before merge
- ✅ **Technical Debt**: None anticipated in MVP; future phases (Polish, Integration) explicitly planned
- ✅ **Naming**: Explicit names: `IterativeTrainingLoop`, `ConfusionMatrix`, `ModelSeparationValidator`, `TrainingStateManager`

### Principle II: Testing Discipline (NON-NEGOTIABLE)
- ✅ **Test-First**: Unit tests for metrics calculation written first, verified to fail before implementation
- ✅ **Contract Tests**: Integration tests for training loop state persistence, pause/resume cycles
- ✅ **Critical Path Coverage**: Targeting >80% coverage on metrics.ts, training-loop.ts, model-separation-validator.ts
- ✅ **Tests as Documentation**: Each test scenario maps to a user story acceptance criterion
- ✅ **Red-Green-Refactor**: Followed for metrics calculation module (most critical path)

### Principle III: User Experience Consistency
- ✅ **Standardized Patterns**: Uses existing error message patterns from evaluations module
- ✅ **Workflow Testing**: P1 user story (persona creation) independently testable; acceptance scenarios define complete journey
- ✅ **Acceptance Scenarios**: All 6 user stories include Given/When/Then format with measurable outcomes
- ✅ **Visual Consistency**: Dashboard follows existing metric card patterns from evaluations UI
- ✅ **Error Messages**: User-friendly feedback on CSV validation errors, model separation violations, API failures

### Principle IV: Performance & Scalability
- ✅ **Performance Targets**: Defined in Success Criteria: <2s dashboard update, <15min review time for 50-200 decisions
- ✅ **Constraints Documented**: 10-200 pair limit, no timeout failures on 200-pair batches (Technical Context)
- ✅ **Hot Path Optimization**: Metrics calculation offloaded to Worker Thread; confusion matrix optimized for vectorization
- ✅ **Tradeoff Justification**: SQLite transactions chosen over message queue (simpler, no Redis dependency); async/await sufficient for MVP scale
- ✅ **Resource Bounds**: Training loop checkpoint strategy prevents unbounded memory usage; state persisted between iterations

### Gate Status: ✅ PASS

All four principles are satisfied. Feature is ready for Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── metrics.ts                      # Metrics calculation (F1, precision, recall, Cohen's Kappa)
│   ├── training-loop.ts                # IterativeTrainingLoop orchestrator
│   ├── training-state.ts               # TrainingStateManager for pause/resume
│   ├── model-separation-validator.ts   # Model provider diversification enforcement
│   ├── prompt-engineer.ts              # Prompt refinement via LLM
│   ├── judge-evaluator.ts              # Judge prompt application and decision parsing
│   └── persona-db.ts                   # Database access layer (personas, training pairs, iterations)
│
├── pages/
│   ├── personas.astro                  # Personas list page (P1)
│   ├── personas/[id]/
│   │   ├── index.astro                 # Persona detail page (P1)
│   │   └── review/[iteration].astro    # Human review page (P1)
│   └── api/
│       ├── personas/
│       │   ├── index.ts                # POST create, GET list
│       │   ├── [id].ts                 # GET detail, PUT update, DELETE
│       │   └── [id]/training/
│       │       ├── upload.ts           # POST CSV training data
│       │       ├── start.ts            # POST start iteration
│       │       ├── pause.ts            # POST pause training
│       │       ├── resume.ts           # POST resume training
│       │       └── status.ts           # GET training status
│       │   ├── [id]/iterations/[num]/
│       │   │   ├── decisions.ts        # GET judge decisions for human review
│       │   │   └── feedback.ts         # POST human feedback
│       │   └── [id]/metrics.ts         # GET metrics dashboard
│       └── training/validate-models.ts # POST validate model separation
│
├── components/
│   ├── PersonaCard.astro               # Summary card for persona list
│   ├── MetricCard.astro                # Display single metric with trend
│   ├── ConfusionMatrix.astro           # Visual 2x2 grid (TP/TN/FP/FN)
│   ├── TrainingProgressBar.astro       # Visual iteration progress
│   ├── JudgeDecisionReview.astro       # Human review interface (Agree/Disagree)
│   └── TrainingDashboard.astro         # Real-time metrics + progress (P2)
│
└── types/
    └── training.ts                     # TypeScript types (TrainingLoopState, MetricsResult, etc.)

tests/
├── unit/
│   ├── metrics.test.ts                 # Confusion matrix, F1, precision, recall, Cohen's Kappa
│   ├── model-separation-validator.test.ts
│   ├── metrics-edge-cases.test.ts      # Division by zero, all-zero matrix, etc.
│   └── persona-db.test.ts              # Database access layer
│
├── integration/
│   ├── training-loop-flow.test.ts      # End-to-end iteration cycle
│   ├── pause-resume.test.ts            # State persistence and recovery
│   ├── csv-upload.test.ts              # Training data validation
│   └── metrics-calculation.test.ts     # Full metrics from judge + human feedback
│
└── e2e/
    ├── persona-creation.test.ts        # P1 user story
    ├── training-iteration.test.ts      # P1 user story
    └── human-review.test.ts            # P1 user story

specs/007-llm-as-judge/
├── spec.md                             # Feature specification (completed)
├── plan.md                             # This file
├── research.md                         # Phase 0 research findings (in progress)
├── data-model.md                       # Phase 1 data model (in progress)
├── quickstart.md                       # Phase 1 quick start guide (in progress)
├── contracts/                          # Phase 1 API contracts (in progress)
│   ├── personas.openapi.yaml
│   ├── training.openapi.yaml
│   └── metrics.openapi.yaml
└── tasks.md                            # Phase 2 task decomposition (not created by /speckit.plan)
```

**Structure Decision**: Single monorepo project (Astro SSR application). The feature integrates with existing evaluation system:
- Uses existing ModelConfiguration for Task/Judge/Prompt Engineer model selection
- Extends existing Result table with JudgeEvaluation relationships
- Follows existing API endpoint patterns (src/pages/api)
- Uses existing component patterns from Evaluations module
- Reuses existing OpenAI/Anthropic/Google API clients

## Complexity Tracking

**Status**: No Constitution violations. All complexity is justified by feature requirements.

| Design Choice | Complexity Added | Justification | Simpler Alternative Rejected |
|---------------|-----------------|---------------|-------------------------------|
| SQLite transactions instead of Redis queue | Moderate | MVP scale (5 concurrent sessions) doesn't justify external service; ACID properties needed for crash recovery | BullMQ requires Redis setup/ops overhead; SQLite is file-based and persists with your existing DB |
| Separate Worker Thread for metrics | Low | Metrics calculation (confusion matrix, Cohen's Kappa) is CPU-bound; prevents UI thread blocking | Single-threaded approach causes 100-500ms delays on 200-pair evaluations; User Story 5 requires <2s dashboard refresh |
| Model separation validation at API + DB level | Low | Prevents runtime errors and ensures consistency; catches bugs early | DB constraints alone insufficient - type safety and validation at API boundary required by Constitution Principle I |
| Three distinct LLM models (Task/Judge/Engineer) | High | **Required by spec clarification**: Strict provider diversification prevents bias from same model evaluating itself | Single model would be cheaper but violates fair evaluation principle; risks judge/task contamination |

---

## Phase 0: Research (Complete)

**Status**: ✅ Complete - Research agent findings consolidated

Key decisions made:

1. **Metrics Calculation**: Confusion matrix mapping from Agree/Disagree human feedback to TP/TN/FP/FN
2. **Background Jobs**: Async/await + SQLite transactions (no external queue)
3. **Prompt Refinement**: Failure analysis context + chain-of-thought + few-shot examples
4. **State Persistence**: SQLite checkpoints + ACID transactions for crash recovery
5. **Model Validation**: DB constraints + TypeScript validation layer

See [research.md](./research.md) for detailed findings, code examples, and pattern justifications.

---

## Phase 1: Design & Contracts (In Progress)

### Data Model Generation

[See data-model.md - in progress]

**Tables to Create**:
- `personas` - Judge configurations with model selections
- `training_pairs` - Input/expected_output pairs for training
- `training_iterations` - Individual iteration cycles
- `judge_decisions` - Judge evaluations of generated outputs
- `human_reviews` - Human agreement/disagreement feedback
- `iteration_metrics` - Calculated F1/precision/recall/Cohen's Kappa per iteration
- `judge_prompt_versions` - Prompt history for auditing
- `training_loop_state` - State for pause/resume functionality

### API Contracts Generation

[See contracts/ - in progress]

**Endpoints to Define**:
- `POST /api/personas` - Create new persona
- `GET /api/personas` - List all personas
- `GET /api/personas/[id]` - Get persona details
- `PUT /api/personas/[id]` - Update persona
- `DELETE /api/personas/[id]` - Delete persona
- `POST /api/personas/[id]/training/upload` - Upload CSV training data
- `POST /api/personas/[id]/training/start` - Start training iteration
- `POST /api/personas/[id]/training/pause` - Pause training
- `POST /api/personas/[id]/training/resume` - Resume training
- `GET /api/personas/[id]/training/status` - Get training status
- `GET /api/personas/[id]/iterations/[num]/decisions` - Get judge decisions for review
- `POST /api/personas/[id]/iterations/[num]/feedback` - Submit human feedback
- `GET /api/personas/[id]/metrics` - Get metrics dashboard
- `POST /api/training/validate-models` - Validate model separation

### Integration Points

Feature integrates with existing systems:
- **ModelConfiguration table**: Task/Judge/Prompt Engineer model selection
- **Result table**: JudgeEvaluation stores reference to evaluated model outputs
- **API Clients (OpenAI/Anthropic/Google)**: Reuse existing provider abstraction
- **UI Components**: Use existing MetricCard, Button, Modal patterns from evaluations module

---

## Phase 1: Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to inject:
- Feature branch (`007-llm-as-judge`)
- Key technologies (metrics, training-loop, SQLite persistence patterns)
- Module structure and naming conventions
- Preserve existing context between markers

---

## Implementation Sequence (Phases 1-4)

See [spec.md Implementation Phases](./spec.md#implementation-phases) for detailed phase breakdown.

**Phase 1 (Foundation/MVP)**: Persona CRUD, CSV upload, manual iteration, human review, metrics calculation (~1 week)
**Phase 2 (Automation)**: Automated loop, AI prompt refinement, dashboard, pause/resume (~1 week)
**Phase 3 (Polish)**: Reports, diff viewer, cloning, export/import (~3-5 days)
**Phase 4 (Integration)**: Integration with evaluations, A/B testing, continuous improvement (~1-2 weeks)

---

## Success Criteria (from spec.md)

All 10 success criteria must be met:
1. ✅ SC-001: Create persona + upload data in <5 minutes
2. ✅ SC-002: Metrics calculations align with human judgment
3. ✅ SC-003: Training converges F1≥0.80 in 8-12 iterations
4. ✅ SC-004: Precision≥0.89 and Recall≥0.73 when F1≥0.80
5. ✅ SC-005: Cohen's Kappa≥0.66 (substantial agreement)
6. ✅ SC-006: Dashboard updates <2 seconds
7. ✅ SC-007: No timeout failures on 200-pair batches
8. ✅ SC-008: Review feedback in <15 minutes (50-200 decisions)
9. ✅ SC-009: Generated prompt refinements are semantically meaningful
10. ✅ SC-010: Pause/resume with ≥99% metric consistency
