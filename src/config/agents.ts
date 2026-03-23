// Agent Personalities, KRAs, and Trigger Configuration
// Each agent has distinct KRAs, impact metrics, and configurable triggers
// ULTIMATE GOAL: Book meetings on Calendly (https://calendly.com/sugath-flash/30min)

export interface AgentTrigger {
  id: string;
  name: string;
  description: string;
  parameters: {
    name: string;
    type: 'number' | 'string' | 'select' | 'boolean';
    label: string;
    default: number | string | boolean;
    min?: number;
    max?: number;
    options?: string[];
  }[];
  costEstimate: {
    anthropicTokensPerUnit: number;  // Tokens per item processed
    externalApiCostPerUnit: number;  // Cost for Apollo, etc.
    estimatedTimePerUnit: number;    // Seconds per item
  };
}

export interface KRA {
  id: string;
  name: string;
  description: string;
  target: string;
  impact: string;
  metric: string;
  currentValue?: number;
  targetValue?: number;
}

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  channel: string;
  emoji: string;
  personality: string;
  strengths: string[];
  kpis: string[];
  goal: string;
  kras: KRA[];
  triggers: AgentTrigger[];
  impactStatement: string;
}

// The shared booking link for all agents
export const CALENDLY_LINK = 'https://calendly.com/sugath-flash/30min';

// Cost constants
export const COST_CONSTANTS = {
  ANTHROPIC_INPUT_PER_1K: 0.003,   // $3 per 1M input tokens
  ANTHROPIC_OUTPUT_PER_1K: 0.015,  // $15 per 1M output tokens
  APOLLO_PER_ENRICHMENT: 0.05,     // ~$0.05 per contact lookup
  CLEARBIT_PER_LOOKUP: 0.10,       // ~$0.10 per company lookup
  RESEND_PER_EMAIL: 0.001,         // ~$0.001 per email
};

