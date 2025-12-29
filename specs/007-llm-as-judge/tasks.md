# Implementation Tasks: LLM-as-a-Judge System

**Branch**: `007-llm-as-judge` | **Date**: 2025-12-26 | **Total Tasks**: 152 (includes Phase 12)
**Implementation Strategy**: Test-first (TDD). Phase 1 (MVP) focuses on User Stories 1-3; Phases 2-4 add P2 and P3 features. Phase 11 addresses technical debt. Phase 12 improves UX for async metrics calculation.

**Note**: Each task is independently actionable. Tasks marked [P] can execute in parallel with other [P] tasks in the same phase (no file conflicts, no blocking dependencies).

---

## Phase 1: Setup & Infrastructure

_Setup foundational project structure, database schema, and shared utilities_

**Phase Goal**: Initialize project structure and create database schema for all training-related tables

**Independent Test Criteria**:

- Database initializes with all 9 new tables created (personas, training_pairs, training_iterations, judge_decisions, human_reviews, iteration_metrics, judge_prompt_versions, training_loop_state, training_loop_checkpoints)
- Project structure matches plan.md (src/lib/ modules, src/pages/, tests/)
- TypeScript compilation succeeds with no errors
- Shared utilities (database connection, type definitions) are available for all user story tasks

---

### Setup Tasks

- [x] T001 [P] Create database schema file db/migrations/001-add-judge-training-tables.sql with all 9 tables from data-model.md
- [x] T002 [P] Create TypeScript types file src/types/training.ts with interfaces: Persona, TrainingPair, TrainingIteration, JudgeDecision, HumanReview, IterationMetrics, TrainingLoopState
- [x] T003 [P] Create database initialization script src/lib/persona-db.ts with connection helper and transaction utilities for training-related tables
- [x] T004 [P] Create test setup file tests/setup.ts with database fixtures for personas, training pairs, and iterations
- [x] T005 Create API error types file src/lib/training-errors.ts with: ModelSeparationError, CSVValidationError, TrainingStateError, MetricsCalculationError

**Acceptance Criteria**:

- All 9 tables exist in SQLite schema with correct columns and constraints
- Types compile without errors and match data-model.md entity definitions
- Database connection works with better-sqlite3; can insert/query test data
- Error types are exported and usable in API layers

---

## Phase 2: Foundational (Critical Path)

_Implement core modules that all user stories depend on_

**Phase Goal**: Build foundation modules (metrics calculation, model validation, database access) that enable all user stories

**Independent Test Criteria**:

- Metrics calculation handles edge cases (zero division, all-correct evaluations, empty datasets)
- Model separation validation enforces provider diversification at API level
- Database access layer (persona-db.ts) provides CRUD for all core tables with transaction support
- All foundational modules have >80% unit test coverage

---

### Metrics Calculation Module (Critical Path)

- [x] T006 [P] Create test file tests/unit/metrics.test.ts with tests for confusion matrix, F1, precision, recall, Cohen's Kappa calculations
- [x] T007 Create src/lib/metrics.ts implementing ConfusionMatrix interface and calculateMetrics() function with:
  - buildConfusionMatrix(judgeAgreements, humanAgreements) → TP/TN/FP/FN
  - calculateMetrics(cm) → {precision, recall, f1_score, cohens_kappa, accuracy, confusion_matrix}
  - Edge case handling: division by zero, empty datasets, all-correct scenarios

- [x] T008 [P] Create test file tests/unit/metrics-edge-cases.test.ts covering:
  - Empty confusion matrix (all zeros)
  - All true positives (100% agreement)
  - All false positives (no ground truth matches)
  - Single-element dataset

- [ ] T009 Create metrics-worker.ts as Worker Thread for CPU-intensive calculations (optional; fallback to main thread if not needed for MVP)

**Acceptance Criteria**:

- All metrics formulas calculate correctly (verified against scikit-learn reference)
- Cohen's Kappa ranges -1 to 1 correctly
- Edge cases return 0 instead of NaN/Infinity
- > 80% code coverage

---

### Model Separation Validation

- [x] T010 [P] Create test file tests/unit/model-separation-validator.test.ts with tests for:
  - Validation passes when task, judge, engineer models are from different providers
  - Validation fails when any two models share same provider
  - Clear error messages for validation failures

- [x] T011 Create src/lib/model-separation-validator.ts implementing:
  - validateModelSeparation(config) → ValidationResult {isValid, errors, warnings, models}
  - Fetch model configs from DB; extract providers
  - Verify exactly 3 different providers
  - Check models are active (not deleted)

- [x] T012 [P] Create test file tests/integration/model-separation-validator.test.ts with database integration tests

**Acceptance Criteria**:

- Validation enforces strict 3-provider separation per spec clarification Q3
- Clear error messages help users understand violations
- Integration tests verify database constraints work
- > 80% code coverage

---

### Database Access Layer for Training

- [x] T013 [P] Create test file tests/unit/persona-db.test.ts with CRUD operations for personas

- [x] T014 Create src/lib/persona-db.ts implementing (complete database access layer):
  - createPersona(name, description, taskPrompt, taskModelId, judgeModelId, promptEngineerModelId) → Persona
  - getPersona(id) → Persona | null
  - listPersonas(status?) → Persona[]
  - updatePersona(id, updates) → Persona
  - deletePersona(id) → void
  - - Similar for TrainingPair, TrainingIteration, JudgeDecision, HumanReview, IterationMetrics

- [x] T015 [P] Create test file tests/integration/persona-db.test.ts with transaction and cascade delete tests

**Acceptance Criteria**:

- All CRUD operations work correctly
- Transactions ensure atomicity (all-or-nothing)
- Cascade deletes work (deleting persona deletes pairs/iterations/decisions)
- FK constraints prevent orphaned records
- > 80% code coverage

---

### State Management for Training Loop

- [x] T016 [P] Create test file tests/unit/training-state.test.ts with checkpoint save/resume tests

- [x] T017 Create src/lib/training-state.ts implementing TrainingStateManager class:
  - saveCheckpoint(sessionId, iteration, checkpoint) → void (ACID transaction)
  - pause(sessionId, reason) → void
  - resume(sessionId) → CheckpointData | null
  - verifyCheckpointIntegrity(sessionId) → boolean

- [x] T018 [P] Create test file tests/integration/training-state.test.ts with simulated crash recovery scenarios

**Acceptance Criteria**:

- Checkpoints saved atomically (no partial saves)
- Pause halts iteration; resume continues from checkpoint
- All state persisted across process restarts
- > 80% code coverage

---

## Phase 3: User Story 1 - Create and Configure a Judge Persona (P1)

_User can create a new persona with task description, initial judge prompt, and model selections_

**Phase Goal**: Implement complete persona creation workflow (CRUD + validation)

**Independent Test Criteria**:

- User can create persona via API with task name, description, and model IDs
- Model separation is validated (must be different providers)
- Persona appears in list and detail pages
- Validation errors for missing required fields or invalid models
- E2E test: create persona → view details → verify all fields saved correctly

---

### Database Models & Validation

- [x] T019 [P] Create test file tests/unit/persona-validator.test.ts for persona creation validation:
  - Test validation passes with all required fields (including both initial_task_prompt and initial_judge_prompt)
  - Test validation fails when initial_task_prompt is empty string
  - Test validation fails when initial_task_prompt is whitespace-only
  - Test validation fails when initial_judge_prompt is empty string
  - Test validation fails when initial_judge_prompt is whitespace-only
  - Test validation fails when name is not unique
  - Test validation fails when model IDs are from same provider

- [x] T020 Create src/lib/persona-validator.ts implementing:
  - validatePersonaCreation(input) → ValidationResult
  - Check required fields (name, task_description, initial_task_prompt, initial_judge_prompt, model IDs)
  - **Validate initial_task_prompt is non-empty after trimming (return error: "Task prompt cannot be empty")**
  - **Validate initial_judge_prompt is non-empty after trimming (return error: "Judge prompt cannot be empty")**
  - Verify persona name is unique
  - Verify model IDs exist and are from different providers (via model-separation-validator)
  - Suggest error messages for each validation failure

**Acceptance Criteria**:

- Validates all required fields (name, task_description, initial_task_prompt, initial_judge_prompt, model IDs)
- **EXPLICITLY validates that initial_task_prompt is non-empty (after trimming)**
- **EXPLICITLY validates that initial_judge_prompt is non-empty (after trimming)**
- Checks uniqueness of persona names
- Integrates model separation validation
- Clear, actionable error messages including which prompt is missing
- > 80% code coverage

---

### API Endpoints

- [x] T021 [P] Create test file tests/integration/personas-api.test.ts for CRUD endpoints

