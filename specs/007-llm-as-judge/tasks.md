# Implementation Tasks: LLM-as-a-Judge System

**Branch**: `007-llm-as-judge` | **Date**: 2025-12-26 | **Total Tasks**: 116
**Implementation Strategy**: Test-first (TDD). Phase 1 (MVP) focuses on User Stories 1-3; Phases 2-4 add P2 and P3 features.

**Note**: Each task is independently actionable. Tasks marked [P] can execute in parallel with other [P] tasks in the same phase (no file conflicts, no blocking dependencies).

---

## Phase 1: Setup & Infrastructure

*Setup foundational project structure, database schema, and shared utilities*

**Phase Goal**: Initialize project structure and create database schema for all training-related tables

**Independent Test Criteria**:
- Database initializes with all 9 new tables created (personas, training_pairs, training_iterations, judge_decisions, human_reviews, iteration_metrics, judge_prompt_versions, training_loop_state, training_loop_checkpoints)
- Project structure matches plan.md (src/lib/ modules, src/pages/, tests/)
- TypeScript compilation succeeds with no errors
- Shared utilities (database connection, type definitions) are available for all user story tasks

---

### Setup Tasks

- [X] T001 [P] Create database schema file db/migrations/001-add-judge-training-tables.sql with all 9 tables from data-model.md
- [X] T002 [P] Create TypeScript types file src/types/training.ts with interfaces: Persona, TrainingPair, TrainingIteration, JudgeDecision, HumanReview, IterationMetrics, TrainingLoopState
- [X] T003 [P] Create database initialization script src/lib/persona-db.ts with connection helper and transaction utilities for training-related tables
- [X] T004 [P] Create test setup file tests/setup.ts with database fixtures for personas, training pairs, and iterations
- [X] T005 Create API error types file src/lib/training-errors.ts with: ModelSeparationError, CSVValidationError, TrainingStateError, MetricsCalculationError

**Acceptance Criteria**:
- All 9 tables exist in SQLite schema with correct columns and constraints
- Types compile without errors and match data-model.md entity definitions
- Database connection works with better-sqlite3; can insert/query test data
- Error types are exported and usable in API layers

---

## Phase 2: Foundational (Critical Path)

*Implement core modules that all user stories depend on*

**Phase Goal**: Build foundation modules (metrics calculation, model validation, database access) that enable all user stories

**Independent Test Criteria**:
- Metrics calculation handles edge cases (zero division, all-correct evaluations, empty datasets)
- Model separation validation enforces provider diversification at API level
- Database access layer (persona-db.ts) provides CRUD for all core tables with transaction support
- All foundational modules have >80% unit test coverage

---

### Metrics Calculation Module (Critical Path)

- [X] T006 [P] Create test file tests/unit/metrics.test.ts with tests for confusion matrix, F1, precision, recall, Cohen's Kappa calculations
- [X] T007 Create src/lib/metrics.ts implementing ConfusionMatrix interface and calculateMetrics() function with:
  - buildConfusionMatrix(judgeAgreements, humanAgreements) → TP/TN/FP/FN
  - calculateMetrics(cm) → {precision, recall, f1_score, cohens_kappa, accuracy, confusion_matrix}
  - Edge case handling: division by zero, empty datasets, all-correct scenarios

- [X] T008 [P] Create test file tests/unit/metrics-edge-cases.test.ts covering:
  - Empty confusion matrix (all zeros)
  - All true positives (100% agreement)
  - All false positives (no ground truth matches)
  - Single-element dataset

- [ ] T009 Create metrics-worker.ts as Worker Thread for CPU-intensive calculations (optional; fallback to main thread if not needed for MVP)

**Acceptance Criteria**:
- All metrics formulas calculate correctly (verified against scikit-learn reference)
- Cohen's Kappa ranges -1 to 1 correctly
- Edge cases return 0 instead of NaN/Infinity
- >80% code coverage

---

### Model Separation Validation

- [X] T010 [P] Create test file tests/unit/model-separation-validator.test.ts with tests for:
  - Validation passes when task, judge, engineer models are from different providers
  - Validation fails when any two models share same provider
  - Clear error messages for validation failures

- [X] T011 Create src/lib/model-separation-validator.ts implementing:
  - validateModelSeparation(config) → ValidationResult {isValid, errors, warnings, models}
  - Fetch model configs from DB; extract providers
  - Verify exactly 3 different providers
  - Check models are active (not deleted)

- [X] T012 [P] Create test file tests/integration/model-separation-validator.test.ts with database integration tests

**Acceptance Criteria**:
- Validation enforces strict 3-provider separation per spec clarification Q3
- Clear error messages help users understand violations
- Integration tests verify database constraints work
- >80% code coverage

---

### Database Access Layer for Training

- [X] T013 [P] Create test file tests/unit/persona-db.test.ts with CRUD operations for personas

- [X] T014 Create src/lib/persona-db.ts implementing (complete database access layer):
  - createPersona(name, description, taskPrompt, taskModelId, judgeModelId, promptEngineerModelId) → Persona
  - getPersona(id) → Persona | null
  - listPersonas(status?) → Persona[]
  - updatePersona(id, updates) → Persona
  - deletePersona(id) → void
  - + Similar for TrainingPair, TrainingIteration, JudgeDecision, HumanReview, IterationMetrics

