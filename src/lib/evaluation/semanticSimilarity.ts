import Anthropic from '@anthropic-ai/sdk';

// --- Types ---

/**
 * Evaluation rating for a specific dimension of similarity.
 */
export interface SimilarityDimension {
  /** Rating value: YES (100%), PARTIAL (50%), or NO (0%) */
  rating: 'YES' | 'PARTIAL' | 'NO';
  /** Optional explanation for the rating */
  details?: string;
}

/**
 * Comprehensive result of a semantic similarity evaluation.
 */
export interface SemanticSimilarityResult {
  /** Calculated weighted score (0-100) */
  score: number;
  /** Whether the score meets the overall match threshold */
  overallMatch: boolean;
  /** Individual dimension scores */
  dimensions: {
    correctness: SimilarityDimension;
    completeness: SimilarityDimension;
    noContradictions: SimilarityDimension;
  };
  /** Detailed reasoning from the evaluator */
  reasoning: string;
}

/**
 * Expected JSON response structure from the evaluator LLM.
 */
interface LLMEvaluationResponse {
  reasoning_analysis: string;
  correctness: 'YES' | 'PARTIAL' | 'NO';
  correctness_details: string;
  completeness: 'YES' | 'PARTIAL' | 'NO';
  completeness_details: string;
  no_contradictions: 'YES' | 'PARTIAL' | 'NO';
  no_contradictions_details: string;
}

// --- Configuration ---

/**
 * Numerical scores assigned to each rating level.
 */
const DIMENSION_SCORES: Record<'YES' | 'PARTIAL' | 'NO', number> = {
  YES: 100,
  PARTIAL: 50,
  NO: 0,
};

/**
 * Default importance weights for each similarity dimension.
 */
const DEFAULT_WEIGHTS = {
  correctness: 0.5,
  completeness: 0.3,
  noContradictions: 0.2,
};

// --- Main Function ---

/**
 * Calculates a semantic similarity score between two strings using an LLM.
 * Falls back to basic token similarity if no API key is available or on error.
 *
 * @param response - The model generated response text
 * @param expectedOutput - The ground truth output text
 * @param apiKey - Optional Anthropic API key
 * @param options - Configuration options for model, threshold and weights
 * @param options.model
 * @param options.threshold
 * @param options.weights
 * @returns Promise resolving to semantic similarity results
 */
export async function getSemanticSimilarityScore(
  response: string,
  expectedOutput: string,
  apiKey?: string,
  options: {
    model?: string;
    threshold?: number;
    weights?: typeof DEFAULT_WEIGHTS;
  } = {}
): Promise<SemanticSimilarityResult> {
  const envKey = import.meta.env?.ANTHROPIC_API_KEY || process.env.ENCRYPTION_KEY;
  const anthropicKey = apiKey || envKey;
  const weights = options.weights || DEFAULT_WEIGHTS;
  const threshold = options.threshold || 70; // Score required for overallMatch

  if (!anthropicKey) {
    console.warn('No API key provided, falling back to basic token similarity.');
    return fallbackSimilarity(response, expectedOutput);
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey });

    const result = await client.messages.create({
      // Use the latest stable model
      model: options.model || 'claude-haiku-4-5',
      max_tokens: 1024,
      temperature: 0, // Deterministic results are better for eval
      messages: [
        {
          role: 'user',
          content: buildEvaluationPrompt(response, expectedOutput),
        },
      ],
    });

    const textContent = result.content.find((block) => block.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text.trim() : '';

    return parseEvaluationResponse(text, weights, threshold);
  } catch (error) {
    console.error('Semantic similarity scoring failed:', error);
    return fallbackSimilarity(response, expectedOutput);
  }
}

// --- Prompt Engineering ---

/**
 * Builds the system prompt for the evaluator LLM.
 * @param response - Actual response text
 * @param expectedOutput - Ground truth text
 * @returns Formatted prompt string
 */
