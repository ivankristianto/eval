# Tasks: Multi-Provider AI Model Support

**Input**: Design documents from `/specs/005-multi-provider-support/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/providers-api.yaml

**Tests**: Constitution Principle II (Testing Discipline) is NON-NEGOTIABLE. All test tasks MUST be completed and verified to FAIL before implementation tasks begin.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web application structure (Astro SSR):
- Source: `src/lib/`, `src/pages/`, `src/components/`
- Database: `db/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies

- [ ] T001 Install new dependencies: @google-cloud/vertexai@^1.0.0 and google-auth-library@^9.0.0
- [ ] T002 Generate encryption key and add to .env: ENCRYPTION_KEY (32-byte hex)
- [ ] T003 [P] Create directory structure: src/lib/providers/, src/lib/auth/, src/pages/api/providers/, src/components/providers/
- [ ] T004 [P] Create directory structure for tests: tests/unit/providers/, tests/unit/auth/, tests/integration/providers/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Migration (P0 - Blocking)

- [ ] T005 Create migration script in db/migrations/005-multi-provider.sql with ProviderConfiguration table
- [ ] T006 Add migration logic to create ProviderConfiguration table with all fields per data-model.md
- [ ] T007 Add migration logic to populate ProviderConfiguration from existing ModelConfiguration records
- [ ] T008 Add migration logic to add provider_id column to ModelConfiguration
- [ ] T009 Add migration logic to update ModelConfiguration records with provider_id foreign key
- [ ] T010 Add migration logic to remove old provider and api_key_encrypted columns from ModelConfiguration
- [ ] T011 Update db/schema.sql with new ProviderConfiguration table schema
- [ ] T012 Update db/schema.sql with modified ModelConfiguration table schema
- [ ] T013 Test migration: Run npm run db:reset and verify schema correctness
- [ ] T014 Test migration: Verify existing data preserved after migration

### Encryption Infrastructure (P0 - Blocking)

- [ ] T015 Create src/lib/auth/encryption.ts with encrypt() function using AES-256-GCM
- [ ] T016 Add decrypt() function to src/lib/auth/encryption.ts
- [ ] T017 Add input validation and error handling to encryption.ts
- [ ] T018 Create tests/unit/auth/encryption.test.ts - Test encrypt/decrypt roundtrip
- [ ] T019 Verify tests/unit/auth/encryption.test.ts - Test encryption determinism (different outputs for same input)
- [ ] T020 Verify tests/unit/auth/encryption.test.ts - Test decryption failure on tampered ciphertext

### TypeScript Type Definitions (P0 - Blocking)

- [ ] T021 [P] Update src/lib/types.ts with ProviderType enum (8 provider types)
- [ ] T022 [P] Update src/lib/types.ts with AuthMethod enum (api_key, oauth, none)
- [ ] T023 [P] Update src/lib/types.ts with ProviderConfiguration interface
- [ ] T024 [P] Update src/lib/types.ts with updated ModelConfiguration interface (add provider_id)
- [ ] T025 [P] Update src/lib/types.ts with ProviderWithModels interface

### Database Access Layer Updates (P0 - Blocking)

- [ ] T026 Update src/lib/db.ts with createProvider() function
- [ ] T027 Update src/lib/db.ts with getProvider(id) function
- [ ] T028 Update src/lib/db.ts with listProviders(activeOnly) function
- [ ] T029 Update src/lib/db.ts with updateProvider(id, updates) function
- [ ] T030 Update src/lib/db.ts with deleteProvider(id) function (soft delete with validation)
- [ ] T031 Update src/lib/db.ts with getProviderByModelId(modelId) function
- [ ] T032 Update src/lib/db.ts with testConnection() helper for provider validation

### Provider Base Infrastructure (P0 - Blocking)

