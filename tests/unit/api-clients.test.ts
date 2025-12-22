import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnthropicClient,
  ClientFactory,
  GoogleClient,
  OpenAIClient,
} from "../../src/lib/api-clients";

const sdkMocks = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  openaiList: vi.fn(),
  anthropicCreate: vi.fn(),
  googleGenerateContent: vi.fn(),
}));

vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: sdkMocks.openaiCreate } };
    models = { list: sdkMocks.openaiList };

    constructor(_opts: { apiKey: string }) {}
  }

  return { default: MockOpenAI };
});

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: sdkMocks.anthropicCreate };

    constructor(_opts: { apiKey: string }) {}
  }

  return { default: MockAnthropic };
});

vi.mock("@google/generative-ai", () => {
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

beforeEach(() => {
  sdkMocks.openaiCreate.mockReset();
  sdkMocks.openaiList.mockReset();
  sdkMocks.anthropicCreate.mockReset();
  sdkMocks.googleGenerateContent.mockReset();
});

describe("OpenAIClient", () => {
  it("returns evaluation results and token counts", async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello" } }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    });

    const timerSpy = vi
      .spyOn(performance, "now")
      .mockImplementationOnce(() => 100)
      .mockImplementationOnce(() => 160);

    const client = new OpenAIClient("api-key", "gpt-4");
    const result = await client.evaluate("Hi");

    expect(result).toEqual({
      response: "Hello",
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
      executionTime: 60,
    });
    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4",
        max_tokens: 4096,
      })
    );

    timerSpy.mockRestore();
  });

  it("uses max_completion_tokens for newer models", async () => {
    sdkMocks.openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    const client = new OpenAIClient("api-key", "gpt-5-preview");
    await client.evaluate("Hi");

    expect(sdkMocks.openaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-preview",
        max_completion_tokens: 4096,
      })
    );
  });

  it("propagates API errors", async () => {
    sdkMocks.openaiCreate.mockRejectedValue(new Error("API error"));

    const client = new OpenAIClient("api-key", "gpt-4");

    await expect(client.evaluate("Hi")).rejects.toThrow("API error");
  });

  it("returns connection status", async () => {
    sdkMocks.openaiList.mockResolvedValue([]);

    const client = new OpenAIClient("api-key", "gpt-4");
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.openaiList.mockRejectedValue(new Error("No auth"));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });
});

describe("AnthropicClient", () => {
  it("returns evaluation results and token counts", async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hi there" }],
      usage: { input_tokens: 4, output_tokens: 6 },
    });

    const timerSpy = vi
      .spyOn(performance, "now")
      .mockImplementationOnce(() => 200)
      .mockImplementationOnce(() => 250);

    const client = new AnthropicClient("api-key", "claude-3-opus");
    const result = await client.evaluate("Hello");

    expect(result).toEqual({
      response: "Hi there",
      inputTokens: 4,
      outputTokens: 6,
      totalTokens: 10,
      executionTime: 50,
    });

    timerSpy.mockRestore();
  });

  it("propagates API errors", async () => {
    sdkMocks.anthropicCreate.mockRejectedValue(new Error("Anthropic down"));

    const client = new AnthropicClient("api-key", "claude-3-opus");

    await expect(client.evaluate("Hello")).rejects.toThrow("Anthropic down");
  });

  it("returns connection status", async () => {
    sdkMocks.anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Ok" }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const client = new AnthropicClient("api-key", "claude-3-opus");
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.anthropicCreate.mockRejectedValue(new Error("No auth"));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });
});

describe("GoogleClient", () => {
  it("returns evaluation results and token counts", async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => "Hey",
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 4,
          totalTokenCount: 7,
        },
      },
    });

    const timerSpy = vi
      .spyOn(performance, "now")
      .mockImplementationOnce(() => 10)
      .mockImplementationOnce(() => 40);

    const client = new GoogleClient("api-key", "gemini-2.0");
    const result = await client.evaluate("Hey");

    expect(result).toEqual({
      response: "Hey",
      inputTokens: 3,
      outputTokens: 4,
      totalTokens: 7,
      executionTime: 30,
    });

    timerSpy.mockRestore();
  });

  it("defaults missing token counts to zero", async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: {
        text: () => "Hey",
      },
    });

    const client = new GoogleClient("api-key", "gemini-2.0");
    const result = await client.evaluate("Hey");

    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it("propagates API errors", async () => {
    sdkMocks.googleGenerateContent.mockRejectedValue(new Error("Gemini down"));

    const client = new GoogleClient("api-key", "gemini-2.0");

    await expect(client.evaluate("Hello")).rejects.toThrow("Gemini down");
  });

  it("returns connection status", async () => {
    sdkMocks.googleGenerateContent.mockResolvedValue({
      response: { text: () => "Ok" },
    });

    const client = new GoogleClient("api-key", "gemini-2.0");
    const ok = await client.testConnection();

    expect(ok).toBe(true);

    sdkMocks.googleGenerateContent.mockRejectedValue(new Error("No auth"));
    const failed = await client.testConnection();

    expect(failed).toBe(false);
  });
});

describe("ClientFactory", () => {
  it("creates provider clients", () => {
    expect(ClientFactory.createClient("openai", "key", "gpt-4")).toBeInstanceOf(OpenAIClient);
    expect(ClientFactory.createClient("anthropic", "key", "claude-3"))
      .toBeInstanceOf(AnthropicClient);
    expect(ClientFactory.createClient("google", "key", "gemini"))
      .toBeInstanceOf(GoogleClient);
  });

  it("throws for unknown providers", () => {
    expect(() => ClientFactory.createClient("invalid" as never, "key", "model")).toThrow(
      "Unknown provider"
    );
  });
});
