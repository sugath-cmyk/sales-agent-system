import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

interface Agent {
  id: string;
  name: string;
  displayName: string;
  role: string;
  emoji: string;
}

interface AgentCardProps {
  agent: Agent;
  isActive: boolean;
  onClick: () => void;
}

const API_URL = `${API_BASE}/api`;

export function AgentCard({ agent, isActive, onClick }: AgentCardProps) {
  const [metrics, setMetrics] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isActive) {
      fetchMetrics();
    }
  }, [isActive, agent.id]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const agentEndpoint = getAgentEndpoint(agent.id);
      const res = await fetch(`${API_URL}/dashboard/agents/${agentEndpoint}`);
      const data = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
    setLoading(false);
  };

  const getAgentEndpoint = (id: string): string => {
    const endpoints: Record<string, string> = {
      lead_research: 'scout',
      lead_scoring: 'judge',
      email: 'mailman',
      linkedin: 'lincoln',
      content: 'scribe',
      orchestrator: 'captain',
    };
    return endpoints[id] || id;
  };

  const getStatusColor = (): string => {
    if (!metrics?.tasks) return 'bg-gray-500';
    const rate = metrics.tasks.completed / (metrics.tasks.total || 1);
    if (rate >= 0.9) return 'bg-green-500';
    if (rate >= 0.7) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      className={`bg-gray-800 rounded-lg p-4 cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-blue-500' : 'hover:bg-gray-750'
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-gray-400 text-xs">{agent.role}</p>
          </div>
        </div>
        <span className={`w-3 h-3 rounded-full ${getStatusColor()}`}></span>
      </div>

      {/* Expanded metrics */}
      {isActive && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading metrics...</p>
          ) : metrics ? (
            <AgentMetrics agentId={agent.id} metrics={metrics} />
          ) : (
            <p className="text-gray-400 text-sm">No data available</p>
          )}
        </div>
      )}
    </div>
  );
}

function AgentMetrics({ agentId, metrics }: { agentId: string; metrics: any }) {
  switch (agentId) {
    case 'lead_research':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Scanned" value={metrics.metrics?.companies_scanned || 0} />
          <Metric label="Qualified" value={metrics.metrics?.no_assistant || 0} />
          <Metric label="Enriched" value={metrics.metrics?.enrichment_rate || '0%'} />
          <Metric label="Shopify" value={metrics.metrics?.shopify_stores || 0} />
        </div>
      );

    case 'lead_scoring':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Scored" value={metrics.metrics?.leads_scored || 0} />
          <Metric label="Hot" value={metrics.metrics?.hot_leads || 0} color="red" />
          <Metric label="Warm" value={metrics.metrics?.warm_leads || 0} color="yellow" />
          <Metric label="Avg Score" value={Math.round(metrics.metrics?.avg_total_score || 0)} />
        </div>
      );

    case 'email':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Sent" value={metrics.metrics?.emails_sent || 0} />
          <Metric label="Open Rate" value={metrics.metrics?.open_rate || '0%'} />
          <Metric label="Reply Rate" value={metrics.metrics?.reply_rate || '0%'} color="green" />
          <Metric label="Active" value={metrics.campaigns?.active || 0} />
        </div>
      );

    case 'linkedin':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Campaigns" value={metrics.metrics?.total_campaigns || 0} />
          <Metric label="Connected" value={metrics.metrics?.connected || 0} color="green" />
          <Metric label="Conn Rate" value={metrics.metrics?.connection_rate || '0%'} />
          <Metric label="DMs Sent" value={metrics.metrics?.total_dms_sent || 0} />
        </div>
      );

    case 'content':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Created" value={metrics.metrics?.total_pieces || 0} />
          <Metric label="Blogs" value={metrics.metrics?.blogs || 0} />
          <Metric label="Posts" value={metrics.metrics?.linkedin_posts || 0} />
          <Metric label="Published" value={metrics.metrics?.published || 0} color="green" />
        </div>
      );

    case 'orchestrator':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="New Today" value={metrics.velocity?.new_today || 0} />
          <Metric label="Contacted" value={metrics.velocity?.contacted_today || 0} />
          <Metric label="Engaged" value={metrics.velocity?.engaged_today || 0} color="green" />
          <Metric label="Meetings" value={metrics.velocity?.meetings_today || 0} color="blue" />
        </div>
      );

    default:
      return <p className="text-gray-400">No metrics available</p>;
  }
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: 'red' | 'yellow' | 'green' | 'blue';
}) {
  const colorClasses = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="bg-gray-700/50 rounded p-2">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`font-semibold ${color ? colorClasses[color] : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
