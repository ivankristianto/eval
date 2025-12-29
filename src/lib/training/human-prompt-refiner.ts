/**
 * Human-Driven Prompt Refiner Module
 * Analyzes human feedback from iteration 1 to generate improved judge prompts
 *
 * This module is used specifically for iteration 1, where human review is mandatory.
 * It aggregates human reasoning and patterns to refine the judge prompt before iteration 2.
 */

import type { Database } from 'better-sqlite3';
import type { TrainingIteration } from '@src-types/training';

/**
 * Aggregated analysis of human feedback patterns.
 */
export interface HumanFeedbackAnalysis {
  /** Total number of human reviews analyzed */
  totalReviews: number;
  /** Number of "agree" votes (human affirmed judge) */
  agreeVotes: number;
  /** Number of "disagree" votes (human contradicted judge) */
  disagreeVotes: number;
  /** Common reasons extracted from "disagree" votes */
  commonDisagreePatterns: string[];
  /** Systematic errors identified from human feedback */
  systematicErrors: string[];
  /** Edge cases missed by the judge */
  missedEdgeCases: string[];
  /** Key insights from human reasoning comments */
  keyInsights: string[];
  /** Suggested improvements based on analysis */
  suggestedImprovements: string[];
}

/**
 * Result of human-driven prompt refinement.
 */
export interface HumanPromptRefinementResult {
  /** Refined judge prompt text (null if LLM refinement failed) */
  refined_prompt: string | null;
  /** Explanation of what was changed and why */
  rationale: string;
  /** Expected impact on next iteration */
  expected_impact: string;
  /** Original prompt for comparison */
  original_prompt: string;
  /** Human feedback analysis that led to refinement */
  analysis: HumanFeedbackAnalysis;
}

/**
 * Analyze human feedback from iteration 1 to identify patterns and insights.
 *
 * @param iterationId - ID of iteration 1 (must have 100% human review completion)
 * @param db - Database connection
 * @returns Human feedback analysis with patterns and insights
 * @throws Error if iteration not found or human reviews incomplete
 */
export function analyzeHumanFeedback(iterationId: string, db: Database): HumanFeedbackAnalysis {
  // Fetch iteration details
  const iteration = db
    .prepare('SELECT * FROM training_iterations WHERE id = ?')
    .get(iterationId) as TrainingIteration | undefined;

  if (!iteration) {
    throw new Error(`Iteration not found: ${iterationId}`);
  }

  // Verify this is iteration 1 (human-driven refinement only for iteration 1)
  if (iteration.iteration_number !== 1) {
    throw new Error(
      `Human-driven prompt refinement is only for iteration 1. This is iteration ${iteration.iteration_number}. Use LLM-driven refinement for iterations 2+.`
    );
  }

  // Fetch all judge decisions with human reviews
  const decisionsWithReviews = db
    .prepare(
      `
      SELECT
        jd.judge_decision,
        hr.human_decision,
        hr.human_notes,
        jd.judge_reasoning,
        tp.input,
        tp.expected_output,
        jd.generated_output
      FROM judge_decisions jd
      JOIN human_reviews hr ON hr.judge_decision_id = jd.id
      JOIN training_pairs tp ON tp.id = jd.training_pair_id
      WHERE jd.iteration_id = ?
    `
    )
    .all(iterationId) as Array<{
    judge_decision: 'agree' | 'disagree';
    human_decision: 'agree' | 'disagree';
    human_notes: string | null;
    judge_reasoning: string | null;
    input: string;
    expected_output: string;
    generated_output: string;
  }>;

  // Verify 100% human review completion for iteration 1
  const totalDecisions = db
    .prepare('SELECT COUNT(*) as count FROM judge_decisions WHERE iteration_id = ?')
    .get(iterationId) as { count: number };

  if (decisionsWithReviews.length < totalDecisions.count) {
    throw new Error(
      `Iteration 1 requires 100% human review completion. Only ${decisionsWithReviews.length}/${totalDecisions.count} decisions reviewed.`
    );
  }

  if (decisionsWithReviews.length === 0) {
    throw new Error(`No human reviews found for iteration: ${iterationId}`);
  }

  // Count votes
  const agreeVotes = decisionsWithReviews.filter((d) => d.human_decision === 'agree').length;
  const disagreeVotes = decisionsWithReviews.filter((d) => d.human_decision === 'disagree').length;

  // Extract "disagree" patterns (where human contradicted judge)
  const disagreeReviews = decisionsWithReviews.filter((d) => d.human_decision === 'disagree');

  // Group by judge decision to understand patterns
  const _judgeWrongButAgreed = disagreeReviews.filter((d) => d.judge_decision === 'agree'); // Judge said correct but was wrong
  const _judgeWrongButDisagreed = disagreeReviews.filter((d) => d.judge_decision === 'disagree'); // Judge said incorrect but was right

  // Extract common patterns from human notes
  const humanNotes = disagreeReviews.map((d) => d.human_notes || '').filter(Boolean);
  const commonDisagreePatterns = extractCommonPatterns(humanNotes);

  // Identify systematic errors
  const systematicErrors = identifySystematicErrors(disagreeReviews);

  // Identify missed edge cases
  const missedEdgeCases = identifyMissedEdgeCases(disagreeReviews);

  // Extract key insights
  const keyInsights = extractKeyInsights(decisionsWithReviews);

  // Generate suggested improvements
  const suggestedImprovements = generateSuggestedImprovements(
    commonDisagreePatterns,
    systematicErrors,
    missedEdgeCases,
    keyInsights
  );

  return {
    totalReviews: decisionsWithReviews.length,
    agreeVotes,
    disagreeVotes,
    commonDisagreePatterns,
    systematicErrors,
    missedEdgeCases,
    keyInsights,
    suggestedImprovements,
  };
}

