# Tasks: UI/UX Improvements

**Feature Branch**: `004-ui-ux-improvements`
**Status**: To Do
**Spec**: [specs/004-ui-ux-improvements/spec.md](spec.md)

## Implementation Strategy
- **TDD First**: Strict adherence to Constitution Principle II. Unit and Contract tests must be written and failing *before* implementation code is written.
- **Incremental Delivery**: Feature is broken down by User Story. Each story is a complete vertical slice (DB -> API -> UI).
- **Parallelization**: Frontend components can be scaffolded while Backend API is being implemented, provided the Contract is agreed upon.

## Dependencies

1. **Phase 1 (Setup)**: Unblocks all phases.
2. **Phase 2 (US1)**: Unblocks Phase 3 (US2) as it establishes the list view required for selection.
3. **Phase 3 (US2)**: Depends on Phase 2.
4. **Phase 4 (US3)**: Refinement of UI built in Phases 2 & 3.
5. **Phase 5 (US4)**: Global styling update, can be done anytime after Phase 1 but best last to ensure consistency.

---

## Phase 1: Setup
**Goal**: Initialize project with necessary dependencies and global configuration.

- [x] T001 Install @tailwindcss/typography plugin via npm
- [x] T002 Update src/styles/global.css to include typography plugin and ensure DaisyUI themes are enabled
- [x] T003 Create src/lib/typography.ts to define consistent typography scale constants
- [x] T004 Update src/lib/types.ts to include FilterOptions interface and extended Evaluation types with stats

## Phase 2: Evaluation List Management (US1)
**Goal**: Users can paginate and filter the evaluation list.
**Independent Test Criteria**: API returns paginated/filtered results; UI updates list based on filter selection.

### Tests (TDD)
- [x] T005 [US1] Create unit tests for getEvaluations with filters in tests/unit/db.test.ts
- [x] T006 [US1] Create contract tests for GET /api/evaluations with pagination/filtering in tests/contract/evaluations.test.ts
- [ ] T007 [US1] Create E2E test for pagination and filtering in tests/e2e/list-management.spec.ts

### Backend (DB & API)
- [x] T008 [US1] Update src/lib/db.ts to implement getEvaluations with dynamic filtering (JOIN Result for accuracy)
- [x] T009 [US1] Update src/pages/api/evaluations/index.ts to handle limit, offset, and filter query parameters

### Frontend Components
- [x] T010 [P] [US1] Create src/components/Pagination.astro with page size selector
- [x] T011 [P] [US1] Create src/components/FilterBar.astro with Date and Rubric selectors

### Integration
- [x] T012 [US1] Update src/pages/index.astro to integrate Pagination and FilterBar with URL state management
- [x] T012A [US1] Persist pagination page size via URL/localStorage and align limit options (10/20/50/100)
- [x] T012B [US1] Move pagination state to localStorage and remove page/limit query usage

## Phase 3: Bulk Data Cleanup (US2)
**Goal**: Users can delete multiple evaluations at once.
**Independent Test Criteria**: Selected items are removed from DB; Confirmation modal appears before delete.

### Tests (TDD)
- [ ] T013 [US2] Create unit tests for deleteEvaluations(ids) in tests/unit/db.test.ts
- [ ] T014 [US2] Create contract tests for DELETE /api/evaluations in tests/contract/evaluations.test.ts
- [ ] T015 [US2] Create E2E test for bulk selection and deletion in tests/e2e/bulk-delete.spec.ts

### Backend (DB & API)
- [x] T016 [US2] Update src/lib/db.ts to implement deleteEvaluations(ids)
- [x] T017 [US2] Update src/pages/api/evaluations/index.ts to handle DELETE method with JSON body (ids)

### Frontend Components
- [x] T018 [P] [US2] Create or Refactor src/components/ui/ConfirmationModal.astro for generic usage
- [x] T019 [P] [US2] Create src/components/BulkActions.astro with select-all logic and delete trigger

### Integration
- [x] T020 [US2] Update src/pages/index.astro to implement selection state and integrate BulkActions
- [x] T021 [US2] Implement success/error toast notifications for delete actions in src/pages/index.astro

## Phase 4: Accessibility and Mobile Access (US3)
**Goal**: Interface is responsive and WCAG 2.1 AA compliant.
**Independent Test Criteria**: Lighthouse audit passes; mobile view requires no horizontal scroll.

- [x] T022 [US3] Update src/pages/index.astro table layout to support responsive card view on mobile
- [x] T023 [US3] Audit and fix ARIA labels and focus management in Pagination, FilterBar, and BulkActions components

## Phase 5: Visual Customization and Consistency (US4)
**Goal**: Consistent typography and functional theme switching.
**Independent Test Criteria**: Theme switcher persists preference; typography matches scale.

- [x] T024 [US4] Update src/components/layout/ThemeController.astro to include Silk, Luxury, Cupcake, Nord themes
- [x] T025 [US4] Apply typography scale classes from src/lib/typography.ts to src/layouts/Layout.astro and main page headers

## Final Phase: Polish
**Goal**: Final verification and performance check.

- [ ] T026 Run full accessibility audit (Lighthouse) and fix remaining issues
- [ ] T027 Verify performance with large dataset (render time < 200ms)
