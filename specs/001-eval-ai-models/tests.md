# Test Tasks: AI Model Evaluation Framework

**Input**: Current implementation state in src/lib/, src/pages/api/, src/components/
**Prerequisites**: Implementation complete, E2E tests exist, missing unit/contract tests
**Feature Branch**: `001-eval-ai-models`

**Purpose**: This file contains ONLY the missing test tasks needed to satisfy Constitution Principle II (>80% coverage on critical paths). Implementation is already complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Current Implementation Status

**✅ Already Implemented**:

- Database schema (db/schema.sql, db/init.js)
- Core business logic (src/lib/evaluator.ts, accuracy.ts, api-clients.ts, validators.ts, db.ts, semanticSimilarity.ts)
- All API routes (src/pages/api/\*)
- All UI components (src/components/\*)
- E2E tests (tests/e2e/layout.spec.ts, models-ui.spec.ts, results-ui.spec.ts)

**⚠️ Missing (Constitution Principle II Gap)**:

- Unit tests for src/lib/ files
- Contract tests for API endpoints
- Integration tests

---

## Phase 1: Contract Tests (API Validation) 🔴 CRITICAL

**Purpose**: Verify all API endpoints match the OpenAPI specification in contracts/openapi.yaml

**Why Critical**: Constitution Principle III (UX Consistency) requires APIs match documented contracts. These tests validate that promise.

### Model Management API (User Story 1)

- [x] T001 [P] [US1] Contract test for POST /api/models in tests/contract/models.test.ts
- [x] T002 [P] [US1] Contract test for GET /api/models in tests/contract/models.test.ts
- [x] T003 [P] [US1] Contract test for GET /api/models/:id in tests/contract/models.test.ts
- [x] T004 [P] [US1] Contract test for PATCH /api/models/:id in tests/contract/models.test.ts
- [x] T005 [P] [US1] Contract test for DELETE /api/models/:id in tests/contract/models.test.ts

### Evaluation API (User Story 1)

- [x] T006 [P] [US1] Contract test for POST /api/evaluate in tests/contract/evaluate.test.ts
- [x] T007 [P] [US1] Contract test for GET /api/evaluation-status in tests/contract/evaluate.test.ts
- [x] T008 [P] [US1] Contract test for POST /api/cancel-evaluation in tests/contract/evaluate.test.ts
- [x] T009 [P] [US1] Contract test for GET /api/results in tests/contract/results.test.ts

### Templates API (User Story 2)

- [x] T010 [P] [US2] Contract test for POST /api/templates in tests/contract/templates.test.ts
- [x] T011 [P] [US2] Contract test for GET /api/templates in tests/contract/templates.test.ts
- [x] T012 [P] [US2] Contract test for GET /api/templates/:id in tests/contract/templates.test.ts
- [x] T013 [P] [US2] Contract test for PATCH /api/templates/:id in tests/contract/templates.test.ts
- [x] T014 [P] [US2] Contract test for DELETE /api/templates/:id in tests/contract/templates.test.ts
- [x] T015 [P] [US2] Contract test for POST /api/templates/:id/run in tests/contract/templates.test.ts

**Test Requirements**:

- Validate request schema matches OpenAPI spec
- Validate response schema matches OpenAPI spec
- Verify status codes: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 409 Conflict, 500 Internal Error
- Validate error format: `{ error, message, field?, details? }`
- Use actual HTTP requests to test endpoints

**Checkpoint**: All 15 API endpoints validated against OpenAPI spec

---

## Phase 2: Unit Tests for Validators (Input Validation) 🔴 CRITICAL

**Purpose**: Achieve >80% coverage on src/lib/validators.ts per Constitution Principle II

**Why Critical**: Validators are the security boundary - invalid data must not reach business logic

**File Under Test**: src/lib/validators.ts

### Model Validation

- [x] T016 [P] [US1] Unit test validateCreateModel - valid input in tests/unit/validators.test.ts
- [x] T017 [P] [US1] Unit test validateCreateModel - missing required fields in tests/unit/validators.test.ts
- [x] T018 [P] [US1] Unit test validateCreateModel - invalid provider enum in tests/unit/validators.test.ts
- [x] T019 [P] [US1] Unit test validateCreateModel - invalid model_name length in tests/unit/validators.test.ts
- [x] T020 [P] [US1] Unit test validateUpdateModel - valid partial update in tests/unit/validators.test.ts
- [x] T021 [P] [US1] Unit test validateUpdateModel - invalid field types in tests/unit/validators.test.ts

