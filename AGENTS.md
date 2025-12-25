# eval-ai-models Agent Guide

Auto-generated from CLAUDE.md and GEMINI.md. Last updated: 2025-12-22.

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
- Plugins: eslint-plugin-astro, @typescript-eslint

### Style Rules

- Semicolons: required
- Quotes: double quotes
- Indentation: 2 spaces
- Trailing commas: ES5 style
- Line width: 100 characters
- Unused variables: warn (prefix with `_` to ignore)
- Explicit `any`: warn

## Styling Conventions

**TOP PRIORITY**: Always use Tailwind CSS v4 utility classes for styling.
- Use Tailwind v4 syntax and features (e.g., `@theme` directive, CSS variables)
- Leverage daisyUI component classes when appropriate
- Only fall back to custom CSS when Tailwind utilities cannot achieve the desired result
- When custom CSS is necessary, document why Tailwind was insufficient

## Recent Changes

- 001-eval-ai-models: Added TypeScript 5.6+ on Node.js 22+ + Astro 5.x (SSR),
  Tailwind CSS 4.x, better-sqlite3, OpenAI SDK, Anthropic SDK, Google
  Generative AI SDK
- 001-eval-ai-models: Added JavaScript/TypeScript (Node.js 18+) + TypeScript
  for type safety + Astro, Tailwind CSS, SQLite3, node-sqlite3/better-sqlite3
- 002-update-ui-style: Added TypeScript 5.6.0+, Node.js >= 22.0.0 + Astro
  5.16.6, Tailwind CSS 4.0.0, daisyui (v5 beta/latest compatible with TW v4)
