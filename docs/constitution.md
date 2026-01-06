# Development Constitution v2.0.0

## I. Code Quality

Clarity over cleverness.

- **SRP**: One function = one responsibility
- **Naming**: Variables describe their purpose explicitly
- **Commits**: Document _what_ and _why_ in commit messages
- **Tech debt**: Track explicitly in backlog, don't hide it

## II. User-First Development

Build what users see and touch first.

**Implementation Order**:

1. UI with mock data (see it, play with it)
2. Service controller (consumed by API, controller, CLI)
3. API endpoint
4. CLI interface
5. Data seeder

**Why**: Working UI validates assumptions early. Mock data unblocks frontend. Services stay framework-agnostic.

## III. Fences (Quality Gates)

Automated checks run on every change. No exceptions.

| Gate   | Tool                 | Blocking |
| ------ | -------------------- | -------- |
| Types  | `npm run typecheck`  | Yes      |
| Lint   | `npm run lint`       | Yes      |
| Format | `npm run format:fix` | Yes      |
| Test   | `npm run test`       | No\*     |

\*Failed tests → create ticket, fix in separate PR. Don't block current work.

**Baseline 2025**: Use modern stable APIs only.

- ❌ `alert()` → ✅ `<dialog>`
- ❌ Legacy patterns → ✅ Platform features

**Testing Strategy**:

- Unit tests: Write first, fail first
- Integration tests: Required for user-facing features
- Coverage: >80% on critical paths
- E2E tests: Last priority (high cost, low frequency)

## IV. UX Consistency

Users build mental models. Don't break them.

- **Patterns**: Similar actions behave the same way
- **Error messages**: User-friendly, actionable, no jargon
- **Design**: Follow established visual/interactive patterns

## V. Performance

Performance is a feature, not an afterthought.

- **Targets upfront**: Define before implementation (e.g., <200ms p95)
- **Profile hot paths**: Measure, don't guess
- **Justify tradeoffs**: Document if trading perf for convenience

## VI. Continuous Refactoring

Refactor each loop, not at the end.

**Refactor Checklist** (priority order):

1. **Maintainability** - Can another dev understand this?
2. **Security** - Inputs validated? Auth checked?
3. **Performance** - Hot paths profiled?
4. **Consistency** - Follows existing patterns?
5. **Abstraction** - Right level? Not premature?

## VII. Workflow

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
- Reference which principles this PR satisfies
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
