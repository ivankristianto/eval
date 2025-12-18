<!--
  SYNC IMPACT REPORT (Generated: 2025-12-18)
  ============================================================================
  Version: 1.0.0 (NEW - Initial creation)
  Rationale: Initial constitution creation focused on core engineering disciplines

  Principles Added:
  - I. Code Quality Standards
  - II. Testing Discipline (Non-Negotiable)
  - III. User Experience Consistency
  - IV. Performance & Scalability

  Sections Added:
  - Core Principles (4 principles)
  - Governance

  Templates Updated:
  - ✅ spec-template.md: User story section aligned with UX consistency principle
  - ✅ plan-template.md: Performance goals section aligned with performance principle
  - ✅ tasks-template.md: Test-first pattern aligned with testing discipline

  Deferred Items: None
  ============================================================================
-->

# Evaluation Framework Constitution

## Core Principles

### I. Code Quality Standards

All code must prioritize clarity, maintainability, and adherence to established patterns.

**Non-negotiable Requirements**:
- Every function/method has a single, well-defined responsibility (SRP)
- All code changes include appropriate documentation in commit messages
- Code is reviewed for readability and architectural fit before merge
- Technical debt is explicitly tracked and prioritized in backlog
- Naming is explicit: variable names clearly describe their purpose

**Rationale**: High-quality code reduces bugs, speeds up onboarding, and enables
confident refactoring. Clarity over cleverness prevents maintenance disasters.

### II. Testing Discipline (NON-NEGOTIABLE)

Test-driven development is mandatory for all feature implementation.

**Non-negotiable Requirements**:
- Tests are written FIRST and verified to FAIL before implementation begins
- All user-facing features require contract/integration tests
- Test coverage for critical paths must be >80%
- Tests serve as executable documentation of feature behavior
- Red-Green-Refactor cycle must be strictly followed

**Rationale**: Tests written first establish clear requirements, prevent regressions,
enable confident refactoring, and catch edge cases early. This discipline ensures
code is testable by design.

### III. User Experience Consistency

Every feature must deliver consistent, predictable user experiences.

**Non-negotiable Requirements**:
- All features use standardized patterns for similar actions (e.g., error messages)
- User workflows are tested independently before merging
- Acceptance scenarios in specs describe the complete user journey
- Visual/interactive elements follow established design patterns
- Error messages are user-friendly and actionable

**Rationale**: Users build mental models of how the system works. Consistency
reduces cognitive load, prevents frustration, and builds confidence in the product.

### IV. Performance & Scalability

Performance is a feature, not an afterthought.

**Non-negotiable Requirements**:
- Performance targets are explicitly defined before implementation (e.g., <200ms p95)
- Performance constraints are documented in plan.md Technical Context
- Hot paths are profiled and optimized
- Decisions that trade performance for convenience must be justified
- Memory and CPU usage are reasonable for the target scale

**Rationale**: Users abandon slow systems. Performance constraints prevent bad
decisions early. Explicit targets enable measurement and accountability.

## Governance

### Amendment Procedure

Constitution amendments follow these rules:

1. **Proposal**: Submit amendment with rationale (why change, what improves)
2. **Review**: All changes must be documented in templates that implement the principle
3. **Version Bump**:
   - MAJOR: Remove/redefine principle or change governance rules
   - MINOR: Add new principle or expand guidance (no breaking changes)
   - PATCH: Clarifications, wording refinements, typo fixes
4. **Approval**: Amendments take effect upon version increment and documentation update
5. **Propagation**: All dependent templates (spec-template.md, plan-template.md, tasks-template.md) must be audited and updated

### Compliance & Verification

- All pull requests must reference which principles they satisfy
- Code reviews explicitly verify compliance with applicable principles
- When exceptions are needed, they must be explicitly justified in PR description
- Complexity violations (e.g., bypassing testing discipline) require rationale in plan.md Complexity Tracking section

### Scope of Authority

This constitution supersedes all other development practices. When conflicts arise,
constitution principles take priority. Individual project decisions (e.g., specific
technologies) are made within the constraints established here.

---

**Version**: 1.0.0 | **Ratified**: 2025-12-18 | **Last Amended**: 2025-12-18
