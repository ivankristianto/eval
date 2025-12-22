# Tasks: Database Seeding Command

**Input**: Design documents from `/specs/003-add-db-seed/`
**Prerequisites**: plan.md, spec.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Install `csv-parse` and `dotenv` dependencies in `package.json`
- [ ] T002 Add `db:seed` script to `package.json` pointing to `node db/seed.js`
- [ ] T003 [P] Create `db/templates.csv` with initial template data
- [ ] T004 [P] Create `db/default-models.json` with default model configurations

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create `db/seed.js` skeleton with imports (better-sqlite3, csv-parse, dotenv, uuid)
- [ ] T006 Implement shared database connection and table creation check in `db/seed.js`
- [ ] T007 Implement encryption/decryption helper functions in `db/seed.js` (AES-256-GCM) matching `src/lib/db.ts` logic

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Initial Environment Setup (Priority: P1) 🎯 MVP

**Goal**: Run a single command to populate database with templates and configured models.

**Independent Test**: Run `npm run db:seed` on a fresh database and verify tables are populated.

### Tests for User Story 1

- [ ] T008 [US1] Create integration test `tests/integration/seed.test.ts` to verify seeding works on empty DB

### Implementation for User Story 1

- [ ] T009 [US1] Implement CSV parsing logic in `db/seed.js` to read `db/templates.csv`
- [ ] T010 [US1] Implement `seedTemplates` function in `db/seed.js` to insert parsed templates
- [ ] T011 [US1] Implement logic to resolve `model_ids` strings (provider:name) to UUIDs (placeholder or lookup)
- [ ] T012 [US1] Implement `seedModels` function in `db/seed.js` to read `db/default-models.json` and `.env`
- [ ] T013 [US1] Implement encryption of API keys from `.env` before inserting into `ModelConfiguration`
- [ ] T014 [US1] Implement `main` function in `db/seed.js` to orchestrate the seeding process

**Checkpoint**: At this point, running the seed command should populate the database.

---

## Phase 4: User Story 2 - Incremental Data Updates (Priority: P2)

**Goal**: Add new templates/models without duplicating existing ones (Idempotency).

**Independent Test**: Run `npm run db:seed` twice; second run should add 0 records.

### Tests for User Story 2

- [ ] T015 [US2] Update `tests/integration/seed.test.ts` to verify idempotency (no duplicates on re-run)

### Implementation for User Story 2

- [ ] T016 [US2] Update `seedTemplates` in `db/seed.js` to check for existence (by name) before inserting
- [ ] T017 [US2] Update `seedModels` in `db/seed.js` to check for existence (by provider + model_name) before inserting
- [ ] T018 [US2] Add logging to report number of records created vs. skipped

**Checkpoint**: The seed command is now safe to run multiple times.

---

## Phase 5: User Story 3 - Data Reset and Forced Seeding (Priority: P3)

**Goal**: Support `--force` flag to clear data before seeding.

**Independent Test**: Run `npm run db:seed --force` and verify tables are truncated before seeding.

### Tests for User Story 3

- [ ] T019 [US3] Update `tests/integration/seed.test.ts` to verify `--force` flag behavior

### Implementation for User Story 3

- [ ] T020 [US3] Add argument parsing logic in `db/seed.js` to detect `--force` flag
- [ ] T021 [US3] Implement `clearTables` function in `db/seed.js` to truncate tables
- [ ] T022 [US3] Update `main` in `db/seed.js` to call `clearTables` when flag is present

**Checkpoint**: The seed command supports full reset.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T023 [P] Add `--dry-run` support to `db/seed.js` (preview changes only)
- [ ] T024 Improve error handling for missing files or invalid CSV data in `db/seed.js`
- [ ] T025 Ensure `ENCRYPTION_KEY` validation is robust and fails fast if missing
- [ ] T026 [P] Verify console output formatting matches `db:init` style

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1. Blocks Phase 3+.
- **User Story 1 (Phase 3)**: Depends on Phase 2.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (conceptually extends US1 logic).
- **User Story 3 (Phase 5)**: Depends on Phase 2.

### User Story Dependencies

- **US1 (P1)**: Independent.
- **US2 (P2)**: Extends US1 code but tasks are distinct.
- **US3 (P3)**: Extends US1 code but tasks are distinct.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup & Foundational.
2. Implement US1 (Parsing, Insertion, Encryption).
3. Validate with `npm run db:seed`.

### Incremental Delivery

1. Deliver US1 (Basic seeding).
2. Deliver US2 (Idempotency).
3. Deliver US3 (Force reset).
