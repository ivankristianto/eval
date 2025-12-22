import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createEvaluation } from "../../src/pages/api/evaluate";
import { GET as getStatus } from "../../src/pages/api/evaluation-status";
import { POST as cancelEvaluation } from "../../src/pages/api/cancel-evaluation";
import * as db from "../../src/lib/db";
import * as evaluator from "../../src/lib/evaluator";
import { createMockDb } from "../helpers/mock-db";
import { createJsonRequest, readJson } from "../helpers/requests";

const mockDb = createMockDb();

beforeEach(() => {
  mockDb.reset();
  vi.spyOn(db, "insertEvaluation").mockImplementation(mockDb.insertEvaluation);
  vi.spyOn(db, "insertResult").mockImplementation(mockDb.insertResult);
  vi.spyOn(db, "getModelById").mockImplementation(mockDb.getModelById);
  vi.spyOn(db, "getEvaluationStatus").mockImplementation(mockDb.getEvaluationStatus);
  vi.spyOn(db, "getEvaluation").mockImplementation(mockDb.getEvaluation);
  vi.spyOn(evaluator, "startEvaluation").mockImplementation(() => undefined);
  vi.spyOn(evaluator, "cancelEvaluation").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/evaluate", () => {
  it("creates an evaluation for active models", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const request = createJsonRequest("http://localhost/api/evaluate", {
      instruction: "Summarize the article.",
      model_ids: [model.id],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    const response = await createEvaluation({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      status: "pending",
      models: [
        {
          model_id: model.id,
          model_name: model.model_name,
          provider: model.provider,
          status: "pending",
        },
      ],
    });
    expect(typeof body.evaluation_id).toBe("string");
  });

  it("rejects missing models", async () => {
    const request = createJsonRequest("http://localhost/api/evaluate", {
      instruction: "Summarize the article.",
      model_ids: ["11111111-1111-4111-8111-111111111111"],
      rubric_type: "exact_match",
      expected_output: "Summary",
    });

    const response = await createEvaluation({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: "MODEL_INACTIVE" });
  });
});

describe("GET /api/evaluation-status", () => {
  it("requires evaluation_id query parameter", async () => {
    const url = new URL("http://localhost/api/evaluation-status");
    const response = await getStatus({ url } as never);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: "INVALID_INPUT" });
  });
});

describe("POST /api/cancel-evaluation", () => {
  it("rejects cancelling completed evaluations", async () => {
    const evaluation = mockDb.insertEvaluation("Prompt", "exact_match", "Expected");
    mockDb.updateEvaluationStatus(evaluation.id, "completed");

    const request = createJsonRequest("http://localhost/api/cancel-evaluation", {
      evaluation_id: evaluation.id,
    });
    const response = await cancelEvaluation({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ error: "CANNOT_CANCEL", status: "completed" });
  });
});
