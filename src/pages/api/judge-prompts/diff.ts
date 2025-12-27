/**
 * GET /api/judge-prompts/diff?version1=<id>&version2=<id>
 * Get diff between two prompt versions
 */

import type { APIRoute } from 'astro';
import { getDatabase } from '../../../lib/db';
import { getPromptDiff } from '../../../lib/prompt-version-manager';

/**
 * GET /api/judge-prompts/diff
 * Retrieves textual differences between two versions of a judge prompt.
 * @param root0
 * @param root0.url
 * @returns {Promise<Response>}
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const version1Id = url.searchParams.get('version1');
    const version2Id = url.searchParams.get('version2');

    if (!version1Id || !version2Id) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_REQUEST',
          message: 'version1 and version2 query parameters are required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDatabase();

    // Get diff
    const diff = await getPromptDiff(version1Id, version2Id, db);

    return new Response(JSON.stringify(diff), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('GET /api/judge-prompts/diff error:', error);

    if (error instanceof Error && error.message.includes('Version not found')) {
      return new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: error.message,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
