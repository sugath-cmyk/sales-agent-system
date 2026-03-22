import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';

export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

export interface AgentResponse {
  content: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

class ClaudeClient {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-20250514';
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
    });
  }

  async chat(
    systemPrompt: string,
    messages: Message[],
    options?: {
      tools?: Tool[];
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<AgentResponse> {
    const { tools, maxTokens = 4096, temperature = 0.7 } = options || {};

    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          ...(tools && { tools }),
        });

        // Extract text content
        const textContent = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        // Extract tool calls
        const toolCalls = response.content
          .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
          .map((block) => ({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          }));

        return {
          content: textContent,
          toolCalls,
          stopReason: response.stop_reason || 'end_turn',
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      } catch (error) {
        attempts++;
        if (attempts >= this.maxRetries) {
          throw error;
        }
        await this.delay(this.retryDelay * attempts);
      }
    }

    throw new Error('Max retries exceeded');
  }

  async chatWithTools(
    systemPrompt: string,
    messages: Message[],
    tools: Tool[],
    executeToolFn: (toolName: string, input: Record<string, unknown>) => Promise<string>,
    options?: {
      maxIterations?: number;
      maxTokens?: number;
    }
  ): Promise<{ finalResponse: string; toolResults: Array<{ tool: string; result: string }> }> {
    const { maxIterations = 10, maxTokens = 4096 } = options || {};
    const conversationHistory: Message[] = [...messages];
    const toolResults: Array<{ tool: string; result: string }> = [];

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.chat(systemPrompt, conversationHistory, {
        tools,
        maxTokens,
      });

      // No tool calls - we're done
      if (response.toolCalls.length === 0) {
        return { finalResponse: response.content, toolResults };
      }

      // Add assistant message with tool calls
      conversationHistory.push({
        role: 'assistant',
        content: response.toolCalls.map((tc) => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.name,
          input: tc.input,
        })),
      });

      // Execute tools and collect results
      const results: ToolResult[] = [];
      for (const toolCall of response.toolCalls) {
        try {
          const result = await executeToolFn(toolCall.name, toolCall.input);
          results.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: result,
          });
          toolResults.push({ tool: toolCall.name, result });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: `Error: ${errorMessage}`,
          });
          toolResults.push({ tool: toolCall.name, result: `Error: ${errorMessage}` });
        }
      }

      // Add tool results
      conversationHistory.push({
        role: 'user',
        content: results as unknown as Anthropic.ContentBlock[],
      });
    }

    throw new Error('Max iterations exceeded');
  }

  // Generate simple text without tools
  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    const response = await this.chat(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      options
    );
    return response.content;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const claude = new ClaudeClient();
