---

description: "Task list for AI Model Evaluation Framework implementation"
---

# Tasks: AI Model Evaluation Framework

**Input**: Design documents from `/specs/001-eval-ai-models/`
**Prerequisites**: plan.md (complete), spec.md (complete), data-model.md, research.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Tests are MANDATORY per Constitution Principle II (Testing Discipline Non-Negotiable).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- **Tests**: Test-first required; write tests FIRST, ensure they FAIL before implementation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and base structure

- [X] T001 Create project structure with src/, tests/, db/ directories per plan.md
- [X] T002 Initialize npm project: npm init, package.json with Astro, Tailwind, better-sqlite3, Vitest, Playwright dependencies
- [X] T003 [P] Create astro.config.mjs configuration with Astro SSR adapter, API routes enabled, Tailwind integration
- [X] T004 [P] Create tailwind.config.js with default configuration (minimal customization per minimalist requirement) - Note: Using Tailwind v4 with CSS-based config
- [X] T005 [P] Create tsconfig.json with TypeScript strict mode enabled
- [X] T006 [P] Create .env.example template with OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, NODE_ENV=development
- [X] T007 [P] Create src/lib/types.ts with all TypeScript interfaces (Provider, RubricType, ModelConfiguration, Evaluation, Result, EvaluationTemplate, EvaluationWithResults)
- [X] T008 [P] Create src/lib/validators.ts with input validation functions (instruction, rubric_type, model_ids, api_key formats)
- [X] T009 Create db/schema.sql with complete SQLite schema: ModelConfiguration, Evaluation, Result, EvaluationTemplate tables with all indexes per data-model.md
- [X] T010 Create src/lib/db.ts with database initialization function: open connection, enable WAL mode, run schema.sql, create indexes
- [X] T011 Create npm script npm run db:init that executes db/schema.sql and initializes evaluation.db in db/ directory
- [X] T012 [P] Create src/styles/global.css with Tailwind imports and minimal custom CSS for error banners, status indicators
- [X] T013 Create src/pages/index.astro template page structure with header, main content area ready for components

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T014 Create src/lib/api-clients.ts with ClientFactory pattern and three provider implementations: OpenAIClient, AnthropicClient, GoogleClient with evaluate() method returning { response, inputTokens, outputTokens, totalTokens, executionTime }
- [X] T015 [P] Create src/lib/accuracy.ts with three rubric functions: exactMatch(), partialCredit(), semanticSimilarity() - each returns { score: 0-100, reasoning: string }
- [X] T016 Create src/lib/evaluator.ts with EvaluationExecutor class: orchestrate parallel model queries, collect results, calculate accuracy, persist to database, emit status updates
- [X] T017 Create src/pages/api/models.ts API endpoint with POST, GET, GET /:id, PATCH /:id, DELETE /:id, POST /:id/test-connection per contracts/models.md
- [ ] T018 Create test file tests/contract/models.test.ts: test all model API endpoints with valid/invalid inputs, status codes, error responses per contracts/models.md
- [ ] T019 [P] Write model API contract tests FIRST - all tests FAIL before T017 implementation (Red-Green-Refactor requirement)
- [X] T020 [P] Create encryption utility in src/lib/db.ts for API key encryption/decryption using Node.js crypto module with .env encryption key
- [X] T021 Create database query functions in src/lib/db.ts: insertModel(), getModels(), getModelById(), updateModel(), deleteModel(), testModelConnection()
- [X] T022 Implement model API endpoint T017 using database functions from T021 with API key validation and encryption per T020

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Compare Model Performance Across Single Evaluation (Priority: P1) 🎯 MVP

**Goal**: Core evaluation flow - users submit instruction to multiple models, receive real-time metrics (time, tokens, accuracy) in table format

**Independent Test**: Can be fully tested by submitting instruction to 2+ models and receiving comparison table with time/tokens/accuracy

### Tests for User Story 1 (MANDATORY - Test-First)