- [x] T022 Create src/pages/api/personas/index.ts implementing:
  - POST /api/personas: Create new persona
    - Accept: {name, description, task_prompt, task_model_id, judge_model_id, prompt_engineer_model_id}
    - Validate via persona-validator
    - Return 201 with created persona or 400 with errors
  - GET /api/personas: List all personas with optional filtering by status

- [x] T023 Create src/pages/api/personas/[id].ts implementing:
  - GET /api/personas/[id]: Fetch specific persona with all details
  - PUT /api/personas/[id]: Update persona name/description
  - DELETE /api/personas/[id]: Delete persona (cascade deletes training data)

- [x] T024 Create src/pages/api/training/validate-models.ts implementing:
  - POST /api/training/validate-models: Validate model separation before creating persona

**Acceptance Criteria**:

- All endpoints return correct HTTP status codes
- Error responses include helpful messages
- Model validation blocks invalid combinations
- Cascade delete works correctly
- > 80% integration test coverage

---

### UI Pages

- [x] T025 [P] Create test file tests/e2e/persona-creation.test.ts for end-to-end persona creation

- [x] T026 Create src/pages/personas.astro implementing:
  - Display list of all personas as cards (PersonaCard component)
  - Show status badge (draft/training/trained/incomplete)
  - Display F1 score and iteration count for trained personas
  - "Create New Persona" button
  - Filter by status dropdown

- [x] T027 Create src/pages/personas/[id]/index.astro implementing:
  - Persona detail page with tabs: Overview, Training Data, Training Progress, Judge Prompts, Settings
  - Overview tab: Name, description, models selected, status, created date
  - Settings tab: Allow editing task name/description
  - Action buttons: Start Training, Delete, Export (Phase 3)

- [x] T028 [P] Create src/components/PersonaCard.astro as summary card for persona list (name, status, F1, iteration count, action menu)

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

- [x] T029 Create end-to-end test tests/e2e/persona-creation.test.ts covering:
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

_User can upload CSV file with input/expected_output pairs and view imported data_

**Phase Goal**: Implement CSV parsing, validation, and storage of training pairs

**Independent Test Criteria**:

- CSV file with correct columns (input, expected_output) parses successfully
- System validates 10-200 pairs constraint
- Training pairs appear in data list with input/output displayed
- Invalid CSV (wrong columns, empty fields) shows clear error messages
- E2E test: upload CSV → view training data → verify all pairs present

---

### CSV Parsing & Validation

- [x] T030 [P] Create test file tests/unit/csv-parser.test.ts for CSV validation and parsing

- [x] T031 Create src/lib/csv-parser.ts implementing:
  - parseCSV(fileContent) → {rows: Array<{input, expected_output}>, errors: string[]}
  - Validate columns (accept both "input"/"expected_output" AND "Input A"/"Correct Output" for user flexibility per A-016)
  - Normalize all column names to "input"/"expected_output" internally
  - Validate row count (10-200 pairs minimum/maximum per spec clarification Q4)
  - Trim whitespace; validate non-empty input and output
  - Detect duplicates and report

- [x] T032 [P] Create test file tests/unit/csv-parser-edge-cases.test.ts covering:
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
- > 80% code coverage

---

### API Endpoints

- [x] T033 [P] Create test file tests/integration/training-data-upload.test.ts for upload endpoint

- [x] T034 Create src/pages/api/personas/[id]/training/upload.ts implementing:
  - POST /api/personas/[id]/training/upload: Upload CSV file
  - Accept multipart/form-data with file
  - Parse CSV via csv-parser
  - Validate persona exists
  - Insert training pairs to database
  - Return 201 with count of pairs inserted or 400 with error details

- [x] T035 Create src/pages/api/personas/[id]/training/pairs.ts implementing:
  - GET /api/personas/[id]/training/pairs: List all training pairs for a persona
  - Return paginated list with input/output preview

**Acceptance Criteria**:

- Upload endpoint accepts CSV files
- Validates and parses correctly
- Stores pairs in database
- List endpoint returns all pairs with correct data
- > 80% integration test coverage

---

### UI Components & Pages

- [x] T036 [P] Create test file tests/e2e/training-data-upload.test.ts for upload workflow

- [x] T037 Create src/components/CSVUploader.astro implementing:
  - Drag-drop zone for CSV file
  - File size/type validation
  - Upload progress indicator
  - Error message display
  - Success message with pair count

- [x] T038 Create src/pages/personas/[id]/training/index.astro (Training Data tab) implementing:
  - Display uploaded training pairs in table (input, expected_output)
  - "Upload New Data" button
  - Pair count display (X of Y)
  - Pair search/filter by input text

- [x] T039 [P] Create test file tests/integration/training-data-display.test.ts

**Acceptance Criteria**:

- CSV uploader displays file input
- Drag-drop works for file selection
- Upload sends file to API
- Success message shows pair count
- Training pairs display in table correctly
- All pairs uploaded are visible in list

---

### Integration & E2E Tests

- [x] T040 Create end-to-end test tests/e2e/training-data-upload.test.ts covering:
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

## Phase 5: User Story 3 - Execute Training Loop (P1)

_System runs TWO-PHASE training: (1) Iteration 1 with mandatory human review and human-driven prompt refinement; (2) Iterations 2+ FULLY AUTOMATED with LLM prompt refinement_

**Phase Goal**: Implement complete training loop with iteration 1 human review requirement and automatic metrics calculation from ground truth

**Independent Test Criteria**:

