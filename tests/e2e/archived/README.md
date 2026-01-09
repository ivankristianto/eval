# Archived E2E Tests

This directory contains E2E tests for the **iteration-based training workflow** that has been replaced by the **version-based workspace workflow**.

## Archived Tests

### `training-dashboard.test.ts`

**Purpose**: E2E tests for the Training Dashboard page

**What was tested**:
- Dashboard API endpoints (`/api/personas/:id/dashboard`)
- Error handling for missing/invalid persona IDs
- Dashboard data structure validation
- Metrics visualization and display
- Progress tracking across iterations
- Convergence tracking
- Current iteration status

**Why archived**: The training dashboard page has been replaced by the unified Training Workspace, which uses a different data model and UI approach.

---

### `two-phase-training.test.ts`

**Purpose**: E2E tests for the two-phase training workflow

**What was tested**:
- **Phase 1 (Iteration 1)**: Human-driven training workflow
  - Persona creation with task, judge, and prompt engineer models
  - Training data upload via CSV
  - Manual human review of judge decisions
  - Metrics calculation after human feedback
- **Phase 2 (Iterations 2+)**: Fully automated training workflow
  - Automated prompt refinement
  - Automated iterations without human intervention
  - Convergence detection
  - Multi-iteration progress tracking

**Why archived**: The two-phase iteration-based workflow has been replaced by a version-based workflow where:
- Users work in a unified workspace
- Prompt versions are managed explicitly
- Training is no longer tied to numbered iterations
- Human feedback and AI improvements are tracked per version, not per iteration

## Migration Notes

The new workspace-based workflow provides:
- Better version control for task and judge prompts
- Unified interface for all training activities
- More flexible training approach not constrained by iteration numbers
- Clearer separation between prompt versions and evaluation runs

If you need to reference the old iteration-based workflow logic, these tests provide comprehensive examples of how it worked.

## Date Archived

January 4, 2026
