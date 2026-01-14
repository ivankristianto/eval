# Human Feedback Usage Audit Report

**Date**: 2025-01-14
**Ticket**: eval-7sf
**Auditor**: Engineer Agent

## Executive Summary

This audit verifies that the judge prompt optimization logic properly uses human feedback input during iteration 1 of the training process.

**Result**: ✅ **PASSED** - Human feedback is properly incorporated throughout the prompt optimization pipeline.

## Scope

This audit covers the following key files:
- `src/lib/training/prompt-engineer.ts` - Prompt refinement logic
- `src/lib/training/prompt-optimizer.ts` - Alternative optimization path (unused in iteration 1)
- `src/lib/training/training-loop-manager.ts` - Training loop orchestration
- `src/types/training.ts` - Type definitions

## Human Feedback Data Flow

### 1. Data Collection (training-loop-manager.ts)

**Location**: Lines 1278-1331

When iteration 1 completes and humans provide feedback via the UI:

```typescript
// Fetch human reviews with judge decisions and training pairs
const reviews = db.prepare(`
  SELECT
    jd.judge_decision,
    jd.generated_output,
    jd.judge_reasoning,
    hr.human_decision,
    hr.human_notes,        // ← Human feedback text
    tp.input,
    tp.expected_output
  FROM judge_decisions jd
  JOIN human_reviews hr ON hr.judge_decision_id = jd.id
  JOIN training_pairs tp ON tp.id = jd.training_pair_id
  WHERE jd.iteration_id = ?
`).all(iterationId);
```

**Fields extracted for each disagreement**:
- `judge_decision`: What the judge model decided
- `human_decision`: What the human reviewer decided
- `human_feedback`: Human's explanatory notes (from `human_notes`)
- `generated_output`: The task model's output
- `expected_output`: The ground truth
- `input`: The original input
- `judge_reasoning`: Why the judge decided as it did

### 2. Context Construction (training-loop-manager.ts)

**Location**: Lines 1374-1383

```typescript
const feedbackContext: HumanFeedbackContext = {
  current_task_prompt: currentTaskPrompt,
  current_judge_prompt: iteration.judge_prompt_text,
  human_disagreements: humanDisagreements,  // ← All disagreement examples
  metrics,
  iteration_number: 1,
  total_decisions: reviews.length,
  disagreements_count: humanDisagreements.length,
};
```

### 3. Prompt Building (prompt-engineer.ts)

**Location**: Lines 559-661 (`buildHumanFeedbackPromptContext()`)

The function constructs a comprehensive prompt for the Prompt Engineer LLM that includes:

#### Current Prompts
```text
## Current Task Prompt (Iteration 1)
"{current_task_prompt}"

## Current Judge Prompt (Iteration 1)
"{current_judge_prompt}"
```

#### Metrics from Human Review
```text
- Precision: X.XX
- Recall: X.XX
- F1 Score: X.XX
- Cohen's Kappa: X.XX
- Accuracy: X.XX

Confusion Matrix (Human vs Judge):
- True Positives (TP): N - Human agreed with correct decision
- True Negatives (TN): N - Human agreed with incorrect decision
- False Positives (FP): N - Human disagreed with correct decision (judge was wrong)
- False Negatives (FN): N - Human disagreed with incorrect decision (judge was wrong)

Total decisions: N
Disagreements: N (X.XX%)
```

#### Human Disagreements (CRITICAL SECTION)

**Location**: Lines 597-613

```text
## Human Disagreements (Cases where human disagreed with judge - N examples)
1. Judge Decision: "agree" | Human Decision: "disagree"
   Input: "..."
   Generated Output: "..."
   Expected Output: "..."
   Judge Reasoning: "..."
   Human Feedback: "..."  // ← Human's notes included here
```

Each disagreement includes:
1. **Judge Decision** - What the judge decided
2. **Human Decision** - What the human decided
3. **Input** - Original input prompt
4. **Generated Output** - Task model's output
5. **Expected Output** - Ground truth
6. **Judge Reasoning** - Judge's explanation
7. **Human Feedback** - Human's explanatory notes (from `human_notes`)

### 4. LLM Instructions

**Location**: Lines 615-640

The prompt instructs the Prompt Engineer LLM to:

