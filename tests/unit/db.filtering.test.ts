import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

let dbModule: typeof import("../../src/lib/db");
let dbPath = "";

const encryptionKey = "a".repeat(64);

const createModel = () =>
  dbModule.insertModel("openai", `gpt-${Math.random()}`, "sk-test", "notes");

const createEvaluation = (rubric = "exact_match", createdOffset = 0) => {
  const evaluation = dbModule.insertEvaluation(`Test ${Math.random()}`, rubric as any, "Expected");
  // Update created_at directly to simulate different times if needed
  if (createdOffset !== 0) {
    const db = dbModule.getDatabase();
    const newDate = new Date(Date.now() - createdOffset).toISOString();
    db.prepare("UPDATE Evaluation SET created_at = ? WHERE id = ?").run(newDate, evaluation.id);
    evaluation.created_at = newDate;
  }
  return evaluation;
};

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-db-filtering-"));
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

describe("Evaluation Filtering", () => {
  it("paginates results correctly", () => {
    for (let i = 0; i < 15; i++) {
      createEvaluation();
    }

    // This call will likely fail type checking or runtime execution until DB is updated
    // @ts-ignore
    const page1 = dbModule.getEvaluations(undefined, 10, 0);
    // @ts-ignore
    const page2 = dbModule.getEvaluations(undefined, 10, 10);

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(5);
  });

  it("filters by date range", () => {
    const oldEval = createEvaluation("exact_match", 1000 * 60 * 60 * 24 * 10); // 10 days ago
    const newEval = createEvaluation("exact_match", 1000 * 60 * 60); // 1 hour ago

    // @ts-ignore
    const results = dbModule.getEvaluations(undefined, 50, 0, {
      fromDate: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // Last 24 hours
    });

    expect(results.some((e: any) => e.id === newEval.id)).toBe(true);
    expect(results.some((e: any) => e.id === oldEval.id)).toBe(false);
  });

  it("filters by rubric type", () => {
    createEvaluation("exact_match");
    createEvaluation("semantic_similarity");

    // @ts-ignore
    const results = dbModule.getEvaluations(undefined, 50, 0, {
      rubric: "exact_match",
    });

    expect(results).toHaveLength(1);
    expect(results[0].accuracy_rubric).toBe("exact_match");
  });

  it("filters by minimum accuracy score", () => {
    const highEval = createEvaluation();
    const lowEval = createEvaluation();
    const model = createModel();

    // Insert results
    const r1 = dbModule.insertResult(highEval.id, model.id);
    dbModule.updateResult(r1.id, { accuracy_score: 0.9, status: "completed" });

    const r2 = dbModule.insertResult(lowEval.id, model.id);
    dbModule.updateResult(r2.id, { accuracy_score: 0.4, status: "completed" });

    // @ts-ignore
    const results = dbModule.getEvaluations(undefined, 50, 0, {
      minScore: 0.8,
    });

    expect(results.some((e: any) => e.id === highEval.id)).toBe(true);
    expect(results.some((e: any) => e.id === lowEval.id)).toBe(false);
  });
});
