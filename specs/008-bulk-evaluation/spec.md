# Feature Specification: Bulk Evaluation

**Feature Branch**: `007-bulk-evaluation`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "New Feature: Bulk Evaluation. I will upload a CSV and it will show me the table. then I can run evaluate them all or partially with checkbox. The main setting will have system prompt, temperature, which models should run with checkboxes. The result will be a tabular. with a view to see more details in a drawer component."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Upload and Preview Data (Priority: P1)

As a user, I want to upload a CSV file containing test data so that I can verify the content before running an evaluation.

**Why this priority**: P1 because loading data is the prerequisite for any bulk evaluation.

**Independent Test**: Can be tested by uploading a valid CSV file and verifying the data appears in the UI table matching the file content.

**Acceptance Scenarios**:

1. **Given** I am on the bulk evaluation page, **When** I upload a CSV file with headers and data, **Then** the system displays the data in a paginated table view.
2. **Given** the table is populated, **When** I look at the columns, **Then** they match the CSV headers.

---

### User Story 2 - Configure and Run Evaluation (Priority: P1)

As a user, I want to select specific rows and configure evaluation settings (prompt, temperature, models) so that I can run targeted tests on my data.

**Why this priority**: P1 because this is the core value proposition: executing the evaluation.

**Independent Test**: Can be tested by selecting rows, entering settings, clicking run, and verifying that the backend receives the correct evaluation request.

**Acceptance Scenarios**:

1. **Given** a populated data table, **When** I select specific rows using checkboxes and click "Configure", **Then** I can see settings for System Prompt (supporting `{{column_name}}` variables), Temperature, and Model selection.
2. **Given** valid settings (System Prompt with optional variables, at least one Model selected), **When** I click "Run Evaluation", **Then** the system initiates the evaluation process, injecting data from the selected rows into the prompt template for each model.
3. **Given** the evaluation is running, **When** I view the table, **Then** I see a loading or status indicator for the active rows.

---

### User Story 3 - View Detailed Results (Priority: P2)

As a user, I want to view the evaluation results in the table and drill down into details so that I can analyze the model outputs.

**Why this priority**: P2 because while seeing results is critical, the "drawer" detail view is an enhancement over just the tabular data.

**Independent Test**: Can be tested by mocking evaluation results and verifying they display in the table and the drawer opens with correct details.

**Acceptance Scenarios**:

1. **Given** an evaluation has completed, **When** I view the table, **Then** I see distinct columns for each model's output side-by-side (e.g., "Output (GPT-4)", "Output (Claude-3)").
2. **Given** a result row, **When** I click on it (or a "View Details" button), **Then** a drawer component opens displaying the full prompt, model response, and any metadata/scores.

### Edge Cases

- **Malformed CSV**: System must validate the uploaded file and display an error message if it cannot be parsed or lacks required structure.
- **Partial Failure**: If evaluation fails for specific rows (e.g., API timeout), the system must mark those specific rows as "Failed" without stopping the entire batch.
- **Large Files**: For V1, we assume files < 1000 rows. Larger files may require pagination or strict limits (see SC-001).

## Clarifications

### Session 2025-12-28

- Q: How should results be displayed in the main table when multiple models are selected? → A: Display side-by-side columns for each model's output (e.g., "Output (Model A)", "Output (Model B)").
- Q: How does the system map CSV columns to the prompt sent to the model? → A: Mustache Templating (`{{header}}` syntax).
- Q: Should uploaded CSV data and evaluation results be persisted in the database? → A: Persistent (save to SQLite).
- Q: How should the evaluation engine handle the execution of multiple rows and models? → A: Sequential (one-by-one).
- Q: How should the system handle a new CSV upload while an evaluation is currently running? → A: Block/Warn (prevent new uploads until finished or cancelled).

## Assumptions & Dependencies

- **Assumptions**:
  - The uploaded CSV file contains a header row.
  - Users have configured valid API keys for the models they wish to use.
  - The CSV contains at least one column that serves as the input for the prompt.
- **Dependencies**:
  - Existing Model Registry to provide the list of available models.
  - Existing Evaluation Engine to execute the requests.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to upload CSV files.
- **FR-002**: System MUST parse the CSV and display contents in a tabular view.
- **FR-003**: System MUST allow users to select one, multiple, or all rows from the table via checkboxes.
- **FR-004**: System MUST allow users to define a prompt template using mustache-style tags (e.g., `{{column_name}}`) to dynamically inject CSV data into the evaluation request.
- **FR-005**: System MUST provide a configuration area to set "Temperature" (numeric value).
- **FR-006**: System MUST allow selection of one or more AI models to execute the evaluation against.
- **FR-007**: System MUST execute the evaluation asynchronously and sequentially for selected rows to manage API rate limits and provide steady UI updates.
- **FR-008**: System MUST display evaluation results as new columns appended to the table, with one column per selected model (side-by-side comparison).
- **FR-009**: System MUST provide a detailed view (Drawer) for each evaluation result row containing the full input, system prompt used, and model response.
- **FR-010**: System MUST validate the CSV format upon upload and display an error message if the file is malformed or empty.
- **FR-011**: System MUST handle individual row failures gracefully, recording the error state for that row while continuing to process other rows.
- **FR-012**: System MUST persist uploaded dataset metadata and all evaluation results to the database to allow retrieval of historical runs.
- **FR-013**: System MUST prevent or warn against uploading a new dataset while an evaluation is currently in progress for the active dataset.

### Key Entities _(include if feature involves data)_

- **BulkDataset**: Represents the uploaded CSV data and its metadata (persisted).
- **EvaluationConfig**: Stores the run configuration (System Prompt, Temperature, Selected Models).
- **EvaluationRun**: Represents a specific execution of a BulkDataset with a Config (persisted).
- **RowResult**: The specific output for a single row in the dataset against a specific model (persisted).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can upload a 100-row CSV and see the preview table within 2 seconds.
- **SC-002**: Users can successfully trigger an evaluation run for selected rows.
- **SC-003**: Evaluation results are displayed in the table immediately upon completion (real-time or near real-time updates).
