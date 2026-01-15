# Implementation Plan: Bulk Evaluation

**Branch**: `007-bulk-evaluation` | **Date**: 2025-12-28 | **Spec**: [specs/007-bulk-evaluation/spec.md](../specs/007-bulk-evaluation/spec.md)
**Input**: Feature specification from `/specs/007-bulk-evaluation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature enables users to perform bulk evaluations of AI models by uploading a CSV dataset. Users can map CSV columns to a system prompt using Mustache templates, select multiple models, and execute evaluations sequentially. Results are persisted in SQLite and displayed in a tabular view with side-by-side model outputs and a detailed drawer view for deep inspection.

## Technical Context

**Language/Version**: TypeScript 5.6+ (Node.js >= 22.0.0)
**Primary Dependencies**:

- `better-sqlite3` (Storage)
- `astro` (Framework)
- `uuid` (ID generation)
- `papaparse` (CSV parsing)
- `mustache` (Templating)
  **Storage**: SQLite (via `better-sqlite3`)
  **Testing**: Vitest (Unit/Integration), Playwright (E2E)
  **Target Platform**: Node.js Server (Astro SSR)
  **Project Type**: Web Application
  **Performance Goals**:
- CSV Preview load < 2s for 100 rows
- Real-time evaluation status updates (latency < 1s, via 1-2s polling)
  **Constraints**:
- Sequential execution to prevent rate limiting
- Block concurrent uploads during active runs
  **Scale/Scope**: V1 limited to file sizes reasonable for single-server SQLite (e.g., < 1000 rows suggested in spec)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Code Quality**: Plan enforces SRP by separating CSV parsing, Evaluation logic, and Persistence.
- [x] **II. Testing Discipline**: Plan includes Contract tests for CSV upload and Evaluation endpoints, plus E2E tests for the full flow.
- [x] **III. UX Consistency**: Uses existing Drawer and Table patterns; adds standard loading/error states.
- [x] **IV. Performance**: Explicit goals set for CSV load and update latency.

## Project Structure

### Documentation (this feature)

```text
specs/007-bulk-evaluation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── csv-parser.ts        # CSV parsing utility
│   ├── bulk-evaluator.ts    # Core bulk execution logic
│   └── templates.ts         # Mustache templating wrapper
├── pages/
│   ├── api/
│   │   ├── upload-dataset.ts # API: Upload CSV
│   │   ├── bulk-run.ts       # API: Trigger run
│   │   └── dataset/[id].ts   # API: Get dataset/results
│   └── bulk-eval/
│       └── index.astro       # UI: Main page
├── components/
│   ├── bulk/
│   │   ├── UploadZone.astro
│   │   ├── ConfigPanel.astro
│   │   └── ResultsTable.astro
└── tests/
    ├── unit/
    │   ├── csv-parser.test.ts
    │   └── templates.test.ts
    ├── integration/
    │   └── bulk-evaluator.test.ts
    └── e2e/
        └── bulk-flow.spec.ts
```

**Structure Decision**: Option 1 (Single project) - standard Astro project structure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**
> | Violation | Why Needed | Simpler Alternative Rejected Because |
> |-----------|------------|-------------------------------------|
> | N/A | | |
