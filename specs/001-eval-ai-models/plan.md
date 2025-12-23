# Implementation Plan: AI Model Evaluation Framework

**Branch**: `001-eval-ai-models` | **Date**: 2025-12-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-eval-ai-models/spec.md`

## Summary

Build a web-based evaluation framework that allows users to submit prompts to multiple AI models simultaneously, measuring execution time, token costs, and accuracy. The system uses Astro 5 with SSR for the frontend, SQLite for persistence, and integrates with OpenAI, Anthropic Claude, and Google Gemini APIs. Users can compare model performance in real-time, save evaluation templates for reuse, and apply custom accuracy rubrics (Exact Match, Partial Credit, Semantic Similarity).

## Technical Context

**Language/Version**: TypeScript 5.6+ on Node.js 22+
**Primary Dependencies**: Astro 5.x (SSR), Tailwind CSS 4.x, better-sqlite3, OpenAI SDK, Anthropic SDK, Google Generative AI SDK
**Storage**: SQLite via better-sqlite3 (local persistence, single-file database)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web application (desktop browsers), server-side rendering with Node.js adapter
**Project Type**: Web application (SSR)
**Performance Goals**:
- Evaluation results within 30 seconds for 3+ models (per SC-001)
- UI remains responsive during async model queries (per SC-005)
- Results comprehension within 10 seconds (per SC-008)
**Constraints**:
- 30-second per-model timeout (per spec clarification)
- Wall-clock time accuracy ±5% (per SC-002)
- Support instructions up to 10,000 characters
**Scale/Scope**: Single user or small team, local deployment, MVP handles single instruction runs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Pre-Design Status | Post-Design Status |
|-----------|-------------|-------------------|-------------------|
| I. Code Quality | SRP, explicit naming, documented commits | ✅ PASS - Codebase follows clear patterns | ✅ PASS - Design maintains SRP: evaluator.ts (orchestration), accuracy.ts (scoring), validators.ts (input), db.ts (persistence). Interfaces in types.ts are explicit. |
| II. Testing Discipline | Tests written FIRST, >80% coverage critical paths | ⚠️ GAP - Tests directory exists but incomplete | ✅ PASS - Coverage run complete: validators.ts 84.29%, accuracy.ts 92.85%, evaluator.ts 93.05% (critical paths). |
| III. UX Consistency | Standardized patterns, user-friendly errors | ✅ PASS - Consistent UI patterns with Tailwind | ✅ PASS - Design specifies consistent error responses (error, message, field, details). All endpoints follow REST conventions. UI templates use Popover API consistently. |
| IV. Performance | Explicit targets defined, constraints documented | ✅ PASS - Goals defined above | ✅ PASS - Technical context defines 30s per-model timeout, 5-min total, wall-clock accuracy ±5%. Database indexes defined for common queries (evaluation_id, active, created_at). |

**Gate Status**: ✅ PASS - Critical-path coverage verified; other principles satisfied.

**Action Items for Phase 2**:
- Raise api-clients.ts coverage to >70% and db.ts to >75% (non-critical targets)
- Ensure E2E tests cover user workflows: add model → submit evaluation → view results
- Verify contract tests align with OpenAPI spec

## Project Structure

### Documentation (this feature)

```text
specs/001-eval-ai-models/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output - API contracts
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/          # Astro components (TemplateManager.astro, etc.)
├── lib/                 # Core business logic
│   ├── types.ts         # TypeScript type definitions
│   ├── validators.ts    # Input validation
│   ├── accuracy.ts      # Accuracy scoring (rubrics)
│   └── evaluator.ts     # Model evaluation orchestration
├── pages/               # Astro pages and API routes
│   ├── index.astro      # Main evaluation page
│   ├── templates.astro  # Templates listing page
│   ├── history.astro    # Evaluation history page
│   └── api/             # REST API endpoints
│       ├── models.ts
│       ├── evaluate.ts
│       ├── templates.ts
│       └── results.ts
├── public/              # Static assets
└── styles/              # Global styles

db/
├── init.js              # Database initialization script
└── evaluation.db        # SQLite database file

tests/
├── contract/            # API contract tests
├── integration/         # Integration tests
└── unit/                # Unit tests
```

**Structure Decision**: Web application with Astro 5 SSR. Single-project structure with clear separation between pages, API routes, and business logic. Database managed externally in `/db/` directory.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Testing gap (Principle II) | Existing implementation predates test coverage | Tests will be added in Phase 2 to cover critical paths |
