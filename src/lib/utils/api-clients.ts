// src/lib/api-clients.ts
// API clients for AI model providers (OpenAI, Anthropic, Google)

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Provider, ModelResponse } from '@lib/utils/types';
import { createLogger } from '@lib/logger';

/**
 * Common interface for all AI model provider clients.
 */
export interface ModelClient {
  /**
   * Evaluates an instruction using the model.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @returns Model response with text, token counts, and execution time
   */
  evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse>;

  /**
   * Tests the connection to the provider API.
   * @returns True if connection is successful, false otherwise
   */
  testConnection(): Promise<boolean>;
}

// ===== OpenAI Client =====

/**
 * Client for OpenAI API models.
 */
export class OpenAIClient implements ModelClient {
  private client: OpenAI;
  private modelName: string;
  private logger = createLogger('OpenAI:ModelClient');

  /**
   * Initializes a new OpenAI client.
   * @param apiKey - OpenAI API key
   * @param modelName - Model identifier (e.g., 'gpt-4o')
   */
  constructor(apiKey: string, modelName: string) {
    this.client = new OpenAI({ apiKey });
    this.modelName = modelName;
  }

  /**
   * Evaluates an instruction using the OpenAI API.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @param options.systemPrompt - Custom system prompt to shape model behavior (max 4000 chars)
   * @param options.temperature - Sampling temperature 0.0-2.0 (default: 0.3 if not specified)
   * @returns Model response with text, token counts, and execution time
   */
  async evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse> {
    const startTime = performance.now();

    // Newer OpenAI models (o1, o3, gpt-5+) require max_completion_tokens instead of max_tokens
    const useMaxCompletionTokens =
      this.modelName.startsWith('o1') ||
      this.modelName.startsWith('o3') ||
      this.modelName.startsWith('gpt-5');

    const tokenParam = useMaxCompletionTokens
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };

    // Some models (o1, o3, gpt-5 series) don't support temperature customization
    const supportsTemperature =
      !this.modelName.startsWith('o1') &&
      !this.modelName.startsWith('o3') &&
      !this.modelName.startsWith('gpt-5');

    // Build messages array with system prompt if provided
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: instruction });

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
      ...(supportsTemperature &&
        options?.temperature !== undefined && { temperature: options.temperature }),
      ...tokenParam,
    } as OpenAI.ChatCompletionCreateParamsNonStreaming);

    const executionTime = Math.round(performance.now() - startTime);

    const choice = response.choices[0];
    const usage = response.usage;

    const result = {
      response: choice?.message?.content || '',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      executionTime,
    };

    // Debug logging
    this.logger.debug('OpenAI API response', {
      model: this.modelName,
      systemPrompt: options?.systemPrompt
        ? `"${options.systemPrompt.substring(0, 50)}..."`
        : 'none',
      temperature: supportsTemperature
        ? (options?.temperature ?? 'default')
        : 'not supported (using model default)',
      response: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      },
      executionTime: `${result.executionTime}ms`,
    });

    return result;
  }

  /**
   * Tests connection by listing models.
   * @returns True if API is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

// ===== Anthropic Client =====

/**
 * Client for Anthropic Claude API models.
 */
export class AnthropicClient implements ModelClient {
  private client: Anthropic;
  private modelName: string;
  private logger = createLogger('Anthropic:ModelClient');

  /**
   * Initializes a new Anthropic client.
   * @param apiKey - Anthropic API key
   * @param modelName - Model identifier (e.g., 'claude-3-opus-20240229')
   */
  constructor(apiKey: string, modelName: string) {
    this.client = new Anthropic({ apiKey });
    this.modelName = modelName;
  }

  /**
   * Evaluates an instruction using the Anthropic API.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @param options.systemPrompt - Custom system prompt to shape model behavior (max 4000 chars)
   * @param options.temperature - Sampling temperature 0.0-2.0 (default: 0.3 if not specified)
   * @returns Model response with text, token counts, and execution time
   */
  async evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse> {
    const startTime = performance.now();

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      ...(options?.systemPrompt && { system: options.systemPrompt }),
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      messages: [{ role: 'user', content: instruction }],
    });

    const executionTime = Math.round(performance.now() - startTime);

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent && 'text' in textContent ? textContent.text : '';

    const result = {
      response: responseText,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      executionTime,
    };

    // Debug logging
    this.logger.debug('Anthropic API response', {
      model: this.modelName,
      systemPrompt: options?.systemPrompt
        ? `"${options.systemPrompt.substring(0, 50)}..."`
        : 'none',
      temperature: options?.temperature ?? 'default',
      response: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      },
      executionTime: `${result.executionTime}ms`,
    });

    return result;
  }

  /**
   * Tests connection by making a minimal request.
   * @returns True if API is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      // Make a minimal API call to verify credentials
      await this.client.messages.create({
        model: this.modelName,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ===== Google Client =====

/**
 * Client for Google Generative AI (Gemini) API models.
 */
