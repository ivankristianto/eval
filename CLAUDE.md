# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`eval-ai-models` is an AI Model Evaluation Framework with an integrated LLM-as-Judge Training System. It enables multi-model evaluation (OpenAI, Anthropic, Google), accuracy measurement using multiple rubrics, and iterative judge training with human-in-the-loop feedback.

**Tech Stack**: Astro 5 (SSR), TypeScript, Tailwind CSS 4, DaisyUI 5, SQLite (better-sqlite3), Vitest, Playwright

## Development Commands

### Essential Commands

```bash
npm run dev              # Start dev server on port 3000
npm run build            # Build for production
npm run preview          # Preview production build

# Database
npm run db:init          # Initialize database from schema.sql
npm run db:reset         # Delete and reinitialize database
npm run db:e2e:clean     # Clean E2E test database

# Testing
npm test                 # Run unit/integration tests (Vitest)
npm run test:coverage    # Run tests with coverage (target >80% on critical paths)
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:clean   # Clean E2E DB and run tests

# Quality Gates (MUST run before commits)
npm run typecheck        # TypeScript strict mode check
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format code with Prettier
npm run format:check     # Check formatting

# Development Tools
npm run storybook        # Component documentation (port 6006)
npm run check            # Astro type checking
```

### Running Single Tests

```bash
# Vitest (unit/integration)
npm test -- path/to/test.test.ts
npm test -- --grep "specific test name"

# Playwright (E2E)
npx playwright test path/to/test.spec.ts
npx playwright test --grep "specific test name"
npx playwright test --debug  # Debug mode
```

## Development Workflow

**ALWAYS FOLLOW THIS WORKFLOW**

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

## Architecture Overview

### Request Flow: Evaluation

```
POST /api/evaluate
  → validateCreateEvaluation()
  → insertEvaluation() [status: 'pending']
  → insertResult() for each model [status: 'pending']
  → startEvaluation() (async background execution)
    → EvaluationExecutor.execute()
      → Parallel model execution (30s timeout per model, 5min total)
      → Model client (OpenAIClient/AnthropicClient/GoogleClient)
      → Accuracy scoring (exact match/partial credit/semantic similarity)
      → updateResult() [status: 'completed'/'failed']
  → Client polls GET /api/evaluation-status
```

### Request Flow: Judge Training

```
POST /api/personas/[id]/training/upload
  → parseCSV() → insertTrainingPairs()

POST /api/personas/[id]/training/start
  → createTrainingIteration()
  → startTrainingLoop() (async)
    → For each training pair:
      → Task model generates output → training_pair_results
      → Judge model evaluates → judge_decisions
    → Human review via POST .../iterations/[num]/feedback
    → calculateMetrics() → iteration_metrics (F1, precision, recall, Cohen's Kappa)
    → promptEngineer.refinePrompt() → judge_prompt_versions
    → Check convergence (F1 ≥ 0.80) or continue
```

### Core Architectural Patterns

**Separation of Concerns**:

1. **Database Layer** (`src/lib/db/`): Raw SQL, CRUD operations, transactions
2. **Validation Layer** (`src/lib/validation/`): Input validation before DB/API
3. **Business Logic** (`src/lib/evaluation/`, `src/lib/training/`): Orchestration, algorithms
4. **API Layer** (`src/pages/api/`): HTTP handlers, response formatting
5. **UI Layer** (`src/components/`, `src/pages/`): Presentation

**Multi-Provider Architecture**:

- `ClientFactory` creates provider-specific clients via adapter pattern
- Unified `ModelClient` interface: `evaluate()`, `testConnection()`
- Configuration: provider + model_name + encrypted API key

**Async Execution**:

- Evaluations run in background; API returns evaluation_id immediately
- Client polls for status/results
- Training loops use state machine with pause/resume via checkpoints

**Database Transactions**:

