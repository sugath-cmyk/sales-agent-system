import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { sendEmail, EmailOptions } from './sender.js';
import { emailSequenceConfig, bookingConfig } from '../../config/index.js';
import {
  EMAIL_SEQUENCES,
  getEmailTemplate,
  SEND_TIME_RULES,
  PERSONALIZATION_RULES,
  AB_TEST_VARIANTS,
  REPLY_HANDLERS,
  EmailSequenceStep,
} from './strategy.js';

const SYSTEM_PROMPT = `You are Mailman 📧, the Email Outreach Agent specialized in B2B cold email for D2C e-commerce brands.

Your primary goal: Get prospects to book meetings at ${bookingConfig.calendlyUrl}

## Email Sequences Available

### Standard Cold Outreach (5-touch)
- Step 1 (Day 0): Cold opener - high personalization, mention specific products
- Step 2 (Day 3): Social proof - stats and case studies
- Step 3 (Day 6): Pain point - "just browsing" problem deep dive
- Step 4 (Day 10): Breakup warning - last chance positioning
- Step 5 (Day 14): Final breakup - graceful exit

### High Intent Outreach (3-touch) - For leads scoring 80+
- Step 1 (Day 0): Direct opener with product mockup
- Step 2 (Day 2): Value demo with comparison image
- Step 3 (Day 5): Soft breakup

### Re-engagement (2-touch) - For cold leads coming back
- Step 1 (Day 0): Notice trigger about company
- Step 2 (Day 4): Industry case study

## Send Timing Rules
Best Days: Tuesday, Wednesday, Thursday
Best Hours: 9am, 10am, 2pm (recipient timezone)
Avoid: Weekends, lunch hours (12-1pm), before 8am, after 5pm

## Personalization Levels
- HIGH (Step 1): Requires firstName, companyName, domain, productCategory
- MEDIUM (Steps 2-3): Requires firstName, companyName
- LOW (Breakup): Requires firstName, companyName

## Reply Handling
When processing replies, detect intent:
- Interested → Send calendar link immediately
- Price objection → Address with ROI data
- Timing objection → Nurture and follow up later
- Meeting request → Book immediately
- Not interested → Stop sequence gracefully

## A/B Testing
Rotate subject lines and CTAs for optimization.

Always include Calendly link: ${bookingConfig.calendlyUrl}`;

const TOOLS: Tool[] = [
  {
    name: 'get_lead_for_outreach',
    description: 'Get a qualified lead ready for email outreach',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Specific lead ID, or omit to get next in queue',
        },
      },
    },
  },
  {
    name: 'compose_email',
    description: 'Compose a personalized email using AI',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead to compose email for',
        },
        email_type: {
          type: 'string',
          description: 'Type: hook, social_proof, pain_point, breakup_warning, breakup, follow_up, reply',
        },
        context: {
          type: 'string',
          description: 'Additional context (e.g., previous conversation, specific objection)',
        },
      },
      required: ['lead_id', 'email_type'],
    },
  },
  {
    name: 'send_email',
    description: 'Send a composed email',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead ID',
        },
        to_email: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body (plain text)',
        },
        campaign_id: {
          type: 'string',
          description: 'Campaign ID if part of a sequence',
        },
      },
      required: ['lead_id', 'to_email', 'subject', 'body'],
    },
  },
  {
    name: 'start_sequence',
    description: 'Start a new email sequence for a lead',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
          description: 'Lead to start sequence for',
        },
        sequence_id: {
          type: 'string',
          description: 'Sequence template ID (optional, uses default if not provided)',
        },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'get_pending_emails',
    description: 'Get emails scheduled to be sent',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number to return',
        },
      },
    },
  },
  {
    name: 'process_reply',
    description: 'Process and respond to an email reply',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign that received the reply',
        },
        reply_content: {
          type: 'string',
          description: 'Content of the reply',
        },
      },
      required: ['campaign_id', 'reply_content'],
    },
  },
  {
    name: 'pause_campaign',
    description: 'Pause an active email campaign',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign to pause',
        },
        reason: {
          type: 'string',
          description: 'Reason for pausing',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_campaign_stats',
    description: 'Get performance stats for email campaigns',
    input_schema: {
      type: 'object',
      properties: {
        time_period: {
          type: 'string',
          description: 'Time period: day, week, month',
        },
      },
    },
  },
  {
    name: 'update_lead_status',
    description: 'Update lead status after email interaction',
    input_schema: {
      type: 'object',
      properties: {
        lead_id: {
          type: 'string',
        },
        status: {
          type: 'string',
          description: 'New status: contacted, engaged, meeting_booked, not_interested',
        },
      },
      required: ['lead_id', 'status'],
    },
  },
];

