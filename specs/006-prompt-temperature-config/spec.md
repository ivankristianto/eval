# Feature Specification: Add Optional System Prompt and Temperature Configuration for Evaluations

**Feature Branch**: `006-prompt-temperature-config`
**Created**: 2025-12-25
**Status**: Draft
**Input**: Add Optional System Prompt and Temperature Configuration for Evaluations. The evaluation framework currently lacks support for customizable system prompts and temperature settings.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Configure System Prompt for Advanced Control (Priority: P1)

As an AI researcher, I need to provide custom system prompts (like "You are an expert mathematician" or "Think step-by-step") to shape model behavior during evaluations, so that I can test how different system-level instructions influence model responses.

**Why this priority**: System prompts are a core mechanism for controlling model behavior and enable advanced evaluation scenarios. This is essential for fair model comparisons where system context matters.

**Independent Test**: Can be fully tested by creating an evaluation with a system prompt enabled, verifying it's saved, and confirming it's applied when the evaluation runs.

**Acceptance Scenarios**:

1. **Given** I'm on the New Evaluation form, **When** I check the "Use System Prompt" checkbox, **Then** a text area appears for entering the system prompt
2. **Given** the system prompt text area is visible, **When** I enter "You are a helpful assistant" and save the evaluation, **Then** the system prompt is stored and used when calling the AI models
3. **Given** I have a saved template with a system prompt, **When** I create an evaluation from that template, **Then** the system prompt is pre-filled and used in the evaluation

---

### User Story 2 - Adjust Temperature for Creativity Control (Priority: P1)

As a model evaluator, I need to adjust the temperature parameter (controlling response randomness) from 0.0 (deterministic) to 2.0 (creative/random), so that I can evaluate how models behave across different creativity levels.

**Why this priority**: Temperature is a fundamental hyperparameter that significantly affects model outputs. Being able to test different temperature values is essential for comprehensive model evaluation.

**Independent Test**: Can be fully tested by adjusting the temperature slider to various values (0.0, 0.3, 1.0, 2.0), saving evaluations with different temperatures, and verifying the values are stored and applied.

**Acceptance Scenarios**:

1. **Given** I'm on the New Evaluation form, **When** I see the temperature slider, **Then** the default value is 0.3 and the slider range is 0.0-2.0
2. **Given** I adjust the temperature slider to 1.5, **When** I save the evaluation, **Then** the temperature value 1.5 is stored and used when calling the AI models
3. **Given** I have an existing evaluation, **When** I view its details, **Then** the temperature used is displayed alongside other evaluation metrics
4. **Given** I create multiple evaluations with different temperatures (0.0, 0.5, 1.5, 2.0), **When** I compare the results, **Then** each evaluation used its specified temperature value

---

### User Story 3 - Save Settings in Templates for Reusability (Priority: P2)

As a framework user, I need to save system prompt and temperature configurations in evaluation templates, so that I can reuse the same settings for multiple evaluations without reconfiguring them each time.

**Why this priority**: Templates enable efficiency and consistency. Being able to save prompt and temperature configurations in templates allows users to maintain consistent evaluation conditions across multiple runs.

**Independent Test**: Can be fully tested by creating a template with system prompt and temperature settings, then creating multiple evaluations from that template and verifying the settings are applied.

**Acceptance Scenarios**:

1. **Given** I'm creating an evaluation template, **When** I configure a system prompt and temperature, **Then** both settings are saved with the template
2. **Given** I load a template with saved system prompt and temperature, **When** I create an evaluation from it, **Then** those settings are pre-populated in the form
3. **Given** I edit a template's system prompt, **When** I save the changes, **Then** new evaluations created from the template use the updated system prompt

---

### User Story 4 - Maintain Backward Compatibility (Priority: P1)

As a framework maintainer, I need existing evaluations to continue working without system prompts and temperature settings, so that no data is lost and existing workflows remain uninterrupted when this feature is added.

**Why this priority**: Backward compatibility is essential to ensure the feature upgrade doesn't break existing data or workflows. Users should be able to upgrade without manual migration.

**Independent Test**: Can be fully tested by running existing evaluations (created before this feature) and verifying they still execute correctly with default settings.

**Acceptance Scenarios**:

1. **Given** an evaluation was created before this feature was added (no system_prompt or temperature stored), **When** I run it, **Then** it executes with default settings (no system prompt, temperature 0.3)
2. **Given** I view an old evaluation without explicit settings, **When** I check the evaluation details, **Then** it shows the default temperature (0.3) was used

### Edge Cases & Error Handling

