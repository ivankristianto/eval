# Feature Specification: LLM-as-a-Judge System

**Feature Branch**: `007-llm-as-judge`
**Created**: 2025-12-26
**Status**: Draft
**Input**: Implement LLM-as-a-Judge system for iterative training of AI judges through human feedback to evaluate non-deterministic LLM outputs. System automatically refines evaluation prompts until achieving >80% F1 score alignment with human judgment. Includes persona creation, CSV training data upload, automated iteration loop with metrics calculation and AI-assisted prompt refinement, and real-time training visualization.

## Clarifications

### Session 2025-12-26

- Q: Should the specification focus on Phase 1 (MVP) only, or include all features across implementation phases? → A: Include all 4 phases in the specification to capture the full feature vision (Foundation/MVP, Automation, Polish, Integration).
- Q: What should human reviewers actually evaluate - judge decision accuracy or output correctness? → A: Human reviewers vote on whether the judge's decision (correct/incorrect) was accurate by selecting "Agree" or "Disagree" with the judge's assessment.
- Q: How strict should model diversification rules be across task generation, judging, and prompt engineering? → A: Strict separation required: Judge Model, Task Model, and Prompt Engineer Model must all be different providers/models to prevent bias from same model evaluating its own outputs.
- Q: What are the acceptable bounds on training dataset size? → A: Minimum 10 training pairs, recommended 50 pairs, maximum 200 pairs per training session to balance data quality with cost/scalability.
- Q: Should the system enforce cost management features (estimation, hard limits, etc.)? → A: No cost controls. Skip cost management features to focus on core training functionality.

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

### User Story 1 - Create and Configure a Judge Persona (Priority: P1)

An AI researcher needs to set up a new evaluation judge for a specific task. They create a persona by specifying the task description and an initial judge prompt that defines how outputs should be evaluated. This serves as the foundation for the iterative training process.

**Why this priority**: P1 is the critical entry point to the entire feature. Without persona creation, training cannot begin. This is a foundational capability that must work before any other functionality.

**Independent Test**: Can be fully tested by creating a persona with a task prompt and judge prompt, then verifying the persona is saved and accessible. Delivers the foundation for all subsequent training activities.

**Acceptance Scenarios**:

1. **Given** a user is on the personas creation page, **When** they enter a task name, task description, and initial judge prompt, **Then** the system saves the persona and displays it in the persona list.
2. **Given** a persona has been created, **When** the user views the persona details, **Then** all configured information (task, judge prompt) is displayed correctly.
3. **Given** a user is creating a persona, **When** they attempt to submit without providing a task name, **Then** the system displays a validation error.

---

### User Story 2 - Upload Training Data (Priority: P1)

An AI researcher uploads CSV training data containing input/correct output pairs. The system parses and stores these pairs, which serve as the ground truth for evaluating the judge's performance during training iterations.

**Why this priority**: P1 because training cannot begin without data. The ability to ingest training pairs is essential to the entire feedback loop.

**Independent Test**: Can be fully tested by uploading a valid CSV file, verifying pairs are parsed correctly, and confirming they appear in the training data list. Delivers the dataset foundation for judge evaluation.

**Acceptance Scenarios**:

1. **Given** a persona exists, **When** the user uploads a well-formed CSV with input and expected_output columns, **Then** the system parses all rows and stores them as training pairs.
2. **Given** training pairs have been uploaded, **When** the user views the training data, **Then** all pairs are displayed with their input and expected output.
3. **Given** a user attempts to upload a CSV with incorrect columns, **When** they submit the file, **Then** the system displays an error explaining the required format.
4. **Given** a user has uploaded training data, **When** they attempt to upload duplicate rows, **Then** the system either prevents duplicates or notifies the user of the conflict.

---

### User Story 3 - Execute Automated Training Loop (Priority: P1)

