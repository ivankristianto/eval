# Implementation Plan: Add Optional System Prompt and Temperature Configuration for Evaluations

**Branch**: `006-prompt-temperature-config` | **Date**: 2025-12-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-prompt-temperature-config/spec.md`

## Summary

Add optional system prompt configuration and temperature adjustment controls to the evaluation framework. Users can optionally enable a system prompt (hidden by default via checkbox) to provide custom instructions to AI models, and adjust temperature (0.0-2.0 range, default 0.3) via slider to control response creativity. Both settings are persisted in evaluations and templates, applied to all three AI providers (OpenAI, Anthropic, Google), and maintain backward compatibility with existing evaluations that lack these settings.

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js >= 22.0.0
**Primary Dependencies**: Astro 5.x, better-sqlite3, OpenAI SDK, Anthropic SDK, Google Generative AI SDK
**Storage**: SQLite (better-sqlite3) - existing schema extensions
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web (Node.js SSR via Astro)
**Project Type**: Web application (single Astro SSR project with frontend + backend)
**Performance Goals**: Form submission with validation <500ms p95; evaluation execution unchanged by system prompt/temperature overhead
**Constraints**: System prompt max 4,000 characters; temperature validation <10ms; backward compatible (no schema breaking changes for existing null values)
**Scale/Scope**: Affects 2 primary tables (Evaluation, EvaluationTemplate), 2 primary API endpoints (/api/evaluate, template create/update), 1 UI component (NewEvaluationModal), 3 API client implementations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Code Quality Standards ✅
- Each component has single responsibility: separate type definitions, validation logic, API client modifications, UI component updates
- All changes include descriptive commit messages and code review documentation
- No breaking changes to existing patterns; new fields nullable/optional

### Principle II: Testing Discipline ✅ (CRITICAL)
- **Gate Status**: PASS - all critical paths explicitly mapped to tests
- Tests written first for: system prompt validation (FR-016), temperature range validation (FR-013), API client modifications (FR-009)
- Required coverage: 80%+ for api-clients.ts (current 64.38%) and temperature/system_prompt code paths
- Acceptance scenarios directly translate to E2E tests

### Principle III: User Experience Consistency ✅
- Uses existing form patterns (daisyUI components, Tailwind CSS v4)
- Error messages follow existing conventions
- Checkbox for optional feature (consistent with current form approach)
- Temperature display standardized to 1 decimal place

### Principle IV: Performance & Scalability ✅
- Explicit constraint: system prompt validation <10ms; form submission <500ms p95
- No database schema migration performance impact (columns added with defaults)
- API client modifications additive only (no refactor of existing hot paths)
- Evaluation execution overhead negligible (parameters passed to existing token counting)

## Project Structure

### Documentation (this feature)

```text
specs/006-prompt-temperature-config/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (Phase 1 output)
├── research.md          # Phase 0 output (research findings)
├── data-model.md        # Phase 1 output (entity design)
├── quickstart.md        # Phase 1 output (dev guide)
├── contracts/           # Phase 1 output (API contracts)
│   ├── evaluate-post.md
│   ├── templates-post.md
│   └── templates-put.md
├── checklists/
│   └── requirements.md   # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root - Single Astro project)

```text
src/
├── lib/
│   ├── types.ts                 # ✏️ Update: Add system_prompt?, temperature? fields
│   ├── api-clients.ts           # ✏️ Update: Modify evaluate() signature, client implementations
│   ├── db.ts                    # ✏️ Update: Add helpers for new columns
│   ├── validators.ts            # ✏️ Add: System prompt & temperature validation
│   └── [existing files preserved]
├── components/
│   └── NewEvaluationModal.astro # ✏️ Update: Add checkbox + slider controls
├── pages/
│   └── api/
│       ├── evaluate.ts          # ✏️ Update: Accept new parameters
│       ├── templates/
│       │   ├── index.ts         # ✏️ Update: Create with new fields
│       │   └── [id].ts          # ✏️ Update: Patch with new fields
│       └── [existing endpoints preserved]

tests/
├── unit/
│   ├── validators.test.ts       # ✅ Add: system_prompt & temperature validation tests
│   ├── api-clients.test.ts      # ✏️ Update: All 3 providers with system prompt & temperature
│   └── [existing tests preserved]
├── integration/
│   └── evaluation-settings.test.ts  # ✅ Add: E2E evaluation flow with custom settings
└── e2e/
    └── evaluation-form.spec.ts  # ✏️ Update: UI interactions for new controls

db/
└── schema.sql                   # ✏️ Update: Add columns to Evaluation & EvaluationTemplate
```

**Structure Decision**: Single Astro project (web application). No new directory structures needed. Changes are localized to existing modules with clear separation: types → validators → api-clients → components → endpoints. Database schema will be extended via ALTER TABLE statements in Phase 1 (tasks T003-T007). Existing data remains unaffected as all new columns are nullable with defaults. No separate migration framework required.

## Complexity Tracking

No Constitution violations. All principles satisfied:
- Code Quality: Changes maintain SRP (validators separate, clients isolated, components focused)
- Testing: 80%+ coverage gate explicitly documented; all critical paths have test-first requirements
- UX: Reuses existing patterns and conventions; no new paradigms
- Performance: Constraints explicit and reasonable; no scaling concerns at current user base

