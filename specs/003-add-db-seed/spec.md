# Feature Specification: Database Seeding Command

**Feature Branch**: `003-add-db-seed`  
**Created**: 2025-12-22  
**Status**: Draft  
**Input**: User description: "Implement a new `db:seed` npm command to populate the database with initial evaluation templates from a CSV file and conditionally seed model configurations based on available API keys in the environment."

## Clarifications

### Session 2025-12-22
- Q: How should model_ids be represented in db/templates.csv? → A: Use provider:model_name strings (e.g., "openai:gpt-4o") and resolve to UUIDs during seeding.
- Q: What is the specific behavior of the --force flag? → A: Truncate/Clear the EvaluationTemplate and ModelConfiguration tables before seeding to ensure a clean slate.
- Q: How should the system handle a template in the CSV referencing a model that isn't seeded/available? → A: Throw an error and abort that specific template's insertion to ensure data integrity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Environment Setup (Priority: P1)

As a developer setting up the project for the first time, I want to run a single command to populate my database with sample evaluation templates and model configurations so that I can start testing the application immediately without manual entry.

**Why this priority**: Essential for developer onboarding and rapid development cycles. It's the core value proposition of the seeding command.

**Independent Test**: Can be tested by running `npm run db:seed` on a clean database and verifying that evaluation templates from `db/templates.csv` and model configurations (for which API keys exist in `.env`) are correctly inserted into the database.

**Acceptance Scenarios**:

1. **Given** a fresh database and a valid `db/templates.csv`, **When** I run `npm run db:seed`, **Then** the database should contain all templates from the CSV and models corresponding to available API keys.
2. **Given** `OPENAI_API_KEY` is present in `.env`, **When** I run the seeding command, **Then** OpenAI model configurations should be created with encrypted keys in the database.
3. **Given** `ANTHROPIC_API_KEY` is missing from `.env`, **When** I run the seeding command, **Then** no Anthropic model configurations should be created.

---

### User Story 2 - Incremental Data Updates (Priority: P2)

As a developer, I want to add new templates to the CSV file and run the seed command again to add only the new items without duplicating or overwriting existing data.

**Why this priority**: Supports ongoing development where new test cases are added over time. Prevents data corruption or loss of manual changes in the DB.

**Independent Test**: Can be tested by running the seed command twice; the second run should report that all existing items were skipped and no duplicate records should exist in the database.

**Acceptance Scenarios**:

1. **Given** templates already exist in the database, **When** I run `npm run db:seed` with the same CSV, **Then** the system should log that existing templates were skipped and no new records should be created for them.
2. **Given** a new entry is added to `db/templates.csv`, **When** I run the seeding command, **Then** only the new entry should be added to the database.

---

### User Story 3 - Data Reset and Forced Seeding (Priority: P3)

As a developer, I want to be able to force a complete re-seed of the database, clearing existing data and starting fresh from the current configuration files.

**Why this priority**: Useful when the schema changes or when the local database state becomes inconsistent and needs a "factory reset" for data.

**Independent Test**: Can be tested by running `npm run db:seed --force` and verifying that existing records are replaced with the latest versions from the source files.

**Acceptance Scenarios**:

1. **Given** existing data in the database, **When** I run `npm run db:seed --force`, **Then** the system should clear relevant tables before populating them with data from CSV and JSON sources.

---

### Edge Cases

- **Missing CSV File**: If `db/templates.csv` is missing, the command should provide a clear error message explaining the file is required for template seeding, but should still attempt to seed model configurations.
- **Malformed CSV Data**: If a row in the CSV is missing required fields (e.g., `name`, `instruction_text`), the command should log an error for that specific row and continue with others.
- **Invalid JSON in CSV**: If fields like `model_ids` or `partial_credit_concepts` contain invalid JSON strings, the system should log an error and skip that record.
- **Missing ENCRYPTION_KEY**: If `ENCRYPTION_KEY` is missing from the environment, the command should fail immediately as it cannot securely store API keys.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an `npm run db:seed` command that executes a `db/seed.js` script.
- **FR-002**: System MUST parse `db/templates.csv` to populate the `EvaluationTemplate` table.
- **FR-003**: System MUST support seeding templates with: `name`, `description`, `instruction_text`, `accuracy_rubric`, `partial_credit_concepts`, `expected_output`, and `model_ids` (as `provider:model_name` strings).
- **FR-004**: System MUST conditionally seed model configurations into the `ModelConfiguration` table based on the presence of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GOOGLE_API_KEY` in `.env`.
- **FR-005**: System MUST encrypt API keys using the `ENCRYPTION_KEY` before storing them in the database.
- **FR-006**: System MUST implement idempotency by checking for existing records (by `name` for templates, and by `provider` + `model_name` for models).
- **FR-007**: System MUST support a `--force` flag to clear and re-populate the tables.
- **FR-008**: System MUST support a `--dry-run` flag to preview changes without modifying the database.
- **FR-009**: System MUST log detailed progress to the console, including counts of records created, skipped, or failed.
- **FR-010**: System MUST validate that `ENCRYPTION_KEY` is present before attempting to seed models.
- **FR-011**: System SHOULD load default model configurations from a `db/default-models.json` file.

### Key Entities *(include if feature involves data)*

- **EvaluationTemplate**: Represents a reusable prompt with specific instructions and evaluation rubrics. Key attributes: `name`, `instruction_text`, `accuracy_rubric` (enum), `expected_output`.
- **ModelConfiguration**: Stores settings and encrypted credentials for AI providers. Key attributes: `provider`, `model_name`, `api_key_encrypted`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can populate a fresh database with at least 5 sample templates in under 10 seconds via `npm run db:seed`.
- **SC-002**: 100% of available API keys in `.env` are correctly detected and result in functional model configurations in the database.
- **SC-003**: Zero duplicate records are created when running the seed command multiple times without the `--force` flag.
- **SC-004**: All API keys stored in the database are encrypted and cannot be read as plain text without the `ENCRYPTION_KEY`.
- **SC-005**: Command exits with code 0 on success and a non-zero code when critical errors (like missing `ENCRYPTION_KEY`) occur.