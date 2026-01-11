/**
 * GET /api/judge-prompts/diff?version1=<id>&version2=<id>
 * Get diff between two prompt versions
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '@lib/db';
import { getPromptDiff } from '@lib/training/prompt-version-manager';
import { badRequest, createErrorResponse } from '@lib/api-error-handler';
import { createLogger } from '@lib/logger';

const logger = createLogger('API:JudgePrompts:Diff');

/**
 * GET /api/judge-prompts/diff
 * Retrieves textual differences between two versions of a judge prompt.
 * @param root0
 * @param root0.url
 */
export const GET: APIRoute = async ({ url }) => {
  const startTime = Date.now();

  try {
    const version1Id = url.searchParams.get('version1');
    const version2Id = url.searchParams.get('version2');

    if (!version1Id || !version2Id) {
      logger.logApiRequest('GET', '/api/judge-prompts/diff', 400, Date.now() - startTime);
      return badRequest('version1 and version2 query parameters are required', 'INVALID_REQUEST');
    }

    const db = getDatabase();

    // Get diff
    const diff = await getPromptDiff(version1Id, version2Id, db);

    logger.logApiRequest('GET', '/api/judge-prompts/diff', 200, Date.now() - startTime);

    return new Response(JSON.stringify(diff), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.logApiError('GET', '/api/judge-prompts/diff', error as Error);

    if (error instanceof Error && error.message.includes('Version not found')) {
      logger.logApiRequest('GET', '/api/judge-prompts/diff', 404, Date.now() - startTime);
      return badRequest(error.message, 'NOT_FOUND');
    }

    return createErrorResponse(error);
  }
};
