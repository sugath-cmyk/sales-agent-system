// Adman - The Ads Agent
// Manages Meta (Facebook/Instagram) and Google Ads campaigns
// Goal: Drive qualified leads to book meetings on Calendly

import { BaseAgent, TaskContext, AgentConfig } from '../../core/agent-base.js';
import { Tool } from '../../core/claude-client.js';
import { query } from '../../db/client.js';
import { bookingConfig } from '../../config/index.js';
import {
  AUDIENCE_SEGMENTS,
  AD_TEMPLATES,
  GOOGLE_AD_KEYWORDS,
  BUDGET_RECOMMENDATIONS,
  AB_TEST_ELEMENTS,
  CAMPAIGN_TYPES,
  BENCHMARK_METRICS,
  selectAudienceForVertical,
  generateCampaignName,
  calculateRecommendedBudget,
} from './strategy.js';

const SYSTEM_PROMPT = `You are Adman 📢, the Advertising Agent for Buffy AI - an AI shopping assistant for Shopify D2C brands.

Your primary goal: Run paid advertising campaigns to drive qualified leads to book meetings at ${bookingConfig.calendlyUrl}

## What Buffy AI Does
- AI that answers every product question instantly on product pages
- +23% conversion rate for D2C brands
- +22% average order value
- -45% support tickets
- Real-time intent analytics
- Pricing: Free (100 convos) → $29 → $49 → $99 → Enterprise

## Target Audience
- Shopify store owners
- D2C brand founders (skincare, beauty, supplements, fashion)
- E-commerce marketers
- Regions: US, UK, Australia, India

## Campaign Strategy

### Platform Mix
- Meta (Facebook/Instagram): 60% of budget - visual storytelling, interest targeting
- Google Ads: 40% of budget - high-intent search, competitor keywords

### Campaign Types
1. **Cold Prospecting** (50% budget): Reach new ICP audiences
2. **Retargeting** (30% budget): Re-engage website visitors
3. **Lookalike** (20% budget): Find similar users to converters

### Key Value Props for Ads
1. Conversion: "Turn browsers into buyers" - +23% conversion rate
2. Intelligence: "Know what customers want" - Real-time analytics
3. Revenue: "Boost AOV" - Cross-sell and upsell recommendations
4. Pricing: "Start free, scale fast" - No commitment

### A/B Testing
Always test:
- Headlines (5 variations)
- Primary text hooks
- CTAs (Book Demo vs Start Free vs Learn More)
- Audiences (interests vs lookalike vs retargeting)

### Success Metrics
- Target CPC: <$3 (Meta), <$5 (Google)
- Target CTR: >1.5% (Meta), >3% (Google)
- Target Cost per Lead: <$50

Always optimize for demo bookings, not just clicks.`;

