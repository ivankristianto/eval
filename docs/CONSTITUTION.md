# Development Constitution v2.0.0

## I. User-First Development

Build what users see and touch first.

**Implementation Order**:

1. UI with mock data (see it, play with it)
2. Service controller (consumed by API, controller, CLI)
3. API endpoint
4. CLI interface
5. Data seeder

**Why**: Working UI validates assumptions early. Mock data unblocks frontend. Services stay framework-agnostic.

## II. Fences (Quality Gates)

Automated checks run on every change. No exceptions.

| Gate   | Tool                 | Blocking |
| ------ | -------------------- | -------- |
| Types  | `bun run typecheck`  | Yes      |
| Lint   | `bun run lint`       | Yes      |
| Format | `bun run format:fix` | Yes      |

**Baseline 2025**: Use modern stable APIs only.

- ❌ `alert()` → ✅ `<dialog>`
- ❌ Legacy patterns → ✅ Platform features

**Testing Strategy**:

- Unit tests: Write first, fail first
- E2E tests: Last priority (high cost, low frequency)

## III. Continuous Refactoring

Refactor each loop, not at the end.

**Refactor Checklist** (priority order):

1. **Maintainability** - Can another dev understand this?
2. **Security** - Inputs validated? Auth checked?
3. **Performance** - Hot paths profiled?
4. **Consistency** - Follows existing patterns?
5. **Abstraction** - Right level? Not premature?

## IV. Workflow

### Single Task

```
bd ready → branch → implement → gates → commit → PR → review → merge → bd close
```

### Group Tasks

```
bd ready → branch → [implement → gates → commit]× → PR → review → merge → bd close
```

**PR Requirements**:

- Follow PR template
- Run code-review-specialist agent
- Agent comments only (no direct changes)

## Governance

**Amendments**: Propose → Document impact → Version bump → Update templates

**Version Scheme**:

- MAJOR: Breaking changes to principles
- MINOR: New principles/guidance
- PATCH: Clarifications

**Conflicts**: Constitution wins. Justify exceptions in PR.

---

v2.0.0 | Ratified: 2025-01-06