/**
 * Refine judge prompt from human feedback analysis (iteration 1).
 *
 * This function uses the Prompt Engineer LLM to synthesize human feedback
 * into an improved judge prompt. The LLM is given:
 * - Current prompt
 * - Human feedback analysis (patterns, errors, insights)
 * - Specific examples of disagreements
 *
 * @param currentPrompt - Current judge prompt text
 * @param analysis - Human feedback analysis from analyzeHumanFeedback
 * @param promptEngineerModelId - Model ID for prompt engineer LLM
 * @returns Refined prompt with rationale and expected impact
 */
export async function refineJudgePromptFromHumanFeedback(
  currentPrompt: string,
  analysis: HumanFeedbackAnalysis,
  promptEngineerModelId: string
): Promise<HumanPromptRefinementResult> {
  // Build prompt for the LLM
  const systemPrompt = buildHumanRefinementPrompt(currentPrompt, analysis);

  try {
    // Import api-clients dynamically
    const { callModel } = await import('@lib/utils/api-clients');

    // Call Prompt Engineer Model
    const response = await callModel(promptEngineerModelId, systemPrompt);

    // Parse JSON response
    let parsedResponse: {
      improved_prompt?: string | null;
      rationale?: string;
      expected_impact?: string;
    } | undefined;
    try {
      parsedResponse = JSON.parse(response);
    } catch {
      // Return failure with fallback
      return {
        refined_prompt: null,
        rationale: 'Failed to parse LLM response',
        expected_impact: 'Unable to determine expected impact',
        original_prompt: currentPrompt,
        analysis,
      };
    }

    // Extract fields from response
    return {
      refined_prompt: parsedResponse?.improved_prompt || null,
      rationale: parsedResponse?.rationale || 'No rationale provided',
      expected_impact: parsedResponse?.expected_impact || 'No impact prediction provided',
      original_prompt: currentPrompt,
      analysis,
    };
  } catch (error) {
    // Return failure with original data
    return {
      refined_prompt: null,
      rationale: `LLM call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      expected_impact: 'Unable to determine expected impact due to LLM failure',
      original_prompt: currentPrompt,
      analysis,
    };
  }
}

/**
 * Extract common patterns from human review notes using keyword frequency analysis.
 */
function extractCommonPatterns(notes: string[]): string[] {
  if (notes.length === 0) {
    return ['No specific patterns identified'];
  }

  // Common keywords and phrases that indicate issues
  const issueKeywords = [
    'too strict',
    'too lenient',
    'missing context',
    'incorrect interpretation',
    'wrong format',
    'not specific enough',
    'overly specific',
    'ignoring',
    'should have',
    'inconsistent',
    'unclear',
    'ambiguous',
    'incorrectly',
    'correctly',
    'should be',
    'wrong',
    'right',
    'too professional',
    'not relevant',
    'off-topic',
  ];

  const patterns: string[] = [];

  // Find notes containing each keyword
  for (const keyword of issueKeywords) {
    const matchingNotes = notes.filter((note) =>
      note.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matchingNotes.length >= 2) {
      // Only include patterns mentioned in 2+ reviews
      patterns.push(`${keyword} (${matchingNotes.length} reviews)`);
    }
  }

  // If no patterns found, return generic message
  if (patterns.length === 0) {
    return ['No recurring patterns identified in human feedback'];
  }

  return patterns.slice(0, 5); // Limit to top 5 patterns
}

/**
 * Identify systematic errors from disagree reviews.
 */
function identifySystematicErrors(disagreeReviews: {
  judge_decision: string;
  human_notes?: string | null;
  generated_output?: string;
  expected_output?: string;
}[]): string[] {
  const errors: string[] = [];

  // Check if judge is consistently too lenient (agrees with wrong outputs)
  const tooLenient = disagreeReviews.filter((d) => d.judge_decision === 'agree');
  if (tooLenient.length >= 3) {
    errors.push(
      `Judge is too lenient: ${tooLenient.length} incorrect outputs were marked as correct`
    );
  }

  // Check if judge is consistently too strict (disagrees with correct outputs)
  const tooStrict = disagreeReviews.filter((d) => d.judge_decision === 'disagree');
  if (tooStrict.length >= 3) {
    errors.push(
      `Judge is too strict: ${tooStrict.length} correct outputs were marked as incorrect`
    );
  }

  if (errors.length === 0) {
    errors.push('No systematic errors identified');
  }

  return errors;
}

/**
 * Identify edge cases that the judge missed.
 */
function identifyMissedEdgeCases(disagreeReviews: {
  human_notes?: string | null;
  generated_output?: string;
  expected_output?: string;
}[]): string[] {
  const edgeCases: Set<string> = new Set();

  for (const review of disagreeReviews) {
    const note = review.human_notes || '';
    const output = review.generated_output?.toLowerCase() || '';
    const expected = review.expected_output?.toLowerCase() || '';

    // Look for edge case indicators in human notes
    if (
      note.toLowerCase().includes('edge') ||
      note.toLowerCase().includes('special case') ||
      note.toLowerCase().includes('exception')
    ) {
      edgeCases.add(`Special case identified: ${note.substring(0, 100)}`);
    }

    // Look for empty/null handling
    if (output.includes('empty') || expected.includes('empty') || output.includes('null')) {
      edgeCases.add('Empty/null value handling');
    }

    // Look for formatting variations
    if (note.toLowerCase().includes('format') || note.toLowerCase().includes('case')) {
      edgeCases.add('Format/case sensitivity issues');
    }

    // Look for partial matches
    if (note.toLowerCase().includes('partial') || note.toLowerCase().includes('incomplete')) {
      edgeCases.add('Partial/incomplete answer handling');
    }
  }

  if (edgeCases.size === 0) {
    return ['No specific edge cases identified'];
  }

  return Array.from(edgeCases).slice(0, 5);
}

/**
 * Extract key insights from all reviews (both agree and disagree).
 */
function extractKeyInsights(reviews: {
  human_decision: 'agree' | 'disagree';
  human_notes?: string | null;
  judge_reasoning?: string | null;
}[]): string[] {
  const insights: string[] = [];

  // Calculate agreement rate
  const agreementCount = reviews.filter((r) => r.human_decision === 'agree').length;
  const agreementRate = (agreementCount / reviews.length) * 100;

  insights.push(
    `Overall agreement rate: ${agreementRate.toFixed(1)}% (${agreementCount}/${reviews.length})`
  );

  // Check for agreement trends
  if (agreementRate >= 90) {
    insights.push('Judge has high alignment with human evaluators');
  } else if (agreementRate >= 70) {
    insights.push('Judge has moderate alignment with human evaluators; refinement needed');
  } else {
    insights.push('Judge has low alignment with human evaluators; significant refinement needed');
  }

  // Look for common themes in reasoning
  const reasoningLengths = reviews.map((r) => r.judge_reasoning?.length || 0).filter((l) => l > 0);
  if (reasoningLengths.length > 0) {
    const avgReasoningLength =
      reasoningLengths.reduce((a, b) => a + b, 0) / reasoningLengths.length;
    insights.push(`Average judge reasoning length: ${avgReasoningLength.toFixed(0)} characters`);
  }

  // Look for human review completeness
  const notesProvided = reviews.filter((r) => r.human_notes && r.human_notes.length > 0).length;
  insights.push(`Human reviewers provided notes in ${notesProvided}/${reviews.length} reviews`);

  return insights;
}

/**
 * Generate suggested improvements based on analysis.
 */
function generateSuggestedImprovements(
  patterns: string[],
  errors: string[],
  edgeCases: string[],
  _insights: string[]
): string[] {
  const improvements: string[] = [];

  // Based on systematic errors
  if (errors.some((e) => e.includes('too lenient'))) {
    improvements.push('Add stricter criteria for evaluating output correctness');
  }
  if (errors.some((e) => e.includes('too strict'))) {
    improvements.push('Add guidance on accepting semantically correct outputs');
  }

  // Based on edge cases
  if (edgeCases.some((e) => e.includes('Empty/null'))) {
    improvements.push('Add explicit handling instructions for empty/null values');
  }
  if (edgeCases.some((e) => e.includes('format'))) {
    improvements.push('Add format flexibility guidelines');
  }

  // Based on patterns
  if (patterns.some((p) => p.includes('unclear') || p.includes('ambiguous'))) {
    improvements.push('Clarify evaluation criteria to reduce ambiguity');
  }
  if (patterns.some((p) => p.includes('missing context'))) {
    improvements.push('Add requirements for considering full context');
  }

  // Default improvements if none identified
  if (improvements.length === 0) {
    improvements.push('Review and refine evaluation criteria based on human feedback');
    improvements.push('Add examples from human-disagreed cases');
  }

  return improvements;
}

/**
 * Build comprehensive prompt for LLM prompt engineer based on human feedback analysis.
 */
function buildHumanRefinementPrompt(
  currentPrompt: string,
  analysis: HumanFeedbackAnalysis
): string {
  return `You are an expert prompt engineer tasked with refining a judge prompt based on human feedback from iteration 1.

## Current Judge Prompt
"${currentPrompt}"

## Human Feedback Analysis (Iteration 1)

### Review Statistics
- Total Reviews: ${analysis.totalReviews}
- Agree Votes (human affirmed judge): ${analysis.agreeVotes}
- Disagree Votes (human contradicted judge): ${analysis.disagreeVotes}
- Agreement Rate: ${((analysis.agreeVotes / analysis.totalReviews) * 100).toFixed(1)}%

### Common Disagree Patterns
${analysis.commonDisagreePatterns.map((p) => `- ${p}`).join('\n')}

### Systematic Errors Identified
${analysis.systematicErrors.map((e) => `- ${e}`).join('\n')}

### Missed Edge Cases
${analysis.missedEdgeCases.map((c) => `- ${c}`).join('\n')}

### Key Insights
${analysis.keyInsights.map((i) => `- ${i}`).join('\n')}

### Suggested Improvements
${analysis.suggestedImprovements.map((i) => `- ${i}`).join('\n')}

## Your Task

Based on the human feedback analysis above, refine the judge prompt to:

1. Address the systematic errors identified
2. Handle the edge cases that were missed
3. Incorporate the suggested improvements
4. Maintain clarity and conciseness

The refined prompt should:
- Be more aligned with human judgment patterns
- Explicitly address the identified issues
- Provide clear guidance for edge cases
- Be a complete, standalone prompt (not a diff)

## Response Format

Respond with a JSON object containing:
{
  "improved_prompt": "Your refined judge prompt here (complete, standalone text)",
  "rationale": "Explain what you changed and why (2-3 sentences, referencing specific human feedback patterns)",
  "expected_impact": "Predict how this will affect agreement rate and performance in iteration 2 (1-2 sentences)"
}

Focus on changes that directly address the human feedback patterns identified above.`;
}

/**
 * Create a human-driven refined prompt version in the database.
 *
 * @param personaId - Persona ID
 * @param iterationNumber - Iteration number (should be 1)
 * @param promptText - Refined prompt text
 * @param rationale - Explanation of changes
 * @param createdBy - Should be "human" for human-driven refinement
 * @param db - Database connection
 * @returns The ID of the created prompt version
 */
export function storeHumanRefinedPromptVersion(
  personaId: string,
  iterationNumber: number,
  promptText: string,
  rationale: string,
  createdBy: 'human' | 'ai',
  db: Database
): string {
  const id = crypto.randomUUID();

  db.prepare(
    `
    INSERT INTO judge_prompt_versions
    (id, persona_id, iteration_number, prompt_text, improvement_rationale, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, personaId, iterationNumber, promptText, rationale, createdBy, new Date().toISOString());

  return id;
}
