# Requirements Quality Checklist: System Prompt & Temperature Configuration

**Purpose**: Specification quality audit for Tech Lead/QA review
**Focus**: Consistency (cross-story/API alignment) + Validation/Error Handling completeness
**Created**: 2025-12-25
**Feature**: Add Optional System Prompt and Temperature Configuration for Evaluations
**Branch**: `006-prompt-temperature-config`

---

## Category 1: Requirement Consistency (Cross-Story & API Alignment)

### Cross-User Story Consistency

- [ ] CHK001 - Are system prompt requirements consistently defined across US1 (form entry), US3 (template storage), and US4 (backward compatibility)? [Consistency, Spec US1-US4]
- [ ] CHK002 - Are temperature requirements consistently defined across US2 (slider control), US3 (template defaults), and US4 (backward compatibility defaults)? [Consistency, Spec US2-US4]
- [ ] CHK003 - Is the system prompt "optional" nature consistently reflected in all user stories and functional requirements? [Consistency, Spec US1, FR-001-FR-004]
- [ ] CHK004 - Are default temperature values (0.3) consistently specified across US2, US4, FR-008, and database schema? [Consistency, Spec US2, US4, FR-008, Plan §Database Schema]
- [ ] CHK005 - Do acceptance scenarios in US1-US4 align with functional requirements FR-001 to FR-017? [Traceability, Spec US1-US4, FR-001-FR-017]
- [ ] CHK006 - Are template behavior requirements (US3) consistent with evaluation behavior requirements (US1, US2)? [Consistency, Spec US1-US3]
- [ ] CHK007 - Is the "no retroactive changes" requirement (US3 acceptance scenario 3, Edge Cases) consistently enforced across template update specifications? [Consistency, Spec US3, Edge Cases]

### API Contract Consistency

- [ ] CHK008 - Are system prompt parameter names consistent across all three API provider implementations (OpenAI, Anthropic, Google)? [Consistency, Plan §API Client Pattern Research]
- [ ] CHK009 - Are temperature parameter names and formats consistent across OpenAI, Anthropic, and Google API specifications? [Consistency, Plan §API Client Pattern Research]
- [ ] CHK010 - Do API request contracts (POST /api/evaluate, POST /api/templates, PUT /api/templates/:id) consistently include both system_prompt and temperature fields? [Consistency, Plan §API Contracts]
- [ ] CHK011 - Are snake_case vs camelCase naming conventions consistently applied across database, API JSON, and TypeScript layers as specified? [Consistency, Plan §Naming Conventions]
- [ ] CHK012 - Is the ModelClient interface signature update (adding systemPrompt and temperature options) consistently reflected across all three provider implementations? [Consistency, Plan §API Clients]
- [ ] CHK013 - Are provider-specific API mappings (e.g., OpenAI messages array vs Anthropic system param) explicitly documented for all three providers? [Completeness, Plan §API Client Pattern Research]

### Validation Rule Consistency

- [ ] CHK014 - Are system prompt validation rules (≤4000 chars, non-empty if present) consistently enforced at both UI and API levels as specified in FR-016? [Consistency, Spec FR-016, Plan §Validation Strategy]
- [ ] CHK015 - Are temperature validation rules (0.0-2.0 range) consistently enforced at UI (slider min/max), API validation (FR-013), and database constraints (CHECK clause)? [Consistency, Spec FR-006, FR-013, Plan §Database Schema]
- [ ] CHK016 - Is the 4,000 character limit for system prompt consistently specified across FR-003, FR-016, Edge Cases, Assumptions, and Plan validation strategy? [Consistency, Multiple sections]
- [ ] CHK017 - Are temperature precision requirements (1 decimal place display, 0.1 increments) consistently specified across FR-007, FR-014, UI component, and Clarifications? [Consistency, Spec FR-007, FR-014, Clarifications]
- [ ] CHK018 - Are null/undefined handling rules for optional fields (system_prompt, temperature) consistently specified across backward compatibility (US4), FR-004, FR-012, and database schema (nullable columns)? [Consistency, Spec US4, FR-004, FR-012, Plan §Database Schema]

### Data Model Consistency

