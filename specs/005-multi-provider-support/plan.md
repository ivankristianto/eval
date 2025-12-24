# Implementation Plan: Multi-Provider AI Model Support

**Branch**: `005-multi-provider-support` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-multi-provider-support/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Expand the AI model evaluation framework to support five additional providers beyond the current three (OpenAI, Anthropic, Google AI). Add support for Google Vertex AI (OAuth), Open Router (unified API), and local deployments via LM Studio and Ollama. Implement provider-level configuration architecture with encrypted credential storage, multiple authentication strategies, and resilient failure handling that continues evaluation when individual providers fail.

## Technical Context

**Language/Version**: TypeScript 5.6+ on Node.js 22.0+
**Primary Dependencies**: Astro 5.x (SSR), better-sqlite3, OpenAI SDK, Anthropic SDK, Google Generative AI SDK, @google-cloud/vertexai, google-auth-library, Node.js crypto (built-in, AES-256-GCM)
**Storage**: SQLite via better-sqlite3 (existing schema requires migration)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Node.js server (Astro SSR with Node adapter)
**Project Type**: Web application (SSR with API endpoints)
**Performance Goals**: Provider credential validation <5s (FR-004), Provider configuration <3min (SC-002), Support 10 concurrent provider configs (SC-010)
**Constraints**: Backward compatibility with existing 3 providers required (FR-007), No external network calls for local providers (SC-007), Database encryption at rest with application-managed keys (clarified)
**Scale/Scope**: 8 total providers (3 existing + 5 new), Provider-level config with one-to-many model relationships, Multiple auth methods (API key, OAuth, none)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality Standards

- ✅ **Single Responsibility**: Provider abstraction layer will separate concerns (authentication, API communication, response mapping)
- ✅ **Documentation**: Database schema migration, new provider integration patterns will be documented
- ✅ **Naming**: Provider types (Vertex AI, Open Router, LM Studio, Ollama) are explicit and domain-aligned
- ✅ **Technical Debt Tracking**: Schema migration complexity flagged for careful review

**Status**: PASS

### II. Testing Discipline (NON-NEGOTIABLE)

- ✅ **Test-First**: Contract tests for each provider client must be written before implementation
- ✅ **Integration Tests**: Provider configuration flows, OAuth flows, credential encryption/decryption
- ✅ **Critical Path Coverage**: Target >80% for new provider abstraction layer (src/lib/api-clients.ts modifications)
- ✅ **Executable Documentation**: Tests document expected behavior for each authentication method

**Status**: PASS - Test specifications will be created in Phase 1

### III. User Experience Consistency

- ✅ **Standardized Patterns**: All providers use same configuration UI patterns (validated in FR-014)
- ✅ **Error Messages**: Actionable error messages required (SC-009: 95% actionable)
- ✅ **User Workflows**: Each user story includes independent test scenarios
- ✅ **Visual Consistency**: Provider management UI follows existing Astro/Tailwind/DaisyUI patterns

**Status**: PASS

### IV. Performance & Scalability

- ✅ **Explicit Targets**: Validation <5s (SC-004), Configuration <3min (SC-002), 10 concurrent configs (SC-010)
- ✅ **Documentation**: Performance constraints documented in Technical Context
- ✅ **Hot Path Optimization**: Evaluation loop must handle provider failures efficiently (continue with remaining providers)
- ✅ **Resource Usage**: Database encryption overhead acceptable for SQLite workload scale

**Status**: PASS

**Overall Gate Status**: ✅ PASS - No constitution violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── api-clients.ts           # Provider abstraction layer (MODIFIED)
│   ├── providers/                # New provider clients (NEW)
│   │   ├── base.ts              # Base provider interface
│   │   ├── vertex-ai.ts         # Google Vertex AI client
│   │   ├── open-router.ts       # Open Router client
│   │   ├── lm-studio.ts         # LM Studio client
│   │   └── ollama.ts            # Ollama client
│   ├── auth/                     # Authentication utilities (NEW)
│   │   ├── encryption.ts        # Credential encryption/decryption
│   │   └── oauth.ts             # OAuth flow handlers
│   ├── db.ts                     # Database layer (MODIFIED for new schema)
│   ├── evaluator.ts              # Evaluation orchestration (MODIFIED)
│   └── types.ts                  # Type definitions (MODIFIED)
├── pages/
│   ├── api/
│   │   └── providers/           # Provider management endpoints (NEW)
│   │       ├── index.ts         # List/create providers
│   │       ├── [id].ts          # Get/update/delete provider
│   │       └── test.ts          # Test provider connectivity
│   └── providers/               # Provider management UI (NEW)
│       ├── index.astro          # Provider list page
│       └── [id].astro           # Provider config page
└── components/
    └── providers/               # Provider UI components (NEW)
        ├── ProviderForm.tsx     # Provider configuration form
        └── ProviderList.tsx     # Provider list with status

db/
└── schema.sql                   # Database schema (MODIFIED - migration needed)

tests/
├── unit/
│   ├── providers/               # Provider client tests (NEW)
│   │   ├── vertex-ai.test.ts
│   │   ├── open-router.test.ts
│   │   ├── lm-studio.test.ts
│   │   └── ollama.test.ts
│   └── auth/                    # Auth utility tests (NEW)
│       ├── encryption.test.ts
│       └── oauth.test.ts
├── integration/
│   └── providers/               # Provider integration tests (NEW)
│       └── provider-config.test.ts
└── e2e/
    └── provider-management.spec.ts  # E2E provider workflow tests (NEW)
```

**Structure Decision**: Web application structure. Existing Astro SSR application with API routes and pages. Provider abstraction follows existing pattern in `src/lib/api-clients.ts`. New `providers/` subdirectory for client implementations. Database migration required for schema changes. UI components follow existing React/Astro component patterns with Tailwind CSS and DaisyUI.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations. All complexity justified by feature requirements.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion*

### I. Code Quality Standards
- ✅ **Single Responsibility**: Provider factory pattern maintains clean separation
- ✅ **Documentation**: All design artifacts complete (research.md, data-model.md, contracts, quickstart.md)
- ✅ **Naming**: Type definitions clear and domain-aligned
- ✅ **Technical Debt**: Database migration complexity documented with rollback plan

**Status**: PASS

### II. Testing Discipline (NON-NEGOTIABLE)
- ✅ **Test-First**: Quickstart.md includes test patterns for each component
- ✅ **Contract Tests**: Provider clients will have contract tests per quickstart.md
- ✅ **Integration Tests**: Provider API and OAuth flow tests specified
- ✅ **Critical Path Coverage**: Testing strategy targets >80% for provider abstraction layer

**Status**: PASS

### III. User Experience Consistency
- ✅ **Standardized Patterns**: API contracts follow RESTful conventions
- ✅ **Error Messages**: API responses include detailed error information (see contracts/providers-api.yaml)
- ✅ **User Workflows**: 5 prioritized user stories with acceptance scenarios
- ✅ **Visual Consistency**: UI components use existing Tailwind CSS + DaisyUI patterns

**Status**: PASS

### IV. Performance & Scalability
- ✅ **Explicit Targets**: SC-004 (<5s validation), SC-002 (<3min config), SC-010 (10 concurrent)
- ✅ **Documentation**: Performance validation steps in quickstart.md
- ✅ **Hot Path Optimization**: Provider failure handling ensures evaluation continues (FR-012)
- ✅ **Resource Usage**: Encryption overhead measured and acceptable

**Status**: PASS

**Final Constitution Status**: ✅ PASS - Design adheres to all constitution principles. Ready for implementation.
