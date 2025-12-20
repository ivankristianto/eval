# Implementation Plan: Update UI with DaisyUI

**Branch**: `002-update-ui-style` | **Date**: 2025-12-20 | **Spec**: [specs/002-update-ui-style/spec.md](specs/002-update-ui-style/spec.md)
**Input**: Feature specification from `specs/002-update-ui-style/spec.md`

## Summary

This feature updates the application's user interface to use DaisyUI (a Tailwind CSS component library) for a consistent, modern, and accessible design. Key changes include a global layout with a top navbar, persistent theme selection (system/light/dark), and styled components for data tables, forms, and evaluation results.

## Technical Context

**Language/Version**: TypeScript 5.6.0+, Node.js >= 22.0.0
**Primary Dependencies**: Astro 5.16.6, Tailwind CSS 4.0.0, daisyui (v5 beta/latest compatible with TW v4)
**Storage**: localStorage for theme persistence; SQLite for application data (no schema changes)
**Testing**: Vitest (Unit), Playwright (E2E for UI verification)
**Target Platform**: Web (Responsive: Mobile + Desktop)
**Project Type**: Web Application (Astro + Node.js adapter)
**Performance Goals**: <200ms TTI, <100ms interaction latency for UI controls
**Constraints**: Must maintain accessibility > 90 (Lighthouse), mobile-first responsive design
**Scale/Scope**: ~10-15 UI components to update/create, global layout refactoring

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality Standards
- **SRP**: UI components will be broken down into small, reusable units (e.g., `Navbar`, `ModelCard`, `ResultBadge`).
- **Naming**: DaisyUI utility classes provide explicit naming; custom components will follow project conventions.

### II. Testing Discipline
- **Test-First**: E2E tests will be written to verify UI elements presence and interactivity before implementation.
- **Coverage**: Manual verification + E2E checks (Visual regression deferred).

### III. User Experience Consistency
- **Patterns**: DaisyUI enforces consistent visual patterns.
- **Workflows**: Navigation and primary actions (Create Evaluation) are standardized.

### IV. Performance & Scalability
- **Goals**: DaisyUI is lightweight (pure CSS/Tailwind).
- **Optimization**: Theme switching handled client-side to avoid FOUC.

## Project Structure

### Documentation (this feature)

```text
specs/002-update-ui-style/
├── plan.md              # This file
├── research.md          # Completed
├── data-model.md        # Completed
├── quickstart.md        # Completed
├── contracts/           # Completed (ui-state.md)
└── tasks.md             # To be created
```

### Source Code (repository root)

```text
src/
├── components/          # Reusable UI components
│   ├── layout/          # Layout components (Navbar, Sidebar if any, Footer)
│   ├── ui/              # Atom components (Button, Input, Card, Badge)
│   └── ...
├── layouts/             # Astro Layouts (Layout.astro)
├── pages/               # Astro Pages
└── styles/              # Global styles (global.css with Tailwind directives)

tests/
├── e2e/                 # Playwright tests for UI flows
└── unit/                # Component unit tests
```

**Structure Decision**: Standard Astro project structure. Adding `src/components/ui` for atoms and `src/components/layout` for structural components.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | | |
