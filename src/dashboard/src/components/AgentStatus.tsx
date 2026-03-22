import { useState, useEffect } from 'react';
import { Activity, Pause, Clock } from 'lucide-react';
import { API_BASE } from '../config/api';

const API_URL = `${API_BASE}/api`;

interface AgentStatusData {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'working' | 'idle';
  lastActivity: string | null;
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  goal: string;
}

export function AgentStatusGrid() {
  const [agents, setAgents] = useState<AgentStatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/agents/status`);
      const data = await res.json();
      setAgents(data);
    } catch (error) {
      console.error('Failed to fetch agent status:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {agents.map((agent) => (
        <AgentStatusCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function AgentStatusCard({ agent }: { agent: AgentStatusData }) {
  const isWorking = agent.status === 'working';

  const timeAgo = (date: string | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border-l-4 ${isWorking ? 'border-green-500' : 'border-gray-600'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-xs text-gray-500">{agent.role}</p>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full ${isWorking ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      </div>

      {/* Status Badge */}
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium mb-3 ${
        isWorking ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
      }`}>
        {isWorking ? (
          <>
            <Activity className="w-3 h-3 animate-spin" />
            Working
          </>
        ) : (
          <>
            <Pause className="w-3 h-3" />
            Idle
          </>
        )}
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-gray-700/50 rounded px-2 py-1">
          <span className="text-gray-500">Queue:</span>
          <span className="text-yellow-400 ml-1">{agent.queue.waiting}</span>
        </div>
        <div className="bg-gray-700/50 rounded px-2 py-1">
          <span className="text-gray-500">Done:</span>
          <span className="text-green-400 ml-1">{agent.queue.completed}</span>
        </div>
      </div>

      {/* Last Activity */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        Last: {timeAgo(agent.lastActivity)}
      </div>
    </div>
  );
}
