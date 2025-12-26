# Feature Requirements: Persona (LLM as a Judge)

## Overview

**Persona** is a new feature that implements LLM-as-a-Judge methodology to evaluate non-deterministic LLM outputs. It enables iterative training of an AI judge through human feedback, automatically refining the judge's evaluation prompt until it achieves >80% F1 score alignment with human judgment.

**Reference Articles:**

- https://www.evidentlyai.com/llm-guide/llm-as-a-judge
- https://newsletter.pragmaticengineer.com/p/evals
- https://hamel.dev/blog/posts/llm-judge/
- https://github.com/meshkovQA/Eval-ai-library

---

## User Flow

### 1. Persona Creation

- User navigates to new **"Personas"** screen
- User creates a new persona with:
  - **Name**: Descriptive name for the persona (e.g., "Customer Service Evaluator")
  - **Description**: What this persona evaluates and its purpose
  - **Task Prompt**: The prompt used by Prompt+LLM to generate outputs from inputs
  - **Initial Judge Prompt**: Initial evaluation criteria/instructions for the judge LLM
  - **Judge Model Selection**: Choose which LLM provider/model to use as judge (must be different from task LLM)
  - **Prompt Engineer Model**: Select LLM to use for AI-assisted judge prompt updates

### 2. Training Dataset Upload

- User uploads CSV file with training data containing:
  - **Input A**: The task input (e.g., customer query, problem statement)
  - **Correct Output**: Expected/reference answer (ground truth)
  - **Input B** (optional): Alternative input for generating suggested output
- CSV format example:
  ```csv
  input,correct_output
  "What is the refund policy?","Full refund within 30 days with receipt"
  "How do I reset my password?","Click 'Forgot Password' on login page"
  ```
- System validates CSV structure and stores training pairs

### 3. Automated Training Process

The system automatically executes iterative training:

#### Iteration Loop (until F1 > 80% OR max iterations reached):

**Step 1: Generate Outputs**

- For each training pair, use Task Prompt + Task LLM to generate "Suggested Output" from Input A

**Step 2: Judge Evaluation**

- Judge LLM evaluates: "Given task {input} and correct output {correct_output}, is {suggested_output} correct?"
- Judge returns binary decision: **Correct** or **Incorrect**
- Store judge decisions for all training pairs

**Step 3: Human Review**

- Present judge decisions to human evaluator
- Human provides binary feedback: **Agree** or **Disagree** with judge
- System calculates confusion matrix:
  - **TP (True Positive)**: Judge says Correct, Human agrees
  - **TN (True Negative)**: Judge says Incorrect, Human agrees
  - **FP (False Positive)**: Judge says Correct, Human disagrees
  - **FN (False Negative)**: Judge says Incorrect, Human disagrees

**Step 4: Calculate Metrics**

- **Precision** = TP / (TP + FP)
- **Recall** = TP / (TP + FN)
- **F1 Score** = 2 × (Precision × Recall) / (Precision + Recall)
- **Cohen's κ** (Kappa) = Inter-rater agreement metric
- **Accuracy** = (TP + TN) / (TP + TN + FP + FN)

**Step 5: Check Convergence**

- If **F1 ≥ 0.80**: Training complete, persona is ready
- If **iterations ≥ max_iterations** (default: 20): Training stopped, mark as incomplete
- Otherwise, continue to Step 6

**Step 6: AI-Assisted Judge Prompt Update**

- Prompt Engineer LLM analyzes:
  - Current judge prompt
  - Judge performance metrics (confusion matrix, F1, precision, recall)
  - Cases where judge failed (FP and FN examples)
  - Human feedback patterns
- Generates improved judge prompt addressing weaknesses
- Store new judge prompt version
- Continue to next iteration (Step 1)

### 4. Training Visualization

User can view real-time training progress:

- Current iteration number (e.g., "Iteration 5/20")
- Live metrics dashboard:
  - F1 Score (target: ≥0.80)
  - Precision, Recall
  - Cohen's Kappa
  - Confusion Matrix (TP, TN, FP, FN)
