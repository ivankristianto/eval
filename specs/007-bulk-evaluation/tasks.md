# Tasks: Bulk Evaluation

**Feature Branch**: `007-bulk-evaluation`
**Spec**: [specs/007-bulk-evaluation/spec.md](../specs/007-bulk-evaluation/spec.md)
**Plan**: [specs/007-bulk-evaluation/plan.md](../specs/007-bulk-evaluation/plan.md)

## Implementation Phases

### Phase 1: Setup
**Goal**: Initialize environment and database.

- [ ] T001 Install dependencies (`papaparse`, `mustache` and types) in `package.json`
- [ ] T002 Create SQL schema for `bulk_datasets`, `evaluation_runs`, `row_results` in `db/schema.sql`
- [ ] T003 Update `db/init.js` (or migration script) to apply new schema
- [ ] T004 [P] Create shared types in `src/lib/types.ts` (`BulkDataset`, `EvaluationRun`, `RowResult`)

### Phase 2: Foundational Components
**Goal**: Core utilities and database access.

- [ ] T005 Unit test for CSV parser in `tests/unit/csv-parser.test.ts`
- [ ] T006 [P] Implement CSV parser utility in `src/lib/csv-parser.ts`
- [ ] T007 Unit test for templates in `tests/unit/templates.test.ts`
- [ ] T008 [P] Implement Mustache template wrapper in `src/lib/templates.ts`
- [ ] T009 Update `src/lib/db.ts` with methods to create/read `BulkDataset`
- [ ] T010 Update `src/lib/db.ts` with methods to create/read `EvaluationRun` and `RowResult`

### Phase 3: Upload & Preview (User Story 1)
**Goal**: Users can upload a CSV and verify its content.
**Independent Test**: Upload a CSV via API and verify JSON response matches content.

- [ ] T011 [US1] Integration test for Upload API in `tests/integration/bulk-upload.test.ts`
- [ ] T012 [US1] Implement upload API endpoint in `src/pages/api/bulk/datasets/index.ts`
- [ ] T013 [US1] Implement get dataset API endpoint in `src/pages/api/bulk/datasets/[id].ts`
- [ ] T014 [P] [US1] Create `UploadZone.astro` component in `src/components/bulk/UploadZone.astro`
- [ ] T015 [US1] Create basic `ResultsTable.astro` (preview mode supporting row selection) in `src/components/bulk/ResultsTable.astro`
- [ ] T016 [US1] Create main bulk page structure in `src/pages/bulk-eval/index.astro`

### Phase 4: Configure & Run (User Story 2)
**Goal**: Execute sequential evaluations with dynamic prompts.
**Independent Test**: Trigger a run and verify database status updates via polling.

- [ ] T017 [US2] Integration test for Evaluator logic in `tests/integration/bulk-evaluator.test.ts`
- [ ] T018 [P] [US2] Create `ConfigPanel.astro` (Prompt, Temp, Models) in `src/components/bulk/ConfigPanel.astro`
- [ ] T019 [US2] Implement `BulkEvaluator` class (sequential logic with error handling) in `src/lib/bulk-evaluator.ts`
- [ ] T020 [US2] Implement start run API in `src/pages/api/bulk/runs/index.ts`
- [ ] T021 [US2] Implement get run status API in `src/pages/api/bulk/runs/[id].ts`
- [ ] T022 [US2] Implement cancel run API in `src/pages/api/bulk/runs/[id]/cancel.ts`
- [ ] T023 [US2] Wire up client-side polling in `src/pages/bulk-eval/index.astro`

### Phase 5: View Detailed Results (User Story 3)
**Goal**: Visualize results with side-by-side columns and deep dive drawer.
**Independent Test**: Verify API returns results and UI renders them correctly.

- [ ] T024 [US3] Integration test for Results API response in `tests/integration/bulk-results.test.ts`
- [ ] T025 [US3] Update `ResultsTable.astro` to support dynamic result columns in `src/components/bulk/ResultsTable.astro`
- [ ] T026 [P] [US3] Create `EvaluationDetailsDrawer.astro` in `src/components/bulk/EvaluationDetailsDrawer.astro`
- [ ] T027 [US3] Connect Drawer events in `src/pages/bulk-eval/index.astro`

### Phase 6: Polish & Cross-Cutting
**Goal**: Finalize UX and verification.

- [ ] T028 [P] Implement concurrent upload blocking logic in `src/pages/api/bulk/datasets/index.ts`
- [ ] T029 Create E2E test for full bulk flow in `tests/e2e/bulk-flow.spec.ts`
- [ ] T030 Refine styling for Table and Drawer in `src/styles/components.css`

## Dependencies

- Phase 1 & 2 must be complete before Phase 3, 4, or 5.
- Phase 3 (Upload) is prerequisite for Phase 4 (Run).
- Phase 4 (Run) is prerequisite for Phase 5 (View Results).

## Parallel Execution Examples

- **User Story 1**: T014 (Upload UI) and T015 (Table UI) can be built while T012/T013 (APIs) are implemented.
- **User Story 2**: T018 (Config UI) can be built while T019 (Evaluator Logic) is written.
- **User Story 3**: T026 (Drawer UI) is independent of the main table logic T025.

## Implementation Strategy

1. **MVP Scope**: Complete Phases 1-4. This allows uploading, running, and seeing status. Phase 5 adds the critical result visualization.
2. **Incremental**: 
   - First, get the CSV into the DB (Ph 1-3).
   - Then, make the "Run" button work and log output (Ph 4).
   - Finally, render the output nicely (Ph 5).