- [ ] CHK019 - Are the same fields (system_prompt, temperature) added to both Evaluation and EvaluationTemplate entities as specified? [Consistency, Plan §Entity Updates]
- [ ] CHK020 - Are audit fields (system_prompt_used, temperature_used) in Result entity clearly linked to source fields in Evaluation entity? [Traceability, Plan §Result Entity]
- [ ] CHK021 - Are database column constraints (CHECK clauses, DEFAULT values, NULL constraints) consistent with validation rules and functional requirements? [Consistency, Plan §Database Schema vs FR-013, FR-014]
- [ ] CHK022 - Is the temperature default value (0.3) consistently applied across database DEFAULT, FR-008, backward compatibility requirements (US4), and evaluation creation logic? [Consistency, Multiple sections]

---

## Category 2: Validation & Error Handling Requirement Completeness

### Input Validation Requirements

- [ ] CHK023 - Are validation requirements defined for all system prompt boundary cases: null, undefined, empty string, whitespace-only, exactly 4000 chars, 4001 chars? [Coverage, Gap]
- [ ] CHK024 - Are validation requirements defined for all temperature boundary cases: null, undefined, exactly 0.0, exactly 2.0, -0.1, 2.1, NaN, non-numeric strings? [Coverage, Gap]
- [ ] CHK025 - Is the validation sequence (UI → API → Database) explicitly specified for both system prompt and temperature? [Completeness, FR-016, FR-013]
- [ ] CHK026 - Are validation error message requirements specified for system prompt validation failures (too long, empty when enabled)? [Gap, Edge Cases mentions error message but not requirements]
- [ ] CHK027 - Are validation error message requirements specified for temperature validation failures (out of range, invalid type)? [Gap]
- [ ] CHK028 - Is form-level validation behavior specified when system prompt checkbox is checked but textarea is empty? [Ambiguity, Edge Cases implies preservation but not explicit validation rule]
- [ ] CHK029 - Are requirements defined for handling invalid precision/rounding of temperature values (e.g., 0.15, 1.234)? [Gap]
- [ ] CHK030 - Is validation behavior specified when temperature slider step size (0.1) produces floating-point precision issues? [Gap]

### Error Handling Requirements

- [ ] CHK031 - Are error handling requirements completely specified for API provider failures with custom system_prompt/temperature (FR-017 states fail-fast, but are all failure modes covered)? [Completeness, Spec FR-017]
- [ ] CHK032 - Is the "no silent fallback or retry" requirement (FR-017, Edge Cases) consistently enforced across all API client implementations? [Consistency, Spec FR-017, Edge Cases]
- [ ] CHK033 - Are requirements defined for handling partial API failures (e.g., OpenAI succeeds, Anthropic fails with custom settings)? [Gap, Exception Flow]
- [ ] CHK034 - Are error message persistence requirements specified (where/how to store error details for failed evaluations with custom settings)? [Gap, FR-017 mentions error_message but not details]
- [ ] CHK035 - Are requirements defined for user-facing error messages when API validation rejects system_prompt or temperature? [Gap, FR-016 mentions "clear error messaging" but not content]
- [ ] CHK036 - Is error recovery workflow specified when form submission fails due to validation errors (preserve form state, highlight errors, etc.)? [Gap]
- [ ] CHK037 - Are requirements defined for handling database constraint violations (e.g., temperature CHECK fails)? [Gap]
- [ ] CHK038 - Is the "delete and recreate evaluation to retry" workflow (Edge Cases, FR-017) explicitly documented as a requirement or just implementation note? [Ambiguity, Edge Cases & FR-017]

### Edge Case Coverage

