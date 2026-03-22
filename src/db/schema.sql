-- Sales Agent System Database Schema
-- Each agent operates independently and writes to shared tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- LEADS & COMPANIES
-- ============================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    industry VARCHAR(100),
    platform VARCHAR(50), -- 'shopify', 'woocommerce', 'other'
    employee_count INTEGER,
    estimated_revenue VARCHAR(50),
    region VARCHAR(10), -- 'US', 'UK', 'AU', 'IN'

    -- Tech Stack Detection
    has_shopping_assistant BOOLEAN DEFAULT false,
    detected_assistants TEXT[], -- ['tidio', 'intercom']
    tech_stack JSONB DEFAULT '{}',

    -- Traffic & Engagement
    monthly_traffic INTEGER,
    traffic_source VARCHAR(50), -- 'similarweb', 'builtwith', 'manual'

    -- Metadata
    enriched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Personal Info
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),

    -- Role
    title VARCHAR(255),
    department VARCHAR(100),
    is_decision_maker BOOLEAN DEFAULT false,

    -- Enrichment
    enrichment_source VARCHAR(50), -- 'apollo', 'clearbit', 'manual'
    enriched_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Scoring (updated by Lead Scoring Agent)
    icp_score INTEGER DEFAULT 0, -- 0-100
    intent_score INTEGER DEFAULT 0, -- 0-100
    total_score INTEGER GENERATED ALWAYS AS (icp_score + intent_score) STORED,
    score_breakdown JSONB DEFAULT '{}',

    -- Pipeline
    status VARCHAR(50) DEFAULT 'new', -- new, researched, contacted, engaged, meeting_booked, demo_done, proposal_sent, negotiating, closed_won, closed_lost
    stage_changed_at TIMESTAMP DEFAULT NOW(),

    -- Assignment
    assigned_agent VARCHAR(50), -- which agent is handling

    -- Source
    source VARCHAR(100), -- 'scraper', 'apollo', 'linkedin', 'inbound', 'referral'
    source_details JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AGENT-SPECIFIC TABLES (Independent Operations)
-- ============================================

-- Email Agent Tables
CREATE TABLE email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL, -- [{dayOffset: 0, templateId: 'hook'}, ...]
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id VARCHAR(100) UNIQUE NOT NULL, -- 'hook', 'social_proof', etc.
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    variables TEXT[], -- ['firstName', 'companyName', 'productCategory']
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sequence_id UUID REFERENCES email_sequences(id),

    -- Campaign State
    status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, stopped
    current_step INTEGER DEFAULT 0,
    next_send_at TIMESTAMP,

    -- Tracking
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- Email Details
    template_id VARCHAR(100),
    subject VARCHAR(500),
    body TEXT,
    to_email VARCHAR(255) NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, opened, clicked, replied, bounced, unsubscribed
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    replied_at TIMESTAMP,

    -- Provider Response
    provider_message_id VARCHAR(255),
    provider_response JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

-- LinkedIn Agent Tables
CREATE TABLE linkedin_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- Connection State
    connection_status VARCHAR(50) DEFAULT 'not_connected', -- not_connected, pending, connected, declined
    connection_sent_at TIMESTAMP,
    connected_at TIMESTAMP,

    -- Message State
    dm_sequence_step INTEGER DEFAULT 0,
    last_message_sent_at TIMESTAMP,
    last_message_received_at TIMESTAMP,

    -- Tracking
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE linkedin_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,

    -- Message
    direction VARCHAR(10) NOT NULL, -- 'outbound', 'inbound'
    message_type VARCHAR(50), -- 'connection_request', 'dm', 'inmail'
    content TEXT NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, replied
    sent_at TIMESTAMP,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Content Agent Tables
CREATE TABLE content_pieces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Content Details
    type VARCHAR(50) NOT NULL, -- 'blog', 'email_template', 'linkedin_post', 'case_study', 'proposal'
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,

    -- Targeting
    target_industry VARCHAR(100),
    target_persona VARCHAR(100),

    -- SEO (for blogs)
    seo_keywords TEXT[],
    meta_description VARCHAR(500),

    -- Publishing
    status VARCHAR(50) DEFAULT 'draft', -- draft, review, published
    published_at TIMESTAMP,
    publish_url VARCHAR(500),

    -- Performance
    views INTEGER DEFAULT 0,
    engagement_score DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SHARED TABLES (All Agents Can Access)
-- ============================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,

    -- Conversation Context
    channel VARCHAR(50) NOT NULL, -- 'email', 'linkedin', 'chat', 'sms'
    agent_type VARCHAR(50) NOT NULL, -- 'email_agent', 'linkedin_agent', 'chat_agent'

    -- Messages
    messages JSONB DEFAULT '[]', -- [{role: 'agent', content: '...', timestamp: '...'}]

    -- Analysis
    sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'
    intent VARCHAR(100), -- 'interested', 'objection', 'question', 'not_interested'
    key_objections TEXT[],

    -- Outcome
    outcome VARCHAR(100), -- 'meeting_booked', 'not_interested', 'follow_up', 'closed'

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task Details
    agent_type VARCHAR(50) NOT NULL, -- 'lead_research', 'lead_scoring', 'email', 'linkedin', 'content'
    task_type VARCHAR(100) NOT NULL, -- 'scan_store', 'score_lead', 'send_email', 'send_dm', 'write_blog'

    -- Input/Output
    payload JSONB NOT NULL,
    result JSONB,
    error TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
    priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent

    -- Scheduling
    scheduled_for TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Retry Logic
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Content
    category VARCHAR(100) NOT NULL, -- 'product', 'objection_handling', 'competitor', 'case_study', 'faq'
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,

    -- For Retrieval
    tags TEXT[],
    embedding VECTOR(1536), -- For semantic search (requires pgvector)

    -- Metadata
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Event Details
    event_type VARCHAR(100) NOT NULL, -- 'email_sent', 'email_opened', 'meeting_booked', 'lead_scored'
    agent_type VARCHAR(50),

    -- Context
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    campaign_id UUID,

    -- Data
    properties JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Companies
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_platform ON companies(platform);
CREATE INDEX idx_companies_region ON companies(region);
CREATE INDEX idx_companies_has_assistant ON companies(has_shopping_assistant);

