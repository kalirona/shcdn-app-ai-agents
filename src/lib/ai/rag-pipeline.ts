import type { AgentEntity } from "@/lib/db/entities";
import { getAIDefaults } from "@/lib/db/repositories/ai-defaults.repo";

import { createGateway, type GatewayPurpose } from "./gateway";
import { type AIMessage, type AIProviderAdapter, type AIToolCall } from "./provider";
import { type SearchResult, vectorSearch } from "./vector-search";
import { toolRegistry, registerAllTools } from "@/lib/tools";

export interface RagContext {
  agent: AgentEntity;
  query: string;
  history: AIMessage[];
  conversationId?: string;
}

export interface RagResult {
  content: string;
  sources: Array<{
    title: string | null;
    url: string | null;
    chunkId: string;
  }>;
  confidence: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface RagStreamChunk {
  content: string;
  done: boolean;
  sources?: RagResult["sources"];
  usage?: RagResult["usage"];
}

interface RuntimeAdapters {
  chat: AIProviderAdapter;
  embeddings: AIProviderAdapter;
}

/**
 * Resolve provider adapters via the platform gateway for the requested purpose.
 * Throws a clear error when no enabled model covers the capability so the
 * caller surfaces the real problem instead of silently degrading.
 */
async function runtimeAdapters(purpose: GatewayPurpose): Promise<RuntimeAdapters> {
  const gateway = await createGateway();
  const chat = await gateway.adapterFor(purpose);
  const embeddings = await gateway.adapterFor("embeddings");
  if (!chat || !embeddings) {
    throw new Error(
      "No enabled AI model is configured for the requested capability. " +
        "Enable a model in Admin → Settings → AI Models and set defaults in AI Defaults.",
    );
  }
  return { chat, embeddings };
}

function detectToolIntent(query: string, tools: Array<{ function: { name: string } }>): Array<{ name: string; arguments: Record<string, unknown> }> {
  const lowerQuery = query.toLowerCase();
  const availableToolNames = tools.map(t => t.function.name);
  const calls = [];

  // Check for availability check intent - trigger on availability keywords OR booking with specific time/date
  const hasAvailabilityKeywords = lowerQuery.includes("availab") || lowerQuery.includes("open") || lowerQuery.includes("slot") || lowerQuery.includes("time");
  const hasBookingWithTime = (lowerQuery.includes("book") || lowerQuery.includes("schedule")) && 
                             (lowerQuery.includes("tomorrow") || lowerQuery.includes("today") || lowerQuery.includes("at ") || lowerQuery.includes("am") || lowerQuery.includes("pm") || /\d{1,2}:\d{2}/.test(query));
  
  if (availableToolNames.includes("check_availability") && (hasAvailabilityKeywords || hasBookingWithTime)) {
    // Extract date - simple heuristic: look for "tomorrow", "today", or YYYY-MM-DD
    let date = new Date().toISOString().split('T')[0]; // default to today
    if (lowerQuery.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = tomorrow.toISOString().split('T')[0];
    } else if (lowerQuery.includes("today")) {
      date = new Date().toISOString().split('T')[0];
    } else {
      // Try to find YYYY-MM-DD pattern
      const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) date = dateMatch[0];
    }
    
    // Extract service
    let service = "appointment";
    const serviceKeywords = ["cleaning", "whitening", "checkup", "check-up", "filling", "crown", "root canal", "extraction"];
    for (const kw of serviceKeywords) {
      if (lowerQuery.includes(kw)) {
        service = kw;
        break;
      }
    }
    
    calls.push({ name: "check_availability", arguments: { service, date } });
  }

  // Check for booking intent
  if (availableToolNames.includes("create_booking") && 
      (lowerQuery.includes("book") || lowerQuery.includes("schedule") || lowerQuery.includes("appointment"))) {
    // Try to extract details
    let date = new Date().toISOString().split('T')[0];
    if (lowerQuery.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = tomorrow.toISOString().split('T')[0];
    } else if (lowerQuery.includes("today")) {
      date = new Date().toISOString().split('T')[0];
    } else {
      const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) date = dateMatch[0];
    }
    
