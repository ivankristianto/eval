---
description: "Task list for implementing optional system prompt and temperature configuration feature"
---

# Tasks: Add Optional System Prompt and Temperature Configuration for Evaluations

**Input**: Design documents from `/specs/006-prompt-temperature-config/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)
**Branch**: `006-prompt-temperature-config`

**Tests**: Tasks include unit, integration, and E2E tests per Constitution Principle II (80%+ coverage requirement). Tests are written FIRST and verified to FAIL before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. All user stories can begin after Foundational phase completes.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2], [US3], [US4])
- Include exact file paths in descriptions

## Path Conventions

Single Astro project: `src/`, `tests/` at repository root
- Components: `src/components/`
- Library: `src/lib/`
- API routes: `src/pages/api/`
- Database: `db/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, database schema extension, and environment setup

**⚠️ CRITICAL**: Tests for this phase MUST be written first and verified to fail before implementation

### Tests for Phase 1 Setup

- [x] T001 [P] Create validation tests in `tests/unit/validators.test.ts` with boundary cases: empty string, 4000 chars, 4001 chars for system prompt; -0.1, 0.0, 0.1, 1.5, 2.0, 2.1 for temperature
- [x] T002 [P] Create database schema tests in `tests/integration/schema.test.ts` verifying columns exist with correct types, defaults, and constraints after migration

### Implementation for Phase 1

- [x] T003 Add `system_prompt TEXT` column to Evaluation table in `db/schema.sql`
- [x] T004 Add `temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0)` column to Evaluation table in `db/schema.sql`
- [x] T005 Add `system_prompt TEXT` column to EvaluationTemplate table in `db/schema.sql`
- [x] T006 Add `temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0)` column to EvaluationTemplate table in `db/schema.sql`
- [x] T007 Add `system_prompt_used TEXT` and `temperature_used REAL` columns to Result table in `db/schema.sql` (audit fields)
- [x] T008 [P] Create validators module `src/lib/validators.ts` with exported functions: `validateSystemPrompt(text: string): { valid: boolean; error?: string }` and `validateTemperature(value: number): { valid: boolean; error?: string }`
- [x] T009 Implement system prompt validation: reject if present and (length > 4000 OR empty) in `src/lib/validators.ts`
- [x] T010 Implement temperature validation: reject if not in range [0.0, 2.0] or fails type check in `src/lib/validators.ts`

**Checkpoint**: Schema extended, validators implemented and tested - foundational infrastructure ready

---

## Phase 2: Foundational (Type System & API Client Modifications)

**Purpose**: Core abstractions that ALL user stories depend on - MUST complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. Tests written FIRST.

### Tests for Phase 2 Foundational

- [x] T011 [P] Create OpenAI client tests in `tests/unit/api-clients.test.ts` verifying: system prompt added to messages array as role=system, temperature passed to API request
- [x] T012 [P] Create Anthropic client tests in `tests/unit/api-clients.test.ts` verifying: system prompt passed to separate system parameter, temperature in request
- [x] T013 [P] Create Google client tests in `tests/unit/api-clients.test.ts` verifying: system prompt in systemInstruction parameter, temperature in generationConfig.temperature
- [ ] T014 [P] Create API endpoint tests in `tests/integration/api-endpoints.test.ts` verifying: POST /api/evaluate accepts system_prompt and temperature, validates both, returns 400 on invalid input

### Type System Updates

- [x] T015 [P] Update Evaluation interface in `src/lib/types.ts` to add optional fields: `system_prompt?: string` and `temperature?: number`
- [x] T016 [P] Update EvaluationTemplate interface in `src/lib/types.ts` to add optional fields: `system_prompt?: string` and `temperature?: number`
- [x] T017 [P] Update Result interface in `src/lib/types.ts` to add audit fields: `system_prompt_used?: string` and `temperature_used?: number`
- [x] T018 [P] Update CreateEvaluationRequest interface in `src/lib/types.ts` to include optional `system_prompt?: string` and `temperature?: number`
- [x] T019 [P] Update CreateTemplateRequest interface in `src/lib/types.ts` to include optional `system_prompt?: string` and `temperature?: number`

