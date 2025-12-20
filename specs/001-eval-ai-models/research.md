# Research Findings: AI Model Evaluation Framework

**Phase**: 0 (Research & Clarification)
**Date**: 2025-12-20
**Status**: Complete - All unknowns resolved

## Astro 5 + TypeScript Pattern Research

### Decision: Astro 5 SSR with Node.js Adapter + TypeScript

**Rationale:**
- Already integrated in project (package.json: `astro ^5.16.6`)
- Supports server-side rendering for dynamic API-driven pages
- Strong TypeScript support with Astro components
- Performance: Static generation for UI templates, SSR for dynamic content
- Tailwind CSS 4 integration already in place

**Alternatives Considered:**
- Next.js: More opinionated, overkill for single-file database model
- SvelteKit: Would require migration, Astro already established
- Astro 4: Missing improvements in SSR and type safety in Astro 5

**Evidence from Codebase**: Pages (index.astro, templates.astro, history.astro) are already Astro components with TypeScript. API routes use Astro's `APIRoute` type for consistent endpoint implementation.

---

## Database & Persistence Pattern Research

### Decision: better-sqlite3 with Functional Query API (No ORM)

**Rationale:**
- Already integrated (package.json: `better-sqlite3 ^11.0.0`)
- Single-file SQLite database matches MVP requirement: "simple database"
- Prepared statements with parameters prevent SQL injection
- Type safety via manual TypeScript interfaces (no ORM overhead)
- Performance: Synchronous access adequate for single-user/small-team deployment
- Encryption of sensitive data (API keys) at database layer

**Alternatives Considered:**
- Prisma ORM: Adds complexity, generates migration files, slower cold starts
- TypeORM: Similar complexity to Prisma, fewer benefits for SQLite
- Raw SQL without better-sqlite3: Poor DX, no prepared statement safety
- PostgreSQL: Overscoped for MVP, requires external service

**Evidence from Codebase**: Database functions in `src/lib/db.ts` follow functional pattern with `insert*`, `get*`, `update*`, `delete*` functions. Queries use parameterized statements. API keys encrypted with AES-256-GCM.

---

## API Design Pattern Research

### Decision: REST API with Astro APIRoute Pattern

**Rationale:**
- Astro's native `APIRoute` type provides type-safe endpoint definitions
- RESTful conventions align with CRUD operations on evaluations, models, templates
- JSON responses with consistent error format: `{ error, message, field?, details? }`
- Status codes follow HTTP standards (201 created, 400 validation, 404 not found, 409 conflict, 500 error)
- Composable route handlers match Astro's file-based routing

**Alternatives Considered:**
- GraphQL: Adds complexity for single-page form-based application
- tRPC: Tight coupling with client, less suitable for form submissions
- gRPC: Not suitable for web application

**Evidence from Codebase**:
- Routes defined in `src/pages/api/` using Astro's file-based routing
- All routes use `APIRoute` type
- POST `/api/evaluate` submits evaluation, GET `/api/evaluation-status` polls results
- POST `/api/templates` saves templates, GET `/api/results` retrieves results
- Consistent error format across all endpoints

---

## Error Handling & Validation Strategy

### Decision: Layered Validation (Input → Business Logic → Constraints)

**Rationale:**
- Input validation: Separate `src/lib/validators.ts` for schema validation (required fields, type checking, provider validation)
- Business logic validation: Check entity existence before operations (model exists, evaluation exists)
- Constraint validation: Enforce business rules (cannot delete model with active evaluations, cannot update inactive model)
- Consistent error codes for client-side handling: `INVALID_INPUT`, `MODEL_NOT_FOUND`, `CANNOT_DELETE`, etc.

**Evidence from Codebase**:
```typescript
// Input validation returns early
const validation = validateCreateModel(body);
if (!validation.valid) return new Response(JSON.stringify(validation.error), { status: 400 });

// Business logic validation
const model = getModelById(id);
if (!model) return new Response(...{ error: 'MODEL_NOT_FOUND' }, { status: 404 });

// Constraint validation
if (usageCount > 0) return new Response(...{ error: 'CANNOT_DELETE' }, { status: 409 });
```

---