- Judge prompt version history
- Performance trend chart across iterations

### 5. Persona Usage

Once trained (F1 ≥ 0.80):

- Persona is marked as **"Trained"** and reusable
- Can be selected as judge in regular evaluation runs
- Applied to new evaluation tasks matching the persona's domain

---

## Features

### Persona Management

- **CRUD Operations**: Create, Read, Update, Delete personas
- **Status Tracking**:
  - `draft`: Created but not trained
  - `training`: Currently in training iteration
  - `trained`: F1 ≥ 80%, ready for use
  - `incomplete`: Max iterations reached without hitting F1 target
- **Versioning**: Track judge prompt versions across iterations
- **Cloning**: Duplicate existing personas to create variants

### Training Configuration

- **Max Iterations**: Default 20, user-configurable
- **Target F1 Score**: Default 0.80, user-configurable (0.70-0.95 range)
- **Model Selection**:
  - Judge Model: Choose from configured providers (OpenAI/Anthropic/Google)
  - Prompt Engineer Model: Choose model for prompt optimization
  - Task Model: Model used to generate outputs (must differ from Judge Model)
- **Pause/Resume**: Allow pausing training and resuming later

### Human Review Interface

- **Batch Review**: Review all judge decisions for current iteration
- **Case Details**: View input, correct output, suggested output, judge decision, judge reasoning
- **Binary Feedback**: Simple Agree/Disagree buttons
- **Notes**: Optional text field for human to explain disagreement
- **Progress Tracking**: Show X/Y cases reviewed

### Analytics & Reporting

- **Training Report**: Comprehensive report per persona including:
  - Final metrics (F1, Precision, Recall, Kappa)
  - Iteration count to convergence
  - Judge prompt evolution
  - Example cases (best/worst judge decisions)
- **Export**: Download training data and results as CSV/JSON
- **Comparison**: Compare multiple persona training runs

---

## Technical Requirements

### Database Schema

#### New Tables

**personas**

```sql
CREATE TABLE personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  task_prompt TEXT NOT NULL,
  judge_model_id INTEGER NOT NULL,
  prompt_engineer_model_id INTEGER NOT NULL,
  task_model_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft', 'training', 'trained', 'incomplete')),
  target_f1 REAL NOT NULL DEFAULT 0.80,
  max_iterations INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (judge_model_id) REFERENCES ModelConfiguration(id),
  FOREIGN KEY (prompt_engineer_model_id) REFERENCES ModelConfiguration(id),
  FOREIGN KEY (task_model_id) REFERENCES ModelConfiguration(id)
);
```

**training_pairs**

```sql
CREATE TABLE training_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL,
  input TEXT NOT NULL,
  correct_output TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
);
```

**training_iterations**

```sql
CREATE TABLE training_iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL,
  iteration_number INTEGER NOT NULL,
  judge_prompt TEXT NOT NULL,
  judge_prompt_version INTEGER NOT NULL,
  precision REAL,
  recall REAL,
  f1_score REAL,
  cohens_kappa REAL,
  accuracy REAL,
  tp INTEGER NOT NULL DEFAULT 0,
  tn INTEGER NOT NULL DEFAULT 0,
  fp INTEGER NOT NULL DEFAULT 0,
  fn INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  UNIQUE(persona_id, iteration_number)
);
```

**judge_decisions**

```sql
CREATE TABLE judge_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  iteration_id INTEGER NOT NULL,
  training_pair_id INTEGER NOT NULL,
  suggested_output TEXT NOT NULL,
  judge_decision TEXT NOT NULL CHECK(judge_decision IN ('correct', 'incorrect')),
  judge_reasoning TEXT,
  human_feedback TEXT CHECK(human_feedback IN ('agree', 'disagree', NULL)),
  human_notes TEXT,
  confusion_category TEXT CHECK(confusion_category IN ('tp', 'tn', 'fp', 'fn', NULL)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (iteration_id) REFERENCES training_iterations(id) ON DELETE CASCADE,
  FOREIGN KEY (training_pair_id) REFERENCES training_pairs(id) ON DELETE CASCADE
);
```

