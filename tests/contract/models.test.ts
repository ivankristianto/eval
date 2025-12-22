import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST as createModel, GET as listModels } from "../../src/pages/api/models";
import {
  GET as getModel,
  PATCH as patchModel,
  DELETE as deleteModel,
} from "../../src/pages/api/models/[id]";
import { ClientFactory } from "../../src/lib/api-clients";
import * as db from "../../src/lib/db";
import { createMockDb } from "../helpers/mock-db";
import { createJsonRequest, readJson } from "../helpers/requests";

const mockDb = createMockDb();

beforeEach(() => {
  mockDb.reset();
  vi.spyOn(db, "insertModel").mockImplementation(mockDb.insertModel);
  vi.spyOn(db, "getModels").mockImplementation(mockDb.getModels);
  vi.spyOn(db, "getModelById").mockImplementation(mockDb.getModelById);
  vi.spyOn(db, "updateModel").mockImplementation(mockDb.updateModel);
  vi.spyOn(db, "deleteModel").mockImplementation(mockDb.deleteModel);
  vi.spyOn(db, "getModelUsageCount").mockImplementation(mockDb.getModelUsageCount);
  vi.spyOn(db, "hasActiveEvaluations").mockImplementation(mockDb.hasActiveEvaluations);
  vi.spyOn(ClientFactory, "testConnection").mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/models", () => {
  it("creates a model with valid input", async () => {
    const request = createJsonRequest("http://localhost/api/models", {
      provider: "openai",
      model_name: "gpt-4",
      api_key: "sk-test-123",
      notes: "Primary model",
    });

    const response = await createModel({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      provider: "openai",
      model_name: "gpt-4",
      is_active: true,
      validation_status: "valid",
    });
    expect(typeof body.id).toBe("string");
  });

  it("rejects invalid providers", async () => {
    const request = createJsonRequest("http://localhost/api/models", {
      provider: "invalid",
      model_name: "gpt-4",
      api_key: "sk-test-123",
    });

    const response = await createModel({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: "INVALID_PROVIDER", field: "provider" });
  });
});

describe("GET /api/models", () => {
  it("lists models with usage counts", async () => {
    mockDb.insertModel("openai", "gpt-4", "sk-test");
    mockDb.insertModel("anthropic", "claude-3", "sk-ant-test");

    const url = new URL("http://localhost/api/models?active_only=true");
    const response = await listModels({ url } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.models).toHaveLength(2);
    expect(body.models[0]).toHaveProperty("usage_count");
  });
});

describe("GET /api/models/:id", () => {
  it("returns model details", async () => {
    const model = mockDb.insertModel("google", "gemini-pro", "google-key-12345");

    const response = await getModel({ params: { id: model.id } } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: model.id,
      provider: "google",
      model_name: "gemini-pro",
      is_active: true,
    });
  });
});

describe("PATCH /api/models/:id", () => {
  it("blocks disabling models with active evaluations", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    mockDb.setModelHasActiveEvaluation(model.id, true);

    const request = createJsonRequest(
      `http://localhost/api/models/${model.id}`,
      { is_active: false },
      "PATCH"
    );
    const response = await patchModel({ params: { id: model.id }, request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ error: "CANNOT_UPDATE", model_id: model.id });
  });
});

describe("DELETE /api/models/:id", () => {
  it("deletes a model without results", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");

    const response = await deleteModel({ params: { id: model.id } } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: model.id, message: "Model deleted successfully" });
  });

  it("prevents deletion if results exist", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const evaluation = mockDb.insertEvaluation("Prompt", "exact_match", "Expected");
    mockDb.insertResult(evaluation.id, model.id);

    const response = await deleteModel({ params: { id: model.id } } as never);
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ error: "CANNOT_DELETE", model_id: model.id });
  });
});
