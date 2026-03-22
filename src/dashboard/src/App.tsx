import { useState, useEffect } from 'react';
import { DailyGoals } from './components/DailyGoals';
import { ActivityFeed } from './components/ActivityFeed';
import { PipelineChart } from './components/PipelineChart';
import { AgentEvaluations } from './components/AgentEvaluations';
import { AgentStatusGrid } from './components/AgentStatus';
import { WeeklyTrend } from './components/WeeklyTrend';
import { TeamOverview } from './components/TeamOverview';
import { AgentCard } from './components/AgentCard';
import { DataView } from './components/DataView';
import { RefreshCw, Calendar, Users, Target, TrendingUp, Award, Database } from 'lucide-react';
import { API_BASE } from './config/api';

const API_URL = `${API_BASE}/api`;

interface Overview {
  pipeline: Record<string, number>;
  today: Record<string, number>;
  funnel: Record<string, number>;
}

interface Agent {
  id: string;
  name: string;
  displayName: string;
  role: string;
  emoji: string;
}

type Tab = 'overview' | 'agents' | 'pipeline' | 'evaluations' | 'data';

export default function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [team, setTeam] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [overviewRes, teamRes] = await Promise.all([
        fetch(`${API_URL}/dashboard/overview`).catch(() => null),
        fetch(`${API_URL}/team`).catch(() => null),
      ]);

      if (overviewRes?.ok) {
        const data = await overviewRes.json();
        setOverview(data);
      } else {
        // Set default values if API fails
        setOverview({
          pipeline: { total_leads: 0, new: 0, researched: 0, contacted: 0, engaged: 0, meeting_booked: 0 },
          today: { new_leads: 0, emails_sent: 0, linkedin_requests: 0, content_created: 0 },
          funnel: { hot_leads: 0, warm_leads: 0, cold_leads: 0, unscored: 0 },
        });
      }

      if (teamRes?.ok) {
        setTeam(await teamRes.json());
      }

      setLastRefresh(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Set defaults on error
      setOverview({
        pipeline: { total_leads: 0, new: 0, researched: 0, contacted: 0, engaged: 0, meeting_booked: 0 },
        today: { new_leads: 0, emails_sent: 0, linkedin_requests: 0, content_created: 0 },
        funnel: { hot_leads: 0, warm_leads: 0, cold_leads: 0, unscored: 0 },
      });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading Sales Agent Dashboard...</p>
          <p className="text-gray-400 text-sm mt-2">Connecting to all agents...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'agents', label: 'Agents', icon: Users },
    { id: 'pipeline', label: 'Pipeline', icon: TrendingUp },
    { id: 'evaluations', label: 'Evaluations', icon: Award },
    { id: 'data', label: 'Data', icon: Database },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">🎯</span>
                Varyse Sales Command Center
              </h1>
              <p className="text-gray-400 text-sm">Autonomous Shopify Merchant Outreach</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-green-400 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              8 Agents Active
            </span>
            <span className="text-gray-500 text-xs">
              Last update: {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchData}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a
              href="https://calendly.com/sugath-flash/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Book Meeting
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            {overview && (
              <div className="grid grid-cols-5 gap-4">
                <StatCard
                  title="Total Leads"
                  value={overview.pipeline.total_leads}
                  subtitle="In pipeline"
                  color="blue"
                />
                <StatCard
                  title="Hot Leads"
                  value={overview.funnel.hot_leads}
                  subtitle="Score 70+"
                  color="red"
                />
                <StatCard
                  title="New Today"
                  value={overview.today.new_leads}
                  subtitle="Discovered"
                  color="purple"
                />
                <StatCard
                  title="Emails Sent"
                  value={overview.today.emails_sent}
                  subtitle="Today"
                  color="green"
                />
                <StatCard
                  title="Meetings"
                  value={overview.pipeline.meeting_booked || 0}
                  subtitle="Booked"
                  color="orange"
                />
              </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-3 gap-6">
              {/* Daily Goals */}
              <div className="bg-gray-800 rounded-lg p-6">
                <DailyGoals />
              </div>

              {/* Weekly Trend */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">7-Day Performance</h2>
                <WeeklyTrend />
              </div>

              {/* Activity Feed */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Live Activity</h2>
                <ActivityFeed />
              </div>
            </div>

            {/* Pipeline Overview */}
            {overview && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Pipeline Funnel</h2>
                <PipelineChart data={overview.pipeline} />
              </div>
            )}
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            {/* Agent Status Grid */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Agent Status</h2>
              <AgentStatusGrid />
            </div>

            {/* Detailed Agent Cards */}
            <div className="grid grid-cols-4 gap-4">
              {team.filter(a => a.id !== 'leader').map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isActive={activeAgent === agent.id}
                  onClick={() => setActiveAgent(activeAgent === agent.id ? null : agent.id)}
                />
              ))}
            </div>

            {/* Chief's Team Overview */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">👔</span>
                <div>
                  <h2 className="text-lg font-semibold">Chief's Team Report</h2>
                  <p className="text-gray-400 text-sm">Daily performance analysis</p>
                </div>
              </div>
              <TeamOverview />
            </div>
          </div>
        )}

        {/* Pipeline Tab */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Pipeline Chart */}
            {overview && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Pipeline Overview</h2>
                <PipelineChart data={overview.pipeline} />
              </div>
            )}

            {/* Stage Details */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'New', key: 'new', color: 'gray' },
                { label: 'Researched', key: 'researched', color: 'blue' },
                { label: 'Contacted', key: 'contacted', color: 'purple' },
                { label: 'Engaged', key: 'engaged', color: 'yellow' },
                { label: 'Meeting', key: 'meeting_booked', color: 'green' },
              ].map((stage) => (
                <div key={stage.key} className={`bg-gray-800 rounded-lg p-4 border-l-4 border-${stage.color}-500`}>
                  <p className="text-gray-400 text-sm">{stage.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    {overview?.pipeline[stage.key] || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">leads</p>
                </div>
              ))}
            </div>

            {/* Weekly Trend */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Weekly Trend</h2>
              <WeeklyTrend />
            </div>
          </div>
        )}

        {/* Evaluations Tab */}
        {activeTab === 'evaluations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Chief's Evaluations */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">👔</span>
                  <div>
                    <h2 className="text-lg font-semibold">Chief's Evaluations</h2>
                    <p className="text-gray-400 text-sm">Agent performance feedback</p>
                  </div>
                </div>
                <AgentEvaluations />
              </div>

              {/* Team Performance */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Team Performance</h2>
                <TeamOverview />
              </div>
            </div>

            {/* Agent Cards for Quick Reference */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Agent Roster</h2>
              <div className="grid grid-cols-4 gap-4">
                {team.map((agent) => (
                  <div key={agent.id} className="bg-gray-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{agent.emoji}</span>
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        <p className="text-xs text-gray-400">{agent.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">📊</span>
                Raw Data Explorer
              </h2>
              <DataView />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4 mt-6">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-4">
            <span>Goal: Book meetings at</span>
            <a
              href="https://calendly.com/sugath-flash/30min"
              className="text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              calendly.com/sugath-flash/30min
            </a>
          </div>
          <div>
            Powered by 8 AI Agents | Target: Shopify D2C Brands
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange';
}) {
  const colors = {
    blue: 'from-blue-600 to-blue-800',
    red: 'from-red-600 to-red-800',
    green: 'from-green-600 to-green-800',
    purple: 'from-purple-600 to-purple-800',
    orange: 'from-orange-600 to-orange-800',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-lg p-4`}>
      <p className="text-gray-200 text-sm">{title}</p>
      <p className="text-3xl font-bold mt-1">{value || 0}</p>
      <p className="text-gray-300 text-xs mt-1">{subtitle}</p>
    </div>
  );
}
// Force rebuild Mon Mar 23 01:31:59 IST 2026
