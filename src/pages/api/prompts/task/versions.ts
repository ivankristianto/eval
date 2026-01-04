// src/pages/api/prompts/task/versions.ts
// API endpoints for task prompt versions

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import {
  listTaskPromptVersions,
  createTaskPromptVersion,
} from '@lib/training/version-manager';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { parseJsonBody } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:Prompts:Task:Versions');

/**
 * GET /api/prompts/task/versions?persona_id=<id>
 * Lists all task prompt versions for a persona
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();
  const personaId = url.searchParams.get('persona_id');

  try {
    if (!personaId) {
      logger.logApiRequest('GET', '/api/prompts/task/versions', 400, Date.now() - startTime);
      return badRequest('persona_id query parameter is required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(personaId);
    if (!persona) {
      logger.logApiRequest('GET', `/api/prompts/task/versions?persona_id=${personaId}`, 404, Date.now() - startTime);
      return notFound('Persona');
    }

    // Get all task prompt versions
    const versions = listTaskPromptVersions(personaId, db);

    logger.logApiRequest('GET', `/api/prompts/task/versions?persona_id=${personaId}`, 200, Date.now() - startTime);

    return new Response(
      JSON.stringify({
        versions,
        count: versions.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logger.logApiError('GET', `/api/prompts/task/versions?persona_id=${personaId}`, error as Error);
    return createErrorResponse(error);
  }
};

/**
 * POST /api/prompts/task/versions
 * Creates a new task prompt version
 *
 * Request body:
 * {
 *   persona_id: string;
 *   prompt_text: string;
 *   improvement_rationale?: string;
 *   label?: string;
 *   created_by: 'human' | 'ai';
 * }
 */
export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      persona_id: string;
      prompt_text: string;
      improvement_rationale?: string;
      label?: string;
      created_by: 'human' | 'ai';
    }>(request);

    const { persona_id, prompt_text, improvement_rationale, label, created_by } = body;

    if (!persona_id) {
      logger.logApiRequest('POST', '/api/prompts/task/versions', 400, Date.now() - startTime);
      return badRequest('persona_id is required', 'INVALID_REQUEST');
    }

    if (!prompt_text) {
      logger.logApiRequest('POST', '/api/prompts/task/versions', 400, Date.now() - startTime);
      return badRequest('prompt_text is required', 'INVALID_REQUEST');
    }

    if (!created_by || (created_by !== 'human' && created_by !== 'ai')) {
      logger.logApiRequest('POST', '/api/prompts/task/versions', 400, Date.now() - startTime);
      return badRequest('created_by must be "human" or "ai"', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Create new task prompt version
    const version = createTaskPromptVersion(
      {
        persona_id,
        prompt_text,
        improvement_rationale,
        label,
        created_by,
      },
      db
    );

    logger.logApiRequest('POST', '/api/prompts/task/versions', 201, Date.now() - startTime);

    return new Response(JSON.stringify(version), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('POST', '/api/prompts/task/versions', error as Error);
    return createErrorResponse(error);
  }
};
