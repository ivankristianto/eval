# Implementation Plan: AI Model Evaluation Framework

**Branch**: `001-eval-ai-models` | **Date**: 2025-12-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-eval-ai-models/spec.md`

## Summary

Build a web application that allows users to evaluate multiple AI generative models by submitting identical instructions and comparing metrics (execution time, token counts, accuracy). The application will display results in a tabular format, persist historical data for trend analysis, and support saving/rerunning evaluation templates. Built with Astro + Tailwind with minimal dependencies, storing metadata in local SQLite.

**MVP Focus (P1)**: Core evaluation flow - submit instruction, query multiple models in parallel, display comparative metrics in real-time.

## Technical Context

**Language/Version**: JavaScript/TypeScript (Node.js 18+) + TypeScript for type safety
**Primary Dependencies**: Astro, Tailwind CSS, SQLite3, node-sqlite3/better-sqlite3
**Storage**: Local SQLite database (evaluation.db) for results, configurations, and templates
**Testing**: Vitest for unit/integration tests, Playwright for E2E tests
**Target Platform**: Web browser (desktop/laptop), local Node.js server
**Project Type**: Web application (Astro SSR with server-side evaluation logic)
**Performance Goals**: Evaluation of 3 models completes within 30 seconds; table renders in <500ms after results arrive
**Constraints**: <2GB memory usage during concurrent evaluations; <100MB database growth per 1000 evaluations; minimal external dependencies per user requirement
**Scale/Scope**: Single user or small team (3-5 users); up to 50 evaluation templates; support 2-10 models in configuration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle I: Code Quality Standards** ✅
- Single Responsibility: Each module handles evaluation, API calls, data persistence, or UI separately
- Code clarity: Vanilla JS/CSS preferred; explicit naming for variables/functions
- Review required: All code changes will be reviewed for readability before merge
- Status: Design supports modular architecture

**Principle II: Testing Discipline (NON-NEGOTIABLE)** ✅
- Test-first mandatory: Contract tests for API endpoints, integration tests for evaluation flow
- >80% coverage on critical paths (evaluation executor, result storage, accuracy calculation)
- Red-Green-Refactor enforced during implementation
- Status: Tasks will include test-first requirement; test suite infrastructure included in Phase 1

**Principle III: User Experience Consistency** ✅
- Standardized patterns: All error states use consistent messaging; result display uniform across views
- Independent testing of workflows: Each user story can be tested independently
- Acceptance scenarios define complete journey: Spec covers all flows
- Status: Table layout, status indicators, error messages will follow established patterns

**Principle IV: Performance & Scalability** ✅
- Performance targets explicit: 30s for 3 models, <500ms render, <5% timing accuracy drift
- Constraints documented: Memory <2GB, storage efficient, database query optimization
- Hot paths: Parallel model queries, efficient SQLite indexing on evaluation_id/timestamp
- Status: Design includes concurrency considerations and performance constraints

**GATE RESULT**: ✅ **PASS** - All principles aligned with implementation approach

## Project Structure

### Documentation (this feature)

```text
specs/001-eval-ai-models/
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Data schema
├── quickstart.md        # Phase 1: Getting started
├── contracts/           # Phase 1: API contract definitions
│   ├── evaluation.md
│   ├── models.md
│   └── results.md
└── tasks.md             # Phase 2: Implementation tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── pages/                          # Astro pages
│   ├── index.astro                 # Main evaluation interface
│   ├── templates.astro             # Saved templates list
│   ├── history.astro               # Evaluation history/trends
│   └── api/                        # API endpoints
│       ├── evaluate.ts             # POST /api/evaluate
│       ├── templates.ts            # CRUD /api/templates
│       ├── results.ts              # GET /api/results
│       └── models.ts               # GET/POST /api/models
│
├── components/
│   ├── EvaluationForm.astro        # Input form + model selection
│   ├── ResultsTable.astro          # Results display
│   ├── StatusIndicator.astro       # Per-model status badges
│   ├── ErrorBanner.astro           # Consistent error display
│   └── TemplateManager.astro       # Save/load templates UI
│
├── lib/
│   ├── db.ts                       # SQLite initialization and queries
│   ├── evaluator.ts                # Core evaluation orchestration
│   ├── api-clients.ts              # Model provider API clients (OpenAI, Anthropic, Google)
│   ├── accuracy.ts                 # Accuracy calculation logic
│   ├── types.ts                    # TypeScript interfaces
│   └── validators.ts               # Input validation
│
├── public/
│   └── (static assets - minimal)
│
└── styles/
    └── global.css                  # Tailwind + minimal custom CSS

tests/
├── contract/
│   ├── evaluate.test.ts            # POST /api/evaluate contract
│   ├── templates.test.ts           # Template CRUD contracts
│   └── results.test.ts             # GET /api/results contract
│
├── integration/
│   ├── evaluation-flow.test.ts     # Full P1 user story
│   ├── template-flow.test.ts       # Full P2 user story
│   └── accuracy-flow.test.ts       # Full P3 user story
│
└── unit/
    ├── evaluator.test.ts           # Parallel query logic
    ├── accuracy.test.ts            # Rubric scoring
    ├── api-clients.test.ts         # API call handling
    └── validators.test.ts          # Input validation

db/
├── schema.sql                      # SQLite schema initialization
└── migrations/                     # Future schema changes

