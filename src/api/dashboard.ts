import { Router } from 'express';
import { query } from '../db/client.js';
import { getAgentDisplayName, AGENT_PERSONAS } from '../config/agents.js';

const router = Router();

// =====================
// OVERVIEW METRICS
// =====================

router.get('/overview', async (_req, res) => {
  // Default values when database isn't ready
  const defaultPipeline = {
    total_leads: 0,
    new: 0,
    researched: 0,
    contacted: 0,
    engaged: 0,
    meeting_booked: 0,
    closed_won: 0,
    closed_lost: 0,
  };

  const defaultToday = {
    new_leads: 0,
    emails_sent: 0,
    linkedin_requests: 0,
    content_created: 0,
  };

  const defaultFunnel = {
    hot_leads: 0,
    warm_leads: 0,
    cold_leads: 0,
    unscored: 0,
  };

  try {
    // Pipeline summary
    const pipeline = await query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'new') as new,
        COUNT(*) FILTER (WHERE status = 'researched') as researched,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
        COUNT(*) FILTER (WHERE status = 'engaged') as engaged,
        COUNT(*) FILTER (WHERE status = 'meeting_booked') as meeting_booked,
        COUNT(*) FILTER (WHERE status = 'closed_won') as closed_won,
        COUNT(*) FILTER (WHERE status = 'closed_lost') as closed_lost
      FROM leads
    `);

    // Today's activity
    const today = await query(`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE created_at > NOW() - INTERVAL '24 hours') as new_leads,
        (SELECT COUNT(*) FROM email_logs WHERE created_at > NOW() - INTERVAL '24 hours') as emails_sent,
        (SELECT COUNT(*) FROM linkedin_campaigns WHERE created_at > NOW() - INTERVAL '24 hours') as linkedin_requests,
        (SELECT COUNT(*) FROM content_pieces WHERE created_at > NOW() - INTERVAL '24 hours') as content_created
    `);

    // Conversion funnel
    const funnel = await query(`
      SELECT
        COUNT(*) FILTER (WHERE total_score >= 70) as hot_leads,
        COUNT(*) FILTER (WHERE total_score >= 50 AND total_score < 70) as warm_leads,
        COUNT(*) FILTER (WHERE total_score > 0 AND total_score < 50) as cold_leads,
        COUNT(*) FILTER (WHERE total_score = 0) as unscored
      FROM leads
      WHERE status NOT IN ('closed_won', 'closed_lost')
    `);

    res.json({
      pipeline: pipeline.rows[0] || defaultPipeline,
      today: today.rows[0] || defaultToday,
      funnel: funnel.rows[0] || defaultFunnel,
    });
  } catch (error) {
    // Return default values if database isn't ready
    console.log('Database not ready, returning defaults:', error);
    res.json({
      pipeline: defaultPipeline,
      today: defaultToday,
      funnel: defaultFunnel,
    });
  }
});

// =====================
// SCOUT (Lead Research) METRICS
// =====================

router.get('/agents/scout', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    const metrics = await query(`
      SELECT
        COUNT(*) as companies_scanned,
        COUNT(*) FILTER (WHERE platform = 'shopify') as shopify_stores,
        COUNT(*) FILTER (WHERE has_shopping_assistant = false) as no_assistant,
        COUNT(*) FILTER (WHERE has_shopping_assistant = true) as has_assistant,
        COUNT(*) FILTER (WHERE enriched_at IS NOT NULL) as enriched,
        AVG(monthly_traffic) FILTER (WHERE monthly_traffic > 0) as avg_traffic
      FROM companies
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    const leads_created = await query(`
      SELECT COUNT(*) as count
      FROM leads
      WHERE created_at > NOW() - INTERVAL '${interval}'
        AND source = 'lead_research_agent'
    `);

    const by_region = await query(`
      SELECT region, COUNT(*) as count
      FROM companies
      WHERE created_at > NOW() - INTERVAL '${interval}'
        AND region IS NOT NULL
      GROUP BY region
      ORDER BY count DESC
    `);

    const tasks = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
      FROM agent_tasks
      WHERE agent_type = 'lead_research'
        AND created_at > NOW() - INTERVAL '${interval}'
    `);

    res.json({
      agent: getAgentDisplayName('lead_research'),
      persona: AGENT_PERSONAS.lead_research,
      period: interval,
      metrics: {
        ...metrics.rows[0],
        leads_created: leads_created.rows[0].count,
        qualification_rate: metrics.rows[0].companies_scanned > 0
          ? ((metrics.rows[0].no_assistant / metrics.rows[0].companies_scanned) * 100).toFixed(1) + '%'
          : '0%',
      },
      by_region: by_region.rows,
      tasks: tasks.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Scout metrics' });
  }
});

// =====================
// JUDGE (Lead Scoring) METRICS
// =====================

router.get('/agents/judge', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    const metrics = await query(`
      SELECT
        COUNT(*) as leads_scored,
        AVG(icp_score) as avg_icp_score,
        AVG(intent_score) as avg_intent_score,
        AVG(total_score) as avg_total_score,
        COUNT(*) FILTER (WHERE total_score >= 70) as hot_leads,
        COUNT(*) FILTER (WHERE total_score >= 50 AND total_score < 70) as warm_leads,
        COUNT(*) FILTER (WHERE total_score < 50) as cold_leads
      FROM leads
      WHERE updated_at > NOW() - INTERVAL '${interval}'
        AND icp_score > 0
    `);

    const score_distribution = await query(`
      SELECT
        CASE
          WHEN total_score >= 90 THEN '90-100'
          WHEN total_score >= 80 THEN '80-89'
          WHEN total_score >= 70 THEN '70-79'
          WHEN total_score >= 60 THEN '60-69'
          WHEN total_score >= 50 THEN '50-59'
          WHEN total_score >= 40 THEN '40-49'
          ELSE '0-39'
        END as range,
        COUNT(*) as count
      FROM leads
      WHERE icp_score > 0
      GROUP BY range
      ORDER BY range DESC
    `);

    const tasks = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
      FROM agent_tasks
      WHERE agent_type = 'lead_scoring'
        AND created_at > NOW() - INTERVAL '${interval}'
    `);

    res.json({
      agent: getAgentDisplayName('lead_scoring'),
      persona: AGENT_PERSONAS.lead_scoring,
      period: interval,
      metrics: metrics.rows[0],
      score_distribution: score_distribution.rows,
      tasks: tasks.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Judge metrics' });
  }
});