### API Client Modifications

- [x] T020 Update ModelClient interface in `src/lib/api-clients.ts` - change `evaluate(instruction: string)` signature to `evaluate(instruction: string, options?: { systemPrompt?: string; temperature?: number })`
- [x] T021 [P] Update OpenAIClient.evaluate() in `src/lib/api-clients.ts` to: construct messages array with system role message if systemPrompt provided, add temperature param to chat.completions.create request
- [x] T022 [P] Update AnthropicClient.evaluate() in `src/lib/api-clients.ts` to: add system parameter if systemPrompt provided, add temperature param to messages.create request
- [x] T023 [P] Update GoogleClient.evaluate() in `src/lib/api-clients.ts` to: add systemInstruction parameter if systemPrompt provided, add temperature to generationConfig in generateContent request
- [x] T024 Update ClientFactory.createClient() in `src/lib/api-clients.ts` to ensure updated signature is used consistently

**Checkpoint**: Type system extended, API clients updated and tested - all user stories can now start

---

## Phase 3: User Story 1 - Configure System Prompt for Advanced Control (Priority: P1) 🎯 MVP

**Goal**: Users can optionally enable system prompt input via checkbox, enter custom system instructions, save them with evaluations, and have them applied when models are called

**Independent Test**: Can be fully tested by creating an evaluation with system prompt enabled, verifying it's saved, and confirming it's applied when the evaluation runs

**User Story Acceptance Scenarios**:
1. Given I'm on the New Evaluation form, When I check the "Use System Prompt" checkbox, Then a text area appears for entering the system prompt
2. Given the system prompt text area is visible, When I enter "You are a helpful assistant" and save the evaluation, Then the system prompt is stored and used when calling the AI models
3. Given I have a saved template with a system prompt, When I create an evaluation from that template, Then the system prompt is pre-filled and used in the evaluation

### Tests for User Story 1 (Written FIRST - must FAIL before implementation)

- [ ] T025 [P] [US1] Create E2E test for system prompt checkbox toggle in `tests/e2e/evaluation-form.spec.ts`: verify checkbox hidden/visible state toggles textarea visibility
- [ ] T026 [P] [US1] Create E2E test for system prompt form submission in `tests/e2e/evaluation-form.spec.ts`: enter system prompt text, submit, verify evaluation created with system_prompt field
- [ ] T027 [P] [US1] Create integration test for system prompt in evaluation flow in `tests/integration/system-prompt.test.ts`: create evaluation with system_prompt, verify stored in DB, verify retrieved in evaluation detail
- [ ] T028 [US1] Create E2E test for system prompt application in `tests/e2e/evaluation-execution.spec.ts`: verify mock API clients receive system prompt in evaluate() call

### Implementation for User Story 1

- [x] T029 [US1] Extract system_prompt from FormData in form submission handler in `src/components/NewEvaluationModal.astro`
- [x] T030 [US1] Call validateSystemPrompt() on system_prompt value and display error if invalid in `src/components/NewEvaluationModal.astro`
- [x] T031 [US1] Add system_prompt to request body in fetch call to `/api/evaluate` in `src/components/NewEvaluationModal.astro`
- [x] T032 [P] [US1] Add checkbox control for "Use System Prompt" to NewEvaluationModal.astro form using daisyUI checkbox class
- [x] T033 [P] [US1] Add textarea for system prompt input (hidden by default) to NewEvaluationModal.astro using Tailwind CSS v4 and daisyUI styling
- [x] T034 [US1] Implement conditional visibility: show textarea only when checkbox is checked - add event listener to checkbox in `src/components/NewEvaluationModal.astro` to toggle `hidden` class on textarea container
- [x] T035 [US1] Add label and placeholder text to system prompt textarea explaining its purpose in `src/components/NewEvaluationModal.astro`
- [x] T036 [US1] Update `/api/evaluate` endpoint in `src/pages/api/evaluate.ts` to extract `system_prompt` from request body
- [x] T037 [US1] Add validation call in `/api/evaluate` to validateSystemPrompt() and return 400 error if invalid in `src/pages/api/evaluate.ts`
- [x] T038 [US1] Pass `system_prompt` to evaluator in `/api/evaluate` endpoint - update evaluator.ts orchestration function signature to accept systemPrompt parameter
- [x] T039 [US1] Update evaluation creation in database layer to store `system_prompt` in Evaluation record in `src/lib/db.ts`
- [x] T040 [US1] Update result recording to capture `system_prompt_used` from evaluation context in `src/lib/db.ts`
- [x] T040b [US1] **CRITICAL**: Populate `system_prompt_used` in Result records from evaluation's `system_prompt` when recording results in `src/lib/evaluator.ts` and `src/lib/db.ts` - audit field must be denormalized
- [x] T041 [US1] Modify evaluator.ts to pass system_prompt to each client's evaluate() call in `src/lib/evaluator.ts`
- [x] T042 [US1] Add system_prompt to evaluation detail response/display - update GET endpoint to include system_prompt field