- [ ] T033 Create src/lib/providers/base.ts with ModelClient interface
- [ ] T034 Add ProviderConfig interface to src/lib/providers/base.ts
- [ ] T035 Add BaseProviderClient abstract class to src/lib/providers/base.ts
- [ ] T036 Create src/lib/providers/factory.ts with createProviderClient() function
- [ ] T037 Update src/lib/evaluator.ts to use createProviderClient() from factory

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Enterprise Evaluation with Google Vertex AI (Priority: P1) 🎯 MVP

**Goal**: Enable enterprise users to evaluate Vertex AI models with OAuth authentication

**Independent Test**: Configure Vertex AI with OAuth, create Gemini model config, run evaluation, verify results with proper authentication

### Tests for User Story 1 (TEST-FIRST - MUST FAIL BEFORE IMPLEMENTATION)

> **CONSTITUTION REQUIREMENT**: Write these tests FIRST, ensure they FAIL before implementation

- [ ] T038 [P] [US1] Create tests/unit/providers/vertex-ai.test.ts - Test VertexAIClient construction
- [ ] T039 [P] [US1] Add test to tests/unit/providers/vertex-ai.test.ts - Test evaluate() method with mock
- [ ] T040 [P] [US1] Add test to tests/unit/providers/vertex-ai.test.ts - Test testConnection() method
- [ ] T041 [P] [US1] Create tests/unit/auth/oauth.test.ts - Test VertexAIOAuthHandler.generateAuthUrl()
- [ ] T042 [P] [US1] Add test to tests/unit/auth/oauth.test.ts - Test exchangeCodeForTokens()
- [ ] T043 [P] [US1] Add test to tests/unit/auth/oauth.test.ts - Test refreshAccessToken()
- [ ] T044 [US1] Create tests/integration/providers/vertex-ai-oauth.test.ts - Test complete OAuth flow
- [ ] T045 [US1] Verify ALL tests in tests/unit/providers/vertex-ai.test.ts FAIL (no implementation exists yet)
- [ ] T046 [US1] Verify ALL tests in tests/unit/auth/oauth.test.ts FAIL (no implementation exists yet)

### Implementation for User Story 1

- [ ] T047 [US1] Create src/lib/auth/oauth.ts with VertexAIOAuthHandler class
- [ ] T048 [US1] Implement generateAuthUrl() in src/lib/auth/oauth.ts
- [ ] T049 [US1] Implement exchangeCodeForTokens() in src/lib/auth/oauth.ts with encryption
- [ ] T050 [US1] Implement refreshAccessToken() in src/lib/auth/oauth.ts with encryption
- [ ] T051 [US1] Create src/lib/providers/vertex-ai.ts with VertexAIClient class extending BaseProviderClient
- [ ] T052 [US1] Implement constructor in src/lib/providers/vertex-ai.ts (setup VertexAI SDK with GoogleAuth)
- [ ] T053 [US1] Implement evaluate() method in src/lib/providers/vertex-ai.ts
- [ ] T054 [US1] Implement testConnection() method in src/lib/providers/vertex-ai.ts
- [ ] T055 [US1] Update src/lib/providers/factory.ts to handle 'vertexai' provider type
- [ ] T056 [US1] Create src/pages/api/oauth/vertex-ai/initiate.ts endpoint per contracts/providers-api.yaml
- [ ] T057 [US1] Create src/pages/api/oauth/vertex-ai/callback.ts endpoint per contracts/providers-api.yaml
- [ ] T058 [US1] Add OAuth state validation and CSRF protection to callback endpoint
- [ ] T059 [US1] Add error handling for OAuth flow cancellation (discard partial data)
- [ ] T060 [US1] Add automatic token refresh logic before evaluation (check expiry < 5 min)
- [ ] T061 [US1] Add token expiry handling during evaluation (fail provider, continue others)
- [ ] T062 [US1] Verify ALL tests in tests/unit/providers/vertex-ai.test.ts now PASS
- [ ] T063 [US1] Verify ALL tests in tests/unit/auth/oauth.test.ts now PASS
- [ ] T064 [US1] Verify integration test in tests/integration/providers/vertex-ai-oauth.test.ts PASSES

**Checkpoint**: User Story 1 complete - Vertex AI OAuth integration fully functional and tested