    let time = "10:00";
    // Extract time with 12-hour format support (e.g., "2:00 PM" -> "14:00")
    const timeMatch12h = query.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (timeMatch12h) {
      let hour = parseInt(timeMatch12h[1], 10);
      const minute = timeMatch12h[2];
      const period = timeMatch12h[3].toLowerCase();
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      time = `${String(hour).padStart(2, '0')}:${minute}`;
    } else {
      // Fallback to 24-hour format
      const timeMatch24h = query.match(/\d{1,2}:\d{2}/);
      if (timeMatch24h) time = timeMatch24h[0].padStart(5, '0');
    }
    
    let service = "appointment";
    const serviceKeywords = ["cleaning", "whitening", "checkup", "check-up", "filling", "crown", "root canal", "extraction"];
    for (const kw of serviceKeywords) {
      if (lowerQuery.includes(kw)) {
        service = kw;
        break;
      }
    }
    
    // Extract customer info from query
    let customerName = "";
    let customerEmail = "";
    let customerPhone = "";
    
    // Extract name: "my name is X", "I'm X", "name is X"
    const namePatterns = [
      /my name is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /i'm\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /name is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /this is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
    ];
    for (const pattern of namePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerName = match[1].trim();
        break;
      }
    }
    
    // If no name found with patterns, try to extract from "I'm John Doe" at start of sentence
    if (!customerName) {
      const startNameMatch = query.match(/^i'm\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i);
      if (startNameMatch && startNameMatch[1]) {
        customerName = startNameMatch[1].trim();
      }
    }
    
    // Extract email: "email is X", "my email is X", or bare email
    const emailPatterns = [
      /email is\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /my email is\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    ];
    for (const pattern of emailPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerEmail = match[1].trim();
        break;
      }
    }
    
    // Extract phone: "phone is X", "number is X", or bare phone
    const phonePatterns = [
      /phone is\s+([\d\s\-\(\)\+]+)/i,
      /number is\s+([\d\s\-\(\)\+]+)/i,
      /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
    ];
    for (const pattern of phonePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerPhone = match[1].trim();
        break;
      }
    }
    
    // If we have the minimum required info (name and email), create the booking
    if (customerName && customerEmail) {
      calls.push({ 
        name: "create_booking", 
        arguments: { 
          service, 
          date, 
          time, 
          customerName, 
          customerEmail,
          customerPhone: customerPhone || undefined,
        } 
      });
    }
  }

  // Check for cancel booking intent
  if (availableToolNames.includes("cancel_booking") && 
      (lowerQuery.includes("cancel") || lowerQuery.includes("call off") || lowerQuery.includes("delete"))) {
    let date = new Date().toISOString().split('T')[0];
    if (lowerQuery.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = tomorrow.toISOString().split('T')[0];
    } else if (lowerQuery.includes("today")) {
      date = new Date().toISOString().split('T')[0];
    } else {
      const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) date = dateMatch[0];
    }
    
    let customerName = "";
    let customerEmail = "";
    
    // Extract name
    const namePatterns = [
      /my name is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /i'm\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /name is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /this is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
    ];
    for (const pattern of namePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerName = match[1].trim();
        break;
      }
    }
    
    // Extract email
    const emailPatterns = [
      /email is\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /my email is\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    ];
    for (const pattern of emailPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerEmail = match[1].trim();
        break;
      }
    }
    
    // If we have enough info, trigger cancel
    if ((customerName || customerEmail) && date) {
      const args: Record<string, unknown> = { date };
      if (customerName) args.customerName = customerName;
      if (customerEmail) args.customerEmail = customerEmail;
      calls.push({ name: "cancel_booking", arguments: args });
    }
  }

  // Check for reschedule booking intent
  if (availableToolNames.includes("reschedule_booking") && 
      (lowerQuery.includes("reschedul") || lowerQuery.includes("move") || lowerQuery.includes("change") || lowerQuery.includes("different time"))) {
    let currentDate = "";
    let currentTime = "";
    let newDate = "";
    let newTime = "";
    let customerName = "";
    let customerEmail = "";
    
    // Extract current date
    if (lowerQuery.includes("tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      currentDate = tomorrow.toISOString().split('T')[0];
    } else if (lowerQuery.includes("today")) {
      currentDate = new Date().toISOString().split('T')[0];
    } else {
      const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) currentDate = dateMatch[0];
    }
    
    // Extract current time
    const currentTimeMatch = query.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (currentTimeMatch) {
      let hour = parseInt(currentTimeMatch[1], 10);
      const minute = currentTimeMatch[2];
      const period = currentTimeMatch[3].toLowerCase();
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      currentTime = `${String(hour).padStart(2, '0')}:${minute}`;
    } else {
      const timeMatch24h = query.match(/\d{1,2}:\d{2}/);
      if (timeMatch24h) currentTime = timeMatch24h[0].padStart(5, '0');
    }
    
    // Extract new date
    if (lowerQuery.includes("to tomorrow")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      newDate = tomorrow.toISOString().split('T')[0];
    } else if (lowerQuery.includes("to today")) {
      newDate = new Date().toISOString().split('T')[0];
    } else {
      const newDateMatch = query.match(/to\s+(\d{4}-\d{2}-\d{2})/);
      if (newDateMatch) newDate = newDateMatch[1];
    }
    
    // Extract new time
    const newTimeMatch = query.match(/to\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (newTimeMatch) {
      let hour = parseInt(newTimeMatch[1], 10);
      const minute = newTimeMatch[2];
      const period = newTimeMatch[3].toLowerCase();
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      newTime = `${String(hour).padStart(2, '0')}:${minute}`;
    } else {
      const newTimeMatch24h = query.match(/to\s+(\d{1,2}:\d{2})/);
      if (newTimeMatch24h) newTime = newTimeMatch24h[1].padStart(5, '0');
    }
    
    // Extract customer info
    const namePatterns = [
      /my name is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /i'm\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
      /name is\s+([a-zA-Z\s]+?)(?:\s+(?:and|,|\.|$))/i,
    ];
    for (const pattern of namePatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerName = match[1].trim();
        break;
      }
    }
    
    const emailPatterns = [
      /email is\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /my email is\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    ];
    for (const pattern of emailPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        customerEmail = match[1].trim();
        break;
      }
    }
    
    // If we have enough info, trigger reschedule
    if ((customerName || customerEmail) && currentDate && newDate && newTime) {
      const args: Record<string, unknown> = { newDate, newTime };
      if (customerName) args.customerName = customerName;
      if (customerEmail) args.customerEmail = customerEmail;
      if (currentDate) args.date = currentDate;
      if (currentTime) args.time = currentTime;
      calls.push({ name: "reschedule_booking", arguments: args });
}
  }
  return calls;
}