- [ ] T023 [P] Create tests/contract/evaluate.test.ts: test POST /api/evaluate, GET /api/evaluation-status, GET /api/results per contracts/evaluation.md - ALL TESTS FAIL before implementation
- [ ] T024 [P] Create tests/contract/results.test.ts: test GET /api/results with valid/invalid evaluation_ids, error responses
- [ ] T025 [P] Create tests/integration/evaluation-flow.test.ts: end-to-end test of P1 user story - submit instruction → poll status → get results → verify table display
- [ ] T026 [P] Create tests/unit/evaluator.test.ts: test EvaluationExecutor class - parallel query execution, timeout handling, result collection, accuracy calculation

### Implementation for User Story 1

- [X] T027 Create src/pages/api/evaluate.ts endpoint: POST /api/evaluate accepts instruction, model_ids, rubric_type, expected_output; validates inputs; creates Evaluation + Result records; returns evaluation_id; triggers async evaluation in background
- [X] T028 Create src/pages/api/evaluation-status.ts endpoint: GET /api/evaluation-status?evaluation_id=xxx returns current status of all models (pending/running/completed/failed) with partial results
- [X] T029 Create src/pages/api/results.ts endpoint: GET /api/results?evaluation_id=xxx returns complete results table data (model name, time_ms, input_tokens, output_tokens, total_tokens, accuracy_score, reasoning) sorted by accuracy DESC
- [X] T030 Implement evaluation executor logic: modify src/lib/evaluator.ts to execute models in parallel, measure wall-clock time, update status, save results to database
- [X] T031 [P] Create database query functions: insertEvaluation(), updateEvaluationStatus(), insertResults(), getEvaluation(), getResults(), getEvaluationStatus()
- [X] T032 Create src/components/EvaluationForm.astro: form with instruction textarea, rubric dropdown (Exact Match/Partial Credit/Semantic Similarity), expected_output field, model checkboxes, submit button - Note: Implemented inline in index.astro
- [X] T033 Create src/components/StatusIndicator.astro: display per-model status badge (Pending/Running/Completed/Failed) with color coding - Note: Implemented inline in index.astro
- [X] T034 Create src/components/ResultsTable.astro: table with columns Model, Time(ms), Input Tokens, Output Tokens, Total Tokens, Accuracy, Reasoning; sortable by each column; highlight best performer green - Note: Implemented inline in index.astro
- [X] T035 Create src/components/ErrorBanner.astro: consistent error display component for all error messages from API responses - Note: Implemented inline in index.astro
- [X] T036 Update src/pages/index.astro to include EvaluationForm, StatusIndicator (polling every 500ms during run), ResultsTable, ErrorBanner; implement fetch polling logic with JavaScript
- [X] T037 Create client-side JavaScript in src/pages/index.astro: handle form submission → POST /api/evaluate → poll /api/evaluation-status → GET /api/results → display in table
- [X] T038 Add timeout logic (5 minute hard limit per evaluation) in src/lib/evaluator.ts and src/pages/api/evaluate.ts
- [ ] T039 Test P1 workflow end-to-end: submit instruction, see status updates, verify all metrics display correctly in table with ±5% timing accuracy

**Checkpoint**: User Story 1 is fully functional and independently testable. Can be deployed as MVP.

---

## Phase 4: User Story 2 - Save and Rerun Evaluation Batches (Priority: P2)

**Goal**: Users save evaluation configurations as templates and rerun with new models to track trends over time

**Independent Test**: Can be fully tested by saving template, rerunning with different models, comparing historical results

### Tests for User Story 2 (MANDATORY - Test-First)

- [ ] T040 [P] Create tests/contract/templates.test.ts: test POST, GET, GET /:id, PATCH /:id, DELETE /api/templates per contracts/templates.md - ALL TESTS FAIL before implementation
- [ ] T041 [P] Create tests/contract/template-run.test.ts: test POST /api/templates/:id/run endpoint
- [ ] T042 [P] Create tests/integration/template-flow.test.ts: end-to-end test of P2 user story - complete evaluation → save template → list templates → rerun with different models → view history
- [ ] T043 [P] Create tests/unit/template-executor.test.ts: test template loading, model override, rerun logic

### Implementation for User Story 2