---

## Phase 4: User Story 2 - Access Multiple Models via Open Router (Priority: P1)

**Goal**: Enable researchers to access multiple models through Open Router's unified API

**Independent Test**: Configure Open Router with API key, select any model, run evaluation, verify routing and cost tracking

### Tests for User Story 2 (TEST-FIRST - MUST FAIL BEFORE IMPLEMENTATION)

- [ ] T065 [P] [US2] Create tests/unit/providers/open-router.test.ts - Test OpenRouterClient construction
- [ ] T066 [P] [US2] Add test to tests/unit/providers/open-router.test.ts - Test evaluate() with OpenAI SDK compatibility
- [ ] T067 [P] [US2] Add test to tests/unit/providers/open-router.test.ts - Test testConnection()
- [ ] T068 [P] [US2] Add test to tests/unit/providers/open-router.test.ts - Test Open Router metadata parsing
- [ ] T069 [US2] Create tests/integration/providers/open-router-api.test.ts - Test API key validation
- [ ] T070 [US2] Verify ALL tests in tests/unit/providers/open-router.test.ts FAIL (no implementation exists yet)

### Implementation for User Story 2

- [ ] T071 [US2] Create src/lib/providers/open-router.ts with OpenRouterClient class extending BaseProviderClient
- [ ] T072 [US2] Implement constructor in src/lib/providers/open-router.ts (setup OpenAI SDK with Open Router base URL)
- [ ] T073 [US2] Implement evaluate() method in src/lib/providers/open-router.ts
- [ ] T074 [US2] Implement testConnection() method in src/lib/providers/open-router.ts
- [ ] T075 [US2] Add Open Router-specific headers (HTTP-Referer, X-Title) to client configuration
- [ ] T076 [US2] Add Open Router cost tracking metadata extraction from response headers
- [ ] T077 [US2] Update src/lib/providers/factory.ts to handle 'openrouter' provider type
- [ ] T078 [US2] Add rate limit error detection and immediate failure (no retry)
- [ ] T079 [US2] Add model unavailability error handling with clear messages
- [ ] T080 [US2] Verify ALL tests in tests/unit/providers/open-router.test.ts now PASS
- [ ] T081 [US2] Verify integration test in tests/integration/providers/open-router-api.test.ts PASSES

**Checkpoint**: User Story 2 complete - Open Router integration fully functional and tested

---

## Phase 5: User Story 3 - Privacy-Focused Local Evaluation with LM Studio (Priority: P2)

**Goal**: Enable users to evaluate local models via LM Studio with no external network calls

**Independent Test**: Start LM Studio locally, configure endpoint, run evaluation, verify no external network calls

### Tests for User Story 3 (TEST-FIRST - MUST FAIL BEFORE IMPLEMENTATION)

- [ ] T082 [P] [US3] Create tests/unit/providers/lm-studio.test.ts - Test LMStudioClient construction
- [ ] T083 [P] [US3] Add test to tests/unit/providers/lm-studio.test.ts - Test evaluate() with local endpoint
- [ ] T084 [P] [US3] Add test to tests/unit/providers/lm-studio.test.ts - Test testConnection() for local server
- [ ] T085 [P] [US3] Add test to tests/unit/providers/lm-studio.test.ts - Test connection failure handling
- [ ] T086 [US3] Create tests/integration/providers/lm-studio-local.test.ts - Test no external network calls
- [ ] T087 [US3] Verify ALL tests in tests/unit/providers/lm-studio.test.ts FAIL (no implementation exists yet)

### Implementation for User Story 3

