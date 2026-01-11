// src/pages/api/personas/[id]/prompts.ts
// API endpoint to fetch judge prompt versions for a persona

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import type { JudgePromptVersion } from '@src-types/training';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Personas:Prompts');

// GET /api/personas/[id]/prompts - Get all judge prompt versions for a persona
/**
 * GET /api/personas/[id]/prompts
 * Retrieves all judge prompt versions for a specific persona.
 * Sorted by version number descending.
 * @param root0
 * @param root0.params
 */
export const GET: APIRoute = async ({ params }) => {
  const startTime = Date.now();
  const { id } = params;

  try {
    if (!id) {
      logger.logApiRequest('GET', '/api/personas/[id]/prompts', 400, Date.now() - startTime);
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest('GET', `/api/personas/${id}/prompts`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    // Fetch all prompt versions sorted by version (newest first)
    const prompts = db
      .prepare(
        `
      SELECT
        id,
        persona_id,
        version_number,
        prompt_text,
        improvement_rationale,
        created_by,
        created_at
      FROM judge_prompt_versions
      WHERE persona_id = ?
      ORDER BY version_number DESC
    `
      )
      .all(id) as JudgePromptVersion[];

    logger.logApiRequest('GET', `/api/personas/${id}/prompts`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        prompts,
        count: prompts.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/personas/${id}/prompts`, error as Error);
    return createErrorResponse(error);
  }
};
