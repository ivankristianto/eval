// src/pages/api/personas.ts
// Personas CRUD endpoints

import type { APIRoute } from 'astro';
import { createPersona, listPersonas } from '../../lib/persona-db';
import type { CreatePersonaInput, PersonaStatus } from '../../types/training';

// POST /api/personas - Create new persona
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const input: CreatePersonaInput = {
      name: body.name,
      description: body.description,
      task_prompt: body.task_prompt,
      task_model_id: body.task_model_id,
      judge_model_id: body.judge_model_id,
      prompt_engineer_model_id: body.prompt_engineer_model_id,
      target_f1_score: body.target_f1_score,
      max_iterations: body.max_iterations,
      created_by: body.created_by,
    };

    // createPersona will validate and throw on error
    const persona = createPersona(input);

    return new Response(
      JSON.stringify({
        id: persona.id,
        name: persona.name,
        description: persona.description,
        task_prompt: persona.task_prompt,
        task_model_id: persona.task_model_id,
        judge_model_id: persona.judge_model_id,
        prompt_engineer_model_id: persona.prompt_engineer_model_id,
        status: persona.status,
        target_f1_score: persona.target_f1_score,
        max_iterations: persona.max_iterations,
        current_iteration: persona.current_iteration,
        best_f1_score: persona.best_f1_score,
        best_f1_iteration: persona.best_f1_iteration,
        created_at: persona.created_at,
        updated_at: persona.updated_at,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('POST /api/personas error:', error);

    // Check if it's a validation error
    if (error instanceof Error && error.message.includes('validation failed')) {
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: error.message,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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

// GET /api/personas - List personas
export const GET: APIRoute = async ({ url }) => {
  try {
    const status = url.searchParams.get('status') as PersonaStatus | null;

    const personas = listPersonas(status || undefined);

    return new Response(
      JSON.stringify({
        personas: personas.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          task_prompt: p.task_prompt.substring(0, 200), // Truncate for list view
          task_model_id: p.task_model_id,
          judge_model_id: p.judge_model_id,
          prompt_engineer_model_id: p.prompt_engineer_model_id,
          status: p.status,
          target_f1_score: p.target_f1_score,
          max_iterations: p.max_iterations,
          current_iteration: p.current_iteration,
          best_f1_score: p.best_f1_score,
          best_f1_iteration: p.best_f1_iteration,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GET /api/personas error:', error);
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
