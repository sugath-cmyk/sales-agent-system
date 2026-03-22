import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { bookingConfig } from '../../config/index.js';

const SYSTEM_PROMPT = `You are a LinkedIn Outreach Agent specialized in connecting with Shopify store owners and e-commerce decision makers.

Your primary goals:
1. Send personalized connection requests that get accepted
2. Follow up with value-first DM sequences
3. Build genuine relationships before pitching
4. Book discovery calls with qualified prospects

LinkedIn Best Practices:
- Connection requests: Max 100/week to avoid restrictions
- Keep connection notes under 300 characters
- Wait 24-48 hours after connection before first DM
- Space DMs 3-4 days apart
- Never be salesy in the first message
- Lead with value, not your product

Connection Request Framework:
"Hi {firstName}, noticed {companyName} is doing great things in {industry}.
Love what you're building. Would love to connect and share insights on how
D2C brands are using AI to boost conversions."

DM Sequence (After Connection):
1. Day 1: Thank + value question (no pitch)
2. Day 4: Share relevant case study/insight
3. Day 8: Soft ask for a call

Target Personas for Shopify Stores:
- Founder/CEO
- E-commerce Manager
- Marketing Director
- Head of Digital
- Growth Lead

Always maintain a professional, peer-to-peer tone. Never sound desperate or salesy.`;

const TOOLS: Tool[] = [
  {
    name: 'get_lead_linkedin',
    description: 'Get LinkedIn profile info for a lead',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead ID to get LinkedIn info for',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'compose_connection_request',
    description: 'Compose a personalized LinkedIn connection request',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead to compose request for',
        },
        personalization_notes: {
          type: 'string',
          description: 'Additional personalization context',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'send_connection_request',
    description: 'Send a LinkedIn connection request',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
        },
        linkedin_url: {
          type: 'string',
          description: 'LinkedIn profile URL',
        },
        message: {
          type: 'string',
          description: 'Connection request note (max 300 chars)',
        },
      },
      required: ['lead_id', 'linkedin_url', 'message'],
    },
  },
  {
    name: 'compose_dm',
    description: 'Compose a LinkedIn DM',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
        },
        dm_type: {
          type: 'string',
          description: 'Type: value_first, case_study, soft_ask, follow_up, reply',
        },
        context: {
          type: 'string',
          description: 'Additional context for personalization',
        },
      },
      required: ['lead_id', 'dm_type'],
    },
  },
  {
    name: 'send_dm',
    description: 'Send a LinkedIn direct message',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
      },
      required: ['campaign_id', 'message'],
    },
  },
  {
    name: 'start_linkedin_campaign',
    description: 'Start a LinkedIn outreach campaign for a lead',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'get_pending_linkedin_actions',
    description: 'Get LinkedIn actions that need to be taken',
    input_schema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          description: 'Filter by type: connection_request, dm, follow_up',
        },
        limit: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'process_linkedin_reply',
    description: 'Process a reply received on LinkedIn',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
        },
        reply_content: {
          type: 'string',
        },
      },
      required: ['campaign_id', 'reply_content'],
    },
  },
  {
    name: 'update_connection_status',
    description: 'Update LinkedIn connection status',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
        },
        status: {
          type: 'string',
          description: 'Status: pending, connected, declined',
        },
      },
      required: ['campaign_id', 'status'],
    },
  },
  {
    name: 'get_linkedin_stats',
    description: 'Get LinkedIn outreach statistics',
    input_schema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          description: 'Period: day, week, month',
        },
      },
    },
  },
];