**judge_prompt_versions**

```sql
CREATE TABLE judge_prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  improvement_rationale TEXT,
  created_by TEXT NOT NULL CHECK(created_by IN ('human', 'ai')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
  UNIQUE(persona_id, version)
);
```

### API Endpoints

**Persona CRUD**

- `POST /api/personas` - Create new persona
- `GET /api/personas` - List all personas
- `GET /api/personas/:id` - Get persona details
- `PUT /api/personas/:id` - Update persona
- `DELETE /api/personas/:id` - Delete persona

**Training**

- `POST /api/personas/:id/training-pairs/upload` - Upload CSV training data
- `POST /api/personas/:id/training/start` - Start training process
- `POST /api/personas/:id/training/pause` - Pause training
- `POST /api/personas/:id/training/resume` - Resume training
- `GET /api/personas/:id/training/status` - Get current training status

**Human Review**

- `GET /api/personas/:id/iterations/:iteration/decisions` - Get decisions for review
- `POST /api/personas/:id/iterations/:iteration/decisions/:decisionId/feedback` - Submit human feedback

**Analytics**

- `GET /api/personas/:id/metrics` - Get persona training metrics
- `GET /api/personas/:id/iterations` - Get all iteration history
- `GET /api/personas/:id/report` - Generate comprehensive training report
- `GET /api/personas/:id/export` - Export training data

### Core Logic

**New modules in `src/lib/`:**

**persona-trainer.ts**

- `startTraining(personaId)`: Orchestrates training loop
- `runIteration(personaId, iteration)`: Execute single iteration
- `generateOutputs(pairs, taskPrompt, taskModel)`: Generate suggested outputs
- `judgeOutputs(pairs, outputs, judgePrompt, judgeModel)`: Run judge evaluation
- `calculateMetrics(decisions, humanFeedback)`: Compute confusion matrix and metrics
- `updateJudgePrompt(personaId, metrics, failures)`: AI-assisted prompt improvement
- `checkConvergence(f1Score, iteration, maxIterations)`: Determine if training complete

**persona-judge.ts**

- `evaluateOutput(input, correctOutput, suggestedOutput, judgePrompt, judgeModel)`: Single judge evaluation
- `parseJudgeResponse(response)`: Extract decision and reasoning from judge LLM
- `formatJudgePrompt(input, correctOutput, suggestedOutput, criteria)`: Build judge prompt

**persona-db.ts**

- Database access layer for persona-related tables
- CRUD operations for personas, training pairs, iterations, decisions

### Background Jobs

- Training process runs as async background job (using Node.js worker threads or queue)
- Emit progress events for UI updates
- Handle pausing/resuming gracefully
- Timeout protection per iteration (e.g., 5 minutes)

---

## UI/UX Requirements

### New Pages

**1. Personas List Page** (`/personas`)

- Table view of all personas
- Columns: Name, Description, Status, F1 Score, Created Date, Actions
- Filter by status (draft/training/trained/incomplete)
- Search by name
- "Create New Persona" button

**2. Persona Detail Page** (`/personas/:id`)

- Tabs:
  - **Overview**: Name, description, status, models, configuration
  - **Training Data**: List/preview uploaded training pairs
  - **Training Progress**: Metrics dashboard, iteration history
  - **Judge Prompts**: Version history with diff view
  - **Settings**: Edit configuration (max iterations, target F1, models)
- Actions: Start/Pause/Resume Training, Delete, Export

**3. Human Review Page** (`/personas/:id/review/:iteration`)

- Split view:
  - Left: Decision details (input, correct output, suggested output, judge decision)
  - Right: Human feedback (Agree/Disagree buttons, notes textarea)
- Progress bar: "Reviewed X of Y decisions"
- Navigation: Previous/Next buttons
- Batch actions: "Agree with All", "Review Later"

**4. Training Dashboard** (embedded in Persona Detail)

