# E2E Testing Setup

This directory contains end-to-end tests using Playwright.

## Database Isolation

E2E tests use a **separate database** to ensure your production data remains untouched:

- **Production DB**: `db/evaluation.db`
- **E2E Test DB**: `db/evaluation.e2e-test.db`

The E2E test database is automatically configured in `playwright.config.ts` via the `EVAL_DB_PATH` environment variable.

## Running E2E Tests

### Standard Run
```bash
npm run test:e2e
```

### Clean Run (Deletes test database first)
```bash
npm run test:e2e:clean
```

This ensures each test run starts with a fresh database state.

### Clean Test Database Only
```bash
npm run db:e2e:clean
```

## How It Works

1. When Playwright starts the dev server for E2E tests, it sets `EVAL_DB_PATH=./db/evaluation.e2e-test.db`
2. The application (`src/lib/db.ts`) reads this environment variable and uses the test database
3. All E2E tests interact with the isolated test database
4. Your production database (`db/evaluation.db`) is never touched

## Important Notes

- The E2E test database is **gitignored** and will not be committed
- WAL files (`.db-shm`, `.db-wal`) are also automatically cleaned up
- Schema and migrations are applied automatically when the test database is first accessed
- Test data persists between runs unless you use `test:e2e:clean`