function buildEvaluationPrompt(response: string, expectedOutput: string): string {
  // Increased limit significantly (20k chars approx 5k tokens), safe for modern models
  const truncResponse = response.substring(0, 20000);
  const truncExpected = expectedOutput.substring(0, 20000);

  return `You are an expert QA Linguist. Your task is to evaluate the semantic similarity between an AI's actual response and an expected output.

<expected_output>
${truncExpected}
</expected_output>

<actual_response>
${truncResponse}
</actual_response>

### Evaluation Criteria
Compare the response based on these strict dimensions:

1. **Correctness (Weight: High)**
   - YES: The response conveys the same core facts and meaning as the expected output.
   - PARTIAL: The response is mostly correct but misses nuance or has minor inaccuracies.
   - NO: The response is factually different or misleading compared to the expected output.

2. **Completeness (Weight: Medium)**
   - YES: All key points in the expected output are present.
   - PARTIAL: Some key points are missing, but the main answer is there.
   - NO: Significant portions of the expected answer are missing.

3. **No Contradictions (Weight: Low)**
   - YES: The response does not contradict the expected output.
   - PARTIAL: There is a minor ambiguity or slight conflict.
   - NO: The response directly states the opposite of the expected output.

### Instructions
1. Analyze the two texts carefully.
2. Ignore minor formatting, punctuation, or phrasing differences if the semantic meaning is preserved.
3. Provide your reasoning FIRST, then your scores.
4. Output your final result strictly as a JSON object wrapped in a markdown code block.

Example Format:
\`\`\`json
{
  "reasoning_analysis": "The actual response covers the main definition but omits the example provided in the expected output...",
  "correctness": "YES",
  "correctness_details": "Core definition matches.",
  "completeness": "PARTIAL",
  "completeness_details": "Missing the secondary example.",
  "no_contradictions": "YES",
  "no_contradictions_details": "No conflicts found."
}
\`\`\`
`;
}

// --- Parsing Logic ---

/**
 * Parses the JSON response from the evaluator LLM.
 * @param text - Raw response text
 * @param weights - Dimension weights for scoring
 * @param threshold - Success threshold
 * @returns Parsed similarity result
 */
function parseEvaluationResponse(
  text: string,
  weights: typeof DEFAULT_WEIGHTS,
  threshold: number
): SemanticSimilarityResult {
  try {
    const isRating = (val: string): val is SimilarityDimension['rating'] =>
      val === 'YES' || val === 'PARTIAL' || val === 'NO';

    // Robust extraction: Look for JSON inside code blocks first, then fall back to brace matching
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = codeBlockMatch ? codeBlockMatch[1] : text.match(/\{[\s\S]*\}/)?.[0];

    if (!jsonString) {
      throw new Error('No JSON structure found in response');
    }

    const parsed: LLMEvaluationResponse = JSON.parse(jsonString);

    // Normalize helper
    const norm = (val: string | undefined): SimilarityDimension['rating'] => {
      const v = String(val).toUpperCase().trim();
      return isRating(v) ? v : 'PARTIAL';
    };

    const dimensions = {
      correctness: {
        rating: norm(parsed.correctness),
        details: parsed.correctness_details,
      },
      completeness: {
        rating: norm(parsed.completeness),
        details: parsed.completeness_details,
      },
      noContradictions: {
        rating: norm(parsed.no_contradictions),
        details: parsed.no_contradictions_details,
      },
    };

    // Calculate Weighted Score
    const score = Math.round(
      DIMENSION_SCORES[dimensions.correctness.rating] * weights.correctness +
        DIMENSION_SCORES[dimensions.completeness.rating] * weights.completeness +
        DIMENSION_SCORES[dimensions.noContradictions.rating] * weights.noContradictions
    );

    // Programmatic Overall Match (More consistent than asking LLM for a boolean)
    const overallMatch = score >= threshold;

    return {
      score,
      overallMatch,
      dimensions,
      reasoning: parsed.reasoning_analysis || 'No reasoning provided.',
    };
  } catch (e) {
    console.error('Failed to parse LLM evaluation:', e);
    throw new Error(`Failed to parse evaluation response: ${text.substring(0, 100)}...`);
  }
}

// --- Fallback (Kept mostly same, added threshold support) ---

/**
 * Fallback similarity calculation using Jaccard index of token overlap.
 * @param response - Actual response text
 * @param expectedOutput - Ground truth text
 * @returns Basic similarity result
 */
function fallbackSimilarity(response: string, expectedOutput: string): SemanticSimilarityResult {
  const normalize = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const rTokens = normalize(response);
  const eTokens = normalize(expectedOutput);

  if (eTokens.size === 0)
    return {
      score: 0,
      overallMatch: false,
      reasoning: 'Empty expected output',
      dimensions: {
        correctness: { rating: 'NO' },
        completeness: { rating: 'NO' },
        noContradictions: { rating: 'NO' },
      },
    };

  const intersection = new Set([...rTokens].filter((x) => eTokens.has(x)));
  const union = new Set([...rTokens, ...eTokens]);
  const similarity = Math.round((intersection.size / union.size) * 100);

  const rating = similarity >= 70 ? 'YES' : similarity >= 40 ? 'PARTIAL' : 'NO';

  return {
    score: similarity,
    overallMatch: similarity >= 50, // Default fallback threshold
    dimensions: {
      correctness: { rating, details: 'Token overlap fallback' },
      completeness: { rating, details: 'Token overlap fallback' },
      noContradictions: { rating: 'PARTIAL', details: 'Cannot verify contradictions' },
    },
    reasoning: `Fallback: ${similarity}% token similarity Jaccard index`,
  };
}