- [ ] T088 [US3] Create src/lib/providers/lm-studio.ts with LMStudioClient class extending BaseProviderClient
- [ ] T089 [US3] Implement constructor in src/lib/providers/lm-studio.ts (setup OpenAI SDK with custom baseURL)
- [ ] T090 [US3] Implement evaluate() method in src/lib/providers/lm-studio.ts (OpenAI SDK compatible)
- [ ] T091 [US3] Implement testConnection() method in src/lib/providers/lm-studio.ts (verify local endpoint reachable)
- [ ] T092 [US3] Add connection failure error messages with troubleshooting suggestions
- [ ] T093 [US3] Update src/lib/providers/factory.ts to handle 'lmstudio' provider type
- [ ] T094 [US3] Add endpoint port change detection and clear error reporting
- [ ] T095 [US3] Verify ALL tests in tests/unit/providers/lm-studio.test.ts now PASS
- [ ] T096 [US3] Verify integration test in tests/integration/providers/lm-studio-local.test.ts PASSES (no external calls)

**Checkpoint**: User Story 3 complete - LM Studio local evaluation fully functional and tested

---

## Phase 6: User Story 4 - Local Model Evaluation with Ollama (Priority: P2)

**Goal**: Enable developers to evaluate Ollama models with native REST API integration

**Independent Test**: Run Ollama with models, configure endpoint, run evaluation, verify results

### Tests for User Story 4 (TEST-FIRST - MUST FAIL BEFORE IMPLEMENTATION)

- [ ] T097 [P] [US4] Create tests/unit/providers/ollama.test.ts - Test OllamaClient construction
- [ ] T098 [P] [US4] Add test to tests/unit/providers/ollama.test.ts - Test evaluate() with Ollama API format
- [ ] T099 [P] [US4] Add test to tests/unit/providers/ollama.test.ts - Test listModels() implementation
- [ ] T100 [P] [US4] Add test to tests/unit/providers/ollama.test.ts - Test testConnection() for Ollama server
- [ ] T101 [US4] Create tests/integration/providers/ollama-api.test.ts - Test native Ollama API compatibility
- [ ] T102 [US4] Verify ALL tests in tests/unit/providers/ollama.test.ts FAIL (no implementation exists yet)

### Implementation for User Story 4

- [ ] T103 [US4] Create src/lib/providers/ollama.ts with OllamaClient class extending BaseProviderClient
- [ ] T104 [US4] Implement constructor in src/lib/providers/ollama.ts (store endpoint URL)
- [ ] T105 [US4] Implement evaluate() method in src/lib/providers/ollama.ts using native fetch to /api/generate
- [ ] T106 [US4] Implement listModels() method in src/lib/providers/ollama.ts using fetch to /api/tags
- [ ] T107 [US4] Implement testConnection() method in src/lib/providers/ollama.ts (verify /api/tags reachable)
- [ ] T108 [US4] Add Ollama response format mapping (ns to ms, token counts)
- [ ] T109 [US4] Update src/lib/providers/factory.ts to handle 'ollama' provider type
- [ ] T110 [US4] Add endpoint validation and connection error handling
- [ ] T111 [US4] Verify ALL tests in tests/unit/providers/ollama.test.ts now PASS
- [ ] T112 [US4] Verify integration test in tests/integration/providers/ollama-api.test.ts PASSES

**Checkpoint**: User Story 4 complete - Ollama integration fully functional and tested

---

## Phase 7: User Story 5 - Seamless Provider Management (Priority: P3)

**Goal**: Enable users to manage provider configurations from central UI interface

**Independent Test**: Navigate to provider page, add/edit/test/delete providers, verify persistence

### Tests for User Story 5 (TEST-FIRST - MUST FAIL BEFORE IMPLEMENTATION)

- [ ] T113 [P] [US5] Create tests/integration/providers/provider-api.test.ts - Test GET /api/providers
- [ ] T114 [P] [US5] Add test to tests/integration/providers/provider-api.test.ts - Test POST /api/providers (create)
- [ ] T115 [P] [US5] Add test to tests/integration/providers/provider-api.test.ts - Test PATCH /api/providers/:id (update)
- [ ] T116 [P] [US5] Add test to tests/integration/providers/provider-api.test.ts - Test DELETE /api/providers/:id (soft delete)
- [ ] T117 [P] [US5] Add test to tests/integration/providers/provider-api.test.ts - Test POST /api/providers/test (connection test)
- [ ] T118 [US5] Create tests/e2e/provider-management.spec.ts - Test complete provider management workflow
- [ ] T119 [US5] Verify ALL tests in tests/integration/providers/provider-api.test.ts FAIL (no endpoints exist yet)
- [ ] T120 [US5] Verify E2E test in tests/e2e/provider-management.spec.ts FAILS (no UI exists yet)