### Evaluation Validation

- [x] T022 [P] [US1] Unit test validateCreateEvaluation - valid input in tests/unit/validators.test.ts
- [x] T023 [P] [US1] Unit test validateCreateEvaluation - missing instruction_text in tests/unit/validators.test.ts
- [x] T024 [P] [US1] Unit test validateCreateEvaluation - instruction_text exceeds 10000 chars in tests/unit/validators.test.ts
- [x] T025 [P] [US3] Unit test validateCreateEvaluation - invalid accuracy_rubric enum in tests/unit/validators.test.ts
- [x] T026 [P] [US3] Unit test validateCreateEvaluation - partial_credit with missing concepts array in tests/unit/validators.test.ts
- [x] T027 [P] [US1] Unit test validateCreateEvaluation - empty model_ids array in tests/unit/validators.test.ts

### Template Validation

- [x] T028 [P] [US2] Unit test validateCreateTemplate - valid template in tests/unit/validators.test.ts
- [x] T029 [P] [US2] Unit test validateCreateTemplate - missing name field in tests/unit/validators.test.ts
- [x] T030 [P] [US2] Unit test validateCreateTemplate - name exceeds 100 chars in tests/unit/validators.test.ts

**Coverage Target**: >80% line coverage, 100% branch coverage

**Checkpoint**: Input validation layer has comprehensive test coverage

---

## Phase 3: Unit Tests for Accuracy Scoring (Business Logic) 🔴 CRITICAL

**Purpose**: Verify accuracy rubric calculations per SC-004 (reproducibility) - same input = same score

**Why Critical**: Accuracy scoring is core to User Story 3 value proposition

**Files Under Test**: src/lib/accuracy.ts, src/lib/semanticSimilarity.ts

### Exact Match Rubric

- [x] T031 [P] [US3] Unit test exactMatch - exact match returns 100 in tests/unit/accuracy.test.ts
- [x] T032 [P] [US3] Unit test exactMatch - no match returns 0 in tests/unit/accuracy.test.ts
- [x] T033 [P] [US3] Unit test exactMatch - case sensitivity in tests/unit/accuracy.test.ts
- [x] T034 [P] [US3] Unit test exactMatch - whitespace handling in tests/unit/accuracy.test.ts

### Partial Credit Rubric

- [x] T035 [P] [US3] Unit test partialCredit - all concepts present returns 100 in tests/unit/accuracy.test.ts
- [x] T036 [P] [US3] Unit test partialCredit - no concepts present returns 0 in tests/unit/accuracy.test.ts
- [x] T037 [P] [US3] Unit test partialCredit - partial concepts returns proportional score in tests/unit/accuracy.test.ts
- [x] T038 [P] [US3] Unit test partialCredit - case insensitive concept matching in tests/unit/accuracy.test.ts
- [x] T039 [P] [US3] Unit test partialCredit - empty concepts array handling in tests/unit/accuracy.test.ts

### Semantic Similarity Rubric

- [x] T040 [P] [US3] Unit test semanticSimilarity - identical text returns 100 in tests/unit/accuracy.test.ts
- [x] T041 [P] [US3] Unit test semanticSimilarity - completely different text returns low score in tests/unit/accuracy.test.ts
- [x] T042 [P] [US3] Unit test semanticSimilarity - similar meaning returns high score in tests/unit/accuracy.test.ts
- [x] T043 [P] [US3] Unit test semanticSimilarity - error handling for API failures in tests/unit/accuracy.test.ts

### Main Calculation Function

- [x] T044 [P] [US3] Unit test calculateAccuracy - dispatches to correct rubric in tests/unit/accuracy.test.ts
- [x] T045 [P] [US3] Unit test calculateAccuracy - includes reasoning in response in tests/unit/accuracy.test.ts

**Coverage Target**: >80% line coverage, verify SC-004 (reproducibility)

**Checkpoint**: All three accuracy rubrics tested and proven correct

---

## Phase 4: Unit Tests for Evaluator (Orchestration) 🔴 CRITICAL

**Purpose**: Verify multi-model orchestration meets SC-001 (30s for 3+ models) and SC-002 (±5% time accuracy)

**Why Critical**: Evaluator is the core orchestration engine for User Story 1

**File Under Test**: src/lib/evaluator.ts

