# Agent Data Flow Architecture

## Overview

Each agent operates independently with its own data domain, communicating through shared database tables.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL INPUTS                                 │
│         [Shopify Stores]  [Apollo API]  [LinkedIn]  [Email Webhooks]        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  🔍 SCOUT    │───▶│  ⚖️ JUDGE    │───▶│  📧 MAILMAN  │                   │
│  │  (Research)  │    │  (Scoring)   │    │  (Email)     │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  companies   │    │    leads     │    │email_campaigns│                  │
│  │  contacts    │    │(score update)│    │  email_logs  │                   │
│  │    leads     │    └──────────────┘    └──────────────┘                   │
│  └──────────────┘                                                           │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  💼 LINCOLN  │    │  ✍️ SCRIBE   │    │  👔 CHIEF    │                   │
│  │  (LinkedIn)  │    │  (Content)   │    │  (Leader)    │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │linkedin_camp │    │content_pieces│    │analytics_evts│                   │
│  │linkedin_msgs │    └──────────────┘    │(daily_review)│                   │
│  └──────────────┘                        └──────────────┘                   │
│                                                                              │
│                        ┌──────────────┐                                      │
│                        │  🎯 CAPTAIN  │                                      │
│                        │(Orchestrator)│                                      │
│                        └──────────────┘                                      │
│                               │                                              │
│                               ▼                                              │
│                        ┌──────────────┐                                      │
│                        │ agent_tasks  │                                      │
│                        │conversations │                                      │
│                        └──────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Data Domains

### 🔍 Scout (Lead Research)

**Reads From:**
- External: Shopify store URLs, Apollo API, Clearbit API

**Writes To:**
| Table | Purpose |
|-------|---------|
| `companies` | Store company info, platform, tech stack |
| `contacts` | Store founder/decision-maker info |
| `leads` | Create new lead records |
| `agent_tasks` | Log task execution |
| `analytics_events` | Log `lead_created` events |

**Independence Level:** ✅ Fully Independent
- Can run without any other agent
- Only needs domain list as input

---

### ⚖️ Judge (Lead Scoring)

**Reads From:**
| Table | Purpose |
|-------|---------|
| `leads` | Get leads to score |
| `companies` | Get company attributes for ICP scoring |
| `email_logs` | Get engagement data for intent scoring |
| `linkedin_campaigns` | Get LinkedIn engagement data |

**Writes To:**
| Table | Purpose |
|-------|---------|
| `leads` | Update `icp_score`, `intent_score`, `status` |
| `agent_tasks` | Log task execution |
| `analytics_events` | Log `lead_scored` events |

**Independence Level:** ✅ Fully Independent
- Can run on any lead in database
- Doesn't depend on other agents running

---

### 📧 Mailman (Email)

**Reads From:**
| Table | Purpose |
|-------|---------|
| `leads` | Get qualified leads for outreach |
| `contacts` | Get email addresses |
| `companies` | Get company info for personalization |
| `email_campaigns` | Track active campaigns |
| `email_sequences` | Get sequence configuration |

**Writes To:**
| Table | Purpose |
|-------|---------|
| `email_campaigns` | Create/update campaigns |
| `email_logs` | Log every email sent |
| `leads` | Update status to `contacted`, `engaged` |
| `conversations` | Store email threads |
| `analytics_events` | Log `email_sent`, `email_opened`, etc. |

**Independence Level:** ✅ Fully Independent
- Can operate on any qualified lead
- Self-manages sequences and timing

---

### 💼 Lincoln (LinkedIn)

**Reads From:**
| Table | Purpose |
|-------|---------|
| `leads` | Get leads with LinkedIn URLs |
| `contacts` | Get LinkedIn profile URLs |
| `companies` | Get company info for personalization |
| `linkedin_campaigns` | Track connection status |

**Writes To:**
| Table | Purpose |
|-------|---------|
| `linkedin_campaigns` | Create/update campaigns |
| `linkedin_messages` | Log all messages |
| `leads` | Update status |
| `conversations` | Store LinkedIn threads |
| `analytics_events` | Log LinkedIn events |

**Independence Level:** ✅ Fully Independent
- Can operate on any lead with LinkedIn URL
- Self-manages connection requests and DM sequences

---

### ✍️ Scribe (Content)

**Reads From:**
| Table | Purpose |
|-------|---------|
| `leads` | Get lead data for proposals |
| `companies` | Get company info for case studies |
| `content_pieces` | Track existing content |

**Writes To:**
| Table | Purpose |
|-------|---------|
| `content_pieces` | Store all generated content |
| `agent_tasks` | Log task execution |
| `analytics_events` | Log `content_created` events |

**Independence Level:** ✅ Fully Independent
- Can create content without any dependencies
- Proposals require lead data but optional

---

### 🎯 Captain (Orchestrator)

**Reads From:**
| Table | Purpose |
|-------|---------|
| `leads` | Pipeline overview |
| `agent_tasks` | Monitor agent health |
| `email_campaigns` | Track email performance |
| `linkedin_campaigns` | Track LinkedIn performance |
| `analytics_events` | System-wide metrics |

**Writes To:**
| Table | Purpose |
|-------|---------|
| `agent_tasks` | Dispatch tasks to other agents |
| `analytics_events` | Log `escalation` events |

**Independence Level:** ⚠️ Coordinator Role
- Reads from all agents' data
- Dispatches work but doesn't do actual processing

---

### 👔 Chief (Leader)

**Reads From:**
| Table | Purpose |
|-------|---------|
| `agent_tasks` | Task completion metrics |
| `leads` | Pipeline metrics |
| `email_logs` | Email performance |
| `linkedin_campaigns` | LinkedIn performance |
| `content_pieces` | Content production |
| `analytics_events` | Historical reviews |

**Writes To:**
| Table | Purpose |
|-------|---------|
| `analytics_events` | Daily reviews, goals, feedback |

**Independence Level:** ✅ Fully Independent
- Only reads metrics, doesn't modify operational data
- Generates reviews independently

---

## Data Flow by Pipeline Stage

```
STAGE 1: DISCOVERY
Scout finds Shopify stores → companies, contacts, leads

STAGE 2: QUALIFICATION
Judge scores leads → leads.icp_score, leads.intent_score

STAGE 3: OUTREACH (PARALLEL)
├── Mailman sends emails → email_campaigns, email_logs
└── Lincoln sends connections → linkedin_campaigns, linkedin_messages

STAGE 4: ENGAGEMENT
Both channels track responses → conversations, analytics_events

STAGE 5: REVIEW
Chief evaluates performance → analytics_events (daily_review)
```

---

## Key Metrics by Agent

| Agent | Primary KPIs | Source Tables |
|-------|--------------|---------------|
| Scout | Leads discovered, Enrichment rate | `companies`, `leads` |
| Judge | Scoring accuracy, Processing speed | `leads`, `agent_tasks` |
| Mailman | Open rate, Reply rate, Meetings booked | `email_logs`, `leads` |
| Lincoln | Connection rate, Response rate | `linkedin_campaigns`, `linkedin_messages` |
| Scribe | Content produced, Engagement | `content_pieces` |
| Captain | Pipeline velocity, Agent utilization | All tables |
| Chief | Team performance, Improvement rate | `analytics_events` |