-- Contacts
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Leads
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(total_score DESC);
CREATE INDEX idx_leads_contact ON leads(contact_id);
CREATE INDEX idx_leads_company ON leads(company_id);

-- Email
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX idx_email_campaigns_next_send ON email_campaigns(next_send_at) WHERE status = 'active';
CREATE INDEX idx_email_logs_campaign ON email_logs(campaign_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- LinkedIn
CREATE INDEX idx_linkedin_campaigns_status ON linkedin_campaigns(connection_status);
CREATE INDEX idx_linkedin_messages_campaign ON linkedin_messages(campaign_id);

-- Tasks
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_agent ON agent_tasks(agent_type);
CREATE INDEX idx_agent_tasks_scheduled ON agent_tasks(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_agent_tasks_priority ON agent_tasks(priority DESC) WHERE status = 'pending';

-- Conversations
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_channel ON conversations(channel);

-- Analytics
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER email_campaigns_updated_at BEFORE UPDATE ON email_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER linkedin_campaigns_updated_at BEFORE UPDATE ON linkedin_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ADS AGENT TABLES
-- ============================================

CREATE TABLE ad_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Campaign Details
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'meta', 'google', 'linkedin'
    objective VARCHAR(50) NOT NULL, -- 'awareness', 'consideration', 'conversion'

    -- Budget
    budget_daily DECIMAL(10,2) NOT NULL,
    budget_total DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',

    -- Targeting
    targeting JSONB DEFAULT '{}', -- {audiences: [], interests: [], demographics: {}}

    -- Schedule
    start_date TIMESTAMP,
    end_date TIMESTAMP,

    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed

    -- Performance Goals
    target_cpa DECIMAL(10,2),
    target_roas DECIMAL(5,2),

    -- External IDs
    external_campaign_id VARCHAR(255), -- Platform's campaign ID

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ad_creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,

    -- Creative Details
    type VARCHAR(50) NOT NULL, -- 'image', 'video', 'carousel'
    headline VARCHAR(255) NOT NULL,
    primary_text TEXT NOT NULL,
    description TEXT,
    call_to_action VARCHAR(50) NOT NULL,
    destination_url VARCHAR(500) NOT NULL,

    -- Media
    media_url VARCHAR(500),
    media_type VARCHAR(50),

    -- Performance
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused

    -- A/B Testing
    is_variant BOOLEAN DEFAULT false,
    variant_group VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ad_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    creative_id UUID REFERENCES ad_creatives(id) ON DELETE SET NULL,

    -- Date
    date DATE NOT NULL,

    -- Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0,

    -- Calculated (stored for performance)
    ctr DECIMAL(5,2), -- Click-through rate
    cpc DECIMAL(10,2), -- Cost per click
    cpa DECIMAL(10,2), -- Cost per acquisition

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(campaign_id, creative_id, date)
);

CREATE TABLE ad_audiences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Audience Details
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'custom', 'lookalike', 'saved', 'retargeting'
    platform VARCHAR(50) NOT NULL, -- 'meta', 'google'

    -- Source (for custom/lookalike)
    source VARCHAR(100), -- 'website_visitors', 'email_list', 'converters'
    lookalike_percentage DECIMAL(3,1), -- 1-10%
    lookback_days INTEGER,

    -- Targeting Criteria
    targeting_criteria JSONB DEFAULT '{}',

    -- Size
    estimated_size INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'building', -- building, ready, expired

    -- External ID
    external_audience_id VARCHAR(255),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,

    -- Test Details
    test_element VARCHAR(50) NOT NULL, -- 'headlines', 'ctas', 'hooks', 'audiences', 'creatives'
    variants JSONB NOT NULL, -- Array of variant values

    -- Results
    winning_variant VARCHAR(255),
    confidence_level DECIMAL(5,2),

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled

    -- Duration
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Ad Indexes
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX idx_ad_campaigns_platform ON ad_campaigns(platform);
CREATE INDEX idx_ad_metrics_date ON ad_metrics(date);
CREATE INDEX idx_ad_metrics_campaign ON ad_metrics(campaign_id);
CREATE INDEX idx_ad_audiences_type ON ad_audiences(type);
CREATE INDEX idx_ab_tests_campaign ON ab_tests(campaign_id);

-- Ad Triggers
CREATE TRIGGER ad_campaigns_updated_at BEFORE UPDATE ON ad_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ad_creatives_updated_at BEFORE UPDATE ON ad_creatives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ad_audiences_updated_at BEFORE UPDATE ON ad_audiences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
