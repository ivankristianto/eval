// src/lib/api-clients.ts
// API clients for AI model providers (OpenAI, Anthropic, Google)

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Provider, ModelResponse } from './types';

export interface ModelClient {
  evaluate(
    instruction: string,
    options?: { systemPrompt?: string; temperature?: number }
  ): Promise<ModelResponse>;
  testConnection(): Promise<boolean>;
}

// ===== OpenAI Client =====

export class OpenAIClient implements ModelClient {
  private client: OpenAI;
  private modelName: string;

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
    if (process.env.DEBUG === 'true') {
      console.log('[OpenAI Debug]', {
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
    }

    return result;
  }

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

export class AnthropicClient implements ModelClient {
  private client: Anthropic;
  private modelName: string;

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
    if (process.env.DEBUG === 'true') {
      console.log('[Anthropic Debug]', {
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
    }

    return result;
  }

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

export class GoogleClient implements ModelClient {
  private client: GoogleGenerativeAI;
  private modelName: string;

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
    if (process.env.DEBUG === 'true') {
      console.log('[Google Debug]', {
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
    }

    return resultObj;
  }

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

// ===== Client Factory =====

export class ClientFactory {
  static createClient(provider: Provider, apiKey: string, modelName: string): ModelClient {
    switch (provider) {
      case 'openai':
        return new OpenAIClient(apiKey, modelName);
      case 'anthropic':
        return new AnthropicClient(apiKey, modelName);
      case 'google':
        return new GoogleClient(apiKey, modelName);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  static async testConnection(
    provider: Provider,
    apiKey: string,
    modelName: string
  ): Promise<boolean> {
    const client = this.createClient(provider, apiKey, modelName);
    return client.testConnection();
  }
}
