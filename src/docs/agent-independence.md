# Agent Independence & Data Collection

## Ultimate Goal
All agents work towards one objective: **Book meetings on Calendly**
- Link: https://calendly.com/sugath-flash/30min

---

## Agent Independence Matrix

| Agent | Runs Independently | Own Data Storage | External Data Sources | Human Dependency |
|-------|-------------------|------------------|----------------------|------------------|
| 🔍 Scout | ✅ Yes | ✅ companies, contacts, leads | Shopify stores, Apollo, Clearbit | None |
| ⚖️ Judge | ✅ Yes | ✅ leads (scores) | Reads from all channels | None |
| 📧 Mailman | ✅ Yes | ✅ email_campaigns, email_logs | Email webhooks (opens/clicks) | None |
| 💼 Lincoln | ✅ Yes | ✅ linkedin_campaigns, linkedin_messages | LinkedIn API/scraping | None |
| ✍️ Scribe | ✅ Yes | ✅ content_pieces | None | None |
| 🎯 Captain | ⚠️ Coordinator | ✅ agent_tasks | Reads all agent data | None |
| 👔 Chief | ✅ Yes | ✅ analytics_events | Reads all metrics | None |

---

## Data Collection by Agent

### 🔍 Scout (Lead Research)
```
COLLECTS:
├── Company data (domain, platform, tech stack)
├── Contact info (founder, email, LinkedIn)
├── Shopping assistant detection
├── Traffic estimates
└── Enrichment data (Apollo, Clearbit)

STORES IN:
├── companies table
├── contacts table
└── leads table

INDEPENDENT OPERATIONS:
✅ Can scan any Shopify domain without dependencies
✅ Self-manages enrichment API calls
✅ Creates leads automatically
```

### ⚖️ Judge (Lead Scoring)
```
COLLECTS:
├── ICP signals (platform, region, traffic)
├── Intent signals (email opens, replies)
├── Engagement data from all channels
└── Timing signals (funding, hiring)

STORES IN:
├── leads.icp_score
├── leads.intent_score
└── leads.score_breakdown

INDEPENDENT OPERATIONS:
✅ Can score any lead in database
✅ Self-recalculates based on new data
✅ No dependency on other agents running
```

### 📧 Mailman (Email)
```
COLLECTS:
├── Email addresses from contacts
├── Open/click/reply events
├── Bounce data
└── Unsubscribe events

STORES IN:
├── email_campaigns
├── email_logs
├── conversations
└── analytics_events

INDEPENDENT OPERATIONS:
✅ Manages own sequences and timing
✅ Handles replies autonomously
✅ Tracks all engagement independently
✅ Includes Calendly link in all emails
```

### 💼 Lincoln (LinkedIn)
```
COLLECTS:
├── LinkedIn profile URLs
├── Connection status
├── Message history
└── Response data

STORES IN:
├── linkedin_campaigns
├── linkedin_messages
├── conversations
└── analytics_events

INDEPENDENT OPERATIONS:
✅ Manages connection requests
✅ Runs DM sequences independently
✅ Tracks engagement autonomously
✅ Includes Calendly link in asks
```

### ✍️ Scribe (Content)
```
COLLECTS:
├── Content requests
├── Lead data for personalization
├── SEO keywords
└── Engagement metrics

STORES IN:
├── content_pieces
└── analytics_events

INDEPENDENT OPERATIONS:
✅ Creates content on demand
✅ Generates proposals autonomously
✅ Self-manages content calendar
```

### 🎯 Captain (Orchestrator)
```
COLLECTS:
├── Pipeline metrics
├── Agent health status
├── Task completion rates
└── Escalation triggers

STORES IN:
├── agent_tasks
└── analytics_events

COORDINATOR OPERATIONS:
⚠️ Dispatches work to agents
⚠️ Monitors but doesn't process
⚠️ Can run daily operations
```

### 👔 Chief (Leader)
```
COLLECTS:
├── All agent metrics
├── Performance trends
├── Goal progress
└── Team comparisons

STORES IN:
├── analytics_events (daily_review)
├── analytics_events (goals_set)
└── analytics_events (feedback)

INDEPENDENT OPERATIONS:
✅ Evaluates without affecting operations
✅ Generates reports autonomously
✅ Sets goals independently
```

### 📢 Adman (Ads)
```
COLLECTS:
├── Campaign performance data
├── Audience targeting metrics
├── Creative performance
├── Conversion tracking
└── A/B test results

STORES IN:
├── ad_campaigns
├── ad_creatives
├── ad_metrics
├── ad_audiences
├── ab_tests
└── analytics_events

INDEPENDENT OPERATIONS:
✅ Creates and manages Meta/Google campaigns
✅ Optimizes campaigns based on performance
✅ Runs A/B tests autonomously
✅ Builds retargeting audiences
✅ Tracks ROI and CPA independently
✅ Drives traffic to Calendly booking link
```

---

## Parallel Execution Capability

### Can Run Simultaneously
```
Scout ────────┐
              │
Judge ────────┤
              │
Mailman ──────┤
              ├──▶ All write to shared DB
Lincoln ──────┤     No conflicts
              │
Scribe ───────┤
              │
Adman ────────┘
```

### No Blocking Dependencies
- Each agent queries its own data domain
- Writes don't conflict (different tables/rows)
- Can process same lead from different channels

---

## Data Flow to Calendly Booking

```
Scout finds lead
       │
       ▼
Judge scores lead (70+ = hot)
       │
       ├──────────────┬────────────────┬────────────────┐
       ▼              ▼                ▼                ▼
   Mailman        Lincoln           Scribe           Adman
   (Email)       (LinkedIn)       (Content)         (Ads)
       │              │                │                │
       ▼              ▼                ▼                ▼
   Sends email    Sends DM        Creates         Runs ads
   with Calendly  with Calendly   proposal       to Calendly
       │              │                │                │
       └──────────────┴────────────────┴────────────────┘
                                 │
                                 ▼
                         MEETING BOOKED
              https://calendly.com/sugath-flash/30min
```

---

## Metrics Tracked Per Agent

| Agent | Key Metrics |
|-------|-------------|
| Scout | Leads discovered, Enrichment rate, Qualification % |
| Judge | Scoring accuracy, Hot/Warm/Cold distribution |
| Mailman | Open rate, Reply rate, **Meetings booked** |
| Lincoln | Connection rate, Response rate, **Meetings booked** |
| Scribe | Content produced, Engagement |
| Adman | CTR, CPC, Conversions, ROAS, **Meetings booked** |
| Captain | Pipeline velocity, Agent utilization |
| Chief | Team performance, **Total meetings booked** |

---

## Independence Verification Checklist

✅ Each agent has its own queue in BullMQ
✅ Each agent has dedicated database tables
✅ Agents can be started/stopped independently
✅ No circular dependencies between agents
✅ Each agent logs its own analytics events
✅ All outreach includes Calendly booking link
