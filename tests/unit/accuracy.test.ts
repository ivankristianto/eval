import { beforeEach, describe, expect, it, vi } from "vitest";
import * as accuracy from "../../src/lib/accuracy";
import { getSemanticSimilarityScore } from "../../src/lib/semanticSimilarity";

vi.mock("../../src/lib/semanticSimilarity", () => ({
  getSemanticSimilarityScore: vi.fn(),
}));

const baseSemanticResult = {
  score: 100,
  overallMatch: true,
  dimensions: {
    correctness: { rating: "YES" as const, details: "ok" },
    completeness: { rating: "YES" as const, details: "ok" },
    noContradictions: { rating: "YES" as const, details: "ok" },
  },
  reasoning: "Mocked semantic result",
};

describe("exactMatch", () => {
  it("returns 100 for exact match", () => {
    const result = accuracy.exactMatch("Hello world", "Hello world");

    expect(result.score).toBe(100);
    expect(result.reasoning).toBe("Response exactly matches expected output");
  });

  it("returns 0 for no match", () => {
    const result = accuracy.exactMatch("Hello", "Goodbye");

    expect(result.score).toBe(0);
  });

  it("treats case-insensitive matches as 100", () => {
    const result = accuracy.exactMatch("Hello World", "hello world");

    expect(result.score).toBe(100);
    expect(result.reasoning).toContain("case-insensitive");
  });

  it("normalizes whitespace before comparison", () => {
    const result = accuracy.exactMatch("Hello   world", "Hello world");

    expect(result.score).toBe(100);
  });
});

describe("partialCredit", () => {
  it("returns 100 when all concepts are present", () => {
    const result = accuracy.partialCredit("alpha beta gamma", "Expected", [
      "alpha",
      "beta",
      "gamma",
    ]);

    expect(result.score).toBe(100);
  });

  it("returns 0 when no concepts are present", () => {
    const result = accuracy.partialCredit("alpha", "Expected", ["beta"]);

    expect(result.score).toBe(0);
  });

  it("returns proportional score for partial matches", () => {
    const result = accuracy.partialCredit("alpha beta", "Expected", ["alpha", "beta", "gamma"]);

    expect(result.score).toBe(67);
  });

  it("matches concepts case-insensitively", () => {
    const result = accuracy.partialCredit("Alpha", "Expected", ["alpha"]);

    expect(result.score).toBe(100);
  });

  it("returns 0 when concepts array is empty", () => {
    const result = accuracy.partialCredit("alpha beta", "Expected", []);

    expect(result.score).toBe(0);
    expect(result.reasoning).toContain("No concepts provided");
  });
});

describe("semanticSimilarity", () => {
  beforeEach(() => {
    vi.mocked(getSemanticSimilarityScore).mockResolvedValue(baseSemanticResult);
  });

  it("returns 100 for identical text", async () => {
    vi.mocked(getSemanticSimilarityScore).mockResolvedValueOnce({
      ...baseSemanticResult,
      score: 100,
    });

    const result = await accuracy.semanticSimilarity("Same", "Same");

    expect(result.score).toBe(100);
  });

  it("returns low score for different text", async () => {
    vi.mocked(getSemanticSimilarityScore).mockResolvedValueOnce({
      ...baseSemanticResult,
      score: 10,
    });

    const result = await accuracy.semanticSimilarity("Apple", "Banana");

    expect(result.score).toBe(10);
  });

  it("returns high score for similar meaning", async () => {
    vi.mocked(getSemanticSimilarityScore).mockResolvedValueOnce({
      ...baseSemanticResult,
      score: 85,
    });

    const result = await accuracy.semanticSimilarity("Fast car", "Quick automobile");

    expect(result.score).toBe(85);
  });

  it("returns 0 when scoring fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getSemanticSimilarityScore).mockRejectedValueOnce(new Error("API failure"));

    const result = await accuracy.semanticSimilarity("A", "B");

    expect(result.score).toBe(0);
    expect(result.reasoning).toBe("Failed to calculate semantic similarity");
    errorSpy.mockRestore();
  });
});

describe("calculateAccuracy", () => {
  it("dispatches to the correct rubric", async () => {
    const exactResult = await accuracy.calculateAccuracy("exact_match", "A", "A");
    expect(exactResult.score).toBe(100);

    const partialResult = await accuracy.calculateAccuracy("partial_credit", "A", "A", ["a", "b"]);
    expect(partialResult.score).toBe(50);

    vi.mocked(getSemanticSimilarityScore).mockResolvedValueOnce({
      ...baseSemanticResult,
      score: 77,
      reasoning: "Semantic check",
    });
    const semanticResult = await accuracy.calculateAccuracy("semantic_similarity", "A", "A");

    expect(semanticResult.score).toBe(77);
    expect(getSemanticSimilarityScore).toHaveBeenCalled();
  });

  it("includes reasoning in response", async () => {
    const result = await accuracy.calculateAccuracy("exact_match", "A", "A");

    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});
