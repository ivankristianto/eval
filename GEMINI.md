# Project Overview

`eval-ai-models` is an AI Model Evaluation Framework designed to compare and evaluate multiple AI models (OpenAI, Anthropic, Google) against specific instructions and rubrics. It provides metrics for accuracy scoring, execution time, and token usage.

## Tech Stack

- **Runtime:** Node.js (>=22.0.0)
- **Language:** TypeScript
- **Framework:** Astro (using Node.js adapter for server-side rendering)
- **Database:** SQLite (managed via `better-sqlite3`)
- **Styling:** Tailwind CSS
- **Testing:** Vitest (Unit/Integration), Playwright (E2E)

## Architecture

The application is built as an Astro project with server-side API endpoints and a database-driven backend.

- **Database:** SQLite database defined in `db/schema.sql`.
  - **Tables:** `ModelConfiguration`, `EvaluationTemplate`, `Evaluation`, `Result`.
- **Core Logic (`src/lib/`):**
  - `evaluator.ts`: Orchestrates evaluations, handling concurrency, timeouts, and result aggregation.
  - `api-clients.ts`: Abstract interface for different AI providers.
  - `accuracy.ts`: Logic for scoring model responses based on defined rubrics.
  - `db.ts`: Database access layer.
- **API (`src/pages/api/`):** Exposes endpoints for managing models, templates, and running evaluations.

# Building and Running

## Prerequisites
- Node.js >= 22.0.0

## Installation
```bash
npm install
```

## Database Setup
Initialize the SQLite database before running the application:
```bash
npm run db:init
```
To reset the database (clears all data):
```bash
npm run db:reset
```

## Development Server
Start the Astro development server (default port 3000):
```bash
npm run dev
```

## Production Build
Build the application for production:
```bash
npm run build
```
Preview the production build:
```bash
npm run preview
```

## Testing
Run unit and integration tests with Vitest:
```bash
npm test
```
Run end-to-end tests with Playwright:
```bash
npm run test:e2e
```

## Code Quality
Run linting:
```bash
npm run lint
```
Run type checking:
```bash
npm run typecheck
```

# Development Conventions

- **Type Safety:** Strict TypeScript usage is enforced. See `tsconfig.json` and `src/lib/types.ts` for shared interfaces.
- **Database:** Use `better-sqlite3` for synchronous database operations. Always use the helper functions in `src/lib/db.ts` (if available) or ensuring proper connection handling.
- **Environment:** Configuration is managed via `.env` (see `.env.example`).
- **Testing:**
  - Place unit/integration tests in `tests/unit` or `tests/integration`.
  - Place E2E tests in `tests/e2e` (or configured Playwright directory).
- **Structure:**
  - `src/pages`: Astro pages and API routes.
  - `src/lib`: Core business logic and utilities.
  - `src/components`: UI components.
  - `db`: Database initialization and schema.
