# Implementation Plan: UI/UX Improvements

**Branch**: `004-ui-ux-improvements` | **Date**: 2025-12-23 | **Spec**: [specs/004-ui-ux-improvements/spec.md](spec.md)
**Input**: Feature specification from `/specs/004-ui-ux-improvements/spec.md`

## Summary

Enhance the Evaluation List with pagination, advanced filtering (Date, Accuracy, Rubric), and bulk delete capabilities. Improve overall UI/UX with a global typography scale, new themes (Silk, Luxury, Cupcake, Nord), and strict accessibility compliance (WCAG 2.1 AA).

## Technical Context

**Language/Version**: TypeScript 5.6+ (Node.js >= 22.0.0)
**Primary Dependencies**: Astro 5.x, Tailwind CSS 4.x, DaisyUI 5.x, better-sqlite3
**Storage**: SQLite (better-sqlite3)
**Testing**: Vitest (Unit/Integration), Playwright (E2E)
**Target Platform**: Node.js SSR
**Project Type**: Web Application (Astro)
**Performance Goals**: List rendering < 200ms (p95) for 50 items; DB queries < 50ms.
**Constraints**: Mobile-responsive (min 320px), WCAG 2.1 AA compliance.
**Scale/Scope**: ~1000s of evaluations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Code Quality**: SRP enforced in `db.ts` extensions; Type-safe interfaces for new filters.
- [x] **II. Testing**: Contract tests for new API params; E2E tests for pagination/bulk actions.
- [x] **III. UX Consistency**: Using standard DaisyUI patterns; Consistent typography scale.
- [x] **IV. Performance**: Pagination prevents DOM overload; SQLite indexes on date/rubric (to be verified).

## Project Structure

### Documentation (this feature)

```text
specs/004-ui-ux-improvements/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI spec for new endpoints
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── Pagination.astro       # New
│   ├── FilterBar.astro        # New
│   ├── BulkActions.astro      # New
│   └── ui/
│       └── ConfirmationModal.astro # Refactor/New
├── lib/
│   ├── db.ts                  # Extended with pagination/filtering
│   └── typography.ts          # New (typography scale constants)
├── pages/
│   ├── index.astro            # Update with new components
│   └── api/
│       └── evaluations/
│           ├── index.ts       # Update GET (filters), DELETE (bulk)
│           └── [id].ts        # Update DELETE
└── styles/
    └── global.css             # Typography updates
```

**Structure Decision**: Option 1 (Single project) - Extending existing Astro structure.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
