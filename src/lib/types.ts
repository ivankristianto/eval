// src/lib/types.ts
// TypeScript interfaces for AI Model Evaluation Framework

export type Provider = 'openai' | 'anthropic' | 'google';
export type RubricType = 'exact_match' | 'partial_credit' | 'semantic_similarity';
export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ResultStatus = 'pending' | 'completed' | 'failed';

export interface ModelConfiguration {
  id: string;
  provider: Provider;
  model_name: string;
  api_key_encrypted: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  notes?: string;
}

export interface Evaluation {
  id: string;
  instruction_text: string;
  accuracy_rubric: RubricType;
  partial_credit_concepts?: string[];
  expected_output?: string;
  created_at: string;
  completed_at?: string;
  status: EvaluationStatus;
  error_message?: string;
  template_id?: string;
}

export interface Result {
  id: string;
  evaluation_id: string;
  model_id: string;
  response_text?: string;
  execution_time_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  accuracy_score?: number;
  accuracy_reasoning?: string;
  status: ResultStatus;
  error_message?: string;
  created_at: string;
}

export interface EvaluationTemplate {
  id: string;
  name: string;
  description?: string;
  instruction_text: string;
  model_ids: string[];
  accuracy_rubric: RubricType;
  partial_credit_concepts?: string[];
  expected_output?: string;
  created_at: string;
  updated_at: string;
  run_count: number;
}

export interface EvaluationWithResults extends Evaluation {
  results: (Result & { model_name: string; provider: Provider })[];
}

// API Response types
export interface ModelResponse {
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  executionTime: number;
}

export interface AccuracyResult {
  score: number;
  reasoning: string;
}

// API Request/Response types for endpoints
export interface CreateEvaluationRequest {
  instruction: string;
  model_ids: string[];
  rubric_type: RubricType;
  expected_output?: string;
  partial_credit_concepts?: string[];
}

export interface CreateEvaluationResponse {
  evaluation_id: string;
  status: EvaluationStatus;
  models: {
    model_id: string;
    model_name: string;
    provider: string;
    status: ResultStatus;
  }[];
}

export interface EvaluationStatusResponse {
  evaluation_id: string;
  overall_status: EvaluationStatus;
  created_at: string;
  completed_at?: string;
  results: {
    model_id: string;
    model_name: string;
    provider: string;
    status: ResultStatus;
    execution_time_ms?: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    accuracy_score?: number;
    error_message?: string;
  }[];
}

export interface ResultsResponse {
  evaluation_id: string;
  instruction_text: string;
  accuracy_rubric: RubricType;
  expected_output: string;
  created_at: string;
  completed_at: string;
  results: {
    model_id: string;
    model_name: string;
    provider: string;
    execution_time_ms: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    accuracy_score: number;
    accuracy_reasoning: string;
    response_text: string;
  }[];
}

export interface CreateModelRequest {
  provider: Provider;
  model_name: string;
  api_key: string;
  notes?: string;
}

export interface CreateModelResponse {
  id: string;
  provider: Provider;
  model_name: string;
  is_active: boolean;
  created_at: string;
  validation_status: 'valid' | 'invalid';
  error_message?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  instruction_text: string;
  model_ids: string[];
  accuracy_rubric: RubricType;
  expected_output?: string;
  partial_credit_concepts?: string[];
}

export interface CreateTemplateResponse {
  id: string;
  name: string;
  instruction_text: string;
  model_count: number;
  accuracy_rubric: RubricType;
  created_at: string;
  run_count: number;
}

// Error response type
export interface ApiError {
  error: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}
