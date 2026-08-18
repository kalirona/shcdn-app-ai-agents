import { z } from "zod";

export interface ToolDefinition<TArgs = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<TArgs>;
  execute: (args: TArgs, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  workspaceId: string;
  agentId: string;
  conversationId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register<TArgs>(definition: ToolDefinition<TArgs>): void {
    this.tools.set(definition.name, definition as ToolDefinition);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async call(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }

    const parsed = tool.parameters.safeParse(args);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    try {
      return await tool.execute(parsed.data, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
