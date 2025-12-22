# Implementation Plan: Database Seeding Command

**Branch**: `003-add-db-seed` | **Date**: 2025-12-22 | **Spec**: [specs/003-add-db-seed/spec.md](./spec.md)
**Input**: Feature specification from `specs/003-add-db-seed/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a new `db:seed` npm command to populate the database with initial evaluation templates from `db/templates.csv` and conditionally seed model configurations based on available API keys in `.env`. The command will support idempotency, force re-seeding, and secure API key encryption using the project's existing encryption standard (AES-256-GCM).

## Technical Context

**Language/Version**: JavaScript (Node.js >= 22.0.0) for the seed script; TypeScript 5.6+ for the main app.
**Primary Dependencies**: `better-sqlite3` (existing), `csv-parse` (new dependency for CSV processing), `dotenv` (to load env vars), `uuid` (existing, for generating IDs).
**Storage**: SQLite via `better-sqlite3`.
**Testing**: Manual testing via CLI execution; Integration testing via a test runner (Vitest) that invokes the seed script.
**Target Platform**: Node.js CLI.
**Project Type**: Server-side script / CLI.
**Performance Goals**: Seed < 100 templates in < 10s (SC-001).
**Constraints**: 
- MUST encrypt API keys using the same logic as `src/lib/db.ts` (AES-256-GCM) so the app can decrypt them.
- MUST be idempotent (running twice shouldn't duplicate data).
- MUST run as a standalone script via `node db/seed.js` (consistent with `db:init`).
**Scale/Scope**: Small scale (initial seed data).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Code Quality Standards**: The seed script will be modular (parsing, database ops, encryption) and use clear variable names.
- [x] **II. Testing Discipline**: Tests will be written to verify the seed script's behavior (idempotency, encryption correctness).
- [x] **III. User Experience Consistency**: The CLI will provide clear progress logs and error messages, matching the style of `db:init`.
- [x] **IV. Performance & Scalability**: Operations will be batched or transaction-wrapped for performance. <10s goal is achievable.

## Project Structure

### Documentation (this feature)

```text
specs/003-add-db-seed/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A for CLI, but maybe schema definitions)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
db/
├── seed.js              # NEW: The seeding script
├── templates.csv        # NEW: Initial templates data
└── default-models.json  # NEW: Default model configurations (optional)

tests/
└── integration/
    └── seed.test.ts     # NEW: Integration tests for seeding
```

**Structure Decision**: A standalone `db/seed.js` is chosen to align with the existing `db/init.js` pattern, avoiding complex TS compilation setup for database scripts while ensuring immediate utility.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Code Duplication (Encryption) | `db/seed.js` needs encryption logic identical to `src/lib/db.ts` but cannot import TS directly. | Introducing a build step for DB scripts complicates the dev environment significantly. |