// Ensure tools are registered (lazy initialization)
let toolsRegistered = false;
function ensureToolsRegistered() {
  if (!toolsRegistered) {
    registerAllTools();
    toolsRegistered = true;
  }
}

export async function ragQuery(context: RagContext): Promise<RagResult> {
  ensureToolsRegistered();
  const adapters = await runtimeAdapters("chat");

  let searchResults: SearchResult[] = [];
  let searchError: unknown = null;

  try {
    const embedding = await adapters.embeddings.embed(context.query);
    searchResults = await vectorSearch({
      embedding: embedding.embedding,
      workspaceId: context.agent.workspace,
      agentId: context.agent.id,
      limit: 5,
      threshold: 0.2,
    });
  } catch (error) {
    searchError = error;
    console.error("Embedding/search failed:", error);
  }

  const defaults = await getAIDefaults();
  const systemPrompt = buildSystemPrompt(
    context.agent,
    searchResults,
    searchError,
    defaults.platformSystemPrompt,
    defaults.platformSafetyRules,
    defaults.defaultSystemPrompt,
  );

  // Add tool descriptions to system prompt for text-based tool calling
  let tools: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }> = [];
  if (context.agent?.allowed_tools && context.agent.allowed_tools.length > 0) {
    tools = resolveAgentTools(context.agent.allowed_tools);
  }
  const toolDescriptions = tools.length > 0
    ? `\n\n## AVAILABLE TOOLS\nYou have access to the following tools. When you need to use a tool, respond with ONLY a tool call block in this exact format:\n\nTOOL_CALL: tool_name {"arg1": "value1", "arg2": "value2"}\n\nAvailable tools:\n${tools.map(t => `- ${t.function.name}: ${t.function.description}\n  Parameters: ${JSON.stringify(t.function.parameters)}`).join("\n\n")}`
    : "";

  const systemPromptWithTools = systemPrompt + toolDescriptions;

  let messages: AIMessage[] = [
    { role: "system", content: systemPromptWithTools },
    ...context.history,
    { role: "user", content: context.query },
  ];

  // Auto-trigger tools based on keywords in user query (more reliable than model function calling)
  const autoToolCalls = detectToolIntent(context.query, tools);
  for (const autoCall of autoToolCalls) {
    try {
      const result = await toolRegistry.call(autoCall.name, autoCall.arguments, {
        workspaceId: context.agent.workspace,
        agentId: context.agent.id,
        conversationId: context.conversationId,
      });
      messages.push({ role: "user", content: `Tool result for ${autoCall.name}: ${JSON.stringify(result)}` });
    } catch (toolError) {
      console.error(`Auto-tool ${autoCall.name} failed:`, toolError);
    }
  }

  try {
    const gateway = await createGateway();
    let response = await gateway.chat({
      messages,
      temperature: 0.3,
      maxTokens: 500,
      purpose: "chat",
      workspace: context.agent.workspace ?? null,
      agent: context.agent.id ?? null,
    });

    // Also check for tool calls in AI response (for multi-step)
    let iterations = 0;
    const maxIterations = 3;
    while (iterations < maxIterations) {
      iterations++;
      const toolCalls = parseToolCalls(response.content);
      if (!toolCalls || toolCalls.length === 0) break;

      for (const toolCall of toolCalls) {
        try {
          const result = await toolRegistry.call(toolCall.name, toolCall.arguments, {
            workspaceId: context.agent.workspace,
            agentId: context.agent.id,
            conversationId: context.conversationId,
          });
          messages.push({ role: "assistant", content: response.content });
          messages.push({ role: "user", content: `Tool result for ${toolCall.name}: ${JSON.stringify(result)}` });
        } catch (toolError) {
          console.error(`Tool ${toolCall.name} failed:`, toolError);
          messages.push({ role: "user", content: `Tool error for ${toolCall.name}: ${toolError}` });
        }
      }

      response = await gateway.chat({
        messages,
        temperature: 0.3,
        maxTokens: 500,
        purpose: "chat",
        workspace: context.agent.workspace ?? null,
        agent: context.agent.id ?? null,
      });
    }

    const finalContent = stripToolCalls(response.content);
    const trimmed = finalContent.trim();
    if (!trimmed) {
      return {
        content: context.agent.fallback_message,
        sources: [],
        confidence: 0,
        usage: response.usage,
      };
    }

    const confidence = calculateConfidence(searchResults);

    return {
      content: trimmed,
      sources: searchResults.map((r) => ({
        title: r.sourceTitle,
        url: r.sourceUrl,
        chunkId: r.id,
      })),
      confidence,
      usage: response.usage,
    };
  } catch (error) {
    console.error("RAG chat call failed:", error);
    return {
      content: context.agent.fallback_message,
      sources: [],
      confidence: 0,
    };
  }
}

