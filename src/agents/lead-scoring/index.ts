import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { icpConfig } from '../../config/index.js';

const SYSTEM_PROMPT = `You are a Lead Scoring Agent specialized in qualifying D2C e-commerce leads.

Your primary goals:
1. Score leads based on ICP (Ideal Customer Profile) fit
2. Identify intent signals from engagement data
3. Prioritize leads for outreach
4. Flag disqualified leads

Scoring Framework:
- ICP Score (0-50 points):
  - Platform match (Shopify/WooCommerce): 15 points
  - No existing shopping assistant: 20 points
  - Traffic in range (10K-500K): 15 points

- Intent Score (0-30 points):
  - Email opened: 5 points
  - Link clicked: 10 points
  - Website visit: 10 points
  - Replied: 5 points

- Timing Score (0-20 points):
  - Recent funding: 10 points
  - Currently hiring: 5 points
  - New store (<1 year): 5 points

Qualification Thresholds:
- HOT (70+): Immediate priority outreach
- WARM (50-69): Standard nurture sequence
- COLD (30-49): Long-term drip
- DISQUALIFY (<30): Remove from active pipeline

Always provide clear reasoning for your scoring decisions.`;

const TOOLS: Tool[] = [
  {
    name: 'get_lead_data',
    description: 'Retrieve complete lead data including company and contact info',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'The lead ID to retrieve',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'get_engagement_data',
    description: 'Get engagement metrics for a lead (email opens, clicks, replies)',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'The lead ID to check engagement for',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'calculate_icp_score',
    description: 'Calculate ICP fit score based on company attributes',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'E-commerce platform (shopify, woocommerce, etc.)',
        },
        has_shopping_assistant: {
          type: 'boolean',
          description: 'Whether store has existing shopping assistant',
        },
        monthly_traffic: {
          type: 'number',
          description: 'Estimated monthly traffic',
        },
        region: {
          type: 'string',
          description: 'Geographic region (US, UK, AU, IN)',
        },
      },
      required: ['platform', 'has_shopping_assistant'],
    },
  },
  {
    name: 'update_lead_score',
    description: 'Update the lead score in database',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'The lead ID to update',
        },
        icp_score: {
          type: 'number',
          description: 'ICP fit score (0-50)',
        },
        intent_score: {
          type: 'number',
          description: 'Intent/engagement score (0-50)',
        },
        score_breakdown: {
          type: 'object',
          description: 'Detailed breakdown of scoring factors',
        },
      },
      required: ['lead_id', 'icp_score', 'intent_score'],
    },
  },
  {
    name: 'update_lead_status',
    description: 'Update lead pipeline status based on score',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'The lead ID to update',
        },
        status: {
          type: 'string',
          description: 'New status (new, researched, qualified, disqualified)',
        },
        reason: {
          type: 'string',
          description: 'Reason for status change',
        },
      },
      required: ['lead_id', 'status'],
    },
  },
  {
    name: 'get_unscored_leads',
    description: 'Get list of leads that need scoring',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of leads to return',
        },
      },
    },
  },
  {
    name: 'get_leads_for_rescore',
    description: 'Get leads that should be rescored (e.g., new engagement)',
    input_schema: {
      type: 'object',
      properties: {
        days_since_last_score: {
          type: 'number',
          description: 'Leads not scored in this many days',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of leads to return',
        },
      },
    },
  },
];