```text
Using chain-of-thought reasoning, analyze the human disagreements and refine BOTH prompts to improve alignment with human judgment.

### Step 1: Identify Patterns
- What patterns do you see in the human disagreements?
- Are there specific types of cases where the judge consistently gets it wrong?
- What aspects of the prompts are causing these misalignments?

### Step 2: Design Improvements for Task Prompt
- How should the task prompt be modified to generate better outputs?
- What additional guidance or constraints should be added?
- What should the task model focus on or avoid?

### Step 3: Design Improvements for Judge Prompt
- How should the judge prompt be modified to better align with human judgment?
- What evaluation criteria should be clarified?
- What should the judge focus on when making decisions?

### Step 4: Generate Refined Prompts
Create improved prompts that:
1. Address the identified disagreement patterns
2. Provide clearer guidance for both models
3. Align better with human judgment patterns
4. Are concise but comprehensive
```

### 5. Response Format

**Location**: Lines 641-660

The LLM must respond with:

```json
{
  "refined_task_prompt": "...",
  "task_rationale": "...",
  "refined_judge_prompt": "...",
  "judge_rationale": "...",
  "expected_impact": "..."
}
```

## Type Definitions

### HumanFeedbackContext (prompt-engineer.ts, lines 52-80)

```typescript
export interface HumanFeedbackContext {
  current_task_prompt: string;
  current_judge_prompt: string;
  human_disagreements: Array<{
    judge_decision: 'agree' | 'disagree';
    human_decision: 'agree' | 'disagree';
    generated_output: string;
    expected_output: string;
    judge_reasoning: string;
    human_feedback: string;      // ← Human's notes from DB
    input: string;
  }>;
  metrics: {
    f1_score: number;
    precision: number;
    recall: number;
    cohens_kappa: number;
    accuracy: number;
    confusion_matrix: { ... };
  };
  iteration_number: number;
  total_decisions: number;
  disagreements_count: number;
}
```

## Verification Steps

To verify human feedback is being used:

1. ✅ Check that `human_disagreements` array is non-empty when there are disagreements
2. ✅ Verify each disagreement includes `human_feedback` field
3. ✅ Confirm `buildHumanFeedbackPromptContext()` includes disagreements in the prompt
4. ✅ Verify the LLM prompt asks to analyze disagreement patterns
5. ✅ Check that refined prompts are stored for iteration 2

## Issues Found

### Issue 1: Type Definition Location (Minor)

**Severity**: Low
**Status**: Noted for future cleanup

The `HumanFeedbackContext` type is defined in `src/lib/training/prompt-engineer.ts` (lines 52-80) instead of `src/types/training.ts` where other training-related types are defined.

**Impact**: No functional impact. Type is properly exported and used.

**Recommendation**: Consider moving to `src/types/training.ts` for consistency, but this is not blocking.

### Issue 2: No Critical Issues

**Severity**: N/A
**Status**: PASSED

All critical human feedback data fields are properly:
1. Extracted from the database
2. Included in the `HumanFeedbackContext`
3. Passed to the prompt builder
4. Included in the LLM prompt text
5. Used to generate refined prompts

## Comparison: Human Feedback vs. Failure Analysis

The system has two prompt refinement paths:

| Aspect | Human Feedback (Iter 1) | Failure Analysis (Iter 2+) |
|--------|-------------------------|---------------------------|
| Source | Human reviewer annotations | Automatic ground truth comparison |
| Data | `human_disagreements` array | `false_positives` / `false_negatives` arrays |
| Context | `HumanFeedbackContext` | `FailureAnalysisContext` |
| Function | `refineBothPromptsFromHumanFeedback()` | `refineBothPromptsFromFailureAnalysis()` |
| Includes human notes? | ✅ Yes (`human_feedback` field) | ❌ No (automatic comparison) |

Both paths properly include their respective feedback data in the LLM prompts.

## Conclusion

✅ **Human feedback is properly used in the judge prompt optimization logic.**

The system correctly:
- Extracts human feedback from the database
- Constructs comprehensive context with all disagreement examples
- Includes human notes and reasoning in the prompt sent to the Prompt Engineer LLM
- Instructs the LLM to analyze patterns and generate improved prompts
- Stores refined prompts for the next iteration

No critical issues were found. The minor type location inconsistency is noted but does not affect functionality.

## Test Recommendation

To add coverage for this functionality, consider adding an integration test that:

1. Creates a persona with training pairs
2. Runs iteration 1 and generates judge decisions
3. Simulates human review with disagreements
4. Calls `refinePromptsBasedOnHumanFeedback()`
5. Verifies that:
   - Human feedback is included in the prompt
   - Refined prompts are generated
   - Refined prompts are stored for iteration 2

---

**Audited by**: Engineer Agent
**Date**: 2025-01-14
**Status**: Complete - No critical issues found
