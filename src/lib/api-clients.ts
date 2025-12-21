// src/lib/api-clients.ts
// API clients for AI model providers (OpenAI, Anthropic, Google)

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Provider, ModelResponse } from './types';

export interface ModelClient {
  evaluate(instruction: string): Promise<ModelResponse>;
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

  async evaluate(instruction: string): Promise<ModelResponse> {
    const startTime = performance.now();

    // Newer OpenAI models (o1, o3, gpt-5+) require max_completion_tokens instead of max_tokens
    const useMaxCompletionTokens =
      this.modelName.startsWith('o1') ||
      this.modelName.startsWith('o3') ||
      this.modelName.startsWith('gpt-5');

    const tokenParam = useMaxCompletionTokens
      ? { max_completion_tokens: 4096 }
      : { max_tokens: 4096 };

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: instruction }],
      ...tokenParam,
    } as any);

    const executionTime = Math.round(performance.now() - startTime);

    const choice = response.choices[0];
    const usage = response.usage;

    return {
      response: choice?.message?.content || '',
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      executionTime,
    };
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

  async evaluate(instruction: string): Promise<ModelResponse> {
    const startTime = performance.now();

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      messages: [{ role: 'user', content: instruction }],
    });

    const executionTime = Math.round(performance.now() - startTime);

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent && 'text' in textContent ? textContent.text : '';

    return {
      response: responseText,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      executionTime,
    };
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

  async evaluate(instruction: string): Promise<ModelResponse> {
    const startTime = performance.now();

    const model = this.client.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(instruction);

    const executionTime = Math.round(performance.now() - startTime);

    const response = result.response;
    const text = response.text();

    const usage = response.usageMetadata;

    return {
      response: text,
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
      executionTime,
    };
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

// ===== Helper for semantic similarity scoring =====

// @deprecated: Use getSemanticSimilarityScore from semanticSimilarity.ts
export async function getSemanticSimilarityScore(
  response: string,
  expectedOutput: string,
  apiKey?: string
): Promise<{ score: number; reasoning: string }> {
  // Use Anthropic Claude for semantic similarity scoring if API key is available
  const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    // Fallback to basic text similarity if no API key
    return fallbackSimilarity(response, expectedOutput);
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey });

    const result = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Compare these two texts for semantic similarity. Rate the similarity from 0 to 100, where 100 means identical meaning.

Text A: "${response.substring(0, 1000)}"

Text B: "${expectedOutput.substring(0, 1000)}"

Reply with ONLY a JSON object in this exact format: {"score": <number>, "reasoning": "<brief explanation>"}`,
        },
      ],
    });

    const textContent = result.content.find((block) => block.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    try {
      const parsed = JSON.parse(text);
      return {
        score: Math.min(100, Math.max(0, Math.round(parsed.score))),
        reasoning: String(parsed.reasoning).substring(0, 500),
      };
    } catch {
      // If parsing fails, try to extract score from text
      const scoreMatch = text.match(/\d+/);
      return {
        score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[0], 10))) : 50,
        reasoning: 'Semantic similarity score extracted from model response',
      };
    }
  } catch (error) {
    console.error('Semantic similarity scoring failed:', error);
    return fallbackSimilarity(response, expectedOutput);
  }
}

// @deprecated: Use fallbackSimilarity from semanticSimilarity.ts
function fallbackSimilarity(
  response: string,
  expectedOutput: string
): { score: number; reasoning: string } {
  // Simple word overlap similarity as fallback
  const responseWords = new Set(response.toLowerCase().split(/\s+/));
  const expectedWords = new Set(expectedOutput.toLowerCase().split(/\s+/));

  let overlap = 0;
  for (const word of responseWords) {
    if (expectedWords.has(word)) {
      overlap++;
    }
  }

  const score = Math.round((overlap / Math.max(responseWords.size, expectedWords.size)) * 100);

  return {
    score,
    reasoning: `Fallback word overlap similarity: ${overlap} common words`,
  };
}