export class LeadScoringAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'lead_scoring',
      description: 'Scores and qualifies leads based on ICP fit and intent signals',
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
      case 'get_lead_data':
        return this.handleGetLeadData(input.lead_id as string);

      case 'get_engagement_data':
        return this.handleGetEngagementData(input.lead_id as string);

      case 'calculate_icp_score':
        return this.handleCalculateICPScore(input);

      case 'update_lead_score':
        return this.handleUpdateLeadScore(input);

      case 'update_lead_status':
        return this.handleUpdateLeadStatus(input);

      case 'get_unscored_leads':
        return this.handleGetUnscoredLeads(input.limit as number | undefined);

      case 'get_leads_for_rescore':
        return this.handleGetLeadsForRescore(
          input.days_since_last_score as number,
          input.limit as number | undefined
        );

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleGetLeadData(leadId: string): Promise<string> {
    const result = await query(
      `SELECT
        l.id, l.status, l.icp_score, l.intent_score, l.score_breakdown,
        c.first_name, c.last_name, c.email, c.title,
        co.name as company_name, co.domain, co.platform, co.industry,
        co.has_shopping_assistant, co.detected_assistants, co.monthly_traffic,
        co.region, co.employee_count, co.tech_stack
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (result.rows.length === 0) {
      return `Lead not found: ${leadId}`;
    }

    return JSON.stringify(result.rows[0], null, 2);
  }

  private async handleGetEngagementData(leadId: string): Promise<string> {
    // Get email engagement
    const emailResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as emails_sent,
        COUNT(*) FILTER (WHERE status = 'opened') as emails_opened,
        COUNT(*) FILTER (WHERE status = 'clicked') as emails_clicked,
        COUNT(*) FILTER (WHERE status = 'replied') as emails_replied
       FROM email_logs
       WHERE lead_id = $1`,
      [leadId]
    );

    // Get LinkedIn engagement
    const linkedinResult = await query(
      `SELECT
        connection_status,
        messages_sent,
        messages_received
       FROM linkedin_campaigns
       WHERE lead_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [leadId]
    );

    // Get conversation history
    const conversationsResult = await query(
      `SELECT channel, outcome, sentiment
       FROM conversations
       WHERE lead_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [leadId]
    );

    return JSON.stringify(
      {
        email: emailResult.rows[0] || {},
        linkedin: linkedinResult.rows[0] || {},
        conversations: conversationsResult.rows,
      },
      null,
      2
    );
  }

  private handleCalculateICPScore(input: Record<string, unknown>): string {
    let score = 0;
    const breakdown: Record<string, number> = {};

    // Platform match
    const platform = (input.platform as string)?.toLowerCase();
    if (icpConfig.targetPlatforms.includes(platform as 'shopify' | 'woocommerce')) {
      breakdown.platformMatch = icpConfig.weights.platformMatch;
      score += icpConfig.weights.platformMatch;
    } else {
      breakdown.platformMatch = 0;
    }

    // No shopping assistant (this is what we want)
    if (input.has_shopping_assistant === false) {
      breakdown.noAssistant = icpConfig.weights.noAssistant;
      score += icpConfig.weights.noAssistant;
    } else {
      breakdown.noAssistant = 0;
    }

    // Traffic range
    const traffic = input.monthly_traffic as number;
    if (traffic && traffic >= icpConfig.trafficRange.min && traffic <= icpConfig.trafficRange.max) {
      breakdown.trafficRange = icpConfig.weights.trafficRange;
      score += icpConfig.weights.trafficRange;
    } else if (traffic && traffic > 0) {
      // Partial credit for having some traffic data
      breakdown.trafficRange = Math.floor(icpConfig.weights.trafficRange / 2);
      score += breakdown.trafficRange;
    } else {
      breakdown.trafficRange = 0;
    }

    // Region match
    const region = input.region as string;
    if (region && icpConfig.targetRegions.includes(region)) {
      breakdown.regionMatch = icpConfig.weights.regionMatch;
      score += icpConfig.weights.regionMatch;
    } else {
      breakdown.regionMatch = 0;
    }

    return JSON.stringify({ score, breakdown }, null, 2);
  }

  private async handleUpdateLeadScore(input: Record<string, unknown>): Promise<string> {
    const leadId = input.lead_id as string;
    const icpScore = input.icp_score as number;
    const intentScore = input.intent_score as number;
    const scoreBreakdown = input.score_breakdown || {};

    await query(
      `UPDATE leads
       SET icp_score = $2, intent_score = $3, score_breakdown = $4, updated_at = NOW()
       WHERE id = $1`,
      [leadId, icpScore, intentScore, JSON.stringify(scoreBreakdown)]
    );

    const totalScore = icpScore + intentScore;

    // Log the scoring event
    await this.logEvent('lead_scored', leadId, undefined, {
      icp_score: icpScore,
      intent_score: intentScore,
      total_score: totalScore,
      breakdown: scoreBreakdown,
    });

    // Determine qualification tier
    let tier = 'COLD';
    if (totalScore >= icpConfig.thresholds.HOT) {
      tier = 'HOT';
    } else if (totalScore >= icpConfig.thresholds.WARM) {
      tier = 'WARM';
    } else if (totalScore < icpConfig.thresholds.COLD) {
      tier = 'DISQUALIFY';
    }

    return `Lead ${leadId} scored: ICP=${icpScore}, Intent=${intentScore}, Total=${totalScore}, Tier=${tier}`;
  }

  private async handleUpdateLeadStatus(input: Record<string, unknown>): Promise<string> {
    const leadId = input.lead_id as string;
    const status = input.status as string;
    const reason = input.reason as string | undefined;

    await query(
      `UPDATE leads SET status = $2, stage_changed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [leadId, status]
    );

    await this.logEvent('lead_status_changed', leadId, undefined, {
      new_status: status,
      reason,
    });

    return `Lead ${leadId} status updated to: ${status}`;
  }

  private async handleGetUnscoredLeads(limit?: number): Promise<string> {
    const result = await query(
      `SELECT l.id, co.domain, co.name as company_name
       FROM leads l
       JOIN companies co ON l.company_id = co.id
       WHERE l.icp_score = 0 AND l.status = 'new'
       ORDER BY l.created_at ASC
       LIMIT $1`,
      [limit || 50]
    );

    return JSON.stringify(result.rows, null, 2);
  }

  private async handleGetLeadsForRescore(
    daysSinceLastScore: number,
    limit?: number
  ): Promise<string> {
    const result = await query(
      `SELECT l.id, co.domain, co.name as company_name, l.icp_score, l.intent_score
       FROM leads l
       JOIN companies co ON l.company_id = co.id
       WHERE l.updated_at < NOW() - INTERVAL '${daysSinceLastScore} days'
         AND l.status NOT IN ('closed_won', 'closed_lost', 'disqualified')
       ORDER BY l.total_score DESC
       LIMIT $1`,
      [limit || 50]
    );

    return JSON.stringify(result.rows, null, 2);
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.lead_id) {
      return `Score the following lead:
Lead ID: ${payload.lead_id}

Tasks:
1. Get the lead data and company information
2. Calculate ICP score based on platform, assistant status, traffic, region
3. Get engagement data to calculate intent score
4. Update the lead score in database
5. Update lead status if needed (qualify/disqualify)`;
    }

    if (payload.action === 'score_batch') {
      return `Score a batch of unscored leads:

Tasks:
1. Get list of unscored leads (limit: ${payload.limit || 50})
2. For each lead, calculate ICP and intent scores
3. Update scores in database
4. Provide summary of scoring results`;
    }

    if (payload.action === 'rescore') {
      return `Rescore leads that haven't been updated recently:

Tasks:
1. Get leads that need rescoring (not updated in ${payload.days || 7} days)
2. Recalculate scores based on latest engagement data
3. Update scores and statuses as needed`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const leadScoringAgent = new LeadScoringAgent();
