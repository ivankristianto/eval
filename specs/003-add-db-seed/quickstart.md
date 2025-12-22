# Quickstart: Database Seeding

## Prerequisites

1.  **Environment Variables**: Ensure `.env` is set up with:
    - `ENCRYPTION_KEY`: A 32-byte hex string (generate via `openssl rand -hex 32`).
    - API Keys (optional): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`.
2.  **Database**: Initialize the database first.
    ```bash
    npm run db:init
    ```

## Usage

### 1. Standard Seed
Populate the database with templates from `db/templates.csv` and models from `.env`.
```bash
npm run db:seed
```

### 2. Force Re-seed
**Warning**: This deletes all existing templates and models before seeding.
```bash
npm run db:seed -- --force
```
*(Note the extra `--` to pass arguments to the script)*

### 3. Dry Run
Preview what would happen without making changes.
```bash
npm run db:seed -- --dry-run
```

## Troubleshooting

- **"ENCRYPTION_KEY environment variable not set"**:
  Add `ENCRYPTION_KEY` to your `.env` file. It must match the key used by the application to decrypt the keys.

- **"Skipped (exists)"**:
  The template or model already exists in the database. Use `--force` if you want to update it to match the file/env.

- **"Invalid rubric type"**:
  Check `db/templates.csv` and ensure `accuracy_rubric` matches one of: `exact_match`, `partial_credit`, `semantic_similarity`.
