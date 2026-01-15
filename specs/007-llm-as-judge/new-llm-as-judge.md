# Plan: Redesign Training Progress Screen (User-Controlled Workflow)

## Overview

Redesign the LLM-as-a-Judge training system from an **automatic iteration-based workflow** to a **user-controlled version-based workflow** inspired by OpenAI Evals. Remove automatic iteration loops and give users explicit control over when to generate outputs, run judge evaluations, and optimize prompts.

## Key Changes Summary

### From (Current State)
- Automatic iteration loop (iteration 1, 2, 3...)
- Two-phase workflow (iteration 1 human-guided, 2+ automated)
- Automatic convergence checking (F1 ≥ 0.80)
- Complex metrics (confusion matrix, F1, precision, recall, Cohen's Kappa)
- Agree/Disagree feedback on judge decisions
- Pause/resume/checkpoint system
- Training loop orchestration with automatic prompt refinement

### To (Target State)
- Version-based workflow (task prompt v1, v2, v3 / judge prompt v1, v2, v3)
- User-controlled actions (manual triggers for all operations)
- Simple pass/fail percentage metrics
- Pass/Fail feedback on outputs directly
- No automatic iteration
- Single unified table view (input, expected_output, generated_output, rating, feedback, grader)
- Manual prompt optimization triggers
- **New: "Live Playground"** for instant row-level testing
- **New: "Training Trajectory"** sparklines to visualize progress
- **New: Side-by-side Output Diffing** to compare results across versions

## User Workflow

### New User Journey

1. **Create Persona** → Configure task prompt, judge prompt, models
2. **Upload Training Data** → CSV with input/expected_output pairs
3. **Playground Testing** (Optional) → Test prompts on single rows instantly
4. **Generate Outputs** → Click "Generate Outputs" → Task model creates generated_output for all pairs
   - Auto-creates new task prompt version if prompt was edited
5. **Run Judge** → Click "Run Judge on All" or "Evaluate Selected Rows"
   - Judge evaluates outputs, assigns Pass/Fail
   - Auto-creates new judge prompt version if prompt was edited
6. **Human Review** → Click Pass/Fail on each row, add feedback notes
7. **Optimize Prompts** → Click "Optimize Task Prompt" or "Optimize Judge Prompt"
   - LLM analyzes Pass/Fail feedback and reasoning
   - Suggests improved prompt based on failures
   - User reviews and accepts/edits suggestion
   - Creates new prompt version

## Data Model Changes

### Tables to Modify

#### `personas` table
**Remove:**
- `current_iteration` (no more iterations)
- `best_f1_iteration` (no F1 tracking)
- `best_f1_score` (simplified metrics)
- `max_iterations` (no iteration limit)
- `status` values: 'awaiting_human_review' (deprecated)

**Keep:**
- `name`, `description`, `task_prompt`, model IDs
- `status`: 'draft', 'training', 'trained'
- `target_f1_score` → rename to `target_pass_rate` (0.0-1.0)

#### `training_iterations` table
**Deprecate entirely** - Replace with simpler tracking

#### New: `evaluation_runs` table
```sql
CREATE TABLE evaluation_runs (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  run_type TEXT CHECK(run_type IN ('task_generation', 'judge_evaluation')),
  task_prompt_version_id TEXT,
  judge_prompt_version_id TEXT,
  pairs_processed INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('in_progress', 'completed', 'failed')),
  created_at TEXT,
  completed_at TEXT
)
```

#### `task_prompt_versions` table
**Modify:**
- Remove `iteration_number` (no more iterations)
- Add `version_number` (auto-increment per persona)
- Keep `prompt_text`, `improvement_rationale`, `created_by`, `created_at`

**Versioning Logic:**
- Auto-create version when user edits prompt text and triggers action
- Version number increments: v1, v2, v3...

#### `judge_prompt_versions` table
Same changes as `task_prompt_versions`

#### `judge_decisions` table
**Modify:**
- Remove `iteration_id` foreign key
- Add `evaluation_run_id` foreign key
- Change `judge_decision` from 'agree'/'disagree' to 'pass'/'fail'
- Rename to `judge_evaluations`

#### `human_reviews` table
**Modify:**
- Rename to `human_feedback`
- Change `human_decision` from 'agree'/'disagree' to 'pass'/'fail'
- Add `feedback_text` (user's reasoning for pass/fail)
- Remove `judge_decision_id` FK (direct link to training_pair)

#### New: `training_pair_results` table
```sql
CREATE TABLE training_pair_results (
  id TEXT PRIMARY KEY,
  training_pair_id TEXT NOT NULL,
  task_prompt_version_id TEXT,
  judge_prompt_version_id TEXT,
  generated_output TEXT,
  judge_rating TEXT CHECK(judge_rating IN ('pass', 'fail', NULL)),
  judge_feedback TEXT,
  human_rating TEXT CHECK(human_rating IN ('pass', 'fail', NULL)),
  human_feedback TEXT,
  created_at TEXT,
  updated_at TEXT
)
```

#### `iteration_metrics` table
**Simplify to:** `persona_metrics`
```sql
CREATE TABLE persona_metrics (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  task_prompt_version_id TEXT,
  judge_prompt_version_id TEXT,
  total_pairs INTEGER,
  judge_pass_count INTEGER,
  judge_fail_count INTEGER,
  human_pass_count INTEGER,
  human_fail_count INTEGER,
  pass_rate REAL, -- percentage
  calculated_at TEXT
)
```

### Tables to Deprecate (Move to deprecated folder)

- `training_iterations`
- `training_loop_state`
- `training_loop_checkpoints`
- `iteration_metrics`

## File Structure Changes

### Files to Move to `src/lib/training/deprecated/`

1. **`training-loop.ts`** - Automatic iteration orchestration
2. **`training-state.ts`** - Checkpoint/pause/resume logic
3. **`training-errors.ts`** (if only used by loop) - Training-specific errors

### New Files to Create

#### Logic Layer (`src/lib/training/`)

1. **`version-manager.ts`**
   - `createTaskPromptVersion(personaId, promptText, rationale)`
   - `createJudgePromptVersion(personaId, promptText, rationale)`
   - `getLatestTaskPromptVersion(personaId)`
   - `getLatestJudgePromptVersion(personaId)`
   - `listTaskPromptVersions(personaId)`
   - `listJudgePromptVersions(personaId)`

2. **`task-generator.ts`**
   - `generateOutputsForPairs(personaId, taskPromptVersionId, trainingPairIds?)`
   - Calls task model API
   - Stores results in `training_pair_results`
   - Returns evaluation_run_id

3. **`judge-runner.ts`**
   - `evaluatePairs(personaId, judgePromptVersionId, trainingPairIds?)`
   - Calls judge model API
   - Updates `training_pair_results` with judge rating/feedback
   - Returns evaluation_run_id

4. **`prompt-optimizer.ts`**
   - `optimizeTaskPrompt(personaId, feedbackContext)`
   - `optimizeJudgePrompt(personaId, feedbackContext)`
   - Analyzes failures (Pass/Fail feedback)
   - Calls Prompt Engineer LLM
   - Returns suggested prompt improvement

5. **`metrics-calculator.ts`** (simplified)
   - `calculatePassRate(personaId)`
   - Just counts pass/fail percentages
   - No confusion matrix, F1, precision, recall, Cohen's Kappa

#### API Endpoints (`src/pages/api/personas/[id]/`)

1. **`task/generate.ts`** (POST)
   - Triggers task output generation
   - Optional: `pair_ids` to generate for specific pairs
   - Creates task prompt version if prompt changed

2. **`judge/evaluate.ts`** (POST)
   - Triggers judge evaluation
   - Optional: `pair_ids` to evaluate specific pairs
   - Creates judge prompt version if prompt changed

3. **`prompts/task/versions.ts`** (GET, POST)
   - GET: List all task prompt versions
   - POST: Create new task prompt version manually

4. **`prompts/judge/versions.ts`** (GET, POST)
   - GET: List all judge prompt versions
   - POST: Create new judge prompt version manually

5. **`prompts/optimize-task.ts`** (POST)
   - Analyzes failures and suggests task prompt improvement
   - Returns suggested prompt text + rationale

6. **`prompts/optimize-judge.ts`** (POST)
   - Analyzes failures and suggests judge prompt improvement
   - Returns suggested prompt text + rationale

7. **`feedback.ts`** (POST, PUT)
   - Submit human Pass/Fail feedback for a training pair
   - Updates `human_feedback` table

8. **`metrics.ts`** (GET)
   - Returns simple pass/fail percentages
   - No complex metrics

#### UI Components (`src/components/training/`)

1. **`TrainingWorkspace.astro`** (Main redesigned view)
   - Left panel: Task Prompt editor with version selector
   - Right panel: Training pairs table
   - Action buttons: Generate, Evaluate, Optimize

2. **`PromptEditor.astro`**
   - Editable textarea for prompt
   - Version selector dropdown (v1, v2, v3...)
   - "Optimize" button
   - Version history viewer

3. **`TrainingPairsTable.astro`**
   - Columns: input, expected_output, generated_output, rating, feedback, grader
   - Inline Pass/Fail buttons per row
   - Checkbox selection for batch operations
   - "Run Judge on All" / "Evaluate Selected" buttons
   - **New**: "Play" button for Live Playground

4. **`PassFailBadge.astro`**
   - Visual badge component (green Pass / red Fail)

5. **`OptimizationSuggestion.astro`**
   - Modal/panel showing LLM's suggested prompt improvement
   - Before/after diff view
   - Accept/Edit/Reject buttons

6. **`SimpleMetrics.astro`**
   - Shows: Total pairs, Pass count, Fail count, Pass rate %
   - Judge stats vs Human stats
   - **New**: Sparkline charts for historical trends

7. **`PlaygroundModal.astro`** (New)
   - Modal for "Live Playground" execution
   - Split view: Input -> Streamed Output / Judge Decision

#### Pages (`src/pages/personas/[id]/`)

1. **`workspace.astro`** (New main training page)
   - Replaces old training/metrics/review pages
   - Single unified view with TrainingWorkspace component
   - Left: Prompt management
   - Right: Data table

2. **Deprecate:**
   - `training.astro` → redirect to workspace
   - `review/[iteration].astro` → no more iteration-based review
   - `metrics.astro` → simplified metrics in workspace

## UI/UX Design Specification

### Layout (workspace.astro)

```
┌─────────────────────────────────────────────────────────────┐
│ Persona: [Name]                    [Generate] [Evaluate All]│
├──────────────────┬──────────────────────────────────────────┤
│ TASK PROMPT      │ DASHBOARD [F1: 0.85 📈] [Pass: 90% 📈]   │
│                  │                                            │
│ [Version v3 ▼]   │ ☑ Select All  [Evaluate Selected]        │
│ ┌──────────────┐ │ ┌────────────────────────────────────────┤
│ │              │ │ │Input│Expected│Generated│Rating│Actions │
│ │ (editable)   │ │ ├─────┼────────┼─────────┼──────┼────────┤
│ │              │ │ │☐ ... │  ...   │   ...   │ Pass │ [▶]    │
│ │              │ │ │☐ ... │  ...   │   ...   │ Fail │ [▶]    │
│ └──────────────┘ │ └────────────────────────────────────────┘
│ [Optimize ✨]    │                                            │
│ [View History]   │                                            │
│                  │                                            │
│ JUDGE PROMPT     │                                            │
│ [Version v2 ▼]   │                                            │
│ ┌──────────────┐ │                                            │
│ │              │ │                                            │
│ │ (editable)   │ │                                            │
│ │              │ │                                            │
│ └──────────────┘ │                                            │
│ [Optimize ✨]    │                                            │
│ [View History]   │                                            │
└──────────────────┴──────────────────────────────────────────┘
```

### User Actions Flow

#### Generate Outputs
1. User edits task prompt (or keeps current)
2. Clicks "Generate Outputs" button
3. System checks if prompt changed → creates new version if yes
4. Task model generates outputs for all pairs (or selected)
5. Table updates with generated_output column filled
6. Status: "Generated 50 outputs with Task Prompt v3"

#### Live Playground (New)
1. User clicks "Play" [▶] button on a specific row
2. Modal opens showing "Input", "Task Prompt", "Judge Prompt"
3. "Executing..." spinner appears
4. Output streams in real-time
5. Judge evaluates immediately
6. User can tweak prompt *inside* the playground for instant feedback

#### Evaluate with Judge
1. User edits judge prompt (or keeps current)
2. Clicks "Run Judge on All" or selects rows + "Evaluate Selected"
3. System checks if prompt changed → creates new version if yes
4. Judge model evaluates outputs, assigns Pass/Fail + feedback
5. Table updates with rating badges and judge feedback
6. Status: "Evaluated 50 pairs with Judge Prompt v2"

#### Human Feedback
1. User clicks Pass/Fail inline buttons on each row
2. Optional: adds feedback text
3. System saves to `human_feedback` table
4. Metrics update in real-time

#### Optimize Prompts
1. User clicks "Optimize Task Prompt" or "Optimize Judge Prompt"
2. System analyzes all Pass/Fail feedback (judge + human)
3. LLM generates improved prompt suggestion
4. Modal shows before/after diff
5. User can:
   - Accept → creates new version, loads into editor
   - Edit → modify suggestion, then save as new version
   - Reject → close modal

## Implementation Phases

### Phase 1: Data Model & Migration (Critical Foundation)
**Files:**
- Create migration script `db/migrations/007-redesign-training.sql`
- Update `src/lib/db/persona-db.ts` with new schema functions
- Create `src/lib/training/version-manager.ts`
- Move deprecated files to `src/lib/training/deprecated/`

**Tasks:**
1. Create new tables: `evaluation_runs`, `training_pair_results`, `persona_metrics`
2. Modify existing: `personas`, `task_prompt_versions`, `judge_prompt_versions`
3. Create migration to convert existing data (iteration → version mapping)
4. Update TypeScript types in `src/types/training.ts`
5. Write DB access functions for version management

### Phase 2: Core Logic Implementation
**Files:**
- `src/lib/training/task-generator.ts`
- `src/lib/training/judge-runner.ts`
- `src/lib/training/prompt-optimizer.ts`
- `src/lib/training/metrics-calculator.ts`

**Tasks:**
1. Implement task output generation (with version auto-creation)
2. Implement judge evaluation (with version auto-creation)
3. Implement LLM-based prompt optimization
4. Implement simplified metrics calculation (pass/fail %)
5. Add error handling and logging

### Phase 3: API Endpoints
**Files:**
- `src/pages/api/personas/[id]/task/generate.ts`
- `src/pages/api/personas/[id]/judge/evaluate.ts`
- `src/pages/api/personas/[id]/prompts/task/versions.ts`
- `src/pages/api/personas/[id]/prompts/judge/versions.ts`
- `src/pages/api/personas/[id]/prompts/optimize-task.ts`
- `src/pages/api/personas/[id]/prompts/optimize-judge.ts`
- `src/pages/api/personas/[id]/feedback.ts`
- `src/pages/api/personas/[id]/metrics.ts`

**Tasks:**
1. Create all new API routes
2. Add request validation
3. Add error responses
4. Test with API client (Postman/Bruno)

### Phase 4: UI Components
**Files:**
- `src/components/training/PromptEditor.astro`
- `src/components/training/TrainingPairsTable.astro`
- `src/components/training/PassFailBadge.astro`
- `src/components/training/OptimizationSuggestion.astro`
- `src/components/training/SimpleMetrics.astro`
- `src/components/training/VersionSelector.astro`

**Tasks:**
1. Build PromptEditor with version selector
2. Build unified TrainingPairsTable with all columns
3. Create PassFailBadge component
4. Create OptimizationSuggestion modal
5. Create SimpleMetrics display
6. Add loading states and error handling

### Phase 5: Main Workspace Page
**Files:**
- `src/pages/personas/[id]/workspace.astro`
- `src/components/training/TrainingWorkspace.astro`

**Tasks:**
1. Create TrainingWorkspace layout component (left/right split)
2. Create workspace page with state management
3. Wire up all actions (generate, evaluate, optimize)
4. Add real-time updates (SSE or polling)
5. Implement row selection for batch operations

### Phase 6: Deprecation & Cleanup
**Files:**
- Update navigation to remove old pages
- Add redirects from old URLs
- Update tests

**Tasks:**
1. Redirect `/personas/[id]/training` → `/personas/[id]/workspace`
2. Redirect `/personas/[id]/metrics` → `/personas/[id]/workspace`
3. Remove iteration-based review URLs
4. Update PersonaTabs component
5. Archive old E2E tests, create new workspace tests

### Phase 7: Testing & Polish
**Files:**
- `tests/unit/version-manager.test.ts`
- `tests/integration/task-generation.test.ts`
- `tests/integration/judge-evaluation.test.ts`
- `tests/e2e/training-workspace.test.ts`

**Tasks:**
1. Unit tests for version management
2. Integration tests for task/judge operations
3. E2E test for full user workflow
4. Load testing for large datasets
5. Polish UI animations and transitions

### Phase 8: Interactive Enhancements (New)
**Files:**
- `src/components/training/PlaygroundModal.astro`
- `src/components/training/Sparkline.astro`
- `src/components/training/OutputDiffViewer.astro`

**Tasks:**
1. **Live Playground**: Implement `PlaygroundModal.astro` for single-row testing.
2. **Sparklines**: Add SVG sparklines to `SimpleMetrics.astro` to visualize F1/Pass Rate trends.
3. **Output Diffing**: Create `OutputDiffViewer.astro` to compare generated outputs side-by-side between versions.

## Critical Files to Modify

### Database
- `db/schema.sql` - Add new tables, modify existing
- `db/migrations/007-redesign-training.sql` - Migration script

### Types
- `src/types/training.ts` - Update all type definitions

### Logic
- `src/lib/db/persona-db.ts` - Database access layer
- `src/lib/training/version-manager.ts` - NEW
- `src/lib/training/task-generator.ts` - NEW
- `src/lib/training/judge-runner.ts` - NEW
- `src/lib/training/prompt-optimizer.ts` - NEW
- `src/lib/training/metrics-calculator.ts` - NEW (simplified)

### API
- `src/pages/api/personas/[id]/task/generate.ts` - NEW
- `src/pages/api/personas/[id]/judge/evaluate.ts` - NEW
- `src/pages/api/personas/[id]/prompts/*/versions.ts` - NEW
- `src/pages/api/personas/[id]/prompts/optimize-*.ts` - NEW

### UI
- `src/pages/personas/[id]/workspace.astro` - NEW (main page)
- `src/components/training/TrainingWorkspace.astro` - NEW
- `src/components/training/PromptEditor.astro` - NEW
- `src/components/training/TrainingPairsTable.astro` - NEW
- `src/components/training/PassFailBadge.astro` - NEW
- `src/components/training/OptimizationSuggestion.astro` - NEW
- `src/components/training/SimpleMetrics.astro` - NEW
- `src/components/training/PlaygroundModal.astro` - NEW
- `src/components/training/Sparkline.astro` - NEW
- `src/components/training/OutputDiffViewer.astro` - NEW

### Deprecated (Move to `src/lib/training/deprecated/`)
- `src/lib/training/training-loop.ts`
- `src/lib/training/training-state.ts`
- `src/lib/training/training-errors.ts` (if iteration-specific)

## Migration Strategy

### Data Migration Plan

**Convert Existing Data:**
1. Map `training_iterations.iteration_number` → `task_prompt_versions.version_number`
2. Map `training_iterations.iteration_number` → `judge_prompt_versions.version_number`
3. Convert `judge_decisions` → `training_pair_results` (one result per pair)
4. Convert `human_reviews.human_decision` ('agree'/'disagree') → `human_feedback.human_rating` ('pass'/'fail')
   - Map logic: agree → pass, disagree → fail
5. Archive old `iteration_metrics` data (export to JSON backup)

**Backward Compatibility:**
- Keep old tables for 1-2 releases (mark as deprecated)
- Add database views to map old structure → new structure (if needed)
- Provide export script for users to backup old iteration data

## Success Criteria

### Functional Requirements Met
- ✅ User can edit task/judge prompts and versions auto-create
- ✅ User can manually trigger task generation
- ✅ User can manually trigger judge evaluation (all or selected)
- ✅ User can provide Pass/Fail feedback directly
- ✅ User can manually trigger prompt optimization
- ✅ Single unified table displays all training data
- ✅ Simple pass/fail percentage metrics displayed
- ✅ No automatic iterations (user full control)

### Performance
- Table renders 200 training pairs without lag
- Generate outputs for 200 pairs completes <60s
- Judge evaluation for 200 pairs completes <60s
- UI responds to user actions <100ms

### Data Integrity
- Versions auto-increment correctly
- No orphaned records after operations
- Migration script preserves all existing data
- Pass/fail percentages calculate accurately

## Risks & Mitigation

### Risk 1: Data Loss During Migration
**Mitigation:**
- Create full database backup before migration
- Test migration on copy of production data
- Provide rollback script

### Risk 2: User Confusion (Breaking Change)
**Mitigation:**
- Add migration guide to documentation
- Show "What's New" modal on first login after update
- Keep old iteration data accessible (read-only view)

### Risk 3: Large Dataset Performance
**Mitigation:**
- Implement pagination for table (50 rows per page)
- Add indexes on frequently queried columns
- Use lazy loading for generated outputs

### Risk 4: Version Explosion
**Mitigation:**
- Add "Archive old versions" feature (compress versions older than N days)
- Warn user when version count >20
- Allow manual version deletion (with confirmation)

## Open Questions

1. **Should we keep any iteration-based metrics for historical comparison?**
   - Recommendation: Export to JSON archive, don't display in new UI

2. **How to handle in-flight training when migration happens?**
   - Recommendation: Require all training to complete before migration

3. **Should version history show diff between versions?**
   - Recommendation: Yes, add diff viewer in Phase 7 (polish)

4. **What happens to existing personas with iteration data?**
   - Recommendation: Convert last iteration → latest version, archive rest

5. **Should we keep the grader column (currently just shows "Judge")?**
   - Recommendation: Skip for now, can add in future if needed

## Next Steps

1. Review and approve this plan
2. Create GitHub issue for each phase
3. Set up feature branch: `008-training-redesign`
4. Begin Phase 1 (Data Model & Migration)
5. Document new user workflow in `/specs/008-training-redesign/spec.md`

---

**Plan Status:** Approved
**Target Completion:** Phases 1-5 (MVP with new UI)
**Last Updated:** 2026-01-03