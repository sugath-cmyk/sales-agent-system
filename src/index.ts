import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { checkConnection, query } from './db/client.js';
import { getQueueStats, addJob, queues } from './workers/queue.js';
import dashboardRouter from './api/dashboard.js';

// Import agents for direct API access
import { leadResearchAgent } from './agents/lead-research/index.js';
import { leadScoringAgent } from './agents/lead-scoring/index.js';
import { emailAgent } from './agents/email/index.js';
import { linkedInAgent } from './agents/linkedin/index.js';
import { contentAgent } from './agents/content/index.js';
import { orchestratorAgent } from './agents/orchestrator/index.js';
import { leaderAgent } from './agents/leader/index.js';
import { AGENT_PERSONAS, getAgentDisplayName, CALENDLY_LINK } from './config/agents.js';

const app = express();
app.use(cors());
app.use(express.json());

// Dashboard API routes
app.use('/api/dashboard', dashboardRouter);

// Root route - API welcome page
app.get('/', (_req, res) => {
  res.json({
    name: 'Varyse Sales Agent System',
    version: '1.0.0',
    description: 'Autonomous AI Sales Agents for Shopify Merchant Outreach',
    goal: CALENDLY_LINK,
    team: Object.entries(AGENT_PERSONAS).map(([id, agent]) => ({
      id,
      name: agent.name,
      emoji: agent.emoji,
      role: agent.role,
    })),
    endpoints: {
      dashboard: '/api/dashboard/overview',
      team: '/api/team',
      agents: '/api/agents/status',
      goals: '/api/daily-goals',
      pipeline: '/api/pipeline/funnel',
      evaluations: '/api/evaluations',
      health: '/health',
    },
    frontend: 'http://localhost:5173',
  });
});

// Health check
app.get('/health', async (_req, res) => {
  const dbHealthy = await checkConnection();
  res.json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    team: {
      scout: '🔍 Lead Research',
      judge: '⚖️ Lead Scoring',
      mailman: '📧 Email Outreach',
      lincoln: '💼 LinkedIn',
      scribe: '✍️ Content',
      captain: '🎯 Operations',
      chief: '👔 Performance Leader',
    },
  });
});