- [X] T015 [P] Create test file tests/integration/persona-db.test.ts with transaction and cascade delete tests

**Acceptance Criteria**:
- All CRUD operations work correctly
- Transactions ensure atomicity (all-or-nothing)
- Cascade deletes work (deleting persona deletes pairs/iterations/decisions)
- FK constraints prevent orphaned records
- >80% code coverage

---

### State Management for Training Loop

- [X] T016 [P] Create test file tests/unit/training-state.test.ts with checkpoint save/resume tests

- [X] T017 Create src/lib/training-state.ts implementing TrainingStateManager class:
  - saveCheckpoint(sessionId, iteration, checkpoint) → void (ACID transaction)
  - pause(sessionId, reason) → void
  - resume(sessionId) → CheckpointData | null
  - verifyCheckpointIntegrity(sessionId) → boolean

- [X] T018 [P] Create test file tests/integration/training-state.test.ts with simulated crash recovery scenarios

**Acceptance Criteria**:
- Checkpoints saved atomically (no partial saves)
- Pause halts iteration; resume continues from checkpoint
- All state persisted across process restarts
- >80% code coverage

---

## Phase 3: User Story 1 - Create and Configure a Judge Persona (P1)

*User can create a new persona with task description, initial judge prompt, and model selections*

**Phase Goal**: Implement complete persona creation workflow (CRUD + validation)

**Independent Test Criteria**:
- User can create persona via API with task name, description, and model IDs
- Model separation is validated (must be different providers)
- Persona appears in list and detail pages
- Validation errors for missing required fields or invalid models
- E2E test: create persona → view details → verify all fields saved correctly

---

### Database Models & Validation

- [X] T019 [P] Create test file tests/unit/persona-validator.test.ts for persona creation validation

- [X] T020 Create src/lib/persona-validator.ts implementing:
  - validatePersonaCreation(input) → ValidationResult
  - Check required fields (name, task_description, initial_judge_prompt, model IDs)
  - Verify persona name is unique
  - Verify model IDs exist and are from different providers (via model-separation-validator)
  - Suggest error messages for each validation failure

**Acceptance Criteria**:
- Validates all required fields
- Checks uniqueness of persona names
- Integrates model separation validation
- Clear, actionable error messages
- >80% code coverage

---

### API Endpoints

- [X] T021 [P] Create test file tests/integration/personas-api.test.ts for CRUD endpoints

- [X] T022 Create src/pages/api/personas/index.ts implementing:
  - POST /api/personas: Create new persona
    - Accept: {name, description, task_prompt, task_model_id, judge_model_id, prompt_engineer_model_id}
    - Validate via persona-validator
    - Return 201 with created persona or 400 with errors
  - GET /api/personas: List all personas with optional filtering by status

- [X] T023 Create src/pages/api/personas/[id].ts implementing:
  - GET /api/personas/[id]: Fetch specific persona with all details
  - PUT /api/personas/[id]: Update persona name/description
  - DELETE /api/personas/[id]: Delete persona (cascade deletes training data)

- [X] T024 Create src/pages/api/training/validate-models.ts implementing:
  - POST /api/training/validate-models: Validate model separation before creating persona

**Acceptance Criteria**:
- All endpoints return correct HTTP status codes
- Error responses include helpful messages
- Model validation blocks invalid combinations
- Cascade delete works correctly
- >80% integration test coverage

---

### UI Pages

- [ ] T025 [P] Create test file tests/e2e/persona-creation.test.ts for end-to-end persona creation

- [X] T026 Create src/pages/personas.astro implementing:
  - Display list of all personas as cards (PersonaCard component)
  - Show status badge (draft/training/trained/incomplete)
  - Display F1 score and iteration count for trained personas
  - "Create New Persona" button
  - Filter by status dropdown

- [X] T027 Create src/pages/personas/[id]/index.astro implementing:
  - Persona detail page with tabs: Overview, Training Data, Training Progress, Judge Prompts, Settings
  - Overview tab: Name, description, models selected, status, created date
  - Settings tab: Allow editing task name/description
  - Action buttons: Start Training, Delete, Export (Phase 3)

- [X] T028 [P] Create src/components/PersonaCard.astro as summary card for persona list (name, status, F1, iteration count, action menu)

**Acceptance Criteria**:
- Persona list displays all personas correctly
- Create button opens form modal (or new page)
- Form validates all required fields
- Submit saves to API and redirects to detail page
- Detail page loads and displays all persona info correctly
- Edit functionality updates persona
- Delete confirmation dialog works

---

### Integration & E2E Tests

- [ ] T029 Create end-to-end test tests/e2e/persona-creation.test.ts covering:
  - Navigate to personas list
  - Click "Create New Persona"
  - Fill form with valid inputs (task name, description, select models)
  - Submit form
  - Verify persona appears in list
  - Click persona to view details
  - Verify all fields displayed correctly

