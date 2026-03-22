import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';

// Import all agents
import { leadResearchAgent } from '../lead-research/index.js';
import { leadScoringAgent } from '../lead-scoring/index.js';
import { emailAgent } from '../email/index.js';
import { linkedInAgent } from '../linkedin/index.js';
import { contentAgent } from '../content/index.js';

const SYSTEM_PROMPT = `You are the Orchestrator Agent - the central coordinator for the autonomous sales system targeting Shopify merchants.

Your role:
1. Coordinate tasks across all specialized agents
2. Monitor system health and performance
3. Make high-level decisions about resource allocation
4. Handle escalations and edge cases
5. Ensure the sales pipeline flows smoothly

Available Agents:
- Lead Research Agent: Scans Shopify stores, detects shopping assistants
- Lead Scoring Agent: Scores leads based on ICP fit and intent
- Email Agent: Handles all email outreach sequences
- LinkedIn Agent: Manages LinkedIn connections and DMs
- Content Agent: Creates marketing content

Decision Framework:
1. New leads → Send to Lead Research for qualification
2. Researched leads → Send to Lead Scoring
3. High-score leads (70+) → Start multi-channel outreach (Email + LinkedIn)
4. Warm leads (50-69) → Email sequence only
5. Engaged leads → Prioritize and notify for human follow-up
6. Low-score leads (<30) → Move to nurture or disqualify

You operate in a supervisory capacity - delegate actual work to specialized agents.`;