export const AGENT_PERSONAS: Record<string, AgentPersona> = {
  lead_research: {
    id: 'lead_research',
    name: 'Scout',
    role: 'Lead Research Specialist',
    channel: 'Research',
    emoji: '🔍',
    personality: 'Meticulous, curious, and detail-oriented. Scout loves uncovering hidden gems in the Shopify ecosystem.',
    strengths: ['Store analysis', 'Tech detection', 'Data enrichment'],
    kpis: ['leads_discovered', 'enrichment_accuracy', 'qualified_rate'],
    goal: 'Find qualified Shopify stores without shopping assistants for the team to convert into meetings',
    impactStatement: 'Every qualified lead discovered is a potential $10K+ annual contract',
    kras: [
      {
        id: 'leads_discovered',
        name: 'Leads Discovered',
        description: 'Number of new qualified Shopify stores found',
        target: '50 leads/day',
        impact: 'Direct pipeline growth - each lead has 5% conversion potential',
        metric: 'count',
        targetValue: 50,
      },
      {
        id: 'enrichment_rate',
        name: 'Enrichment Success Rate',
        description: 'Percentage of leads with verified founder emails',
        target: '80%+',
        impact: 'Higher enrichment = better outreach targeting',
        metric: 'percentage',
        targetValue: 80,
      },
      {
        id: 'qualification_accuracy',
        name: 'Qualification Accuracy',
        description: 'Leads that match ICP criteria after manual review',
        target: '90%+',
        impact: 'Reduces wasted outreach effort on unqualified leads',
        metric: 'percentage',
        targetValue: 90,
      },
    ],
    triggers: [
      {
        id: 'discover_companies',
        name: 'Discover Companies',
        description: 'Find new Shopify stores matching ICP criteria',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of companies', default: 50, min: 10, max: 500 },
          { name: 'region', type: 'select', label: 'Target region', default: 'US', options: ['US', 'UK', 'AU', 'IN', 'ALL'] },
          { name: 'minTraffic', type: 'number', label: 'Min monthly traffic', default: 10000, min: 1000, max: 100000 },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 2000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 5,
        },
      },
      {
        id: 'enrich_leads',
        name: 'Enrich Leads with Apollo',
        description: 'Get real founder emails and company data from Apollo.io',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of leads', default: 25, min: 5, max: 100 },
          { name: 'targetTitles', type: 'select', label: 'Target roles', default: 'Founder,CEO', options: ['Founder,CEO', 'CMO,Marketing Director', 'CTO,Tech Lead', 'All Decision Makers'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 1500,
          externalApiCostPerUnit: 0.05,
          estimatedTimePerUnit: 3,
        },
      },
      {
        id: 'scan_domains',
        name: 'Scan Specific Domains',
        description: 'Research specific domains for platform and assistant detection',
        parameters: [
          { name: 'domains', type: 'string', label: 'Domains (comma-separated)', default: '' },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 1000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 8,
        },
      },
    ],
  },

  lead_scoring: {
    id: 'lead_scoring',
    name: 'Judge',
    role: 'Lead Qualification Expert',
    channel: 'Scoring',
    emoji: '⚖️',
    personality: 'Analytical, fair, and decisive. Judge evaluates every lead with precision and consistency.',
    strengths: ['ICP matching', 'Intent analysis', 'Prioritization'],
    kpis: ['scoring_accuracy', 'conversion_prediction', 'processing_speed'],
    goal: 'Score leads accurately so outreach agents can prioritize who is most likely to book a meeting',
    impactStatement: 'Accurate scoring increases conversion rate by 2-3x by focusing on hot leads first',
    kras: [
      {
        id: 'leads_scored',
        name: 'Leads Scored',
        description: 'Number of leads processed and scored daily',
        target: '100 leads/day',
        impact: 'Ensures all new leads are prioritized within 24 hours',
        metric: 'count',
        targetValue: 100,
      },
      {
        id: 'hot_lead_identification',
        name: 'Hot Lead Identification',
        description: 'Percentage of leads correctly identified as high-value',
        target: '85%+ accuracy',
        impact: 'Outreach team focuses on leads most likely to convert',
        metric: 'percentage',
        targetValue: 85,
      },
      {
        id: 'scoring_speed',
        name: 'Scoring Speed',
        description: 'Average time to score a new lead',
        target: '<30 seconds',
        impact: 'Faster scoring = faster outreach = higher conversion',
        metric: 'seconds',
        targetValue: 30,
      },
    ],
    triggers: [
      {
        id: 'score_pending',
        name: 'Score Pending Leads',
        description: 'Score all unscored leads in the pipeline',
        parameters: [
          { name: 'limit', type: 'number', label: 'Max leads to score', default: 50, min: 10, max: 200 },
          { name: 'minDataQuality', type: 'select', label: 'Min data quality', default: 'medium', options: ['low', 'medium', 'high'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 1200,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 2,
        },
      },
      {
        id: 'rescore_leads',
        name: 'Re-score Existing Leads',
        description: 'Re-evaluate leads with updated criteria or new data',
        parameters: [
          { name: 'ageInDays', type: 'number', label: 'Leads older than (days)', default: 7, min: 1, max: 30 },
          { name: 'limit', type: 'number', label: 'Max leads', default: 100, min: 10, max: 500 },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 1000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 1.5,
        },
      },
    ],
  },

  email: {
    id: 'email',
    name: 'Mailman',
    role: 'Email Outreach Specialist',
    channel: 'Email',
    emoji: '📧',
    personality: 'Persuasive, empathetic, and persistent. Mailman crafts messages that get responses.',
    strengths: ['Copywriting', 'Personalization', 'Follow-up timing'],
    kpis: ['open_rate', 'reply_rate', 'meetings_booked'],
    goal: `Get prospects to book a 30-min discovery call: ${CALENDLY_LINK}`,
    impactStatement: 'Each meeting booked has 20% close rate = $2K+ MRR potential',
    kras: [
      {
        id: 'emails_sent',
        name: 'Emails Sent',
        description: 'Personalized outreach emails delivered',
        target: '100 emails/day',
        impact: 'Volume drives pipeline - 2% reply rate = 2 conversations/day',
        metric: 'count',
        targetValue: 100,
      },
      {
        id: 'reply_rate',
        name: 'Reply Rate',
        description: 'Percentage of emails that get a response',
        target: '5%+',
        impact: 'Higher replies = more conversations = more meetings',
        metric: 'percentage',
        targetValue: 5,
      },
      {
        id: 'meetings_from_email',
        name: 'Meetings Booked',
        description: 'Meetings booked directly from email outreach',
        target: '2 meetings/week',
        impact: 'Primary revenue driver - each meeting = $2K potential',
        metric: 'count',
        targetValue: 2,
      },
    ],
    triggers: [
      {
        id: 'send_campaign',
        name: 'Send Email Campaign',
        description: 'Send personalized emails to scored leads',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of emails', default: 25, min: 5, max: 100 },
          { name: 'minScore', type: 'number', label: 'Minimum lead score', default: 50, min: 30, max: 90 },
          { name: 'template', type: 'select', label: 'Email template', default: 'hook', options: ['hook', 'social_proof', 'pain_point', 'case_study'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 2500,
          externalApiCostPerUnit: 0.001,
          estimatedTimePerUnit: 10,
        },
      },
      {
        id: 'send_followups',
        name: 'Send Follow-ups',
        description: 'Send follow-up emails to non-responders',
        parameters: [
          { name: 'daysSinceLastEmail', type: 'number', label: 'Days since last email', default: 3, min: 2, max: 7 },
          { name: 'maxFollowups', type: 'number', label: 'Max follow-up number', default: 3, min: 1, max: 5 },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 2000,
          externalApiCostPerUnit: 0.001,
          estimatedTimePerUnit: 8,
        },
      },
    ],
  },

  linkedin: {
    id: 'linkedin',
    name: 'Lincoln',
    role: 'LinkedIn Engagement Specialist',
    channel: 'LinkedIn',
    emoji: '💼',
    personality: 'Professional, networker, relationship-builder. Lincoln turns connections into conversations.',
    strengths: ['Networking', 'Professional messaging', 'Relationship building'],
    kpis: ['connection_rate', 'response_rate', 'meetings_booked'],
    goal: `Build relationships and drive prospects to book: ${CALENDLY_LINK}`,
    impactStatement: 'LinkedIn has 3x higher response rates than cold email for B2B',
    kras: [
      {
        id: 'connections_sent',
        name: 'Connection Requests',
        description: 'Personalized LinkedIn connection requests sent',
        target: '50/day',
        impact: '30% accept rate = 15 new connections daily',
        metric: 'count',
        targetValue: 50,
      },
      {
        id: 'messages_sent',
        name: 'DMs Sent',
        description: 'Personalized direct messages to connections',
        target: '30/day',
        impact: 'Nurtures relationships toward meeting booking',
        metric: 'count',
        targetValue: 30,
      },
      {
        id: 'linkedin_meetings',
        name: 'Meetings from LinkedIn',
        description: 'Meetings booked via LinkedIn conversations',
        target: '3/week',
        impact: 'Highest-quality leads - already engaged professionally',
        metric: 'count',
        targetValue: 3,
      },
    ],
    triggers: [
      {
        id: 'send_connections',
        name: 'Send Connection Requests',
        description: 'Send personalized LinkedIn connection requests',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of requests', default: 25, min: 10, max: 50 },
          { name: 'minScore', type: 'number', label: 'Minimum lead score', default: 60, min: 40, max: 90 },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 1500,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 5,
        },
      },
      {
        id: 'send_messages',
        name: 'Send DM Sequence',
        description: 'Send follow-up DMs to existing connections',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of DMs', default: 20, min: 5, max: 50 },
          { name: 'sequenceStep', type: 'select', label: 'Sequence step', default: 'value_first', options: ['value_first', 'case_study', 'direct_ask'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 2000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 6,
        },
      },
    ],
  },

  content: {
    id: 'content',
    name: 'Scribe',
    role: 'Content Marketing Specialist',
    channel: 'Content',
    emoji: '✍️',
    personality: 'Creative, strategic, and data-driven. Scribe creates content that attracts and converts.',
    strengths: ['SEO writing', 'Case studies', 'Social content'],
    kpis: ['content_produced', 'engagement_rate', 'lead_attribution'],
    goal: 'Create compelling content that drives inbound interest and supports booking meetings',
    impactStatement: 'Content builds trust and reduces sales cycle by 40%',
    kras: [
      {
        id: 'content_pieces',
        name: 'Content Pieces Created',
        description: 'Blog posts, case studies, social content produced',
        target: '5 pieces/week',
        impact: 'Consistent content = SEO growth + social proof',
        metric: 'count',
        targetValue: 5,
      },
      {
        id: 'content_engagement',
        name: 'Content Engagement',
        description: 'Average engagement rate on published content',
        target: '3%+',
        impact: 'Higher engagement = more inbound leads',
        metric: 'percentage',
        targetValue: 3,
      },
      {
        id: 'inbound_leads',
        name: 'Inbound Leads from Content',
        description: 'Leads attributed to content marketing',
        target: '10/month',
        impact: 'Inbound leads have 5x higher close rate',
        metric: 'count',
        targetValue: 10,
      },
    ],
    triggers: [
      {
        id: 'generate_blog',
        name: 'Generate Blog Posts',
        description: 'Create SEO-optimized blog content',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of posts', default: 3, min: 1, max: 10 },
          { name: 'topic', type: 'select', label: 'Topic category', default: 'shopify_tips', options: ['shopify_tips', 'conversion_optimization', 'case_studies', 'industry_trends'] },
          { name: 'wordCount', type: 'number', label: 'Words per post', default: 1500, min: 800, max: 3000 },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 8000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 60,
        },
      },
      {
        id: 'generate_social',
        name: 'Generate Social Posts',
        description: 'Create LinkedIn and Twitter content',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of posts', default: 10, min: 5, max: 30 },
          { name: 'platform', type: 'select', label: 'Platform', default: 'linkedin', options: ['linkedin', 'twitter', 'both'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 1000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 5,
        },
      },
    ],
  },

  orchestrator: {
    id: 'orchestrator',
    name: 'Captain',
    role: 'Operations Coordinator',
    channel: 'Operations',
    emoji: '🎯',
    personality: 'Strategic, organized, and big-picture thinker. Captain ensures the team runs like clockwork.',
    strengths: ['Coordination', 'Resource allocation', 'Pipeline management'],
    kpis: ['pipeline_velocity', 'meetings_booked', 'conversion_rate'],
    goal: 'Maximize the number of qualified meetings booked each day',
    impactStatement: 'Orchestration efficiency directly impacts daily meeting count',
    kras: [
      {
        id: 'pipeline_velocity',
        name: 'Pipeline Velocity',
        description: 'Average days from lead discovery to meeting booked',
        target: '<14 days',
        impact: 'Faster pipeline = more meetings per month',
        metric: 'days',
        targetValue: 14,
      },
      {
        id: 'agent_utilization',
        name: 'Agent Utilization',
        description: 'Percentage of agent capacity being used effectively',
        target: '80%+',
        impact: 'Higher utilization = more output from same resources',
        metric: 'percentage',
        targetValue: 80,
      },
      {
        id: 'daily_meetings',
        name: 'Daily Meeting Target',
        description: 'Meetings booked per day across all channels',
        target: '2/day',
        impact: 'Primary business metric - 2/day = $40K+ MRR potential',
        metric: 'count',
        targetValue: 2,
      },
    ],
    triggers: [
      {
        id: 'run_daily_workflow',
        name: 'Run Daily Workflow',
        description: 'Execute full daily pipeline: research → score → outreach',
        parameters: [
          { name: 'newLeadsTarget', type: 'number', label: 'New leads to discover', default: 30, min: 10, max: 100 },
          { name: 'emailsTarget', type: 'number', label: 'Emails to send', default: 50, min: 20, max: 100 },
          { name: 'linkedinTarget', type: 'number', label: 'LinkedIn actions', default: 25, min: 10, max: 50 },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 5000,
          externalApiCostPerUnit: 0.05,
          estimatedTimePerUnit: 30,
        },
      },
      {
        id: 'optimize_pipeline',
        name: 'Optimize Pipeline',
        description: 'Analyze and rebalance pipeline stages',
        parameters: [
          { name: 'analysisDepth', type: 'select', label: 'Analysis depth', default: 'standard', options: ['quick', 'standard', 'deep'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 3000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 20,
        },
      },
    ],
  },

  leader: {
    id: 'leader',
    name: 'Chief',
    role: 'Performance Leader',
    channel: 'Leadership',
    emoji: '👔',
    personality: 'Supportive, demanding, and growth-focused. Chief pushes the team to excellence while celebrating wins.',
    strengths: ['Performance analysis', 'Coaching', 'Strategy'],
    kpis: ['meetings_booked', 'team_performance', 'goal_achievement'],
    goal: 'Drive team performance to maximize daily meeting bookings',
    impactStatement: 'Leadership guidance improves team output by 30%',
    kras: [
      {
        id: 'team_efficiency',
        name: 'Team Efficiency Score',
        description: 'Overall team performance against KRAs',
        target: '85%+',
        impact: 'High efficiency = consistent meeting flow',
        metric: 'percentage',
        targetValue: 85,
      },
      {
        id: 'weekly_meetings',
        name: 'Weekly Meeting Target',
        description: 'Total meetings booked per week',
        target: '10/week',
        impact: 'Weekly consistency = predictable revenue',
        metric: 'count',
        targetValue: 10,
      },
      {
        id: 'improvement_rate',
        name: 'Week-over-Week Improvement',
        description: 'Performance improvement trend',
        target: '5%+ weekly',
        impact: 'Continuous improvement = compounding growth',
        metric: 'percentage',
        targetValue: 5,
      },
    ],
    triggers: [
      {
        id: 'generate_report',
        name: 'Generate Performance Report',
        description: 'Create comprehensive team performance analysis',
        parameters: [
          { name: 'period', type: 'select', label: 'Report period', default: 'weekly', options: ['daily', 'weekly', 'monthly'] },
          { name: 'includeRecommendations', type: 'boolean', label: 'Include recommendations', default: true },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 4000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 15,
        },
      },
      {
        id: 'coach_agents',
        name: 'Generate Agent Coaching',
        description: 'Create personalized coaching feedback for each agent',
        parameters: [
          { name: 'agents', type: 'select', label: 'Agents to coach', default: 'all', options: ['all', 'underperforming', 'top_performers'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 2500,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 10,
        },
      },
    ],
  },

  ads: {
    id: 'ads',
    name: 'Adman',
    role: 'Paid Advertising Specialist',
    channel: 'Paid Ads',
    emoji: '📢',
    personality: 'Data-obsessed, creative, and ROI-focused. Adman turns ad spend into booked meetings.',
    strengths: ['Meta Ads', 'Google Ads', 'A/B testing', 'Audience targeting'],
    kpis: ['cost_per_lead', 'roas', 'conversion_rate', 'meetings_booked'],
    goal: `Run paid campaigns that drive qualified demos: ${CALENDLY_LINK}`,
    impactStatement: 'Paid ads can 10x lead volume when optimized correctly',
    kras: [
      {
        id: 'cost_per_meeting',
        name: 'Cost Per Meeting Booked',
        description: 'Average ad spend per meeting scheduled',
        target: '<$100',
        impact: 'Lower CPM = higher ROI on ad spend',
        metric: 'dollars',
        targetValue: 100,
      },
      {
        id: 'roas',
        name: 'Return on Ad Spend',
        description: 'Revenue generated per dollar spent',
        target: '5x+',
        impact: 'Positive ROAS = profitable scaling',
        metric: 'multiplier',
        targetValue: 5,
      },
      {
        id: 'ad_meetings',
        name: 'Meetings from Ads',
        description: 'Meetings booked via paid campaigns',
        target: '5/week',
        impact: 'Scalable meeting source independent of outreach',
        metric: 'count',
        targetValue: 5,
      },
    ],
    triggers: [
      {
        id: 'generate_ad_copy',
        name: 'Generate Ad Copy',
        description: 'Create ad variations for testing',
        parameters: [
          { name: 'count', type: 'number', label: 'Number of variations', default: 5, min: 3, max: 20 },
          { name: 'platform', type: 'select', label: 'Ad platform', default: 'meta', options: ['meta', 'google', 'linkedin', 'all'] },
          { name: 'objective', type: 'select', label: 'Campaign objective', default: 'demo_booking', options: ['demo_booking', 'lead_gen', 'awareness'] },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 2000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 8,
        },
      },
      {
        id: 'analyze_campaigns',
        name: 'Analyze Campaign Performance',
        description: 'Review and optimize running campaigns',
        parameters: [
          { name: 'includeRecommendations', type: 'boolean', label: 'Include optimization tips', default: true },
        ],
        costEstimate: {
          anthropicTokensPerUnit: 3000,
          externalApiCostPerUnit: 0,
          estimatedTimePerUnit: 12,
        },
      },
    ],
  },
};

// Calculate estimated cost for a trigger
export function estimateTriggerCost(
  agentId: string,
  triggerId: string,
  params: Record<string, number | string | boolean>
): {
  anthropicCost: number;
  externalApiCost: number;
  totalCost: number;
  estimatedTime: number;
  breakdown: string[];
} {
  const agent = AGENT_PERSONAS[agentId];
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const trigger = agent.triggers.find(t => t.id === triggerId);
  if (!trigger) throw new Error(`Trigger ${triggerId} not found for agent ${agentId}`);

  // Get the count/units from params
  const countParam = trigger.parameters.find(p => p.name === 'count' || p.name === 'limit');
  const units = countParam ? (params[countParam.name] as number || countParam.default as number) : 1;

  const { anthropicTokensPerUnit, externalApiCostPerUnit, estimatedTimePerUnit } = trigger.costEstimate;

  // Calculate costs
  const totalTokens = anthropicTokensPerUnit * units;
  const anthropicCost = (totalTokens / 1000) * (COST_CONSTANTS.ANTHROPIC_INPUT_PER_1K + COST_CONSTANTS.ANTHROPIC_OUTPUT_PER_1K * 0.3);
  const externalApiCost = externalApiCostPerUnit * units;
  const totalCost = anthropicCost + externalApiCost;
  const estimatedTime = estimatedTimePerUnit * units;

  const breakdown: string[] = [
    `${units} items × ${anthropicTokensPerUnit.toLocaleString()} tokens = ${totalTokens.toLocaleString()} total tokens`,
    `Anthropic API: $${anthropicCost.toFixed(4)}`,
  ];

  if (externalApiCost > 0) {
    breakdown.push(`External APIs (Apollo, etc.): $${externalApiCost.toFixed(4)}`);
  }

  breakdown.push(`Estimated time: ${Math.ceil(estimatedTime / 60)} minutes`);

  return {
    anthropicCost,
    externalApiCost,
    totalCost,
    estimatedTime,
    breakdown,
  };
}

// Get agent display name
export function getAgentDisplayName(agentId: string): string {
  const persona = AGENT_PERSONAS[agentId];
  return persona ? `${persona.emoji} ${persona.name}` : agentId;
}

// Get full agent title
export function getAgentTitle(agentId: string): string {
  const persona = AGENT_PERSONAS[agentId];
  return persona ? `${persona.name} (${persona.role})` : agentId;
}
