import { randomUUID } from 'crypto';
import type {
  Evaluation,
  EvaluationTemplate,
  ModelConfiguration,
  Provider,
  Result,
  RubricType,
} from '../../src/lib/types';

type ResultWithModel = Result & { model_name: string; provider: Provider };

const now = () => new Date().toISOString();

export function createMockDb() {
  const store = {
    models: new Map<string, ModelConfiguration>(),
    templates: new Map<string, EvaluationTemplate>(),
    evaluations: new Map<string, Evaluation>(),
    results: new Map<string, ResultWithModel>(),
    activeModelEvaluations: new Set<string>(),
  };

  const reset = () => {
    store.models.clear();
    store.templates.clear();
    store.evaluations.clear();
    store.results.clear();
    store.activeModelEvaluations.clear();
  };

  const insertModel = (
    provider: Provider,
    modelName: string,
    apiKey: string,
    notes?: string
  ): ModelConfiguration => {
    const id = randomUUID();
    const createdAt = now();
    const model: ModelConfiguration = {
      id,
      provider,
      model_name: modelName,
      api_key_encrypted: `enc:${apiKey}`,
      created_at: createdAt,
      updated_at: createdAt,
      is_active: true,
      notes,
    };
    store.models.set(id, model);
    return model;
  };

  const getModels = (activeOnly = false, provider?: Provider): ModelConfiguration[] => {
    return Array.from(store.models.values())
      .filter((model) => (activeOnly ? model.is_active : true))
      .filter((model) => (provider ? model.provider === provider : true));
  };

  const getModelById = (id: string): ModelConfiguration | null => {
    return store.models.get(id) ?? null;
  };

  const updateModel = (
    id: string,
    updates: Partial<{ is_active: boolean; notes: string; api_key: string }>
  ): ModelConfiguration | null => {
    const model = store.models.get(id);
    if (!model) return null;

    if (updates.is_active !== undefined) model.is_active = updates.is_active;
    if (updates.notes !== undefined) model.notes = updates.notes;
    if (updates.api_key !== undefined) model.api_key_encrypted = `enc:${updates.api_key}`;
    model.updated_at = now();
    store.models.set(id, model);
    return model;
  };

  const deleteModel = (id: string): boolean => {
    return store.models.delete(id);
  };

  const getModelUsageCount = (id: string): number => {
    let count = 0;
    for (const result of store.results.values()) {
      if (result.model_id === id) count += 1;
    }
    return count;
  };

  const hasActiveEvaluations = (modelId: string): boolean => {
    return store.activeModelEvaluations.has(modelId);
  };

  const setModelHasActiveEvaluation = (modelId: string, active: boolean) => {
    if (active) {
      store.activeModelEvaluations.add(modelId);
    } else {
      store.activeModelEvaluations.delete(modelId);
    }
  };

  const insertEvaluation = (
    instructionText: string,
    accuracyRubric: RubricType,
    expectedOutput?: string,
    partialCreditConcepts?: string[],
    templateId?: string,
    systemPrompt?: string,
    temperature?: number
  ): Evaluation => {
    const id = randomUUID();
    const createdAt = now();
    const evaluation: Evaluation = {
      id,
      instruction_text: instructionText,
      expected_output: expectedOutput,
      accuracy_rubric: accuracyRubric,
      partial_credit_concepts: partialCreditConcepts,
      status: 'pending',
      created_at: createdAt,
      template_id: templateId,
      system_prompt: systemPrompt,
      temperature: temperature ?? 0.3,
    };
    store.evaluations.set(id, evaluation);
    return evaluation;
  };

  const updateEvaluationStatus = (
    id: string,
    status: Evaluation['status'],
    errorMessage?: string
  ) => {
    const evaluation = store.evaluations.get(id);
    if (!evaluation) return;
    evaluation.status = status;
    if (status === 'completed' || status === 'failed') {
      evaluation.completed_at = now();
    }
    if (errorMessage) {
      evaluation.error_message = errorMessage;
    }
    store.evaluations.set(id, evaluation);
  };

  const insertResult = (evaluationId: string, modelId: string): Result => {
    const id = randomUUID();
    const createdAt = now();
    const model = store.models.get(modelId);
    const result: ResultWithModel = {
      id,
      evaluation_id: evaluationId,
      model_id: modelId,
      status: 'pending',
      created_at: createdAt,
      model_name: model?.model_name ?? 'unknown',
      provider: model?.provider ?? 'openai',
    };
    store.results.set(id, result);
    return result;
  };

  const updateResult = (
    id: string,
    updates: Partial<{
      response_text: string;
      execution_time_ms: number;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      accuracy_score: number;
      accuracy_reasoning: string;
      status: Result['status'];
      error_message: string;
    }>
  ) => {
    const result = store.results.get(id);
    if (!result) return;
    Object.assign(result, updates);
    store.results.set(id, result);
  };

  const getEvaluation = (id: string): Evaluation | null => {
    return store.evaluations.get(id) ?? null;
  };

  const getResults = (evaluationId: string): ResultWithModel[] => {
    return Array.from(store.results.values()).filter(
      (result) => result.evaluation_id === evaluationId
    );
  };

  const getEvaluationStatus = (evaluationId: string) => {
    const evaluation = store.evaluations.get(evaluationId);
    if (!evaluation) return null;
    const results = getResults(evaluationId);
    return {
      overall_status: evaluation.status,
      created_at: evaluation.created_at,
      completed_at: evaluation.completed_at ?? undefined,
      results: results.map((result) => ({
        model_id: result.model_id,
        model_name: result.model_name,
        provider: result.provider,
        status: result.status,
        execution_time_ms: result.execution_time_ms ?? undefined,
        input_tokens: result.input_tokens ?? undefined,
        output_tokens: result.output_tokens ?? undefined,
        total_tokens: result.total_tokens ?? undefined,
        accuracy_score: result.accuracy_score ?? undefined,
        error_message: result.error_message ?? undefined,
      })),
    };
  };

  const insertTemplate = (
    name: string,
    instructionText: string,
    modelIds: string[],
    accuracyRubric: RubricType,
    description?: string,
    expectedOutput?: string,
    partialCreditConcepts?: string[],
    systemPrompt?: string,
    temperature?: number
  ): EvaluationTemplate => {
    const id = randomUUID();
    const createdAt = now();
    const template: EvaluationTemplate = {
      id,
      name,
      description,
      instruction_text: instructionText,
      model_ids: modelIds,
      accuracy_rubric: accuracyRubric,
      expected_output: expectedOutput,
      partial_credit_concepts: partialCreditConcepts,
      system_prompt: systemPrompt,
      temperature,
      created_at: createdAt,
      updated_at: createdAt,
      run_count: 0,
    };
    store.templates.set(id, template);
    return template;
  };

  const getTemplates = (
    sortBy: 'created' | 'name' | 'run_count' = 'created',
    order: 'asc' | 'desc' = 'desc'
  ) => {
    const items = Array.from(store.templates.values());
    const dir = order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'run_count') return (a.run_count - b.run_count) * dir;
      return a.created_at.localeCompare(b.created_at) * dir;
    });
    return items;
  };

  const getTemplateById = (id: string): EvaluationTemplate | null => {
    return store.templates.get(id) ?? null;
  };

  const updateTemplate = (
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      instruction_text: string;
      model_ids: string[];
      accuracy_rubric: RubricType;
      expected_output: string;
      partial_credit_concepts: string[];
    }>
  ): EvaluationTemplate | null => {
    const template = store.templates.get(id);
    if (!template) return null;
    Object.assign(template, updates);
    template.updated_at = now();
    store.templates.set(id, template);
    return template;
  };

  const deleteTemplate = (id: string): boolean => {
    return store.templates.delete(id);
  };

  const incrementTemplateRunCount = (id: string) => {
    const template = store.templates.get(id);
    if (!template) return;
    template.run_count += 1;
    template.updated_at = now();
    store.templates.set(id, template);
  };

  const getTemplateHistory = () => {
    return [];
  };

  const decryptApiKey = (encrypted: string) => {
    return encrypted.replace(/^enc:/, '');
  };

  return {
    reset,
    insertModel,
    getModels,
    getModelById,
    updateModel,
    deleteModel,
    getModelUsageCount,
    hasActiveEvaluations,
    setModelHasActiveEvaluation,
    insertEvaluation,
    updateEvaluationStatus,
    insertResult,
    updateResult,
    getEvaluation,
    getResults,
    getEvaluationStatus,
    insertTemplate,
    getTemplates,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    incrementTemplateRunCount,
    getTemplateHistory,
    decryptApiKey,
  };
}