**Checkpoint**: User Story 1 is complete and independently testable. Users can now enable/disable system prompts and have them applied to evaluations.

---

## Phase 4: User Story 2 - Adjust Temperature for Creativity Control (Priority: P1) 🎯 MVP

**Goal**: Users can adjust temperature (0.0-2.0 range, default 0.3) via slider to control response creativity, save with evaluations, and have it applied to all API calls

**Independent Test**: Can be fully tested by adjusting temperature slider to various values, saving evaluations with different temperatures, and verifying values are stored and applied

**User Story Acceptance Scenarios**:
1. Given I'm on the New Evaluation form, When I see the temperature slider, Then the default value is 0.3 and the slider range is 0.0-2.0
2. Given I adjust the temperature slider to 1.5, When I save the evaluation, Then the temperature value 1.5 is stored and used when calling the AI models
3. Given I have an existing evaluation, When I view its details, Then the temperature used is displayed alongside other evaluation metrics
4. Given I create multiple evaluations with different temperatures (0.0, 0.5, 1.5, 2.0), When I compare the results, Then each evaluation used its specified temperature value

### Tests for User Story 2 (Written FIRST - must FAIL before implementation)

- [ ] T043 [P] [US2] Create E2E test for temperature slider in `tests/e2e/evaluation-form.spec.ts`: verify slider exists with range 0.0-2.0, drag to different values, verify displayed value updates to 1 decimal place
- [ ] T043b [P] [US2] Create E2E test for temperature default value in `tests/e2e/evaluation-form.spec.ts`: verify new form shows temperature = 0.3
- [ ] T044 [P] [US2] Create E2E test for temperature form submission in `tests/e2e/evaluation-form.spec.ts`: adjust slider to 1.5, submit, verify evaluation created with temperature: 1.5
- [ ] T045 [P] [US2] Create integration test for temperature in evaluation flow in `tests/integration/temperature.test.ts`: create evaluations with different temperatures (0.0, 0.5, 1.5, 2.0), verify all stored correctly in DB, verify default 0.3 when not provided
- [ ] T046 [US2] Create E2E test for temperature application in `tests/e2e/evaluation-execution.spec.ts`: verify mock API clients receive temperature value in evaluate() options
- [ ] T047 [US2] Create E2E test for temperature display in results in `tests/e2e/evaluation-details.spec.ts`: view evaluation details, verify temperature value displayed

### Implementation for User Story 2