- If a user enters more than 4,000 characters in the system prompt, the UI MUST prevent submission and display an error message
- Temperature values at boundaries (exactly 0.0 or exactly 2.0) MUST be accepted and processed normally
- If a template's system prompt is edited after evaluations have been created from it, existing evaluations retain their original system prompt (no retroactive changes)
- On mobile or narrow screens, the temperature slider MUST remain usable and the current temperature value MUST be visible
- When a user disables the system prompt checkbox, any entered text MUST be preserved in the form state (not cleared) in case the checkbox is re-enabled
- **Error Handling**: If an API provider fails while processing a request with custom system prompt or temperature settings, the entire evaluation MUST be marked as failed. The user MUST delete and recreate the evaluation to retry (no silent fallback or retry mechanism)

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST provide a checkbox control in the evaluation form to enable/disable system prompt input
- **FR-002**: System MUST display a text area for system prompt input only when the checkbox is enabled (hidden by default)
- **FR-003**: System MUST allow users to enter multi-line system prompt text up to 4,000 characters maximum (enforced at both UI and API levels)
- **FR-004**: System MUST store system prompt as nullable data, allowing evaluations to proceed without a system prompt
- **FR-005**: System MUST provide a temperature slider control visible at all times on the evaluation form
- **FR-006**: System MUST display the temperature slider with a range of 0.0 to 2.0 with 0.1 increments
- **FR-007**: System MUST display the current temperature value next to the slider in decimal format with 1 decimal place (e.g., "0.3", "1.5", "2.0")
- **FR-008**: System MUST set the default temperature value to 0.3 for all new evaluations
- **FR-009**: System MUST apply the configured system prompt and temperature to API calls for all three AI providers (OpenAI, Anthropic, Google)
- **FR-010**: System MUST save system prompt and temperature settings in both evaluation records and templates
- **FR-011**: System MUST support loading system prompt and temperature from templates when creating evaluations from templates
- **FR-012**: System MUST handle existing evaluations gracefully, using default values (no system prompt, 0.3 temperature) when settings are not present
- **FR-013**: System MUST validate that temperature values are within 0.0-2.0 range before sending to API providers
- **FR-014**: System MUST store temperature values with appropriate precision (e.g., 0.1 increments) in the database
- **FR-015**: System MUST include system prompt and temperature in evaluation result records for auditing and reference
- **FR-016**: System MUST validate system prompt length at both UI and API levels, rejecting submissions exceeding 4,000 characters with clear error messaging
- **FR-017**: If an API provider fails during evaluation with custom system prompt or temperature, the evaluation MUST be marked as failed with an error message; no silent fallback or retry is allowed

### Key Entities

- **Evaluation**: Records individual model evaluation runs with instruction, rubric, and now system prompt and temperature settings
- **EvaluationTemplate**: Reusable evaluation configurations that now include system prompt and temperature defaults
- **Temperature**: Numeric parameter (0.0-2.0) controlling model response randomness/creativity
- **SystemPrompt**: Optional text instruction that sets the context/behavior for the model at the system level

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can configure system prompts and temperature values within 2 minutes of accessing the evaluation form (no additional learning curve)
- **SC-002**: 100% of new evaluations include temperature values with valid defaults
- **SC-003**: System prompt and temperature settings are persisted correctly for 100% of created evaluations and templates
- **SC-004**: All three AI providers (OpenAI, Anthropic, Google) correctly receive and apply system prompt and temperature settings in 100% of evaluation calls
- **SC-005**: Existing evaluations (created before this feature) continue to execute successfully without modification
- **SC-006**: UI controls for system prompt and temperature follow Tailwind CSS v4 styling conventions and maintain visual consistency with existing form elements
- **SC-007**: Users can enable/disable system prompt visibility and adjust temperature without page reload or re-entering other form fields
- **SC-008**: Test coverage for critical paths (system prompt handling, temperature validation, API client modifications) remains at or above 80%

## Assumptions

- Users understand what system prompts and temperature parameters do (advanced feature)
- Temperature range of 0.0-2.0 aligns across all three AI providers (standard convention)
- System prompt field should accept plain text only (no special formatting or markdown)
- Checkbox default state is unchecked (system prompt hidden until explicitly enabled)
- Temperature slider step size of 0.1 provides sufficient granularity for user control
- Existing API endpoints can be extended to accept system prompt and temperature without breaking changes
- Database migration will be handled separately via migration scripts (not covered by this feature)
- System prompt maximum length: 4,000 characters

## Clarifications

### Session 2025-12-25

- Q: System Prompt Length Constraint → A: 4,000 characters maximum
- Q: Error Handling for Failed API Calls → A: Fail the entire evaluation and mark it as failed; user must delete and recreate
- Q: Temperature Slider Display Precision → A: Decimal with 1 decimal place (0.3, 1.5, 2.0)
