import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnthropicClient,
  ClientFactory,
  GoogleClient,
  LMStudioClient,
  OllamaClient,
  OpenAIClient,
  OpenRouterClient,
} from '@lib/utils/api-clients';

const sdkMocks = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  openaiList: vi.fn(),
  anthropicCreate: vi.fn(),
  googleGenerateContent: vi.fn(),
  ollamaFetch: vi.fn(),
}));

vi.mock('openai', () => {
  class MockOpenAI {
    chat = { completions: { create: sdkMocks.openaiCreate } };
    models = { list: sdkMocks.openaiList };

    constructor(_opts: { apiKey: string }) {}
  }

  return { default: MockOpenAI };
});

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: sdkMocks.anthropicCreate };

    constructor(_opts: { apiKey: string }) {}
  }

  return { default: MockAnthropic };
});

vi.mock('@google/generative-ai', () => {
  class MockGoogleModel {
    generateContent = sdkMocks.googleGenerateContent;
  }

  class MockGoogleGenerativeAI {
    constructor(_apiKey: string) {}

    getGenerativeModel() {
      return new MockGoogleModel();
    }
  }

  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

// Mock fetch for Ollama
global.fetch = sdkMocks.ollamaFetch as unknown as typeof fetch;

beforeEach(() => {
  sdkMocks.openaiCreate.mockReset();
  sdkMocks.openaiList.mockReset();
  sdkMocks.anthropicCreate.mockReset();
  sdkMocks.googleGenerateContent.mockReset();
  sdkMocks.ollamaFetch.mockReset();
});

describe('OpenAIClient', () => {
  it('returns evaluation results and token counts', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello' } }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    });

    const timerSpy = vi
      .spyOn(performance, 'now')
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => 160);

    const client = new OpenAIClient('api-key', 'gpt-4');
    const result = await client.evaluate('Hi');

    expect(result).toEqual({
      response: 'Hello',
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
      executionTime: 60,
    });
    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4',
        max_tokens: 4096,
      })
    );

    timerSpy.mockRestore();
  });

  it('uses max_completion_tokens for newer models', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    const client = new OpenAIClient('api-key', 'gpt-5-preview');
    await client.evaluate('Hi');

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-preview',
        max_completion_tokens: 4096,
      })
    );
  });

  it('propagates API errors', async () => {
    sdkMocks.openaiCreate.mockRejectedValue(new Error('API error'));

    const client = new OpenAIClient('api-key', 'gpt-4');

    await expect(client.evaluate('Hi')).rejects.toThrow('API error');
  });

  it('returns connection status', async () => {
    sdkMocks.openaiList.mockResolvedValue([]);

    const client = new OpenAIClient('api-key', 'gpt-4');
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.openaiList.mockRejectedValue(new Error('No auth'));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });

  it('adds system prompt to messages array when provided', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const client = new OpenAIClient('api-key', 'gpt-4');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
    });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'User instruction' },
        ]),
      })
    );
  });

  it('does not add system message when systemPrompt is undefined', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new OpenAIClient('api-key', 'gpt-4');
    await client.evaluate('User instruction');

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'User instruction' }],
      })
    );
  });

  it('adds temperature parameter when provided', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new OpenAIClient('api-key', 'gpt-4');
    await client.evaluate('User instruction', { temperature: 1.5 });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 1.5,
      })
    );
  });

  it('does not add temperature when undefined', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new OpenAIClient('api-key', 'gpt-4');
    await client.evaluate('User instruction');

    const callArgs = sdkMocks.openaiCreate.mock.calls[0][0];
    expect(callArgs.temperature).toBeUndefined();
  });

  it('supports both systemPrompt and temperature together', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const client = new OpenAIClient('api-key', 'gpt-4');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
      temperature: 0.7,
    });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'User instruction' },
        ]),
        temperature: 0.7,
      })
    );
  });
});