### Basic Execution

- [x] T046 [P] [US1] Unit test evaluateModels - single model completes successfully in tests/unit/evaluator.test.ts
- [x] T047 [P] [US1] Unit test evaluateModels - multiple models run in parallel in tests/unit/evaluator.test.ts

### Timeout Handling

- [x] T048 [P] [US1] Unit test evaluateModels - 30-second per-model timeout enforced in tests/unit/evaluator.test.ts
- [x] T049 [P] [US1] Unit test evaluateModels - timed-out model marked as Failed in tests/unit/evaluator.test.ts
- [x] T050 [P] [US1] Unit test evaluateModels - other models continue after one times out in tests/unit/evaluator.test.ts

### Performance & Reliability

- [x] T051 [P] [US1] Unit test evaluateModels - execution time accuracy within ±5% (SC-002) in tests/unit/evaluator.test.ts
- [x] T052 [P] [US1] Unit test evaluateModels - cancellation support in tests/unit/evaluator.test.ts
- [x] T053 [P] [US1] Unit test evaluateModels - database persistence of results in tests/unit/evaluator.test.ts

### Error Handling

- [x] T054 [P] [US1] Unit test evaluateModels - error handling for API failures in tests/unit/evaluator.test.ts
- [x] T055 [P] [US1] Unit test evaluateModels - rate limit error (HTTP 429) handling in tests/unit/evaluator.test.ts

**Coverage Target**: >80% line coverage, verify SC-001 and SC-002

**Checkpoint**: Evaluation orchestration proven reliable and performant

---

## Phase 5: Unit Tests for API Clients (Provider Integration)

**Purpose**: Verify API client abstraction for OpenAI, Anthropic, Google providers

**Why Needed**: Ensures consistent interface across all three model providers

**File Under Test**: src/lib/api-clients.ts

### OpenAI Client

- [x] T056 [P] [US1] Unit test OpenAIClient - successful evaluation in tests/unit/api-clients.test.ts
- [x] T057 [P] [US1] Unit test OpenAIClient - token count extraction in tests/unit/api-clients.test.ts
- [x] T058 [P] [US1] Unit test OpenAIClient - error handling (API error, timeout) in tests/unit/api-clients.test.ts

### Anthropic Client

- [x] T059 [P] [US1] Unit test AnthropicClient - successful evaluation in tests/unit/api-clients.test.ts
- [x] T060 [P] [US1] Unit test AnthropicClient - token count extraction in tests/unit/api-clients.test.ts
- [x] T061 [P] [US1] Unit test AnthropicClient - error handling in tests/unit/api-clients.test.ts

### Google Client

- [x] T062 [P] [US1] Unit test GoogleClient - successful evaluation in tests/unit/api-clients.test.ts
- [x] T063 [P] [US1] Unit test GoogleClient - token count handling (N/A case) in tests/unit/api-clients.test.ts
- [x] T064 [P] [US1] Unit test GoogleClient - error handling in tests/unit/api-clients.test.ts

### Client Factory

- [x] T065 [P] [US1] Unit test createClient - dispatches to correct provider in tests/unit/api-clients.test.ts
- [x] T066 [P] [US1] Unit test createClient - throws error for unknown provider in tests/unit/api-clients.test.ts

**Coverage Target**: >70% line coverage (external API mocks acceptable)

**Checkpoint**: All three provider clients tested and consistent

---

## Phase 6: Unit Tests for Database Layer

**Purpose**: Verify CRUD operations, encryption, and constraints in database layer

**Why Needed**: Database layer handles persistence and API key encryption (security critical)

**File Under Test**: src/lib/db.ts

### Model Configuration CRUD

- [x] T067 [P] [US1] Unit test insertModel - successful insert in tests/unit/db.test.ts
- [x] T068 [P] [US1] Unit test insertModel - API key encryption in tests/unit/db.test.ts
- [x] T069 [P] [US1] Unit test insertModel - duplicate (provider, model_name) constraint in tests/unit/db.test.ts
- [x] T070 [P] [US1] Unit test getModelById - returns model with decrypted key in tests/unit/db.test.ts
- [x] T071 [P] [US1] Unit test getModelById - returns null for non-existent ID in tests/unit/db.test.ts
- [x] T072 [P] [US1] Unit test updateModel - successful partial update in tests/unit/db.test.ts
- [x] T073 [P] [US1] Unit test deleteModel - successful deletion in tests/unit/db.test.ts
- [x] T074 [P] [US1] Unit test deleteModel - constraint violation (active evaluations) in tests/unit/db.test.ts