export class GoogleClient implements ModelClient {
  private client: GoogleGenerativeAI;
  private modelName: string;
  private logger = createLogger('Google:ModelClient');

  /**
   * Initializes a new Google client.
   * @param apiKey - Google API key
   * @param modelName - Model identifier (e.g., 'gemini-1.5-pro')
   */
  constructor(apiKey: string, modelName: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  /**
   * Evaluates an instruction using the Google Generative AI API.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @param options.systemPrompt - Custom system prompt to shape model behavior (max 4000 chars)
   * @param options.temperature - Sampling temperature 0.0-2.0 (default: 0.3 if not specified)
   * @returns Model response with text, token counts, and execution time
   */
  async evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse> {
    const startTime = performance.now();

    const modelConfig: {
      model: string;
      systemInstruction?: string;
      generationConfig?: { temperature?: number };
    } = { model: this.modelName };

    // Add system instruction if provided
    if (options?.systemPrompt) {
      modelConfig.systemInstruction = options.systemPrompt;
    }

    // Add generation config with temperature if provided
    if (options?.temperature !== undefined) {
      modelConfig.generationConfig = {
        temperature: options.temperature,
      };
    }

    const model = this.client.getGenerativeModel(modelConfig);
    const result = await model.generateContent(instruction);

    const executionTime = Math.round(performance.now() - startTime);

    const response = result.response;
    const text = response.text();

    const usage = response.usageMetadata;

    const resultObj = {
      response: text,
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
      executionTime,
    };

    // Debug logging
    this.logger.debug('Google API response', {
      model: this.modelName,
      systemPrompt: options?.systemPrompt
        ? `"${options.systemPrompt.substring(0, 50)}..."`
        : 'none',
      temperature: options?.temperature ?? 'default',
      response:
        resultObj.response.substring(0, 200) + (resultObj.response.length > 200 ? '...' : ''),
      tokens: {
        input: resultObj.inputTokens,
        output: resultObj.outputTokens,
        total: resultObj.totalTokens,
      },
      executionTime: `${resultObj.executionTime}ms`,
    });

    return resultObj;
  }

  /**
   * Tests connection by making a minimal request.
   * @returns True if API is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      await model.generateContent('Hi');
      return true;
    } catch {
      return false;
    }
  }
}

// ===== Open Router Client =====

/**
 * Client for Open Router API (OpenAI-compatible API for multiple providers).
 * Uses OpenAI SDK with custom base URL and Open Router-specific headers.
 */
export class OpenRouterClient implements ModelClient {
  private client: OpenAI;
  private modelName: string;
  private logger = createLogger('OpenRouter:ModelClient');

  /**
   * Initializes a new Open Router client.
   * @param apiKey - Open Router API key
   * @param modelName - Model identifier (e.g., 'anthropic/claude-3-opus')
   */
  constructor(apiKey: string, modelName: string) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://eval-ai-models.com',
        'X-Title': 'Eval AI Models',
      },
    });
    this.modelName = modelName;
  }

  /**
   * Evaluates an instruction using the Open Router API.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @param options.systemPrompt - Custom system prompt to shape model behavior (max 4000 chars)
   * @param options.temperature - Sampling temperature 0.0-2.0 (default: 0.3 if not specified)
   * @returns Model response with text, token counts, and execution time
   */
  async evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse> {
    const startTime = performance.now();

    // Build messages array with system prompt if provided
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: instruction });

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      max_tokens: 4096,
    });

    const executionTime = Math.round(performance.now() - startTime);

    const choice = response.choices[0];
    const usage = response.usage;

    const result = {
      response: choice?.message?.content || '',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      executionTime,
    };

    // Debug logging
    this.logger.debug('OpenRouter API response', {
      model: this.modelName,
      systemPrompt: options?.systemPrompt
        ? `"${options.systemPrompt.substring(0, 50)}..."`
        : 'none',
      temperature: options?.temperature ?? 'default',
      response: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      },
      executionTime: `${result.executionTime}ms`,
    });

    return result;
  }

  /**
   * Tests connection by making a minimal API request.
   * @returns True if API is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ===== LM Studio Client =====

/**
 * Client for LM Studio local LLM deployments.
 * Uses OpenAI SDK with configurable local base URL.
 */