const TOOLS: Tool[] = [
  {
    name: 'get_pipeline_overview',
    description: 'Get overview of current sales pipeline',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get status and health of all agents',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dispatch_to_agent',
    description: 'Dispatch a task to a specific agent',
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description: 'Agent name: lead_research, lead_scoring, email, linkedin, content',
        },
        task_type: {
          type: 'string',
          description: 'Type of task to dispatch',
        },
        payload: {
          type: 'object',
          description: 'Task payload',
        },
        priority: {
          type: 'number',
          description: 'Priority 1-10 (higher = more urgent)',
        },
      },
      required: ['agent', 'task_type', 'payload'],
    },
  },
  {
    name: 'process_new_domains',
    description: 'Process a batch of new Shopify domains for research',
    input_schema: {
      type: 'object',
      properties: {
        domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of domains to process',
        },
      },
      required: ['domains'],
    },
  },
  {
    name: 'run_daily_operations',
    description: 'Run daily operational tasks across all agents',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_hot_leads',
    description: 'Get leads that need immediate attention',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate a lead or situation to human review',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
        },
        reason: {
          type: 'string',
        },
        urgency: {
          type: 'string',
          description: 'low, medium, high',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'get_performance_report',
    description: 'Get performance metrics for the system',
    input_schema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          description: 'day, week, month',
        },
      },
    },
  },
  {
    name: 'optimize_outreach',
    description: 'Analyze and suggest optimizations for outreach',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

export class OrchestratorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent>;

  constructor() {
    const config: AgentConfig = {
      name: 'orchestrator',
      description: 'Central coordinator for all sales agents',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
    };
    super(config);

    // Register all agents
    this.agents = new Map([
      ['lead_research', leadResearchAgent],
      ['lead_scoring', leadScoringAgent],
      ['email', emailAgent],
      ['linkedin', linkedInAgent],
      ['content', contentAgent],
    ]);
  }

  protected async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    context: TaskContext
  ): Promise<string> {
    switch (toolName) {
      case 'get_pipeline_overview':
        return this.handleGetPipelineOverview();

      case 'get_agent_status':
        return this.handleGetAgentStatus();

      case 'dispatch_to_agent':
        return this.handleDispatchToAgent(input);

      case 'process_new_domains':
        return this.handleProcessNewDomains(input.domains as string[]);

      case 'run_daily_operations':
        return this.handleRunDailyOperations();

      case 'get_hot_leads':
        return this.handleGetHotLeads(input.limit as number | undefined);

      case 'escalate_to_human':
        return this.handleEscalateToHuman(input);

      case 'get_performance_report':
        return this.handleGetPerformanceReport(input.time_period as string | undefined);

      case 'optimize_outreach':
        return this.handleOptimizeOutreach();

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleGetPipelineOverview(): Promise<string> {
    const pipelineResult = await query(`
      SELECT
        status,
        COUNT(*) as count,
        AVG(total_score) as avg_score
      FROM leads
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'new' THEN 1
          WHEN 'researched' THEN 2
          WHEN 'contacted' THEN 3
          WHEN 'engaged' THEN 4
          WHEN 'meeting_booked' THEN 5
          WHEN 'demo_done' THEN 6
          WHEN 'proposal_sent' THEN 7
          WHEN 'negotiating' THEN 8
          WHEN 'closed_won' THEN 9
          WHEN 'closed_lost' THEN 10
        END
    `);

    const totalResult = await query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE total_score >= 70) as hot_leads,
        COUNT(*) FILTER (WHERE total_score >= 50 AND total_score < 70) as warm_leads,
        COUNT(*) FILTER (WHERE total_score < 50) as cold_leads
      FROM leads
    `);

    const recentResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week
      FROM leads
    `);

    return JSON.stringify({
      pipeline: pipelineResult.rows,
      summary: totalResult.rows[0],
      recent_activity: recentResult.rows[0],
    }, null, 2);
  }

  private async handleGetAgentStatus(): Promise<string> {
    const taskStats = await query(`
      SELECT
        agent_type,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_24h,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_24h
      FROM agent_tasks
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY agent_type
    `);

    const agentStatus: Record<string, unknown> = {};
    for (const [name] of this.agents) {
      const stats = taskStats.rows.find((r) => r.agent_type === name) || {
        pending: 0,
        processing: 0,
        completed_24h: 0,
        failed_24h: 0,
      };
      agentStatus[name] = {
        status: 'active',
        ...stats,
      };
    }

    return JSON.stringify(agentStatus, null, 2);
  }

  private async handleDispatchToAgent(input: Record<string, unknown>): Promise<string> {
    const agentName = input.agent as string;
    const taskType = input.task_type as string;
    const payload = input.payload as Record<string, unknown>;
    const priority = (input.priority as number) || 5;

    const agent = this.agents.get(agentName);
    if (!agent) {
      return `Unknown agent: ${agentName}`;
    }

    // Create task in database
    const taskId = await agent.createTask(taskType, payload, { priority });

    return `Task dispatched to ${agentName}. Task ID: ${taskId}`;
  }

  private async handleProcessNewDomains(domains: string[]): Promise<string> {
    const results: Array<{ domain: string; taskId: string }> = [];

    for (const domain of domains) {
      const taskId = await leadResearchAgent.createTask('research_domain', {
        domain,
        source: 'orchestrator_batch',
      });
      results.push({ domain, taskId });
    }

    return JSON.stringify({
      message: `Dispatched ${domains.length} domains for research`,
      tasks: results,
    }, null, 2);
  }

  private async handleRunDailyOperations(): Promise<string> {
    const operations: Array<{ operation: string; result: string }> = [];

    // 1. Score unscored leads
    const unscoredTask = await leadScoringAgent.createTask('score_batch', {
      action: 'score_batch',
      limit: 100,
    });
    operations.push({ operation: 'Score new leads', result: `Task: ${unscoredTask}` });

    // 2. Send pending emails
    const emailTask = await emailAgent.createTask('send_batch', {
      action: 'send_next_batch',
    });
    operations.push({ operation: 'Send pending emails', result: `Task: ${emailTask}` });

    // 3. Send LinkedIn follow-ups
    const linkedinTask = await linkedInAgent.createTask('send_followups', {
      action: 'send_followup_dms',
    });
    operations.push({ operation: 'LinkedIn follow-ups', result: `Task: ${linkedinTask}` });

    // 4. Rescore stale leads
    const rescoreTask = await leadScoringAgent.createTask('rescore', {
      action: 'rescore',
      days: 7,
    });
    operations.push({ operation: 'Rescore stale leads', result: `Task: ${rescoreTask}` });

    return JSON.stringify({
      message: 'Daily operations dispatched',
      operations,
    }, null, 2);
  }

  private async handleGetHotLeads(limit?: number): Promise<string> {
    const result = await query(
      `SELECT
        l.id, l.status, l.total_score,
        c.first_name, c.last_name, c.email,
        co.name as company_name, co.domain
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.total_score >= 70
         AND l.status NOT IN ('closed_won', 'closed_lost')
       ORDER BY l.total_score DESC
       LIMIT $1`,
      [limit || 20]
    );

    return JSON.stringify(result.rows, null, 2);
  }

  private async handleEscalateToHuman(input: Record<string, unknown>): Promise<string> {
    const leadId = input.lead_id as string | undefined;
    const reason = input.reason as string;
    const urgency = (input.urgency as string) || 'medium';

    // Log escalation event
    await this.logEvent('escalation', leadId, undefined, {
      reason,
      urgency,
      timestamp: new Date().toISOString(),
    });

    // In a real system, this would send a notification (Slack, email, etc.)
    console.log(`🚨 ESCALATION [${urgency.toUpperCase()}]: ${reason}`);
    if (leadId) {
      console.log(`   Lead ID: ${leadId}`);
    }

    return JSON.stringify({
      status: 'escalated',
      urgency,
      reason,
      lead_id: leadId,
      message: 'Notification sent to human team',
    }, null, 2);
  }

  private async handleGetPerformanceReport(timePeriod?: string): Promise<string> {
    const interval = timePeriod === 'day' ? '1 day' : timePeriod === 'month' ? '30 days' : '7 days';

    // Lead generation metrics
    const leadMetrics = await query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'closed_won') as conversions,
        AVG(total_score) as avg_lead_score
      FROM leads
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    // Email metrics
    const emailMetrics = await query(`
      SELECT
        COUNT(*) as emails_sent,
        COUNT(*) FILTER (WHERE status = 'opened') as opened,
        COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
        COUNT(*) FILTER (WHERE status = 'replied') as replied
      FROM email_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    // LinkedIn metrics
    const linkedinMetrics = await query(`
      SELECT
        COUNT(*) FILTER (WHERE connection_status = 'connected') as connections_made,
        SUM(messages_sent) as dms_sent,
        SUM(messages_received) as replies_received
      FROM linkedin_campaigns
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    return JSON.stringify({
      period: interval,
      leads: leadMetrics.rows[0],
      email: emailMetrics.rows[0],
      linkedin: linkedinMetrics.rows[0],
    }, null, 2);
  }

  private async handleOptimizeOutreach(): Promise<string> {
    // Analyze email performance by template
    const templatePerformance = await query(`
      SELECT
        template_id,
        COUNT(*) as sent,
        COUNT(*) FILTER (WHERE status = 'opened') as opened,
        COUNT(*) FILTER (WHERE status = 'replied') as replied,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'opened') / NULLIF(COUNT(*), 0), 1
        ) as open_rate,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'replied') / NULLIF(COUNT(*), 0), 1
        ) as reply_rate
      FROM email_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY template_id
      HAVING COUNT(*) >= 10
      ORDER BY reply_rate DESC
    `);

    // Find best performing industries
    const industryPerformance = await query(`
      SELECT
        co.industry,
        COUNT(*) as leads,
        AVG(l.total_score) as avg_score,
        COUNT(*) FILTER (WHERE l.status = 'engaged' OR l.status = 'meeting_booked') as engaged
      FROM leads l
      JOIN companies co ON l.company_id = co.id
      WHERE l.created_at > NOW() - INTERVAL '30 days'
        AND co.industry IS NOT NULL
      GROUP BY co.industry
      HAVING COUNT(*) >= 5
      ORDER BY engaged DESC
    `);

    const recommendations: string[] = [];

    // Generate recommendations based on data
    if (templatePerformance.rows.length > 0) {
      const bestTemplate = templatePerformance.rows[0];
      recommendations.push(
        `Best performing email template: ${bestTemplate.template_id} (${bestTemplate.reply_rate}% reply rate)`
      );
    }

    if (industryPerformance.rows.length > 0) {
      const bestIndustry = industryPerformance.rows[0];
      recommendations.push(
        `Best performing industry: ${bestIndustry.industry} (${bestIndustry.engaged} engaged leads)`
      );
    }

    return JSON.stringify({
      template_performance: templatePerformance.rows,
      industry_performance: industryPerformance.rows,
      recommendations,
    }, null, 2);
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.action === 'daily_run') {
      return `Execute daily operations for the sales system:

Tasks:
1. Get pipeline overview
2. Check agent status
3. Run daily operations (scoring, emails, LinkedIn)
4. Get hot leads that need attention
5. Generate performance report
6. Suggest any optimizations`;
    }

    if (payload.action === 'process_domains') {
      return `Process new Shopify domains for lead generation:

Domains: ${(payload.domains as string[]).join(', ')}

Tasks:
1. Dispatch each domain to Lead Research Agent
2. Track progress
3. Report results`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const orchestratorAgent = new OrchestratorAgent();
