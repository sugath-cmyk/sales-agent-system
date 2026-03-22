import { useState, useEffect } from 'react';
import type { ElementType } from 'react';
import { Target, TrendingUp, Users, Calendar } from 'lucide-react';
import { API_BASE } from '../config/api';

const API_URL = `${API_BASE}/api`;

interface GoalProgress {
  current: number;
  goal: number;
  percentage: number;
}

interface DailyGoalsData {
  date: string;
  calendlyLink: string;
  progress: {
    leads_discovered: GoalProgress;
    leads_contacted: GoalProgress;
    leads_engaged: GoalProgress;
    meetings_booked: GoalProgress;
  };
  agentActivity: Array<{
    agent_type: string;
    agent_name: string;
    tasks_completed: number;
    successful: number;
    failed: number;
  }>;
}

export function DailyGoals() {
  const [data, setData] = useState<DailyGoalsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
    const interval = setInterval(fetchGoals, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${API_URL}/daily-goals`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch daily goals:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-gray-400">Loading daily goals...</div>;
  }

  if (!data) {
    return <div className="text-gray-400">No data available</div>;
  }

  const goals = [
    {
      key: 'leads_discovered',
      label: 'Leads Discovered',
      icon: Users,
      color: 'blue',
      ...data.progress.leads_discovered,
    },
    {
      key: 'leads_contacted',
      label: 'Leads Contacted',
      icon: TrendingUp,
      color: 'yellow',
      ...data.progress.leads_contacted,
    },
    {
      key: 'leads_engaged',
      label: 'Leads Engaged',
      icon: Target,
      color: 'orange',
      ...data.progress.leads_engaged,
    },
    {
      key: 'meetings_booked',
      label: 'Meetings Booked',
      icon: Calendar,
      color: 'green',
      ...data.progress.meetings_booked,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Daily Goals</h3>
          <p className="text-gray-400 text-sm">{data.date}</p>
        </div>
        <a
          href={data.calendlyLink}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold"
        >
          Book Meeting
        </a>
      </div>

      {/* Goal Progress Bars */}
      <div className="grid grid-cols-2 gap-4">
        {goals.map(({ key, ...goalProps }) => (
          <GoalCard key={key} {...goalProps} />
        ))}
      </div>

      {/* Agent Activity */}
      {data.agentActivity.length > 0 && (
        <div className="pt-4 border-t border-gray-700">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Today's Agent Activity</h4>
          <div className="space-y-2">
            {data.agentActivity.map((agent) => (
              <div
                key={agent.agent_type}
                className="flex items-center justify-between bg-gray-700/30 rounded-lg px-3 py-2"
              >
                <span className="text-sm">{agent.agent_name}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-400">{agent.successful} done</span>
                  {agent.failed > 0 && (
                    <span className="text-red-400">{agent.failed} failed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({
  label,
  current,
  goal,
  percentage,
  icon: Icon,
  color,
}: {
  label: string;
  current: number;
  goal: number;
  percentage: number;
  icon: ElementType;
  color: string;
}) {
  const colors: Record<string, { bg: string; fill: string; text: string }> = {
    blue: { bg: 'bg-blue-500/20', fill: 'bg-blue-500', text: 'text-blue-400' },
    yellow: { bg: 'bg-yellow-500/20', fill: 'bg-yellow-500', text: 'text-yellow-400' },
    orange: { bg: 'bg-orange-500/20', fill: 'bg-orange-500', text: 'text-orange-400' },
    green: { bg: 'bg-green-500/20', fill: 'bg-green-500', text: 'text-green-400' },
  };

  const c = colors[color];

  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <span className={`text-2xl font-bold ${c.text}`}>{current}</span>
        <span className="text-gray-400 text-sm">/ {goal}</span>
      </div>
      <div className={`h-2 ${c.bg} rounded-full overflow-hidden`}>
        <div
          className={`h-full ${c.fill} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{percentage}% complete</p>
    </div>
  );
}
