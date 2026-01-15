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
    /** Open edit template modal. Pass templateId to edit existing template, or undefined to create new. */
    openEditTemplateModal?: (templateId?: string) => Promise<void>;
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
    /** Toast notification system */
    toast?: {
      success: (msg: string) => HTMLElement | null;
      error: (msg: string) => HTMLElement | null;
      info: (msg: string) => HTMLElement | null;
      warning: (msg: string) => HTMLElement | null;
      update: (toast: HTMLElement, message: string, type?: string | null) => void;
      remove: (toast: HTMLElement) => void;
    };
    /** Show loading spinner in target element */
    showLoading?: (targetSelector: string, message?: string) => void;
    /** Hide loading spinner from target element */
    hideLoading?: (targetSelector: string) => void;
    /** Show skeleton loader in table body */
    showSkeleton?: (tableBodySelector: string, rowCount?: number) => void;
    /** Update progress bar value */
    updateProgress?: (percentage: number, targetSelector?: string) => void;
    /** CSV upload polling interval (internal use) */
    __csvUploadInterval?: ReturnType<typeof setInterval>;
  }

  /** Test database instance for unit tests (set in vitest setup) */
  var __TEST_DB__: import('better-sqlite3').Database | undefined;
}

export {};