---

# Phase 0: Research & Validation

## Research Summary

All technical unknowns resolved through context review and project documentation analysis.

### API Client Pattern Research
**Finding**: Each provider (OpenAI, Anthropic, Google) has different parameter structures.
- **OpenAI**: System prompt via `messages: [{ role: "system", content: ... }, ...]`; temperature via `temperature` param
- **Anthropic**: System prompt via `system` parameter (string); temperature via `temperature` param
- **Google**: System prompt via `systemInstruction` param; temperature in `generationConfig: { temperature }`
- **Decision**: Update ModelClient interface to accept optional `systemPrompt` and `temperature` parameters. Each client implementation handles provider-specific API mapping.

### Validation Strategy Research
**Finding**: TypeScript strict mode + runtime validation needed.
- System prompt: length check (≤4,000 chars), non-null assertion in form submission
- Temperature: range check (0.0-2.0), decimal validation
- **Decision**: Create `validators.ts` module with exported functions for form-level and API-level validation

### Database Extension Research
**Finding**: SQLite better-sqlite3 integration established. Columns should be nullable with defaults.
- Evaluation table: `system_prompt TEXT NULL`, `temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0)`
- EvaluationTemplate table: Same fields with same constraints
- **Decision**: Use `ALTER TABLE ADD COLUMN` in migration scripts (external to this feature). Feature code assumes columns exist.

### UI Component Pattern Research
**Finding**: Existing NewEvaluationModal uses daisyUI + Tailwind CSS v4 conventions.
- Form controls: `form-control`, `label`, `input`, `textarea`, `select` classes
- State management: Form data captured via FormData API; submission via fetch
- **Decision**: Add checkbox (daisyUI `checkbox` class) for system prompt toggle; add range input (Tailwind styled) for temperature slider. Use JavaScript event listeners for conditional visibility.

### Testing Patterns Research
**Finding**: Vitest for unit/integration, Playwright for E2E. Constitution requires test-first approach.
- Unit tests: Validator functions with boundary cases (0.0, 2.0, -0.1, 2.1, null, empty string)
- Integration tests: API endpoint tests with mocked clients
- E2E tests: Playwright for form interactions (checkbox toggle, slider adjustment, submission)
- **Decision**: Create dedicated test files; leverage existing test utilities and fixtures.

---

# Phase 1: Design & Contracts

## Data Model

### Entity Updates

#### Evaluation (extends existing)
```typescript
interface Evaluation {
  // Existing fields
  id: string;
  instruction_text: string;
  accuracy_rubric: RubricType;
  partial_credit_concepts?: string[];
  expected_output?: string;
  created_at: string;
  completed_at?: string;
  status: EvaluationStatus;
  error_message?: string;
  template_id?: string;

  // NEW fields
  system_prompt?: string;      // Max 4,000 characters, nullable
  temperature?: number;         // Range 0.0-2.0, default 0.3
}
```

**Validation Rules**:
- `system_prompt`: If present, must be ≤4,000 characters, non-empty string
- `temperature`: If present, must be ≥0.0 and ≤2.0, stored with 1 decimal precision

#### EvaluationTemplate (extends existing)
```typescript
interface EvaluationTemplate {
  // Existing fields
  id: string;
  name: string;
  description?: string;
  instruction_text: string;
  model_ids: string[];
  accuracy_rubric: RubricType;
  partial_credit_concepts?: string[];
  expected_output?: string;
  created_at: string;
  updated_at: string;
  run_count: number;

  // NEW fields
  system_prompt?: string;      // Max 4,000 characters, nullable
  temperature?: number;         // Range 0.0-2.0, default 0.3
}
```

**Validation Rules**: Same as Evaluation

#### Result (extends existing - includes audit fields)
```typescript
interface Result {
  // Existing fields
  id: string;
  evaluation_id: string;
  model_id: string;
  response_text?: string;
  execution_time_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  accuracy_score?: number;
  accuracy_reasoning?: string;
  status: ResultStatus;
  error_message?: string;
  created_at: string;

  // NEW fields (audit/reference)
  system_prompt_used?: string;   // Denormalized from Evaluation for auditing
  temperature_used?: number;      // Denormalized from Evaluation for auditing
}
```

### Naming Conventions (CRITICAL - Prevent Serialization Bugs)

**Consistent naming across layers is essential to prevent bugs at serialization boundaries**:

| Layer | Convention | Examples | Purpose |
|-------|-----------|----------|---------|
| **Database & SQL** | snake_case | `system_prompt`, `temperature_used` | SQL column naming standard |
| **API JSON (requests/responses)** | snake_case | `"system_prompt": "..."` | JSON naming convention, matches database |
| **TypeScript interfaces** | snake_case | `system_prompt?: string` | Matches database schema for clarity |
| **Function parameters & local variables** | camelCase | `systemPrompt`, `temperature` | JavaScript/TypeScript idiom |