// =====================
// MAILMAN (Email) METRICS
// =====================

router.get('/agents/mailman', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    const metrics = await query(`
      SELECT
        COUNT(*) as emails_sent,
        COUNT(*) FILTER (WHERE status = 'opened') as opened,
        COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
        COUNT(*) FILTER (WHERE status = 'replied') as replied,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed
      FROM email_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    const campaigns = await query(`
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'paused') as paused
      FROM email_campaigns
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    const by_template = await query(`
      SELECT template_id, COUNT(*) as sent,
        COUNT(*) FILTER (WHERE status = 'opened') as opened,
        COUNT(*) FILTER (WHERE status = 'replied') as replied
      FROM email_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
        AND template_id IS NOT NULL
      GROUP BY template_id
      ORDER BY sent DESC
    `);

    const m = metrics.rows[0];
    const sent = parseInt(m.emails_sent) || 1;

    res.json({
      agent: getAgentDisplayName('email'),
      persona: AGENT_PERSONAS.email,
      period: interval,
      metrics: {
        ...m,
        open_rate: ((parseInt(m.opened) / sent) * 100).toFixed(1) + '%',
        click_rate: ((parseInt(m.clicked) / sent) * 100).toFixed(1) + '%',
        reply_rate: ((parseInt(m.replied) / sent) * 100).toFixed(1) + '%',
        bounce_rate: ((parseInt(m.bounced) / sent) * 100).toFixed(1) + '%',
      },
      campaigns: campaigns.rows[0],
      by_template: by_template.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Mailman metrics' });
  }
});

// =====================
// LINCOLN (LinkedIn) METRICS
// =====================

