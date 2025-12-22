# Tasks: Update UI with DaisyUI

**Branch**: `002-update-ui-style` | **Date**: 2025-12-20
**Spec**: [specs/002-update-ui-style/spec.md](specs/002-update-ui-style/spec.md)

## Dependencies

- **Phase 1 (Setup)**: Blocks everything.
- **Phase 2 (Foundational)**: Blocks US1, US2, US3.
- **Phase 3 (US1)**: Blocks US2, US3 (depends on Global Layout).
- **Phase 4 (US2)**: Independent of US3.
- **Phase 5 (US3)**: Independent of US2.
- **Phase 6 (Polish)**: Blocks completion.

## Implementation Strategy

We will follow a component-driven approach. First, we establish the design system (setup + atoms). Then, we build the global shell (layout + navigation). Finally, we apply the new design to specific feature pages (Models, Templates, Results) incrementally. E2E tests will be written first (or updated) to ensure existing functionality isn't broken during the UI refactor.

---

## Phase 1: Setup

**Goal**: Initialize DaisyUI and configure the project for the new design system.

- [x] T001 Install `daisyui@latest` and configure it in CSS for Tailwind v4 compatibility (see `specs/002-update-ui-style/research.md`)
- [x] T002 Update `src/styles/global.css` to import DaisyUI plugin
- [x] T003 Create directory structure for UI components: `src/components/ui/` and `src/components/layout/`

## Phase 2: Foundational Components

**Goal**: Build the core building blocks and global layout shell.

- [x] T004 [P] Create `ThemeController` component in `src/components/layout/ThemeController.astro` with inline script for FOUC prevention
- [x] T005 [P] Create `Toast` component and global store (Nano Stores) in `src/lib/toastStore.ts` and `src/components/ui/Toast.astro`
- [x] T006 [P] Create `Navbar` component in `src/components/layout/Navbar.astro` (Top Navbar with responsive hamburger menu)
- [x] T007 [P] Create `Breadcrumbs` component in `src/components/ui/Breadcrumbs.astro`
- [x] T008 [P] Create reusable Atom components: `Button.astro`, `Input.astro`, `Card.astro`, `Badge.astro` in `src/components/ui/`
- [x] T009 Create `Layout.astro` in `src/layouts/Layout.astro` integrating Navbar, ThemeController, and Toast container
- [x] T010 [P] Create `EmptyState.astro` component in `src/components/ui/EmptyState.astro` (Hero with CTA)

## Phase 3: User Story 1 - Global Application Layout & Routing

**Goal**: Apply the new global layout and implement the new routing structure (History on Home).
**Story**: [US1] Global Application Layout

- [x] T011 [US1] Create E2E test for Global Layout and new Routing structure in `tests/e2e/layout.spec.ts` (Verify fail first)
- [x] T012 [US1] Refactor `src/pages/index.astro` to serve as Evaluation History Dashboard (migrate logic from `history.astro`) using new `Layout`
- [x] T013 [US1] Remove `src/pages/history.astro` and configure redirect to `/` if necessary
- [x] T014 [P] [US1] Update `src/pages/models.astro` to use new `Layout`
- [x] T015 [P] [US1] Update `src/pages/templates.astro` to use new `Layout`
- [x] T016 [US1] Verify responsive behavior of Navbar on mobile viewports

## Phase 4: User Story 2 - Model and Template Management UI

**Goal**: Refactor Model and Template list/edit views using the new DaisyUI components.
**Story**: [US2] Model and Template Management UI

- [x] T017 [US2] Create E2E test for Models page UI elements in `tests/e2e/models-ui.spec.ts` (Verify fail first)
- [x] T018 [US2] Refactor `src/pages/models.astro` list view to use `Card` or `Table` components
- [x] T019 [US2] Refactor `src/pages/api/models/[id].ts` forms (or the page handling edits) to use `Input` and `Button` atoms
- [x] T020 [P] [US2] Refactor `src/pages/templates.astro` list view to use `Card` or `Table` components
- [x] T021 [US2] Ensure "Create New" buttons are in top-right content area (FR-010)
- [x] T022 [US2] Verify Empty State appears when no models/templates exist

## Phase 5: User Story 3 - Evaluation Results Visualization

**Goal**: Implement dedicated Evaluation Results page and refactor visualizations.
**Story**: [US3] Evaluation Results Visualization

- [x] T023 [US3] Create E2E test for dedicated Results page and visualization in `tests/e2e/results-ui.spec.ts` (Verify fail first)
- [x] T024 [US3] Create `src/pages/evaluations/[id].astro` to display detailed results (migrate logic from old `index.astro`)
- [x] T025 [US3] Update `NewEvaluationModal` (or logic) to redirect to `/evaluations/[id]` upon starting a run
- [x] T026 [US3] Refactor Evaluation Result items/rows to use `Badge` for status (Success/Error) with semantic colors
- [x] T027 [P] [US3] Apply `Table` styles to result data grids within the new dedicated page
- [x] T028 [US3] Integrate `Skeleton` loaders for data-heavy sections (if loading states exist)

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Final consistency checks, accessibility validation, and clean up.

- [x] T029 Run Lighthouse Accessibility audit on all major pages and fix violations (Target > 90) use chrome mcp server
- [x] T030 Verify keyboard navigation (focus rings) on all interactive elements
- [x] T031 Verify dark mode persistence across page reloads
- [x] T032 Final manual visual check against "CleanShot" reference implications
