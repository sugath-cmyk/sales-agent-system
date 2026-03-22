import { claude, Tool, Message } from './claude-client.js';
import { query } from '../db/client.js';

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools: Tool[];
}

export interface TaskContext {
  taskId: string;
  payload: Record<string, unknown>;
  retryCount: number;
}

export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected conversationHistory: Message[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
  }

  get name(): string {
    return this.config.name;
  }

  // Each agent must implement its own tool execution
  protected abstract executeTool(
    toolName: string,
    input: Record<string, unknown>,
    context: TaskContext
  ): Promise<string>;

  // Main entry point for processing a task
  async processTask(context: TaskContext): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Log task start
      await this.logTaskStart(context);

      // Build the initial prompt from the payload
      const userPrompt = this.buildPromptFromPayload(context.payload);

      // Run the agentic loop
      const { finalResponse, toolResults } = await claude.chatWithTools(
        this.config.systemPrompt,
        [{ role: 'user', content: userPrompt }],
        this.config.tools,
        async (toolName, input) => {
          return this.executeTool(toolName, input, context);
        },
        { maxIterations: 15 }
      );

      // Log task completion
      await this.logTaskComplete(context, {
        response: finalResponse,
        toolsUsed: toolResults.map((t) => t.tool),
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        data: {
          response: finalResponse,
          toolResults,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log task failure
      await this.logTaskFailed(context, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Override to customize how payload becomes a prompt
  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    return JSON.stringify(payload, null, 2);
  }

  // Create a new task in the database
  async createTask(
    taskType: string,
    payload: Record<string, unknown>,
    options?: {
      priority?: number;
      scheduledFor?: Date;
    }
  ): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO agent_tasks (agent_type, task_type, payload, priority, scheduled_for)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        this.config.name,
        taskType,
        JSON.stringify(payload),
        options?.priority || 5,
        options?.scheduledFor || new Date(),
      ]
    );
    return result.rows[0].id;
  }

  // Log analytics event
  protected async logEvent(
    eventType: string,
    leadId?: string,
    campaignId?: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO analytics_events (event_type, agent_type, lead_id, campaign_id, properties)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, this.config.name, leadId, campaignId, JSON.stringify(properties || {})]
    );
  }

  // Check if taskId is a valid UUID
  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  private async logTaskStart(context: TaskContext): Promise<void> {
    // Only log to DB if taskId is a valid UUID, otherwise skip
    if (!this.isValidUUID(context.taskId)) {
      console.log(`[${this.config.name}] Starting task: ${context.taskId}`);
      return;
    }
    await query(
      `UPDATE agent_tasks SET status = 'processing', started_at = NOW(), attempts = attempts + 1
       WHERE id = $1`,
      [context.taskId]
    );
  }

  private async logTaskComplete(
    context: TaskContext,
    result: Record<string, unknown>
  ): Promise<void> {
    // Only log to DB if taskId is a valid UUID, otherwise skip
    if (!this.isValidUUID(context.taskId)) {
      console.log(`[${this.config.name}] Completed task: ${context.taskId}`);
      return;
    }
    await query(
      `UPDATE agent_tasks SET status = 'completed', completed_at = NOW(), result = $2
       WHERE id = $1`,
      [context.taskId, JSON.stringify(result)]
    );
  }

  private async logTaskFailed(context: TaskContext, error: string): Promise<void> {
    // Only log to DB if taskId is a valid UUID, otherwise skip
    if (!this.isValidUUID(context.taskId)) {
      console.log(`[${this.config.name}] Failed task: ${context.taskId} - ${error}`);
      return;
    }
    await query(
      `UPDATE agent_tasks SET status = 'failed', error = $2
       WHERE id = $1`,
      [context.taskId, error]
    );
  }

  // Helper: Get lead by ID
  protected async getLead(leadId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT l.*, c.email, c.first_name, c.last_name, c.linkedin_url,
              co.name as company_name, co.domain, co.industry, co.platform
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.id = $1`,
      [leadId]
    );
    return result.rows[0] || null;
  }

  // Helper: Update lead status
  protected async updateLeadStatus(leadId: string, status: string): Promise<void> {
    await query(
      `UPDATE leads SET status = $2, stage_changed_at = NOW() WHERE id = $1`,
      [leadId, status]
    );
  }

  // Helper: Save conversation
  protected async saveConversation(
    leadId: string,
    channel: string,
    messages: Array<{ role: string; content: string; timestamp: Date }>,
    outcome?: string
  ): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO conversations (lead_id, channel, agent_type, messages, outcome)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [leadId, channel, this.config.name, JSON.stringify(messages), outcome]
    );
    return result.rows[0].id;
  }
}
