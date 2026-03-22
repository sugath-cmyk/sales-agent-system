// API Configuration
// In production, this will be set via VITE_API_URL environment variable
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  overview: `${API_BASE}/api/dashboard/overview`,
  team: `${API_BASE}/api/team`,
  dailyGoals: `${API_BASE}/api/daily-goals`,
  agentStatus: `${API_BASE}/api/agents/status`,
  evaluations: `${API_BASE}/api/evaluations`,
  activity: `${API_BASE}/api/dashboard/activity`,
  weeklyPerformance: `${API_BASE}/api/performance/weekly`,
  pipelineFunnel: `${API_BASE}/api/pipeline/funnel`,
  // Agent-specific endpoints
  agents: {
    scout: `${API_BASE}/api/dashboard/agents/scout`,
    judge: `${API_BASE}/api/dashboard/agents/judge`,
    mailman: `${API_BASE}/api/dashboard/agents/mailman`,
    lincoln: `${API_BASE}/api/dashboard/agents/lincoln`,
    scribe: `${API_BASE}/api/dashboard/agents/scribe`,
    captain: `${API_BASE}/api/dashboard/agents/captain`,
    chief: `${API_BASE}/api/dashboard/agents/chief`,
    adman: `${API_BASE}/api/dashboard/agents/adman`,
  },
};