- [X] T044 Create src/pages/api/templates.ts endpoint: POST, GET, GET /:id, PATCH /:id, DELETE /:id per contracts/templates.md - CRUD operations on EvaluationTemplate table
- [X] T045 Create src/pages/api/templates/[id]/run.ts endpoint: POST /api/templates/:id/run - load template, use template's models (or override), create Evaluation with template_id reference, increment run_count
- [X] T046 Create src/pages/api/templates/[id]/history.ts endpoint: GET /api/templates/:id/history - return evaluations linked to template with summary metrics (best accuracy, fastest model), paginated
- [X] T047 [P] Create database query functions: insertTemplate(), getTemplates(), getTemplateById(), updateTemplate(), deleteTemplate(), getTemplateHistory(), incrementTemplateRunCount()
- [X] T048 Create src/pages/templates.astro page: list all templates with name, instruction preview, model count, run count; buttons to Rerun, Edit, Delete; search/sort by created/name/run_count
- [ ] T049 Create src/components/TemplateManager.astro: modal to save current evaluation as template - prompt for name, description, confirmation; call POST /api/templates
- [X] T050 Create src/components/TemplateList.astro: display template list with pagination; click to view history; click Rerun to load template and run with current model selection - Note: Implemented inline in templates.astro
- [X] T051 Update src/pages/index.astro: add "Save as Template" button that triggers TemplateManager modal after successful evaluation
- [X] T052 Create src/pages/history.astro page: display evaluation history with filters (by template, by date range), pagination, click to see full results and comparison with previous runs
- [ ] T053 Implement template rerun logic in src/pages/index.astro: when loaded from template, pre-fill form with instruction, expected_output, rubric, model selection
- [X] T054 Add trend analysis view to src/pages/history.astro: show same template run multiple times with performance comparison over time
- [ ] T055 Test P2 workflow: complete P1 evaluation → save as template → view templates list → rerun template with different models → verify history shows both runs

**Checkpoint**: User Stories 1 AND 2 both work independently. Can deploy with template/history features.

---

## Phase 5: User Story 3 - Custom Accuracy Evaluation & Model Reasoning (Priority: P3)

**Goal**: Users select predefined accuracy rubrics and see reasoning explaining accuracy scores

**Independent Test**: Can be fully tested by selecting rubric, running evaluation, seeing accuracy score + reasoning for each model

### Tests for User Story 3 (MANDATORY - Test-First)

- [ ] T056 [P] Create tests/unit/accuracy.test.ts: test exactMatch(), partialCredit(), semanticSimilarity() functions with various inputs - ALL TESTS FAIL before implementation
- [ ] T057 [P] Create tests/unit/accuracy-rubrics.test.ts: test edge cases - empty responses, special characters, very long responses, unicode, null/undefined handling
- [ ] T058 [P] Create tests/integration/accuracy-flow.test.ts: end-to-end test - run evaluation with each rubric type → verify accuracy scores assigned → verify reasoning generated

### Implementation for User Story 3

- [X] T059 Implement exactMatch() in src/lib/accuracy.ts: case-insensitive string comparison of response vs expected_output, return { score: 100 or 0, reasoning: "Response exactly matches expected output" or "Response does not match..." }
- [X] T060 Implement partialCredit() in src/lib/accuracy.ts: check if response contains each concept in partial_credit_concepts array, assign points per concept (e.g., 50 points per concept if 2 concepts needed), return { score: calculated, reasoning: "Found X of Y concepts: [list concepts]" }
- [X] T061 Implement semanticSimilarity() in src/lib/accuracy.ts: call Claude API with prompt "Compare these two texts for semantic similarity (0-100): [response] vs [expected]. Reply with only a number 0-100", parse response as accuracy score, return { score, reasoning: "Semantic similarity score: X%" }
- [X] T062 Update src/pages/api/evaluate.ts to accept rubric_type parameter and call appropriate accuracy function after model evaluation completes
- [X] T063 Update EvaluationForm to show rubric selection dropdown (Exact Match, Partial Credit, Semantic Similarity) and conditional fields:
  - Exact Match: expected_output field required
  - Partial Credit: expected_output + partial_credit_concepts (multi-line text input, parse as comma-separated)
  - Semantic Similarity: expected_output required