- Can start training for a persona with training data
- System generates outputs for each pair using Task Model + Task Prompt
- Judge evaluates each output using Judge Model + Judge Prompt
- Metrics (F1, precision, recall, Cohen's Kappa) calculate AUTOMATICALLY by comparing judge decisions against ground truth (expected_output)
- **Iteration 1**: System REQUIRES human review of ALL decisions before proceeding
- **Iteration 1**: Human reasoning is aggregated to refine Judge Prompt
- **Iteration 1**: User accepts refined prompt before iteration 2 begins
- **Iteration 2+**: System automatically refines BOTH Task Prompt and Judge Prompt using LLM based on failures (FP/FN cases)
- Iterations 2+ start automatically with refined prompts until F1 ≥ target OR max iterations reached
- E2E test: start training → verify iteration 1 requires human review → verify iteration 2+ run automatically → verify convergence or max iterations

---

### Training Loop Orchestration

- [x] T041 [P] Create test file tests/unit/training-loop.test.ts for TWO-PHASE training orchestration

- [x] T042 Create src/lib/training-loop.ts implementing IterativeTrainingLoop class:
  - executeTrainingLoop() → Promise<void> (runs iteration 1 with human review, then iterations 2+ automatically until convergence or max iterations)
  - runFirstIterationWithHumanReview() → Promise<IterationResult> (iteration 1: requires human review completion before proceeding)
  - runAutomatedIterations(startIteration: 2) → Promise<void> (iterations 2+: fully automated with LLM prompt refinement)
  - runSingleIteration(iterationNumber) → Promise<IterationResult>
  - generateOutputs() → generate suggested_output for each training pair using Task Model + current Task Prompt
  - evaluateWithJudge() → judge all outputs and store judge_decisions (correct/incorrect)
  - calculateMetricsFromGroundTruth() → automatically compare judge decisions vs expected_output to compute TP/TN/FP/FN
  - waitForHumanReviewCompletion(iterationNumber: 1) → Promise<void> (BLOCKS until all iteration 1 decisions reviewed)
  - refinePromptsFromHumanFeedback(iterationNumber: 1, humanReviews) → {refined_judge_prompt, rationale} (human-driven for iteration 1)
  - refinePromptsFromLLM(iterationNumber: 2+, failures) → {refined_task_prompt, refined_judge_prompt, rationale} (LLM-driven for iterations 2+)
  - checkConvergence(f1Score) → determine if F1 ≥ target or iterations ≥ max
  - sessionId property for tracking
  - pause() method to pause training between iterations (iteration 2+ only)

- [x] T043 [P] Create test file tests/integration/training-loop-flow.test.ts with simulated TWO-PHASE flow (iteration 1 human review, iterations 2+ automated)

**Acceptance Criteria**:

- Iteration 1 BLOCKS until human review complete: generate → judge → metrics → MANDATORY human review → human-driven prompt refinement → wait for user acceptance
- Iterations 2+ run FULLY AUTOMATED: generate → judge → metrics → LLM prompt refinement → next iteration
- State persisted to database after each iteration
- Metrics calculated automatically from ground truth comparison (NOT human feedback)
- Iteration 1: Judge prompt refined from aggregated human reasoning
- Iterations 2+: Both task and judge prompts refined by LLM based on FP/FN failures
- Training continues from iteration 2 until F1 ≥ target OR max iterations
- Can pause/resume training during automated iterations (iteration 2+ only)
- > 80% code coverage

---

### Judge Evaluation Module

- [x] T044 [P] Create test file tests/unit/judge-evaluator.test.ts for judge decision parsing

- [x] T045 Create src/lib/judge-evaluator.ts implementing:
  - evaluateOutput(input, correctOutput, suggestedOutput, judgePrompt, judgeModel) → JudgeDecisionResult
  - Call judge model with formatted prompt
  - Parse JSON response: {decision: "agree"|"disagree", confidence: 0.0-1.0, reasoning: string}
  - Handle parsing errors gracefully
  - Store decision to database

- [x] T046 [P] Create test file tests/integration/judge-api-calls.test.ts with mock API client tests

**Acceptance Criteria**:

- Correctly formats judge prompt with input/output/criteria
- Calls correct judge model via API client
- Parses judge response correctly
- Handles malformed JSON response
- Stores judge decision with reasoning
- > 80% code coverage

---

### Human Review Interface (REQUIRED for Iteration 1, OPTIONAL for Iterations 2+)

- [x] T047 [P] Create test file tests/e2e/human-review.test.ts for MANDATORY iteration 1 review workflow and OPTIONAL iteration 2+ validation

- [x] T048 Create src/pages/api/personas/[id]/iterations/[num]/decisions.ts implementing:
  - GET /api/personas/[id]/iterations/[num]/decisions: Fetch all judge decisions for human review
  - Return: {input, expected_output, suggested_output, judge_decision, judge_reasoning, automatic_correctness (from ground truth), decision_id, iteration_number}
  - For iteration 1: Return ALL decisions (mandatory review)
  - For iterations 2+: Return all decisions (optional validation)

- [x] T049 Create src/pages/api/personas/[id]/iterations/[num]/feedback.ts implementing:
  - POST /api/personas/[id]/iterations/[num]/feedback: Submit human review feedback
  - Accept: {decision_id, human_decision: "agree"|"disagree", reviewer_notes: string}
  - Store HumanReview record SEPARATELY from automatic metrics
  - Return 201 with stored feedback
  - For iteration 1: Track completion status (how many decisions reviewed vs total)
  - NOTE: Iteration 1 requires 100% completion before training can proceed; iterations 2+ are optional

- [x] T050 Create src/pages/personas/[id]/review/[iteration].astro implementing:
  - **Iteration 1**: MANDATORY review page with clear "REQUIRED FOR ITERATION 1" indicator
  - **Iterations 2+**: Optional validation page
  - Split view: left side shows decision + automatic correctness, right side shows feedback form
  - Display: input, expected_output, suggested_output, judge_decision, judge_reasoning, automatic_correctness_badge
  - Buttons: "Agree with Judge" / "Disagree with Judge" with required notes field
  - Progress: "X of Y decisions reviewed (100% required for iteration 1)"
  - Previous/Next navigation between decisions
  - **Iteration 1 only**: "Generate Refined Prompt" button appears when 100% complete
  - **Iteration 1 only**: Review page blocks navigation to other pages until review complete

  **Navigation Edge Cases** (FR-021):
  - **"Previous" button on first decision**: Disabled/grayed out (not hidden) - visually indicates no previous decision but maintains layout consistency
  - **"Next" button on last decision**: Disabled/grayed out (not hidden) - visually indicates end of list but maintains layout consistency
  - **Keyboard navigation**: Left arrow key = previous decision, Right arrow key = next decision (respects disabled state)
  - **URL structure**: `/review/{iteration}/{index}` where index is 0-based decision position; URL updates on navigation
  - **Direct URL access**: Accessing `/review/{iteration}/{index}` directly loads that specific decision; invalid indices redirect to first decision
  - **After reviewing last decision**: Show "All decisions reviewed" message with action button (Calculate Metrics for iteration 1, or Return to Training for iterations 2+)
  - **Navigation during submit**: Disable both Previous/Next buttons while form submission is in progress
  - **Unsaved changes warning**: If user navigates away with unsaved changes, show confirmation dialog (browser beforeunload or custom modal)

- [x] T051 [P] Create src/components/JudgeDecisionReview.astro as reusable decision card component with automatic correctness badge

**Acceptance Criteria**:

- Decisions fetch with automatic correctness calculated from ground truth
- Human validation feedback is stored separately from automatic metrics
- **Iteration 1**: Feedback UI clearly indicates MANDATORY status and blocks progress until 100% complete
- **Iterations 2+**: Feedback UI clearly indicates OPTIONAL status
- Both automatic metrics and human validation metrics displayed side-by-side
- **Iteration 1**: Training CANNOT proceed without completing human review and accepting refined prompt
- **Iterations 2+**: Training continues regardless of whether human validation is provided
- Navigation edge cases handled gracefully (disabled buttons, keyboard support, URL updates)

---

### Automatic Metrics Calculation from Ground Truth

- [x] T052 [P] Create test file tests/integration/metrics-calculation.test.ts with AUTOMATIC metrics flow (applies to ALL iterations)

- [x] T053 Create src/lib/metrics-orchestrator.ts implementing TWO-PHASE metrics calculation:

  **Phase A: Iteration 1 (Human-Guided Metrics)** - Called AFTER human review completes
  - calculateIteration1Metrics(iterationId: 1, humanReviews) → MetricsResult
  - Fetch all HumanReview records for iteration 1 (must be 100% complete)
  - Build confusion matrix from human Agree/Disagree votes:
    - TP: human_agrees AND judge_decision = "correct" (human affirms correct judgment)
    - TN: human_agrees AND judge_decision = "incorrect" (human affirms incorrect judgment)
    - FP: human_disagrees AND judge_decision = "correct" (human contradicts - judge was wrong)
    - FN: human_disagrees AND judge_decision = "incorrect" (human contradicts - judge was wrong)
  - Call calculateMetrics(confusionMatrix) from metrics.ts
  - Store to iteration_metrics table with TP/TN/FP/FN counts
  - Update persona with best_f1_score and best_iteration_number if F1 improved
  - Return FP and FN cases (from human disagreements) for human-prompt-refiner analysis

  **Phase B: Iterations 2+ (Automatic Ground Truth Metrics)** - Called automatically after iteration completes
  - calculateIterationMetrics(iterationId: 2+) → MetricsResult (AUTOMATIC - no human review required)
  - Fetch all judge_decisions and corresponding training_pairs (to get expected_output)
  - For each decision, determine ground truth correctness via EXACT STRING MATCH:
    - is_correct = (suggested_output.trim() === expected_output.trim())
  - Build confusion matrix:
    - TP: judge says "correct" AND is_correct = true
    - TN: judge says "incorrect" AND is_correct = false
    - FP: judge says "correct" BUT is_correct = false (judge wrong - false positive)
    - FN: judge says "incorrect" BUT is_correct = true (judge wrong - false negative)
  - Call calculateMetrics(confusionMatrix) from metrics.ts
  - Store to iteration_metrics table with TP/TN/FP/FN counts
  - Update persona with best_f1_score and best_iteration_number if F1 improved
  - Return FP and FN cases (failures) for failure-analysis/prompt-engineer

**Acceptance Criteria**:

- **Iteration 1**: Metrics calculate from human Agree/Disagree votes (human as ground truth)
- **Iteration 1**: Metrics calculation BLOCKS until 100% human review complete
- **Iterations 2+**: Metrics calculate AUTOMATICALLY from ground truth comparison (expected_output vs suggested_output)
- **Iterations 2+**: Use EXACT STRING MATCH (after trim) for correctness comparison
- Confusion matrix correctly identifies TP/TN/FP/FN based on phase-specific ground truth
- Metrics stored with iteration_id FK
- Persona best_f1_score and best_iteration_number updated if improved
- FP/FN failure cases returned for appropriate refiner (human-prompt-refiner for iteration 1, failure-analysis for iterations 2+)
- > 80% code coverage

---

### API Integration

- [x] T054 [P] Create test file tests/integration/iteration-api.test.ts for AUTOMATED training endpoints

- [x] T055 Create src/pages/api/personas/[id]/training/start.ts implementing:
  - POST /api/personas/[id]/training/start: Start AUTOMATED training (runs ALL iterations automatically)
  - Create training_loop_state record with status='in_progress'
  - Start IterativeTrainingLoop.executeFullTraining() (fire-and-forget - runs until convergence or max iterations)
  - Return 202 with session_id and training loop details

- [x] T056 Create src/pages/api/personas/[id]/training/status.ts implementing:
  - GET /api/personas/[id]/training/status: Get current training status
  - Return: current_iteration, total_iterations, latest_f1_score, best_f1_score, best_iteration, training_status (in_progress/paused/completed), convergence_achieved

**Acceptance Criteria**:

- Start training initiates FULLY AUTOMATED loop (no human intervention)
- Training continues automatically across multiple iterations
- Status endpoint returns current iteration progress and best performance
- Returns 202 for async operations
- Metrics available immediately after each iteration completes (automatic calculation)

---

### UI Pages & Components

- [x] T057 [P] Create src/components/MetricCard.astro for displaying single metric with trend across iterations

- [x] T058 Create src/components/ConfusionMatrix.astro for 2x2 visual grid (TP/TN/FP/FN) from ground truth

- [x] T059 Create training progress UI (implemented as src/pages/personas/[id]/metrics.astro and src/components/TrainingProgress.astro):
  - Show current iteration number / total iterations (e.g., "Iteration 3/5")
  - Display: Latest F1 Score, Precision, Recall, Cohen's Kappa metrics
  - Display: BEST F1 Score across all iterations with iteration number
  - Show confusion matrix visualization (TP/TN/FP/FN from ground truth)
  - Progress bar: "X of Y iterations completed" with convergence indicator
  - Training status: "Running..." / "Converged (F1 ≥ 0.80)" / "Max iterations reached"
  - "Start Training" button (if not started) - starts AUTOMATED loop
  - "Pause Training" button (if running)
  - "View Decisions" button (OPTIONAL - for validation only, not required)
  - Iteration history table showing F1 score progression
  - Note: Training runs AUTOMATICALLY without human intervention

**Acceptance Criteria**:

- Metrics display correctly with proper formatting from automatic calculation
- Confusion matrix visualizes TP/TN/FP/FN from ground truth comparison
- Best iteration highlighted with F1 score
- Real-time updates as automated iterations complete
- Clear indication of convergence status
- Training controls work (start/pause)

---

### Integration & E2E Tests

- [x] T060 Create end-to-end test tests/e2e/two-phase-training.test.ts covering:
  - Create persona and upload training data (prerequisites)
  - Click "Start Training" button
  - **Iteration 1**: Wait for iteration 1 to complete, verify user is redirected to mandatory review page
  - **Iteration 1**: Complete mandatory human review (all decisions), provide reasoning
  - **Iteration 1**: Click "Generate Refined Prompt", verify human-refined judge prompt displayed
  - **Iteration 1**: Accept refined prompt, verify iteration 2 begins automatically
  - **Iteration 2+**: Wait for AUTOMATED training to run multiple iterations (e.g., 2-3 more iterations)
  - **Iteration 2+**: Verify prompts are refined automatically by LLM between iterations
  - Verify training stops when F1 ≥ target OR max iterations reached
  - Verify best iteration is identified with highest F1 score

**Acceptance Criteria**:

- E2E test passes for complete TWO-PHASE training (iteration 1 human-driven, iterations 2+ automated)
- Outputs generated successfully for each iteration
- Judge evaluates correctly using current prompts
- Metrics calculated AUTOMATICALLY from ground truth (for all iterations)
- **Iteration 1**: Human review MANDATORY, prompts refined from human reasoning
- **Iterations 2+**: LLM refines both prompts automatically based on FP/FN failures
- Training converges or reaches max iterations
- Best performing iteration tracked correctly

---

## Phase 6: User Story 4 - Two-Phase Prompt Refinement (P1)

_System uses TWO approaches: (1) Iteration 1 - human-driven prompt refinement based on human feedback; (2) Iteration 2+ - LLM-driven prompt refinement based on failure analysis_

**Phase Goal**: Implement both human-driven (iteration 1) and LLM-driven (iterations 2+) prompt refinement mechanisms

**Independent Test Criteria**:

- **Iteration 1**: After human completes review, system analyzes human feedback patterns and generates improved judge prompt
- **Iteration 1**: Human accepts refined prompt before iteration 2 begins
- **Iterations 2+**: System analyzes FP/FN cases from ground truth comparison
- **Iterations 2+**: Prompt Engineer Model generates improved task prompt AND judge prompt
- **Iterations 2+**: Refined prompts used automatically without user approval
- User can view prompt refinement history and rationale for all iterations
- E2E test: iteration 1 human review → human refinement accepted → iteration 2 LLM refinement → verify F1 improves

---

### Human-Driven Prompt Refinement (Iteration 1 Only)

- [x] T061 [P] Create test file tests/unit/human-prompt-refiner.test.ts for iteration 1 human-driven prompt refinement

- [x] T062 Create src/lib/human-prompt-refiner.ts implementing:
  - analyzeHumanFeedback(iterationId: 1) → HumanFeedbackAnalysis
  - Fetch all HumanReview records for iteration 1 (must be 100% complete)
  - Aggregate patterns: common reasons for "Disagree" votes, missed edge cases, systematic errors
  - Extract key insights from human reasoning comments
  - identifyRefinementOpportunities() → {patterns, insights, suggestedImprovements}
  - refineJudgePromptFromHumanFeedback(currentPrompt, analysis) → {refined_prompt, rationale, expected_impact}
  - Present refined prompt with clear explanation of changes based on human input
  - Store refined prompt as judge_prompt_version with created_by="human"
  - Return prompt for user acceptance before iteration 2

- [x] T063 [P] Create test file tests/integration/human-prompt-refiner.test.ts with complete iteration 1 flow

**Acceptance Criteria**:

- Aggregates human feedback patterns from iteration 1 reviews
- Identifies systematic errors and edge cases missed by judge
- Generates refined judge prompt incorporating human insights
- Rationale clearly explains how human feedback shaped the refinement
- Stores prompt with created_by="human" attribution
- > 80% code coverage

---

### LLM-Driven Prompt Refinement (Iterations 2+ Only)

- [x] T064 [P] Create test file tests/unit/failure-analysis.test.ts for analyzing iteration failures FROM GROUND TRUTH (iterations 2+)

- [x] T065 Create src/lib/failure-analysis.ts implementing:
  - analyzeIterationFailures(iterationId) → FailureAnalysisContext
  - Extract false positives: judge says "correct" BUT suggested_output ≠ expected_output (ground truth says wrong)
  - Extract false negatives: judge says "incorrect" BUT suggested_output = expected_output (ground truth says right)
  - Limit to 5 examples each (for token efficiency)
  - Extract true positives (correct examples): judge matched ground truth
  - Return context object with:
    - FP cases: {input, suggested_output, expected_output, judge_reasoning} - to improve BOTH task prompt (generate better outputs) and judge prompt (catch these errors)
    - FN cases: {input, suggested_output, expected_output, judge_reasoning} - to improve judge prompt (stop rejecting correct outputs)
    - TP cases: {input, suggested_output, expected_output, judge_reasoning} - examples of what works well
    - Current metrics (F1, precision, recall)
    - Current task prompt and judge prompt

**Acceptance Criteria**:

- Correctly identifies FP and FN examples from ground truth comparison (NOT human feedback)
- Extracts TP examples for few-shot learning
- Limits examples to reasonable count (5 each)
- Context includes current prompts and metrics
- **Applies to iterations 2+ only** (iteration 1 uses human-driven refinement)
- > 80% code coverage

---

### Automatic Prompt Refinement via LLM (Iterations 2+ Only)

- [x] T066 [P] Create test file tests/integration/prompt-refinement.test.ts with LLM mock for BOTH prompts (iterations 2+)

- [x] T067 Create src/lib/prompt-engineer.ts implementing:
  - refinePrompts(failureContext, promptEngineerModel) → {refined_task_prompt, refined_judge_prompt, rationale, expected_impact}
  - **Iterations 2+ only** (iteration 1 uses human-driven refinement via human-prompt-refiner.ts)
  - Build detailed context with:
    - Current task prompt and judge prompt
    - FP cases (both outputs and judge reasoning)
    - FN cases (judge reasoning)
    - TP cases (examples that work well)
    - Current metrics (F1, precision, recall)
  - Call Prompt Engineer Model with instructions to refine BOTH prompts:
    - Task Prompt refinement: "How can we modify the task prompt to generate outputs that better match expected_output?"
    - Judge Prompt refinement: "How can we modify the judge prompt to better identify correct vs incorrect outputs?"
  - Parse JSON response with both refined prompts and rationales
  - Handle LLM failures gracefully (return null to keep current prompts)

- [x] T068 [P] Create test file tests/unit/prompt-engineer-edge-cases.test.ts for LLM response parsing

**Acceptance Criteria**:

- Builds comprehensive failure context from ground truth comparison
- Calls LLM with clear instructions for BOTH prompts
- **Applies to iterations 2+ only** (iteration 1 uses human-prompt-refiner.ts)
- Parses JSON response with task prompt + judge prompt + rationales
- Provides rationale for changes to each prompt
- Gracefully handles failures (keeps current prompts)
- > 80% code coverage

---

### Prompt Version Management (Task + Judge Prompts)

- [x] T066 [P] Create test file tests/unit/prompt-version-manager.test.ts for version tracking of BOTH prompts

- [x] T067 Create src/lib/prompt-version-manager.ts implementing:
  - storeTaskPromptVersion(personaId, versionNumber, promptText, rationale, createdBy) → TaskPromptVersion
  - storeJudgePromptVersion(personaId, versionNumber, promptText, rationale, createdBy) → JudgePromptVersion
  - Only store if prompt significantly changed (not just formatting)
  - Compare with previous version; skip if identical
  - getTaskPromptHistory(personaId) → Array<TaskPromptVersion>
  - getJudgePromptHistory(personaId) → Array<JudgePromptVersion>
  - getPromptDiff(version1Id, version2Id, promptType) → {before, after, changes}

**Acceptance Criteria**:

- Stores only significant prompt changes (no formatting changes) for BOTH prompt types
- Tracks which version was user-created vs AI-created
- Can compare versions for both task and judge prompts
- Each iteration tagged with specific task_prompt_version_id and judge_prompt_version_id used
- > 80% code coverage

---

### API Endpoints

- [x] T068 [P] Create test file tests/integration/prompt-refinement-api.test.ts

- [x] T069 Create src/pages/api/personas/[id]/iterations/[num]/refine-prompt.ts implementing:
  - POST /api/personas/[id]/iterations/[num]/refine-prompt: Trigger prompt refinement
  - Call failure-analysis.analyzeIterationFailures()
  - Call prompt-engineer.refineJudgePrompt()
  - Return: {improved_prompt, rationale, expected_impact} or {error} if LLM fails

- [x] T070 Create src/pages/api/personas/[id]/iterations/[num]/accept-prompt.ts implementing:
  - POST /api/personas/[id]/iterations/[num]/accept-prompt: Accept refined prompt for next iteration
  - Accept: {prompt_text, reason: "ai-generated"|"manual-edit"}
  - Store via prompt-version-manager
  - Update persona's judge prompt for next iteration

**Acceptance Criteria**:

- Refine endpoint calls LLM and returns improved prompt
- Accept endpoint stores version and updates persona
- Works even if LLM refinement fails (fallback to manual)
- > 80% integration test coverage

---

### UI Components & Pages

- [x] T071 Create src/pages/personas/[id]/judge-prompts.astro implementing:
  - Display judge prompt version history
  - Show which version was "ai-generated" vs "manual"
  - Show iteration number for each version
  - "View Diff" button to compare versions

- [x] T072 Create src/components/PromptDiffViewer.astro for side-by-side prompt comparison

- [x] T073 Create src/pages/personas/[id]/refine-prompt.astro implementing:
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

_Dashboard displays real-time metrics and convergence status_

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

- [x] T074 [P] Create test file tests/integration/dashboard-api.test.ts

- [x] T075 Create src/pages/api/personas/[id]/dashboard.ts implementing:
  - GET /api/personas/[id]/dashboard: Fetch all data for dashboard
  - Return: {persona, iterations: [{iteration_num, metrics, timestamp}], convergence_achieved, current_iteration_status}

- [x] T076 Create src/pages/api/personas/[id]/metrics.ts implementing:
  - GET /api/personas/[id]/metrics: Fetch just metrics data for chart
  - Return: Array<{iteration, f1_score, precision, recall, cohens_kappa, timestamp}>

**Acceptance Criteria**:

- Endpoints return correct data structure
- Data includes all metrics from all iterations
- Sorted by iteration number
- > 80% integration test coverage

---

### UI Dashboard Component

- [x] T077 Create src/components/TrainingDashboard.astro implementing:
  - Metric cards: F1 Score (primary), Precision, Recall, Cohen's Kappa (with trend arrows)
  - Line chart: F1 and Cohen's Kappa trends over iterations
  - Convergence indicator: "Target F1 (0.80) achieved in iteration X"
  - Current iteration status: "Iteration 5/20 in progress" or "Iteration 3/20 awaiting review"
  - Confusion matrix visualization for latest iteration

- [x] T078 Create src/components/MetricsChart.astro for line chart (F1/Kappa over iterations)

- [x] T079 Create src/pages/personas/[id]/training/index.astro (update existing to include dashboard)
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

- [x] T081 Create end-to-end test tests/e2e/training-dashboard.test.ts covering:
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

_User can pause training and resume later without data loss_

**Phase Goal**: Implement pause/resume functionality with state persistence

**Independent Test Criteria**:

- Can pause training iteration via API/UI
- Training halts after current operation completes
- Can resume later from exact checkpoint
- All state and metrics preserved across pause/resume
- E2E test: start iteration → pause midway → resume → verify completion metrics match non-paused run

---

### Pause/Resume API

- [x] T082 [P] Create test file tests/integration/pause-resume.test.ts for pause/resume flow

- [x] T083 Create src/pages/api/personas/[id]/training/pause.ts implementing:
  - POST /api/personas/[id]/training/pause: Pause current training
  - Set training_loop_state.status = 'paused'
  - Stop further iteration processing
  - Save checkpoint
  - Return 200 with pause confirmation

- [x] T084 Create src/pages/api/personas/[id]/training/resume.ts implementing:
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
- > 80% integration test coverage

---

### UI Controls

- [x] T085 Update src/pages/personas/[id]/index.astro (training-progress tab):
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

- [x] T086 Create end-to-end test tests/e2e/pause-resume.test.ts covering:
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

_Error handling, logging, documentation, performance optimization_

**Phase Goal**: Harden implementation with error handling, logging, and performance optimization

---

### Error Handling & Edge Cases

- [x] T087 [P] Add comprehensive error handling to all API endpoints (400 Bad Request, 404 Not Found, 500 Internal Server Error)

- [x] T088 [P] Add API error response standardization: `{error: string, code: string, details?: any}`

- [x] T089 [P] Add database transaction rollback on API errors (ensure no partial writes)

- [x] T090 [P] Handle CSV upload interruptions gracefully (partial uploads rejected)

- [x] T091 [P] Handle LLM API failures in prompt refinement (fallback to manual refinement)

- [x] T092 [P] Handle worker thread failures in metrics calculation (fallback to main thread)

**Acceptance Criteria**:

- All error cases return appropriate HTTP status codes
- Error messages are user-friendly and actionable
- Database transactions rollback on errors
- Graceful degradation when LLM/worker fails

---

### Logging & Monitoring

- [x] T093 [P] Add structured logging to training loop (iteration start/complete, metrics, errors)

- [x] T094 [P] Add logging to API endpoints (request/response, validation errors, performance)

- [x] T095 [P] Add database query logging for debugging (optional; can use query analyzer)

**Acceptance Criteria**:

- Training flow events logged with timestamps
- API errors logged with context
- Performance metrics available for monitoring

---

### Performance Optimization

- [x] T096 [P] Add database indexes for common queries (persona_id, iteration_number, F1 score DESC)

- [x] T097 [P] Add API response pagination for large result sets (personas list, training pairs, metrics history)

- [x] T098 [P] Optimize metrics calculation Worker Thread (vectorize confusion matrix operations)

- [x] T099 [P] Add caching for metrics dashboard (Redis or in-memory cache with TTL)

**Acceptance Criteria**:

- Database indexes improve query performance
- API responses paginated (limit 100 items per page)
- Metrics calculation completes in <500ms for 200 pairs
- Dashboard metrics cached for <2 second refresh

---

### Documentation & Code Quality

- [x] T100 [P] Add JSDoc comments to all exported functions and classes

- [x] T101 [P] Create IMPLEMENTATION.md with architecture overview and module descriptions

- [x] T102 [P] Create API.md with endpoint documentation and example requests/responses

- [x] T103 [P] Create DATABASE.md with schema documentation and query examples

- [x] T104 [P] Ensure TypeScript strict mode enabled and no `any` types used

**Acceptance Criteria**:

- All exported functions have JSDoc comments
- README documents how to run project and execute tests
- Architecture document explains module relationships
- TypeScript strict mode enabled; zero `any` types (use proper types)

---

### Testing Coverage & Validation

- [x] T105 [P] Achieve >80% code coverage on critical paths: metrics.ts, training-loop.ts, model-separation-validator.ts

- [x] T106 [P] Run full test suite to ensure no regressions: `npm test`

- [x] T107 [P] Run type check to ensure TypeScript strict mode: `npm run typecheck`

- [x] T108 [P] Run linting to ensure code quality: `npm run lint`

**Acceptance Criteria**:

- Critical path coverage ≥80%
- All tests pass
- TypeScript strict mode passes
- ESLint passes with no errors

---

## Phase 10: Integration Testing & MVP Validation

_End-to-end integration tests and MVP validation against spec_

**Phase Goal**: Validate all features work together correctly; verify against spec acceptance criteria

---

### Full E2E Test Suite

- [x] T109 [P] Create comprehensive E2E test tests/e2e/full-mvp.test.ts covering:
  - Create persona (P1 story 1)
  - Upload training data (P1 story 2)
  - Start training and complete full iteration (P1 story 3)
  - Provide human feedback
  - Verify metrics calculated correctly
  - Receive AI-refined prompt (P2 story 4)
  - View metrics dashboard (P2 story 5)
  - Pause and resume training (P3 story 6)

- [x] T110 [P] Create performance test tests/e2e/performance.test.ts validating:
  - Dashboard renders in <2 seconds (SC-006)
  - Human can review 50 decisions in <10 minutes (SC-008, measured as API response time)
  - No timeout on 200-pair batch (SC-007)

**Acceptance Criteria**:

- Full MVP E2E test passes
- All performance targets met
- No test flakiness (run 3x to verify stability)

---

### Spec Compliance Checklist

- [x] T111 Validate spec acceptance criteria for User Story 1 (persona creation)
- [x] T112 Validate spec acceptance criteria for User Story 2 (CSV upload)
- [x] T113 Validate spec acceptance criteria for User Story 3 (training iteration)
- [x] T114 Validate spec acceptance criteria for User Story 4 (prompt refinement)
- [x] T115 Validate spec acceptance criteria for User Story 5 (metrics dashboard)
- [x] T116 Validate spec acceptance criteria for User Story 6 (pause/resume)

**Acceptance Criteria**:

- All User Story acceptance scenarios pass
- All Success Criteria met
- All Functional Requirements implemented

---

## Task Summary

**Total Tasks**: 139 (updated for human-first iteration workflow)
**Estimated Effort by Phase**:

- Phase 1 (Setup): 5 tasks (~0.5 days)
- Phase 2 (Foundation): 17 tasks (~2 days)
- Phase 3 (US1): 21 tasks (~2.5 days)
- Phase 4 (US2): 11 tasks (~1.5 days)
- Phase 5 (US3): 20 tasks (~3 days) - updated for two-phase training
- Phase 6 (US4): 15 tasks (~2 days) - updated for human-driven + LLM-driven refinement
- Phase 7 (US5): 8 tasks (~1 day)
- Phase 8 (US6): 5 tasks (~0.5 days)
- Phase 9 (Polish): 18 tasks (~2 days)
- Phase 10 (Integration): 8 tasks (~1 day)
- Phase 11 (Technical Debt): 20 tasks (~3 days)

**Total Estimated Effort**: ~19 days (3-4 weeks with parallel work)

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

---

## Phase 11: Technical Debt & Specification Gaps

_Address gaps identified in mvp-sanity.md checklist verification_

**Phase Goal**: Close specification gaps and technical debt to ensure production-ready quality

**Independent Test Criteria**:

- All loading states defined and implemented
- Status transitions follow documented state machine
- API error responses follow standardized format
- Edge cases have explicit handling requirements
- UI/UX patterns consistent with existing modules

---

### Loading States & Status Transitions

- [x] T117 [P] Document loading state requirements in spec.md or technical specification:
  - Define loading states for "Start Training" → first judge decision appears
  - Define spinner/progress indicator behavior during CSV upload
  - Define loading states for metrics calculation (post-feedback submission)
  - Define loading states for prompt refinement API calls
  - Add to FR-017 or new FR-018: "System MUST display loading indicators during async operations with <2 second perceived latency"

- [x] T118 [P] Document persona status state machine in data-model.md:
  - Explicitly define "Draft" → "Training" transition on first iteration start
  - Define "Training" → "Trained" transition when F1 ≥ target_f1_score
  - Define "Training" → "Incomplete" transition on max_iterations reached without convergence
  - Add state diagram to data-model.md showing all valid transitions
  - Update persona-db.ts with state transition validation functions

- [ ] T119 Create test file tests/unit/persona-state-machine.test.ts:
  - Test Draft → Training transition on iteration start
  - Test Training → Trained on F1 convergence
  - Test Training → Incomplete on max iterations
  - Test invalid transitions (e.g., Draft → Trained directly)
  - Verify status updates persist to database

**Acceptance Criteria**:

- Loading state requirements documented with specific timing targets
- State machine diagram in data-model.md shows all valid transitions
- State transition logic tested with >80% coverage
- UI implements loading states per specification

---

### Error Handling Standardization

- [x] T120 [P] Complete API error response standardization (T088 follow-up):
  - Define standard error response format: `{error: string, code: string, details?: object, timestamp: string}`
  - Document specific error codes for each validation failure:
    - `MODEL_SEPARATION_VIOLATION`: Task/Judge/Engineer models not from different providers
    - `CSV_SIZE_INVALID`: CSV has <10 or >200 pairs
    - `CSV_FORMAT_INVALID`: CSV missing required columns or has malformed rows
    - `DUPLICATE_ROWS`: CSV contains duplicate input/output pairs
    - `INCOMPLETE_FEEDBACK`: Iteration has judge decisions without human reviews
    - `INVALID_STATUS_TRANSITION`: Persona status transition not allowed
    - `ITERATION_IN_PROGRESS`: Cannot start new iteration while one is running
  - Create src/lib/error-codes.ts with error code constants and factory functions
  - Update all API endpoints to use standardized error format

- [x] T121 [P] Quantify exponential backoff parameters for FR-016:
  - Document backoff formula: `delay = min(initial_delay * 2^(attempt-1), max_delay)`
  - Set initial_delay = 1000ms (1 second)
  - Set max_delay = 4000ms (4 seconds)
  - Maximum 3 retry attempts (total 4 attempts including initial)
  - Update FR-016 in spec.md with explicit parameters
  - Implement backoff in src/lib/api-retry-handler.ts
  - Add tests in tests/unit/api-retry-handler.test.ts

- [ ] T122 [P] Create test file tests/integration/api-error-responses.test.ts:
  - Test each error code returns correct HTTP status and error body
  - Verify error timestamps are ISO 8601 format
  - Verify error details include actionable information
  - Test retry handler with exponential backoff timing

**Acceptance Criteria**:

- All API endpoints return errors in standardized format
- Error codes documented in API.md
- Exponential backoff parameters explicit in FR-016
- Retry handler tested with timing verification
- > 80% test coverage on error paths

---

### Prompt Versioning Clarity

- [x] T123 Define quantifiable criteria for "Significant Prompt Change" (FR-015):
  - Option 1: Whitespace-normalized string comparison (if different after trim/normalize, it's significant)
  - Option 2: Levenshtein distance threshold (e.g., >10% character changes)
  - Option 3: Semantic embedding similarity threshold (e.g., cosine similarity <0.95)
  - **Decision**: Use Option 1 (whitespace normalization) for MVP simplicity
  - Document in FR-015: "Significant changes are defined as non-whitespace text differences after normalizing spaces, tabs, and newlines"
  - Update src/lib/prompt-version-manager.ts implementation to match
  - Add tests in tests/unit/prompt-version-manager.test.ts verifying whitespace normalization

- [x] T124 [P] Update spec.md FR-015 with explicit definition:
  - Replace "significant changes (semantic changes, not formatting)" with:
    "Significant changes are text modifications that remain after whitespace normalization (collapsing multiple spaces, trimming leading/trailing whitespace, normalizing line endings). Purely formatting changes (indentation, spacing) do not create new versions."
  - Add examples:
    - SIGNIFICANT: "Evaluate correctness" → "Evaluate correctness and completeness"
    - NOT SIGNIFICANT: "Evaluate correctness" → " Evaluate correctness \n"

**Acceptance Criteria**:

- FR-015 contains explicit, measurable definition
- Prompt version manager implements whitespace normalization
- Tests verify formatting-only changes don't create versions
- Tests verify semantic changes create versions

---

### Edge Case Specifications

- [x] T125 [P] Document contradictory feedback handling (CHK011):
  - Add to spec.md Edge Cases section:
    "When human feedback contradicts across iterations (e.g., same judge decision marked 'agree' in iteration N, 'disagree' in iteration N+1), the system uses iteration-local feedback only. Each iteration's metrics are calculated independently using that iteration's human reviews. Prompt refinement analyzes only the current iteration's failures."
  - Add to Assumption A-007: "Training data is representative of domain; human feedback may evolve as reviewer understanding improves across iterations"
  - No code changes required (existing implementation already iteration-scoped)

- [x] T126 [P] Document 0-byte and non-CSV file upload handling (CHK012):
  - Update T037 (CSVUploader component) acceptance criteria:
    - Reject files <10 bytes with error: "File is empty or corrupted"
    - Reject files without .csv extension with error: "Only CSV files are accepted"
    - Reject files that fail CSV parsing with error showing first parse error
  - Update src/lib/csv-parser.ts to validate file size and content type
  - Add tests in tests/unit/csv-parser-edge-cases.test.ts:
    - 0-byte file
    - 1-byte file
    - Non-CSV file (e.g., .txt, .json)
    - Valid CSV with 0 data rows (header only)

- [x] T127 [P] Clarify empty input field handling (CHK013):
  - Update FR-004 to explicitly state: "System MUST reject CSV rows where input OR expected_output fields are empty strings, whitespace-only, or null"
  - Add to csv-parser.ts validation: `row.input.trim() === '' || row.expected_output.trim() === ''`
  - Update error message: "Row {N} rejected: input and expected_output must be non-empty"
  - Add tests for: empty string, whitespace-only, tab-only, newline-only fields

- [x] T128 [P] Document timezone handling for iteration timestamps (CHK014):
  - Update data-model.md to specify: "All timestamps stored in UTC (ISO 8601 format with Z suffix)"
  - Update database schema to use: `created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))`
  - Update UI to display timestamps in user's local timezone using JavaScript `toLocaleString()`
  - Add to spec.md Edge Cases: "Iteration timestamps are stored in UTC to ensure consistent sorting across timezones; UI displays in user's local time"
  - Add tests in tests/integration/timestamp-handling.test.ts verifying UTC storage and local display

**Acceptance Criteria**:

- Contradictory feedback behavior explicitly documented
- File upload validates size, type, and content
- Empty field handling explicitly rejects whitespace-only values
- All timestamps stored in UTC, displayed in local timezone
- Edge case tests added with >80% coverage

---

### Zero-State UI Requirements

- [ ] T129 Document zero-state UI requirements for all pages:
  - **Personas List (no personas)**: Display empty state with:
    - Illustration or icon
    - Heading: "No Judge Personas Yet"
    - Description: "Create your first judge persona to start training AI evaluators"
    - "Create New Persona" button (primary action)

  - **Training Data Tab (no pairs uploaded)**: Display empty state with:
    - Heading: "No Training Data"
    - Description: "Upload a CSV file with input/output pairs to begin training"
    - "Upload CSV" button
    - Link to CSV format documentation

  - **Training Progress (no iterations)**: Display empty state with:
    - Heading: "Training Not Started"
    - Description: "Upload training data, then start your first iteration"
    - "Go to Training Data" button (if no data)
    - "Start Training" button (if data exists)

  - **Metrics Dashboard (no metrics)**: Display empty state with:
    - Heading: "No Metrics Available"
    - Description: "Complete at least one iteration to see performance metrics"

  - **Judge Prompts History (no versions)**: Display empty state with:
    - Heading: "No Prompt History"
    - Description: "Prompt versions will appear here after iterations with refinements"

- [ ] T130 [P] Implement zero-state components:
  - Create src/components/EmptyState.astro as reusable component
  - Props: `{title: string, description: string, actionLabel?: string, actionHref?: string, iconName?: string}`
  - Update all pages to use EmptyState when no data exists
  - Add tests in tests/e2e/zero-states.test.ts verifying each empty state displays

**Acceptance Criteria**:

- Zero-state requirements documented for all major pages
- EmptyState component implemented and reusable
- All pages display helpful empty states
- E2E tests verify empty states appear when expected

---

### UI/UX Consistency

- [ ] T131 [P] Validate MetricCard trend indicator consistency (CHK018):
  - Review existing Evaluations module MetricCard implementation
  - Document trend logic: ↑ (current > previous), ↓ (current < previous), → (current == previous)
  - For F1/precision/recall: ↑ is good (green), ↓ is bad (red)
  - For error rate: ↑ is bad (red), ↓ is good (green)
  - Update src/components/MetricCard.astro to match existing pattern
  - Add prop: `higherIsBetter: boolean` to control color logic
  - Add tests verifying trend indicators match existing module

- [ ] T132 [P] Define Previous/Next navigation edge case behavior (CHK019):
  - Document in T050 acceptance criteria:
    - "Previous" button on first decision: disabled/grayed out (not hidden)
    - "Next" button on last decision: disabled/grayed out (not hidden)
    - Keyboard navigation: Left arrow = previous, Right arrow = next
    - URL updates with decision index: `/review/{iteration}/{index}`
    - After reviewing last decision, show "All decisions reviewed" message
  - Implement navigation logic in src/pages/personas/[id]/review/[iteration].astro
  - Add tests in tests/e2e/human-review.test.ts

- [ ] T133 [P] Document validation error display patterns (CHK020):
  - Define standard error display locations:
    - **Form validation errors**: Inline below field with red text and icon
    - **API submission errors**: Toast notification (top-right) with error message
    - **CSV upload errors**: Inline in upload component with error details
    - **Critical errors (500)**: Modal dialog with error message and "Retry" button
  - Document in IMPLEMENTATION.md or new UX_PATTERNS.md
  - Update all forms to follow inline validation pattern
  - Update all API calls to use toast notifications
  - Add tests verifying error display locations

**Acceptance Criteria**:

- MetricCard trend logic matches existing Evaluations module
- Previous/Next navigation edge cases explicitly defined and tested
- Validation error patterns documented and consistently applied
- UI tests verify consistency with existing patterns

---

### Integration & Validation

- [ ] T134 Update mvp-sanity.md checklist:
  - Mark all addressed items as [X] completed
  - Add verification notes for each task completion
  - Update checklist status to "PASS" when all items complete

- [ ] T135 Create comprehensive edge case test suite tests/integration/specification-gaps.test.ts:
  - Test all edge cases from CHK011-CHK014
  - Test all error response formats from T120
  - Test retry logic with exponential backoff from T121
  - Test prompt versioning whitespace normalization from T123
  - Verify >80% coverage on all gap areas

- [ ] T136 Update specification documents:
  - Update spec.md with all clarifications (FR-015, FR-016, FR-018, Edge Cases)
  - Update data-model.md with state machine diagram and UTC timestamps
  - Update tasks.md to mark Phase 11 tasks complete
  - Update API.md (or create if missing) with error code reference

**Acceptance Criteria**:

- mvp-sanity.md shows 100% pass rate (20/20 items)
- All specification gaps documented in spec.md
- Edge case test suite passes with >80% coverage
- Documentation updated and consistent

---

## Phase 11 Summary

**Total Tasks**: 20 (T117-T136)
**Estimated Effort**: ~3 days
**Dependencies**: Can run in parallel with other phases; does not block MVP delivery
**Priority**: Medium (technical debt; improves production readiness but not blocking)

**Parallel Execution Opportunities**:

- All documentation tasks (T117, T118, T120, T121, T123-T128, T129, T131-T133, T136) can run in parallel
- Test tasks (T119, T122, T130, T135) can run after their corresponding documentation tasks complete
- Implementation tasks (T120, T121, T126-T128, T130-T133) can run after documentation complete

**Success Definition**:

- ✅ All 20 mvp-sanity.md checklist items pass
- ✅ API error responses standardized with documented error codes
- ✅ Exponential backoff parameters explicitly quantified
- ✅ All edge cases have explicit handling requirements
- ✅ UI/UX patterns consistent with existing modules
- ✅ Zero-state UI implemented for all major pages
- ✅ Documentation updated with all clarifications

---

## Phase 12: UX Improvement - Async Metrics Calculation

_Implement async experience for metrics calculation with live progress updates and redirect flow_

**Phase Goal**: When user clicks "Calculate Metrics" button, redirect to metrics page showing "Training in progress" message and update page in real-time as each iteration completes.

**Context**: User Story 5 (Track Training Progress) requires real-time metrics updates. Currently, metrics calculation may block the UI. This phase decouples the calculation from the UI with proper async/await handling and live polling or WebSocket updates.

**Independent Test Criteria**:

- User clicks calculate-metrics-btn on review page
- User redirected to `/personas/${personaId}/metrics` immediately
- Page displays "The training in progress" message
- Page auto-updates when metrics calculation completes
- If multiple iterations remain, page continues polling and shows progress for next iterations
- Loading spinner displays while waiting for each iteration
- No page freezing or blocking during calculation
- E2E test: trigger metrics calculation → redirect → verify real-time updates

---

### Backend API Enhancement

- [x] T137 [P] Create test file tests/integration/calculate-metrics-async.test.ts for async metrics calculation:
  - Test POST /api/personas/{personaId}/iterations/{iteration}/calculate-metrics returns immediately (200 OK)
  - Test response includes status indicating "in_progress" or "completed"
  - Test GET /api/personas/{personaId}/iterations/{iteration}/status returns current progress
  - Test multiple concurrent calls don't interfere
  - Test API returns 202 Accepted when metrics calculation is queued

- [x] T138 Create src/pages/api/personas/[id]/iterations/[num]/calculate-metrics.ts implementing:
  - POST endpoint: Accept metrics calculation request, return 202 Accepted immediately (async)
  - **Do NOT block on calculation completion**
  - Store calculation state in training_loop_state table with status: "calculating_metrics"
  - Queue background task to calculate metrics using existing metrics.ts module
  - Return response with `{status: "in_progress", iteration: number, persona_id: string}`
  - Error handling: Return 400 for invalid persona/iteration, 409 for duplicate calculation in progress

- [x] T139 [P] Create test file tests/integration/metrics-status-endpoint.test.ts for status polling:
  - Test GET /api/personas/{personaId}/iterations/{iteration}/status returns current metrics
  - Test status includes: f1_score, precision, recall, cohens_kappa, true_positives, false_positives, etc.
  - Test status updates as calculation progresses
  - Test completed status is persistent (doesn't reset on multiple GETs)

- [x] T140 Create src/pages/api/personas/[id]/iterations/[num]/status.ts implementing:
  - GET endpoint: Return current metrics calculation status
  - If calculation in progress: Return `{status: "calculating", progress_percent: number, message: "The training in progress"}`
  - If calculation complete: Return `{status: "completed", metrics: IterationMetrics, duration_ms: number}`
  - If calculation failed: Return `{status: "error", message: string}`

---

### Frontend UI Components

- [x] T141 [P] Create test file tests/e2e/async-metrics-calculation.test.ts for end-to-end async flow:
  - Navigate to human review page for iteration 1
  - Complete human review
  - Click "Calculate Metrics" button
  - Verify redirect to /personas/{personaId}/metrics
  - Verify "The training in progress" message appears
  - Verify loading spinner visible
  - Wait for metrics to complete and verify update
  - Verify F1 score, precision, recall, Cohen's Kappa display correctly

- [x] T142 Create src/components/MetricsCalculationProgress.astro implementing:
  - Display "The training in progress" message prominently
  - Show loading spinner/animated indicator
  - Display current calculation status (e.g., "Calculating metrics...", "Refining prompts...")
  - Show estimated time remaining (if available)
  - Message styling: alert/info box using daisyUI (e.g., alert-info with appropriate coloring)
  - Props: `status: string, message: string, progressPercent?: number`

- [x] T143 [P] Create test file tests/unit/metrics-polling-hook.test.ts for client-side polling logic:
  - Test polling interval correctly waits between API calls
  - Test stops polling when status is "completed"
  - Test handles API errors gracefully
  - Test updates component state when metrics arrive
  - Test cleanup function clears intervals on unmount

- [x] T144 Create src/lib/metrics-polling-hook.ts implementing:
  - **useMetricsPolling(personaId, iteration)**: React/Astro hook for polling metrics status
  - Initial state: `{status: "calculating", message: "The training in progress"}`
  - Poll endpoint: GET /api/personas/{personaId}/iterations/{iteration}/status
  - Poll interval: 1 second initially, back off to 2 seconds if no change
  - Stop polling when status === "completed" or "error"
  - Return: `{status, metrics, isLoading, error, stopPolling}`
  - Error handling: Retry up to 3 times before showing error message

---

### Page Integration

- [x] T145 [P] Update src/pages/personas/[id]/review/[iteration].astro to implement async metrics:
  - Find "Calculate Metrics" button (calculate-metrics-btn)
  - Add click handler that calls POST /api/personas/{personaId}/iterations/{iteration}/calculate-metrics
  - On response, redirect to `/personas/${personaId}/metrics?iteration=${iteration}`
  - Do NOT wait for calculation to complete; redirect immediately (202 response handling)
  - Add loading state while redirect is happening
  - Keep existing validation and error handling

- [x] T146 Create/Update src/pages/personas/[id]/metrics.astro implementing:
  - Accept query parameter: `?iteration={number}` to focus on specific iteration
  - If iteration is in progress (from calculate-metrics endpoint response):
    - Display MetricsCalculationProgress component
    - Use metrics-polling-hook to poll status
    - On completion, refresh metrics dashboard with new data
  - If iteration is complete:
    - Display full metrics dashboard (existing from Phase 7)
    - Show metrics for specified iteration (or latest if not specified)
  - If no iterations exist:
    - Display empty state: "No Metrics Available"

- [x] T147 [P] Create test file tests/e2e/metrics-redirect-flow.test.ts for redirect and polling:
  - Navigate to review page
  - Click "Calculate Metrics" button
  - Verify redirect to /personas/{personaId}/metrics
  - Verify URL contains query parameter (if iteration specified)
  - Verify "The training in progress" message visible
  - Wait for completion and verify metrics displayed
  - Test going back to review page and clicking again (already in progress scenario)

---

### Error Handling & Edge Cases

- [x] T148 [P] Create test file tests/integration/metrics-calculation-errors.test.ts for error scenarios:
  - Test duplicate calculation request (already in progress): Returns 409 Conflict
  - Test invalid persona/iteration: Returns 400 Bad Request with error message
  - Test calculation timeout: Returns 500 with retry message after 30 seconds
  - Test partial metrics calculation failure: Returns 202 with partial results
  - Test network failure during polling: Retry with exponential backoff

- [x] T149 Create error handling in calculate-metrics endpoint:
  - Add 409 Conflict response if calculation already in progress for same iteration
  - Add 400 Bad Request for invalid inputs with clear error messages
  - Add timeout handling (30s max): If exceeds timeout, return 202 with status="timeout"
  - Log all errors to server console with iteration context
  - Return error message to client for display in UI

- [x] T150 Update metrics-polling-hook error handling:
  - On polling error: Show error message in UI ("Calculation failed, retrying...")
  - Retry logic: Exponential backoff (1s → 2s → 4s) up to 3 times
  - After 3 failures: Show error message and stop polling
  - Add manual "Retry" button for user-initiated retry
  - Clear error message when retry succeeds

---

### Documentation & Testing

- [x] T151 [P] Create documentation file docs/METRICS_ASYNC_UX.md explaining:
  - Architecture: How async metrics calculation works (202 Accepted pattern)
  - Client-side polling: Interval, backoff, stop conditions
  - User experience flow: Click button → redirect → see progress → auto-update
  - Error recovery: What happens on failures, retry behavior
  - API contract: Request/response format for calculate-metrics endpoint
  - Testing: How to test async behavior in E2E tests

- [x] T152 Create comprehensive test summary file tests/e2e/async-metrics-suite.test.ts covering:
  - Happy path: Calculate metrics → redirect → see progress → completed
  - Error path: Calculation fails → show error → user retries
  - Concurrent path: Multiple iterations calculating → show progress for each
  - Edge case: User navigates away during calculation → polling stops
  - Edge case: Browser tab closed during calculation → state preserved in backend
  - Verify no console errors during entire flow

**Acceptance Criteria**:

- User clicks "Calculate Metrics" button and is immediately redirected to metrics page
- Page displays "The training in progress" message while calculating
- Page auto-updates when metrics calculation completes (via polling)
- Multiple iterations update sequentially without user intervention
- No page freeze or blocking during calculation
- Errors handled gracefully with retry options
- API returns 202 Accepted for async operations
- Polling stops when calculation complete
- E2E tests verify complete async flow
- Documentation explains architecture and UX patterns

---

## Phase 12 Summary

**Total Tasks**: 16 (T137-T152) - **ALL COMPLETED**
**Status**: ✅ Complete
**Dependencies**: Requires Phase 7 (metrics dashboard), Phase 5 (iteration completion)
**Priority**: Medium (UX improvement; enhances user experience without blocking core functionality)

**Files Created**:

| Category | Files |
|----------|-------|
| API Endpoints | `src/pages/api/personas/[id]/iterations/[num]/calculate-metrics.ts`, `src/pages/api/personas/[id]/iterations/[num]/status.ts` |
| Components | `src/components/MetricsCalculationProgress.astro`, `src/components/ConfusionMatrix.astro` |
| Pages | `src/pages/personas/[id]/metrics.astro`, `src/pages/personas/[id]/review/[iteration].astro` |
| Library | `src/lib/metrics-polling-hook.ts` |
| Tests | 6 test files (unit, integration, E2E) |
| Documentation | `docs/METRICS_ASYNC_UX.md` |

**Key Features Implemented**:

- ✅ POST `/calculate-metrics` returns 202 Accepted immediately (non-blocking)
- ✅ GET `/status` provides `calculating`/`completed`/`error` states
- ✅ Client polling with exponential backoff (1s → 2s)
- ✅ Progress bar during calculation
- ✅ Automatic page reload on completion
- ✅ Retry button on error
- ✅ Confusion matrix visualization
- ✅ Added `CALCULATION_IN_PROGRESS` error code

**Success Definition**:

- ✅ Async metrics calculation returns 202 Accepted immediately
- ✅ User redirected to metrics page within <500ms
- ✅ "The training in progress" message displays clearly
- ✅ Page auto-updates every 1-2 seconds via polling
- ✅ Calculation completion shows metrics without page refresh
- ✅ Errors handled gracefully with retry mechanism
- ✅ No console errors or warnings during flow
- ✅ E2E tests verify complete async workflow
- ✅ Zero page freezing or blocking during async operations

---

**Next Phase**: Phase 13+ can add WebSocket real-time updates (if polling proves insufficient), advanced progress visualization, or batch metrics calculations for multiple iterations.
