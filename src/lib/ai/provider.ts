export type AIProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "gemini"
  | "glm"
  | "together"
  | "groq"
  | "ollama"
  | "custom";

export interface AIMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
  workspace?: string | null;
  agent?: string | null;
  user?: string | null;
  tools?: AITool[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: AIToolCall[];
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: AIToolCall[];
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

export interface ProviderConfigOverrides {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  embeddingModel?: string | null;
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const TOGETHER_BASE_URL = "https://api.together.xyz/v1";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * Gemini's OpenAI-compatible endpoint lives under /openai within the base url.
 */
function openAiCompatBaseUrl(provider: AIProvider, baseUrl: string): string {
  if (provider === "gemini") {
    return `${baseUrl.replace(/\/$/, "")}/openai`;
  }
  return baseUrl;
}

/**
 * Resolve the embedding model. `undefined` → use the provider default;
 * `null` → explicitly disable embeddings; otherwise use the override.
 */
function pickEmbeddingModel(override: string | null | undefined, fallback: string | null): string | null {
  if (override === undefined) return fallback;
  return override;
}

export function getProviderConfig(provider: AIProvider, overrides: ProviderConfigOverrides = {}) {
  switch (provider) {
    case "openai":
      return {
        baseUrl: overrides.baseUrl ?? OPENAI_BASE_URL,
        apiKey: overrides.apiKey ?? process.env.OPENAI_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "gpt-4o-mini",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, "text-embedding-3-small"),
      };
    case "anthropic":
      return {
        baseUrl: overrides.baseUrl ?? ANTHROPIC_BASE_URL,
        apiKey: overrides.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "claude-haiku-4-5",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, null),
      };
    case "openrouter":
      return {
        baseUrl: overrides.baseUrl ?? OPENROUTER_BASE_URL,
        apiKey: overrides.apiKey ?? process.env.OPENROUTER_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "anthropic/claude-haiku-4-5",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, "openai/text-embedding-3-small"),
      };
    case "gemini":
      return {
        baseUrl: overrides.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
        apiKey: overrides.apiKey ?? process.env.GEMINI_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "gemini-2.0-flash",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, "text-embedding-004"),
      };
    case "glm":
      return {
        baseUrl: overrides.baseUrl ?? "https://open.bigmodel.cn/api/paas/v4",
        apiKey: overrides.apiKey ?? process.env.GLM_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "glm-4-flash",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, "embedding-2"),
      };
    case "together":
      return {
        baseUrl: overrides.baseUrl ?? "https://api.together.xyz/v1",
        apiKey: overrides.apiKey ?? process.env.TOGETHER_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, "togethercomputer/m2-bert-80M-8k-retrieval"),
      };
    case "groq":
      return {
        baseUrl: overrides.baseUrl ?? "https://api.groq.com/openai/v1",
        apiKey: overrides.apiKey ?? process.env.GROQ_API_KEY ?? "",
        defaultModel: overrides.defaultModel ?? "llama-3.3-70b-versatile",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, null),
      };
    case "ollama":
      return {
        baseUrl: overrides.baseUrl ?? "http://localhost:11434",
        apiKey: overrides.apiKey ?? "",
        defaultModel: overrides.defaultModel ?? "llama3.2",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, "nomic-embed-text"),
      };
    case "custom":
      return {
        baseUrl: overrides.baseUrl ?? "",
        apiKey: overrides.apiKey ?? "",
        defaultModel: overrides.defaultModel ?? "",
        embeddingModel: pickEmbeddingModel(overrides.embeddingModel, null),
      };
  }
}