- [x] T048 [P] [US2] Add temperature range input (slider) to NewEvaluationModal.astro form with min=0, max=2, step=0.1, value=0.3
- [x] T049 [P] [US2] Style temperature slider using Tailwind CSS v4 utility classes in `src/components/NewEvaluationModal.astro`
- [x] T050 [US2] Add temperature value display next to slider in decimal format (1 decimal place) in `src/components/NewEvaluationModal.astro`
- [x] T051 [US2] Implement JavaScript event listener on slider input to update displayed temperature value in real-time in `src/components/NewEvaluationModal.astro`
- [x] T052 [US2] Extract temperature from slider input in form submission handler in `src/components/NewEvaluationModal.astro`
- [x] T053 [US2] Call validateTemperature() on extracted temperature and display error if invalid in `src/components/NewEvaluationModal.astro`
- [x] T054 [US2] Add temperature to request body in fetch call to `/api/evaluate` in `src/components/NewEvaluationModal.astro`
- [x] T055 [US2] Update `/api/evaluate` endpoint in `src/pages/api/evaluate.ts` to extract `temperature` from request body
- [x] T056 [US2] Add validation call in `/api/evaluate` to validateTemperature() and return 400 error if invalid in `src/pages/api/evaluate.ts`
- [x] T057 [US2] Pass `temperature` to evaluator in `/api/evaluate` endpoint - update evaluator.ts orchestration function signature
- [x] T058 [US2] Update evaluation creation in database layer to store `temperature` in Evaluation record in `src/lib/db.ts`
- [x] T059 [US2] Update result recording to capture `temperature_used` from evaluation context in `src/lib/db.ts`
- [x] T059b [US2] **CRITICAL**: Populate `temperature_used` in Result records from evaluation's `temperature` when recording results in `src/lib/evaluator.ts` and `src/lib/db.ts` - audit field must be denormalized
- [x] T060 [US2] Modify evaluator.ts to pass temperature to each client's evaluate() call in `src/lib/evaluator.ts`
- [x] T061 [US2] Add temperature to evaluation detail response/display - update GET endpoint to include temperature field
- [x] T062 [US2] Update evaluation comparison/results view to display temperature alongside other metrics in `src/pages/evaluations/[id].astro` or results component

**Checkpoint**: User Story 2 is complete and independently testable. Users can now adjust temperature via slider and have it applied to evaluations. Both US1 and US2 work independently.

---

## Phase 5: User Story 3 - Save Settings in Templates for Reusability (Priority: P2)

**Goal**: Users can save system prompt and temperature configurations in evaluation templates for reuse across multiple evaluations without reconfiguration

**Independent Test**: Can be fully tested by creating a template with system prompt and temperature, then creating multiple evaluations from that template and verifying settings are applied

**User Story Acceptance Scenarios**:
1. Given I'm creating an evaluation template, When I configure a system prompt and temperature, Then both settings are saved with the template
2. Given I load a template with saved system prompt and temperature, When I create an evaluation from it, Then those settings are pre-populated in the form
3. Given I edit a template's system prompt, When I save the changes, Then new evaluations created from the template use the updated system prompt

### Tests for User Story 3 (Written FIRST - must FAIL before implementation)

- [ ] T063 [P] [US3] Create integration test for template with system prompt and temperature in `tests/integration/template-settings.test.ts`: create template with both fields, verify stored, verify retrieved
- [ ] T064 [P] [US3] Create E2E test for creating evaluation from template in `tests/e2e/template-creation.spec.ts`: create template with custom system prompt and temperature, create evaluation from template, verify form pre-filled with template settings
- [ ] T065 [US3] Create E2E test for template editing in `tests/e2e/template-edit.spec.ts`: edit template's system prompt and temperature, verify new evaluations use updated values
- [ ] T066 [P] [US3] Create integration test for template-to-evaluation flow in `tests/integration/template-evaluation-flow.test.ts`: verify system prompt and temperature are copied from template to evaluation

### Implementation for User Story 3

