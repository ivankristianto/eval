// src/pages/api/templates/[id]/history.ts
// Get template evaluation history

import type { APIRoute } from 'astro';
import { getTemplateById, getTemplateHistory } from '../../../../lib/db';

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_INPUT',
          message: 'Template ID is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const template = getTemplateById(id);

    if (!template) {
      return new Response(
        JSON.stringify({
          error: 'TEMPLATE_NOT_FOUND',
          message: 'Template does not exist',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse pagination params
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

    const history = getTemplateHistory(id, limit, offset);

    return new Response(
      JSON.stringify({
        template_id: template.id,
        template_name: template.name,
        total_runs: template.run_count,
        runs: history,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/templates/:id/history error:', error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
