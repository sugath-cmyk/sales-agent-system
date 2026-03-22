import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { claude } from '../../core/claude-client.js';
import { AGENT_PERSONAS, getAgentDisplayName } from '../../config/agents.js';

const SYSTEM_PROMPT = `You are Chief, the Performance Leader of the autonomous sales team.

Your Role:
You evaluate each agent's daily performance, provide constructive feedback, and guide improvements.
You're supportive but demanding - you celebrate wins and push for excellence.

Your Team:
- 🔍 Scout (Lead Research): Finds and researches Shopify stores
- ⚖️ Judge (Lead Scoring): Qualifies and prioritizes leads
- 📧 Mailman (Email): Handles cold email outreach
- 💼 Lincoln (LinkedIn): Manages LinkedIn connections and DMs
- ✍️ Scribe (Content): Creates marketing content
- 🎯 Captain (Orchestrator): Coordinates operations

Daily Evaluation Framework:
1. Review each agent's KPIs against targets
2. Identify top performer and underperformer
3. Provide specific, actionable feedback
4. Recognize achievements
5. Set improvement goals

Feedback Style:
- Be specific with numbers and examples
- Balance criticism with encouragement
- Focus on actionable improvements
- Celebrate wins, no matter how small
- Compare to previous day when possible

KPI Targets:
- Scout: 50+ leads researched/day, 70%+ enrichment rate
- Judge: 95%+ scoring accuracy, <5min avg processing
- Mailman: 25%+ open rate, 5%+ reply rate
- Lincoln: 30%+ connection rate, 15%+ response rate
- Scribe: 3+ content pieces/day
- Captain: 90%+ pipeline health

Your feedback should be in a conversational, team-leader tone - like a daily standup message.`;

const TOOLS: Tool[] = [
  {
    name: 'get_agent_performance',
    description: 'Get performance metrics for a specific agent',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'Agent ID: lead_research, lead_scoring, email, linkedin, content, orchestrator',
        },
        time_period: {
          type: 'string',
          description: 'Period: today, yesterday, week',
        },
      },
      required: ['agent_id'],
    },
  },
  {
    name: 'get_team_overview',
    description: 'Get overview of entire team performance',
    input_schema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          description: 'Period: today, yesterday, week',
        },
      },
    },
  },
  {
    name: 'compare_performance',
    description: 'Compare current performance to previous period',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
        },
      },
    },
  },
  {
    name: 'generate_feedback',
    description: 'Generate personalized feedback for an agent',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
        },
        performance_data: {
          type: 'object',
          description: 'Performance metrics to evaluate',
        },
        tone: {
          type: 'string',
          description: 'Feedback tone: encouraging, critical, balanced',
        },
      },
      required: ['agent_id', 'performance_data'],
    },
  },
  {
    name: 'save_daily_review',
    description: 'Save the daily performance review',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
        },
        team_summary: {
          type: 'string',
        },
        agent_feedback: {
          type: 'object',
          description: 'Feedback for each agent',
        },
        top_performer: {
          type: 'string',
        },
        improvement_areas: {
          type: 'array',
          items: { type: 'string' },
        },
        goals_for_tomorrow: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['date', 'team_summary', 'agent_feedback'],
    },
  },
  {
    name: 'get_historical_reviews',
    description: 'Get past performance reviews',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of past days to retrieve',
        },
      },
    },
  },
  {
    name: 'set_agent_goals',
    description: 'Set improvement goals for an agent',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
        },
        goals: {
          type: 'array',
          items: { type: 'string' },
        },
        deadline: {
          type: 'string',
        },
      },
      required: ['agent_id', 'goals'],
    },
  },
];