- [x] T067 [US3] Update POST `/api/templates` endpoint in `src/pages/api/templates/index.ts` to extract `system_prompt` and `temperature` from request body
- [x] T068 [US3] Add validation calls in template creation endpoint for both system_prompt and temperature in `src/pages/api/templates/index.ts`
- [x] T069 [US3] Update template creation in database layer to store `system_prompt` and `temperature` in EvaluationTemplate record in `src/lib/db.ts`
- [x] T070 [US3] Update PUT `/api/templates/:id` endpoint in `src/pages/api/templates/[id].ts` to handle updates to `system_prompt` and `temperature` fields
- [x] T071 [US3] Update evaluation creation from template: when loading template data, extract system_prompt and temperature from template record in `src/lib/db.ts`
- [x] T072 [US3] Update template detail response to include system_prompt and temperature fields in GET endpoint in `src/pages/api/templates/[id].ts`
- [ ] T073 [US3] Update template creation form (if separate component or modal) to include system prompt checkbox and temperature slider (same as evaluation form)
- [ ] T074 [US3] When creating evaluation from template, pre-fill system prompt checkbox and temperature slider with template values in `src/components/NewEvaluationModal.astro` or equivalent template creation component
- [x] T075 [US3] Ensure template edits to system_prompt and temperature do NOT retroactively change existing evaluations created from that template (evaluations store their own copy)

**Checkpoint**: User Story 3 is complete. Templates now support system prompt and temperature configuration, and evaluations created from templates inherit these settings.

---

## Phase 6: User Story 4 - Maintain Backward Compatibility (Priority: P1)

**Goal**: Existing evaluations created before this feature continue working without system prompts or temperature settings, using default values (no system prompt, temperature 0.3)

**Independent Test**: Can be fully tested by running existing evaluations created before this feature and verifying they execute correctly with default settings

**User Story Acceptance Scenarios**:
1. Given an evaluation was created before this feature was added (no system_prompt or temperature stored), When I run it, Then it executes with default settings (no system prompt, temperature 0.3)
2. Given I view an old evaluation without explicit settings, When I check the evaluation details, Then it shows the default temperature (0.3) was used

### Tests for User Story 4 (Written FIRST - must FAIL before implementation)

- [ ] T076 [P] [US4] Create integration test for backward compatibility in `tests/integration/backward-compatibility.test.ts`: create evaluation with null system_prompt and no temperature in DB, retrieve it, verify system_prompt is null and temperature defaults to 0.3
- [ ] T077 [P] [US4] Create integration test for evaluation execution with null settings in `tests/integration/execution-with-null-settings.test.ts`: execute evaluation with null system_prompt and default temperature, verify API clients called correctly with no system prompt and temperature=0.3
- [ ] T078 [US4] Create E2E test for viewing old evaluations in `tests/e2e/old-evaluations.spec.ts`: retrieve evaluation without system_prompt/temperature fields, verify display doesn't break, shows defaults

### Implementation for User Story 4

- [x] T079 [US4] Update evaluator.ts to handle undefined/null `system_prompt` - pass undefined to API clients when not present in `src/lib/evaluator.ts`
- [x] T080 [US4] Update evaluator.ts to use default temperature (0.3) when undefined/null - set to 0.3 before passing to API clients in `src/lib/evaluator.ts`
- [x] T081 [US4] Update API client implementations to handle undefined system_prompt gracefully - skip adding system message/parameter if undefined in OpenAI/Anthropic/Google clients in `src/lib/api-clients.ts`
- [ ] T082 [US4] Update evaluation detail response to display default temperature (0.3) when temperature field is null in GET endpoint in `src/pages/api/evaluations/[id].ts`
- [ ] T083 [US4] Update evaluation display component to handle null system_prompt (show "No system prompt" or similar) in evaluation detail view
- [ ] T084 [US4] Update result recording to handle null system_prompt_used and temperature_used=0.3 default in result creation in `src/lib/db.ts`
- [ ] T085 [US4] Verify database migration preserves existing evaluation records - all new columns are nullable with appropriate defaults

**Checkpoint**: Backward compatibility verified. Existing evaluations continue to work without modification, new evaluations can use custom system prompts and temperatures.

---

## Phase 7: Integration & Cross-Story Validation

**Purpose**: Verify all user stories work together correctly and meet acceptance criteria

### CRITICAL Issue Validation

- [ ] T117 [P] **CRITICAL (FR-017)**: Create integration test for API failure handling with custom settings in `tests/integration/api-failure-handling.test.ts` - verify that when an API provider fails with custom system_prompt or temperature, the entire evaluation is marked as failed with error_message populated
- [x] T118 [US1] **CRITICAL (FR-017)**: Add explicit documentation to `src/lib/evaluator.ts` verifying that API failures result in evaluation failure with no retry logic or fallback behavior - ensure code comments clearly explain fail-fast behavior

