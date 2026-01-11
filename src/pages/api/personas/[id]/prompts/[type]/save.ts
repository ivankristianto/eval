// src/pages/api/personas/[id]/prompts/[type]/save.ts
// API endpoint to save optimized prompts (task or judge) for a persona

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { badRequest, notFound, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('API:Personas:Prompts:Save');

/**
 * POST /api/personas/[id]/prompts/[type]/save
 * Saves a new prompt version for a persona.
 * Handles both task and judge prompt types.
 * Uses transaction to prevent version conflicts.
 *
 * Request body:
 * - prompt_text: string - The prompt text to save
 * - improvement_rationale?: string - Optional explanation of improvements
 * - label?: string - Optional display label
 *
 * @param root0
 * @param root0.params
 * @param root0.request
 */
export const POST: APIRoute = async ({ params, request }) => {
  const startTime = Date.now();
  const { id, type } = params;

  try {
    // Validate persona ID
    if (!id) {
      logger.logApiRequest(
        'POST',
        '/api/personas/[id]/prompts/[type]/save',
        400,
        Date.now() - startTime
      );
      return badRequest('Persona ID is required', 'INVALID_REQUEST');
    }

    // Validate prompt type
    if (!type || (type !== 'task' && type !== 'judge')) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/prompts/${type}/save`,
        400,
        Date.now() - startTime
      );
      return badRequest('Prompt type must be "task" or "judge"', 'INVALID_REQUEST');
    }

    // Parse request body
    const body = await request.json();
    const { prompt_text, improvement_rationale, label } = body;

    // Validate required fields
    if (!prompt_text || typeof prompt_text !== 'string') {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/prompts/${type}/save`,
        400,
        Date.now() - startTime
      );
      return badRequest('prompt_text is required and must be a string', 'INVALID_REQUEST');
    }

    // Validate optional fields
    if (improvement_rationale !== undefined && typeof improvement_rationale !== 'string') {
      return badRequest('improvement_rationale must be a string', 'INVALID_REQUEST');
    }

    if (label !== undefined && typeof label !== 'string') {
      return badRequest('label must be a string', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Verify persona exists
    const persona = db.prepare('SELECT id FROM personas WHERE id = ?').get(id);
    if (!persona) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/prompts/${type}/save`,
        404,
        Date.now() - startTime
      );
      return notFound('Persona');
    }

    // Determine table and current version column based on prompt type
    const tableName = type === 'task' ? 'task_prompt_versions' : 'judge_prompt_versions';
    const currentVersionColumn =
      type === 'task' ? 'current_task_prompt_version_id' : 'current_judge_prompt_version_id';

    // Use transaction to prevent version conflicts
    const transaction = db.transaction(() => {
      // Get next version number
      const versionResult = db
        .prepare(
          `SELECT COALESCE(MAX(version_number), -1) + 1 as next_version FROM ${tableName} WHERE persona_id = ?`
        )
        .get(id) as { next_version: number };

      const nextVersionNumber = versionResult.next_version;

      // Create new prompt version
      const versionId = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO ${tableName} (id, persona_id, version_number, prompt_text, improvement_rationale, label, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        versionId,
        id,
        nextVersionNumber,
        prompt_text,
        improvement_rationale || null,
        label || null,
        'human',
        now
      );

      // Update persona's current prompt version
      db.prepare(
        `UPDATE personas SET ${currentVersionColumn} = ?, updated_at = ? WHERE id = ?`
      ).run(versionId, now, id);

      // Fetch and return the created version
      const createdVersion = db
        .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
        .get(versionId) as {
        id: string;
        persona_id: string;
        version_number: number;
        prompt_text: string;
        improvement_rationale: string | null;
        label: string | null;
        created_by: 'human' | 'ai';
        created_at: string;
      };

      return createdVersion;
    });

    // Execute transaction
    const newVersion = transaction();

    logger.info('Prompt saved successfully', {
      personaId: id,
      promptType: type,
      versionId: newVersion.id,
      versionNumber: newVersion.version_number,
    });

    logger.logApiRequest(
      'POST',
      `/api/personas/${id}/prompts/${type}/save`,
      201,
      Date.now() - startTime
    );

    return new Response(
      JSON.stringify({
        id: newVersion.id,
        persona_id: newVersion.persona_id,
        version_number: newVersion.version_number,
        prompt_text: newVersion.prompt_text,
        improvement_rationale: newVersion.improvement_rationale,
        label: newVersion.label,
        created_by: newVersion.created_by,
        created_at: newVersion.created_at,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      logger.logApiRequest(
        'POST',
        `/api/personas/${id}/prompts/${type}/save`,
        400,
        Date.now() - startTime
      );
      return badRequest('Invalid JSON in request body', 'INVALID_JSON');
    }

    logger.logApiError('POST', `/api/personas/${id}/prompts/${type}/save`, error as Error);
    return createErrorResponse(error);
  }
};
