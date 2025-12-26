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

### User Story 3 - Execute Automated Training Iteration (Priority: P1)

The system runs an automated training iteration that generates outputs from a model, evaluates them using the current judge prompt, collects human review feedback on the judge's decisions, and uses that feedback to calculate accuracy metrics. The iteration captures enough information to inform prompt refinement.

**Why this priority**: P1 because the core automation loop is the heart of the feature. Without executing iterations and collecting feedback, there is no learning mechanism.

**Independent Test**: Can be fully tested by running a single complete iteration from start (model generation) to finish (metrics calculation), with human feedback provided, and verifying metrics are calculated. Delivers the learning loop core functionality.

**Acceptance Scenarios**:

1. **Given** training data has been uploaded to a persona, **When** the user initiates a new training iteration, **Then** the system generates outputs for each training pair using a configured model.
2. **Given** outputs have been generated and judged, **When** the human reviewer votes "Agree" or "Disagree" with the judge's assessment (whether the suggested output was correct or incorrect), **Then** the system records their feedback.
3. **Given** human feedback has been collected for all judge decisions, **When** the iteration completes, **Then** the system calculates F1 score, precision, recall, and Cohen's Kappa metrics based on agreement/disagreement patterns.
4. **Given** metrics have been calculated, **When** the user views iteration results, **Then** all metrics are displayed clearly with the iteration number.

---

### User Story 4 - AI-Assisted Judge Prompt Refinement (Priority: P2)

After each iteration completes with human feedback, the system uses the collected feedback and metrics to generate an improved judge prompt. The user can review the suggested improvement and either accept it or provide their own refinement direction.

**Why this priority**: P2 because while critical to the automated learning loop, the training system can still function with manual prompt refinement. This feature accelerates convergence but doesn't block other functionality.

**Independent Test**: Can be fully tested by completing an iteration with feedback, receiving a refined prompt suggestion, and verifying the suggestion is based on the feedback. Delivers the AI-assisted optimization capability.

**Acceptance Scenarios**:

1. **Given** an iteration has completed with human feedback and metrics, **When** the system analyzes the feedback, **Then** it generates a suggested refined judge prompt explaining the changes made.
2. **Given** a refined prompt has been generated, **When** the user reviews it, **Then** they can accept it or provide custom feedback for further refinement.
3. **Given** a refined prompt has been accepted, **When** the next iteration runs, **Then** the new prompt is used for evaluation.

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

- What happens when a training pair has an empty input or output field?
- How does the system handle model API failures during output generation?
- What happens if human reviewer feedback is contradictory across iterations (e.g., same judge decision marked correct in iteration 1 but incorrect in iteration 2)?
- How does the system handle judge prompts that become extremely long after multiple refinements?
- What happens when all training pairs receive identical feedback across an iteration (e.g., 100% accuracy)?
- How does the system handle timezone differences when tracking iteration timestamps?
- What happens if a CSV upload is interrupted mid-stream?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST allow users to create a persona with task name, task description, initial judge prompt, and selection of three different models: (a) Task Model (generates outputs), (b) Judge Model (evaluates outputs), and (c) Prompt Engineer Model (refines judge prompt). All three must be from different providers.
- **FR-002**: System MUST validate that persona names are unique within the application.
- **FR-003**: System MUST accept CSV files for training data upload with columns: input, expected_output. System MUST enforce minimum 10 pairs and maximum 200 pairs per training session.
- **FR-004**: System MUST parse and store training pairs from uploaded CSV files, validating that both input and expected_output fields are present and non-empty, and enforcing pair count constraints (10-200 pairs).
- **FR-005**: System MUST generate outputs for training pairs using the selected Task Model during each iteration.
- **FR-006**: System MUST evaluate generated outputs using the current judge prompt and the selected Judge Model, collecting pass/fail decisions from the judge.
- **FR-007**: System MUST allow human reviewers to vote "Agree" or "Disagree" with each judge decision (whether the suggested output was correct/incorrect), recording agreement/disagreement feedback used for metric calculation. Feedback is REQUIRED on all judge decisions in an iteration before metrics can be calculated; API returns 400 Bad Request if feedback is incomplete.
- **FR-008**: System MUST calculate F1 score, precision, recall, and Cohen's Kappa metrics based on human feedback AFTER ALL DECISIONS in the iteration have been reviewed by humans. Metrics calculation is triggered only when human feedback is complete (no outstanding decisions). If any decisions lack feedback, the API returns 400 requiring completion before proceeding.
- **FR-009**: System MUST generate an improved judge prompt based on iteration feedback and current metrics, with explanation of changes made.
- **FR-010**: System MUST persist all iteration data including generated outputs, judge decisions, human feedback, and calculated metrics.
- **FR-011**: System MUST display training progress dashboard showing metric trends across iterations.
- **FR-012**: System MUST indicate when F1 score ≥0.80 (convergence achieved).
- **FR-013**: System MUST allow pausing an active training iteration and resuming it without data loss.
- **FR-014**: System MUST support iterating until the target F1 score is achieved or the user manually stops training.
- **FR-015**: System MUST store judge prompt versions for only significant changes across iterations (semantic changes, not formatting), maintaining a clear audit trail of meaningful refinements.
- **FR-016**: System MUST handle API rate limits and failures gracefully during model calls using automatic retry with exponential backoff (maximum 3 retries), notifying the user if all retries are exhausted.
- **FR-017**: System MUST provide an API interface for all core functionality (create persona, upload data, start iteration, provide feedback, retrieve metrics).

### Key Entities