### Evaluation CRUD

- [x] T075 [P] [US1] Unit test insertEvaluation - successful insert with status pending in tests/unit/db.test.ts
- [x] T076 [P] [US1] Unit test updateEvaluationStatus - transitions pending → running → completed in tests/unit/db.test.ts
- [x] T077 [P] [US1] Unit test insertResult - links to evaluation and model in tests/unit/db.test.ts
- [x] T078 [P] [US1] Unit test getResultsByEvaluationId - returns all results for evaluation in tests/unit/db.test.ts

### Template CRUD

- [x] T079 [P] [US2] Unit test insertTemplate - successful insert with model_ids JSON array in tests/unit/db.test.ts
- [x] T080 [P] [US2] Unit test getTemplateById - returns template with parsed model_ids in tests/unit/db.test.ts
- [x] T081 [P] [US2] Unit test updateTemplate - successful update in tests/unit/db.test.ts
- [x] T082 [P] [US2] Unit test deleteTemplate - successful deletion in tests/unit/db.test.ts

**Coverage Target**: >75% line coverage

**Checkpoint**: Database layer tested - CRUD, encryption, constraints verified

---

## Phase 7: Documentation Validation

**Purpose**: Verify quickstart.md flows work end-to-end and documentation is accurate

**Why Needed**: Ensures new users can successfully set up and use the system

### Quickstart Workflows

- [ ] T083 [P] Validate quickstart.md setup steps in /Users/ivan/Works/AI/eval
- [ ] T084 [P] Validate quickstart.md User Workflow Step 1 (Add Models via API) in /Users/ivan/Works/AI/eval
- [ ] T085 [P] Validate quickstart.md User Workflow Step 2 (Submit Evaluation via API) in /Users/ivan/Works/AI/eval
- [ ] T086 [P] Validate quickstart.md User Workflow Step 3 (Poll Status via API) in /Users/ivan/Works/AI/eval
- [ ] T087 [P] Validate quickstart.md User Workflow Step 4 (View Results via API) in /Users/ivan/Works/AI/eval
- [ ] T088 [P] Validate quickstart.md Advanced: Save and Reuse Templates in /Users/ivan/Works/AI/eval

### Constitution Update

- [x] T089 [P] Update AGENTS.md with test coverage achieved and Constitution gaps closed
- [x] T090 [P] Verify all Constitution Principle II gaps are resolved in plan.md

**Checkpoint**: Documentation validated and Constitution compliance verified

---

## Phase 8: Coverage Analysis & Reporting

**Purpose**: Measure and document coverage against Constitution Principle II (>80% critical paths)

**Why Needed**: Prove Constitution compliance and identify remaining gaps

### Individual File Coverage

- [x] T091 Run Vitest with coverage report for src/lib/validators.ts
- [x] T092 Run Vitest with coverage report for src/lib/accuracy.ts
- [x] T093 Run Vitest with coverage report for src/lib/evaluator.ts
- [x] T094 Run Vitest with coverage report for src/lib/api-clients.ts
- [x] T095 Run Vitest with coverage report for src/lib/db.ts

### Combined Reporting

- [x] T096 Generate combined coverage report (HTML + JSON)
- [x] T097 Verify >80% line coverage for validators.ts, accuracy.ts, evaluator.ts (CRITICAL PATHS)
- [x] T098 Document coverage gaps (if any) and create follow-up tasks
- [x] T099 Update plan.md Constitution Check table with PASS status for Principle II
- [ ] T100 Commit coverage report artifacts to repository

**Coverage Targets**:

- ✅ validators.ts: >80% line, 100% branch
- ✅ accuracy.ts: >80% line, >80% branch
- ✅ evaluator.ts: >80% line, >80% branch
- ⚠️ api-clients.ts: >70% line
- ⚠️ db.ts: >75% line

**Checkpoint**: Constitution Principle II satisfied - test coverage documented

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Contract) ──┐
Phase 2 (Validators) ├── No dependencies - can all run in parallel
Phase 3 (Accuracy)   ├──┘
Phase 5 (API Clients)│
Phase 6 (Database)   ┘

Phase 4 (Evaluator) ──── Depends on Phase 3 (uses accuracy functions)

