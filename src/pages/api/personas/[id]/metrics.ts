/**
 * Metrics API Endpoint
 * GET /api/personas/[id]/metrics
 * Returns lightweight metrics data optimized for chart rendering
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../../lib/db';
import { getPersonaMetricsHistory } from '../../../../lib/metrics-orchestrator';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Persona ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(id);

    if (!persona) {
      return new Response(JSON.stringify({ error: 'Persona not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch metrics history
    const metricsHistory = getPersonaMetricsHistory(id, db);

    // Transform to chart-optimized format
    const metrics = metricsHistory.map((item) => ({
      iteration: item.iteration_number,
      f1_score: item.metrics.f1_score,
      precision: item.metrics.precision,
      recall: item.metrics.recall,
      cohens_kappa: item.metrics.cohens_kappa,
      timestamp: item.calculated_at,
    }));

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