.env.example                        # Template for API keys and config
astro.config.mjs                    # Astro configuration
tailwind.config.js                  # Tailwind CSS configuration
tsconfig.json                       # TypeScript configuration
```

**Structure Decision**: Full-stack Astro application (single project). Frontend and backend coexist in same codebase:
- Astro pages serve HTML with Tailwind styling
- API routes (pages/api/*.ts) handle evaluation logic server-side
- Vanilla JS for minimal interactivity (form submission, real-time status updates via fetch)
- SQLite database accessed directly from server-side code
- No separate backend or database layer (per minimalist architecture requirement)

## Phase 0: Outline & Research

### Research Tasks

1. **Astro patterns for real-time data updates**
   - Task: Investigate how Astro handles live status updates during long-running operations
   - Decision: Use server-sent events (SSE) from API endpoint or polling from client-side fetch
   - Rationale: Keep dependencies minimal; SSE is built-in HTTP, no extra libraries needed

2. **SQLite best practices for concurrent reads/writes**
   - Task: Research SQLite connection pooling and write lock handling for parallel evaluations
   - Decision: Use better-sqlite3 (synchronous) with WAL mode; handle write serialization at application layer
   - Rationale: Simpler than async approach, sufficient for single-user/small-team scale

3. **Model provider API integration patterns**
   - Task: Research OpenAI, Anthropic, Google model APIs for token counting and timing
   - Decision: Each provider SDK handles token counting; measure wall-clock time client-side; normalize results
   - Rationale: Standardizes metrics extraction across heterogeneous APIs

4. **Accuracy rubric implementation strategies**
   - Task: Evaluate approaches for Exact Match, Partial Credit, Semantic Similarity scoring
   - Decision: Use provider's API for semantic similarity (embeddings), string matching for exact/partial
   - Rationale: Leverages existing model APIs, avoids additional ML dependencies

**Output**: research.md (Phase 0 complete)

## Phase 1: Design & Contracts

### 1. Data Model (data-model.md)

**Key Entities**:

- **ModelConfiguration**: API key, provider, model version, active status
- **Evaluation**: Single run with multiple results, instruction text, timestamp, accuracy rubric choice
- **Result**: Per-model output, timing, tokens, response, accuracy score/reasoning
- **EvaluationTemplate**: Saved configuration (instruction + model list) for reuse

**SQLite Schema Decisions**:
- Primary key: UUID for all entities (better than integer for distributed nature)
- Indexes: evaluation_id, template_id, created_at for query performance
- Foreign keys: Results reference Evaluations; Evaluations reference Templates (optional)
- Storage: Store response text, but truncate reasoning to 500 chars for performance

### 2. API Contracts (contracts/*.md)

**POST /api/evaluate**
- Input: instruction (text), selected_models (array), rubric_type (string)
- Output: evaluation_id, status stream with per-model status updates
- Error cases: Invalid rubric, model API down, instruction too long

**GET /api/results?evaluation_id=xxx**
- Output: Full results table data (model name, time, tokens, accuracy, reasoning)
- Caching: None (fresh on each request)

**POST /api/templates**
- Input: instruction, model_list, name, description
- Output: template_id, created_at

**GET /api/templates**
- Output: List of saved templates with name, instruction preview, model count

**POST /api/models**
- Input: provider, api_key, model_name
- Output: model_id, validation status

### 3. UI Components & Patterns

- **EvaluationForm**: Single input for instruction, multi-select checkboxes for models, rubric dropdown, submit button
- **ResultsTable**: Sortable table (by time/tokens/accuracy) with visual indicators (green=best, red=worst per metric)
- **StatusIndicator**: Real-time badges (Pending → Running → Completed/Failed) for each model
- **TemplateManager**: Modal to save current evaluation or load previous template

### 4. Quick Start (quickstart.md)

Setup instructions for local development:
1. Clone repo
2. Install dependencies (npm install)
3. Copy .env.example to .env, add API keys
4. Run migrations: npm run db:init
5. Start dev server: npm run dev
6. Navigate to localhost:3000

**Output**: data-model.md, contracts/evaluation.md, contracts/models.md, contracts/results.md, quickstart.md (Phase 1 complete)

### 5. Agent Context Update

After Phase 1 design, run update script to document Astro + Tailwind + SQLite stack choices.

## Phase 2: Tasks Generation

*Note: This is generated by `/speckit.tasks` command (NOT by /speckit.plan)*

Phase 2 will generate tasks.md with:
- **Phase 1 Setup**: Project initialization, dependency install, DB schema
- **Phase 2 Foundational**: API clients for each model provider, database initialization, accuracy calculator
- **Phase 3 User Story 1**: Core evaluation endpoint, results table UI, real-time status updates
- **Phase 4 User Story 2**: Template save/load, historical view, comparison logic
- **Phase 5 User Story 3**: Rubric selection, reasoning display, side-by-side accuracy comparison
- **Phase 6 Polish**: Error handling, performance optimization, E2E testing

---

## Next Steps

1. **Phase 0 (This Plan)**: Research outputs → research.md
2. **Phase 1 (This Plan)**: Design artifacts → data-model.md, contracts/*, quickstart.md
3. **Phase 2 (Next Command)**: Run `/speckit.tasks` to generate tasks.md with implementation roadmap
4. **Phase 3 (Implementation)**: Execute tasks in priority order (Setup → Foundational → User Stories)

## Complexity Tracking

No constitution violations identified. Architecture aligns with all four core principles while maintaining minimalist technology choices.