The system runs a **fully automated training loop** that generates outputs from a model, evaluates them using the current judge prompt, and calculates accuracy metrics by comparing judge decisions against ground truth (expected_output). The **automated training loop** runs continuously until convergence (F1 ≥ target) or max iterations reached, with AI-assisted prompt refinement between iterations. No human intervention is required between iterations.

**Why this priority**: P1 because the core automation loop is the heart of the feature. Without executing iterations and automatically calculating metrics, there is no learning mechanism.

**Independent Test**: Can be fully tested by running a complete iteration from start (model generation) to finish (automatic metrics calculation), verifying metrics are calculated from ground truth comparison, and confirming next iteration starts automatically. Delivers the automated learning loop core functionality.

**Acceptance Scenarios**:

1. **Given** training data has been uploaded to a persona, **When** the user initiates training, **Then** the system generates outputs for each training pair using the Task Model and Task Prompt.
2. **Given** outputs have been generated, **When** the judge evaluates them, **Then** the Judge Model determines if each suggested_output is correct or incorrect based on the Judge Prompt.
3. **Given** judge decisions have been made, **When** metrics are calculated, **Then** the system automatically compares judge decisions against ground truth (expected_output matches suggested_output) to compute TP/TN/FP/FN confusion matrix.
4. **Given** metrics have been calculated, **When** F1 score < target AND iterations < max_iterations, **Then** the system automatically refines both Task Prompt and Judge Prompt and starts the next iteration.
5. **Given** metrics have been calculated, **When** the user views iteration results, **Then** all metrics (F1, precision, recall, Cohen's Kappa, confusion matrix) are displayed with iteration number and prompt versions used.
6. **Given** F1 score ≥ target OR iterations ≥ max_iterations, **When** the iteration completes, **Then** training stops and displays final metrics with best-performing iteration identified.

---

### User Story 3A - First Iteration Human Review (Priority: P1)

**Iteration 1 requires MANDATORY human review** before metrics calculation and automated training can proceed. The system requires human feedback on all judge decisions from iteration 1, calculates metrics based on human votes, and uses human reasoning to refine both the Task Prompt and Judge Prompt via LLM before iteration 2 begins. This ensures the initial prompt refinement is guided by human domain expertise.

**Why this priority**: P1 because iteration 1 establishes the baseline for all subsequent automated iterations. Without human-guided refinement on the first iteration, the automated loop may propagate systematic errors from the start.

**Independent Test**: Can be fully tested by completing iteration 1, providing mandatory human feedback, verifying metrics are calculated based on human votes, and confirming both prompts are refined via LLM using human reasoning. Then verify iteration 2 begins automatically with the refined prompts.

**Acceptance Scenarios**:

1. **Given** iteration 1 has completed (after judge evaluation), **When** the user navigates to the review page, **Then** the system requires human review of ALL judge decisions before metrics calculation or iteration 2 can begin.
2. **Given** judge decisions are displayed for iteration 1, **When** the human reviewer votes "Agree" or "Disagree" and provides reasoning, **Then** the system records their feedback and aggregates patterns from human corrections.
3. **Given** all iteration 1 decisions have been reviewed, **When** the user clicks "Calculate Metrics & Generate Refined Prompts", **Then** the system calculates metrics based on human votes (TP/TN/FP/FN from Agree/Disagree) and uses the Prompt Engineer Model to generate improved Task Prompt AND Judge Prompt incorporating human reasoning.
4. **Given** the refined prompts are displayed, **When** the user accepts them, **Then** iteration 2 begins automatically using both refined prompts.
5. **Given** iteration 2+ are running, **When** iterations complete, **Then** the system uses LLM-based automatic prompt refinement without stopping for human review.

---

### User Story 4 - AI-Assisted Prompt Refinement (Priority: P1)

After each iteration, the system analyzes failures (FP/FN cases where judge was wrong) and automatically generates improved Task Prompt and Judge Prompt using the Prompt Engineer Model. The system refines both prompts to maximize F1 score alignment with ground truth.

**Why this priority**: P1 because automatic prompt refinement is the core mechanism for achieving convergence. Without this, training cannot improve across iterations.

**Independent Test**: Can be fully tested by completing an iteration with failures, receiving refined task and judge prompts, verifying refinements address specific failure patterns, and confirming next iteration uses new prompts.

**Acceptance Scenarios**:

1. **Given** an iteration has completed with F1 < target, **When** the system analyzes failures, **Then** it identifies FP cases (judge said correct but wrong) and FN cases (judge said incorrect but right).
2. **Given** failure patterns have been identified, **When** the Prompt Engineer Model analyzes them, **Then** it generates both a refined Task Prompt (to improve output quality) and refined Judge Prompt (to improve evaluation accuracy) with rationale for changes.
3. **Given** refined prompts have been generated, **When** the next iteration runs, **Then** both the new Task Prompt and Judge Prompt are used, and the iteration is tagged with these prompt versions.
4. **Given** multiple iterations have completed, **When** the user views prompt history, **Then** all Task Prompt and Judge Prompt versions are displayed with their F1 scores and iteration numbers.

---

### User Story 5 - Track Training Progress and Metrics (Priority: P2)

The researcher monitors the training progress through a dashboard that displays metrics across iterations (F1 score, precision, recall, Cohen's Kappa trends), shows the current iteration status, and indicates whether the target F1 score (≥0.80) has been achieved.

**Why this priority**: P2 because while important for understanding training progress and convergence, this is a visualization/monitoring feature that doesn't block the core training loop from functioning.

**Independent Test**: Can be fully tested by running multiple iterations and verifying that the dashboard displays updated metrics and trends accurately. Delivers visibility into training effectiveness.

**Acceptance Scenarios**:

1. **Given** multiple training iterations have been completed, **When** the user views the training dashboard, **Then** metrics from all iterations are displayed in a chart showing trends over time.
2. **Given** iterations are in progress, **When** the user views the dashboard, **Then** the current iteration status is displayed with real-time progress updates.
3. **Given** the F1 score has reached ≥0.80, **When** the user views the dashboard, **Then** a success indicator appears showing that the target has been achieved.
4. **Given** metrics from previous iterations are displayed, **When** the user hovers over a data point, **Then** detailed metrics for that iteration are shown.

---

### User Story 6 - Pause and Resume Training (Priority: P3)

A researcher can pause an ongoing training session and resume it later without losing progress. This allows for interruption-tolerant training workflows.

**Why this priority**: P3 because while useful for operational resilience, the system can function without this capability during the MVP phase. Pausing/resuming adds operational convenience but isn't essential to the core learning functionality.

**Independent Test**: Can be fully tested by pausing an active training iteration, stopping the process, resuming later, and verifying the iteration continues without data loss. Delivers training session continuity.

**Acceptance Scenarios**:

1. **Given** a training iteration is in progress, **When** the user clicks the pause button, **Then** the system saves the current state and stops further processing.
2. **Given** a paused iteration exists, **When** the user clicks resume, **Then** the system continues from where it stopped without losing any data.
3. **Given** a paused iteration has been resumed, **When** it completes, **Then** metrics are calculated and stored correctly.

---

### Edge Cases

- **EC-001**: Empty input/output fields in CSV → System MUST reject the row with error: "Row {N}: input and expected_output must be non-empty". Whitespace-only values treated as empty.
- **EC-002**: Model API failures during output generation → System MUST retry with exponential backoff (1s → 2s → 4s, max 3 retries). If all retries fail, mark iteration as failed and notify user.
- **EC-003**: Contradictory human feedback across iterations → Each iteration's metrics are calculated independently using only that iteration's human reviews. No cross-iteration comparison or consistency enforcement.
- **EC-004**: Extremely long judge prompts after refinements → No explicit limit enforced for MVP. Display prompt length in UI; defer truncation/warning to Phase 3.
- **EC-005**: 100% accuracy iteration (all identical feedback) → Training continues normally if F1 < target. Prompt refinement may have minimal failures to analyze; system handles empty FP/FN sets gracefully.
- **EC-006**: Timezone differences for timestamps → All timestamps stored in UTC (ISO 8601 with Z suffix). UI converts to user's local timezone for display using JavaScript `toLocaleString()`.
- **EC-007**: CSV upload interruption → Partial uploads rejected. System validates complete file receipt before parsing; returns error if stream interrupted mid-file.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST allow users to create a persona with task name, task description, initial task prompt, initial judge prompt, and selection of three different models: (a) Task Model (generates outputs), (b) Judge Model (evaluates outputs), and (c) Prompt Engineer Model (refines prompts). All three must be from different providers.
- **FR-002**: System MUST validate that persona names are unique within the application.
- **FR-003**: System MUST accept CSV files for training data upload with columns: input, expected_output. System MUST enforce minimum 10 pairs and maximum 200 pairs per training session.
- **FR-004**: System MUST parse and store training pairs from uploaded CSV files, validating that both input and expected_output fields are present and non-empty, and enforcing pair count constraints (10-200 pairs).
- **FR-005**: System MUST generate outputs for training pairs using the selected Task Model and current Task Prompt during each iteration.
- **FR-006**: System MUST evaluate generated outputs using the current Judge Prompt and the selected Judge Model, collecting correct/incorrect decisions from the judge with reasoning.
- **FR-007**: System MUST calculate metrics differently for iteration 1 vs iterations 2+:
  - **Iteration 1 (Human-Guided Metrics)**: System MUST wait for mandatory human review completion before calculating metrics. Metrics are derived by comparing human's Agree/Disagree votes against the judge's original decisions:
    - **Confusion Matrix**: TP = human agrees with correct decision; TN = human agrees with incorrect decision; FP = human disagrees with correct decision (judge was wrong); FN = human disagrees with incorrect decision (judge was wrong)
    - **Formulas**: F1 score, precision, recall, Cohen's Kappa, and accuracy calculated from the confusion matrix
    - **Timing**: Metrics calculation happens AFTER human review completes and is stored as iteration 1 metrics
  - **Iteration 2+ (Automatic Metrics)**: System MUST calculate metrics automatically after each iteration completes. Metrics are derived by comparing judge decisions against ground truth (expected_output from training data):
    - **Confusion Matrix**: TP = judge says correct AND suggested_output matches expected_output; TN = judge says incorrect AND suggested_output does not match expected_output; FP = judge says correct BUT suggested_output does not match expected_output; FN = judge says incorrect BUT suggested_output matches expected_output
    - **Timing**: Metrics calculation is automatic and synchronous with iteration completion
- **FR-009**:
  - **Iteration 1 (REQUIRED)**: System MUST require human reviewers to vote "Agree" or "Disagree" on ALL judge decisions and provide reasoning. Training CANNOT proceed to iteration 2 without completing human review and accepting the refined prompt.
  - **Iteration 2+ (OPTIONAL)**: System MAY allow human reviewers to vote "Agree" or "Disagree" with judge decisions for validation purposes. Human feedback is stored separately and displayed alongside automatic metrics for comparison. Human feedback is NOT required for training to proceed.
- **FR-010**:
  - **Iteration 1 (Human-Guided LLM Refinement)**: System MUST require human review of all judge decisions from iteration 1. After human completes review with Agree/Disagree votes and reasoning, system MUST use the Prompt Engineer Model to analyze human feedback patterns and generate improved Task Prompt AND Judge Prompt incorporating human insights. The refined prompts must be presented to user for acceptance before iteration 2.
  - **Iteration 2+ (LLM-Driven Refinement)**: System MUST automatically generate improved Task Prompt and Judge Prompt based on iteration failures (FP/FN cases) and current metrics, using the Prompt Engineer Model. Both prompts are refined to maximize F1 score alignment with ground truth.
- **FR-011**: System MUST persist all iteration data including generated outputs, judge decisions, optional human feedback, calculated metrics, and prompt versions (both task and judge).
- **FR-012**: System MUST display training progress dashboard showing metric trends across iterations.
- **FR-013**: System MUST indicate when F1 score ≥ target (convergence achieved) and identify the best-performing iteration (highest F1 score).
- **FR-014**: System MUST allow pausing an active training iteration and resuming it without data loss.
- **FR-015**:
  - **Iteration 1**: System MUST require mandatory human review completion and prompt refinement acceptance before proceeding to iteration 2.
  - **Iteration 2+**: System MUST support automatic iteration until the target F1 score is achieved OR max_iterations is reached, refining prompts automatically between iterations without user intervention (using Prompt Engineer Model).
- **FR-016**: System MUST store both Task Prompt and Judge Prompt versions for **significant changes only**. Significant changes are defined as text modifications that remain after whitespace normalization (collapsing multiple spaces, trimming leading/trailing whitespace, normalizing line endings to \n). Purely formatting changes (indentation, spacing) do NOT create new versions. Each iteration must be tagged with the specific prompt versions used. Examples:
  - **SIGNIFICANT**: "Evaluate correctness" → "Evaluate correctness and completeness"
  - **NOT SIGNIFICANT**: "Evaluate correctness" → "  Evaluate  correctness\n"
- **FR-017**: System MUST track which iteration achieved the best F1 score and allow users to export the best-performing Task Prompt and Judge Prompt combination.
- **FR-018**: System MUST handle API rate limits and failures gracefully during model calls using automatic retry with exponential backoff (maximum 3 retries), notifying the user if all retries are exhausted.
- **FR-019**: System MUST provide an API interface for all core functionality (create persona, upload data, start/pause/resume training, retrieve metrics, export best prompts).

### Key Entities

- **Persona**: Represents a complete training configuration. Attributes: name, task_description, initial_task_prompt, initial_judge_prompt, task_model_id, judge_model_id, prompt_engineer_model_id, target_f1_score, max_iterations, best_f1_score, best_iteration_number, created_at, status. Constraint: task_model_id, judge_model_id, and prompt_engineer_model_id must all reference different providers.
- **TrainingPair**: Represents a single input/expected_output example (ground truth). Attributes: persona_id, input, expected_output, created_at. Constraint: Persona must have 10-200 training pairs minimum/maximum per session.
- **TrainingIteration**: Represents a single training cycle with specific prompt versions. Attributes: persona_id, iteration_number, task_prompt_version_id, judge_prompt_version_id, status, started_at, completed_at.
- **TaskPromptVersion**: Represents a version of the task prompt. Attributes: persona_id, version_number, prompt_text, improvement_rationale, created_by (human/ai), created_at.
- **JudgePromptVersion**: Represents a version of the judge prompt. Attributes: persona_id, version_number, prompt_text, improvement_rationale, created_by (human/ai), created_at.
- **JudgeDecision**: Represents the judge's evaluation of a single generated output. Attributes: iteration_id, training_pair_id, suggested_output, judge_decision (correct/incorrect), judge_reasoning, judge_confidence, created_at.
- **HumanReview** (OPTIONAL): Represents optional human validation feedback. Attributes: judge_decision_id, human_decision (agree/disagree), reviewer_notes, created_at.
  - **Creation Semantics**: HumanReview records are created **ONLY when a user explicitly provides feedback** via the review interface. Records are NEVER auto-created or defaulted.
  - **Storage**: HumanReview is stored separately from automatic metrics and does NOT block training progression.
  - **Semantics**: "agree" means human affirms the judge's assessment was correct; "disagree" means human contradicts the judge's decision. This is separate from ground-truth correctness (which determines TP/TN/FP/FN).
- **IterationMetrics**: Represents automatically calculated metrics from ground truth comparison. Attributes: iteration_id, f1_score, precision, recall, cohens_kappa, accuracy, true_positives, true_negatives, false_positives, false_negatives, calculated_at. Metrics derived by comparing judge decisions against expected_output (ground truth).

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Users can create a persona and upload training data within 5 minutes of starting the process.
- **SC-002**: System calculates metrics (F1, precision, recall, Cohen's Kappa) appropriately for each phase: Iteration 1 metrics are calculated based on human's Agree/Disagree votes; Iterations 2+ metrics are calculated by comparing judge decisions against ground truth (expected_output), with calculations verifiable through confusion matrix analysis.
- **SC-003**: Training converges to F1 score ≥0.80 within 8-12 iterations on typical evaluation tasks through automatic prompt refinement.
- **SC-004**: Precision ≥0.89 and Recall ≥0.73 are achieved when F1 ≥0.80.
- **SC-005**: Cohen's Kappa ≥0.66 indicates substantial agreement between judge decisions and ground truth.
- **SC-006**: Training dashboard displays metric updates and visualizations within 2 seconds of iteration completion.
- **SC-007**: System processes training pairs and generates outputs without timeout failures on the maximum allowed batch size (200 pairs per iteration).
- **SC-008**: Iteration 1 requires mandatory human review before metrics calculation and prompt refinement; iterations 2+ complete automatically without human intervention, running from output generation → judge evaluation → metrics calculation → prompt refinement → next iteration.
- **SC-009**: Generated task and judge prompt refinements are semantically meaningful and directly address identified weaknesses from previous iteration (human feedback patterns for iteration 1; FP/FN failure patterns for iterations 2+).
- **SC-010**: System recovers from paused state without data loss, with ≥99% consistency in stored metrics across pause/resume cycles.

## Assumptions

- **A-001**: Persona creators have domain expertise to define meaningful task descriptions, initial task prompts, and initial judge prompts.
- **A-002**: Training data CSV files will be well-formed with clear input/expected_output pairs; validation catches format errors but not semantic quality issues.
- **A-003**: Model API calls (OpenAI, Anthropic, Google) are available and have sufficient rate limits for typical batch training (10-200 pairs per iteration, following the 10-200 pair constraint).
- **A-004**: Iteration 1 metrics are calculated based on human's Agree/Disagree votes (human as ground truth). Iterations 2+ metrics are calculated AUTOMATICALLY by comparing judge decisions against ground truth (expected_output from training data). Human review for iterations 2+ is OPTIONAL for validation purposes only and does not block training progress.
- **A-005**: Both the initial task prompt and initial judge prompt provide reasonable baselines; training refinement improves both prompts from these baselines.
- **A-006**: F1 score ≥0.80, precision ≥0.89, recall ≥0.73, and Cohen's Kappa ≥0.66 are achievable targets for typical evaluation tasks within 8-12 iterations through automatic prompt refinement.
- **A-007**: Training data (expected_output) represents true ground truth for the domain. Quality of training data directly impacts convergence; biased or incorrect expected_output will produce biased judges.
- **A-008**: Users will not attempt to train simultaneously on the same persona; concurrency is handled sequentially or with locks.
- **A-009**: Three different model providers (Task, Judge, Prompt Engineer) are selected to prevent bias from same model evaluating its own outputs or refining its own prompts.
- **A-010**: Cost management is out of scope for this feature. Users are responsible for monitoring API costs during training. System will not provide cost estimation or budget limiting features.
- **A-011**: Training datasets must contain minimum 10 pairs and maximum 200 pairs per session to maintain reasonable data quality and API cost constraints.
- **A-012**: Training follows a two-phase approach:
  - **Iteration 1 (Human-Guided)**: Semi-automatic workflow requiring mandatory human review: generate outputs → judge evaluation → **STOP and wait for MANDATORY human review with feedback** → **metrics calculation based on human votes** → **LLM-based refinement of both Task Prompt and Judge Prompt using Prompt Engineer Model** → user accepts refined prompts.
  - **Iteration 2+ (Fully Automatic)**: Fully automatic: generate outputs → judge evaluation → automatic metrics calculation (vs ground truth) → LLM-based prompt refinement of both prompts → next iteration. No human intervention required between iterations.
- **A-013**: MVP uses `max_iterations = 5` by default (configurable per persona, minimum 1, maximum 20 for MVP phase). This is documented in data-model.md section 1; production deployments may allow higher limits. Rationale: 5 iterations sufficient for typical 50-pair training datasets to converge; early feedback indicated 8-12 iterations average across diverse tasks; 5 is conservative MVP default.
- **A-014**: System tracks BEST performing iteration (highest F1 score) across all iterations and allows export of best task prompt + judge prompt combination for production use.
- **A-015**: Open questions from overview.md (line 445-456) are resolved as follows:
  - Cost Management (Q1): OUT OF SCOPE per spec clarification Q5; users responsible for monitoring API costs
  - Judge Prompt Templates (Q2): DEFERRED to Phase 3 (Polish)
  - Multi-Judge Ensemble (Q3): OUT OF SCOPE for MVP; potential Phase 4+ enhancement
  - Active Learning (Q4): OUT OF SCOPE for MVP; requires extensive research on intelligent sampling
  - Deployment Integration (Q5): PHASE 4 task (integrate trained personas with evaluation system)
  - Persona Drift Monitoring (Q6): PHASE 4+ capability (continuous improvement mode)
- **A-016**: CSV training data column names are flexible: parser accepts both "input"/"expected_output" (spec standard) AND "Input A"/"Correct Output" (overview.md format) for user convenience. All are normalized internally to "input"/"expected_output" in database.

## Implementation Phases

This feature is designed across four implementation phases to deliver value incrementally:

### Phase 1: Foundation (MVP)

Core system foundation enabling basic training workflow:
- Persona CRUD (create, read, update, delete) with model selection
- CSV training data upload and parsing (10-200 pair validation)
- **Iteration 1 mandatory human review workflow**: output generation → judge evaluation → STOP for mandatory human review → metrics calculation based on human votes → LLM-based refinement of both prompts (Task + Judge) using Prompt Engineer Model
- Human review interface for Agree/Disagree voting on judge decisions (REQUIRED for iteration 1 before metrics calculation)
- Metrics calculation (confusion matrix, F1, precision, recall, Cohen's Kappa) based on human votes for iteration 1
- Database schema and API endpoints for core CRUD operations
- LLM-based refinement of both prompts based on human feedback (iteration 1 only)

### Phase 2: Automation

Fully automated training loop (starting from iteration 2) with AI-assisted improvements:
- Automated training loop execution for iterations 2+ (runs iteratively until F1 ≥0.80 or max iterations)
- **Iteration 1 prerequisite**: Human review completion and prompt refinement acceptance required before automated loop begins
- Fully automated AI-assisted refinement of **both** Task Prompt and Judge Prompt using Prompt Engineer Model (iterations 2+ only; no human review required)
- Automatic metrics calculation comparing judge decisions against ground truth (expected_output from CSV)
- Real-time training progress dashboard with metric trends and convergence indicators
- Pause/resume functionality with state preservation
- Background job processing for non-blocking training execution
- WebSocket or polling updates for live iteration status
- Assumption: Full automation from iteration 2+, with graceful failure handling

### Phase 3: Polish

Advanced analytics, optimization, and user experience improvements:
- Comprehensive training reports (PDF export, metrics summary, iteration history)
- Judge prompt version diff viewer showing changes across iterations
- Persona cloning to create variants from existing trained personas
- Training data import/export in multiple formats (CSV, JSON)
- Advanced filtering and search across personas and training runs
- Performance optimizations for large datasets (edge case: approaching 200 pair limit)
- Comprehensive test coverage and documentation

### Phase 4: Integration

Integration with existing evaluation system and advanced capabilities:
- Integration with existing EvaluationTemplate system to use trained personas as judges
- A/B testing framework comparing multiple trained personas
- Continuous improvement mode (retrain personas with new data)
- Persona marketplace/sharing functionality (optional)
- Monitoring and alerting for persona drift detection over time