- Use `withTransaction()` wrapper from `persona-db.ts` for multi-step operations
- Foreign key constraints enabled with CASCADE/RESTRICT
- WAL mode for concurrent read/write

## Key File Locations

### Core Business Logic

- `src/lib/evaluation/evaluator.ts` - Evaluation orchestration, concurrency, timeouts
- `src/lib/evaluation/accuracy.ts` - Rubric scoring (exact match, partial credit, semantic)
- `src/lib/evaluation/metrics.ts` - F1, precision, recall, Cohen's Kappa calculation
- `src/lib/training/prompt-engineer.ts` - LLM-based prompt refinement
- `src/lib/training/judge-runner.ts` - Judge evaluation execution
- `src/lib/utils/api-clients.ts` - Provider abstraction (OpenAI, Anthropic, Google)

### Database

- `db/schema.sql` - 13 tables (models, evaluations, personas, training)
- `src/lib/db/db.ts` - Core database access layer
- `src/lib/db/persona-db.ts` - Judge persona operations with transactions

### Validation

- `src/lib/validation/validators.ts` - Manual runtime validators
- `src/lib/validation/persona-validator.ts` - Persona-specific validation

### API Routes

- `src/pages/api/evaluate.ts` - Create evaluation
- `src/pages/api/personas/` - Persona CRUD
- `src/pages/api/personas/[id]/training/` - Training operations
- `src/pages/api/personas/[id]/iterations/[num]/` - Iteration feedback/metrics

### Types

- `src/lib/utils/types.ts` - Core domain types (Evaluation, Result, ModelConfiguration)
- `src/types/training.ts` - Judge training types (Persona, TrainingIteration)

## Critical Development Patterns

### Path Aliases (Vite/Astro)

```typescript
import { evaluateInstruction } from '@lib/evaluation/evaluator';
import { Button } from '@components/ui/Button.astro';
import { database } from '@db/init';
```

### API Error Handling

```typescript
import { createErrorResponse, badRequest } from '@lib/api/api-error-handler';

export async function POST({ request }) {
  const validation = validateInput(data);
  if (!validation.valid) {
    return badRequest(validation.error.message);
  }

  try {
    // ... operation
  } catch (error) {
    return createErrorResponse(error);
  }
}
```

### Database Transactions

```typescript
import { withTransaction } from '@lib/db/persona-db';

const result = withTransaction(db, () => {
  db.prepare('INSERT ...').run();
  db.prepare('UPDATE ...').run();
  return computedValue;
});
```

### API Key Encryption

```typescript
import { encryptApiKey, decryptApiKey } from '@lib/utils/encryption';

// Before DB insert
const encrypted = encryptApiKey(plainKey);

// On retrieval
const plain = decryptApiKey(model.api_key_encrypted);
```

### Evaluation Status Polling Pattern

```typescript
// Server: Return evaluation_id immediately
return new Response(JSON.stringify({ evaluation_id }), { status: 201 });

// Client: Poll for completion
const pollStatus = async () => {
  const res = await fetch(`/api/evaluation-status?id=${evaluationId}`);
  const data = await res.json();
  if (data.status === 'completed' || data.status === 'failed') {
    // Handle completion
  } else {
    setTimeout(pollStatus, 1000);
  }
};
```

## Testing Requirements

### Coverage Targets

- **Critical paths** (validators, accuracy, evaluator, metrics): **>80% coverage**
- Current coverage: validators 84.29%, accuracy 92.85%, evaluator 93.05%

### Test Structure

- **Unit tests** (`tests/unit/`): Pure logic, metrics calculation, encryption
- **Integration tests** (`tests/integration/`): Database operations, API handlers
- **E2E tests** (`tests/e2e/`): Full user workflows with Playwright

### E2E Database Isolation

```bash
# E2E tests use separate DB via EVAL_DB_PATH environment variable
# Database: db/evaluation.e2e-test.db
# Clean before test runs: npm run test:e2e:clean
```

### Test-First Development