export class LMStudioClient implements ModelClient {
  private client: OpenAI;
  private modelName: string;
  private logger = createLogger('LMStudio:ModelClient');

  /**
   * Initializes a new LM Studio client.
   * @param apiKey - Not used for local, but SDK requires it (pass empty string or dummy)
   * @param modelName - Model identifier (e.g., 'llama-3-8b')
   * @param baseUrl - Custom base URL (default: 'http://localhost:1234/v1')
   */
  constructor(apiKey: string, modelName: string, baseUrl = 'http://localhost:1234/v1') {
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || 'dummy-key', // SDK requires apiKey, but LM Studio doesn't use it
    });
    this.modelName = modelName;
  }

  /**
   * Evaluates an instruction using the LM Studio local API.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @param options.systemPrompt - Custom system prompt to shape model behavior (max 4000 chars)
   * @param options.temperature - Sampling temperature 0.0-2.0 (default: 0.3 if not specified)
   * @returns Model response with text, token counts, and execution time
   */
  async evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse> {
    const startTime = performance.now();

    // Build messages array with system prompt if provided
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: instruction });

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      max_tokens: 4096,
    });

    const executionTime = Math.round(performance.now() - startTime);

    const choice = response.choices[0];
    const usage = response.usage;

    const result = {
      response: choice?.message?.content || '',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      executionTime,
    };

    // Debug logging
    this.logger.debug('LM Studio API response', {
      model: this.modelName,
      systemPrompt: options?.systemPrompt
        ? `"${options.systemPrompt.substring(0, 50)}..."`
        : 'none',
      temperature: options?.temperature ?? 'default',
      response: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      },
      executionTime: `${result.executionTime}ms`,
    });

    return result;
  }

  /**
   * Tests connection by making a minimal API request.
   * @returns True if local API is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ===== Ollama Client =====

/**
 * Client for Ollama local LLM deployments.
 * Uses Ollama's REST API directly with fetch.
 */
export class OllamaClient implements ModelClient {
  private baseUrl: string;
  private modelName: string;
  private logger = createLogger('Ollama:ModelClient');

  /**
   * Initializes a new Ollama client.
   * @param _apiKey - Not used for Ollama (no authentication)
   * @param modelName - Model identifier (e.g., 'llama3', 'mistral')
   * @param baseUrl - Custom base URL (default: 'http://localhost:11434')
   */
  constructor(_apiKey: string, modelName: string, baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.modelName = modelName;
  }

  /**
   * Evaluates an instruction using the Ollama API.
   * @param instruction - The user instruction/prompt to evaluate
   * @param options - Optional configuration
   * @param options.systemPrompt - Custom system prompt to shape model behavior (max 4000 chars)
   * @param options.temperature - Sampling temperature 0.0-2.0 (default: 0.3 if not specified)
   * @returns Model response with text, token counts, and execution time
   */
  async evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse> {
    const startTime = performance.now();

    const requestBody: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
      options?: { temperature: number };
    } = {
      model: this.modelName,
      messages: [],
      stream: false,
    };

    // Add system prompt if provided
    if (options?.systemPrompt) {
      requestBody.messages.push({ role: 'system', content: options.systemPrompt });
    }
    requestBody.messages.push({ role: 'user', content: instruction });

    // Add temperature if provided
    if (options?.temperature !== undefined) {
      requestBody.options = { temperature: options.temperature };
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const executionTime = Math.round(performance.now() - startTime);

    const result = {
      response: data.message?.content || '',
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      executionTime,
    };

    // Debug logging
    this.logger.debug('Ollama API response', {
      model: this.modelName,
      systemPrompt: options?.systemPrompt
        ? `"${options.systemPrompt.substring(0, 50)}..."`
        : 'none',
      temperature: options?.temperature ?? 'default',
      response: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.totalTokens,
      },
      executionTime: `${result.executionTime}ms`,
    });

