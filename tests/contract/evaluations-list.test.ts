import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/pages/api/evaluations/index';
import * as db from '../../src/lib/db';
import { createMockDb } from '../helpers/mock-db';
import { readJson } from '../helpers/requests';

const mockDb = createMockDb();

beforeEach(() => {
  mockDb.reset();
  // We need to spy on db.getEvaluations which might not exist on the real module yet
  // but we can spy on it if we assume it will exist or mock the whole module.
  // Since we are importing * as db, we can try to spy on it if it's exported.
  // If getEvaluations is not exported yet in db.ts, this might fail at runtime.
  // But we are in TDD, so we should have updated db.ts first?
  // Task T008 is "Update src/lib/db.ts".
  // Task T005 was "Create unit tests for db.ts".
  // So T008 (impl) comes AFTER T006 (contract test).
  // This means db.getEvaluations DOES NOT EXIST yet.

  // To make this test file valid TypeScript, we might need to cast db as any or mock it completely.
  vi.spyOn(db, 'getEvaluations' as any).mockImplementation(() => []);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/evaluations', () => {
  it('returns paginated evaluations', async () => {
    const url = new URL('http://localhost/api/evaluations?limit=10&offset=0');

    // Mock return value
    const mockEvaluations = Array(10).fill({ id: '1' });
    vi.spyOn(db, 'getEvaluations' as any).mockReturnValue(mockEvaluations);
    vi.spyOn(db, 'getEvaluationsCount' as any).mockReturnValue(10);

    // We assume the API calls db.getEvaluations
    const response = await GET({ url } as any);
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(10);
    expect(body.pageSize).toBe(10);
    expect(body.page).toBe(1);
    expect(body.total).toBe(10);
  });

  it('filters by date range', async () => {
    const url = new URL('http://localhost/api/evaluations?fromDate=2023-01-01');

    vi.spyOn(db, 'getEvaluations' as any).mockReturnValue([]);
    vi.spyOn(db, 'getEvaluationsCount' as any).mockReturnValue(0);

    await GET({ url } as any);

    expect(db.getEvaluations).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: '2023-01-01' }),
      50, // limit
      0 // offset
    );
  });
});