export class EmailAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'email_agent',
      description: 'Handles all email outreach and sequences',
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
      case 'get_lead_for_outreach':
        return this.handleGetLeadForOutreach(input.lead_id as string | undefined);

      case 'compose_email':
        return this.handleComposeEmail(
          input.lead_id as string,
          input.email_type as string,
          input.context as string | undefined
        );

      case 'send_email':
        return this.handleSendEmail(input);

      case 'start_sequence':
        return this.handleStartSequence(
          input.lead_id as string,
          input.sequence_id as string | undefined
        );

      case 'get_pending_emails':
        return this.handleGetPendingEmails(input.limit as number | undefined);

      case 'process_reply':
        return this.handleProcessReply(
          input.campaign_id as string,
          input.reply_content as string
        );

      case 'pause_campaign':
        return this.handlePauseCampaign(
          input.campaign_id as string,
          input.reason as string | undefined
        );

      case 'get_campaign_stats':
        return this.handleGetCampaignStats(input.time_period as string | undefined);

      case 'update_lead_status':
        return this.handleUpdateLeadStatus(input.lead_id as string, input.status as string);

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleGetLeadForOutreach(leadId?: string): Promise<string> {
    let queryText: string;
    let params: unknown[];

    if (leadId) {
      queryText = `
        SELECT
          l.id, l.status, l.total_score,
          c.first_name, c.last_name, c.email, c.title,
          co.name as company_name, co.domain, co.industry,
          co.platform, co.tech_stack
        FROM leads l
        JOIN contacts c ON l.contact_id = c.id
        JOIN companies co ON l.company_id = co.id
        WHERE l.id = $1`;
      params = [leadId];
    } else {
      // Get next qualified lead without active campaign
      queryText = `
        SELECT
          l.id, l.status, l.total_score,
          c.first_name, c.last_name, c.email, c.title,
          co.name as company_name, co.domain, co.industry,
          co.platform, co.tech_stack
        FROM leads l
        JOIN contacts c ON l.contact_id = c.id
        JOIN companies co ON l.company_id = co.id
        LEFT JOIN email_campaigns ec ON l.id = ec.lead_id AND ec.status = 'active'
        WHERE l.total_score >= 50
          AND l.status IN ('new', 'researched')
          AND ec.id IS NULL
          AND c.email IS NOT NULL
        ORDER BY l.total_score DESC
        LIMIT 1`;
      params = [];
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return leadId
        ? `Lead not found: ${leadId}`
        : 'No qualified leads ready for outreach';
    }

    return JSON.stringify(result.rows[0], null, 2);
  }

  private async handleComposeEmail(
    leadId: string,
    emailType: string,
    _additionalContext?: string
  ): Promise<string> {
    // Get lead data
    const leadResult = await query(
      `SELECT
        c.first_name, c.email,
        co.name as company_name, co.domain, co.industry,
        l.total_score
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

    // Select sequence based on lead score
    const sequenceType = this.selectSequenceType(lead.total_score);

    // Map email type to template ID
    const templateId = this.mapEmailTypeToTemplate(emailType);

    // Get template from strategy module
    const template = getEmailTemplate(templateId, {
      firstName: lead.first_name || 'there',
      companyName: lead.company_name || 'your company',
      domain: lead.domain || '',
      industry: lead.industry || 'D2C',
      productCategory: '',
    });

    return JSON.stringify({
      ...template,
      sequenceType,
      personalizationLevel: this.getPersonalizationLevel(emailType),
      sendTimeRecommendation: this.getOptimalSendTime(),
    }, null, 2);
  }

  private selectSequenceType(score: number): string {
    if (score >= 80) return 'high_intent';
    if (score >= 50) return 'standard_cold';
    return 're_engage';
  }

  private mapEmailTypeToTemplate(emailType: string): string {
    const mapping: Record<string, string> = {
      hook: 'cold_opener',
      cold: 'cold_opener',
      social_proof: 'social_proof',
      pain_point: 'pain_point',
      value: 'value_demo',
      breakup_warning: 'breakup_warning',
      breakup: 'breakup',
      soft_breakup: 'soft_breakup',
      re_engage: 're_engage_trigger',
      case_study: 'case_study',
      follow_up: 'social_proof',
    };
    return mapping[emailType] || 'cold_opener';
  }

  private getPersonalizationLevel(emailType: string): string {
    if (['hook', 'cold', 're_engage'].includes(emailType)) return 'high';
    if (['social_proof', 'pain_point', 'value'].includes(emailType)) return 'medium';
    return 'low';
  }

  private getOptimalSendTime(): { hour: number; day: string; timezone: string } {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const now = new Date();
    const dayIndex = now.getDay();

    // Get best times for current day or next business day
    const targetDay = dayIndex >= 1 && dayIndex <= 5
      ? days[dayIndex - 1]
      : 'tuesday';

    const bestTimes = SEND_TIME_RULES.bestTimes[targetDay as keyof typeof SEND_TIME_RULES.bestTimes] || [9, 10];

    return {
      hour: bestTimes[0],
      day: targetDay,
      timezone: 'recipient',
    };
  }

  private async handleSendEmail(input: Record<string, unknown>): Promise<string> {
    const options: EmailOptions = {
      to: input.to_email as string,
      subject: input.subject as string,
      body: input.body as string,
    };

    try {
      const messageId = await sendEmail(options);

      // Log the email
      await query(
        `INSERT INTO email_logs
         (campaign_id, lead_id, template_id, subject, body, to_email, status, sent_at, provider_message_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'sent', NOW(), $7)`,
        [
          input.campaign_id || null,
          input.lead_id,
          input.template_id || 'custom',
          input.subject,
          input.body,
          input.to_email,
          messageId,
        ]
      );

      // Log event
      await this.logEvent('email_sent', input.lead_id as string, input.campaign_id as string, {
        subject: input.subject,
        to: input.to_email,
      });

      return `Email sent successfully. Message ID: ${messageId}`;
    } catch (error) {
      return `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleStartSequence(leadId: string, sequenceId?: string): Promise<string> {
    // Get lead email
    const leadResult = await query(
      `SELECT c.email FROM leads l
       JOIN contacts c ON l.contact_id = c.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0 || !leadResult.rows[0].email) {
      return `Lead ${leadId} not found or has no email`;
    }

    // Get or create default sequence
    let seqId = sequenceId;
    if (!seqId) {
      const seqResult = await query<{ id: string }>(
        `SELECT id FROM email_sequences WHERE name = 'Default 5-Touch' LIMIT 1`
      );

      if (seqResult.rows.length === 0) {
        // Create default sequence
        const createResult = await query<{ id: string }>(
          `INSERT INTO email_sequences (name, description, steps)
           VALUES ('Default 5-Touch', 'Standard 5-touch cold email sequence', $1)
           RETURNING id`,
          [JSON.stringify(emailSequenceConfig.defaultSequence)]
        );
        seqId = createResult.rows[0].id;
      } else {
        seqId = seqResult.rows[0].id;
      }
    }

    // Calculate first send time (next business day at 9 AM)
    const nextSend = this.calculateNextSendTime();

    // Create campaign
    const campaignResult = await query<{ id: string }>(
      `INSERT INTO email_campaigns (lead_id, sequence_id, status, current_step, next_send_at)
       VALUES ($1, $2, 'active', 0, $3)
       RETURNING id`,
      [leadId, seqId, nextSend]
    );

    // Update lead status
    await query(
      `UPDATE leads SET status = 'contacted', stage_changed_at = NOW() WHERE id = $1`,
      [leadId]
    );

    await this.logEvent('sequence_started', leadId, campaignResult.rows[0].id);

    return `Email sequence started for lead ${leadId}. Campaign ID: ${campaignResult.rows[0].id}. First email scheduled for: ${nextSend.toISOString()}`;
  }

  private calculateNextSendTime(): Date {
    const now = new Date();
    const { startHour, endHour } = emailSequenceConfig.sendWindow;

    // Set to next business day at start hour
    const next = new Date(now);
    next.setHours(startHour, 0, 0, 0);

    // If we're past the end hour, move to next day
    if (now.getHours() >= endHour) {
      next.setDate(next.getDate() + 1);
    }

    // Skip weekends
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  private async handleGetPendingEmails(limit?: number): Promise<string> {
    const result = await query(
      `SELECT
        ec.id as campaign_id, ec.lead_id, ec.current_step, ec.next_send_at,
        c.email, c.first_name,
        co.name as company_name
       FROM email_campaigns ec
       JOIN leads l ON ec.lead_id = l.id
       JOIN contacts c ON l.contact_id = c.id
       JOIN companies co ON l.company_id = co.id
       WHERE ec.status = 'active'
         AND ec.next_send_at <= NOW()
       ORDER BY ec.next_send_at ASC
       LIMIT $1`,
      [limit || 50]
    );

    return JSON.stringify(result.rows, null, 2);
  }

  private async handleProcessReply(campaignId: string, replyContent: string): Promise<string> {
    // Analyze the reply
    const analysis = this.analyzeReply(replyContent);

    // Update campaign based on reply type
    if (analysis.intent === 'interested' || analysis.intent === 'meeting_request') {
      // Hot lead! Pause sequence
      await query(
        `UPDATE email_campaigns SET status = 'completed' WHERE id = $1`,
        [campaignId]
      );

      // Get lead ID
      const campaignResult = await query<{ lead_id: string }>(
        `SELECT lead_id FROM email_campaigns WHERE id = $1`,
        [campaignId]
      );

      if (campaignResult.rows.length > 0) {
        await query(
          `UPDATE leads SET status = 'engaged', stage_changed_at = NOW()
           WHERE id = $1`,
          [campaignResult.rows[0].lead_id]
        );

        await this.logEvent(
          'positive_reply_received',
          campaignResult.rows[0].lead_id,
          campaignId,
          { intent: analysis.intent }
        );
      }
    } else if (analysis.intent === 'not_interested' || analysis.intent === 'unsubscribe') {
      // Stop sequence
      await query(
        `UPDATE email_campaigns SET status = 'stopped' WHERE id = $1`,
        [campaignId]
      );
    }

    return JSON.stringify({
      analysis,
      action_taken: analysis.suggestedAction,
    }, null, 2);
  }

  private analyzeReply(content: string): {
    intent: string;
    sentiment: string;
    suggestedAction: string;
    suggestedResponse?: string;
  } {
    const lower = content.toLowerCase();

    // Check against REPLY_HANDLERS from strategy
    for (const [handlerKey, handler] of Object.entries(REPLY_HANDLERS)) {
      const keywords = handler.keywords as string[];
      if (keywords.some((kw: string) => lower.includes(kw))) {
        return {
          intent: handlerKey,
          sentiment: handlerKey.includes('not_interested') ? 'negative' : 'positive',
          suggestedAction: handler.action,
          suggestedResponse: handler.response,
        };
      }
    }

    // Check for timing objections
    if (
      lower.includes('not now') ||
      lower.includes('later') ||
      lower.includes('busy') ||
      lower.includes('next quarter')
    ) {
      return {
        intent: 'objection_timing',
        sentiment: 'neutral',
        suggestedAction: 'nurture',
        suggestedResponse: REPLY_HANDLERS.objection_timing.response,
      };
    }

    // Check for price objections
    if (
      lower.includes('expensive') ||
      lower.includes('cost') ||
      lower.includes('price') ||
      lower.includes('budget')
    ) {
      return {
        intent: 'objection_price',
        sentiment: 'neutral',
        suggestedAction: 'handle_objection',
        suggestedResponse: REPLY_HANDLERS.objection_price.response,
      };
    }

    return {
      intent: 'unclear',
      sentiment: 'neutral',
      suggestedAction: 'Review manually and respond appropriately',
    };
  }

  private async handlePauseCampaign(campaignId: string, reason?: string): Promise<string> {
    await query(
      `UPDATE email_campaigns SET status = 'paused' WHERE id = $1`,
      [campaignId]
    );

    return `Campaign ${campaignId} paused. Reason: ${reason || 'No reason provided'}`;
  }

  private async handleGetCampaignStats(timePeriod?: string): Promise<string> {
    const interval = timePeriod === 'day' ? '1 day' : timePeriod === 'month' ? '30 days' : '7 days';

    const result = await query(
      `SELECT
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE status = 'opened') as opened,
        COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
        COUNT(*) FILTER (WHERE status = 'replied') as replied,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced
       FROM email_logs
       WHERE created_at > NOW() - INTERVAL '${interval}'`
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total_emails) || 1;

    return JSON.stringify({
      period: interval,
      total_sent: stats.total_emails,
      opened: stats.opened,
      open_rate: `${((parseInt(stats.opened) / total) * 100).toFixed(1)}%`,
      clicked: stats.clicked,
      click_rate: `${((parseInt(stats.clicked) / total) * 100).toFixed(1)}%`,
      replied: stats.replied,
      reply_rate: `${((parseInt(stats.replied) / total) * 100).toFixed(1)}%`,
      bounced: stats.bounced,
    }, null, 2);
  }

  private async handleUpdateLeadStatus(leadId: string, status: string): Promise<string> {
    await this.updateLeadStatus(leadId, status);
    return `Lead ${leadId} status updated to: ${status}`;
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.action === 'send_next_batch') {
      return `Send the next batch of scheduled emails:

Tasks:
1. Get pending emails that are due to be sent
2. For each, compose and send the email
3. Update campaign progress
4. Report results`;
    }

    if (payload.action === 'start_outreach' && payload.lead_id) {
      return `Start email outreach for a specific lead:
Lead ID: ${payload.lead_id}

Tasks:
1. Get the lead data
2. Start the email sequence
3. Compose and send the first email
4. Confirm completion`;
    }

    if (payload.action === 'handle_reply') {
      return `Process an email reply:
Campaign ID: ${payload.campaign_id}
Reply Content: ${payload.reply_content}

Tasks:
1. Analyze the reply intent and sentiment
2. Take appropriate action (pause, respond, book meeting)
3. Update lead status accordingly`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const emailAgent = new EmailAgent();