export async function * ragStreamQuery(context: RagContext): AsyncGenerator<RagStreamChunk> {
  const adapters = await runtimeAdapters("chat");

  let searchResults: SearchResult[] = [];
  let searchError: unknown = null;

  try {
    const embedding = await adapters.embeddings.embed(context.query);
    searchResults = await vectorSearch({
      embedding: embedding.embedding,
      workspaceId: context.agent.workspace,
      agentId: context.agent.id,
      limit: 5,
      threshold: 0.2,
    });
  } catch (error) {
    searchError = error;
    console.error("Embedding/search failed:", error);
  }

  const defaults = await getAIDefaults();
  const systemPrompt = buildSystemPrompt(
    context.agent,
    searchResults,
    searchError,
    defaults.platformSystemPrompt,
    defaults.platformSafetyRules,
    defaults.defaultSystemPrompt,
  );
  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    ...context.history,
    { role: "user", content: context.query },
  ];

  let fullContent = "";

  try {
    for await (const chunk of adapters.chat.streamChat({
      messages,
      temperature: 0.3,
      maxTokens: 500,
    })) {
      if (chunk.done) {
        yield {
          content: "",
          done: true,
          sources: searchResults.map((r) => ({
            title: r.sourceTitle,
            url: r.sourceUrl,
            chunkId: r.id,
          })),
        };
        return;
      }
      fullContent += chunk.content;
      yield {
        content: chunk.content,
        done: false,
      };
    }

    if (!fullContent.trim()) {
      yield {
        content: context.agent.fallback_message,
        done: true,
        sources: [],
      };
      return;
    }

    yield {
      content: "",
      done: true,
      sources: searchResults.map((r) => ({
        title: r.sourceTitle,
        url: r.sourceUrl,
        chunkId: r.id,
      })),
    };
  } catch (error) {
    console.error("RAG stream chat call failed:", error);
    yield {
      content: context.agent.fallback_message,
      done: true,
      sources: [],
    };
  }
}