### API Implementation for User Story 5

- [ ] T121 [P] [US5] Create src/pages/api/providers/index.ts with GET endpoint (list providers)
- [ ] T122 [P] [US5] Add POST endpoint to src/pages/api/providers/index.ts (create provider with encrypted credentials)
- [ ] T123 [P] [US5] Create src/pages/api/providers/[id].ts with GET endpoint (get provider details)
- [ ] T124 [P] [US5] Add PATCH endpoint to src/pages/api/providers/[id].ts (update provider)
- [ ] T125 [P] [US5] Add DELETE endpoint to src/pages/api/providers/[id].ts (soft delete with validation)
- [ ] T126 [P] [US5] Create src/pages/api/providers/test.ts with POST endpoint (test connection)
- [ ] T126a [US5] Update src/pages/api/providers/test.ts to call listModels() when available and return available_models array (FR-016)
- [ ] T127 [P] [US5] Create src/pages/api/providers/[id]/refresh-token.ts with POST endpoint (OAuth refresh)
- [ ] T128 [US5] Add request validation for all endpoints using type guards
- [ ] T129 [US5] Add error response formatting per contracts/providers-api.yaml
- [ ] T130 [US5] Add deletion prevention for providers with associated models/results
- [ ] T131 [US5] Verify ALL tests in tests/integration/providers/provider-api.test.ts now PASS

### UI Implementation for User Story 5

- [ ] T132 [US5] Create src/components/providers/ProviderForm.tsx with provider type selection
- [ ] T133 [US5] Add authentication method selection to src/components/providers/ProviderForm.tsx
- [ ] T134 [US5] Add conditional credential inputs (API key, OAuth, none) to ProviderForm.tsx
- [ ] T135 [US5] Add endpoint URL input for local providers to ProviderForm.tsx
- [ ] T136 [US5] Add test connection button to ProviderForm.tsx with loading state
- [ ] T137 [US5] Create src/components/providers/ProviderList.tsx displaying all providers
- [ ] T138 [US5] Add provider status indicators to ProviderList.tsx (active, last test)
- [ ] T139 [US5] Add edit/delete actions to ProviderList.tsx
- [ ] T139a [US5] Add available models display to ProviderList.tsx or provider detail view, showing models from test endpoint response (FR-016)
- [ ] T140 [US5] Create src/pages/providers/index.astro (provider list page)
- [ ] T141 [US5] Create src/pages/providers/[id].astro (provider configuration page)
- [ ] T142 [US5] Add OAuth flow initiation UI for Vertex AI provider
- [ ] T143 [US5] Add form validation and error display
- [ ] T144 [US5] Add success/error toast notifications for provider operations
- [ ] T145 [US5] Verify E2E test in tests/e2e/provider-management.spec.ts now PASSES

**Checkpoint**: User Story 5 complete - Provider management UI fully functional and tested

---

## Phase 8: Backward Compatibility & Existing Provider Migration

**Purpose**: Ensure existing providers (OpenAI, Anthropic, Google AI) work with new architecture

- [ ] T146 [P] Update src/lib/providers/factory.ts to handle existing 'openai' provider type
- [ ] T147 [P] Update src/lib/providers/factory.ts to handle existing 'anthropic' provider type
- [ ] T148 [P] Update src/lib/providers/factory.ts to handle existing 'google' provider type
- [ ] T149 Migrate existing OpenAI client to extend BaseProviderClient in src/lib/api-clients.ts
- [ ] T150 Migrate existing Anthropic client to extend BaseProviderClient in src/lib/api-clients.ts
- [ ] T151 Migrate existing Google AI client to extend BaseProviderClient in src/lib/api-clients.ts
- [ ] T152 Create tests/integration/backward-compatibility.test.ts - Test existing evaluations still work
- [ ] T153 Verify migration script creates provider records for existing models
- [ ] T154 Verify existing evaluation results remain accessible after migration
- [ ] T155 Verify ALL backward compatibility tests PASS

