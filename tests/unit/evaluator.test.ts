import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelConfiguration, Result, ResultStatus } from "../../src/lib/types";
import {
  EvaluationExecutor,
  cancelEvaluation,
  isEvaluationRunning,
  startEvaluation,
} from "../../src/lib/evaluator";
import { ClientFactory } from "../../src/lib/api-clients";
import { calculateAccuracy } from "../../src/lib/accuracy";
import {
  decryptApiKey,
  getEvaluation,
  getModelById,
  getResults,
  updateEvaluationStatus,
  updateResult,
} from "../../src/lib/db";

const models = new Map<string, ModelConfiguration>();
let results: Result[] = [];
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

vi.mock("../../src/lib/db", () => {
  return {
    getModelById: vi.fn(),
    getResults: vi.fn(),
    updateResult: vi.fn(),
    updateEvaluationStatus: vi.fn(),
    getEvaluation: vi.fn(),
    decryptApiKey: vi.fn(),
  };
});

vi.mock("../../src/lib/api-clients", () => ({
  ClientFactory: {
    createClient: vi.fn(),
  },
}));

vi.mock("../../src/lib/accuracy", () => ({
  calculateAccuracy: vi.fn(),
}));

const mockGetModelById = vi.mocked(getModelById);
const mockGetResults = vi.mocked(getResults);
const mockUpdateResult = vi.mocked(updateResult);
const mockUpdateEvaluationStatus = vi.mocked(updateEvaluationStatus);
const mockGetEvaluation = vi.mocked(getEvaluation);
const mockDecryptApiKey = vi.mocked(decryptApiKey);
const mockCreateClient = vi.mocked(ClientFactory.createClient);
const mockCalculateAccuracy = vi.mocked(calculateAccuracy);

const nowIso = () => new Date().toISOString();

const addModel = (overrides: Partial<ModelConfiguration> = {}) => {
  const model: ModelConfiguration = {
    id: overrides.id ?? `model-${models.size + 1}`,
    provider: overrides.provider ?? "openai",
    model_name: overrides.model_name ?? `model-${models.size + 1}`,
    api_key_encrypted: overrides.api_key_encrypted ?? "enc:token",
    created_at: overrides.created_at ?? nowIso(),
    updated_at: overrides.updated_at ?? nowIso(),
    is_active: overrides.is_active ?? true,
    notes: overrides.notes,
  };
  models.set(model.id, model);
  return model;
};

const addResult = (evaluationId: string, modelId: string) => {
  const result: Result = {
    id: `result-${results.length + 1}`,
    evaluation_id: evaluationId,
    model_id: modelId,
    status: "pending",
    created_at: nowIso(),
  };
  results.push(result);
  return result;
};

