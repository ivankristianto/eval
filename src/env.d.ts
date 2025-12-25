/// <reference path="../.astro/types.d.ts" />

declare global {
  interface Window {
    __EVALUATION_DATA__?: {
      id: string;
      instruction_text: string;
      accuracy_rubric: string;
      expected_output?: string;
      partial_credit_concepts?: string[];
      system_prompt?: string;
      temperature?: number;
      status: string;
      created_at: string;
      results: Array<{
        model_id: string;
        model_name: string;
        provider: string;
        response_text?: string;
        execution_time_ms?: number;
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
        accuracy_score?: number;
        accuracy_reasoning?: string;
        status: string;
        system_prompt_used?: string;
        temperature_used?: number;
      }>;
    };
    openTemplateModal?: (data: {
      instruction_text: string;
      model_ids: string[];
      accuracy_rubric: string;
      expected_output: string;
      partial_credit_concepts?: string[];
      system_prompt?: string;
      temperature?: number;
    }) => void;
    showEvaluationDetails?: (data: {
      modelName: string;
      prompt: string;
      expectedOutput: string;
      response: string;
      reasoning: string;
      executionTime?: number;
      accuracyScore?: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      temperature?: number;
    }) => void;
    openDrawer?: (id: string) => void;
    closeDrawer?: (id: string) => void;
  }
}

export {};