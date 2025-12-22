// src/pages/api/templates.ts
// Template CRUD endpoints

import type { APIRoute } from 'astro';
import { insertTemplate, getTemplates } from '../../lib/db';
import { validateCreateTemplate } from '../../lib/validators';
import type { RubricType } from '../../lib/types';

// POST /api/templates - Create new template
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validate input
    const validation = validateCreateTemplate(body);
    if (!validation.valid) {
      return new Response(JSON.stringify(validation.error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      name,
      description,
      instruction_text,
      model_ids,
      accuracy_rubric,
      expected_output,
      partial_credit_concepts,
    } = body;

    // Create template
    const template = insertTemplate(
      name,
      instruction_text,
      model_ids,
      accuracy_rubric as RubricType,
      description,
      expected_output,
      partial_credit_concepts
    );

    return new Response(
      JSON.stringify({
        id: template.id,
        name: template.name,
        instruction_text: template.instruction_text,
        model_count: template.model_ids.length,
        accuracy_rubric: template.accuracy_rubric,
        created_at: template.created_at,
        run_count: template.run_count,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('POST /api/templates error:', error);
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

// GET /api/templates - List all templates
export const GET: APIRoute = async ({ url }) => {
  try {
    const sortBy = (url.searchParams.get('sort_by') || 'created') as
      | 'created'
      | 'name'
      | 'run_count';
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

    const templates = getTemplates(sortBy, order);

    return new Response(
      JSON.stringify({
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          instruction_text: t.instruction_text.substring(0, 200),
          model_count: t.model_ids.length,
          accuracy_rubric: t.accuracy_rubric,
          created_at: t.created_at,
          run_count: t.run_count,
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/templates error:', error);
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