beforeEach(() => {
  models.clear();
  results = [];

  mockGetModelById.mockImplementation((id) => models.get(id) ?? null);
  mockGetResults.mockImplementation((evaluationId) =>
    results.filter((result) => result.evaluation_id === evaluationId)
  );
  mockUpdateResult.mockImplementation((id, updates) => {
    const result = results.find((entry) => entry.id === id);
    if (result) Object.assign(result, updates);
  });
  mockUpdateResult.mockClear();
  mockUpdateEvaluationStatus.mockReset();
  mockGetEvaluation.mockReset();
  mockDecryptApiKey.mockImplementation((encrypted) => encrypted.replace(/^enc:/, ""));
  mockCreateClient.mockReset();
  mockCalculateAccuracy.mockReset();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const restoreConsoleError = () => {
  if (consoleErrorSpy) {
    consoleErrorSpy.mockRestore();
    consoleErrorSpy = null;
  }
};

afterEach(() => {
  restoreConsoleError();
  vi.useRealTimers();
});

describe("EvaluationExecutor", () => {
  it("completes a single model evaluation", async () => {
    const evaluationId = "eval-1";
    const model = addModel({ model_name: "gpt-4" });
    const result = addResult(evaluationId, model.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockResolvedValue({
        response: "ok",
        inputTokens: 10,
        outputTokens: 12,
        totalTokens: 22,
        executionTime: 120,
      }),
    });
    mockCalculateAccuracy.mockResolvedValue({ score: 88, reasoning: "Solid" });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Say hi",
      rubricType: "exact_match",
      expectedOutput: "hi",
    });

    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(evaluationId, "running");
    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        status: "completed" as ResultStatus,
        response_text: "ok",
        accuracy_score: 88,
        accuracy_reasoning: "Solid",
      })
    );
    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(evaluationId, "completed");
  });

  it("evaluates multiple models in parallel", async () => {
    const evaluationId = "eval-2";
    const modelA = addModel({ model_name: "gpt-4" });
    const modelB = addModel({ model_name: "claude-3" });
    const resultA = addResult(evaluationId, modelA.id);
    const resultB = addResult(evaluationId, modelB.id);

    const evaluate = vi.fn().mockResolvedValue({
      response: "ok",
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
      executionTime: 50,
    });

    mockCreateClient.mockReturnValue({ evaluate });
    mockCalculateAccuracy.mockResolvedValue({ score: 90, reasoning: "Good" });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [modelA.id, modelB.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockCreateClient).toHaveBeenCalledTimes(2);
    expect(evaluate.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockUpdateResult).toHaveBeenCalledWith(
      resultA.id,
      expect.objectContaining({ status: "completed" as ResultStatus })
    );
    expect(mockUpdateResult).toHaveBeenCalledWith(
      resultB.id,
      expect.objectContaining({ status: "completed" as ResultStatus })
    );
  });

  it("enforces the per-model timeout", async () => {
    vi.useFakeTimers();
    const evaluationId = "eval-3";
    const model = addModel({ model_name: "slow" });
    const result = addResult(evaluationId, model.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn(() => new Promise(() => undefined)),
    });

    const executor = new EvaluationExecutor();
    const runPromise = executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Timeout",
      rubricType: "exact_match",
      expectedOutput: "Timeout",
    });

    await vi.advanceTimersByTimeAsync(30000);
    await runPromise;

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        status: "failed" as ResultStatus,
        error_message: "Model timeout",
      })
    );
    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(
      evaluationId,
      "failed",
      "All models failed"
    );
  });

  it("continues other models after a timeout", async () => {
    vi.useFakeTimers();
    const evaluationId = "eval-4";
    const fastModel = addModel({ model_name: "fast" });
    const slowModel = addModel({ model_name: "slow" });
    const fastResult = addResult(evaluationId, fastModel.id);
    const slowResult = addResult(evaluationId, slowModel.id);

    mockCreateClient.mockImplementation((_provider, _apiKey, modelName) => {
      if (modelName === "slow") {
        return { evaluate: vi.fn(() => new Promise(() => undefined)) };
      }
      return {
        evaluate: vi.fn().mockResolvedValue({
          response: "ok",
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          executionTime: 25,
        }),
      };
    });

    mockCalculateAccuracy.mockResolvedValue({ score: 70, reasoning: "Ok" });

    const executor = new EvaluationExecutor();
    const runPromise = executor.execute({
      evaluationId,
      modelIds: [fastModel.id, slowModel.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    await vi.advanceTimersByTimeAsync(30000);
    await runPromise;

    expect(mockUpdateResult).toHaveBeenCalledWith(
      fastResult.id,
      expect.objectContaining({ status: "completed" as ResultStatus })
    );
    expect(mockUpdateResult).toHaveBeenCalledWith(
      slowResult.id,
      expect.objectContaining({ status: "failed" as ResultStatus })
    );
    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(evaluationId, "completed");
  });

  it("stores execution time without alteration", async () => {
    const evaluationId = "eval-5";
    const model = addModel({ model_name: "timed" });
    const result = addResult(evaluationId, model.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockResolvedValue({
        response: "ok",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        executionTime: 212,
      }),
    });
    mockCalculateAccuracy.mockResolvedValue({ score: 60, reasoning: "Ok" });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({ execution_time_ms: 212 })
    );
  });

  it("supports cancellation of active evaluations", async () => {
    const evaluationId = "eval-6";
    const model = addModel({ model_name: "gpt-4" });
    addResult(evaluationId, model.id);
    mockGetEvaluation.mockReturnValue({
      id: evaluationId,
      instruction_text: "Test",
      accuracy_rubric: "exact_match",
      status: "running",
      created_at: nowIso(),
    });

    let resolveExecute: () => void;
    const executePromise = new Promise<void>((resolve) => {
      resolveExecute = resolve;
    });

    const executeSpy = vi
      .spyOn(EvaluationExecutor.prototype, "execute")
      .mockReturnValue(executePromise);

    startEvaluation({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    const cancelled = cancelEvaluation(evaluationId);
    resolveExecute!();
    await executePromise;

    expect(cancelled).toBe(true);
    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(
      evaluationId,
      "failed",
      "Cancelled by user"
    );

    executeSpy.mockRestore();
  });

  it("persists successful results", async () => {
    const evaluationId = "eval-7";
    const model = addModel({ model_name: "persist" });
    const result = addResult(evaluationId, model.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockResolvedValue({
        response: "hello",
        inputTokens: 5,
        outputTokens: 6,
        totalTokens: 11,
        executionTime: 40,
      }),
    });
    mockCalculateAccuracy.mockResolvedValue({ score: 92, reasoning: "Great" });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "hello",
      rubricType: "exact_match",
      expectedOutput: "hello",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        response_text: "hello",
        input_tokens: 5,
        output_tokens: 6,
        total_tokens: 11,
        accuracy_score: 92,
        accuracy_reasoning: "Great",
        status: "completed" as ResultStatus,
      })
    );
  });

  it("records API failures", async () => {
    const evaluationId = "eval-8";
    const model = addModel({ model_name: "fails" });
    const result = addResult(evaluationId, model.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockRejectedValue(new Error("API failure")),
    });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        status: "failed" as ResultStatus,
        error_message: "API failure",
      })
    );
  });

  it("records rate limit failures", async () => {
    const evaluationId = "eval-9";
    const model = addModel({ model_name: "rate-limited" });
    const result = addResult(evaluationId, model.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockRejectedValue(new Error("HTTP 429")),
    });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        status: "failed" as ResultStatus,
        error_message: "HTTP 429",
      })
    );
  });

  it("marks evaluation failed when all models fail", async () => {
    const evaluationId = "eval-10";
    const modelA = addModel({ model_name: "fail-a" });
    const modelB = addModel({ model_name: "fail-b" });
    const resultA = addResult(evaluationId, modelA.id);
    const resultB = addResult(evaluationId, modelB.id);

    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockRejectedValue(new Error("API failure")),
    });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [modelA.id, modelB.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      resultA.id,
      expect.objectContaining({ status: "failed" as ResultStatus })
    );
    expect(mockUpdateResult).toHaveBeenCalledWith(
      resultB.id,
      expect.objectContaining({ status: "failed" as ResultStatus })
    );
    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(
      evaluationId,
      "failed",
      "All models failed"
    );
  });

  it("handles missing result records gracefully", async () => {
    const evaluationId = "eval-11";
    const model = addModel({ model_name: "missing-result" });

    mockGetResults.mockReturnValueOnce([]);
    mockCreateClient.mockReturnValue({
      evaluate: vi.fn().mockResolvedValue({
        response: "ok",
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        executionTime: 5,
      }),
    });

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `No result record found for model ${model.id}`
    );
    expect(mockUpdateResult).not.toHaveBeenCalled();
  });

  it("records missing model configuration failures", async () => {
    const evaluationId = "eval-12";
    const missingModelId = "model-missing";
    const result = addResult(evaluationId, missingModelId);

    mockGetModelById.mockReturnValueOnce(null);

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [missingModelId],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        status: "failed" as ResultStatus,
        error_message: "Model not found",
      })
    );
  });

  it("records inactive model failures", async () => {
    const evaluationId = "eval-13";
    const model = addModel({ model_name: "inactive", is_active: false });
    const result = addResult(evaluationId, model.id);

    const executor = new EvaluationExecutor();
    await executor.execute({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({
        status: "failed" as ResultStatus,
        error_message: "Model is inactive",
      })
    );
  });

  it("handles evaluation timeouts", () => {
    const evaluationId = "eval-14";
    const model = addModel({ model_name: "pending" });
    const result = addResult(evaluationId, model.id);
    result.status = "pending";

    const executor = new EvaluationExecutor();
    (executor as unknown as { handleTimeout: (id: string) => void }).handleTimeout(
      evaluationId
    );

    expect(mockUpdateEvaluationStatus).toHaveBeenCalledWith(
      evaluationId,
      "failed",
      "Evaluation timed out after 5 minutes"
    );
    expect(mockUpdateResult).toHaveBeenCalledWith(
      result.id,
      expect.objectContaining({ status: "failed" as ResultStatus, error_message: "Timeout" })
    );
  });
});

describe("evaluation lifecycle helpers", () => {
  it("reports when no evaluation is running", () => {
    expect(cancelEvaluation("missing")).toBe(false);
  });

  it("tracks running evaluations", async () => {
    const evaluationId = "eval-running";
    const model = addModel({ model_name: "tracked" });
    addResult(evaluationId, model.id);

    let resolveExecute: () => void;
    const executePromise = new Promise<void>((resolve) => {
      resolveExecute = resolve;
    });

    const executeSpy = vi
      .spyOn(EvaluationExecutor.prototype, "execute")
      .mockReturnValue(executePromise);

    startEvaluation({
      evaluationId,
      modelIds: [model.id],
      instruction: "Test",
      rubricType: "exact_match",
      expectedOutput: "Test",
    });

    expect(isEvaluationRunning(evaluationId)).toBe(true);
    expect(cancelEvaluation(evaluationId)).toBe(true);
    resolveExecute!();
    await executePromise;

    executeSpy.mockRestore();
  });
});