**Acceptance Criteria**:
- E2E test passes for complete persona creation workflow
- All validation messages display correctly
- Form submission succeeds and persists data
- Model validation works in real API call

---

## Phase 4: User Story 2 - Upload Training Data (P1)

*User can upload CSV file with input/expected_output pairs and view imported data*

**Phase Goal**: Implement CSV parsing, validation, and storage of training pairs

**Independent Test Criteria**:
- CSV file with correct columns (input, expected_output) parses successfully
- System validates 10-200 pairs constraint
- Training pairs appear in data list with input/output displayed
- Invalid CSV (wrong columns, empty fields) shows clear error messages
- E2E test: upload CSV → view training data → verify all pairs present

---

### CSV Parsing & Validation

- [X] T030 [P] Create test file tests/unit/csv-parser.test.ts for CSV validation and parsing

- [X] T031 Create src/lib/csv-parser.ts implementing:
  - parseCSV(fileContent) → {rows: Array<{input, expected_output}>, errors: string[]}
  - Validate columns (accept both "input"/"expected_output" AND "Input A"/"Correct Output" for user flexibility per A-016)
  - Normalize all column names to "input"/"expected_output" internally
  - Validate row count (10-200 pairs minimum/maximum per spec clarification Q4)
  - Trim whitespace; validate non-empty input and output
  - Detect duplicates and report

- [X] T032 [P] Create test file tests/unit/csv-parser-edge-cases.test.ts covering:
  - Missing columns
  - Wrong column names (case sensitivity)
  - Flexible column names: test both "input"/"expected_output" AND "Input A"/"Correct Output" normalize correctly
  - Fewer than 10 pairs
  - More than 200 pairs
  - Empty input or output fields
  - Duplicate pairs

**Acceptance Criteria**:
- Parses well-formed CSV correctly
- Enforces 10-200 pair constraint
- Clear error messages for invalid CSVs
- Reports duplicate detection
- >80% code coverage

---

### API Endpoints

- [X] T033 [P] Create test file tests/integration/training-data-upload.test.ts for upload endpoint

- [X] T034 Create src/pages/api/personas/[id]/training/upload.ts implementing:
  - POST /api/personas/[id]/training/upload: Upload CSV file
  - Accept multipart/form-data with file
  - Parse CSV via csv-parser
  - Validate persona exists
  - Insert training pairs to database
  - Return 201 with count of pairs inserted or 400 with error details

- [X] T035 Create src/pages/api/personas/[id]/training/pairs.ts implementing:
  - GET /api/personas/[id]/training/pairs: List all training pairs for a persona
  - Return paginated list with input/output preview

**Acceptance Criteria**:
- Upload endpoint accepts CSV files
- Validates and parses correctly
- Stores pairs in database
- List endpoint returns all pairs with correct data
- >80% integration test coverage

---

### UI Components & Pages

- [ ] T036 [P] Create test file tests/e2e/training-data-upload.test.ts for upload workflow

- [X] T037 Create src/components/CSVUploader.astro implementing:
  - Drag-drop zone for CSV file
  - File size/type validation
  - Upload progress indicator
  - Error message display
  - Success message with pair count

- [X] T038 Create src/pages/personas/[id]/training/index.astro (Training Data tab) implementing:
  - Display uploaded training pairs in table (input, expected_output)
  - "Upload New Data" button
  - Pair count display (X of Y)
  - Pair search/filter by input text

- [X] T039 [P] Create test file tests/integration/training-data-display.test.ts

**Acceptance Criteria**:
- CSV uploader displays file input
- Drag-drop works for file selection
- Upload sends file to API
- Success message shows pair count
- Training pairs display in table correctly
- All pairs uploaded are visible in list

---

### Integration & E2E Tests

- [X] T040 Create end-to-end test tests/e2e/training-data-upload.test.ts covering:
  - Create persona (prerequisite)
  - Navigate to training data tab
  - Drag-drop CSV file (or use file picker)
  - Verify success message
  - Verify all pairs appear in table

**Acceptance Criteria**:
- E2E test passes for complete upload workflow
- CSV validation works in real API call
- Training pairs persisted and retrievable

---

## Phase 5: User Story 3 - Execute Automated Training Iteration (P1)

*System runs iteration cycle: generate outputs → judge → collect feedback → calculate metrics*

**Phase Goal**: Implement complete training iteration orchestration and metrics calculation