### Integration Testing

- [ ] T086 [P] Run full E2E test suite in `tests/e2e/` and verify all scenarios pass
- [ ] T087 [P] Run full integration test suite in `tests/integration/` and verify all flows pass
- [ ] T088 [P] Run unit tests for validators in `tests/unit/validators.test.ts` and verify coverage >95%
- [ ] T089 [P] Run unit tests for API clients in `tests/unit/api-clients.test.ts` and verify coverage >85% (targets improvement from current 64.38%)
- [ ] T090 Run `npm run typecheck` and verify strict TypeScript compilation passes with no errors
- [ ] T091 Run `npm run format:check` and verify code formatting complies with project conventions
- [ ] T092 Run `npm run lint` and verify no ESLint warnings or errors
- [ ] T093 Verify test coverage for critical paths (system prompt validation, temperature validation, API client modifications) meets 80%+ threshold

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and validation affecting all user stories

### Performance Validation (RECOMMENDED - Constitution Principle IV)

- [ ] T119 [P] Create performance test for validation in `tests/integration/performance.test.ts`: verify system prompt validation completes in <10ms for 4000-character input, temperature validation in <1ms, batch test multiple scenarios
- [ ] T120 [P] Create E2E performance test for form submission in `tests/e2e/performance.spec.ts`: verify form submission completes in <500ms (p95) with realistic network conditions, test with and without system prompt/temperature

### Error Handling & UX Polish

- [ ] T094 [P] Add user-friendly error messages for system prompt validation failures in form submission handlers
- [ ] T094b [P] Add user-friendly error messages for temperature validation failures in form submission handlers
- [ ] T095 [P] Add loading states and spinner to form submission buttons during evaluation creation
- [ ] T096 Review and update component documentation in `src/components/NewEvaluationModal.astro` for new controls
- [ ] T097 Review all API endpoint responses in `src/pages/api/` to ensure system_prompt and temperature are included in responses
- [ ] T098 Verify Tailwind CSS v4 styling consistency across all new controls (checkbox, textarea, slider)
- [ ] T099 Test form responsiveness on mobile and narrow screens - verify temperature slider is usable and temperature value is visible
- [ ] T100 Verify form state management: test that disabling system prompt checkbox preserves entered text in case checkbox is re-enabled
- [ ] T101 Run quickstart.md validation: follow setup and development commands to verify everything works end-to-end
- [ ] T102 Update relevant code comments explaining system prompt and temperature parameters in api-clients.ts and evaluator.ts
- [ ] T103 Verify backward compatibility end-to-end: retrieve pre-migration evaluations and verify they execute correctly with defaults

**Checkpoint**: All stories complete, integrated, tested, and polished. Feature ready for production.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - BLOCKS all user stories
- **Phase 3 (US1 - System Prompt)**: Depends on Phase 2 completion
- **Phase 4 (US2 - Temperature)**: Depends on Phase 2 completion (can run in parallel with US1)
- **Phase 5 (US3 - Templates)**: Depends on Phase 2 completion (can run in parallel with US1 and US2)
- **Phase 6 (US4 - Backward Compatibility)**: Depends on Phase 2 completion (should run during Phase 3-5)
- **Phase 7 (Integration)**: Depends on all user stories (Phase 3-6) being complete
- **Phase 8 (Polish)**: Depends on Phase 7 completion

### User Story Dependencies

- **US1 (System Prompt)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (Temperature)**: Can start after Phase 2 - No dependencies on other stories, can run in parallel with US1
- **US3 (Templates)**: Can start after Phase 2 - May integrate with US1/US2 but independently testable
- **US4 (Backward Compatibility)**: Should run during/after other stories - validates existing data handling

### Within Each Phase

- Tests written FIRST and verified to FAIL
- Model/type changes before service/endpoint changes
- Form UI before API endpoint changes
- API endpoint implementation before integration tests
- Each story complete before integration testing

