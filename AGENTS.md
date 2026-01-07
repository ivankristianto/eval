# eval-ai-models Agent Guide

Auto-generated from CLAUDE.md and GEMINI.md. Last updated: 2025-12-27.

## Agent Initialization

**Before any task, read the constitution.**

```
1. Read `docs/constitution.md` — understand principles and fences
2. Read task context (spec, plan, or issue)
3. Then execute
```

Agents must internalize:

- **Implementation order**: UI → Service → API → CLI → Seeder
- **Quality gates**: Which block, which don't
- **Refactor checklist**: Apply each loop, not at the end

**If constitution conflicts with task instructions, constitution wins.**

## Project Overview

`eval-ai-models` is an AI Model Evaluation Framework designed to compare and
evaluate multiple AI models (OpenAI, Anthropic, Google) against specific
instructions and rubrics. It provides metrics for accuracy scoring, execution
time, and token usage.

## Tech Stack

- Runtime: Node.js >= 22.0.0
- Language: TypeScript 5.6+
- Framework: Astro 5.x (SSR with Node adapter)
- Styling: Tailwind CSS 4.x, daisyui (v5 beta/latest compatible with TW v4)
- Database: SQLite via better-sqlite3
- SDKs: OpenAI SDK, Anthropic SDK, Google Generative AI SDK
- Testing: Vitest (unit/integration), Playwright (E2E)

## Architecture

- Astro project with server-side API endpoints and a database-driven backend.
- Database schema in `db/schema.sql` with tables:
  - `ModelConfiguration`, `EvaluationTemplate`, `Evaluation`, `Result`
- Core logic in `src/lib/`:
  - `evaluator.ts`: orchestration, concurrency, timeouts, aggregation
  - `api-clients.ts`: provider abstraction
  - `accuracy.ts`: rubric scoring
  - `db.ts`: database access layer
- API routes in `src/pages/api/`
- Theme persistence uses localStorage; application data stored in SQLite.

## Project Structure

```text
openapi.yml
src/
tests/
db/
```

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run db:init
npm run db:reset
npm test
npm run test:e2e
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
```

## Pre-Commit Quality Gates

**Before committing ANY code**, you MUST run:

```bash
npm run lint         # ESLint check
npm run typecheck    # Typeheck
npm run format:fix    # Prettier auto-format
```

## Testing Status

Latest coverage (vitest `npm test -- --coverage`):

- Overall line coverage: 69.17%
- Critical path coverage: validators.ts 84.29%, accuracy.ts 92.85%, evaluator.ts 93.05%
- Other coverage: api-clients.ts 64.38%, db.ts 62.62%
- Constitution Principle II satisfied for critical paths; improve api-clients/db coverage toward targets

## Development Conventions

- Type safety: strict TypeScript usage is enforced.
- Database: use better-sqlite3 with helpers in `src/lib/db.ts`.
- Environment: configuration via `.env` (see `.env.example`).
- Tests: unit/integration in `tests/unit` or `tests/integration`; E2E in
  `tests/e2e`.
- Structure:
  - `src/pages`: Astro pages and API routes.
  - `src/lib`: core business logic and utilities.
  - `src/components`: UI components.
  - `db`: database initialization and schema.

## Code Style

- Linter: ESLint 9 with flat config (`eslint.config.js`)
- Formatter: Prettier with Astro plugin (`.prettierrc`)
- Plugins: eslint-plugin-astro, @typescript-eslint, eslint-plugin-jsdoc

### Style Rules

- Semicolons: required
- Quotes: double quotes
- Indentation: 2 spaces
- Trailing commas: ES5 style
- Line width: 100 characters
- Unused variables: warn (prefix with `_` to ignore)
- Explicit `any`: warn
- JSDoc: required (warn) for public functions, methods, classes, and arrow functions

## Styling Conventions

**TOP PRIORITY**: Always use Tailwind CSS v4 utility classes for styling.

- Use Tailwind v4 syntax and features (e.g., `@theme` directive, CSS variables)
- Leverage daisyUI component classes when appropriate
- Only fall back to custom CSS when Tailwind utilities cannot achieve the desired result
- When custom CSS is necessary, document why Tailwind was insufficient

## Development Workflow

**ALWAYS FOLLOW THIS IMPLEMENTATION WORKFLOW**

1. **Find work:** Run `bd ready` to find unblocked tasks
2. **Claim:** Run `bd update <id> --status in_progress` for each task
3. **Branch:** `git checkout -b feature/<descriptive-name>`
4. **Implement:** For each task:
   - Write code following component guidelines and design tokens
   - Run `npm run typecheck && npm run lint && npm run format:fix`
   - Commit with clear message: `git commit -m "feat: descriptive message"`
   - Push: `git push`
5. **PR:** Create Pull Request following the GitHub PR template
6. **Review:** Invoke **code-review-specialist** agent to review (comments only, no code changes)
7. **Complete:** After merge:
   - Run `bd close <id>` for each completed task
   - Run `bd sync`
8. **Report:** Provide summary with PR link, tasks completed, review status, and any recommendations

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
