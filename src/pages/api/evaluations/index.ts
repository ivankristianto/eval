import type { APIRoute } from 'astro';
import { getEvaluations, getEvaluationsCount, deleteEvaluations } from '../../../lib/db';
import type { RubricType } from '../../../lib/types';

export const GET: APIRoute = async ({ url }) => {
  const limit = Number(url.searchParams.get('limit')) || 10;
  const offset = Number(url.searchParams.get('offset')) || 0;

  const filters = {
    templateId: url.searchParams.get('template') || undefined,
    fromDate: url.searchParams.get('fromDate') || undefined,
    toDate: url.searchParams.get('toDate') || undefined,
    rubric: (url.searchParams.get('rubric') as RubricType) || undefined,
    minScore: url.searchParams.get('minScore')
      ? Number(url.searchParams.get('minScore'))
      : undefined,
  };

  try {
    const items = getEvaluations(filters, limit, offset);
    const total = getEvaluationsCount(filters);

    return new Response(
      JSON.stringify({
        items,
        total,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid IDs' }), { status: 400 });
    }

    const count = deleteEvaluations(ids);

    return new Response(JSON.stringify({ deleted: count }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};