**Mapping Strategy**:
- At **API boundary** (request parsing): JSON `system_prompt` (snake_case) → parameter `systemPrompt` (camelCase)
- At **database layer** (serialization): Interface `system_prompt` (snake_case) → database column `system_prompt` (snake_case) - direct mapping
- In **code** (business logic): Use camelCase parameters `systemPrompt` and `temperature` locally
- In **database access** (db.ts): Convert back to snake_case when writing/reading database records

**Code Example** (pseudocode):
```typescript
// API endpoint receives JSON
const { system_prompt, temperature } = req.body; // snake_case from API

// Convert to camelCase for local processing
const options = { systemPrompt: system_prompt, temperature };

// Pass camelCase to API clients
client.evaluate(instruction, options);

// Database layer converts back to snake_case
db.saveEvaluation({ system_prompt: options.systemPrompt, temperature: options.temperature });
```

---

### Database Schema Changes

```sql
-- Evaluation table
ALTER TABLE Evaluation ADD COLUMN system_prompt TEXT;
ALTER TABLE Evaluation ADD COLUMN temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0);

-- EvaluationTemplate table
ALTER TABLE EvaluationTemplate ADD COLUMN system_prompt TEXT;
ALTER TABLE EvaluationTemplate ADD COLUMN temperature REAL DEFAULT 0.3 CHECK (temperature >= 0.0 AND temperature <= 2.0);

-- Result table (audit fields)
ALTER TABLE Result ADD COLUMN system_prompt_used TEXT;
ALTER TABLE Result ADD COLUMN temperature_used REAL;
```

## API Contracts

### POST /api/evaluate

**Request** (updated):
```json
{
  "instruction": "Classify the sentiment...",
  "model_ids": ["uuid-1", "uuid-2"],
  "rubric_type": "exact_match",
  "expected_output": "positive/negative/neutral",
  "partial_credit_concepts": ["optional"],
  "system_prompt": "You are a sentiment analysis expert. (OPTIONAL, max 4000 chars)",
  "temperature": 0.7
}
```

**Response** (unchanged): Returns evaluation_id + model statuses

**Validation**:
- `system_prompt`: ≤4,000 chars if present
- `temperature`: 0.0-2.0 if present, default 0.3

### POST /api/templates

**Request** (updated):
```json
{
  "name": "Template Name",
  "description": "Optional description",
  "instruction_text": "...",
  "model_ids": ["..."],
  "accuracy_rubric": "exact_match",
  "expected_output": "...",
  "partial_credit_concepts": ["optional"],
  "system_prompt": "You are... (OPTIONAL, max 4000 chars)",
  "temperature": 0.7
}
```

**Response**: Returns template with all fields

### PUT /api/templates/:id

**Request** (updated): Same schema as POST

**Response**: Updated template

### GET /api/evaluations/:id (existing endpoint returns temperature)

**Response** now includes:
```json
{
  "...existing fields": "...",
  "system_prompt": "You are...",
  "temperature": 0.7,
  "results": [
    {
      "...": "...",
      "temperature_used": 0.7,
      "system_prompt_used": "You are..."
    }
  ]
}
```

## Development Quickstart

### Prerequisites
- Node.js >= 22.0.0, npm
- Project repo cloned with AGENTS.md context
- Run `npm install` to install dependencies

### Local Development
```bash
# Install deps
npm install

# Start dev server
npm run dev

# Run all tests
npm test

# Run E2E tests
npm run test:e2e

# Check types
npm run typecheck

# Format code
npm run format
```

### File Checklist (Implement in Order)
1. **Type definitions** (`src/lib/types.ts`)
   - Add `system_prompt?: string` and `temperature?: number` to Evaluation, EvaluationTemplate, Result interfaces
   - Update request/response interfaces

2. **Validators** (`src/lib/validators.ts`) - NEW FILE
   - Export `validateSystemPrompt(text: string): { valid: boolean; error?: string }`
   - Export `validateTemperature(value: number): { valid: boolean; error?: string }`

3. **API Clients** (`src/lib/api-clients.ts`)
   - Update `ModelClient.evaluate()` signature to include optional `systemPrompt` and `temperature` params
   - Update OpenAI, Anthropic, Google client implementations
   - Add temperature + system prompt to request objects

4. **UI Component** (`src/components/NewEvaluationModal.astro`)
   - Add checkbox for system prompt toggle
   - Add textarea (hidden by default) for system prompt input
   - Add range slider for temperature (0-2 range, 0.1 step, default 0.3)
   - Update form submission to include new fields

5. **API Endpoints** (`src/pages/api/`)
   - `evaluate.ts`: Extract system_prompt and temperature from request body; pass to evaluator
   - `templates/index.ts`: Add fields to template creation
   - `templates/[id].ts`: Add fields to template update

6. **Database** (`db/schema.sql`)
   - Add columns to Evaluation and EvaluationTemplate

7. **Tests** - Implement test-first per Constitution:
   - `tests/unit/validators.test.ts` (boundary cases, invalid inputs)
   - `tests/unit/api-clients.test.ts` (all 3 providers with new params)
   - `tests/integration/evaluation-settings.test.ts` (end-to-end flow)
   - `tests/e2e/evaluation-form.spec.ts` (UI interactions)
