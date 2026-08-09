export type AIProvider = "openai" | "anthropic" | "openrouter";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderAdapter {
  chat(options: ChatOptions): Promise<ChatResponse>;
  streamChat(options: ChatOptions): AsyncGenerator<StreamChunk>;
  embed(text: string): Promise<EmbeddingResponse>;
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function getProviderConfig(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return {
        baseUrl: OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY ?? "",
        defaultModel: "gpt-4o-mini",
        embeddingModel: "text-embedding-3-small",
      };
    case "anthropic":
      return {
        baseUrl: ANTHROPIC_BASE_URL,
        apiKey: process.env.ANTHROPIC_API_KEY ?? "",
        defaultModel: "claude-haiku-4-5",
        embeddingModel: null,
      };
    case "openrouter":
      return {
        baseUrl: OPENROUTER_BASE_URL,
        apiKey: process.env.OPENROUTER_API_KEY ?? "",
        defaultModel: "anthropic/claude-haiku-4-5",
        embeddingModel: "openai/text-embedding-3-small",
      };
  }
}

export function createAIProvider(provider: AIProvider): AIProviderAdapter {
  const config = getProviderConfig(provider);

  return {
    async chat(options: ChatOptions): Promise<ChatResponse> {
      const model = options.model ?? config.defaultModel;

      if (provider === "anthropic") {
        return anthropicChat(config.baseUrl, config.apiKey, model, options);
      }

      return openaiChat(config.baseUrl, config.apiKey, model, options, provider === "openrouter");
    },

    async *streamChat(options: ChatOptions): AsyncGenerator<StreamChunk> {
      const model = options.model ?? config.defaultModel;

      if (provider === "anthropic") {
        yield* anthropicStreamChat(config.baseUrl, config.apiKey, model, options);
        return;
      }

      yield* openaiStreamChat(config.baseUrl, config.apiKey, model, options, provider === "openrouter");
    },

    async embed(text: string): Promise<EmbeddingResponse> {
      if (!config.embeddingModel) {
        throw new Error(`Provider ${provider} does not support embeddings.`);
      }

      const response = await fetch(`${config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          ...(provider === "openrouter"
            ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "", "X-Title": "Agent AI" }
            : {}),
        },
        body: JSON.stringify({
          input: text,
          model: config.embeddingModel,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Embedding error [${response.status}]: ${error}`);
      }

      const data = await response.json();
      return {
        embedding: data.data[0].embedding,
        model: config.embeddingModel,
        usage: data.usage,
      };
    },
  };
}

async function openaiChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: ChatOptions,
  isRouter: boolean,
): Promise<ChatResponse> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isRouter ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "", "X-Title": "Agent AI" } : {}),
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat error [${response.status}]: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}

async function* openaiStreamChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: ChatOptions,
  isRouter: boolean,
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isRouter ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "", "X-Title": "Agent AI" } : {}),
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stream error [${response.status}]: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed?.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        yield { content: "", done: true };
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content ?? "";
        if (content) {
          yield { content, done: false };
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  yield { content: "", done: true };
}

async function anthropicChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: ChatOptions,
): Promise<ChatResponse> {
  const systemMessage = options.messages.find((m) => m.role === "system");
  const otherMessages = options.messages.filter((m) => m.role !== "system");

  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1000,
      system: systemMessage?.content,
      messages: otherMessages,
      temperature: options.temperature ?? 0.7,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat error [${response.status}]: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content[0].text,
    usage: data.usage,
  };
}

async function* anthropicStreamChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: ChatOptions,
): AsyncGenerator<StreamChunk> {
  const systemMessage = options.messages.find((m) => m.role === "system");
  const otherMessages = options.messages.filter((m) => m.role !== "system");

  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1000,
      system: systemMessage?.content,
      messages: otherMessages,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stream error [${response.status}]: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed?.startsWith("data: ")) continue;

      const data = trimmed.slice(6);

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta") {
          const content = parsed.delta?.text ?? "";
          if (content) {
            yield { content, done: false };
          }
        }
        if (parsed.type === "message_stop") {
          yield { content: "", done: true };
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  yield { content: "", done: true };
}