**Checkpoint**: Existing functionality preserved - backward compatibility validated

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T156 [P] Update README.md with multi-provider setup instructions
- [ ] T157 [P] Add provider configuration examples to documentation
- [ ] T158 [P] Add OAuth setup guide for Vertex AI to documentation
- [ ] T159 [P] Add troubleshooting guide for local providers to documentation
- [ ] T160 Add performance validation: Test provider credential validation <5s (SC-004)
- [ ] T161 Add performance validation: Test provider configuration <3min (SC-002)
- [ ] T162 Add performance validation: Test 10 concurrent provider configs (SC-010)
- [ ] T163 Code review: Verify actionable error messages (SC-009: 95% target)
- [ ] T164 Code review: Verify all credentials encrypted at rest
- [ ] T165 Security audit: Verify OAuth CSRF protection implemented
- [ ] T166 Security audit: Verify encryption key management documented
- [ ] T167 Run quickstart.md validation against implemented code
- [ ] T168 Run full test suite: npm test (unit + integration)
- [ ] T169 Run E2E test suite: npm run test:e2e
- [ ] T170 Run type checking: npm run typecheck
- [ ] T171 Run linting: npm run lint
- [ ] T172 Verify test coverage >80% for provider abstraction layer
- [ ] T173 Final validation: Test all 5 user stories independently

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - **US1 (Vertex AI)**: Can start after Foundational - No dependencies on other stories
  - **US2 (Open Router)**: Can start after Foundational - No dependencies on other stories
  - **US3 (LM Studio)**: Can start after Foundational - No dependencies on other stories
  - **US4 (Ollama)**: Can start after Foundational - No dependencies on other stories
  - **US5 (Provider UI)**: Can start after Foundational - Works with all providers
- **Backward Compatibility (Phase 8)**: Depends on factory.ts from Foundational
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

All user stories are **INDEPENDENTLY TESTABLE** and can be implemented in parallel:

- **US1 → US2 → US3 → US4**: No inter-story dependencies
- **US5**: Can be implemented alongside any other story (UI layer)

### Within Each User Story

**CRITICAL TEST-FIRST ORDER** (Constitution Principle II):

1. **Write Tests** → Verify they **FAIL**
2. **Implement Code** → Verify tests **PASS**
3. **Integration** → Verify end-to-end functionality

For each story:
- Tests BEFORE implementation (RED)
- Implementation to make tests pass (GREEN)
- Refactoring if needed (REFACTOR)

### Parallel Opportunities

- **Setup Phase**: All tasks marked [P] can run in parallel (T001-T004)
- **Foundational Phase**:
  - Database migration tasks (T005-T014) run sequentially
  - Encryption tasks (T015-T020) run independently after T002
  - Type definitions (T021-T025) run in parallel
  - Database layer (T026-T032) depends on T005-T014 completion
  - Provider base (T033-T037) depends on T021-T025 completion
- **User Stories (after Foundational)**: All 5 stories can be implemented in parallel by different developers
- **Within Each Story**:
  - All test tasks marked [P] can run in parallel
  - All model/client tasks marked [P] can run in parallel (after tests written)
  - API endpoints marked [P] can run in parallel
  - UI components marked [P] can run in parallel

---

## Parallel Example: User Story 1 (Vertex AI)

**Test Phase** (parallel execution):
```bash
# Launch all test tasks for US1 together:
Task T038: "Create tests/unit/providers/vertex-ai.test.ts - Test VertexAIClient construction"
Task T039: "Add test to tests/unit/providers/vertex-ai.test.ts - Test evaluate() method"
Task T040: "Add test to tests/unit/providers/vertex-ai.test.ts - Test testConnection() method"
Task T041: "Create tests/unit/auth/oauth.test.ts - Test generateAuthUrl()"
Task T042: "Add test to tests/unit/auth/oauth.test.ts - Test exchangeCodeForTokens()"
Task T043: "Add test to tests/unit/auth/oauth.test.ts - Test refreshAccessToken()"
```

