// src/lib/accuracy.ts
// Accuracy calculation functions for AI Model Evaluation Framework

import type { AccuracyResult, RubricType } from './types';
import { getSemanticSimilarityScore } from './semanticSimilarity';

// ===== Exact Match Rubric =====

export function exactMatch(response: string, expectedOutput: string): AccuracyResult {
  // Normalize both strings for comparison
  const normalizedResponse = normalizeText(response);
  const normalizedExpected = normalizeText(expectedOutput);

  if (normalizedResponse === normalizedExpected) {
    return {
      score: 100,
      reasoning: 'Response exactly matches expected output',
    };
  }

  // Check for case-insensitive match
  if (normalizedResponse.toLowerCase() === normalizedExpected.toLowerCase()) {
    return {
      score: 100,
      reasoning: 'Response matches expected output (case-insensitive)',
    };
  }

  return {
    score: 0,
    reasoning: `Response does not match expected output. Expected: "${truncate(expectedOutput, 100)}", Got: "${truncate(response, 100)}"`,
  };
}

// ===== Partial Credit Rubric =====

export function partialCredit(
  response: string,
  expectedOutput: string,
  concepts: string[]
): AccuracyResult {
  if (!concepts || concepts.length === 0) {
    return {
      score: 0,
      reasoning: 'No concepts provided for partial credit evaluation',
    };
  }

  const normalizedResponse = response.toLowerCase();
  const foundConcepts: string[] = [];
  const missingConcepts: string[] = [];

  for (const concept of concepts) {
    const normalizedConcept = concept.toLowerCase().trim();
    if (normalizedConcept.length === 0) continue;

    // Check for concept presence (supports multi-word concepts)
    if (normalizedResponse.includes(normalizedConcept)) {
      foundConcepts.push(concept);
    } else {
      // Also check for word-by-word match for multi-word concepts
      const conceptWords = normalizedConcept.split(/\s+/);
      const allWordsFound = conceptWords.every((word) => normalizedResponse.includes(word));
      if (allWordsFound) {
        foundConcepts.push(concept);
      } else {
        missingConcepts.push(concept);
      }
    }
  }

  const score = Math.round((foundConcepts.length / concepts.length) * 100);

  let reasoning = `Found ${foundConcepts.length} of ${concepts.length} concepts`;
  if (foundConcepts.length > 0) {
    reasoning += `. Found: [${foundConcepts.join(', ')}]`;
  }
  if (missingConcepts.length > 0) {
    reasoning += `. Missing: [${missingConcepts.join(', ')}]`;
  }

  return {
    score,
    reasoning: truncate(reasoning, 500),
  };
}

// ===== Semantic Similarity Rubric =====

export async function semanticSimilarity(
  response: string,
  expectedOutput: string
): Promise<AccuracyResult> {
  try {
    const result = await getSemanticSimilarityScore(response, expectedOutput);
    return {
      score: result.score,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('Semantic similarity calculation failed:', error);
    return {
      score: 0,
      reasoning: 'Failed to calculate semantic similarity',
    };
  }
}

// ===== Main Accuracy Calculator =====

export async function calculateAccuracy(
  rubricType: RubricType,
  response: string,
  expectedOutput: string,
  partialCreditConcepts?: string[]
): Promise<AccuracyResult> {
  switch (rubricType) {
    case 'exact_match':
      return exactMatch(response, expectedOutput);

    case 'partial_credit':
      return partialCredit(response, expectedOutput, partialCreditConcepts || []);

    case 'semantic_similarity':
      return await semanticSimilarity(response, expectedOutput);

    default:
      return {
        score: 0,
        reasoning: `Unknown rubric type: ${rubricType}`,
      };
  }
}

// ===== Helper Functions =====

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'"); // Normalize apostrophes
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
