import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createTemplate, GET as listTemplates } from "../../src/pages/api/templates";
import {
  GET as getTemplate,
  PATCH as updateTemplate,
  DELETE as deleteTemplate,
} from "../../src/pages/api/templates/[id]";
import { POST as runTemplate } from "../../src/pages/api/templates/[id]/run";
import * as db from "../../src/lib/db";
import * as evaluator from "../../src/lib/evaluator";
import { createMockDb } from "../helpers/mock-db";
import { createJsonRequest, readJson } from "../helpers/requests";

const mockDb = createMockDb();

beforeEach(() => {
  mockDb.reset();
  vi.spyOn(db, "insertTemplate").mockImplementation(mockDb.insertTemplate);
  vi.spyOn(db, "getTemplates").mockImplementation(mockDb.getTemplates);
  vi.spyOn(db, "getTemplateById").mockImplementation(mockDb.getTemplateById);
  vi.spyOn(db, "updateTemplate").mockImplementation(mockDb.updateTemplate);
  vi.spyOn(db, "deleteTemplate").mockImplementation(mockDb.deleteTemplate);
  vi.spyOn(db, "getModelById").mockImplementation(mockDb.getModelById);
  vi.spyOn(db, "insertEvaluation").mockImplementation(mockDb.insertEvaluation);
  vi.spyOn(db, "insertResult").mockImplementation(mockDb.insertResult);
  vi.spyOn(db, "incrementTemplateRunCount").mockImplementation(mockDb.incrementTemplateRunCount);
  vi.spyOn(evaluator, "startEvaluation").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/templates", () => {
  it("creates a template with valid input", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const request = createJsonRequest("http://localhost/api/templates", {
      name: "My Template",
      instruction_text: "Explain the topic.",
      model_ids: [model.id],
      accuracy_rubric: "exact_match",
      expected_output: "Expected",
    });

    const response = await createTemplate({ request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      name: "My Template",
      model_count: 1,
      accuracy_rubric: "exact_match",
      run_count: 0,
    });
  });
});

describe("GET /api/templates", () => {
  it("lists templates with summary fields", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    mockDb.insertTemplate(
      "Template A",
      "Instruction A",
      [model.id],
      "exact_match",
      "Description",
      "Expected"
    );

    const url = new URL("http://localhost/api/templates");
    const response = await listTemplates({ url } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0]).toMatchObject({
      name: "Template A",
      model_count: 1,
    });
  });
});

describe("GET /api/templates/:id", () => {
  it("returns template details and model info", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const template = mockDb.insertTemplate(
      "Template B",
      "Instruction B",
      [model.id],
      "exact_match",
      undefined,
      "Expected"
    );

    const response = await getTemplate({ params: { id: template.id } } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: template.id,
      name: "Template B",
      accuracy_rubric: "exact_match",
    });
    expect(body.models[0]).toMatchObject({ id: model.id, model_name: model.model_name });
  });
});

describe("PATCH /api/templates/:id", () => {
  it("updates template fields", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const template = mockDb.insertTemplate(
      "Template C",
      "Instruction C",
      [model.id],
      "exact_match",
      undefined,
      "Expected"
    );

    const request = createJsonRequest(
      `http://localhost/api/templates/${template.id}`,
      { name: "Template Updated" },
      "PATCH"
    );
    const response = await updateTemplate({ params: { id: template.id }, request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: template.id, name: "Template Updated" });
  });
});

describe("DELETE /api/templates/:id", () => {
  it("deletes a template", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const template = mockDb.insertTemplate(
      "Template D",
      "Instruction D",
      [model.id],
      "exact_match",
      undefined,
      "Expected"
    );

    const response = await deleteTemplate({ params: { id: template.id } } as never);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: template.id, message: "Template deleted successfully" });
  });
});

describe("POST /api/templates/:id/run", () => {
  it("creates evaluation from template", async () => {
    const model = mockDb.insertModel("openai", "gpt-4", "sk-test");
    const template = mockDb.insertTemplate(
      "Template E",
      "Instruction E",
      [model.id],
      "exact_match",
      undefined,
      "Expected"
    );

    const request = createJsonRequest(
      `http://localhost/api/templates/${template.id}/run`,
      { model_ids: [model.id] }
    );
    const response = await runTemplate({ params: { id: template.id }, request } as never);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      template_id: template.id,
      status: "pending",
    });
  });
});