    return result;
  }

  /**
   * Tests connection by listing available models via Ollama API.
   * @returns True if local API is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ===== Client Factory =====

/**
 * Factory for creating model clients based on provider.
 */
export class ClientFactory {
  /**
   * Creates a model client for the specified provider.
   * @param provider - AI provider name
   * @param apiKey - Optional provider API key (required for cloud providers, optional for local)
   * @param modelName - Model identifier
   * @param baseUrl - Optional base URL for local providers (LM Studio, Ollama)
   * @returns Initialized model client
   */
  static createClient(
    provider: Provider,
    apiKey: string | undefined,
    modelName: string,
    baseUrl?: string
  ): ModelClient {
    switch (provider) {
      case 'openai':
        if (!apiKey) throw new Error('API key is required for OpenAI');
        return new OpenAIClient(apiKey, modelName);
      case 'anthropic':
        if (!apiKey) throw new Error('API key is required for Anthropic');
        return new AnthropicClient(apiKey, modelName);
      case 'google':
        if (!apiKey) throw new Error('API key is required for Google');
        return new GoogleClient(apiKey, modelName);
      case 'openrouter':
        if (!apiKey) throw new Error('API key is required for Open Router');
        return new OpenRouterClient(apiKey, modelName);
      case 'lmstudio':
        return new LMStudioClient(apiKey || '', modelName, baseUrl);
      case 'ollama':
        return new OllamaClient(apiKey || '', modelName, baseUrl);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Tests connection for a specific model configuration.
   * @param provider - AI provider name
   * @param apiKey - Optional provider API key
   * @param modelName - Model identifier
   * @param baseUrl - Optional base URL for local providers
   * @returns True if connection is successful
   */
  static async testConnection(
    provider: Provider,
    apiKey: string | undefined,
    modelName: string,
    baseUrl?: string
  ): Promise<boolean> {
    const client = this.createClient(provider, apiKey, modelName, baseUrl);
    return client.testConnection();
  }
}

/**
 * Extract JSON from LLM response, handling markdown code blocks.
 * LLMs often wrap JSON responses in ```json ... ``` blocks.
 * @param response - Raw LLM response
 * @returns Extracted JSON string, or original if no code blocks found
 */
export function extractJsonFromResponse(response: string): string {
  // First, try to extract content from markdown code blocks
  const jsonCodeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/i;
  const match = response.match(jsonCodeBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // If no code blocks found, return the response as-is
  return response.trim();
}

// Logger for callModel helper function
const callModelLogger = createLogger('callModel');

/**
 * High-level helper to call an AI model by its configuration ID.
 * Used for prompt engineering and judge evaluations.
 * @param modelId - Database ID of the model configuration
 * @param instruction - Instruction to evaluate
 * @param options - Execution options
 * @param options.systemPrompt - Optional system prompt to guide the model
 * @param options.temperature - Optional temperature for response generation
 * @returns Generated response text
 */
export async function callModel(
  modelId: string,
  instruction: string,
  options?: { systemPrompt?: string; temperature?: number }
): Promise<string> {
  callModelLogger.debug('Calling model', {
    modelId,
    instructionLength: instruction.length,
    hasSystemPrompt: !!options?.systemPrompt,
    temperature: options?.temperature ?? 'default',
  });

  const { getModelById, decryptApiKey } = await import('@lib/db');
  const modelConfig = getModelById(modelId);

  if (!modelConfig) {
    callModelLogger.error('Model configuration not found', undefined, { modelId });
    throw new Error(`Model configuration not found: ${modelId}`);
  }

  const apiKey = modelConfig.api_key_encrypted
    ? decryptApiKey(modelConfig.api_key_encrypted)
    : undefined;
  const client = ClientFactory.createClient(
    modelConfig.provider,
    apiKey,
    modelConfig.model_name,
    modelConfig.base_url
  );

  callModelLogger.debug('Model client created', {
    provider: modelConfig.provider,
    modelName: modelConfig.model_name,
  });

  const result = await client.evaluate(instruction, options);

  callModelLogger.debug('Model response received', {
    modelId,
    responseLength: result.response.length,
    response: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
    executionTime: result.executionTime,
    totalTokens: result.totalTokens,
  });

  return result.response;
}