## Type System & API Contracts

### Decision: TypeScript Interfaces + Manual Validation (No Schema Library)

**Rationale:**
- All entities have defined interfaces: `ModelConfiguration`, `Evaluation`, `Result`, `EvaluationTemplate`
- API request/response types defined: `CreateEvaluationRequest`, `EvaluationStatusResponse`, etc.
- Provider union type: `type Provider = 'openai' | 'anthropic' | 'google'`
- Status enums prevent invalid state: `EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed'`
- Manual validation functions ensure runtime type safety

**Alternatives Considered:**
- Zod/Joi: Would add bundle size, TypeScript alone sufficient for MVP
- JSON Schema: External format, harder to maintain alongside TypeScript

**Evidence from Codebase**: Comprehensive `src/lib/types.ts` with 15+ interfaces covering all domain entities and API contracts.

---

## Authentication & API Key Management

### Decision: Encrypted Environment Variable Storage (No Token Service)

**Rationale:**
- Users provide API keys through form input in UI
- Keys immediately encrypted with AES-256-GCM before database storage
- Encrypted keys stored in SQLite, never exposed via API responses
- Environment variable (ENCRYPTION_KEY) manages encryption key rotation
- Suitable for single-user/small-team deployment (no multi-tenant auth needed)

**Alternatives Considered:**
- OAuth for each provider: Users already have API keys, unnecessary complexity
- Shared token service: Out of scope for MVP local deployment
- Plain text storage: Security vulnerability

**Evidence from Codebase**: Database functions encrypt API keys on insert, decrypt on retrieval. API responses never include keys.

---

## Performance Optimization Targets

### Decision: Async/Await with Timeout Guards + Connection Pooling

**Rationale Per Constraints**:
- **30s per-model timeout** (spec clarification): Each model query wrapped in Promise.race with timeout
- **5-min total evaluation timeout** (spec clarification): Overall evaluation wrapped in second timeout
- **±5% time accuracy** (SC-002): Wall-clock time measured with `performance.now()` or `Date.now()` for database timestamps
- **Responsive UI** (SC-005): Evaluation happens in background, UI polls status, user can cancel

**Evidence from Codebase**: `src/lib/evaluator.ts` implements:
```typescript
const MODEL_TIMEOUT_MS = 30000;  // Per-model timeout
const EVALUATION_TIMEOUT_MS = 300000;  // Total evaluation timeout

const modelResponse = await Promise.race([
  client.evaluate(instruction),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Model timeout')), MODEL_TIMEOUT_MS)
  )
]);
```

---

## Testing Strategy

### Decision: Vitest (Unit/Integration) + Playwright (E2E)

**Rationale:**
- **Vitest**: Fast unit testing for validators, accuracy scoring, database functions
- **Playwright**: Full workflow testing (submit evaluation, poll status, view results)
- Coverage target: >80% critical paths per Constitution Principle II
- Test patterns align with existing `tests/` directory structure

**Alternatives Considered:**
- Jest: Vitest is faster, better Astro integration
- Cypress: Playwright has better headless performance
- No E2E: Would miss user workflow issues (status polling, results display)

**Evidence from Codebase**: `vitest.config.ts` and `tests/` directory exist with placeholder structure.

---

## Research Resolutions

| Unknown | Resolution | Evidence |
|---------|-----------|----------|
| Astro version compatibility | Astro 5.16.6 already in use | package.json confirms 5.x |
| Database choice | better-sqlite3 + functional query pattern | db/ directory + src/lib/db.ts |
| API style | REST with APIRoute type | src/pages/api/ route definitions |
| Type safety approach | TypeScript interfaces + manual validation | src/lib/types.ts + validators.ts |
| Error handling | Layered validation with consistent error codes | API route implementations |
| Authentication | Encrypted key storage in SQLite | Database functions handle encryption |
| Performance targets | 30s per-model timeout + 5-min total timeout | evaluator.ts implementation |
| Testing framework | Vitest + Playwright | vitest.config.ts + tests/ structure |

---

**Conclusion**: All technical unknowns are resolved. Codebase follows established patterns for API design, database access, type safety, and error handling. Phase 1 can proceed with data-model and contracts design.