- [ ] CHK039 - Are requirements defined for zero-state scenarios: evaluation with no system prompt and default temperature? [Coverage, US4 covers this implicitly]
- [ ] CHK040 - Are requirements defined for maximum-value edge cases: system prompt exactly at 4000 chars, temperature exactly at 2.0? [Coverage, Edge Cases mentions boundaries]
- [ ] CHK041 - Are requirements specified for handling template deletion when evaluations reference that template's system_prompt/temperature? [Gap]
- [ ] CHK042 - Is behavior specified when a user toggles system prompt checkbox off after entering text (Edge Cases mentions preservation, but is this a requirement or implementation detail)? [Ambiguity, Edge Cases]
- [ ] CHK043 - Are requirements defined for concurrent evaluation submissions with different temperature/system_prompt values? [Gap]
- [ ] CHK044 - Are requirements specified for mobile/narrow screen edge cases beyond "slider must remain usable" (specific breakpoints, fallback layouts)? [Ambiguity, Edge Cases]
- [ ] CHK045 - Is behavior specified when API provider does not support temperature parameter (e.g., future models)? [Gap, Assumption states alignment but no handling]
- [ ] CHK046 - Are requirements defined for handling Unicode/special characters in system prompt (emoji, non-Latin scripts, control characters)? [Gap]

### Validation Layer Completeness