function buildSystemPrompt(
  agent: AgentEntity,
  searchResults: SearchResult[],
  searchError: unknown,
  platformSystemPrompt: string | null,
  platformSafetyRules: string | null,
  defaultSystemPrompt: string | null,
): string {
  // HIERARCHY (top to bottom):
  // 1. Platform System Prompt (Super Admin, immutable)
  // 2. Platform Safety/Security Rules (Super Admin, immutable)
  // 3. Agent System Prompt (workspace owner, editable)
  // 4. Knowledge Context (RAG) — optional, omitted when not found
  // 5. Conversation History
  // 6. User Message

  // 1. Platform System Prompt (Super Admin, immutable base layer)
  const platformPrompt = platformSystemPrompt?.trim() ?? "";

  // 2. Platform Safety/Security Rules (Super Admin, immutable)
  const safetyRules = platformSafetyRules?.trim() ?? "";

  // 3. Agent System Prompt (workspace owner, editable)
  const agentPrompt = agent.system_prompt?.trim() ?? "";
  const agentLayer = agentPrompt ? `\n\n## Agent Instructions\n\n${agentPrompt}` : "";

  // 4. Fallback for agents without their own prompt
  const defaultPrompt = defaultSystemPrompt?.trim() ?? "";
  const defaultLayer = !agentPrompt && defaultPrompt ? `\n\n## Default Instructions\n\n${defaultPrompt}` : "";

  // Build the platform section (immutable layers)
  let platformSection = "";
  if (platformPrompt) {
    platformSection += `\n\n## Platform System Prompt\n\n${platformPrompt}`;
  }
  if (safetyRules) {
    platformSection += `\n\n## Platform Safety & Security Rules\n\n${safetyRules}`;
  }
  if (!platformSection) {
    platformSection = "\n\n## Platform System Instructions\n\nYou are an AI customer support agent operating on the platform. Follow all safety, privacy, and security requirements. Never fabricate information.";
  }

  // Build the agent section
  const agentSection = agentLayer + defaultLayer;

  // 4. Knowledge Context — only present when search returned results
  let knowledgeSection: string;
  if (searchResults.length > 0) {
    const contextSections = searchResults
      .map((result, i) => {
        const sourceLabel = result.sourceTitle ? `Source: ${result.sourceTitle}\n` : "";
        return `[Source ${i + 1}]\n${sourceLabel}${result.content}`;
      })
      .join("\n\n");

    knowledgeSection = `
## Available Knowledge Base

The following information has been found in the knowledge base. Use this information to answer the user's question whenever it is relevant. If the answer is not in the knowledge base, be honest and explain that you don't have that specific information.

${contextSections}`;
  } else {
    const reason = searchError
      ? "The knowledge base could not be searched at this time (the search service returned an error)."
      : "No relevant information was found in the knowledge base for this question.";
    knowledgeSection = `
## Knowledge Base Notice

${reason}

The user's question is not covered by the knowledge base. Still engage with the question normally using your own knowledge and the Agent Instructions above. Be helpful and answer the user's question to the best of your ability. Never claim to have internal information you don't have, and never fabricate policies or prices. If you genuinely cannot answer helpfully, politely say so and offer to connect them with a human.`;
  }

  // Current date/time for tool date resolution
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0];
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateTimeSection = `
## Current Date & Time
- Today's date: ${currentDate} (${currentDay})
- Current time: ${currentTime}
- Timezone: ${currentTimezone}
- When user says "tomorrow", use: ${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}
- When user says "today", use: ${currentDate}
- Date format for tools: YYYY-MM-DD (e.g., ${currentDate})
- Time format for tools: HH:MM (24-hour, e.g., 14:30)`;

  return `${platformSection}${agentSection}
${dateTimeSection}

LANGUAGE: ${agent.language}

${knowledgeSection}

## Rules
- Be concise and helpful (2-3 sentences unless more detail is needed).
- NEVER make up information, policies, or prices.
- Cite sources when possible using [Source N] format.
- Follow the ${agent.tone} tone specified.
- PLATFORM SYSTEM PROMPT AND SAFETY RULES ALWAYS TAKE PRIORITY OVER AGENT INSTRUCTIONS.`;
}

