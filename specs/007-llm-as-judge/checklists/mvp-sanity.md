# MVP Developer Sanity Checklist: LLM-as-Judge

**Purpose**: High-frequency requirement quality check for developers implementing and testing the MVP (Phases 1-6). Validates that requirements for "done" tasks are clear, complete, and address newly identified edge cases.
**Created**: 2025-12-27 | **Updated**: 2025-12-28
**Scope**: User Stories 1-6 (Persona, CSV, Iteration, Automation) | **Audience**: Author/Developer | **Type**: Sanity List

---

## Requirement Completeness (MVP Scope)
*Are the requirements for the current implementation phase complete?*

- [X] CHK001 - Are the "input" and "expected_output" normalization rules explicitly defined for all accepted CSV column variations? [Completeness, Spec §A-016, csv-parser.ts:24-32] ✅ Implemented with normalizeColumnNames()
- [X] CHK002 - Is the behavior specified when a user attempts to upload a CSV that puts the total pair count over the 200-pair limit? [Completeness, FR-003, csv-parser.ts:109-111] ✅ Returns 400 with error "Training data must have between 10 and 200 pairs"
- [X] CHK003 - Are loading state requirements defined for async operations in the UI? [Completeness, DaisyUI loading-spinner pattern] ✅ IMPLEMENTED: Loading states use DaisyUI `loading loading-spinner` classes throughout
- [X] CHK004 - Is the "Draft" persona status transition to "Training" explicitly defined for the first iteration start? [Completeness, Spec §Key Entities, training-loop.ts:96] ✅ Status changes: draft → training → trained/incomplete
- [X] CHK005 - Are the required fields for the "Judge Reasoning" JSON response from the LLM explicitly documented for parser implementation? [Completeness, judge-evaluator.ts] ✅ Decision format: `{decision: "correct"|"incorrect", reasoning: string, confidence: number}`

## Requirement Clarity & Measurability
*Are requirements specific enough for unit test implementation and verification?*

- [X] CHK006 - Is the "Agree/Disagree" vote semantics clarified for the case where the judge marks an output as "Incorrect" but the human thinks it's "Correct"? [Clarity, Spec §Clarifications Q2, FR-007] ✅ "Agree" = human affirms judge's assessment; "Disagree" = human contradicts judge (separate from ground truth)
- [X] CHK007 - Are the specific HTTP status codes and error message bodies defined for each validation failure? [Clarity, upload.ts:400/404/500, csv-parser.ts:37-111] ✅ 400 for validation errors, 404 for not found, 500 for internal errors with details array
- [ ] CHK008 - Is the "exponential backoff" for FR-016 quantified with a starting interval and maximum ceiling for the 3 retries? [Clarity, Spec §EC-002, evaluator.ts:6] ❌ CONFLICT: Spec says "1s → 2s → 4s, max 3 retries" but evaluator.ts implements FAIL-FAST with NO retry
- [X] CHK009 - Is the definition of "Significant Prompt Change" for FR-015 quantifiable? [Clarity, FR-016, prompt-version-manager.ts:25] ✅ Defined as "text modifications after whitespace normalization" - formatting-only changes don't create new versions
- [X] CHK010 - Can the automatic metrics calculation be objectively verified without human review? [Measurability, FR-007, metrics-orchestrator.ts:11] ✅ Metrics derived from ground truth (expected_output vs generated_output) - NO human review required

## Edge Case Coverage (Implementation-Derived)
*Are newly identified boundary conditions addressed in the requirements?*

- [X] CHK011 - Does the spec define the behavior for "Contradictory Feedback" where a human disagrees with a judge decision they previously agreed with in a different iteration? [Edge Case, Spec §EC-003] ✅ "Each iteration's metrics are calculated independently using only that iteration's human reviews"
- [X] CHK012 - Are requirements defined for handling 0-byte or non-CSV file uploads in the CSVUploader? [Edge Case, csv-parser.ts:38-48] ✅ Empty content returns error "CSV file is empty"; wrong columns return "Missing required columns"
- [X] CHK013 - Is the handling of "Empty Input" fields in a CSV row defined (Reject row vs. Allow empty string)? [Edge Case, FR-004, csv-parser.ts:81-89] ✅ Empty input/expected_output rejected with specific error messages: "Input cannot be empty", "Expected output cannot be empty"
- [X] CHK014 - Are requirements specified for "Timezone Handling" in iteration timestamps to prevent dashboard sorting issues? [Edge Case, Spec §EC-006] ✅ "All timestamps stored in UTC (ISO 8601 with Z suffix). UI converts to user's local timezone"
- [X] CHK015 - Is there a defined "Recovery Path" for when the Judge Model returns unparseable JSON multiple times? [Exception Flow, FR-016, prompt-engineer.ts:42-67] ✅ Graceful handling: returns null improved_prompt for fallback; error caught and logged
- [ ] CHK016 - Are requirements defined for the "Zero-State" UI when a persona exists but no training data has been uploaded yet? [Coverage, Gap] ❌ NOT DEFINED - No explicit requirements for empty training data state UI
- [X] CHK017 - Does the spec define behavior for when an iteration results in 100% agreement (Undefined Cohen's Kappa)? [Edge Case, Spec §EC-005, metrics.ts:42] ✅ "Training continues normally if F1 < target. Prompt refinement may have minimal failures to analyze"

## UI/UX Requirement Consistency
*Are UI requirements consistent with existing patterns?*

- [ ] CHK018 - Do the MetricCard trend indicators (↑/↓) follow the same logic as the existing Evaluations module? [Consistency, Plan §Technical Context] ❌ NOT EXPLICITLY VALIDATED
- [ ] CHK019 - Is the "Previous/Next" navigation behavior in the review interface defined for the first and last decisions? [Consistency, Tasks T050] ❌ NOT DEFINED for edge cases
- [ ] CHK020 - Are the validation error display locations (inline vs. toast) consistent with the Persona creation form? [Consistency, Principle III] ❌ NOT DOCUMENTED

---

## Traceability Check
- **Traceability Score**: 100% of items include [Dimension, Spec/Task/Gap] markers.
- **Critical Path Alignment**: All items correlate with P1 User Stories or MVP Functional Requirements.
