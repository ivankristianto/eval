import Anthropic from '@anthropic-ai/sdk';

export interface SimilarityDimension {
  rating: 'YES' | 'PARTIAL' | 'NO';
  details?: string;
}

export interface SemanticSimilarityResult {
  score: number;
  overallMatch: boolean;
  dimensions: {
    correctness: SimilarityDimension;
    completeness: SimilarityDimension;
    noContradictions: SimilarityDimension;
  };
  reasoning: string;
}

interface LLMEvaluationResponse {
  correctness: 'YES' | 'PARTIAL' | 'NO';
  correctness_details?: string;
  completeness: 'YES' | 'PARTIAL' | 'NO';
  completeness_details?: string;
  no_contradictions: 'YES' | 'PARTIAL' | 'NO';
  no_contradictions_details?: string;
  overall_match: boolean;
  reasoning: string;
}

const DIMENSION_SCORES: Record<'YES' | 'PARTIAL' | 'NO', number> = {
  YES: 100,
  PARTIAL: 50,
  NO: 0,
};

// Weights for each dimension (should sum to 1)
const DIMENSION_WEIGHTS = {
  correctness: 0.5,
  completeness: 0.3,
  noContradictions: 0.2,
};

export async function getSemanticSimilarityScore(
  response: string,
  expectedOutput: string,
  apiKey?: string
): Promise<SemanticSimilarityResult> {
  const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return fallbackSimilarity(response, expectedOutput);
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey });

    const result = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: buildEvaluationPrompt(response, expectedOutput),
        },
      ],
    });

    const textContent = result.content.find((block) => block.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text.trim() : '';

    return parseEvaluationResponse(text);
  } catch (error) {
    console.error('Semantic similarity scoring failed:', error);
    return fallbackSimilarity(response, expectedOutput);
  }
}

function buildEvaluationPrompt(response: string, expectedOutput: string): string {
  const truncatedResponse = response.substring(0, 2000);
  const truncatedExpected = expectedOutput.substring(0, 2000);

  return `You are evaluating whether an AI response semantically matches an expected output.

<expected_output>
${truncatedExpected}
</expected_output>

<actual_response>
${truncatedResponse}
</actual_response>

Evaluate the actual response against the expected output on these dimensions:

1. **Correctness**: Does the response contain the same core factual information and meaning?
2. **Completeness**: Does it cover all the key points from the expected output?
3. **No contradictions**: Does it avoid stating anything that directly conflicts with the expected output?

For each dimension, rate as:
- YES: Fully satisfies this criterion
- PARTIAL: Partially satisfies (some gaps or minor issues)
- NO: Does not satisfy this criterion

Respond with ONLY a JSON object in this exact format:
{
  "correctness": "YES" | "PARTIAL" | "NO",
  "correctness_details": "brief explanation",
  "completeness": "YES" | "PARTIAL" | "NO",
  "completeness_details": "brief explanation",
  "no_contradictions": "YES" | "PARTIAL" | "NO",
  "no_contradictions_details": "brief explanation",
  "overall_match": true | false,
  "reasoning": "1-2 sentence summary"
}`;
}

function parseEvaluationResponse(text: string): SemanticSimilarityResult {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed: LLMEvaluationResponse = JSON.parse(jsonMatch[0]);

  // Validate and normalize ratings
  const normalizeRating = (value: string | undefined): 'YES' | 'PARTIAL' | 'NO' => {
    const upper = String(value).toUpperCase().trim();
    if (upper === 'YES' || upper === 'PARTIAL' || upper === 'NO') {
      return upper;
    }
    return 'PARTIAL'; // Default to partial if unclear
  };

  const dimensions = {
    correctness: {
      rating: normalizeRating(parsed.correctness),
      details: parsed.correctness_details,
    },
    completeness: {
      rating: normalizeRating(parsed.completeness),
      details: parsed.completeness_details,
    },
    noContradictions: {
      rating: normalizeRating(parsed.no_contradictions),
      details: parsed.no_contradictions_details,
    },
  };

  // Calculate weighted score
  const score = Math.round(
    DIMENSION_SCORES[dimensions.correctness.rating] * DIMENSION_WEIGHTS.correctness +
      DIMENSION_SCORES[dimensions.completeness.rating] * DIMENSION_WEIGHTS.completeness +
      DIMENSION_SCORES[dimensions.noContradictions.rating] * DIMENSION_WEIGHTS.noContradictions
  );

  return {
    score,
    overallMatch: Boolean(parsed.overall_match),
    dimensions,
    reasoning: String(parsed.reasoning || '').substring(0, 500),
  };
}

function fallbackSimilarity(response: string, expectedOutput: string): SemanticSimilarityResult {
  // Basic token overlap similarity when no API is available
  const normalize = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((word) => word.length > 2)
    );
  };

  const responseTokens = normalize(response);
  const expectedTokens = normalize(expectedOutput);

  if (expectedTokens.size === 0) {
    return {
      score: responseTokens.size === 0 ? 100 : 0,
      overallMatch: responseTokens.size === 0,
      dimensions: {
        correctness: { rating: 'PARTIAL', details: 'Fallback method used' },
        completeness: { rating: 'PARTIAL', details: 'Fallback method used' },
        noContradictions: {
          rating: 'PARTIAL',
          details: 'Fallback method used',
        },
      },
      reasoning: 'Using token overlap fallback (no API key available)',
    };
  }

  const intersection = new Set([...responseTokens].filter((token) => expectedTokens.has(token)));

  // Jaccard-like similarity
  const union = new Set([...responseTokens, ...expectedTokens]);
  const similarity = Math.round((intersection.size / union.size) * 100);

  const rating: 'YES' | 'PARTIAL' | 'NO' =
    similarity >= 70 ? 'YES' : similarity >= 40 ? 'PARTIAL' : 'NO';

  return {
    score: similarity,
    overallMatch: similarity >= 70,
    dimensions: {
      correctness: { rating, details: 'Based on token overlap' },
      completeness: { rating, details: 'Based on token overlap' },
      noContradictions: { rating: 'PARTIAL', details: 'Cannot verify' },
    },
    reasoning: `Token overlap similarity: ${intersection.size}/${expectedTokens.size} expected tokens found`,
  };
}

// Optional: Batch evaluation for efficiency
export async function batchSemanticSimilarity(
  pairs: Array<{ response: string; expectedOutput: string }>,
  apiKey?: string,
  concurrency: number = 3
): Promise<SemanticSimilarityResult[]> {
  const results: SemanticSimilarityResult[] = [];

  for (let i = 0; i < pairs.length; i += concurrency) {
    const batch = pairs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((pair) => getSemanticSimilarityScore(pair.response, pair.expectedOutput, apiKey))
    );
    results.push(...batchResults);
  }

  return results;
}