// Database migration endpoint (run once to set up tables)
// Support both GET and POST for easy browser access
const runMigration = async (_req: any, res: any) => {
  try {
    // Core tables creation
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE NOT NULL,
        industry VARCHAR(100),
        platform VARCHAR(50),
        employee_count INTEGER,
        estimated_revenue VARCHAR(50),
        region VARCHAR(10),
        has_shopping_assistant BOOLEAN DEFAULT false,
        detected_assistants TEXT[],
        tech_stack JSONB DEFAULT '{}',
        monthly_traffic INTEGER,
        traffic_source VARCHAR(50),
        enriched_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        linkedin_url VARCHAR(500),
        title VARCHAR(255),
        department VARCHAR(100),
        is_decision_maker BOOLEAN DEFAULT false,
        enrichment_source VARCHAR(50),
        enriched_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        icp_score INTEGER DEFAULT 0,
        intent_score INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        score_breakdown JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'new',
        stage_changed_at TIMESTAMP DEFAULT NOW(),
        assigned_agent VARCHAR(50),
        source VARCHAR(100),
        source_details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_sequences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        steps JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_id VARCHAR(100) UNIQUE NOT NULL,
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        variables TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        sequence_id UUID REFERENCES email_sequences(id),
        status VARCHAR(50) DEFAULT 'active',
        current_step INTEGER DEFAULT 0,
        next_send_at TIMESTAMP,
        emails_sent INTEGER DEFAULT 0,
        emails_opened INTEGER DEFAULT 0,
        emails_clicked INTEGER DEFAULT 0,
        emails_replied INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        template_id VARCHAR(100),
        subject VARCHAR(500),
        body TEXT,
        to_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        replied_at TIMESTAMP,
        provider_message_id VARCHAR(255),
        provider_response JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS linkedin_campaigns (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        connection_status VARCHAR(50) DEFAULT 'not_connected',
        connection_sent_at TIMESTAMP,
        connected_at TIMESTAMP,
        dm_sequence_step INTEGER DEFAULT 0,
        last_message_sent_at TIMESTAMP,
        last_message_received_at TIMESTAMP,
        messages_sent INTEGER DEFAULT 0,
        messages_received INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS content_pieces (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        target_industry VARCHAR(100),
        target_persona VARCHAR(100),
        seo_keywords TEXT[],
        meta_description VARCHAR(500),
        status VARCHAR(50) DEFAULT 'draft',
        published_at TIMESTAMP,
        publish_url VARCHAR(500),
        views INTEGER DEFAULT 0,
        engagement_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_type VARCHAR(50) NOT NULL,
        task_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        result JSONB,
        error TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        scheduled_for TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_type VARCHAR(100) NOT NULL,
        agent_type VARCHAR(50),
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        campaign_id UUID,
        properties JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    res.json({
      success: true,
      message: 'Database tables created successfully!',
      tables: ['companies', 'contacts', 'leads', 'email_sequences', 'email_templates', 'email_campaigns', 'email_logs', 'linkedin_campaigns', 'content_pieces', 'agent_tasks', 'analytics_events']
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message || 'Migration failed' });
  }
};

// Register migration route for both GET and POST
app.get('/api/migrate', runMigration);
app.post('/api/migrate', runMigration);

// Seed test data endpoint
app.get('/api/seed-test', async (_req, res) => {
  try {
    const testCompanies = [
      { name: 'Allbirds', domain: 'allbirds.com', platform: 'shopify', region: 'US' },
      { name: 'Bombas', domain: 'bombas.com', platform: 'shopify', region: 'US' },
      { name: 'Brooklinen', domain: 'brooklinen.com', platform: 'shopify', region: 'US' },
      { name: 'Glossier', domain: 'glossier.com', platform: 'shopify', region: 'US' },
      { name: 'MVMT', domain: 'mvmt.com', platform: 'shopify', region: 'US' },
      { name: 'Gymshark', domain: 'gymshark.com', platform: 'shopify', region: 'UK' },
      { name: 'ColourPop', domain: 'colourpop.com', platform: 'shopify', region: 'US' },
      { name: 'Fashion Nova', domain: 'fashionnova.com', platform: 'shopify', region: 'US' },
      { name: 'Kylie Cosmetics', domain: 'kyliecosmetics.com', platform: 'shopify', region: 'US' },
      { name: 'Chubbies', domain: 'chubbiesshorts.com', platform: 'shopify', region: 'US' },
    ];

    // Insert companies
    for (const company of testCompanies) {
      await query(`
        INSERT INTO companies (name, domain, platform, region, has_shopping_assistant, monthly_traffic)
        VALUES ($1, $2, $3, $4, false, $5)
        ON CONFLICT (domain) DO NOTHING
      `, [company.name, company.domain, company.platform, company.region, Math.floor(Math.random() * 500000) + 10000]);
    }

    // Get inserted companies
    const companies = await query(`SELECT id, name, domain FROM companies LIMIT 10`);

    // Create contacts and leads for each company
    for (const company of companies.rows) {
      // Create a contact
      const contactResult = await query(`
        INSERT INTO contacts (company_id, first_name, last_name, email, title, is_decision_maker)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
        RETURNING id
      `, [
        company.id,
        'Founder',
        company.name.split(' ')[0],
        `hello@${company.domain}`,
        'Founder & CEO'
      ]);

      // Create a lead
      await query(`
        INSERT INTO leads (contact_id, company_id, status, source, icp_score, intent_score)
        VALUES ($1, $2, 'new', 'seed_data', $3, $4)
        ON CONFLICT DO NOTHING
      `, [
        contactResult.rows[0]?.id,
        company.id,
        Math.floor(Math.random() * 30) + 50,
        Math.floor(Math.random() * 20) + 10
      ]);
    }

    // Get summary
    const summary = await query(`
      SELECT
        (SELECT COUNT(*) FROM companies) as companies,
        (SELECT COUNT(*) FROM contacts) as contacts,
        (SELECT COUNT(*) FROM leads) as leads
    `);

    res.json({
      success: true,
      message: 'Test data seeded!',
      data: summary.rows[0],
      companies: companies.rows.map(c => c.name)
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Queue stats
app.get('/api/queues', async (_req, res) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// Get failed jobs with error details
app.get('/api/queues/failed', async (_req, res) => {
  try {
    const failedJobs: Record<string, unknown[]> = {};
    for (const [name, queue] of Object.entries(queues)) {
      const jobs = await queue.getFailed(0, 10);
      failedJobs[name] = jobs.map((job: any) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      }));
    }
    res.json(failedJobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get failed jobs' });
  }
});

// =====================
// Lead Research API
// =====================

// Research a single domain
app.post('/api/research/domain', async (req, res) => {
  const { domain } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const job = await addJob('leadResearch', {
      taskId: `research_${Date.now()}`,
      taskType: 'research_domain',
      payload: { domain },
      priority: 7,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue research task' });
  }
});

// Research multiple domains
app.post('/api/research/batch', async (req, res) => {
  const { domains } = req.body;

  if (!domains || !Array.isArray(domains)) {
    return res.status(400).json({ error: 'Domains array is required' });
  }

  try {
    const jobs = await Promise.all(
      domains.map((domain: string) =>
        addJob('leadResearch', {
          taskId: `research_${domain}_${Date.now()}`,
          taskType: 'research_domain',
          payload: { domain },
          priority: 5,
          createdAt: new Date().toISOString(),
        })
      )
    );

    res.json({
      queued: jobs.length,
      jobIds: jobs.map((j) => j.id),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue research tasks' });
  }
});

// =====================
// Lead Scoring API
// =====================

// Score a specific lead
app.post('/api/score/lead/:leadId', async (req, res) => {
  const { leadId } = req.params;

  try {
    const job = await addJob('leadScoring', {
      taskId: `score_${leadId}_${Date.now()}`,
      taskType: 'score_lead',
      payload: { lead_id: leadId },
      priority: 7,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue scoring task' });
  }
});

// Run batch scoring
app.post('/api/score/batch', async (req, res) => {
  const { limit } = req.body;

  try {
    const job = await addJob('leadScoring', {
      taskId: `score_batch_${Date.now()}`,
      taskType: 'score_batch',
      payload: { action: 'score_batch', limit: limit || 50 },
      priority: 5,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue batch scoring' });
  }
});

// =====================
// Email Outreach API
// =====================

// Start email sequence for a lead
app.post('/api/email/start/:leadId', async (req, res) => {
  const { leadId } = req.params;

  try {
    const job = await addJob('email', {
      taskId: `email_start_${leadId}_${Date.now()}`,
      taskType: 'start_sequence',
      payload: { action: 'start_outreach', lead_id: leadId },
      priority: 7,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue email sequence' });
  }
});

// Send next batch of emails
app.post('/api/email/send-batch', async (_req, res) => {
  try {
    const job = await addJob('email', {
      taskId: `email_batch_${Date.now()}`,
      taskType: 'send_batch',
      payload: { action: 'send_next_batch' },
      priority: 8,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue email batch' });
  }
});

// =====================
// LinkedIn API
// =====================

// Start LinkedIn campaign for a lead
app.post('/api/linkedin/start/:leadId', async (req, res) => {
  const { leadId } = req.params;

  try {
    const job = await addJob('linkedin', {
      taskId: `linkedin_start_${leadId}_${Date.now()}`,
      taskType: 'start_campaign',
      payload: { lead_id: leadId },
      priority: 7,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue LinkedIn campaign' });
  }
});

// Send LinkedIn follow-ups
app.post('/api/linkedin/follow-up', async (_req, res) => {
  try {
    const job = await addJob('linkedin', {
      taskId: `linkedin_followup_${Date.now()}`,
      taskType: 'send_followups',
      payload: { action: 'send_followup_dms' },
      priority: 5,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue LinkedIn follow-ups' });
  }
});

// =====================
// Content API
// =====================

// Generate blog post
app.post('/api/content/blog', async (req, res) => {
  const { topic, keywords } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    const job = await addJob('content', {
      taskId: `content_blog_${Date.now()}`,
      taskType: 'generate_blog',
      payload: { action: 'create_blog', topic, keywords },
      priority: 3,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue blog generation' });
  }
});

// Generate LinkedIn posts
app.post('/api/content/linkedin-posts', async (req, res) => {
  const { count } = req.body;

  try {
    const job = await addJob('content', {
      taskId: `content_linkedin_${Date.now()}`,
      taskType: 'batch_linkedin_posts',
      payload: { action: 'batch_linkedin_posts', count: count || 5 },
      priority: 3,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue LinkedIn post generation' });
  }
});

// =====================
// Orchestrator API
// =====================

// Run daily operations
app.post('/api/orchestrator/daily-run', async (_req, res) => {
  try {
    const job = await addJob('orchestrator', {
      taskId: `orchestrator_daily_${Date.now()}`,
      taskType: 'daily_run',
      payload: { action: 'daily_run' },
      priority: 8,
      createdAt: new Date().toISOString(),
    });

    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue daily operations' });
  }
});

// Get pipeline overview
app.get('/api/orchestrator/pipeline', async (_req, res) => {
  try {
    const result = await orchestratorAgent.processTask({
      taskId: 'api_pipeline_overview',
      payload: { action: 'get_pipeline_overview' },
      retryCount: 0,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pipeline overview' });
  }
});

// Get performance report
app.get('/api/orchestrator/performance', async (req, res) => {
  const { period } = req.query;

  try {
    const result = await orchestratorAgent.processTask({
      taskId: 'api_performance',
      payload: { action: 'get_performance_report', time_period: period || 'week' },
      retryCount: 0,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance report' });
  }
});

// =====================
// Leader (Chief) API
// =====================

// Get team roster with names
app.get('/api/team', (_req, res) => {
  const team = Object.entries(AGENT_PERSONAS).map(([id, persona]) => ({
    id,
    name: persona.name,
    displayName: getAgentDisplayName(id),
    role: persona.role,
    channel: persona.channel,
    emoji: persona.emoji,
    kpis: persona.kpis,
  }));
  res.json(team);
});

// Get daily performance review
app.get('/api/leader/daily-review', async (_req, res) => {
  try {
    const review = await leaderAgent.generateDailyReview();
    res.type('text/plain').send(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate daily review' });
  }
});

// Get agent performance
app.get('/api/leader/performance/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { period } = req.query;

  try {
    const result = await leaderAgent.processTask({
      taskId: `api_perf_${agentId}`,
      payload: {
        action: 'get_agent_performance',
        agent_id: agentId,
        time_period: period || 'today',
      },
      retryCount: 0,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get agent performance' });
  }
});

// Trigger daily review (manual)
app.post('/api/leader/trigger-review', async (_req, res) => {
  try {
    const job = await addJob('leader', {
      taskId: `manual_review_${Date.now()}`,
      taskType: 'daily_review',
      payload: { action: 'daily_review' },
      priority: 9,
      createdAt: new Date().toISOString(),
    });
    res.json({ jobId: job.id, status: 'queued' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger review' });
  }
});

// =====================
// Webhook Endpoints
// =====================

// Email tracking webhook (open/click/bounce)
app.post('/api/webhooks/email', async (req, res) => {
  const { event, message_id, timestamp } = req.body;

  console.log(`Email webhook: ${event} for ${message_id}`);

  // Process webhook events (open, click, bounce, etc.)
  // Update email_logs table accordingly

  res.json({ received: true });
});

// LinkedIn webhook (for automation tools)
app.post('/api/webhooks/linkedin', async (req, res) => {
  const { event, campaign_id, data } = req.body;

  console.log(`LinkedIn webhook: ${event} for campaign ${campaign_id}`);

  // Process LinkedIn events (connection accepted, reply received, etc.)

  res.json({ received: true });
});

// =====================
// DAILY GOALS & TRACKING
// =====================

// Get daily goals and progress
app.get('/api/daily-goals', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const dailyGoals = {
    leads_discovered: 50,
    leads_contacted: 30,
    leads_engaged: 10,
    meetings_booked: 3,
  };

  const defaultProgress = {
    leads_discovered: { current: 0, goal: 50, percentage: 0 },
    leads_contacted: { current: 0, goal: 30, percentage: 0 },
    leads_engaged: { current: 0, goal: 10, percentage: 0 },
    meetings_booked: { current: 0, goal: 3, percentage: 0 },
  };

  try {
    // Get today's lead generation stats
    const leadStats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as leads_today,
        COUNT(*) FILTER (WHERE status = 'meeting_booked' AND stage_changed_at::date = CURRENT_DATE) as meetings_today,
        COUNT(*) FILTER (WHERE status = 'engaged' AND stage_changed_at::date = CURRENT_DATE) as engaged_today,
        COUNT(*) FILTER (WHERE status = 'contacted' AND stage_changed_at::date = CURRENT_DATE) as contacted_today
      FROM leads
    `);

    // Get activity by agent
    const agentActivity = await query(`
      SELECT
        agent_type,
        COUNT(*) as tasks_completed,
        COUNT(*) FILTER (WHERE status = 'completed') as successful,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM agent_tasks
      WHERE created_at::date = CURRENT_DATE
      GROUP BY agent_type
    `);

    const stats = leadStats.rows[0] || { leads_today: 0, meetings_today: 0, engaged_today: 0, contacted_today: 0 };
    const progress = {
      leads_discovered: {
        current: parseInt(stats.leads_today) || 0,
        goal: dailyGoals.leads_discovered,
        percentage: Math.min(100, Math.round(((parseInt(stats.leads_today) || 0) / dailyGoals.leads_discovered) * 100)),
      },
      leads_contacted: {
        current: parseInt(stats.contacted_today) || 0,
        goal: dailyGoals.leads_contacted,
        percentage: Math.min(100, Math.round(((parseInt(stats.contacted_today) || 0) / dailyGoals.leads_contacted) * 100)),
      },
      leads_engaged: {
        current: parseInt(stats.engaged_today) || 0,
        goal: dailyGoals.leads_engaged,
        percentage: Math.min(100, Math.round(((parseInt(stats.engaged_today) || 0) / dailyGoals.leads_engaged) * 100)),
      },
      meetings_booked: {
        current: parseInt(stats.meetings_today) || 0,
        goal: dailyGoals.meetings_booked,
        percentage: Math.min(100, Math.round(((parseInt(stats.meetings_today) || 0) / dailyGoals.meetings_booked) * 100)),
      },
    };

    res.json({
      date: today,
      calendlyLink: CALENDLY_LINK,
      progress,
      agentActivity: (agentActivity.rows || []).map(a => ({
        ...a,
        agent_name: getAgentDisplayName(a.agent_type),
      })),
    });
  } catch (error) {
    console.error('Daily goals error:', error);
    res.json({
      date: today,
      calendlyLink: CALENDLY_LINK,
      progress: defaultProgress,
      agentActivity: [],
    });
  }
});

// Get real-time agent status
app.get('/api/agents/status', async (_req, res) => {
  try {
    let queueStats = {};
    try {
      queueStats = await getQueueStats();
    } catch (e) {
      console.log('Queue stats unavailable');
    }

    // Get recent activity for each agent
    let recentActivity = { rows: [] };
    try {
      recentActivity = await query(`
        SELECT
          agent_type,
          MAX(created_at) as last_activity,
          COUNT(*) FILTER (WHERE status = 'processing') as active_tasks
        FROM agent_tasks
        WHERE created_at > NOW() - INTERVAL '1 hour'
        GROUP BY agent_type
      `);
    } catch (e) {
      console.log('Recent activity query failed');
    }

    const agents = Object.entries(AGENT_PERSONAS).map(([id, persona]) => {
      const activity = recentActivity.rows.find(a => a.agent_type === id);
      const queueName = id === 'lead_research' ? 'leadResearch'
        : id === 'lead_scoring' ? 'leadScoring'
        : id;
      const queueStat = queueStats[queueName as keyof typeof queueStats];

      return {
        id,
        name: persona.name,
        emoji: persona.emoji,
        role: persona.role,
        status: activity?.active_tasks > 0 ? 'working' : 'idle',
        lastActivity: activity?.last_activity || null,
        queue: queueStat || { waiting: 0, active: 0, completed: 0, failed: 0 },
        goal: persona.goal,
      };
    });

    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// Get weekly performance trend
app.get('/api/performance/weekly', async (_req, res) => {
  try {
    const weeklyData = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as leads_created,
        COUNT(*) FILTER (WHERE status = 'meeting_booked') as meetings_booked,
        COUNT(*) FILTER (WHERE status = 'engaged') as engaged,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted
      FROM leads
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    res.json(weeklyData.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get weekly performance' });
  }
});

// Get agent evaluations (from Chief)
app.get('/api/evaluations', async (_req, res) => {
  try {
    const evaluations = await query(`
      SELECT
        properties->>'agent_type' as agent_type,
        properties->>'evaluation' as evaluation,
        properties->>'score' as score,
        properties->>'feedback' as feedback,
        created_at
      FROM analytics_events
      WHERE event_type = 'feedback'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json(evaluations.rows.map(e => ({
      ...e,
      agent_name: getAgentDisplayName(e.agent_type),
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get evaluations' });
  }
});

// Get pipeline funnel
app.get('/api/pipeline/funnel', async (_req, res) => {
  try {
    const funnel = await query(`
      SELECT
        status,
        COUNT(*) as count
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

    res.json(funnel.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pipeline funnel' });
  }
});

// Start server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Sales Agent API running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard/overview`);
  console.log(`👥 Team: http://localhost:${PORT}/api/team`);
  console.log(`🎯 Goals: http://localhost:${PORT}/api/daily-goals`);
});