router.get('/agents/lincoln', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    const metrics = await query(`
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE connection_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE connection_status = 'connected') as connected,
        COUNT(*) FILTER (WHERE connection_status = 'declined') as declined,
        SUM(messages_sent) as total_dms_sent,
        SUM(messages_received) as total_replies
      FROM linkedin_campaigns
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    const messages = await query(`
      SELECT
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE message_type = 'connection_request') as connection_requests,
        COUNT(*) FILTER (WHERE message_type = 'dm') as dms
      FROM linkedin_messages
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    const m = metrics.rows[0];
    const total = parseInt(m.total_campaigns) || 1;

    res.json({
      agent: getAgentDisplayName('linkedin'),
      persona: AGENT_PERSONAS.linkedin,
      period: interval,
      metrics: {
        ...m,
        connection_rate: ((parseInt(m.connected) / total) * 100).toFixed(1) + '%',
        response_rate: m.total_dms_sent > 0
          ? ((parseInt(m.total_replies) / parseInt(m.total_dms_sent)) * 100).toFixed(1) + '%'
          : '0%',
      },
      messages: messages.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Lincoln metrics' });
  }
});

// =====================
// SCRIBE (Content) METRICS
// =====================

router.get('/agents/scribe', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    const metrics = await query(`
      SELECT
        COUNT(*) as total_pieces,
        COUNT(*) FILTER (WHERE type = 'blog') as blogs,
        COUNT(*) FILTER (WHERE type = 'linkedin_post') as linkedin_posts,
        COUNT(*) FILTER (WHERE type = 'case_study') as case_studies,
        COUNT(*) FILTER (WHERE type = 'email_template') as email_templates,
        COUNT(*) FILTER (WHERE type = 'proposal') as proposals,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as drafts,
        SUM(views) as total_views
      FROM content_pieces
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    const recent = await query(`
      SELECT id, type, title, status, created_at
      FROM content_pieces
      WHERE created_at > NOW() - INTERVAL '${interval}'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      agent: getAgentDisplayName('content'),
      persona: AGENT_PERSONAS.content,
      period: interval,
      metrics: metrics.rows[0],
      recent_content: recent.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Scribe metrics' });
  }
});

// =====================
// CAPTAIN (Orchestrator) METRICS
// =====================

router.get('/agents/captain', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    // Agent task health
    const agent_health = await query(`
      SELECT
        agent_type,
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
      FROM agent_tasks
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY agent_type
    `);

    // Pipeline velocity
    const velocity = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new' AND created_at > NOW() - INTERVAL '${interval}') as new_today,
        COUNT(*) FILTER (WHERE status = 'contacted' AND stage_changed_at > NOW() - INTERVAL '${interval}') as contacted_today,
        COUNT(*) FILTER (WHERE status = 'engaged' AND stage_changed_at > NOW() - INTERVAL '${interval}') as engaged_today,
        COUNT(*) FILTER (WHERE status = 'meeting_booked' AND stage_changed_at > NOW() - INTERVAL '${interval}') as meetings_today
      FROM leads
    `);

    // Escalations
    const escalations = await query(`
      SELECT COUNT(*) as count, properties->>'urgency' as urgency
      FROM analytics_events
      WHERE event_type = 'escalation'
        AND created_at > NOW() - INTERVAL '${interval}'
      GROUP BY properties->>'urgency'
    `);

    res.json({
      agent: getAgentDisplayName('orchestrator'),
      persona: AGENT_PERSONAS.orchestrator,
      period: interval,
      agent_health: agent_health.rows.map(row => ({
        ...row,
        agent_name: getAgentDisplayName(row.agent_type),
        completion_rate: row.total_tasks > 0
          ? ((row.completed / row.total_tasks) * 100).toFixed(1) + '%'
          : '0%',
      })),
      velocity: velocity.rows[0],
      escalations: escalations.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Captain metrics' });
  }
});

// =====================
// CHIEF (Leader) METRICS
// =====================

router.get('/agents/chief', async (req, res) => {
  try {
    // Recent reviews
    const reviews = await query(`
      SELECT properties, created_at
      FROM analytics_events
      WHERE event_type = 'daily_review'
      ORDER BY created_at DESC
      LIMIT 7
    `);

    // Goals set
    const goals = await query(`
      SELECT agent_type, properties, created_at
      FROM analytics_events
      WHERE event_type = 'goals_set'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Team performance trend (last 7 days)
    const trend = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_tasks
      FROM agent_tasks
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    res.json({
      agent: getAgentDisplayName('leader'),
      persona: AGENT_PERSONAS.leader,
      recent_reviews: reviews.rows,
      goals: goals.rows.map(g => ({
        agent: getAgentDisplayName(g.agent_type),
        ...g.properties,
        set_at: g.created_at,
      })),
      performance_trend: trend.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Chief metrics' });
  }
});