export function createAIProvider(provider: AIProvider, overrides: ProviderConfigOverrides = {}): AIProviderAdapter {
  const config = getProviderConfig(provider, overrides);

  return {
    async chat(options: ChatOptions): Promise<ChatResponse> {
      const model = options.model ?? config.defaultModel;
      const call = () => {
        if (provider === "anthropic") {
          return anthropicChat(config.baseUrl, config.apiKey, model, options);
        }
        const isRouter = provider === "openrouter";
        return openaiChat(openAiCompatBaseUrl(provider, config.baseUrl), config.apiKey, model, options, isRouter);
      };

      // Free-tier models on routers frequently return transient 429/5xx or
      // network hiccups; retry a few times with backoff before giving up so a
      // single blip doesn't surface as the agent fallback message.
      const maxAttempts = 4;
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await call();
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          const statusMatch = message.match(/\[(\d{3})\]/);
          const status = statusMatch ? Number(statusMatch[1]) : 0;
          const transient = status === 429 || status === 0 || (status >= 500 && status < 600);
          if (!transient || attempt === maxAttempts) break;
          const delayMs = Math.min(500 * 2 ** (attempt - 1), 4000);
          console.warn(`[ai-provider] transient chat failure (${status || "network"}), retry ${attempt}/${maxAttempts - 1} in ${delayMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      throw lastError;
    },

    async *streamChat(options: ChatOptions): AsyncGenerator<StreamChunk> {
      const model = options.model ?? config.defaultModel;

      if (provider === "anthropic") {
        yield* anthropicStreamChat(config.baseUrl, config.apiKey, model, options);
        return;
      }

      const isRouter = provider === "openrouter";
      yield* openaiStreamChat(openAiCompatBaseUrl(provider, config.baseUrl), config.apiKey, model, options, isRouter);
    },

    async embed(text: string): Promise<EmbeddingResponse> {
      if (!config.embeddingModel) {
        throw new Error(`Provider ${provider} does not support embeddings.`);
      }

      const response = await fetch(`${openAiCompatBaseUrl(provider, config.baseUrl)}/embeddings`, {
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

/**
 * Normalize provider usage responses (snake_case OpenAI-style, Anthropic
 * input/output_tokens, or camelCase) into the platform's canonical shape.
 */
function normalizeUsage(usage: unknown): ChatResponse["usage"] {
  if (!usage || typeof usage !== "object") return undefined;
  const u = usage as Record<string, number | undefined>;
  const promptTokens =
    u.promptTokens ?? u.prompt_tokens ?? u.inputTokens ?? u.input_tokens ?? 0;
  const completionTokens =
    u.completionTokens ?? u.completion_tokens ?? u.outputTokens ?? u.output_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: u.totalTokens ?? u.total_tokens ?? promptTokens + completionTokens,
  };
}

async function openaiChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: ChatOptions,
  isRouter: boolean,
): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1000,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isRouter ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "", "X-Title": "Agent AI" } : {}),
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[ai-provider] openaiChat failed: model=${model} bodyModel=${(body as { model?: string }).model}`);
    throw new Error(`Chat error [${response.status}]: ${error}`);
  }

  const data = await response.json();
  const message = data.choices[0].message;
  return {
    content: message.content ?? "",
    usage: normalizeUsage(data.usage),
    toolCalls: message.tool_calls,
  };
}

async function* openaiStreamChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  options: ChatOptions,
  isRouter: boolean,
): AsyncGenerator<StreamChunk> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1000,
    stream: true,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isRouter ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "", "X-Title": "Agent AI" } : {}),
    },
    body: JSON.stringify(body),
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
  let toolCallsBuffer: AIToolCall[] = [];

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
        if (toolCallsBuffer.length > 0) {
          yield { content: "", done: true, toolCalls: toolCallsBuffer };
        } else {
          yield { content: "", done: true };
        }
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        const content = delta.content ?? "";
        if (content) {
          yield { content, done: false };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.index !== undefined) {
              if (!toolCallsBuffer[tc.index]) {
                toolCallsBuffer[tc.index] = { id: "", type: "function", function: { name: "", arguments: "" } };
              }
              if (tc.id) toolCallsBuffer[tc.index].id = tc.id;
              if (tc.function?.name) toolCallsBuffer[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallsBuffer[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      } catch {
        // Skip malformed chunks
      }
    }
  }

  if (toolCallsBuffer.length > 0) {
    yield { content: "", done: true, toolCalls: toolCallsBuffer.filter(Boolean) };
  }
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
    usage: normalizeUsage(data.usage),
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