Phase 7 (Docs) ────────── Depends on Phases 1-6 (validates complete system)

Phase 8 (Coverage) ────── Depends on Phases 1-6 (analyzes all tests)
```

### User Story Coverage

**User Story 1** (Compare Model Performance):

- Contract: T001-T009
- Validators: T016-T027
- Evaluator: T046-T055
- API Clients: T056-T066
- Database: T067-T078

**User Story 2** (Save and Rerun Templates):

- Contract: T010-T015
- Validators: T028-T030
- Database: T079-T082

**User Story 3** (Accuracy Evaluation):

- Validators: T025-T026
- Accuracy: T031-T045

### Parallel Execution Examples

**Maximum parallelization** within each phase:

```bash
# Phase 1: All 15 contract tests in parallel
npm test tests/contract/*.test.ts

# Phase 2: All 15 validator tests in parallel
npm test tests/unit/validators.test.ts

# Phase 3: All 15 accuracy tests in parallel
npm test tests/unit/accuracy.test.ts

# Phase 4: All 10 evaluator tests in parallel (after Phase 3)
npm test tests/unit/evaluator.test.ts

# Phase 5: All 11 API client tests in parallel
npm test tests/unit/api-clients.test.ts

# Phase 6: All 16 database tests in parallel
npm test tests/unit/db.test.ts
```

**Cross-phase parallelization**:

- Phases 1, 2, 3, 5, 6 can run simultaneously
- Phase 4 waits for Phase 3
- Phases 7, 8 wait for Phases 1-6

---

## Implementation Strategy

### Week 1: Contract Tests (Phase 1)

- Write all 15 contract tests (T001-T015)
- Validates APIs match OpenAPI spec
- Can run in parallel across team
- **Deliverable**: API contract validation complete

### Week 2: Critical Path Unit Tests (Phases 2-4)

- Day 1-2: Validators (T016-T030)
- Day 3-4: Accuracy (T031-T045)
- Day 5: Evaluator (T046-T055)
- **Deliverable**: >80% coverage on critical paths (Constitution requirement met)

### Week 3: Remaining Unit Tests (Phases 5-6)

- Day 1-2: API Clients (T056-T066)
- Day 3-4: Database (T067-T082)
- **Deliverable**: Complete test suite coverage

### Week 4: Validation & Reporting (Phases 7-8)

- Day 1-2: Documentation validation (T083-T090)
- Day 3-4: Coverage analysis (T091-T100)
- **Deliverable**: Constitution compliance verified and documented

### Single Developer Timeline

- **Total Effort**: 10-12 working days
- **Calendar Time**: 2-3 weeks
- **Critical Path**: Contract → Validators/Accuracy → Evaluator → Coverage

### Team Parallelization (3 developers)

- **Week 1**: All phases 1-6 in parallel
- **Week 2**: Phases 7-8 together
- **Total Time**: 1.5-2 weeks

---

## Notes

- **[P] marker**: Tasks can run in parallel within their phase
- **Test Coverage**: Focus on critical paths first (validators, accuracy, evaluator)
- **Constitution Compliance**: Phases 1-6 required to satisfy Principle II
- **Documentation**: Phase 7 ensures quickstart.md is accurate and executable
- **Reporting**: Phase 8 provides evidence of compliance
- **Commit Strategy**: Commit after each phase completion
- **Stop Points**: After Phase 1 (contracts done), Phase 4 (critical paths done), Phase 8 (complete)

---

## Summary

**Total Tasks**: 100

- Contract Tests: 15
- Unit Tests: 67 (validators: 15, accuracy: 15, evaluator: 10, api-clients: 11, database: 16)
- Documentation: 8
- Coverage Reporting: 10

**Parallel Opportunities**: 82 tasks marked [P]

**Constitution Gates**:

- ✅ Phase 1: API contracts validated (Principle III)
- ✅ Phase 4: Critical paths >80% coverage (Principle II)
- ✅ Phase 8: Full compliance documented

**MVP Readiness**:
User Story 1 implementation is complete but cannot claim MVP "done" until:

- ✅ T001-T009 (contract tests)
- ✅ T016-T027 (validator tests)
- ✅ T046-T055 (evaluator tests)
- ✅ T056-T066 (API client tests)
- ✅ T067-T078 (database tests)
- ✅ >80% coverage verified

Once these tests pass, MVP satisfies all Constitution requirements and is ready for deployment.
