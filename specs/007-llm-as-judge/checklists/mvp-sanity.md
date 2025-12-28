# MVP Developer Sanity Checklist: LLM-as-Judge

**Purpose**: High-frequency requirement quality check for developers implementing and testing the MVP (Phases 1-5). Validates that requirements for "done" tasks are clear, complete, and address newly identified edge cases.
**Created**: 2025-12-27
**Scope**: User Stories 1-3 (Persona, CSV, Iteration) | **Audience**: Author/Developer | **Type**: Sanity List

---

## Requirement Completeness (MVP Scope)
*Are the requirements for the current implementation phase complete?*

- [X] CHK001 - Are the "input" and "expected_output" normalization rules explicitly defined for all accepted CSV column variations? [Completeness, Spec §A-016, Tasks T031] ✅
- [X] CHK002 - Is the behavior specified when a user attempts to upload a CSV that puts the total pair count over the 200-pair limit? [Completeness, FR-003, Gap] ✅ Returns 400 with error details
- [ ] CHK003 - Are loading state requirements defined for the transition between "Start Training" and the appearance of the first judge decision? [Gap, Tasks T056] ❌ NOT DEFINED
- [ ] CHK004 - Is the "Draft" persona status transition to "Training" explicitly defined for the first iteration start? [Completeness, Spec §Key Entities] ❌ NOT DEFINED
- [X] CHK005 - Are the required fields for the "Judge Reasoning" JSON response from the LLM explicitly documented for parser implementation? [Completeness, Tasks T045] ✅

## Requirement Clarity & Measurability
*Are requirements specific enough for unit test implementation and verification?*

- [X] CHK006 - Is the "Agree/Disagree" vote semantics clarified for the case where the judge marks an output as "Incorrect" but the human thinks it's "Correct"? [Clarity, Spec §Clarifications Q2] ✅ Confusion matrix mapping defined
- [ ] CHK007 - Are the specific HTTP status codes and error message bodies defined for each validation failure (Model Separation, CSV size, Duplicate rows)? [Clarity, Tasks T005, T022] ❌ T088 standardization not complete
- [ ] CHK008 - Is the "exponential backoff" for FR-016 quantified with a starting interval and maximum ceiling for the 3 retries? [Clarity, FR-016, Gap] ❌ NOT QUANTIFIED
- [ ] CHK009 - Is the definition of "Significant Prompt Change" for FR-015 quantifiable (e.g., Levenshtein distance or semantic threshold)? [Ambiguity, FR-015] ❌ Only "not formatting" - not quantifiable
- [X] CHK010 - Can the 400 Bad Request response for "Incomplete Feedback" be objectively verified before metrics calculation? [Measurability, FR-008, A-012] ✅ Explicitly defined in FR-007, FR-008, T049, T053

## Edge Case Coverage (Implementation-Derived)
*Are newly identified boundary conditions addressed in the requirements?*

- [ ] CHK011 - Does the spec define the behavior for "Contradictory Feedback" where a human disagrees with a judge decision they previously agreed with in a different iteration? [Edge Case, Spec §Edge Cases] ❌ Listed as edge case but NOT ADDRESSED
- [ ] CHK012 - Are requirements defined for handling 0-byte or non-CSV file uploads in the CSVUploader? [Edge Case, Tasks T037] ❌ T037 mentions validation but NOT EXPLICIT
- [ ] CHK013 - Is the handling of "Empty Input" fields in a CSV row defined (Reject row vs. Allow empty string)? [Edge Case, FR-004] ⚠️ PARTIAL - FR-004 says "non-empty" but edge case handling not fully explicit
- [ ] CHK014 - Are requirements specified for "Timezone Handling" in iteration timestamps to prevent dashboard sorting issues? [Edge Case, Spec §Edge Cases] ❌ Listed as edge case but NOT SPECIFIED
- [X] CHK015 - Is there a defined "Recovery Path" for when the Judge Model returns unparseable JSON multiple times? [Exception Flow, FR-016] ✅ T045, T064, FR-016 define graceful handling
- [ ] CHK016 - Are requirements defined for the "Zero-State" UI when a persona exists but no training data has been uploaded yet? [Coverage, Gap, CHK051] ❌ NOT DEFINED
- [X] CHK017 - Does the spec define behavior for when an iteration results in 100% agreement (Undefined Cohen's Kappa)? [Edge Case, Spec §Edge Cases, Tasks T008] ✅ T008 edge case tests, research.md handles zero-division

## UI/UX Requirement Consistency
*Are UI requirements consistent with existing patterns?*

- [ ] CHK018 - Do the MetricCard trend indicators (↑/↓) follow the same logic as the existing Evaluations module? [Consistency, Plan §Technical Context] ❌ NOT EXPLICITLY VALIDATED
- [ ] CHK019 - Is the "Previous/Next" navigation behavior in the review interface defined for the first and last decisions? [Consistency, Tasks T050] ❌ NOT DEFINED for edge cases
- [ ] CHK020 - Are the validation error display locations (inline vs. toast) consistent with the Persona creation form? [Consistency, Principle III] ❌ NOT DOCUMENTED

---

## Traceability Check
- **Traceability Score**: 100% of items include [Dimension, Spec/Task/Gap] markers.
- **Critical Path Alignment**: All items correlate with P1 User Stories or MVP Functional Requirements.