### Parallel Opportunities

**Phase 1 Setup**:
- T003-T007: All database schema changes can be done together
- T008-T010: Validators implementation can proceed in parallel

**Phase 2 Foundational**:
- All [P] marked tests (T011-T013) can run in parallel
- All [P] marked type updates (T015-T019) can run in parallel
- All [P] marked client implementations (T021-T023) can run in parallel

**Once Phase 2 Complete**:
- All three user stories (US1, US2, US3) can be worked on in parallel by different team members
- Within each story, all [P] marked tasks can run in parallel

**Example Parallel Execution - US1 & US2 Simultaneous**:
```
Team Member A: US1 (System Prompt)
- T025-T028: Write US1 tests
- T029-T035: Implement UI component
- T036-T041: Implement API and database layer

Team Member B: US2 (Temperature)
- T043-T047: Write US2 tests
- T048-T062: Implement UI component, API, and database layer

Team Member C: Starts US3 after Phase 2 (or helps integrate after other stories)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. **Complete Phase 1**: Setup - schema and validators
2. **Complete Phase 2**: Foundational - type system and API clients
3. **Complete Phase 3 & 4**: User Stories 1 & 2 in parallel or sequence
4. **STOP and VALIDATE**: Test US1 and US2 independently
5. **Deploy/Demo**: MVP is system prompt + temperature controls working end-to-end
6. **Then add US3 & US4**: Templates and backward compatibility

### Incremental Delivery

1. Complete Phase 1 + Phase 2 → Foundation ready
2. Complete Phase 3 (US1) → Test independently → Deploy/Demo (system prompt works!)
3. Complete Phase 4 (US2) → Test independently → Deploy/Demo (temperature works!)
4. Complete Phase 5 (US3) → Test independently → Deploy/Demo (templates support new settings)
5. Complete Phase 6 (US4) → Test independently → Deploy/Demo (backward compatible)
6. Complete Phase 7 & 8 → Integration validated, polished, production-ready

Each story adds value without breaking previous stories.

### Parallel Team Strategy (if multiple developers)

1. Team together: Phase 1 + Phase 2
2. Once Phase 2 complete, split:
   - Developer A: Phase 3 (US1 - System Prompt)
   - Developer B: Phase 4 (US2 - Temperature)
   - Developer C: Phase 5 (US3 - Templates)
3. All stories implemented and integrated in parallel
4. Together: Phase 7 integration validation
5. Together: Phase 8 polish and final testing

---

## Testing Summary

### Test-First Discipline (Constitution Principle II)

- **Total test tasks**: 31 test tasks across all phases
- **Unit tests**: T001-T002 (validators), T011-T014 (API clients)
- **Integration tests**: T027, T045, T063, T076-T078, T117 (API failure handling), T119 (performance)
- **E2E tests**: T025-T026, T043-T044, T065-T066 (UI interactions), T120 (performance)
- **Coverage targets**: >80% for critical paths, 85%+ for api-clients.ts, 95%+ for validators

### Test Execution Order

1. Write all test tasks FIRST
2. Verify tests FAIL before implementation
3. Implement feature code
4. Verify tests PASS
5. Maintain 80%+ coverage for critical paths

---

## Notes & Best Practices

- **[P] Parallel Markers**: Only apply to tasks with different files and no cross-dependencies
- **[Story] Labels**: Essential for traceability; maps each task to user story
- **Test First**: Constitution Principle II is non-negotiable; all critical paths have tests
- **Independent Stories**: Each story can be implemented, tested, and deployed independently
- **Stop at Checkpoints**: After each story phase, validate that story works on its own
- **Backward Compatibility**: Carefully test that Phase 6 (US4) validates existing data handling
- **Styling Convention**: All new UI must use Tailwind CSS v4 + daisyUI; no custom CSS without justification
- **TypeScript Strict Mode**: All changes must pass `npm run typecheck` with strict mode
- **Commit Strategy**: Commit after each task or logical group (e.g., after each story phase)
- **Code Review**: Each commit should reference which Constitution principles it satisfies
