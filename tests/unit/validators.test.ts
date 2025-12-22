import { describe, expect, it } from "vitest";
import {
  validateCreateEvaluation,
  validateCreateModel,
  validateCreateTemplate,
  validateUpdateModel,
} from "../../src/lib/validators";

const validUuid = "11111111-1111-4111-8111-111111111111";

describe("validateCreateModel", () => {
  it("accepts valid input", () => {
    const result = validateCreateModel({
      provider: "openai",
      model_name: "gpt-4",
      api_key: "sk-test-123",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = validateCreateModel({});

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_PROVIDER");
  });

  it("rejects invalid providers", () => {
    const result = validateCreateModel({
      provider: "invalid",
      model_name: "gpt-4",
      api_key: "sk-test-123",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_PROVIDER");
  });

  it("rejects model names longer than 100 characters", () => {
    const result = validateCreateModel({
      provider: "openai",
      model_name: "a".repeat(101),
      api_key: "sk-test-123",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("model_name");
  });
});

describe("validateUpdateModel", () => {
  it("accepts a valid partial update", () => {
    const result = validateUpdateModel({ is_active: false, notes: "Update notes" });

    expect(result.valid).toBe(true);
  });

  it("rejects invalid field types", () => {
    const result = validateUpdateModel({ is_active: "nope", notes: 12, api_key: 42 });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_INPUT");
  });

  it("rejects empty api_key updates", () => {
    const result = validateUpdateModel({ api_key: "  " });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_API_KEY");
  });
});

describe("validateCreateEvaluation", () => {
  it("accepts valid input", () => {
    const result = validateCreateEvaluation({
      instruction: "Summarize the article.",
      model_ids: [validUuid],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects missing instructions", () => {
    const result = validateCreateEvaluation({
      model_ids: [validUuid],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("instruction");
  });

  it("rejects instructions longer than 10,000 characters", () => {
    const result = validateCreateEvaluation({
      instruction: "a".repeat(10001),
      model_ids: [validUuid],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("instruction");
  });

  it("rejects invalid rubric types", () => {
    const result = validateCreateEvaluation({
      instruction: "Summarize the article.",
      model_ids: [validUuid],
      rubric_type: "invalid",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_RUBRIC");
  });

  it("rejects partial credit without concepts", () => {
    const result = validateCreateEvaluation({
      instruction: "Summarize the article.",
      model_ids: [validUuid],
      rubric_type: "partial_credit",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("MISSING_RUBRIC_CONFIG");
  });

  it("rejects empty model selections", () => {
    const result = validateCreateEvaluation({
      instruction: "Summarize the article.",
      model_ids: [],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_MODEL_SELECTION");
  });

  it("rejects invalid model ids", () => {
    const result = validateCreateEvaluation({
      instruction: "Summarize the article.",
      model_ids: ["not-a-uuid"],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_MODEL_SELECTION");
  });

  it("rejects missing expected output", () => {
    const result = validateCreateEvaluation({
      instruction: "Summarize the article.",
      model_ids: [validUuid],
      rubric_type: "exact_match",
      expected_output: " ",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("expected_output");
  });
});

describe("validateCreateTemplate", () => {
  it("accepts valid template input", () => {
    const result = validateCreateTemplate({
      name: "Template A",
      instruction_text: "Explain the topic.",
      model_ids: [validUuid],
      accuracy_rubric: "exact_match",
      expected_output: "Expected output",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects missing name field", () => {
    const result = validateCreateTemplate({
      instruction_text: "Explain the topic.",
      model_ids: [validUuid],
      accuracy_rubric: "exact_match",
      expected_output: "Expected output",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("name");
  });

  it("rejects names longer than 100 characters", () => {
    const result = validateCreateTemplate({
      name: "a".repeat(101),
      instruction_text: "Explain the topic.",
      model_ids: [validUuid],
      accuracy_rubric: "exact_match",
      expected_output: "Expected output",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("name");
  });

  it("rejects invalid description types", () => {
    const result = validateCreateTemplate({
      name: "Template A",
      description: 42,
      instruction_text: "Explain the topic.",
      model_ids: [validUuid],
      accuracy_rubric: "exact_match",
      expected_output: "Expected output",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe("description");
  });

  it("rejects non-object payloads", () => {
    const result = validateCreateTemplate("bad input");

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_INPUT");
  });
});

describe("validateCreateModel api key formats", () => {
  it("rejects invalid anthropic api key format", () => {
    const result = validateCreateModel({
      provider: "anthropic",
      model_name: "claude-3-opus",
      api_key: "sk-123",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_API_KEY");
  });

  it("rejects short google api keys", () => {
    const result = validateCreateModel({
      provider: "google",
      model_name: "gemini-2.0",
      api_key: "short",
    });

    expect(result.valid).toBe(false);
    expect(result.error?.error).toBe("INVALID_API_KEY");
  });
});