export class LinkedInAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'linkedin_agent',
      description: 'Handles LinkedIn outreach and relationship building',
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
      case 'get_lead_linkedin':
        return this.handleGetLeadLinkedIn(input.lead_id as string);

      case 'compose_connection_request':
        return this.handleComposeConnectionRequest(
          input.lead_id as string,
          input.personalization_notes as string | undefined
        );

      case 'send_connection_request':
        return this.handleSendConnectionRequest(input);

      case 'compose_dm':
        return this.handleComposeDM(
          input.lead_id as string,
          input.dm_type as string,
          input.context as string | undefined
        );

      case 'send_dm':
        return this.handleSendDM(input.campaign_id as string, input.message as string);

      case 'start_linkedin_campaign':
        return this.handleStartCampaign(input.lead_id as string);

      case 'get_pending_linkedin_actions':
        return this.handleGetPendingActions(
          input.action_type as string | undefined,
          input.limit as number | undefined
        );

      case 'process_linkedin_reply':
        return this.handleProcessReply(
          input.campaign_id as string,
          input.reply_content as string
        );

      case 'update_connection_status':
        return this.handleUpdateConnectionStatus(
          input.campaign_id as string,
          input.status as string
        );

      case 'get_linkedin_stats':
        return this.handleGetStats(input.time_period as string | undefined);

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleGetLeadLinkedIn(leadId: string): Promise<string> {
    const result = await query(
      `SELECT
        l.id, l.status, l.total_score,
        c.first_name, c.last_name, c.title, c.linkedin_url,
        co.name as company_name, co.domain, co.industry, co.platform
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (result.rows.length === 0) {
      return `Lead not found: ${leadId}`;
    }

    const lead = result.rows[0];
    if (!lead.linkedin_url) {
      return `Lead ${leadId} has no LinkedIn URL`;
    }

    return JSON.stringify(lead, null, 2);
  }

  private async handleComposeConnectionRequest(
    leadId: string,
    notes?: string
  ): Promise<string> {
    const leadResult = await query(
      `SELECT
        c.first_name, c.title,
        co.name as company_name, co.industry
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0) {
      return `Lead not found: ${leadId}`;
    }

    const lead = leadResult.rows[0];
    const firstName = lead.first_name || 'there';
    const companyName = lead.company_name || 'your company';
    const industry = lead.industry || 'e-commerce';

    // Keep under 300 characters
    const message = `Hi ${firstName}, noticed ${companyName} is crushing it in ${industry}. Love what you're building — would love to connect and share insights on how D2C brands are using AI to boost conversions.`;

    return JSON.stringify({
      message: message.slice(0, 300),
      character_count: message.length,
      personalization_used: {
        first_name: firstName,
        company_name: companyName,
        industry: industry,
        additional_notes: notes,
      },
    }, null, 2);
  }

  private async handleSendConnectionRequest(input: Record<string, unknown>): Promise<string> {
    const leadId = input.lead_id as string;
    const linkedinUrl = input.linkedin_url as string;
    const message = input.message as string;

    // Create LinkedIn campaign
    const campaignResult = await query<{ id: string }>(
      `INSERT INTO linkedin_campaigns (lead_id, connection_status, connection_sent_at)
       VALUES ($1, 'pending', NOW())
       RETURNING id`,
      [leadId]
    );

    const campaignId = campaignResult.rows[0].id;

    // Log the connection request
    await query(
      `INSERT INTO linkedin_messages (campaign_id, direction, message_type, content, status, sent_at)
       VALUES ($1, 'outbound', 'connection_request', $2, 'sent', NOW())`,
      [campaignId, message]
    );

    // Update lead status
    await query(
      `UPDATE leads SET status = 'contacted', assigned_agent = 'linkedin_agent' WHERE id = $1`,
      [leadId]
    );

    await this.logEvent('linkedin_connection_sent', leadId, campaignId, {
      linkedin_url: linkedinUrl,
    });

    // Note: Actual LinkedIn automation would be handled by external tool (Phantombuster, etc.)
    return JSON.stringify({
      campaign_id: campaignId,
      status: 'connection_request_queued',
      message: 'Connection request logged. Execute via LinkedIn automation tool.',
      linkedin_url: linkedinUrl,
      request_message: message,
    }, null, 2);
  }

  private async handleComposeDM(
    leadId: string,
    dmType: string,
    context?: string
  ): Promise<string> {
    const leadResult = await query(
      `SELECT
        c.first_name,
        co.name as company_name
       FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0) {
      return `Lead not found: ${leadId}`;
    }

    const lead = leadResult.rows[0];
    const firstName = lead.first_name || 'there';
    const companyName = lead.company_name || 'your company';
    const calendarLink = bookingConfig.calendlyUrl;

    const templates: Record<string, string> = {
      value_first: `Thanks for connecting, ${firstName}!

Quick question — are you seeing a lot of visitors browse ${companyName}'s store but not buy?

We helped a similar Shopify brand increase their conversion rate by 34% with an AI shopping assistant.

Happy to share the playbook if useful.`,

      case_study: `Hey ${firstName},

Just published a case study on how a Shopify brand in your space reduced cart abandonment by 28%.

Thought of you given ${companyName}'s growth.

Want me to send it over?`,

      soft_ask: `${firstName} — would a 30-min call make sense to explore if this could work for ${companyName}?

No pitch, just want to understand your current conversion challenges.

Here's my calendar: ${calendarLink}`,

      follow_up: `Hey ${firstName}, just circling back.

I know you're busy running ${companyName}, but wanted to make sure this didn't slip through.

Quick 30-min chat? ${calendarLink}`,
    };

    const message = templates[dmType] || templates.value_first;

    return JSON.stringify({
      dm_type: dmType,
      message,
      calendar_link: calendarLink,
      context_used: context,
    }, null, 2);
  }

  private async handleSendDM(campaignId: string, message: string): Promise<string> {
    // Get campaign info
    const campaignResult = await query<{ lead_id: string; connection_status: string }>(
      `SELECT lead_id, connection_status FROM linkedin_campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return `Campaign not found: ${campaignId}`;
    }

    const campaign = campaignResult.rows[0];

    if (campaign.connection_status !== 'connected') {
      return `Cannot send DM - not connected yet. Status: ${campaign.connection_status}`;
    }

    // Log the DM
    await query(
      `INSERT INTO linkedin_messages (campaign_id, direction, message_type, content, status, sent_at)
       VALUES ($1, 'outbound', 'dm', $2, 'sent', NOW())`,
      [campaignId, message]
    );

    // Update campaign
    await query(
      `UPDATE linkedin_campaigns
       SET messages_sent = messages_sent + 1,
           last_message_sent_at = NOW(),
           dm_sequence_step = dm_sequence_step + 1
       WHERE id = $1`,
      [campaignId]
    );

    await this.logEvent('linkedin_dm_sent', campaign.lead_id, campaignId);

    return JSON.stringify({
      status: 'dm_queued',
      message: 'DM logged. Execute via LinkedIn automation tool.',
      campaign_id: campaignId,
    }, null, 2);
  }

  private async handleStartCampaign(leadId: string): Promise<string> {
    // Check if campaign already exists
    const existingResult = await query(
      `SELECT id FROM linkedin_campaigns WHERE lead_id = $1 AND connection_status != 'declined'`,
      [leadId]
    );

    if (existingResult.rows.length > 0) {
      return `LinkedIn campaign already exists for lead ${leadId}`;
    }

    // Get lead's LinkedIn URL
    const leadResult = await query<{ linkedin_url: string }>(
      `SELECT c.linkedin_url FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0 || !leadResult.rows[0].linkedin_url) {
      return `Lead ${leadId} has no LinkedIn URL`;
    }

    // Compose and "send" connection request
    const composeResult = await this.handleComposeConnectionRequest(leadId);
    const composed = JSON.parse(composeResult);

    return this.handleSendConnectionRequest({
      lead_id: leadId,
      linkedin_url: leadResult.rows[0].linkedin_url,
      message: composed.message,
    });
  }

  private async handleGetPendingActions(
    actionType?: string,
    limit?: number
  ): Promise<string> {
    let queryText = `
      SELECT
        lc.id as campaign_id,
        lc.lead_id,
        lc.connection_status,
        lc.dm_sequence_step,
        lc.last_message_sent_at,
        c.first_name,
        c.linkedin_url,
        co.name as company_name
      FROM linkedin_campaigns lc
      JOIN leads l ON lc.lead_id = l.id
      JOIN contacts c ON l.contact_id = c.id
      JOIN companies co ON l.company_id = co.id
      WHERE 1=1`;

    if (actionType === 'connection_request') {
      queryText += ` AND lc.connection_status = 'not_connected'`;
    } else if (actionType === 'dm') {
      queryText += ` AND lc.connection_status = 'connected'
                     AND lc.dm_sequence_step < 3
                     AND (lc.last_message_sent_at IS NULL
                          OR lc.last_message_sent_at < NOW() - INTERVAL '3 days')`;
    } else if (actionType === 'follow_up') {
      queryText += ` AND lc.connection_status = 'pending'
                     AND lc.connection_sent_at < NOW() - INTERVAL '7 days'`;
    }

    queryText += ` ORDER BY lc.created_at ASC LIMIT $1`;

    const result = await query(queryText, [limit || 50]);

    return JSON.stringify(result.rows, null, 2);
  }

  private async handleProcessReply(campaignId: string, replyContent: string): Promise<string> {
    // Log the inbound message
    await query(
      `INSERT INTO linkedin_messages (campaign_id, direction, message_type, content, status)
       VALUES ($1, 'inbound', 'dm', $2, 'received')`,
      [campaignId, replyContent]
    );

    // Update campaign
    await query(
      `UPDATE linkedin_campaigns
       SET messages_received = messages_received + 1,
           last_message_received_at = NOW()
       WHERE id = $1`,
      [campaignId]
    );

    // Analyze reply
    const analysis = this.analyzeLinkedInReply(replyContent);

    // Get lead ID
    const campaignResult = await query<{ lead_id: string }>(
      `SELECT lead_id FROM linkedin_campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length > 0) {
      await this.logEvent(
        'linkedin_reply_received',
        campaignResult.rows[0].lead_id,
        campaignId,
        { intent: analysis.intent }
      );

      // Update lead status if positive reply
      if (analysis.intent === 'interested' || analysis.intent === 'meeting_request') {
        await query(
          `UPDATE leads SET status = 'engaged' WHERE id = $1`,
          [campaignResult.rows[0].lead_id]
        );
      }
    }

    return JSON.stringify({
      analysis,
      recommended_response: analysis.suggestedResponse,
    }, null, 2);
  }

  private analyzeLinkedInReply(content: string): {
    intent: string;
    sentiment: string;
    suggestedResponse: string;
  } {
    const lower = content.toLowerCase();

    if (
      lower.includes('interested') ||
      lower.includes('tell me more') ||
      lower.includes('sounds good') ||
      lower.includes('yes')
    ) {
      return {
        intent: 'interested',
        sentiment: 'positive',
        suggestedResponse: 'Great! Share case study and propose a quick call.',
      };
    }

    if (
      lower.includes('call') ||
      lower.includes('meet') ||
      lower.includes('calendar') ||
      lower.includes('schedule')
    ) {
      return {
        intent: 'meeting_request',
        sentiment: 'positive',
        suggestedResponse: 'Send calendar link immediately.',
      };
    }

    if (
      lower.includes('not interested') ||
      lower.includes('no thanks') ||
      lower.includes('not right now')
    ) {
      return {
        intent: 'not_interested',
        sentiment: 'negative',
        suggestedResponse: 'Thank them gracefully, leave door open for future.',
      };
    }

    return {
      intent: 'unclear',
      sentiment: 'neutral',
      suggestedResponse: 'Ask a clarifying question to understand their needs.',
    };
  }

  private async handleUpdateConnectionStatus(
    campaignId: string,
    status: string
  ): Promise<string> {
    await query(
      `UPDATE linkedin_campaigns
       SET connection_status = $2,
           connected_at = CASE WHEN $2 = 'connected' THEN NOW() ELSE connected_at END
       WHERE id = $1`,
      [campaignId, status]
    );

    return `Campaign ${campaignId} connection status updated to: ${status}`;
  }

  private async handleGetStats(timePeriod?: string): Promise<string> {
    const interval = timePeriod === 'day' ? '1 day' : timePeriod === 'month' ? '30 days' : '7 days';

    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE connection_status = 'pending') as pending_connections,
        COUNT(*) FILTER (WHERE connection_status = 'connected') as connected,
        COUNT(*) FILTER (WHERE connection_status = 'declined') as declined,
        SUM(messages_sent) as total_messages_sent,
        SUM(messages_received) as total_replies
       FROM linkedin_campaigns
       WHERE created_at > NOW() - INTERVAL '${interval}'`
    );

    const stats = result.rows[0];

    return JSON.stringify({
      period: interval,
      connections: {
        pending: stats.pending_connections || 0,
        accepted: stats.connected || 0,
        declined: stats.declined || 0,
        acceptance_rate: stats.pending_connections > 0
          ? `${((stats.connected / (stats.connected + stats.declined + stats.pending_connections)) * 100).toFixed(1)}%`
          : 'N/A',
      },
      messages: {
        sent: stats.total_messages_sent || 0,
        replies: stats.total_replies || 0,
        reply_rate: stats.total_messages_sent > 0
          ? `${((stats.total_replies / stats.total_messages_sent) * 100).toFixed(1)}%`
          : 'N/A',
      },
    }, null, 2);
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.action === 'send_connection_requests') {
      return `Send LinkedIn connection requests to qualified leads:

Tasks:
1. Get leads with LinkedIn URLs that don't have active campaigns
2. Compose personalized connection requests for each
3. Queue the connection requests
4. Report results`;
    }

    if (payload.action === 'send_followup_dms') {
      return `Send follow-up DMs to connected prospects:

Tasks:
1. Get connected prospects ready for next DM in sequence
2. Compose appropriate DM based on sequence step
3. Queue the DMs
4. Report results`;
    }

    if (payload.action === 'process_replies') {
      return `Process LinkedIn replies and take appropriate action:

Tasks:
1. Get recent replies that need processing
2. Analyze intent and sentiment
3. Update lead statuses
4. Compose responses for interested prospects`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const linkedInAgent = new LinkedInAgent();