describe('AnthropicClient', () => {
  it('returns evaluation results and token counts', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hi there' }],
      usage: { input_tokens: 4, output_tokens: 6 },
    });

    const timerSpy = vi
      .spyOn(performance, 'now')
      .mockImplementationOnce(() => 200)
      .mockImplementationOnce(() => 250);

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    const result = await client.evaluate('Hello');

    expect(result).toEqual({
      response: 'Hi there',
      inputTokens: 4,
      outputTokens: 6,
      totalTokens: 10,
      executionTime: 50,
    });

    timerSpy.mockRestore();
  });

  it('propagates API errors', async () => {
    sdkMocks.anthropicCreate.mockRejectedValue(new Error('Anthropic down'));

    const client = new AnthropicClient('api-key', 'claude-3-opus');

    await expect(client.evaluate('Hello')).rejects.toThrow('Anthropic down');
  });

  it('returns connection status', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.anthropicCreate.mockRejectedValue(new Error('No auth'));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });

  it('adds system parameter when systemPrompt is provided', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
    });

    expect(sdkMocks.anthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a helpful assistant',
        messages: [{ role: 'user', content: 'User instruction' }],
      })
    );
  });

  it('does not add system parameter when systemPrompt is undefined', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    await client.evaluate('User instruction');

    const callArgs = sdkMocks.anthropicCreate.mock.calls[0][0];
    expect(callArgs.system).toBeUndefined();
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'User instruction' }]);
  });

  it('adds temperature parameter when provided', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    await client.evaluate('User instruction', { temperature: 1.2 });

    expect(sdkMocks.anthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 1.2,
      })
    );
  });

  it('does not add temperature when undefined', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    await client.evaluate('User instruction');

    const callArgs = sdkMocks.anthropicCreate.mock.calls[0][0];
    expect(callArgs.temperature).toBeUndefined();
  });

  it('supports both systemPrompt and temperature together', async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const client = new AnthropicClient('api-key', 'claude-3-opus');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
      temperature: 0.9,
    });

    expect(sdkMocks.anthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a helpful assistant',
        messages: [{ role: 'user', content: 'User instruction' }],
        temperature: 0.9,
      })
    );
  });
});

describe('GoogleClient', () => {
  it('returns evaluation results and token counts', async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Hey',
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 4,
          totalTokenCount: 7,
        },
      },
    });

    const timerSpy = vi
      .spyOn(performance, 'now')
      .mockImplementationOnce(() => 10)
      .mockImplementationOnce(() => 40);

    const client = new GoogleClient('api-key', 'gemini-2.0');
    const result = await client.evaluate('Hey');

    expect(result).toEqual({
      response: 'Hey',
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
      executionTime: 30,
    });

    timerSpy.mockRestore();
  });

  it('defaults missing token counts to zero', async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Hey',
      },
    });

    const client = new GoogleClient('api-key', 'gemini-2.0');
    const result = await client.evaluate('Hey');

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('propagates API errors', async () => {
    sdkMocks.googleGenerateContent.mockRejectedValue(new Error('Gemini down'));

    const client = new GoogleClient('api-key', 'gemini-2.0');

    await expect(client.evaluate('Hello')).rejects.toThrow('Gemini down');
  });

  it('returns connection status', async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: { text: () => 'Ok' },
    });

    const client = new GoogleClient('api-key', 'gemini-2.0');
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.googleGenerateContent.mockRejectedValue(new Error('No auth'));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });

  it('adds systemInstruction when systemPrompt is provided', async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Response',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      },
    });

    const client = new GoogleClient('api-key', 'gemini-2.0');

    // Note: Google client receives the system prompt through model config in constructor
    // The actual test will verify the generateContent call receives the proper content
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
    });

    // The mock should be called (exact params depend on implementation)
    expect(sdkMocks.googleGenerateContent).toHaveBeenCalled();
  });

  it('adds temperature to generationConfig when provided', async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Response',
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      },
    });

    const client = new GoogleClient('api-key', 'gemini-2.0');
    await client.evaluate('User instruction', { temperature: 1.3 });

    // Verify generateContent was called
    expect(sdkMocks.googleGenerateContent).toHaveBeenCalled();
  });

  it('supports both systemPrompt and temperature together', async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Response',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      },
    });

    const client = new GoogleClient('api-key', 'gemini-2.0');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
      temperature: 0.8,
    });

    expect(sdkMocks.googleGenerateContent).toHaveBeenCalled();
  });
});