- **Persona**: Represents a judge configuration with task description, initial judge prompt, and model selections. Attributes: name, task_description, initial_judge_prompt, task_model_id, judge_model_id, prompt_engineer_model_id, created_at, status. Constraint: task_model_id, judge_model_id, and prompt_engineer_model_id must all reference different providers.
- **TrainingPair**: Represents a single input/expected_output example for training. Attributes: persona_id, input, expected_output, created_at. Constraint: Persona must have 10-200 training pairs minimum/maximum per session.
- **TrainingIteration**: Represents a single training cycle. Attributes: persona_id, iteration_number, status, started_at, completed_at, judge_prompt_used.
- **JudgeDecision**: Represents the judge's evaluation of a single output. Attributes: iteration_id, training_pair_id, generated_output, judge_decision (correct/incorrect), judge_reasoning.
- **HumanReview**: Represents human feedback on judge decisions. Attributes: judge_decision_id, human_feedback (agree/disagree), reviewer_notes, created_at. Semantics: "agree" means human affirms the judge's assessment; "disagree" means human contradicts it.
- **IterationMetrics**: Represents calculated metrics for an iteration. Attributes: iteration_id, f1_score, precision, recall, cohens_kappa, calculated_at. Metrics derived from agree/disagree pattern mapped to TP/TN/FP/FN confusion matrix.
- **JudgePromptVersion**: Represents a version of the judge prompt. Attributes: persona_id, iteration_number, prompt_text, reason_for_change, created_at.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Users can create a persona and upload training data within 5 minutes of starting the process.
- **SC-002**: System accurately calculates metrics (F1, precision, recall, Cohen's Kappa) that align with human judgment calculations when verified against ground truth feedback.
- **SC-003**: Training converges to F1 score ≥0.80 within 8-12 iterations on typical evaluation tasks.
- **SC-004**: Precision ≥0.89 and Recall ≥0.73 are achieved when F1 ≥0.80.
- **SC-005**: Cohen's Kappa ≥0.66 indicates substantial agreement between judge decisions and human feedback.
- **SC-006**: Training dashboard displays metric updates and visualizations within 2 seconds of iteration completion.
- **SC-007**: System processes training pairs and generates outputs without timeout failures on the maximum allowed batch size (200 pairs per iteration).
- **SC-008**: Human reviewers can complete feedback for an iteration (50-200 judge decisions) in under 15 minutes depending on dataset size.
- **SC-009**: Generated judge prompt refinements are semantically meaningful and directly address identified weaknesses from previous iteration feedback.
- **SC-010**: System recovers from paused state without data loss, with ≥99% consistency in stored metrics across pause/resume cycles.

## Assumptions

- **A-001**: Persona creators have domain expertise to define meaningful task descriptions and initial judge prompts.
- **A-002**: Training data CSV files will be well-formed with clear input/output pairs; validation catches format errors but not semantic quality issues.
- **A-003**: Model API calls (OpenAI, Anthropic, Google) are available and have sufficient rate limits for typical batch training (10-200 pairs per iteration, following the 10-200 pair constraint).
- **A-004**: Human reviewers are available to provide feedback on judge decisions within a reasonable timeframe (not automated).
- **A-005**: The initial judge prompt provides a reasonable baseline for evaluation; training refinement improves from this baseline.
- **A-006**: F1 score ≥0.80, precision ≥0.89, recall ≥0.73, and Cohen's Kappa ≥0.66 are achievable targets for typical evaluation tasks within 8-12 iterations.
- **A-007**: Training data is representative of the domain the judge will evaluate; biased or unrepresentative data will produce biased judges.
- **A-008**: Users will not attempt to train simultaneously on the same persona; concurrency is handled sequentially or with locks.
- **A-009**: Three different model providers (Task, Judge, Prompt Engineer) are selected to prevent bias from same model evaluating its own outputs or refining its own prompts.
- **A-010**: Cost management is out of scope for this feature. Users are responsible for monitoring API costs during training. System will not provide cost estimation or budget limiting features.
- **A-011**: Training datasets must contain minimum 10 pairs and maximum 200 pairs per session to maintain reasonable data quality and API cost constraints.
- **A-012**: Human feedback must be complete (all judge decisions reviewed) before an iteration can be marked complete. Incomplete feedback is rejected with a 400 error; reviewer must provide Agree/Disagree on all decisions before proceeding to metrics calculation.
- **A-013**: MVP uses `max_iterations = 5` by default (configurable per persona, minimum 1, maximum 20 for MVP phase). This is documented in data-model.md section 1; production deployments may allow higher limits. Rationale: 5 iterations sufficient for typical 50-pair training datasets to converge; early feedback indicated 8-12 iterations average across diverse tasks; 5 is conservative MVP default.
- **A-014**: Batch human review actions ("Agree with All", "Review Later", "Skip to Next") described in original overview.md are Phase 2+ enhancements. MVP Phase 1 focuses on individual decision review with Previous/Next navigation. Batch actions will be added in Phase 2 automation to reduce review friction for large iteration sets (50-200 decisions).
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
- Manual training iteration trigger with output generation and judge evaluation
- Human review interface for Agree/Disagree voting on judge decisions
- Metrics calculation (confusion matrix, F1, precision, recall, Cohen's Kappa)
- Database schema and API endpoints for core CRUD operations
- Assumption: Training loop runs synchronously or with basic queueing (not fully automated)

### Phase 2: Automation

Fully automated training loop with AI-assisted improvements:
- Automated training loop execution (runs iteratively until F1 ≥0.80 or max iterations)
- AI-assisted judge prompt refinement using Prompt Engineer Model
- Real-time training progress dashboard with metric trends and convergence indicators
- Pause/resume functionality with state preservation
- Background job processing for non-blocking training execution
- WebSocket or polling updates for live iteration status
- Assumption: Full automation with graceful failure handling

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