- [ ] CHK047 - Are UI-level validation requirements explicitly separated from API-level validation requirements? [Clarity, FR-016 mentions both but separation unclear]
- [ ] CHK048 - Is database-level constraint validation (CHECK clauses) documented as a requirement or implementation detail? [Ambiguity, Plan shows CHECK but spec doesn't require it]
- [ ] CHK049 - Are validation timing requirements specified (when does validation occur: on blur, on submit, on change)? [Gap]
- [ ] CHK050 - Are requirements defined for validation during template-to-evaluation loading (validate loaded values against current rules)? [Gap]

---

## Category 3: Requirement Clarity & Measurability

### Quantification & Specificity

- [ ] CHK051 - Is "max 4,000 characters" quantified at the byte level, character level, or code point level for system prompt validation? [Ambiguity, Spec FR-003, FR-016]
- [ ] CHK052 - Is "temperature slider with 0.1 increments" (FR-006) precisely defined (floating-point representation, rounding rules)? [Ambiguity, Spec FR-006]
- [ ] CHK053 - Is "decimal format with 1 decimal place" (FR-007) precisely defined (rounding: 0.15→0.1 or 0.2? Always show .0 for whole numbers)? [Ambiguity, Spec FR-007]
- [ ] CHK054 - Is the performance requirement "form submission with validation <500ms p95" (Plan) measurable with specific test conditions defined? [Measurability, Plan §Performance Goals]
- [ ] CHK055 - Is the performance requirement "system prompt validation <10ms" (Plan) measurable with specific input sizes/conditions? [Measurability, Plan §Performance Goals]
- [ ] CHK056 - Can success criterion SC-001 ("configure within 2 minutes") be objectively measured with defined test scenarios? [Measurability, Spec SC-001]
- [ ] CHK057 - Can success criterion SC-008 ("80%+ test coverage for critical paths") be objectively verified with critical path definitions? [Measurability, Spec SC-008]

### Ambiguous Terms

- [ ] CHK058 - Is "appropriate precision" (FR-014) quantified with specific decimal places or storage format? [Ambiguity, Spec FR-014]
- [ ] CHK059 - Is "gracefully" in FR-012 ("handle existing evaluations gracefully") defined with specific behaviors? [Ambiguity, Spec FR-012]
- [ ] CHK060 - Is "clear error messaging" (FR-016) defined with message content requirements, format, or location specifications? [Ambiguity, Spec FR-016]
- [ ] CHK061 - Is "visual consistency" (SC-006) measurable with specific styling requirements or component patterns? [Ambiguity, Spec SC-006]
- [ ] CHK062 - Are "Tailwind CSS v4 styling conventions" (SC-006) explicitly referenced or documented? [Gap, Spec SC-006]
- [ ] CHK063 - Is "without page reload" (SC-007) testable as a requirement or is it an implementation constraint? [Ambiguity, Spec SC-007]

### Acceptance Criteria Quality

- [ ] CHK064 - Are acceptance scenarios in US1-US4 written in testable Given-When-Then format with measurable outcomes? [Measurability, Spec US1-US4 Acceptance Scenarios]
- [ ] CHK065 - Do all functional requirements (FR-001 to FR-017) have corresponding acceptance scenarios or success criteria? [Traceability, Gap]
- [ ] CHK066 - Are success criteria SC-001 to SC-008 directly traceable to specific functional requirements? [Traceability, Spec Success Criteria vs FR]
- [ ] CHK067 - Can "100% of new evaluations include temperature values" (SC-002) be objectively verified with test definitions? [Measurability, Spec SC-002]
- [ ] CHK068 - Can "All three AI providers correctly receive settings in 100% of calls" (SC-004) be tested with defined failure scenarios? [Measurability, Spec SC-004]

---

## Category 4: Coverage & Completeness

### Scenario Coverage

- [ ] CHK069 - Are requirements defined for all primary flows: create evaluation with custom settings, create from template, edit template, view results? [Coverage, Spec US1-US3]
- [ ] CHK070 - Are requirements defined for alternate flows: disable system prompt after enabling, adjust temperature mid-form, cancel form? [Gap]
- [ ] CHK071 - Are requirements defined for exception flows: validation failure, API timeout, database error, provider rejection? [Gap, Only FR-017 covers API failure]
- [ ] CHK072 - Are requirements defined for recovery flows: retry after validation error, reload form after browser crash, recover from partial save? [Gap]
- [ ] CHK073 - Are requirements defined for concurrent scenarios: multiple users creating evaluations, concurrent template edits? [Gap]

### Non-Functional Requirement Completeness

- [ ] CHK074 - Are performance requirements specified beyond form submission and validation (e.g., evaluation execution overhead, database query performance)? [Gap, Plan mentions "negligible overhead" but not measured]
- [ ] CHK075 - Are accessibility requirements specified for new UI controls (keyboard navigation for slider, screen reader support for checkbox/textarea)? [Gap, Edge Cases mentions keyboard but not requirements]
- [ ] CHK076 - Are responsive design requirements specified beyond "slider usable on mobile" (breakpoints, touch targets, orientation changes)? [Gap, Edge Cases]
- [ ] CHK077 - Are security requirements specified for system prompt content (XSS prevention, SQL injection, malicious prompts)? [Gap]
- [ ] CHK078 - Are data retention/privacy requirements specified for system_prompt and temperature audit fields in Result table? [Gap]
- [ ] CHK079 - Are internationalization (i18n) requirements specified for error messages, labels, and validation messages? [Gap]
- [ ] CHK080 - Are browser compatibility requirements specified for range input slider and checkbox controls? [Gap]

### Dependency & Integration Coverage

- [ ] CHK081 - Are integration requirements specified for how system_prompt/temperature interact with existing accuracy rubric scoring? [Gap]
- [ ] CHK082 - Are requirements defined for how template run_count field behaves with new system_prompt/temperature parameters? [Gap]
- [ ] CHK083 - Are requirements specified for API versioning or backward compatibility when API contracts change (Plan shows updated contracts)? [Gap]
- [ ] CHK084 - Are requirements defined for database migration/upgrade path from existing schema to new schema? [Gap, Plan notes "handled separately" but no requirements]
- [ ] CHK085 - Are requirements specified for how system_prompt/temperature affect token counting and cost calculations? [Gap]

---

## Category 5: Assumptions & Dependencies Validation

### Assumptions Documentation

- [ ] CHK086 - Is the assumption "users understand system prompts and temperature" (Assumptions) validated or documented as requiring user education? [Assumption, Spec Assumptions]
- [ ] CHK087 - Is the assumption "temperature range 0.0-2.0 aligns across all providers" validated against actual API documentation? [Assumption, Spec Assumptions, Plan §API Client Pattern]
- [ ] CHK088 - Is the assumption "system prompt accepts plain text only" explicitly enforced in validation requirements? [Assumption, Spec Assumptions but no FR]
- [ ] CHK089 - Is the assumption "checkbox default unchecked" consistently reflected in FR-001, FR-002, and UI requirements? [Assumption, Spec Assumptions vs FR-001-002]
- [ ] CHK090 - Is the assumption "0.1 step size sufficient granularity" validated with user research or requirements? [Assumption, Spec Assumptions]
- [ ] CHK091 - Is the assumption "database migration handled separately" documented with clear ownership and timing? [Dependency, Spec Assumptions]

### External Dependencies

- [ ] CHK092 - Are requirements defined for handling OpenAI API changes to system message format or temperature parameter? [Dependency, Gap]
- [ ] CHK093 - Are requirements defined for handling Anthropic API changes to system parameter or temperature support? [Dependency, Gap]
- [ ] CHK094 - Are requirements defined for handling Google API changes to systemInstruction or generationConfig? [Dependency, Gap]
- [ ] CHK095 - Are database schema migration prerequisites explicitly stated (better-sqlite3 version, migration tool requirements)? [Dependency, Plan notes migration but no requirements]
- [ ] CHK096 - Are UI framework dependencies (daisyUI, Tailwind CSS v4) version requirements specified for new controls? [Dependency, Gap]

---

## Category 6: Conflicts & Ambiguities

### Requirement Conflicts

- [ ] CHK097 - Does FR-004 (system prompt nullable) conflict with FR-016 (validation rejects empty strings when provided)? [Conflict, Spec FR-004 vs FR-016]
- [ ] CHK098 - Does Edge Cases "preserve text when checkbox disabled" conflict with "validation rejects empty strings"? [Potential Conflict, Edge Cases]
- [ ] CHK099 - Does "default 0.3" (FR-008, database DEFAULT) conflict with nullable temperature field allowing evaluations without temperature? [Ambiguity, FR-008 vs FR-012]
- [ ] CHK100 - Do template update requirements (PUT /api/templates/:id) conflict with "no retroactive changes to existing evaluations" requirement? [Consistency Check, US3, Edge Cases]

### Cross-Document Inconsistencies

- [ ] CHK101 - Are all functional requirements from spec.md reflected in plan.md API contracts and data model? [Traceability, Spec FR vs Plan contracts]
- [ ] CHK102 - Are all acceptance scenarios from spec.md traceable to test requirements in plan.md? [Traceability, Spec US acceptance scenarios vs Plan testing]
- [ ] CHK103 - Are database schema changes in plan.md aligned with entity definitions and functional requirements in spec.md? [Consistency, Plan §Database Schema vs Spec FR]
- [ ] CHK104 - Are naming conventions in plan.md (snake_case vs camelCase) consistently applied across all API contracts and data model examples? [Consistency, Plan §Naming Conventions]

### Missing Requirements

- [ ] CHK105 - Are requirements missing for system prompt/temperature behavior during evaluation result comparison views? [Gap, FR-015 mentions inclusion but not display]
- [ ] CHK106 - Are requirements missing for exporting/importing evaluations with system_prompt and temperature? [Gap]
- [ ] CHK107 - Are requirements missing for search/filter functionality by system_prompt content or temperature range? [Gap]
- [ ] CHK108 - Are requirements missing for analytics/reporting on system_prompt usage patterns or temperature distributions? [Gap]
- [ ] CHK109 - Are requirements missing for API rate limiting or quota management when custom settings increase token usage? [Gap]
- [ ] CHK110 - Are requirements missing for logging/monitoring of validation failures or API rejections with custom settings? [Gap]

---

## Summary Statistics

- **Total Items**: 110
- **Focus Areas**:
  - Consistency (Cross-Story & API): 22 items (20%)
  - Validation & Error Handling: 28 items (25%)
  - Clarity & Measurability: 18 items (16%)
  - Coverage & Completeness: 17 items (15%)
  - Assumptions & Dependencies: 11 items (10%)
  - Conflicts & Ambiguities: 14 items (13%)
- **Traceability**: 95+ items reference spec sections or plan sections
- **Gap Markers**: 45 items identify missing requirements
- **Ambiguity Markers**: 12 items identify unclear requirements
- **Conflict Markers**: 4 items identify potential conflicts

---

## Usage Notes

This checklist tests **REQUIREMENTS QUALITY**, not implementation correctness.

**How to use each item**:
1. Read the question about the requirement
2. Check the referenced spec/plan section
3. Answer: Is this requirement complete, clear, consistent, and measurable?
4. If NO: Document the gap/ambiguity/conflict for specification update
5. If YES: Mark the checkbox and move to next item

**This is NOT**:
- ❌ A test plan for verifying code works
- ❌ A QA checklist for testing the feature
- ❌ An implementation task list

**This IS**:
- ✅ A quality audit of the written requirements
- ✅ A consistency check across specification documents
- ✅ A gap analysis for missing or unclear requirements
- ✅ A validation that requirements are testable and measurable