Per project constitution: **Tests are written first for all critical paths**. When adding features:

1. Write test cases first
2. Implement functionality
3. Verify coverage meets targets

## Environment Configuration

### Required Environment Variables

```bash
# .env (copy from .env.example)
ENCRYPTION_KEY=<32-byte-hex>  # Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Optional
LOG_LEVEL=info|debug|warn|error
DEBUG=false  # Log model responses to console
MOCK_JUDGE_MODE=true  # Use mock data for training (dev only)
EVAL_DB_PATH=./db/evaluation.db  # Override database path
```

### Mock Judge Mode

When `MOCK_JUDGE_MODE=true`, training loop uses mock responses instead of real LLM calls to reduce token costs during development.

## Code Style & Quality

### Style Rules

- **Formatter**: Prettier (double quotes, semicolons, 2-space indent, 100 char line width)
- **Linter**: ESLint 9 flat config with TypeScript, Astro, JSDoc plugins
- **TypeScript**: Strict mode (`strictNullChecks`, `noImplicitAny`, `noImplicitReturns`)
- **Styling**: Tailwind CSS v4 utility classes (prefer utilities over custom CSS)
- **JSDoc**: Required for public functions/methods/classes

### Pre-Commit Checklist

**MANDATORY before every commit**:

```bash
npm run typecheck    # Must pass
npm run lint         # Must pass
npm run format       # Auto-format code
```

## Database Schema Notes

### Key Tables

- **ModelConfiguration**: AI provider configs with encrypted API keys
- **Evaluation**: Evaluation sessions with status tracking
- **Result**: Model outputs with metrics (accuracy, latency, tokens)
- **personas**: Judge configurations (task/judge/engineer models)
- **training_pairs**: Input/output pairs for training
- **training_iterations**: Iteration cycles (generation → judgment → metrics)
- **judge_decisions**: Judge model assessments
- **human_reviews**: Human reviewer feedback (mandatory early iterations)
- **iteration_metrics**: F1, precision, recall, Cohen's Kappa, confusion matrix
- **judge_prompt_versions**: Judge prompt version history

### Important Constraints

- Foreign keys with CASCADE/RESTRICT for referential integrity
- Unique constraints on (persona_id, version_number) for prompts
- Indexes on status, created_at, persona_id, f1_score for query performance

## Common Pitfalls

1. **Database initialization**: Always run `npm run db:init` after cloning or schema changes
2. **Encryption key**: Must be 32-byte hex. Generate with provided command in `.env.example`
3. **E2E test isolation**: Use `npm run test:e2e:clean` to avoid stale test data
4. **API key storage**: NEVER commit unencrypted API keys. Use `encryptApiKey()` before DB insert
5. **Async evaluation**: Don't wait for evaluation results in POST handler; return evaluation_id immediately
6. **Transaction safety**: Use `withTransaction()` for multi-step DB operations
7. **Path aliases**: Use `@lib`, `@components`, etc. Don't use relative imports for cross-directory references
8. **Tailwind v4 syntax**: Use modern Tailwind v4 features (e.g., `@theme` directive) not v3 patterns

### Session Completion (CRITICAL)

Work is NOT complete until pushed to remote:

```bash
git pull --rebase
bd sync
git push
git status  # Must show "up to date with origin"
```

## API Contract

Full REST API specification in `openapi.yml`. Key endpoints:

- **Evaluations**: `/api/evaluate`, `/api/evaluation-status`, `/api/results`
- **Models**: `/api/models` (CRUD, test connection)
- **Personas**: `/api/personas` (CRUD, reset)
- **Training**: `/api/personas/[id]/training/*` (upload, start, pause, resume, status)
- **Iterations**: `/api/personas/[id]/iterations/[num]/*` (feedback, metrics, refine)
- **Prompts**: `/api/prompts/*` (versions, optimize)
- **Templates**: `/api/templates` (CRUD, run, import/export)
