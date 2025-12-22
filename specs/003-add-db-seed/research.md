# Research: Database Seeding Implementation

## 1. CSV Parsing Library

**Context**: We need to parse `db/templates.csv` to insert evaluation templates.
**Unknown**: Best library for Node.js usage in this project.

**Options**:
1.  `csv-parse`: The standard, robust parser.
2.  `fast-csv`: Another popular option.
3.  Native `fs` + `split`: Brittle, hard to handle quoted fields/newlines.

**Decision**: Use `csv-parse`.
**Rationale**: It's widely used, robust, and handles edge cases (quoted strings, newlines) correctly. We will use the synchronous API (`csv-parse/sync`) or the promise-based API for simplicity, as the file size is small (seed data).

## 2. Encryption Compatibility

**Context**: API keys must be encrypted in the DB. `src/lib/db.ts` uses `aes-256-gcm`.
**Constraint**: `db/seed.js` is a standalone JS file and cannot import `src/lib/db.ts` (TS) directly.

**Analysis of `src/lib/db.ts`**:
- Algorithm: `aes-256-gcm`
- IV: 16 bytes (random)
- Key: From `ENCRYPTION_KEY` env var (hex string)
- Output format: `ivHex:authTagHex:encryptedHex`

**Decision**: Replicate the exact encryption logic in `db/seed.js`.
**Rationale**: This ensures compatibility. The app can decrypt keys seeded by the script. We will add a comment in both files referencing the other to warn about future changes.

## 3. Idempotency Strategy

**Context**: Running `db:seed` multiple times should not create duplicates.

**Decision**:
- **Templates**: Check existence by `name`. If exists, skip (log "Skipped").
- **Models**: Check existence by `provider` AND `model_name`. If exists, skip.
- **Force Mode**: If `--force` flag is present, `DELETE FROM EvaluationTemplate` and `DELETE FROM ModelConfiguration` (where `is_active=1` or all?) before seeding. *Correction*: `db/init.js` might be a better place for "reset", but `--force` in seed usually means "overwrite".
    - Refined Decision: `--force` will TRUNCATE (or delete all from) the relevant tables before seeding to ensure a clean state matching the seed files.

## 4. Testing Strategy

**Context**: Need to verify the seed command works.

**Decision**:
- **Integration Test**: Create a Vitest test file `tests/integration/seed.test.ts`.
- **Mechanism**:
    1.  Setup a temporary test database (or use an in-memory one if possible, but the script writes to file).
    2.  Set `ENCRYPTION_KEY` and dummy API keys in `process.env`.
    3.  Execute `node db/seed.js` via `child_process.execSync`.
    4.  Connect to the DB using `better-sqlite3` and assert records exist and are correct (count, values, encrypted keys).
    5.  Run it again to test idempotency.
    6.  Run with `--force` to test reset.
