import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getResults } from "../../src/pages/api/results";
import * as db from "../../src/lib/db";
import { createMockDb } from "../helpers/mock-db";
import { readJson } from "../helpers/requests";

const mockDb = createMockDb();

beforeEach(() => {
  mockDb.reset();
  vi.spyOn(db, "getEvaluation").mockImplementation(mockDb.getEvaluation);
  vi.spyOn(db, "getResults").mockImplementation(mockDb.getResults);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/results", () => {
  it("requires evaluation_id query parameter", async () => {
    const url = new URL("http://localhost/api/results");
    const response = await getResults({ url } as never);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: "INVALID_INPUT" });
  });

  it("returns 404 for unknown evaluations", async () => {
    const url = new URL(
      "http://localhost/api/results?evaluation_id=11111111-1111-4111-8111-111111111111"
    );
    const response = await getResults({ url } as never);
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body).toMatchObject({ error: "EVALUATION_NOT_FOUND" });
  });

  it("returns sorted results for an evaluation", async () => {
    const modelA = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const modelB = mockDb.insertModel("anthropic", "claude-3", "sk-ant-test");
    const evaluation = mockDb.insertEvaluation("Prompt", "exact_match", "Expected");
    const resultA = mockDb.insertResult(evaluation.id, modelA.id);
    const resultB = mockDb.insertResult(evaluation.id, modelB.id);
    mockDb.updateResult(resultA.id, { accuracy_score: 10, status: "completed" });
    mockDb.updateResult(resultB.id, { accuracy_score: 95, status: "completed" });

    const url = new URL(`http://localhost/api/results?evaluation_id=${evaluation.id}`);
    const response = await getResults({ url } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.results[0].accuracy_score).toBe(95);
    expect(body.results[1].accuracy_score).toBe(10);
  });
});
