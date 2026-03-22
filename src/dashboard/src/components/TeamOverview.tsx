import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

const API_URL = `${API_BASE}/api`;

interface AgentHealth {
  agent_name: string;
  agent_type: string;
  total_tasks: number;
  completed: number;
  failed: number;
  pending: number;
  completion_rate: string;
}

export function TeamOverview() {
  const [data, setData] = useState<{
    agent_health: AgentHealth[];
    velocity: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/agents/captain`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-gray-400">Loading team overview...</div>;
  }

  if (!data) {
    return <div className="text-gray-400">No team data available</div>;
  }

  return (
    <div className="space-y-4">
      {/* Agent Health Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-2">Agent</th>
              <th className="pb-2">Tasks</th>
              <th className="pb-2">Success</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.agent_health.map((agent) => (
              <tr key={agent.agent_type} className="border-t border-gray-700">
                <td className="py-2">{agent.agent_name}</td>
                <td className="py-2">{agent.total_tasks}</td>
                <td className="py-2">{agent.completion_rate}</td>
                <td className="py-2">
                  <StatusBadge rate={agent.completion_rate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pipeline Velocity */}
      <div className="pt-4 border-t border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Today's Pipeline</h3>
        <div className="grid grid-cols-4 gap-2">
          <VelocityCard label="New" value={data.velocity?.new_today || 0} />
          <VelocityCard label="Contacted" value={data.velocity?.contacted_today || 0} />
          <VelocityCard label="Engaged" value={data.velocity?.engaged_today || 0} color="yellow" />
          <VelocityCard label="Meetings" value={data.velocity?.meetings_today || 0} color="green" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ rate }: { rate: string }) {
  const rateNum = parseInt(rate);

  if (rateNum >= 90) {
    return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Excellent</span>;
  }
  if (rateNum >= 70) {
    return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">Good</span>;
  }
  return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">Attention</span>;
}

function VelocityCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'yellow' | 'green';
}) {
  const colorClass = color === 'green'
    ? 'text-green-400'
    : color === 'yellow'
    ? 'text-yellow-400'
    : 'text-white';

  return (
    <div className="bg-gray-700/50 rounded p-2 text-center">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