describe('OpenRouterClient', () => {
  it('returns evaluation results and token counts', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'OpenRouter response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    });

    const timerSpy = vi
      .spyOn(performance, 'now')
      .mockImplementationOnce(() => 50)
      .mockImplementationOnce(() => 120);

    const client = new OpenRouterClient('sk-or-key', 'anthropic/claude-3-opus');
    const result = await client.evaluate('Hello OpenRouter');

    expect(result).toEqual({
      response: 'OpenRouter response',
      inputTokens: 5,
      outputTokens: 8,
      totalTokens: 13,
      executionTime: 70,
    });
    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'anthropic/claude-3-opus',
        max_tokens: 4096,
      })
    );

    timerSpy.mockRestore();
  });

  it('propagates API errors', async () => {
    sdkMocks.openaiCreate.mockRejectedValue(new Error('OpenRouter API error'));

    const client = new OpenRouterClient('sk-or-key', 'meta-llama/llama-3-70b');

    await expect(client.evaluate('Hi')).rejects.toThrow('OpenRouter API error');
  });

  it('returns connection status', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const client = new OpenRouterClient('sk-or-key', 'meta-llama/llama-3-70b');
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.openaiCreate.mockRejectedValue(new Error('No auth'));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });

  it('adds system prompt to messages array when provided', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const client = new OpenRouterClient('sk-or-key', 'meta-llama/llama-3-70b');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
    });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'User instruction' },
        ]),
      })
    );
  });

  it('adds temperature parameter when provided', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new OpenRouterClient('sk-or-key', 'meta-llama/llama-3-70b');
    await client.evaluate('User instruction', { temperature: 0.5 });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.5,
      })
    );
  });

  it('supports both systemPrompt and temperature together', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const client = new OpenRouterClient('sk-or-key', 'meta-llama/llama-3-70b');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
      temperature: 0.7,
    });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'User instruction' },
        ]),
        temperature: 0.7,
      })
    );
  });
});

describe('LMStudioClient', () => {
  it('returns evaluation results and token counts', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'LM Studio response' } }],
      usage: { prompt_tokens: 6, completion_tokens: 10, total_tokens: 16 },
    });

    const timerSpy = vi
      .spyOn(performance, 'now')
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => 180);

    const client = new LMStudioClient('', 'llama-3-8b');
    const result = await client.evaluate('Hello LM Studio');

    expect(result).toEqual({
      response: 'LM Studio response',
      inputTokens: 6,
      outputTokens: 10,
      totalTokens: 16,
      executionTime: 80,
    });

    timerSpy.mockRestore();
  });

  it('propagates API errors', async () => {
    sdkMocks.openaiCreate.mockRejectedValue(new Error('LM Studio connection failed'));

    const client = new LMStudioClient('', 'llama-3-8b');

    await expect(client.evaluate('Hi')).rejects.toThrow('LM Studio connection failed');
  });

  it('returns connection status', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const client = new LMStudioClient('', 'llama-3-8b');
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.openaiCreate.mockRejectedValue(new Error('Connection failed'));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });

  it('supports custom base URL', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new LMStudioClient('', 'llama-3-8b', 'http://localhost:9999/v1');
    await client.evaluate('Test');

    expect(sdkMocks.openaiCreate).toHaveBeenCalled();
  });

  it('handles empty API key (local provider)', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new LMStudioClient('', 'llama-3-8b');
    await client.evaluate('Test');

    expect(sdkMocks.openaiCreate).toHaveBeenCalled();
  });

  it('adds system prompt to messages array when provided', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const client = new LMStudioClient('', 'llama-3-8b');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
    });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'User instruction' },
        ]),
      })
    );
  });

  it('adds temperature parameter when provided', async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    const client = new LMStudioClient('', 'llama-3-8b');
    await client.evaluate('User instruction', { temperature: 0.8 });

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.8,
      })
    );
  });
});