**Implementation Phase** (after tests verified to fail):
```bash
# OAuth implementation (sequential due to same file):
Task T047-T050: "Implement VertexAIOAuthHandler methods in src/lib/auth/oauth.ts"

# Provider client implementation (sequential due to same file):
Task T051-T054: "Implement VertexAIClient methods in src/lib/providers/vertex-ai.ts"

# API endpoints (parallel execution):
Task T056: "Create src/pages/api/oauth/vertex-ai/initiate.ts endpoint"
Task T057: "Create src/pages/api/oauth/vertex-ai/callback.ts endpoint"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T037) **CRITICAL PATH**
3. Complete Phase 3: User Story 1 - Vertex AI (T038-T064)
4. **STOP and VALIDATE**: Test US1 independently per spec.md acceptance scenarios
5. Deploy/demo Vertex AI integration

**MVP Deliverable**: Enterprise users can evaluate Vertex AI models with OAuth authentication

### Incremental Delivery (Recommended)

1. **Foundation** (Phase 1 + Phase 2) → Database migration + core infrastructure ready
2. **MVP** (Phase 3 - US1) → Vertex AI OAuth integration → Test independently → Deploy
3. **Enhancement 1** (Phase 4 - US2) → Open Router integration → Test independently → Deploy
4. **Enhancement 2** (Phase 5 + Phase 6 - US3 + US4) → Local providers → Test independently → Deploy
5. **Enhancement 3** (Phase 7 - US5) → Provider management UI → Test independently → Deploy
6. **Stabilization** (Phase 8 + Phase 9) → Backward compatibility + Polish → Final deploy

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Everyone**: Complete Setup + Foundational together (Phase 1 + Phase 2)
2. **Once Foundational is done (critical milestone)**:
   - Developer A: User Story 1 (Vertex AI) - Priority P1
   - Developer B: User Story 2 (Open Router) - Priority P1
   - Developer C: User Story 3 (LM Studio) - Priority P2
   - Developer D: User Story 4 (Ollama) - Priority P2
   - Developer E: User Story 5 (Provider UI) - Priority P3
3. Stories complete independently, integrate through shared factory pattern

---

## Summary

**Total Tasks**: 175
**Test Tasks**: 56 (32% - Constitution compliance)
**Implementation Tasks**: 119

**Tasks per User Story**:
- US1 (Vertex AI): 27 tasks (11 tests + 16 implementation)
- US2 (Open Router): 17 tasks (7 tests + 10 implementation)
- US3 (LM Studio): 15 tasks (6 tests + 9 implementation)
- US4 (Ollama): 16 tasks (6 tests + 10 implementation)
- US5 (Provider UI): 35 tasks (8 tests + 27 implementation)

**Parallel Opportunities**: 48 tasks marked [P] can run in parallel
**Independent Test Criteria**: Each user story has clear acceptance scenarios from spec.md

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 - Vertex AI)
**MVP Task Count**: 64 tasks (foundational + Vertex AI)

**Constitution Compliance**:
- ✅ Test-First: All user stories have tests BEFORE implementation
- ✅ Independent Stories: Each story can be tested independently
- ✅ Critical Path >80% coverage: 56 test tasks for critical provider layer
- ✅ Actionable errors: Validation in Phase 9 (T163)

---

## Notes

- **[P]** tasks = different files, no dependencies, can run in parallel
- **[Story]** label maps task to specific user story for traceability
- **TEST-FIRST**: Constitution Principle II requires tests written and verified to FAIL before implementation
- Each user story should be independently completable and testable
- **RED-GREEN-REFACTOR**: Write failing test → Implement → Verify pass → Refactor
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Foundation is blocking**: No user story work until Phase 2 complete
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