- Real-time metrics cards:
  - F1 Score (with target line at 0.80)
  - Precision / Recall
  - Cohen's Kappa
  - Confusion Matrix (TP/TN/FP/FN)
- Line chart: F1/Precision/Recall across iterations
- Current iteration status: "Running Iteration 5/20"
- Live log of training events

### UI Components

- **PersonaCard**: Summary card for persona list
- **MetricCard**: Display single metric with trend indicator
- **ConfusionMatrix**: Visual 2x2 grid showing TP/TN/FP/FN
- **PromptDiffViewer**: Side-by-side diff of judge prompt versions
- **CSVUploader**: Drag-drop CSV upload with validation
- **TrainingProgressBar**: Visual progress through iterations

---

## Success Metrics

### Target Benchmarks (from evidentlyai.com article)

Based on industry standards for LLM judges:

- **Recall**: ≥0.73
- **Precision**: ≥0.89
- **F1 Score**: ≥0.80 (primary success metric)
- **Cohen's Kappa**: ≥0.66 (substantial agreement)

### Confusion Matrix Example

For a well-trained persona:

- TP (True Positive): 8+
- TN (True Negative): 12+
- FP (False Positive): ≤1
- FN (False Negative): ≤3

### User Experience Goals

- **Time to First Trained Persona**: <30 minutes (including CSV prep and human review)
- **Average Iterations to Convergence**: 8-12 iterations
- **Human Review Time per Decision**: <15 seconds
- **Training Success Rate**: >80% of personas reach F1 ≥ 0.80 within 20 iterations

---

## Implementation Phases

### Phase 1: Foundation (MVP)

- Database schema and migrations
- Persona CRUD API and UI
- CSV upload for training pairs
- Basic training loop (manual iteration trigger)
- Human review interface
- Metrics calculation

### Phase 2: Automation

- Fully automated training loop
- AI-assisted judge prompt updates
- Real-time progress dashboard
- Pause/resume functionality
- Background job processing

### Phase 3: Polish

- Advanced analytics and reporting
- Prompt version diff viewer
- Export/import personas
- Persona cloning
- Performance optimizations
- Comprehensive testing

### Phase 4: Integration

- Use trained personas in regular evaluations
- Persona marketplace/sharing (optional)
- A/B testing between personas
- Continuous improvement mode (retrain with new data)

---

## Open Questions & Considerations

1. **Cost Management**: Training can be expensive with multiple iterations. Should we add cost estimation and limits?

2. **Judge Prompt Templates**: Should we provide starter templates for common use cases (content evaluation, code review, customer service)?

3. **Multi-Judge Ensemble**: Should we support multiple judges voting for higher accuracy?

4. **Active Learning**: Should the system intelligently select which examples to show humans (prioritize uncertain cases)?

5. **Deployment**: Once trained, how do we deploy personas to production evaluations? Integration with existing evaluation templates?

6. **Monitoring**: Should trained personas be re-evaluated periodically to detect drift?

---

## Risks & Mitigations

| Risk                                     | Impact | Mitigation                                                                       |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Training never converges (F1 < 80%)      | High   | Max iterations limit, suggest manual prompt editing, provide diagnostic insights |
| High API costs during training           | Medium | Cost estimation upfront, iteration limits, batch processing optimizations        |
| Judge prompt degradation over iterations | Medium | Version control, allow rollback to previous versions, human approval option      |
| Poor quality training data               | High   | CSV validation, sample preview, suggested minimum dataset size (20+ pairs)       |
| Human review fatigue                     | Medium | Batch review UI, smart sampling (prioritize unclear cases), progress saving      |

---

## Next Steps

1. Review and approve requirements
2. Create detailed technical design document
3. Database schema implementation
4. API endpoint development
5. UI/UX mockups and prototypes
6. Core training logic implementation
7. Integration testing
8. Documentation and user guide

---

**Estimated Effort**: 3-4 weeks for Phase 1 MVP, 6-8 weeks for complete feature with all phases

**Dependencies**:

- Existing model configuration system
- API client abstractions (OpenAI/Anthropic/Google)
- Database infrastructure