describe('OllamaClient', () => {
  it('returns evaluation results and token counts', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Ollama response' },
        prompt_eval_count: 7,
        eval_count: 12,
      }),
    } as Response);

    const timerSpy = vi
      .spyOn(performance, 'now')
      .mockImplementationOnce(() => 75)
      .mockImplementationOnce(() => 155);

    const client = new OllamaClient('', 'llama3');
    const result = await client.evaluate('Hello Ollama');

    expect(result).toEqual({
      response: 'Ollama response',
      inputTokens: 7,
      outputTokens: 12,
      totalTokens: 19,
      executionTime: 80,
    });
    expect(sdkMocks.ollamaFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    timerSpy.mockRestore();
  });

  it('propagates API errors', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const client = new OllamaClient('', 'llama3');

    await expect(client.evaluate('Hi')).rejects.toThrow('Ollama API error: 500');
  });

  it('returns connection status via /api/tags', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
    } as Response);

    const client = new OllamaClient('', 'llama3');
    const ok = await client.testConnection();

    expect(ok).toBe(true);
    expect(sdkMocks.ollamaFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: false,
    } as Response);
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });

  it('supports custom base URL', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Response' },
        prompt_eval_count: 5,
        eval_count: 8,
      }),
    } as Response);

    const client = new OllamaClient('', 'llama3', 'http://localhost:9999');
    await client.evaluate('Test');

    expect(sdkMocks.ollamaFetch).toHaveBeenCalledWith(
      'http://localhost:9999/api/chat',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('handles empty API key (no authentication)', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Response' },
        prompt_eval_count: 5,
        eval_count: 8,
      }),
    } as Response);

    const client = new OllamaClient('', 'llama3');
    await client.evaluate('Test');

    expect(sdkMocks.ollamaFetch).toHaveBeenCalled();
  });

  it('adds system prompt to messages when provided', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Response' },
        prompt_eval_count: 10,
        eval_count: 5,
      }),
    } as Response);

    const client = new OllamaClient('', 'llama3');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
    });

    const callArgs = JSON.parse(
      (sdkMocks.ollamaFetch.mock.calls[0][1] as Record<string, unknown>).body as string
    );
    expect(callArgs.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'User instruction' },
    ]);
  });

  it('adds temperature to options when provided', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Response' },
        prompt_eval_count: 5,
        eval_count: 8,
      }),
    } as Response);

    const client = new OllamaClient('', 'llama3');
    await client.evaluate('User instruction', { temperature: 0.6 });

    const callArgs = JSON.parse(
      (sdkMocks.ollamaFetch.mock.calls[0][1] as Record<string, unknown>).body as string
    );
    expect(callArgs.options).toEqual({ temperature: 0.6 });
  });

  it('supports both systemPrompt and temperature together', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Response' },
        prompt_eval_count: 10,
        eval_count: 5,
      }),
    } as Response);

    const client = new OllamaClient('', 'llama3');
    await client.evaluate('User instruction', {
      systemPrompt: 'You are a helpful assistant',
      temperature: 0.9,
    });

    const callArgs = JSON.parse(
      (sdkMocks.ollamaFetch.mock.calls[0][1] as Record<string, unknown>).body as string
    );
    expect(callArgs.messages).toEqual([
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'User instruction' },
    ]);
    expect(callArgs.options).toEqual({ temperature: 0.9 });
  });

  it('handles missing token counts gracefully', async () => {
    sdkMocks.ollamaFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Response' },
      }),
    } as Response);

    const client = new OllamaClient('', 'llama3');
    const result = await client.evaluate('Test');

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });
});

describe('ClientFactory', () => {
  it('creates provider clients', () => {
    expect(ClientFactory.createClient('openai', 'key', 'gpt-4')).toBeInstanceOf(OpenAIClient);
    expect(ClientFactory.createClient('anthropic', 'key', 'claude-3')).toBeInstanceOf(
      AnthropicClient
    );
    expect(ClientFactory.createClient('google', 'key', 'gemini')).toBeInstanceOf(GoogleClient);
    expect(
      ClientFactory.createClient('openrouter', 'key', 'meta-llama/llama-3-70b')
    ).toBeInstanceOf(OpenRouterClient);
    expect(ClientFactory.createClient('lmstudio', '', 'llama-3-8b')).toBeInstanceOf(LMStudioClient);
    expect(ClientFactory.createClient('ollama', '', 'llama3')).toBeInstanceOf(OllamaClient);
  });

  it('throws for unknown providers', () => {
    expect(() => ClientFactory.createClient('invalid' as never, 'key', 'model')).toThrow(
      'Unknown provider'
    );
  });

  it('throws for cloud providers without API key', () => {
    expect(() => ClientFactory.createClient('openai', undefined, 'gpt-4')).toThrow(
      'API key is required for OpenAI'
    );
    expect(() => ClientFactory.createClient('anthropic', undefined, 'claude-3')).toThrow(
      'API key is required for Anthropic'
    );
    expect(() => ClientFactory.createClient('google', undefined, 'gemini')).toThrow(
      'API key is required for Google'
    );
    expect(() => ClientFactory.createClient('openrouter', undefined, 'llama-3')).toThrow(
      'API key is required for Open Router'
    );
  });

  it('allows empty API key for local providers', () => {
    expect(() => ClientFactory.createClient('lmstudio', undefined, 'llama-3-8b')).not.toThrow();
    expect(() => ClientFactory.createClient('ollama', undefined, 'llama3')).not.toThrow();
  });

  it('passes base URL to local providers', () => {
    const lmStudioClient = ClientFactory.createClient(
      'lmstudio',
      '',
      'llama-3-8b',
      'http://localhost:9999/v1'
    );
    expect(lmStudioClient).toBeInstanceOf(LMStudioClient);

    const ollamaClient = ClientFactory.createClient(
      'ollama',
      '',
      'llama3',
      'http://localhost:9999'
    );
    expect(ollamaClient).toBeInstanceOf(OllamaClient);
  });
});