**Independent Test Criteria**:
- Can start training iteration for a persona with training data
- System generates outputs for each pair using Task Model
- Judge evaluates each output using Judge Model
- Human can provide Agree/Disagree feedback on judge decisions
- Metrics (F1, precision, recall, Cohen's Kappa) calculate correctly
- E2E test: start iteration → provide feedback → verify metrics calculated

---

### Training Loop Orchestration

- [X] T041 [P] Create test file tests/unit/training-loop.test.ts for iteration orchestration

- [X] T042 Create src/lib/training-loop.ts implementing IterativeTrainingLoop class:
  - execute(taskResultIds) → Promise<void> (fire-and-forget, persists state)
  - evaluateWithJudge(taskResultIds) → judge outputs and store judge_decisions
  - calculateMetricsInWorker(judgeResults) → MetricsResult
  - sessionId property for tracking
  - pause() method to pause training

- [X] T043 [P] Create test file tests/integration/training-loop-flow.test.ts with simulated iteration flow

**Acceptance Criteria**:
- Iteration loop runs complete cycle: judge → feedback → metrics
- State persisted to database after each step
- Metrics calculated correctly from feedback
- Can pause iteration (state saved)
- >80% code coverage

---

### Judge Evaluation Module

- [X] T044 [P] Create test file tests/unit/judge-evaluator.test.ts for judge decision parsing

- [X] T045 Create src/lib/judge-evaluator.ts implementing:
  - evaluateOutput(input, correctOutput, suggestedOutput, judgePrompt, judgeModel) → JudgeDecisionResult
  - Call judge model with formatted prompt
  - Parse JSON response: {decision: "agree"|"disagree", confidence: 0.0-1.0, reasoning: string}
  - Handle parsing errors gracefully
  - Store decision to database

- [X] T046 [P] Create test file tests/integration/judge-api-calls.test.ts with mock API client tests

**Acceptance Criteria**:
- Correctly formats judge prompt with input/output/criteria
- Calls correct judge model via API client
- Parses judge response correctly
- Handles malformed JSON response
- Stores judge decision with reasoning
- >80% code coverage

---

### Human Review Interface

- [ ] T047 [P] Create test file tests/e2e/human-review.test.ts for decision review workflow

- [X] T048 Create src/pages/api/personas/[id]/iterations/[num]/decisions.ts implementing:
  - GET /api/personas/[id]/iterations/[num]/decisions: Fetch all judge decisions awaiting human review
  - Return: {input, expected_output, suggested_output, judge_decision, judge_reasoning, decision_id}

- [X] T049 Create src/pages/api/personas/[id]/iterations/[num]/feedback.ts implementing:
  - POST /api/personas/[id]/iterations/[num]/feedback: Submit human review feedback
  - Accept: {decision_id, human_decision: "agree"|"disagree", notes?: string}
  - Store HumanReview record
  - Return 201 with stored feedback
  - Constraint (per FR-007, A-012): Feedback is REQUIRED on all decisions in iteration; return 400 if any decisions remain without feedback after submission (incomplete feedback must be completed before proceeding)

- [X] T050 Create src/pages/personas/[id]/review/[iteration].astro implementing:
  - Split view: left side shows decision, right side shows feedback form
  - Display: input, expected_output, suggested_output, judge_decision, judge_reasoning
  - Buttons: "Agree with Judge" / "Disagree with Judge"
  - Optional notes textarea
  - Progress: "X of Y decisions reviewed"
  - Previous/Next navigation between decisions

- [X] T051 [P] Create src/components/JudgeDecisionReview.astro as reusable decision card component

**Acceptance Criteria**:
- Decisions fetch correctly from API
- Agree/Disagree buttons submit feedback to API
- Feedback persisted to database
- Progress indicator shows review status
- Navigation works (previous/next decisions)

**Phase 2 Enhancement** (per A-014): Add batch action buttons ("Agree with All", "Review Later", "Skip to Next") in Phase 2 to reduce review friction for iterations with 50-200 decisions. MVP Phase 1 focuses on individual decision review with Previous/Next navigation only.

---

### Metrics Calculation & Storage

- [X] T052 [P] Create test file tests/integration/metrics-calculation.test.ts with full metrics flow

- [X] T053 Create src/lib/metrics-orchestrator.ts implementing:
  - calculateIterationMetrics(iterationId) → MetricsResult
  - Constraint (per FR-008, A-012): Verify all judge_decisions have human_reviews before calculating; throw error if any decisions lack feedback
  - Fetch all judge_decisions and human_reviews for iteration
  - Extract judge agreements (true if judge_decision='agree') and human agreements (human_decision='agree')
  - Call calculateMetrics(confusionMatrix) from metrics.ts
  - Store to iteration_metrics table
  - Update persona with best_f1_score if improved

**Acceptance Criteria**:
- Metrics calculate from agree/disagree feedback correctly
- Metrics stored with iteration_id FK
- Persona best_f1_score updates if improved
- >80% code coverage

---

### API Integration

- [X] T054 [P] Create test file tests/integration/iteration-api.test.ts for full iteration endpoints

- [X] T055 Create src/pages/api/personas/[id]/training/start.ts implementing:
  - POST /api/personas/[id]/training/start: Start new training iteration
  - Create training_iteration record
  - Start IterativeTrainingLoop.execute() (fire-and-forget)
  - Return 202 with session_id and training_iteration record

- [X] T056 Create src/pages/api/personas/[id]/training/status.ts implementing:
  - GET /api/personas/[id]/training/status: Get current training status
  - Return latest iteration with metrics and human review count

**Acceptance Criteria**:
- Start iteration creates database record
- Status endpoint returns correct iteration state
- Returns 202 for async operations
- Metrics available after feedback provided

---

### UI Pages & Components

- [X] T057 [P] Create src/components/MetricCard.astro for displaying single metric with trend

- [X] T058 Create src/components/ConfusionMatrix.astro for 2x2 visual grid (TP/TN/FP/FN)

- [X] T059 Create training progress UI (implemented as src/pages/personas/[id]/metrics.astro and src/components/TrainingProgress.astro):
  - Show current iteration number and status
  - Display: F1 Score, Precision, Recall, Cohen's Kappa metrics
  - Show confusion matrix visualization
  - Progress bar: "X of Y iterations completed"
  - "Start Training" button (if not started)
  - "Review Decisions" button (if awaiting human review)
  - Note: Implemented as dedicated metrics page rather than replacing training data page at /training/index.astro

**Acceptance Criteria**:
- Metrics display correctly with proper formatting
- Confusion matrix visualizes TP/TN/FP/FN
- Buttons navigate to correct pages
- Real-time updates when metrics change

---

### Integration & E2E Tests

- [ ] T060 Create end-to-end test tests/e2e/training-iteration.test.ts covering:
  - Create persona and upload training data (prerequisites)
  - Click "Start Training" button
  - Wait for iteration to generate outputs and judge them
  - Verify "Review Decisions" button appears
  - Navigate to review page
  - Provide feedback on 50-200 decisions (simplified: just click Agree/Disagree for each)
  - Verify metrics display after feedback complete

**Acceptance Criteria**:
- E2E test passes for complete training iteration
- Outputs generated successfully
- Judge evaluates correctly
- Feedback interface works
- Metrics calculated and displayed

---

## Phase 6: User Story 4 - AI-Assisted Judge Prompt Refinement (P2)

*System automatically refines judge prompt based on failure analysis*

**Phase Goal**: Implement LLM-based prompt refinement after each iteration

**Independent Test Criteria**:
- After iteration with feedback, system analyzes false positives and false negatives
- Prompt Engineer Model generates improved judge prompt with explanation
- User can accept refined prompt or provide manual feedback
- Next iteration uses refined prompt
- E2E test: complete iteration → receive refined prompt → accept → start next iteration with new prompt

---

### Failure Analysis & Context Building

- [X] T061 [P] Create test file tests/unit/failure-analysis.test.ts for analyzing iteration failures

- [X] T062 Create src/lib/failure-analysis.ts implementing:
  - analyzeIterationFailures(iterationId) → FailureAnalysisContext
  - Extract false positives: judge agreed but human disagreed
  - Extract false negatives: judge disagreed but human agreed
  - Limit to 5 examples each (for token efficiency)
  - Extract correct examples: judge matched human
  - Return context object with examples, current metrics, and task description

**Acceptance Criteria**:
- Correctly identifies FP and FN examples from judge/human decisions
- Extracts correct examples for few-shot learning
- Limits examples to reasonable count (5 each)
- >80% code coverage

---

### Prompt Refinement via LLM

- [X] T063 [P] Create test file tests/integration/prompt-refinement.test.ts with LLM mock

- [X] T064 Create src/lib/prompt-engineer.ts implementing:
  - refineJudgePrompt(failureContext, promptEngineerModel) → {improved_prompt, rationale, expected_impact}
  - Build detailed context prompt with metrics, failure patterns, correct examples
  - Call Prompt Engineer Model with chain-of-thought instructions
  - Parse JSON response
  - Handle LLM failures gracefully (return improved_prompt = null to fall back to manual refinement)

- [X] T065 [P] Create test file tests/unit/prompt-engineer-edge-cases.test.ts for LLM response parsing

**Acceptance Criteria**:
- Builds comprehensive failure context from iteration data
- Calls LLM with clear instructions
- Parses JSON response correctly
- Provides rationale for changes
- >80% code coverage

---

### Prompt Version Management

- [X] T066 [P] Create test file tests/unit/prompt-version-manager.test.ts for version tracking

- [X] T067 Create src/lib/prompt-version-manager.ts implementing:
  - storePromptVersion(personaId, iterationNumber, promptText, rationale, createdBy)
  - Only store if prompt significantly changed (not just formatting)
  - Compare with previous prompt; skip if identical
  - getPromptHistory(personaId) → Array<JudgePromptVersion>
  - getPromptDiff(version1Id, version2Id) → {before, after, changes}

**Acceptance Criteria**:
- Stores only significant prompt changes (no formatting changes)
- Tracks which version was user-created vs AI-created
- Can compare versions
- >80% code coverage

---

### API Endpoints

- [X] T068 [P] Create test file tests/integration/prompt-refinement-api.test.ts

- [X] T069 Create src/pages/api/personas/[id]/iterations/[num]/refine-prompt.ts implementing:
  - POST /api/personas/[id]/iterations/[num]/refine-prompt: Trigger prompt refinement
  - Call failure-analysis.analyzeIterationFailures()
  - Call prompt-engineer.refineJudgePrompt()
  - Return: {improved_prompt, rationale, expected_impact} or {error} if LLM fails

- [X] T070 Create src/pages/api/personas/[id]/iterations/[num]/accept-prompt.ts implementing:
  - POST /api/personas/[id]/iterations/[num]/accept-prompt: Accept refined prompt for next iteration
  - Accept: {prompt_text, reason: "ai-generated"|"manual-edit"}
  - Store via prompt-version-manager
  - Update persona's judge prompt for next iteration

**Acceptance Criteria**:
- Refine endpoint calls LLM and returns improved prompt
- Accept endpoint stores version and updates persona
- Works even if LLM refinement fails (fallback to manual)
- >80% integration test coverage

---

### UI Components & Pages

- [X] T071 Create src/pages/personas/[id]/judge-prompts.astro implementing:
  - Display judge prompt version history
  - Show which version was "ai-generated" vs "manual"
  - Show iteration number for each version
  - "View Diff" button to compare versions

- [X] T072 Create src/components/PromptDiffViewer.astro for side-by-side prompt comparison

- [X] T073 Create src/pages/personas/[id]/refine-prompt.astro implementing:
  - After iteration completes: show AI-generated refined prompt suggestion
  - Display current metrics and failure analysis
  - "Accept" button to use refined prompt
  - "Edit" button to manually adjust prompt
  - "Skip" button to use current prompt again

**Acceptance Criteria**:
- Shows refined prompt with rationale
- Accept button applies prompt for next iteration
- Diff viewer compares old vs new versions
- Manual editing possible

---

## Phase 7: User Story 5 - Track Training Progress and Metrics (P2)

*Dashboard displays real-time metrics and convergence status*

**Phase Goal**: Implement training progress dashboard with metrics visualization and convergence tracking

**Independent Test Criteria**:
- Dashboard loads and displays latest metrics from all iterations
- Chart shows F1/precision/recall trends over iterations
- Real-time updates when new iteration metrics calculated
- Success indicator appears when F1 ≥ 0.80
- Hovering over data point shows detailed metrics
- E2E test: complete multiple iterations → verify dashboard updates with all metrics

---

### Dashboard Data API

- [ ] T074 [P] Create test file tests/integration/dashboard-api.test.ts

- [ ] T075 Create src/pages/api/personas/[id]/dashboard.ts implementing:
  - GET /api/personas/[id]/dashboard: Fetch all data for dashboard
  - Return: {persona, iterations: [{iteration_num, metrics, timestamp}], convergence_achieved, current_iteration_status}

- [ ] T076 Create src/pages/api/personas/[id]/metrics.ts implementing:
  - GET /api/personas/[id]/metrics: Fetch just metrics data for chart
  - Return: Array<{iteration, f1_score, precision, recall, cohens_kappa, timestamp}>

**Acceptance Criteria**:
- Endpoints return correct data structure
- Data includes all metrics from all iterations
- Sorted by iteration number
- >80% integration test coverage

---

### UI Dashboard Component

- [ ] T077 Create src/components/TrainingDashboard.astro implementing:
  - Metric cards: F1 Score (primary), Precision, Recall, Cohen's Kappa (with trend arrows)
  - Line chart: F1 and Cohen's Kappa trends over iterations
  - Convergence indicator: "Target F1 (0.80) achieved in iteration X"
  - Current iteration status: "Iteration 5/20 in progress" or "Iteration 3/20 awaiting review"
  - Confusion matrix visualization for latest iteration

- [ ] T078 Create src/components/MetricsChart.astro for line chart (F1/Kappa over iterations)

- [ ] T079 Create src/pages/personas/[id]/training/index.astro (update existing to include dashboard)
  - Embed TrainingDashboard component
  - Auto-refresh metrics every 5 seconds (or use WebSocket)

**Acceptance Criteria**:
- Dashboard renders all metric cards correctly
- Chart displays trends accurately
- Convergence indicator shows when F1 ≥ 0.80
- Metric cards show trend (↑ ↓ →)
- Responsive design works on mobile

---

### Real-Time Updates (Optional for MVP)

- [ ] T080 [P] Create WebSocket handler (optional; polling fallback acceptable for MVP)

**Acceptance Criteria**:
- Dashboard updates when new metrics available (either polling or WebSocket)
- <2 second latency per spec success criterion SC-006

---

### Integration & E2E Tests

- [ ] T081 Create end-to-end test tests/e2e/training-dashboard.test.ts covering:
  - Complete multiple iterations (3-5)
  - Wait for metrics calculation
  - Navigate to training progress dashboard
  - Verify all metric cards display correct values
  - Verify chart shows trend lines
  - If F1 ≥ 0.80 after iteration: verify convergence indicator appears

**Acceptance Criteria**:
- E2E test passes for complete dashboard workflow
- Metrics display correctly after each iteration
- Chart updates with new data points

---

## Phase 8: User Story 6 - Pause and Resume Training (P3)

*User can pause training and resume later without data loss*

**Phase Goal**: Implement pause/resume functionality with state persistence

**Independent Test Criteria**:
- Can pause training iteration via API/UI
- Training halts after current operation completes
- Can resume later from exact checkpoint
- All state and metrics preserved across pause/resume
- E2E test: start iteration → pause midway → resume → verify completion metrics match non-paused run

---

### Pause/Resume API

- [ ] T082 [P] Create test file tests/integration/pause-resume.test.ts for pause/resume flow

- [ ] T083 Create src/pages/api/personas/[id]/training/pause.ts implementing:
  - POST /api/personas/[id]/training/pause: Pause current training
  - Set training_loop_state.status = 'paused'
  - Stop further iteration processing
  - Save checkpoint
  - Return 200 with pause confirmation

- [ ] T084 Create src/pages/api/personas/[id]/training/resume.ts implementing:
  - POST /api/personas/[id]/training/resume: Resume paused training
  - Fetch checkpoint via TrainingStateManager.resume()
  - Verify data integrity
  - Restart IterativeTrainingLoop from checkpoint
  - Return 202 with resumed session

**Acceptance Criteria**:
- Pause halts iteration gracefully
- State persisted to database
- Resume loads checkpoint and continues
- Metrics integrity maintained across pause/resume
- >80% integration test coverage

---

### UI Controls

- [ ] T085 Create src/pages/personas/[id]/training/index.astro (update existing):
  - Add "Pause Training" button (if training in progress)
  - Add "Resume Training" button (if training paused)
  - Show pause reason in status display

**Acceptance Criteria**:
- Buttons appear/disappear based on training status
- Pause button triggers pause API
- Resume button triggers resume API
- Status updates reflect pause/resume actions

---

### Integration & E2E Tests

- [ ] T086 Create end-to-end test tests/e2e/pause-resume.test.ts covering:
  - Create persona and upload data (prerequisites)
  - Start training iteration
  - Wait for iteration to begin processing (judge outputs)
  - Click "Pause Training"
  - Verify status shows "paused"
  - Wait 30 seconds (simulate gap)
  - Click "Resume Training"
  - Verify iteration completes normally
  - Verify metrics match expected values

**Acceptance Criteria**:
- E2E test passes for pause/resume workflow
- No data loss on pause/resume cycle
- Metrics consistent with continuous run

---

## Phase 9: Cross-Cutting Concerns & Polish

*Error handling, logging, documentation, performance optimization*

**Phase Goal**: Harden implementation with error handling, logging, and performance optimization

---

### Error Handling & Edge Cases

- [ ] T087 [P] Add comprehensive error handling to all API endpoints (400 Bad Request, 404 Not Found, 500 Internal Server Error)

- [ ] T088 [P] Add API error response standardization: `{error: string, code: string, details?: any}`

- [ ] T089 [P] Add database transaction rollback on API errors (ensure no partial writes)

- [ ] T090 [P] Handle CSV upload interruptions gracefully (partial uploads rejected)

- [ ] T091 [P] Handle LLM API failures in prompt refinement (fallback to manual refinement)

- [ ] T092 [P] Handle worker thread failures in metrics calculation (fallback to main thread)

**Acceptance Criteria**:
- All error cases return appropriate HTTP status codes
- Error messages are user-friendly and actionable
- Database transactions rollback on errors
- Graceful degradation when LLM/worker fails

---

### Logging & Monitoring

- [ ] T093 [P] Add structured logging to training loop (iteration start/complete, metrics, errors)

- [ ] T094 [P] Add logging to API endpoints (request/response, validation errors, performance)

- [ ] T095 [P] Add database query logging for debugging (optional; can use query analyzer)

**Acceptance Criteria**:
- Training flow events logged with timestamps
- API errors logged with context
- Performance metrics available for monitoring

---

### Performance Optimization

- [ ] T096 [P] Add database indexes for common queries (persona_id, iteration_number, F1 score DESC)

- [ ] T097 [P] Add API response pagination for large result sets (personas list, training pairs, metrics history)

- [ ] T098 [P] Optimize metrics calculation Worker Thread (vectorize confusion matrix operations)

- [ ] T099 [P] Add caching for metrics dashboard (Redis or in-memory cache with TTL)

**Acceptance Criteria**:
- Database indexes improve query performance
- API responses paginated (limit 100 items per page)
- Metrics calculation completes in <500ms for 200 pairs
- Dashboard metrics cached for <2 second refresh

---

### Documentation & Code Quality

- [ ] T100 [P] Add JSDoc comments to all exported functions and classes

- [ ] T101 [P] Create IMPLEMENTATION.md with architecture overview and module descriptions

- [ ] T102 [P] Create API.md with endpoint documentation and example requests/responses

- [ ] T103 [P] Create DATABASE.md with schema documentation and query examples

- [ ] T104 [P] Ensure TypeScript strict mode enabled and no `any` types used

**Acceptance Criteria**:
- All exported functions have JSDoc comments
- README documents how to run project and execute tests
- Architecture document explains module relationships
- TypeScript strict mode enabled; zero `any` types (use proper types)

---

### Testing Coverage & Validation

- [ ] T105 [P] Achieve >80% code coverage on critical paths: metrics.ts, training-loop.ts, model-separation-validator.ts

- [ ] T106 [P] Run full test suite to ensure no regressions: `npm test`

- [ ] T107 [P] Run type check to ensure TypeScript strict mode: `npm run typecheck`

- [ ] T108 [P] Run linting to ensure code quality: `npm run lint`

**Acceptance Criteria**:
- Critical path coverage ≥80%
- All tests pass
- TypeScript strict mode passes
- ESLint passes with no errors

---

## Phase 10: Integration Testing & MVP Validation

*End-to-end integration tests and MVP validation against spec*

**Phase Goal**: Validate all features work together correctly; verify against spec acceptance criteria

---

### Full E2E Test Suite

- [ ] T109 [P] Create comprehensive E2E test tests/e2e/full-mvp.test.ts covering:
  - Create persona (P1 story 1)
  - Upload training data (P1 story 2)
  - Start training and complete full iteration (P1 story 3)
  - Provide human feedback
  - Verify metrics calculated correctly
  - Receive AI-refined prompt (P2 story 4)
  - View metrics dashboard (P2 story 5)
  - Pause and resume training (P3 story 6)

- [ ] T110 [P] Create performance test tests/e2e/performance.test.ts validating:
  - Dashboard renders in <2 seconds (SC-006)
  - Human can review 50 decisions in <10 minutes (SC-008, measured as API response time)
  - No timeout on 200-pair batch (SC-007)

**Acceptance Criteria**:
- Full MVP E2E test passes
- All performance targets met
- No test flakiness (run 3x to verify stability)

---

### Spec Compliance Checklist

- [ ] T111 Validate spec acceptance criteria for User Story 1 (persona creation)
- [ ] T112 Validate spec acceptance criteria for User Story 2 (CSV upload)
- [ ] T113 Validate spec acceptance criteria for User Story 3 (training iteration)
- [ ] T114 Validate spec acceptance criteria for User Story 4 (prompt refinement)
- [ ] T115 Validate spec acceptance criteria for User Story 5 (metrics dashboard)
- [ ] T116 Validate spec acceptance criteria for User Story 6 (pause/resume)

**Acceptance Criteria**:
- All User Story acceptance scenarios pass
- All Success Criteria met
- All Functional Requirements implemented

---

## Task Summary

**Total Tasks**: 116
**Estimated Effort by Phase**:
- Phase 1 (Setup): 5 tasks (~0.5 days)
- Phase 2 (Foundation): 17 tasks (~2 days)
- Phase 3 (US1): 21 tasks (~2.5 days)
- Phase 4 (US2): 11 tasks (~1.5 days)
- Phase 5 (US3): 20 tasks (~3 days)
- Phase 6 (US4): 13 tasks (~1.5 days)
- Phase 7 (US5): 8 tasks (~1 day)
- Phase 8 (US6): 5 tasks (~0.5 days)
- Phase 9 (Polish): 18 tasks (~2 days)
- Phase 10 (Integration): 8 tasks (~1 day)

**Total Estimated Effort**: ~16 days (2-3 weeks with parallel work)

---

## Task Dependencies & Parallel Execution

### MVP Scope (Phase 1 + Foundation + Stories 1-3)
- **Minimum Viable Product**: Persona creation → CSV upload → Run single iteration with feedback → Metrics calculation
- **Can be completed**: ~7-10 days
- **Stories 4-6 (P2/P3)** added incrementally after MVP

### Parallel Execution Opportunities

**Within Phase 5 (US3) - All can run in parallel**:
- T041: Testing training loop orchestration
- T042: Implementing training loop
- T044: Testing judge evaluator
- T045: Implementing judge evaluator
- T047: Testing human review UI
- T048: Implementing decisions API
- T049: Implementing feedback API
- T050: Implementing review page
- etc.

**Within Phase 9 (Polish) - All [P] tasks can run in parallel**:
- T087-T092: Error handling across different modules
- T093-T095: Logging across different layers
- T096-T099: Performance optimization across different components
- T100-T104: Documentation and code quality

### Critical Path
1. Phase 1: Setup (must complete)
2. Phase 2: Foundation (must complete - blocks all stories)
3. Phase 3: US1 + Phase 4: US2 (can run in parallel)
4. Phase 5: US3 (depends on phase 3-4)
5. Phase 6-8: US4-6 (can run in parallel; don't block anything)
6. Phase 9-10: Polish + validation (final)

---

## Success Definition

**MVP (Phase 1 + Foundation + Stories 1-3) is complete when**:
- ✅ Can create persona with task description and models
- ✅ Can upload CSV with training pairs (10-200)
- ✅ Can run single training iteration with human feedback
- ✅ F1 score, precision, recall, Cohen's Kappa calculate correctly
- ✅ All P1 acceptance scenarios pass
- ✅ All tests pass (>80% coverage on critical paths)
- ✅ TypeScript strict mode passes
- ✅ ESLint passes
- ✅ E2E test passes

**Full Feature (All 4 phases) complete when**:
- ✅ MVP complete
- ✅ Auto-prompt refinement works (US4)
- ✅ Dashboard with metrics visualization (US5)
- ✅ Pause/resume without data loss (US6)
- ✅ All P1/P2/P3 acceptance scenarios pass
- ✅ All success criteria met
- ✅ Comprehensive documentation
- ✅ Full E2E test suite passing
- ✅ Performance benchmarks met