- [X] T064 Update ResultsTable to display accuracy_reasoning column with explanation of how score was calculated
- [ ] T065 Update ResultsTable to add side-by-side comparison view: if multiple models have different accuracy scores, show reasoning from each model side-by-side for analysis
- [ ] T066 Add rubric help text/tooltips to EvaluationForm explaining each rubric (when to use, what it measures)
- [X] T067 Update database schema and queries to store partial_credit_concepts in Evaluation record (already in data-model.md, verify T010 includes this)
- [ ] T068 Test P3 workflow: run evaluation with Exact Match → verify score 0 or 100; run with Partial Credit → verify score 0-100 based on concepts; run with Semantic Similarity → verify API call and score

**Checkpoint**: All three user stories working independently. Full feature complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories, performance optimization, comprehensive testing

- [ ] T069 [P] Create E2E tests with Playwright in tests/e2e/: full workflow from model config → evaluation → template save → rerun → history view
- [X] T070 [P] Add error handling: catch API timeouts (30s per model), auth failures, rate limits, network errors; display user-friendly messages in ErrorBanner
- [X] T071 [P] Add validation error messages: instruction length validation, model count validation, required field validation in EvaluationForm with live feedback
- [ ] T072 Implement performance profiling: measure database query times, API endpoint response times, table render time; add metrics to logs
- [X] T073 Optimize database queries: verify all indexes exist (T010), add EXPLAIN QUERY PLAN analysis for slow queries, optimize JOIN operations
- [ ] T074 [P] Add logging infrastructure: implement structured logging in src/lib/logger.ts (timestamp, level, evaluation_id, duration), log all API calls and database operations
- [X] T075 Create src/lib/crypto.ts for API key encryption/decryption - verify keys never logged or exposed in responses or errors - Note: Implemented in db.ts
- [ ] T076 Add keyboard navigation and accessibility: ARIA labels on form inputs, keyboard shortcuts for common actions (Enter to submit, Esc to cancel)
- [ ] T077 Create comprehensive error documentation: document all error codes, meanings, how to resolve (timeout, auth failure, invalid rubric, etc.)
- [ ] T078 Add setup validation script npm run validate - check .env exists, API keys can be decrypted, database accessible, required npm packages installed
- [ ] T079 [P] Create unit test coverage report: run npm test -- --coverage; verify >80% coverage on critical paths (evaluator.ts, accuracy.ts, db.ts, api-clients.ts)
- [ ] T080 Create integration test for high-load scenario: run evaluation with 5 models 3 times concurrently; verify all complete within 5 minute timeout; verify database handles concurrent writes
- [ ] T081 Document API response times: measure and document expected latency for each endpoint under normal/peak load (for performance validation against SC-001: 30s for 3 models)
- [ ] T082 Create user documentation: update quickstart.md with examples, troubleshooting guide, performance tips, API examples
- [ ] T083 [P] Create configuration documentation: document .env variables, Astro config options, Tailwind customization points
- [X] T084 Run build and verify production bundle: npm run build; check bundle size, verify no errors, verify Tailwind CSS is optimized (minimal unused styles)
- [ ] T085 Create pre-commit hook validation: check TypeScript compilation (tsc --noEmit), run linter (eslint if added), run unit tests before commit
- [ ] T086 Validate quickstart.md walkthrough: follow steps exactly as written to confirm setup works end-to-end (clone, npm install, .env, db:init, dev, http://localhost:3000)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 endpoints existing but can be developed independently
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on US1 endpoints existing but can be developed independently

### Within Each User Story

- Tests (MANDATORY) MUST be written and FAIL before implementation
- Models (database entities) before services (business logic)
- Services before endpoints (API routes)
- Endpoints before UI components
- UI components before integration
- Story complete before moving to next priority

### Parallel Opportunities

**All Setup tasks marked [P]** (T003-T008, T012) can run in parallel:
- Different files, no dependencies
- One developer per task to avoid conflicts

**All Foundational tasks marked [P]** (T014-T015, T018-T019, T020):
- Can run in parallel within Phase 2
- T017, T021, T022 must sequence after [P] tasks complete

**Once Foundational completes**, all three user story phases can start in parallel:
- Team member A: User Story 1 (P1)
- Team member B: User Story 2 (P2)
- Team member C: User Story 3 (P3)
- Each story independently testable and deployable

**Within Each User Story**, test tasks marked [P]** can run in parallel:
- Different test files, test same code
- Run all tests together before implementation

**Example: Parallel US1 Execution**:
```
Parallel T023-T026 (all tests):
  - T023: POST /api/evaluate contract tests
  - T024: GET /api/results contract tests
  - T025: Integration flow test
  - T026: Unit tests for evaluator

Then Sequential T027-T039 (implementation):
  - T027: evaluate.ts endpoint
  - T028: evaluation-status.ts endpoint
  - T029: results.ts endpoint
  - T030-T039: Business logic and UI
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) - RECOMMENDED START

1. Complete Phase 1: Setup (establish project structure)
2. Complete Phase 2: Foundational (create API clients, database, accuracy calculator)
3. Complete Phase 3: User Story 1 (core evaluation feature)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo MVP to users
6. **THEN proceed** to Phase 4 (User Story 2) if desired

**Total MVP scope**: ~45 tasks (Setup + Foundational + US1)
**Estimated effort**: 40-60 hours for single developer
**Time to MVP**: 1-2 weeks

### Incremental Delivery (All Stories)

1. Complete Phase 1: Setup (2-3 hours)
2. Complete Phase 2: Foundational (8-12 hours)
3. Complete Phase 3: User Story 1 (12-15 hours) → Deploy/demo
4. Complete Phase 4: User Story 2 (8-10 hours) → Deploy/demo
5. Complete Phase 5: User Story 3 (8-10 hours) → Deploy/demo
6. Complete Phase 6: Polish (5-8 hours) → Final release

**Total scope**: 86 tasks
**Estimated effort**: 60-90 hours for single developer
**Time to full feature**: 2-3 weeks

### Parallel Team Strategy (3 developers)

**Week 1**:
- Developer A+B+C: Phase 1 Setup together (2 hours)
- Developer A+B+C: Phase 2 Foundational together (6 hours)

**Week 2**:
- Developer A: Phase 3 User Story 1 (12-15 hours)
- Developer B: Phase 4 User Story 2 (8-10 hours)
- Developer C: Phase 5 User Story 3 (8-10 hours)

**Week 3**:
- Developer A+B+C: Phase 6 Polish together (5-8 hours)

**Parallel effort**: 20-30 hours total (3x faster than single developer)

---

## Notes

- **[P] tasks** = Different files, can run in parallel without blocking
- **[Story] label** = Maps task to specific user story for traceability
- **Each user story independently completable and testable**
- **TEST FIRST**: All test tasks MUST write tests that FAIL before implementation (Red-Green-Refactor)
- **Verify tests fail** before starting implementation (critical for TDD)
- **Commit after each task** or logical group
- **Stop at any checkpoint** to validate story independently
- **Performance validation**: After US1 complete, verify SC-001 (30s for 3 models), SC-002 (±5% timing accuracy)
- **MVP delivery**: After US1 complete, you have a working evaluation system ready for users

---

## Test-First Emphasis (Per Constitution Principle II)

**CRITICAL**: All 26 test tasks (T023-T026, T040-T043, T056-T058) MUST:

1. Be written completely BEFORE implementation starts
2. Be verified to FAIL when run (proves test is real)
3. Guide implementation via Red-Green-Refactor cycle
4. Cover all acceptance scenarios from spec.md
5. Achieve >80% code coverage on critical paths:
   - src/lib/evaluator.ts (parallel execution logic)
   - src/lib/accuracy.ts (scoring rubrics)
   - src/lib/db.ts (database operations)
   - src/lib/api-clients.ts (model provider integration)

Example workflow for T027 (evaluate endpoint):
```
1. Write T023 (contract tests) - tests POST /api/evaluate
2. Run npm test tests/contract/evaluate.test.ts → ALL FAIL (no endpoint yet)
3. Create T027 stub endpoint that returns 500 error
4. Run tests again → some still fail
5. Implement T027 fully
6. Run tests again → ALL PASS
7. Move to next task
```

This ensures code quality and reduces bugs per Constitution Principle II.