const TOOLS: Tool[] = [
  {
    name: 'create_campaign',
    description: 'Create a new advertising campaign',
    input_schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Platform: meta or google',
        },
        objective: {
          type: 'string',
          description: 'Objective: awareness, consideration, or conversion',
        },
        audience_segment: {
          type: 'string',
          description: 'Target audience segment ID',
        },
        budget_type: {
          type: 'string',
          description: 'Budget type: testing, scaling, or aggressive',
        },
        vertical: {
          type: 'string',
          description: 'Target vertical: skincare, beauty, supplements, fashion, or general',
        },
      },
      required: ['platform', 'objective'],
    },
  },
  {
    name: 'generate_ad_creatives',
    description: 'Generate ad creatives for a campaign',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign to generate creatives for',
        },
        objective: {
          type: 'string',
          description: 'Campaign objective type',
        },
        count: {
          type: 'number',
          description: 'Number of variations to generate',
        },
      },
      required: ['objective'],
    },
  },
  {
    name: 'get_campaign_performance',
    description: 'Get performance metrics for campaigns',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Specific campaign ID, or omit for all campaigns',
        },
        time_period: {
          type: 'string',
          description: 'Time period: today, yesterday, week, month',
        },
      },
    },
  },
  {
    name: 'optimize_campaign',
    description: 'Analyze and optimize campaign performance',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign to optimize',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'pause_campaign',
    description: 'Pause an active campaign',
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
    name: 'setup_ab_test',
    description: 'Set up an A/B test for ad elements',
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign to test',
        },
        test_element: {
          type: 'string',
          description: 'Element to test: headlines, ctas, hooks, or audiences',
        },
        variants: {
          type: 'array',
          items: { type: 'string' },
          description: 'Variants to test',
        },
      },
      required: ['campaign_id', 'test_element'],
    },
  },
  {
    name: 'get_audience_recommendations',
    description: 'Get audience recommendations based on vertical or goal',
    input_schema: {
      type: 'object',
      properties: {
        vertical: {
          type: 'string',
          description: 'Target vertical',
        },
        goal: {
          type: 'string',
          description: 'Campaign goal',
        },
      },
    },
  },
  {
    name: 'calculate_budget',
    description: 'Calculate recommended budget for target leads',
    input_schema: {
      type: 'object',
      properties: {
        target_leads: {
          type: 'number',
          description: 'Number of leads to generate',
        },
        platform: {
          type: 'string',
          description: 'Platform: meta or google',
        },
      },
      required: ['target_leads', 'platform'],
    },
  },
  {
    name: 'get_keyword_recommendations',
    description: 'Get Google Ads keyword recommendations',
    input_schema: {
      type: 'object',
      properties: {
        intent_level: {
          type: 'string',
          description: 'Intent level: high_intent, medium_intent, competitor',
        },
      },
    },
  },
  {
    name: 'create_retargeting_audience',
    description: 'Create a retargeting audience from website visitors',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Audience name',
        },
        source: {
          type: 'string',
          description: 'Source: website_visitors, demo_booked, email_list',
        },
        lookback_days: {
          type: 'number',
          description: 'Days to look back for audience',
        },
      },
      required: ['name', 'source'],
    },
  },
  {
    name: 'get_daily_report',
    description: 'Get daily ads performance report',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

export class AdsAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: 'ads_agent',
      description: 'Manages paid advertising campaigns on Meta and Google',
      systemPrompt: SYSTEM_PROMPT,
      tools: TOOLS,
    };
    super(config);
  }

  protected async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    _context: TaskContext
  ): Promise<string> {
    switch (toolName) {
      case 'create_campaign':
        return this.handleCreateCampaign(input);

      case 'generate_ad_creatives':
        return this.handleGenerateCreatives(input);

      case 'get_campaign_performance':
        return this.handleGetPerformance(
          input.campaign_id as string | undefined,
          input.time_period as string | undefined
        );

      case 'optimize_campaign':
        return this.handleOptimizeCampaign(input.campaign_id as string);

      case 'pause_campaign':
        return this.handlePauseCampaign(
          input.campaign_id as string,
          input.reason as string | undefined
        );

      case 'setup_ab_test':
        return this.handleSetupABTest(input);

      case 'get_audience_recommendations':
        return this.handleGetAudienceRecommendations(
          input.vertical as string | undefined,
          input.goal as string | undefined
        );

      case 'calculate_budget':
        return this.handleCalculateBudget(
          input.target_leads as number,
          input.platform as 'meta' | 'google'
        );

      case 'get_keyword_recommendations':
        return this.handleGetKeywordRecommendations(input.intent_level as string | undefined);

      case 'create_retargeting_audience':
        return this.handleCreateRetargetingAudience(input);

      case 'get_daily_report':
        return this.handleGetDailyReport();

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  private async handleCreateCampaign(input: Record<string, unknown>): Promise<string> {
    const platform = input.platform as string;
    const objective = input.objective as string;
    const vertical = (input.vertical as string) || 'general';
    const budgetType = (input.budget_type as string) || 'testing';

    // Get audience recommendations
    const audienceIds = selectAudienceForVertical(vertical);
    const audiences = audienceIds.map(id => AUDIENCE_SEGMENTS[id as keyof typeof AUDIENCE_SEGMENTS]);

    // Get budget
    const budget = BUDGET_RECOMMENDATIONS[budgetType as keyof typeof BUDGET_RECOMMENDATIONS];

    // Generate campaign name
    const campaignName = generateCampaignName(platform, objective, audienceIds[0]);

    // Get ad templates
    const templates = AD_TEMPLATES[objective as keyof typeof AD_TEMPLATES] || AD_TEMPLATES.conversion;

    // Create campaign in database
    const result = await query(
      `INSERT INTO ad_campaigns
       (name, platform, objective, budget_daily, budget_total, status, targeting, created_at)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, NOW())
       RETURNING id`,
      [
        campaignName,
        platform,
        objective,
        budget.daily,
        budget.daily * budget.duration,
        JSON.stringify({ audiences: audienceIds, vertical }),
      ]
    );

    const campaignId = result.rows[0]?.id;

    // Log event
    await this.logEvent('campaign_created', null, campaignId, {
      platform,
      objective,
      vertical,
      budget: budget.daily,
    });

    return JSON.stringify({
      success: true,
      campaign: {
        id: campaignId,
        name: campaignName,
        platform,
        objective,
        budget: {
          daily: budget.daily,
          total: budget.daily * budget.duration,
          duration: budget.duration,
          description: budget.description,
        },
        audiences: audiences.map(a => ({
          name: a.name,
          interests: a.interests,
          description: a.description,
        })),
        suggestedCreatives: templates.slice(0, 2),
        nextSteps: [
          'Review and customize ad creatives',
          'Set up conversion tracking',
          'Define daily budget caps',
          'Launch campaign',
        ],
      },
    }, null, 2);
  }

  private async handleGenerateCreatives(input: Record<string, unknown>): Promise<string> {
    const objective = (input.objective as string) || 'conversion';
    const count = (input.count as number) || 3;

    const templates = AD_TEMPLATES[objective as keyof typeof AD_TEMPLATES] || AD_TEMPLATES.conversion;

    // Generate variations using A/B test elements
    const creatives = [];

    for (let i = 0; i < count; i++) {
      const headlineIndex = i % AB_TEST_ELEMENTS.headlines.length;
      const ctaIndex = i % AB_TEST_ELEMENTS.ctas.length;
      const hookIndex = i % AB_TEST_ELEMENTS.hooks.length;

      const baseTemplate = templates[i % templates.length];

      creatives.push({
        variation: i + 1,
        headline: AB_TEST_ELEMENTS.headlines[headlineIndex],
        primaryText: `${AB_TEST_ELEMENTS.hooks[hookIndex]}

${baseTemplate.primaryText}`,
        callToAction: AB_TEST_ELEMENTS.ctas[ctaIndex],
        destinationUrl: bookingConfig.calendlyUrl,
        recommendedFormat: i === 0 ? 'image' : i === 1 ? 'carousel' : 'video',
      });
    }

    return JSON.stringify({
      objective,
      creatives,
      recommendations: [
        'Test image vs video formats',
        'Use social proof in primary text',
        'Include stats (+23%, -45%) for credibility',
        'Keep headlines under 40 characters',
        'Use urgency without being pushy',
      ],
    }, null, 2);
  }

  private async handleGetPerformance(campaignId?: string, timePeriod?: string): Promise<string> {
    const interval = timePeriod === 'today' ? '1 day'
      : timePeriod === 'yesterday' ? '2 days'
      : timePeriod === 'month' ? '30 days'
      : '7 days';

    let queryText: string;
    let params: unknown[];

    if (campaignId) {
      queryText = `
        SELECT
          ac.id, ac.name, ac.platform, ac.objective, ac.status,
          ac.budget_daily, ac.budget_total,
          COALESCE(SUM(am.impressions), 0) as impressions,
          COALESCE(SUM(am.clicks), 0) as clicks,
          COALESCE(SUM(am.conversions), 0) as conversions,
          COALESCE(SUM(am.spend), 0) as spend
        FROM ad_campaigns ac
        LEFT JOIN ad_metrics am ON ac.id = am.campaign_id
          AND am.date > NOW() - INTERVAL '${interval}'
        WHERE ac.id = $1
        GROUP BY ac.id`;
      params = [campaignId];
    } else {
      queryText = `
        SELECT
          ac.id, ac.name, ac.platform, ac.objective, ac.status,
          ac.budget_daily, ac.budget_total,
          COALESCE(SUM(am.impressions), 0) as impressions,
          COALESCE(SUM(am.clicks), 0) as clicks,
          COALESCE(SUM(am.conversions), 0) as conversions,
          COALESCE(SUM(am.spend), 0) as spend
        FROM ad_campaigns ac
        LEFT JOIN ad_metrics am ON ac.id = am.campaign_id
          AND am.date > NOW() - INTERVAL '${interval}'
        WHERE ac.status = 'active'
        GROUP BY ac.id
        ORDER BY spend DESC`;
      params = [];
    }

    const result = await query(queryText, params);

    const campaigns = result.rows.map(row => {
      const clicks = parseInt(row.clicks) || 0;
      const impressions = parseInt(row.impressions) || 0;
      const conversions = parseInt(row.conversions) || 0;
      const spend = parseFloat(row.spend) || 0;

      return {
        id: row.id,
        name: row.name,
        platform: row.platform,
        objective: row.objective,
        status: row.status,
        budget: {
          daily: row.budget_daily,
          total: row.budget_total,
        },
        metrics: {
          impressions,
          clicks,
          ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '0%',
          conversions,
          conversionRate: clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) + '%' : '0%',
          spend: `$${spend.toFixed(2)}`,
          cpc: clicks > 0 ? `$${(spend / clicks).toFixed(2)}` : '$0',
          costPerConversion: conversions > 0 ? `$${(spend / conversions).toFixed(2)}` : 'N/A',
        },
      };
    });

    return JSON.stringify({
      period: interval,
      campaigns,
      summary: {
        totalSpend: `$${campaigns.reduce((sum, c) => sum + parseFloat(c.metrics.spend.replace('$', '')), 0).toFixed(2)}`,
        totalConversions: campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0),
        avgCtr: campaigns.length > 0
          ? (campaigns.reduce((sum, c) => sum + parseFloat(c.metrics.ctr), 0) / campaigns.length).toFixed(2) + '%'
          : '0%',
      },
    }, null, 2);
  }

  private async handleOptimizeCampaign(campaignId: string): Promise<string> {
    // Get campaign performance
    const perfResult = await query(
      `SELECT
        ac.platform, ac.objective, ac.budget_daily,
        COALESCE(SUM(am.impressions), 0) as impressions,
        COALESCE(SUM(am.clicks), 0) as clicks,
        COALESCE(SUM(am.conversions), 0) as conversions,
        COALESCE(SUM(am.spend), 0) as spend
       FROM ad_campaigns ac
       LEFT JOIN ad_metrics am ON ac.id = am.campaign_id AND am.date > NOW() - INTERVAL '7 days'
       WHERE ac.id = $1
       GROUP BY ac.id`,
      [campaignId]
    );

    if (perfResult.rows.length === 0) {
      return `Campaign not found: ${campaignId}`;
    }

    const perf = perfResult.rows[0];
    const platform = perf.platform as 'meta' | 'google';
    const benchmarks = BENCHMARK_METRICS[platform];

    const clicks = parseInt(perf.clicks) || 0;
    const impressions = parseInt(perf.impressions) || 0;
    const conversions = parseInt(perf.conversions) || 0;
    const spend = parseFloat(perf.spend) || 0;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
    const costPerLead = conversions > 0 ? spend / conversions : 0;

    const recommendations = [];

    // CTR analysis
    if (ctr < benchmarks.ctr) {
      recommendations.push({
        issue: 'Low CTR',
        current: `${ctr.toFixed(2)}%`,
        benchmark: `${benchmarks.ctr}%`,
        action: 'Test new headlines and ad creatives. Consider using more compelling hooks.',
        priority: 'high',
      });
    }

    // CPC analysis
    if (cpc > benchmarks.cpc) {
      recommendations.push({
        issue: 'High CPC',
        current: `$${cpc.toFixed(2)}`,
        benchmark: `$${benchmarks.cpc}`,
        action: 'Narrow audience targeting or improve ad relevance score.',
        priority: 'medium',
      });
    }

    // Conversion rate analysis
    if (conversionRate < benchmarks.conversionRate) {
      recommendations.push({
        issue: 'Low Conversion Rate',
        current: `${conversionRate.toFixed(2)}%`,
        benchmark: `${benchmarks.conversionRate}%`,
        action: 'Review landing page experience. Ensure Calendly link is prominent.',
        priority: 'high',
      });
    }

    // Cost per lead analysis
    if (costPerLead > benchmarks.costPerLead) {
      recommendations.push({
        issue: 'High Cost per Lead',
        current: `$${costPerLead.toFixed(2)}`,
        benchmark: `$${benchmarks.costPerLead}`,
        action: 'Scale back underperforming ad sets. Focus budget on top performers.',
        priority: 'high',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        issue: 'None',
        current: 'Meeting benchmarks',
        benchmark: 'N/A',
        action: 'Consider scaling budget by 20% to capture more leads.',
        priority: 'low',
      });
    }

    return JSON.stringify({
      campaignId,
      currentPerformance: {
        ctr: `${ctr.toFixed(2)}%`,
        cpc: `$${cpc.toFixed(2)}`,
        conversionRate: `${conversionRate.toFixed(2)}%`,
        costPerLead: conversions > 0 ? `$${costPerLead.toFixed(2)}` : 'N/A',
      },
      benchmarks: {
        ctr: `${benchmarks.ctr}%`,
        cpc: `$${benchmarks.cpc}`,
        conversionRate: `${benchmarks.conversionRate}%`,
        costPerLead: `$${benchmarks.costPerLead}`,
      },
      recommendations,
    }, null, 2);
  }

  private async handlePauseCampaign(campaignId: string, reason?: string): Promise<string> {
    await query(
      `UPDATE ad_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );

    await this.logEvent('campaign_paused', null, campaignId, { reason });

    return JSON.stringify({
      success: true,
      campaignId,
      status: 'paused',
      reason: reason || 'No reason provided',
    });
  }

  private async handleSetupABTest(input: Record<string, unknown>): Promise<string> {
    const campaignId = input.campaign_id as string;
    const testElement = input.test_element as string;
    let variants = input.variants as string[] | undefined;

    if (!variants || variants.length === 0) {
      // Use default variants from strategy
      variants = AB_TEST_ELEMENTS[testElement as keyof typeof AB_TEST_ELEMENTS] as string[] || [];
    }

    // Create test record
    const result = await query(
      `INSERT INTO ab_tests
       (campaign_id, test_element, variants, status, created_at)
       VALUES ($1, $2, $3, 'active', NOW())
       RETURNING id`,
      [campaignId, testElement, JSON.stringify(variants)]
    );

    return JSON.stringify({
      success: true,
      testId: result.rows[0]?.id,
      campaignId,
      testElement,
      variants,
      recommendations: [
        'Run test for at least 7 days',
        'Ensure minimum 100 conversions per variant',
        'Monitor statistical significance before concluding',
      ],
    }, null, 2);
  }

  private async handleGetAudienceRecommendations(vertical?: string, _goal?: string): Promise<string> {
    if (vertical) {
      const audienceIds = selectAudienceForVertical(vertical);
      const audiences = audienceIds.map(id => AUDIENCE_SEGMENTS[id as keyof typeof AUDIENCE_SEGMENTS]);

      return JSON.stringify({
        vertical,
        recommendedAudiences: audiences,
        additionalSuggestions: [
          'Create lookalike audience from email list',
          'Retarget website visitors (last 30 days)',
          'Test competitor brand interests',
        ],
      }, null, 2);
    }

    return JSON.stringify({
      allAudiences: Object.entries(AUDIENCE_SEGMENTS).map(([id, audience]) => ({
        id,
        ...audience,
      })),
      campaignTypes: CAMPAIGN_TYPES,
    }, null, 2);
  }

  private async handleCalculateBudget(
    targetLeads: number,
    platform: 'meta' | 'google'
  ): Promise<string> {
    const budget = calculateRecommendedBudget(targetLeads, platform);

    return JSON.stringify({
      targetLeads,
      platform,
      recommendation: {
        dailyBudget: `$${budget.daily}`,
        totalBudget: `$${budget.total}`,
        duration: `${budget.duration} days`,
        expectedCostPerLead: `$${BENCHMARK_METRICS[platform].costPerLead}`,
      },
      budgetTiers: BUDGET_RECOMMENDATIONS,
      note: 'Actual results may vary. Monitor and optimize weekly.',
    }, null, 2);
  }

  private async handleGetKeywordRecommendations(intentLevel?: string): Promise<string> {
    if (intentLevel && GOOGLE_AD_KEYWORDS[intentLevel as keyof typeof GOOGLE_AD_KEYWORDS]) {
      return JSON.stringify({
        intentLevel,
        keywords: GOOGLE_AD_KEYWORDS[intentLevel as keyof typeof GOOGLE_AD_KEYWORDS],
        negativeKeywords: GOOGLE_AD_KEYWORDS.negative,
        bidStrategy: intentLevel === 'high_intent' ? 'Target CPA' : 'Maximize Conversions',
      }, null, 2);
    }

    return JSON.stringify({
      allKeywords: GOOGLE_AD_KEYWORDS,
      recommendations: [
        'Start with high_intent keywords for best ROI',
        'Add competitor keywords for brand awareness',
        'Always use negative keywords to filter junk traffic',
      ],
    }, null, 2);
  }

  private async handleCreateRetargetingAudience(input: Record<string, unknown>): Promise<string> {
    const name = input.name as string;
    const source = input.source as string;
    const lookbackDays = (input.lookback_days as number) || 30;

    // Create audience record
    const result = await query(
      `INSERT INTO ad_audiences
       (name, type, source, lookback_days, status, created_at)
       VALUES ($1, 'retargeting', $2, $3, 'building', NOW())
       RETURNING id`,
      [name, source, lookbackDays]
    );

    return JSON.stringify({
      success: true,
      audienceId: result.rows[0]?.id,
      name,
      source,
      lookbackDays,
      status: 'building',
      estimatedSize: 'Will be available in 24-48 hours',
      nextSteps: [
        'Wait for audience to build',
        'Create campaign targeting this audience',
        'Set up lookalike based on this audience',
      ],
    }, null, 2);
  }

  private async handleGetDailyReport(): Promise<string> {
    // Get all active campaigns performance for today
    const result = await query(
      `SELECT
        ac.id, ac.name, ac.platform, ac.budget_daily,
        COALESCE(SUM(am.impressions), 0) as impressions,
        COALESCE(SUM(am.clicks), 0) as clicks,
        COALESCE(SUM(am.conversions), 0) as conversions,
        COALESCE(SUM(am.spend), 0) as spend
       FROM ad_campaigns ac
       LEFT JOIN ad_metrics am ON ac.id = am.campaign_id
         AND am.date = CURRENT_DATE
       WHERE ac.status = 'active'
       GROUP BY ac.id`
    );

    const campaigns = result.rows;

    const totalSpend = campaigns.reduce((sum, c) => sum + parseFloat(c.spend || '0'), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + parseInt(c.conversions || '0'), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + parseInt(c.clicks || '0'), 0);

    return JSON.stringify({
      date: new Date().toISOString().split('T')[0],
      summary: {
        activeCampaigns: campaigns.length,
        totalSpend: `$${totalSpend.toFixed(2)}`,
        totalConversions,
        totalClicks,
        avgCostPerConversion: totalConversions > 0
          ? `$${(totalSpend / totalConversions).toFixed(2)}`
          : 'N/A',
      },
      campaigns: campaigns.map(c => ({
        name: c.name,
        platform: c.platform,
        spend: `$${parseFloat(c.spend || '0').toFixed(2)}`,
        conversions: parseInt(c.conversions || '0'),
        budgetUtilization: `${((parseFloat(c.spend || '0') / parseFloat(c.budget_daily || '1')) * 100).toFixed(0)}%`,
      })),
      recommendations: totalConversions === 0
        ? ['Review ad creatives', 'Check landing page', 'Consider expanding audiences']
        : totalSpend / totalConversions > 60
        ? ['Optimize for lower CPA', 'Pause underperforming ads']
        : ['Performance on track', 'Consider scaling budget'],
    }, null, 2);
  }

  protected buildPromptFromPayload(payload: Record<string, unknown>): string {
    if (payload.action === 'create_campaign') {
      return `Create a new advertising campaign:
Platform: ${payload.platform || 'meta'}
Objective: ${payload.objective || 'conversion'}
Vertical: ${payload.vertical || 'general'}

Tasks:
1. Create the campaign with appropriate targeting
2. Generate initial ad creatives
3. Set up budget based on goals
4. Return campaign details and next steps`;
    }

    if (payload.action === 'daily_optimization') {
      return `Run daily optimization across all active campaigns:

Tasks:
1. Get performance for all active campaigns
2. Identify underperforming campaigns
3. Generate optimization recommendations
4. Report findings`;
    }

    if (payload.action === 'launch_ab_test') {
      return `Set up an A/B test:
Campaign: ${payload.campaign_id}
Test Element: ${payload.test_element}

Tasks:
1. Create test variants
2. Set up tracking
3. Define success metrics`;
    }

    return JSON.stringify(payload, null, 2);
  }
}

// Export singleton
export const adsAgent = new AdsAgent();
