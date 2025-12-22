import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

let dbModule: typeof import("../../src/lib/db");
let dbPath = "";

const encryptionKey = "a".repeat(64);

const createModel = () =>
  dbModule.insertModel("openai", `gpt-${Math.random()}`, "sk-test", "notes");

const createEvaluation = () =>
  dbModule.insertEvaluation("Test instruction", "exact_match", "Expected output");

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-db-"));
  dbPath = join(dir, "evaluation.db");
  process.env.EVAL_DB_PATH = dbPath;
  process.env.ENCRYPTION_KEY = encryptionKey;
  vi.resetModules();
  dbModule = await import("../../src/lib/db");
  dbModule.initializeDatabase();
});

beforeEach(() => {
  const database = dbModule.getDatabase();
  database.exec(
    "DELETE FROM Result; DELETE FROM Evaluation; DELETE FROM EvaluationTemplate; DELETE FROM ModelConfiguration;"
  );
});

afterAll(() => {
  dbModule.closeDatabase();
  rmSync(dirname(dbPath), { recursive: true, force: true });
  delete process.env.EVAL_DB_PATH;
});

describe("ModelConfiguration CRUD", () => {
  it("inserts a model", () => {
    const model = dbModule.insertModel("openai", "gpt-4", "sk-test", "notes");

    expect(model.id).toBeTruthy();
    expect(model.provider).toBe("openai");
    expect(model.model_name).toBe("gpt-4");
    expect(model.is_active).toBe(true);
  });

  it("encrypts API keys on insert", () => {
    const model = dbModule.insertModel("openai", "gpt-4", "sk-secret");

    expect(model.api_key_encrypted).not.toBe("sk-secret");
    expect(dbModule.decryptApiKey(model.api_key_encrypted)).toBe("sk-secret");
  });

  it("rejects duplicate provider/model combinations", () => {
    dbModule.insertModel("openai", "gpt-4", "sk-1");

    expect(() => dbModule.insertModel("openai", "gpt-4", "sk-2")).toThrow();
  });

  it("returns a model and supports decrypting the key", () => {
    const model = dbModule.insertModel("openai", "gpt-4", "sk-secret");
    const fetched = dbModule.getModelById(model.id);

    expect(fetched).not.toBeNull();
    expect(dbModule.decryptApiKey(fetched!.api_key_encrypted)).toBe("sk-secret");
  });

  it("returns null when model is missing", () => {
    expect(dbModule.getModelById("missing-id")).toBeNull();
  });

  it("updates a model", () => {
    const model = dbModule.insertModel("openai", "gpt-4", "sk-secret");
    const updated = dbModule.updateModel(model.id, {
      is_active: false,
      notes: "updated",
      api_key: "sk-new",
    });

    expect(updated?.is_active).toBe(false);
    expect(updated?.notes).toBe("updated");
    expect(dbModule.decryptApiKey(updated!.api_key_encrypted)).toBe("sk-new");
  });

  it("deletes a model", () => {
    const model = dbModule.insertModel("openai", "gpt-4", "sk-secret");

    expect(dbModule.deleteModel(model.id)).toBe(true);
    expect(dbModule.getModelById(model.id)).toBeNull();
  });

  it("blocks deletion when active evaluations exist", () => {
    const model = dbModule.insertModel("openai", "gpt-4", "sk-secret");
    const evaluation = dbModule.insertEvaluation("Test", "exact_match", "Expected");
    dbModule.insertResult(evaluation.id, model.id);

    expect(() => dbModule.deleteModel(model.id)).toThrow();
  });
});

describe("Evaluation CRUD", () => {
  it("inserts an evaluation with pending status", () => {
    const evaluation = dbModule.insertEvaluation("Test", "exact_match", "Expected", ["a"]);

    expect(evaluation.status).toBe("pending");
    expect(evaluation.partial_credit_concepts).toEqual(["a"]);
  });

  it("updates evaluation status", () => {
    const evaluation = createEvaluation();

    dbModule.updateEvaluationStatus(evaluation.id, "running");
    let updated = dbModule.getEvaluation(evaluation.id);
    expect(updated?.status).toBe("running");

    dbModule.updateEvaluationStatus(evaluation.id, "completed");
    updated = dbModule.getEvaluation(evaluation.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.completed_at).toBeTruthy();
  });

  it("inserts results linked to evaluation and model", () => {
    const model = createModel();
    const evaluation = createEvaluation();

    const result = dbModule.insertResult(evaluation.id, model.id);
    expect(result.evaluation_id).toBe(evaluation.id);
    expect(result.model_id).toBe(model.id);
  });

  it("returns all results for an evaluation", () => {
    const modelA = createModel();
    const modelB = createModel();
    const evaluation = createEvaluation();

    dbModule.insertResult(evaluation.id, modelA.id);
    dbModule.insertResult(evaluation.id, modelB.id);

    const fetched = dbModule.getResults(evaluation.id);
    expect(fetched).toHaveLength(2);
    expect(fetched.map((item) => item.model_id).sort()).toEqual(
      [modelA.id, modelB.id].sort()
    );
  });
});

describe("Template CRUD", () => {
  it("inserts a template with model_ids", () => {
    const model = createModel();
    const template = dbModule.insertTemplate(
      "Template",
      "Instruction",
      [model.id],
      "exact_match",
      "desc",
      "Expected",
      ["concept"]
    );

    expect(template.model_ids).toEqual([model.id]);
    expect(template.accuracy_rubric).toBe("exact_match");
  });

  it("returns a template with parsed model_ids", () => {
    const model = createModel();
    const template = dbModule.insertTemplate(
      "Template",
      "Instruction",
      [model.id],
      "exact_match"
    );

    const fetched = dbModule.getTemplateById(template.id);
    expect(fetched?.model_ids).toEqual([model.id]);
  });

  it("updates a template", () => {
    const model = createModel();
    const template = dbModule.insertTemplate(
      "Template",
      "Instruction",
      [model.id],
      "exact_match"
    );

    const updated = dbModule.updateTemplate(template.id, {
      name: "Updated",
      model_ids: [model.id, "extra"],
    });

    expect(updated?.name).toBe("Updated");
    expect(updated?.model_ids).toEqual([model.id, "extra"]);
  });

  it("deletes a template", () => {
    const model = createModel();
    const template = dbModule.insertTemplate(
      "Template",
      "Instruction",
      [model.id],
      "exact_match"
    );

    expect(dbModule.deleteTemplate(template.id)).toBe(true);
    expect(dbModule.getTemplateById(template.id)).toBeNull();
  });
});