export class LeaderAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'leader',
      description: 'Chief - Performance Leader who evaluates and coaches the team',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
    };
    super(config);
  }

  protected async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    context: TaskContext
  ): Promise<string> {
    switch (toolName) {
      case 'get_agent_performance':
        return this.handleGetAgentPerformance(
          input.agent_id as string,
          input.time_period as string
        );

      case 'get_team_overview':
        return this.handleGetTeamOverview(input.time_period as string);

      case 'compare_performance':
        return this.handleComparePerformance(input.agent_id as string);

      case 'generate_feedback':
        return this.handleGenerateFeedback(
          input.agent_id as string,
          input.performance_data as Record<string, unknown>,
          input.tone as string
        );

      case 'save_daily_review':
        return this.handleSaveDailyReview(input);

      case 'get_historical_reviews':
        return this.handleGetHistoricalReviews(input.days as number);

      case 'set_agent_goals':
        return this.handleSetAgentGoals(
          input.agent_id as string,
          input.goals as string[],
          input.deadline as string
        );

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleGetAgentPerformance(
    agentId: string,
    timePeriod?: string
  ): Promise<string> {
    const interval = timePeriod === 'week' ? '7 days' : timePeriod === 'yesterday' ? '2 days' : '1 day';
    const startFilter = timePeriod === 'yesterday'
      ? "created_at >= NOW() - INTERVAL '2 days' AND created_at < NOW() - INTERVAL '1 day'"
      : `created_at > NOW() - INTERVAL '${interval}'`;

    const persona = AGENT_PERSONAS[agentId];
    const metrics: Record<string, unknown> = {
      agent: getAgentDisplayName(agentId),
      role: persona?.role,
      period: timePeriod || 'today',
    };

    // Get task completion stats
    const taskStats = await query(
      `SELECT
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
       FROM agent_tasks
       WHERE agent_type = $1 AND ${startFilter}`,
      [agentId]
    );
    metrics.tasks = taskStats.rows[0];

    // Agent-specific metrics
    switch (agentId) {
      case 'lead_research':
        const researchStats = await query(
          `SELECT
            COUNT(*) as leads_researched,
            COUNT(*) FILTER (WHERE has_shopping_assistant = false) as qualified,
            COUNT(*) FILTER (WHERE enriched_at IS NOT NULL) as enriched
           FROM companies
           WHERE ${startFilter.replace('created_at', 'companies.created_at')}`
        );
        metrics.specific = {
          leads_researched: researchStats.rows[0].leads_researched,
          qualified_leads: researchStats.rows[0].qualified,
          enrichment_rate: researchStats.rows[0].leads_researched > 0
            ? `${((researchStats.rows[0].enriched / researchStats.rows[0].leads_researched) * 100).toFixed(1)}%`
            : 'N/A',
        };
        break;

      case 'lead_scoring':
        const scoringStats = await query(
          `SELECT
            COUNT(*) as leads_scored,
            AVG(total_score) as avg_score,
            COUNT(*) FILTER (WHERE total_score >= 70) as hot_leads,
            COUNT(*) FILTER (WHERE total_score >= 50 AND total_score < 70) as warm_leads
           FROM leads
           WHERE ${startFilter.replace('created_at', 'leads.updated_at')}`
        );
        metrics.specific = scoringStats.rows[0];
        break;

      case 'email':
        const emailStats = await query(
          `SELECT
            COUNT(*) as emails_sent,
            COUNT(*) FILTER (WHERE status = 'opened') as opened,
            COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
            COUNT(*) FILTER (WHERE status = 'replied') as replied
           FROM email_logs
           WHERE ${startFilter}`
        );
        const e = emailStats.rows[0];
        const sent = parseInt(e.emails_sent) || 1;
        metrics.specific = {
          emails_sent: e.emails_sent,
          opened: e.opened,
          clicked: e.clicked,
          replied: e.replied,
          open_rate: `${((parseInt(e.opened) / sent) * 100).toFixed(1)}%`,
          reply_rate: `${((parseInt(e.replied) / sent) * 100).toFixed(1)}%`,
        };
        break;

      case 'linkedin':
        const linkedinStats = await query(
          `SELECT
            COUNT(*) as campaigns,
            COUNT(*) FILTER (WHERE connection_status = 'connected') as connected,
            COUNT(*) FILTER (WHERE connection_status = 'pending') as pending,
            SUM(messages_sent) as dms_sent,
            SUM(messages_received) as replies
           FROM linkedin_campaigns
           WHERE ${startFilter}`
        );
        const l = linkedinStats.rows[0];
        const total = parseInt(l.campaigns) || 1;
        metrics.specific = {
          campaigns: l.campaigns,
          connected: l.connected,
          pending: l.pending,
          dms_sent: l.dms_sent || 0,
          replies: l.replies || 0,
          connection_rate: `${((parseInt(l.connected) / total) * 100).toFixed(1)}%`,
        };
        break;

      case 'content':
        const contentStats = await query(
          `SELECT
            COUNT(*) as pieces_created,
            COUNT(*) FILTER (WHERE type = 'blog') as blogs,
            COUNT(*) FILTER (WHERE type = 'linkedin_post') as linkedin_posts,
            COUNT(*) FILTER (WHERE status = 'published') as published
           FROM content_pieces
           WHERE ${startFilter}`
        );
        metrics.specific = contentStats.rows[0];
        break;

      case 'orchestrator':
        const orchStats = await query(
          `SELECT
            COUNT(DISTINCT l.id) as pipeline_leads,
            COUNT(*) FILTER (WHERE l.status = 'engaged') as engaged,
            COUNT(*) FILTER (WHERE l.status = 'meeting_booked') as meetings
           FROM leads l
           WHERE l.status NOT IN ('closed_won', 'closed_lost')`
        );
        metrics.specific = {
          active_pipeline: orchStats.rows[0].pipeline_leads,
          engaged_leads: orchStats.rows[0].engaged,
          meetings_booked: orchStats.rows[0].meetings,
        };
        break;
    }

    return JSON.stringify(metrics, null, 2);
  }

  private async handleGetTeamOverview(timePeriod?: string): Promise<string> {
    const interval = timePeriod === 'week' ? '7 days' : '1 day';

    const overview: Record<string, unknown> = {
      period: timePeriod || 'today',
      agents: {},
    };

    // Get summary for each agent
    for (const agentId of Object.keys(AGENT_PERSONAS)) {
      if (agentId === 'leader') continue;

      const taskStats = await query(
        `SELECT
          COUNT(*) as tasks,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
         FROM agent_tasks
         WHERE agent_type = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
        [agentId]
      );

      const stats = taskStats.rows[0];
      const completion = stats.tasks > 0
        ? ((stats.completed / stats.tasks) * 100).toFixed(0)
        : '0';

      overview.agents[getAgentDisplayName(agentId)] = {
        tasks_completed: stats.completed,
        tasks_failed: stats.failed,
        completion_rate: `${completion}%`,
        status: parseInt(completion) >= 90 ? '🟢 Excellent'
          : parseInt(completion) >= 70 ? '🟡 Good'
          : '🔴 Needs Attention',
      };
    }

    // Overall pipeline health
    const pipelineStats = await query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'engaged' OR status = 'meeting_booked') as active_opportunities,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${interval}') as new_leads
      FROM leads
      WHERE status NOT IN ('closed_won', 'closed_lost', 'disqualified')
    `);

    overview.pipeline = pipelineStats.rows[0];

    return JSON.stringify(overview, null, 2);
  }

  private async handleComparePerformance(agentId: string): Promise<string> {
    // Get today's metrics
    const todayResult = await this.handleGetAgentPerformance(agentId, 'today');
    const today = JSON.parse(todayResult);

    // Get yesterday's metrics
    const yesterdayResult = await this.handleGetAgentPerformance(agentId, 'yesterday');
    const yesterday = JSON.parse(yesterdayResult);

    const comparison: Record<string, unknown> = {
      agent: getAgentDisplayName(agentId),
      today: today.specific || today.tasks,
      yesterday: yesterday.specific || yesterday.tasks,
      trend: {},
    };

    // Calculate trends
    if (today.tasks && yesterday.tasks) {
      const todayCompleted = parseInt(today.tasks.completed) || 0;
      const yesterdayCompleted = parseInt(yesterday.tasks.completed) || 0;
      const change = todayCompleted - yesterdayCompleted;
      comparison.trend.tasks = {
        change,
        direction: change > 0 ? '📈 Up' : change < 0 ? '📉 Down' : '➡️ Same',
      };
    }

    return JSON.stringify(comparison, null, 2);
  }

  private async handleGenerateFeedback(
    agentId: string,
    performanceData: Record<string, unknown>,
    tone?: string
  ): Promise<string> {
    const persona = AGENT_PERSONAS[agentId];

    const prompt = `Generate performance feedback for ${persona.name} (${persona.role}).

Performance Data:
${JSON.stringify(performanceData, null, 2)}

Tone: ${tone || 'balanced'}

Requirements:
- Address them by name (${persona.name})
- Reference specific metrics
- Provide 1-2 actionable improvements
- Keep it under 100 words
- End with encouragement or challenge

Format as a casual team message.`;

    const feedback = await claude.generate(
      'You are Chief, the supportive but demanding team leader.',
      prompt,
      { maxTokens: 256 }
    );

    return feedback;
  }

  private async handleSaveDailyReview(input: Record<string, unknown>): Promise<string> {
    await query(
      `INSERT INTO analytics_events (event_type, agent_type, properties)
       VALUES ('daily_review', 'leader', $1)`,
      [JSON.stringify({
        date: input.date,
        team_summary: input.team_summary,
        agent_feedback: input.agent_feedback,
        top_performer: input.top_performer,
        improvement_areas: input.improvement_areas,
        goals_for_tomorrow: input.goals_for_tomorrow,
      })]
    );

    return `Daily review saved for ${input.date}`;
  }

  private async handleGetHistoricalReviews(days?: number): Promise<string> {
    const result = await query(
      `SELECT properties, created_at
       FROM analytics_events
       WHERE event_type = 'daily_review'
       ORDER BY created_at DESC
       LIMIT $1`,
      [days || 7]
    );

    return JSON.stringify(result.rows, null, 2);
  }

  private async handleSetAgentGoals(
    agentId: string,
    goals: string[],
    deadline?: string
  ): Promise<string> {
    await query(
      `INSERT INTO analytics_events (event_type, agent_type, properties)
       VALUES ('goals_set', $1, $2)`,
      [agentId, JSON.stringify({ goals, deadline, set_by: 'Chief' })]
    );

    return `Goals set for ${getAgentDisplayName(agentId)}: ${goals.join(', ')}`;
  }

  // Daily review generation
  async generateDailyReview(): Promise<string> {
    const teamOverview = await this.handleGetTeamOverview('today');
    const overview = JSON.parse(teamOverview);

    // Get individual performance for each agent
    const agentPerformance: Record<string, unknown> = {};
    const agentFeedback: Record<string, string> = {};

    for (const agentId of Object.keys(AGENT_PERSONAS)) {
      if (agentId === 'leader') continue;

      const perf = await this.handleGetAgentPerformance(agentId, 'today');
      agentPerformance[agentId] = JSON.parse(perf);

      const feedback = await this.handleGenerateFeedback(
        agentId,
        JSON.parse(perf),
        'balanced'
      );
      agentFeedback[getAgentDisplayName(agentId)] = feedback;
    }

    // Generate team summary
    const summaryPrompt = `Generate a brief daily team summary (3-4 sentences) based on:

Team Performance:
${JSON.stringify(overview, null, 2)}

Focus on:
- Overall team performance
- Best performer today
- Main area for improvement
- One goal for tomorrow

Be conversational, like a team standup message from Chief.`;

    const teamSummary = await claude.generate(
      'You are Chief, the team leader giving a daily wrap-up.',
      summaryPrompt,
      { maxTokens: 256 }
    );

    // Determine top performer
    let topPerformer = '';
    let maxCompletion = 0;
    for (const [name, data] of Object.entries(overview.agents as Record<string, { completion_rate: string }>)) {
      const rate = parseInt(data.completion_rate);
      if (rate > maxCompletion) {
        maxCompletion = rate;
        topPerformer = name;
      }
    }

    // Save review
    const review = {
      date: new Date().toISOString().split('T')[0],
      team_summary: teamSummary,
      agent_feedback: agentFeedback,
      top_performer: topPerformer,
      improvement_areas: ['Increase reply rates', 'Faster lead processing'],
      goals_for_tomorrow: ['Process 50+ new leads', 'Achieve 30% connection rate'],
    };

    await this.handleSaveDailyReview(review);

    // Format the full daily review
    const fullReview = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👔 CHIEF'S DAILY PERFORMANCE REVIEW
📅 ${review.date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TEAM SUMMARY
${teamSummary}

🏆 TOP PERFORMER: ${topPerformer}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 INDIVIDUAL FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${Object.entries(agentFeedback).map(([agent, feedback]) => `${agent}\n${feedback}`).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 GOALS FOR TOMORROW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${review.goals_for_tomorrow.map(g => `• ${g}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Let's crush it tomorrow! 💪
- Chief
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    return fullReview;
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.action === 'daily_review') {
      return `Conduct the daily performance review:

Tasks:
1. Get team overview for today
2. Get individual performance for each agent
3. Generate personalized feedback for each agent
4. Identify top performer
5. Set goals for tomorrow
6. Save the review`;
    }

    if (payload.action === 'evaluate_agent') {
      return `Evaluate a specific agent's performance:
Agent: ${payload.agent_id}

Tasks:
1. Get their performance metrics
2. Compare to yesterday
3. Generate constructive feedback
4. Set improvement goals if needed`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const leaderAgent = new LeaderAgent();