// =====================
// ADMAN (Ads) METRICS
// =====================

router.get('/agents/adman', async (req, res) => {
  const { period = 'today' } = req.query;
  const interval = period === 'week' ? '7 days' : period === 'month' ? '30 days' : '1 day';

  try {
    // Campaign metrics
    const campaigns = await query(`
      SELECT
        COUNT(*) as total_campaigns,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'paused') as paused,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE platform = 'meta') as meta_campaigns,
        COUNT(*) FILTER (WHERE platform = 'google') as google_campaigns,
        SUM(budget_daily) as total_daily_budget
      FROM ad_campaigns
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    // Performance metrics
    const performance = await query(`
      SELECT
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(spend) as total_spend
      FROM ad_metrics
      WHERE date > NOW() - INTERVAL '${interval}'
    `);

    // By platform
    const by_platform = await query(`
      SELECT
        ac.platform,
        SUM(am.impressions) as impressions,
        SUM(am.clicks) as clicks,
        SUM(am.conversions) as conversions,
        SUM(am.spend) as spend
      FROM ad_campaigns ac
      LEFT JOIN ad_metrics am ON ac.id = am.campaign_id
        AND am.date > NOW() - INTERVAL '${interval}'
      WHERE ac.status = 'active'
      GROUP BY ac.platform
    `);

    // A/B tests
    const ab_tests = await query(`
      SELECT
        COUNT(*) as total_tests,
        COUNT(*) FILTER (WHERE status = 'active') as active_tests,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tests
      FROM ab_tests
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `);

    // Top performing campaigns
    const top_campaigns = await query(`
      SELECT
        ac.id, ac.name, ac.platform, ac.objective,
        SUM(am.conversions) as conversions,
        SUM(am.spend) as spend,
        CASE WHEN SUM(am.conversions) > 0
          THEN SUM(am.spend) / SUM(am.conversions)
          ELSE 0
        END as cpa
      FROM ad_campaigns ac
      LEFT JOIN ad_metrics am ON ac.id = am.campaign_id
        AND am.date > NOW() - INTERVAL '${interval}'
      WHERE ac.status = 'active'
      GROUP BY ac.id
      ORDER BY conversions DESC NULLS LAST
      LIMIT 5
    `);

    const p = performance.rows[0];
    const totalClicks = parseInt(p?.total_clicks) || 0;
    const totalImpressions = parseInt(p?.total_impressions) || 0;
    const totalConversions = parseInt(p?.total_conversions) || 0;
    const totalSpend = parseFloat(p?.total_spend) || 0;

    res.json({
      agent: getAgentDisplayName('ads'),
      persona: AGENT_PERSONAS.ads,
      period: interval,
      campaigns: campaigns.rows[0],
      metrics: {
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        spend: `$${totalSpend.toFixed(2)}`,
        ctr: totalImpressions > 0
          ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%'
          : '0%',
        conversion_rate: totalClicks > 0
          ? ((totalConversions / totalClicks) * 100).toFixed(2) + '%'
          : '0%',
        cpc: totalClicks > 0
          ? `$${(totalSpend / totalClicks).toFixed(2)}`
          : '$0',
        cpa: totalConversions > 0
          ? `$${(totalSpend / totalConversions).toFixed(2)}`
          : 'N/A',
      },
      by_platform: by_platform.rows.map(row => ({
        ...row,
        ctr: parseInt(row.impressions) > 0
          ? ((parseInt(row.clicks) / parseInt(row.impressions)) * 100).toFixed(2) + '%'
          : '0%',
        cpa: parseInt(row.conversions) > 0
          ? `$${(parseFloat(row.spend) / parseInt(row.conversions)).toFixed(2)}`
          : 'N/A',
      })),
      ab_tests: ab_tests.rows[0],
      top_campaigns: top_campaigns.rows.map(c => ({
        ...c,
        cpa: `$${parseFloat(c.cpa || 0).toFixed(2)}`,
        spend: `$${parseFloat(c.spend || 0).toFixed(2)}`,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get Adman metrics' });
  }
});

// =====================
// RAW DATA VIEWS
// =====================

// Helper to build date filter clause
const buildDateFilter = (startDate: string | undefined, endDate: string | undefined, dateColumn: string, params: unknown[], paramIndex: number): { clause: string; newIndex: number } => {
  let clause = '';
  if (startDate) {
    clause += ` AND ${dateColumn} >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }
  if (endDate) {
    clause += ` AND ${dateColumn} <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }
  return { clause, newIndex: paramIndex };
};

// All companies
router.get('/data/companies', async (req, res) => {
  const { limit = 100, offset = 0, agent, startDate, endDate } = req.query;
  try {
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [limit, offset];
    let paramIndex = 3;

    // Agent filter - companies discovered by a specific agent
    if (agent) {
      whereClause += ` AND discovered_by = $${paramIndex}`;
      params.push(agent);
      paramIndex++;
    }

    // Date range filter
    const dateFilter = buildDateFilter(startDate as string, endDate as string, 'created_at', params, paramIndex);
    whereClause += dateFilter.clause;

    const companies = await query(`
      SELECT id, name, domain, platform, region, has_shopping_assistant,
             monthly_traffic, enriched_at, created_at, updated_at, discovered_by
      FROM companies
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    // Count with same filters
    const countParams = params.slice(2);
    let countWhere = whereClause.replace('WHERE 1=1', 'WHERE 1=1').replace(/\$\d+/g, (match) => {
      const num = parseInt(match.slice(1));
      return num > 2 ? `$${num - 2}` : match;
    });
    const countQuery = countParams.length > 0
      ? `SELECT COUNT(*) as total FROM companies ${countWhere}`
      : `SELECT COUNT(*) as total FROM companies`;
    const count = await query(countQuery, countParams);

    res.json({
      data: companies.rows,
      total: parseInt(count.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Failed to get companies:', error);
    res.status(500).json({ error: 'Failed to get companies' });
  }
});

// All leads with details
router.get('/data/leads', async (req, res) => {
  const { limit = 100, offset = 0, status, agent, startDate, endDate } = req.query;
  try {
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [limit, offset];
    let paramIndex = 3;

    // Status filter
    if (status && status !== 'all') {
      whereClause += ` AND l.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Agent filter - leads sourced from a specific agent
    if (agent && agent !== 'all') {
      whereClause += ` AND l.source = $${paramIndex}`;
      params.push(agent);
      paramIndex++;
    }

    // Date range filter
    const dateFilter = buildDateFilter(startDate as string, endDate as string, 'l.created_at', params, paramIndex);
    whereClause += dateFilter.clause;

    const leads = await query(`
      SELECT l.id, l.status, l.source, l.icp_score, l.intent_score, l.total_score,
             l.created_at, l.stage_changed_at, l.last_agent,
             c.email, c.first_name, c.last_name, c.title,
             co.name as company_name, co.domain, co.platform
      FROM leads l
      JOIN contacts c ON l.contact_id = c.id
      JOIN companies co ON l.company_id = co.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    // Count with same filters (excluding limit/offset)
    const countParams = params.slice(2);
    let countWhereClause = whereClause.replace(/\$(\d+)/g, (_, num) => {
      const n = parseInt(num);
      return n > 2 ? `$${n - 2}` : `$${n}`;
    });

    const countQuery = `
      SELECT COUNT(*) as total
      FROM leads l
      JOIN contacts c ON l.contact_id = c.id
      JOIN companies co ON l.company_id = co.id
      ${countWhereClause}
    `;
    const count = await query(countQuery, countParams);

    res.json({
      data: leads.rows,
      total: parseInt(count.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Failed to get leads:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
});

// All agent tasks
router.get('/data/tasks', async (req, res) => {
  const { limit = 100, offset = 0, agent, status, startDate, endDate } = req.query;
  try {
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [limit, offset];
    let paramIndex = 3;

    if (agent && agent !== 'all') {
      whereClause += ` AND agent_type = $${paramIndex}`;
      params.push(agent);
      paramIndex++;
    }
    if (status && status !== 'all') {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Date range filter
    const dateFilter = buildDateFilter(startDate as string, endDate as string, 'created_at', params, paramIndex);
    whereClause += dateFilter.clause;

    const tasks = await query(`
      SELECT id, agent_type, task_type, payload, result, error, status,
             priority, scheduled_for, started_at, completed_at, attempts, created_at
      FROM agent_tasks
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    // Count with same filters
    const countParams = params.slice(2);
    let countWhereClause = whereClause.replace(/\$(\d+)/g, (_, num) => {
      const n = parseInt(num);
      return n > 2 ? `$${n - 2}` : `$${n}`;
    });
    const countQuery = `SELECT COUNT(*) as total FROM agent_tasks ${countWhereClause}`;
    const count = await query(countQuery, countParams);

    res.json({
      data: tasks.rows,
      total: parseInt(count.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Failed to get tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Activity log - unified view of all agent actions
router.get('/data/activity', async (req, res) => {
  const { limit = 100, offset = 0, agent, startDate, endDate } = req.query;
  try {
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [limit, offset];
    let paramIndex = 3;

    if (agent && agent !== 'all') {
      whereClause += ` AND agent_type = $${paramIndex}`;
      params.push(agent);
      paramIndex++;
    }

    // Date range filter
    const dateFilter = buildDateFilter(startDate as string, endDate as string, 'created_at', params, paramIndex);
    whereClause += dateFilter.clause;

    const activities = await query(`
      SELECT
        id,
        agent_type as agent,
        event_type as action,
        COALESCE(
          properties->>'lead_name',
          properties->>'company_name',
          properties->>'target',
          'System'
        ) as target,
        COALESCE(
          properties->>'details',
          properties->>'message',
          properties->>'description',
          ''
        ) as details,
        COALESCE(properties->>'status', 'completed') as status,
        created_at
      FROM analytics_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    // Count with same filters
    const countParams = params.slice(2);
    let countWhereClause = whereClause.replace(/\$(\d+)/g, (_, num) => {
      const n = parseInt(num);
      return n > 2 ? `$${n - 2}` : `$${n}`;
    });
    const countQuery = `SELECT COUNT(*) as total FROM analytics_events ${countWhereClause}`;
    const count = await query(countQuery, countParams);

    res.json({
      data: activities.rows,
      total: parseInt(count.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Failed to get activity:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// Email logs
router.get('/data/emails', async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  try {
    const emails = await query(`
      SELECT el.id, el.lead_id, el.subject, el.status, el.sent_at, el.opened_at, el.clicked_at,
             c.email, c.first_name, co.name as company_name
      FROM email_logs el
      LEFT JOIN leads l ON el.lead_id = l.id
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN companies co ON l.company_id = co.id
      ORDER BY el.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const count = await query(`SELECT COUNT(*) as total FROM email_logs`);

    res.json({
      data: emails.rows,
      total: parseInt(count.rows[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get emails' });
  }
});

// =====================
// REAL-TIME ACTIVITY FEED
// =====================

router.get('/activity', async (req, res) => {
  const { limit = 50 } = req.query;

  try {
    const events = await query(`
      SELECT
        id,
        event_type,
        agent_type,
        lead_id,
        properties,
        created_at
      FROM analytics_events
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(events.rows.map(e => ({
      ...e,
      agent_name: e.agent_type ? getAgentDisplayName(e.agent_type) : null,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

export default router;