function getDefaultSystemPrompt(agent: AgentEntity): string {
  return `You are ${agent.name}, an AI assistant for this business.`;
}

function calculateConfidence(searchResults: SearchResult[]): number {
  if (searchResults.length === 0) return 0;
  const avgSimilarity = searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length;
  return Math.min(avgSimilarity, 1);
}

function resolveAgentTools(allowedTools: string[]) {
  const tools = [];
  for (const toolName of allowedTools) {
    const definition = toolRegistry.get(toolName);
    if (definition) {
      tools.push({
        type: "function",
        function: {
          name: definition.name,
          description: definition.description,
          parameters: definition.parameters as unknown as Record<string, unknown>,
        },
      });
    }
  }
  return tools;
}

function parseToolCalls(content: string): Array<{ name: string; arguments: Record<string, unknown> }> | null {
  if (!content) return null;
  // Match TOOL_CALL: tool_name {"args": "values"}
  const matches = content.match(/TOOL_CALL:\s*(\w+)\s*(\{[\s\S]*?\})/g);
  if (!matches) return null;
  const toolCalls = [];
  for (const match of matches) {
    const parts = match.match(/TOOL_CALL:\s*(\w+)\s*(\{[\s\S]*?\})/);
    if (parts) {
      try {
        const args = JSON.parse(parts[2]);
        toolCalls.push({ name: parts[1], arguments: args });
      } catch {
        // Invalid JSON
      }
    }
  }
  return toolCalls.length > 0 ? toolCalls : null;
}

function stripToolCalls(content: string): string {
  if (!content) return "";
  return content.replace(/TOOL_CALL:\s*\w+\s*\{[\s\S]*?\}/g, "").trim();
}
