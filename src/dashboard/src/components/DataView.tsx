import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { Filter, Calendar, RefreshCw, X, ChevronDown } from 'lucide-react';

const API_URL = `${API_BASE}/api/dashboard`;

type DataTab = 'leads' | 'companies' | 'tasks' | 'activity';

interface Lead {
  id: string;
  status: string;
  source: string;
  icp_score: number;
  intent_score: number;
  total_score: number;
  email: string;
  first_name: string;
  last_name: string;
  title: string;
  company_name: string;
  domain: string;
  platform: string;
  created_at: string;
  last_agent?: string;
}

interface Company {
  id: string;
  name: string;
  domain: string;
  platform: string;
  region: string;
  has_shopping_assistant: boolean;
  monthly_traffic: number;
  created_at: string;
  discovered_by?: string;
}

interface Task {
  id: string;
  agent_type: string;
  task_type: string;
  status: string;
  error: string | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
}

interface Activity {
  id: string;
  agent: string;
  action: string;
  target: string;
  details: string;
  status: string;
  created_at: string;
}

// Agent definitions
const AGENTS = [
  { id: 'all', name: 'All Agents', emoji: '🎯' },
  { id: 'lead_research', name: 'Scout', emoji: '🔍' },
  { id: 'lead_scoring', name: 'Judge', emoji: '⚖️' },
  { id: 'email', name: 'Mailman', emoji: '📧' },
  { id: 'linkedin', name: 'Lincoln', emoji: '💼' },
  { id: 'content', name: 'Scribe', emoji: '✍️' },
  { id: 'orchestrator', name: 'Captain', emoji: '🎯' },
  { id: 'leader', name: 'Chief', emoji: '👔' },
  { id: 'ads', name: 'Adman', emoji: '📢' },
];

// Timeline presets
const TIMELINE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'thisWeek', label: 'This Week' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

// Lead statuses
const LEAD_STATUSES = [
  { id: 'all', label: 'All Statuses', color: 'gray' },
  { id: 'new', label: 'New', color: 'blue' },
  { id: 'researched', label: 'Researched', color: 'purple' },
  { id: 'contacted', label: 'Contacted', color: 'yellow' },
  { id: 'engaged', label: 'Engaged', color: 'orange' },
  { id: 'meeting_booked', label: 'Meeting Booked', color: 'green' },
  { id: 'closed_won', label: 'Closed Won', color: 'emerald' },
  { id: 'closed_lost', label: 'Closed Lost', color: 'red' },
];

export function DataView() {
  const [activeTab, setActiveTab] = useState<DataTab>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedTimeline, setSelectedTimeline] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedAgent, selectedTimeline, selectedStatus, customDateStart, customDateEnd]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (selectedTimeline) {
      case 'today':
        return { start: today.toISOString(), end: now.toISOString() };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday.toISOString(), end: today.toISOString() };
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        return { start: last7.toISOString(), end: now.toISOString() };
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        return { start: last30.toISOString(), end: now.toISOString() };
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return { start: weekStart.toISOString(), end: now.toISOString() };
      case 'thisMonth':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart.toISOString(), end: now.toISOString() };
      case 'custom':
        if (customDateStart && customDateEnd) {
          return { start: new Date(customDateStart).toISOString(), end: new Date(customDateEnd).toISOString() };
        }
        return null;
      default:
        return null;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (selectedAgent !== 'all') {
        params.append('agent', selectedAgent);
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }

      const dateRange = getDateRange();
      if (dateRange) {
        params.append('startDate', dateRange.start);
        params.append('endDate', dateRange.end);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_URL}/data/${activeTab}${queryString}`);

      if (res.ok) {
        const data = await res.json();
        setTotalCount(data.total || 0);

        if (activeTab === 'leads') setLeads(data.data || []);
        else if (activeTab === 'companies') setCompanies(data.data || []);
        else if (activeTab === 'tasks') setTasks(data.data || []);
        else if (activeTab === 'activity') setActivities(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  };

  const clearFilters = () => {
    setSelectedAgent('all');
    setSelectedTimeline('all');
    setSelectedStatus('all');
    setCustomDateStart('');
    setCustomDateEnd('');
  };

  const hasActiveFilters = selectedAgent !== 'all' || selectedTimeline !== 'all' || selectedStatus !== 'all';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400',
      researched: 'bg-purple-500/20 text-purple-400',
      contacted: 'bg-yellow-500/20 text-yellow-400',
      engaged: 'bg-orange-500/20 text-orange-400',
      meeting_booked: 'bg-green-500/20 text-green-400',
      closed_won: 'bg-emerald-600/20 text-emerald-300',
      closed_lost: 'bg-red-500/20 text-red-400',
      pending: 'bg-gray-500/20 text-gray-400',
      processing: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const getAgentEmoji = (agentId: string) => {
    const agent = AGENTS.find(a => a.id === agentId);
    return agent ? agent.emoji : '🤖';
  };

  const getAgentName = (agentId: string) => {
    const agent = AGENTS.find(a => a.id === agentId);
    return agent ? agent.name : agentId;
  };

  const tabs = [
    { id: 'leads', label: 'Leads' },
    { id: 'companies', label: 'Companies' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'activity', label: 'Activity Log' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header with tabs and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {totalCount} records
          </span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={fetchData}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-400 uppercase flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* Agent Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Agent</label>
              <div className="relative">
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                >
                  {AGENTS.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.emoji} {agent.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Timeline Filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                Timeline
              </label>
              <div className="relative">
                <select
                  value={selectedTimeline}
                  onChange={(e) => setSelectedTimeline(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                >
                  {TIMELINE_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Status Filter (for leads) */}
            {activeTab === 'leads' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
                  >
                    {LEAD_STATUSES.map(status => (
                      <option key={status.id} value={status.id}>{status.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Custom Date Range */}
            {selectedTimeline === 'custom' && (
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
              <span className="text-xs text-gray-500">Active:</span>
              {selectedAgent !== 'all' && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs flex items-center gap-1">
                  {getAgentEmoji(selectedAgent)} {getAgentName(selectedAgent)}
                  <button onClick={() => setSelectedAgent('all')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedTimeline !== 'all' && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs flex items-center gap-1">
                  {TIMELINE_PRESETS.find(t => t.id === selectedTimeline)?.label}
                  <button onClick={() => setSelectedTimeline('all')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {selectedStatus !== 'all' && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
                  {LEAD_STATUSES.find(s => s.id === selectedStatus)?.label}
                  <button onClick={() => setSelectedStatus('all')}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading...</p>
        </div>
      )}

      {/* Leads Table */}
      {activeTab === 'leads' && !loading && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Last Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                        <p className="text-sm text-gray-400">{lead.email}</p>
                        <p className="text-xs text-gray-500">{lead.title}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{lead.company_name}</p>
                        <p className="text-sm text-gray-400">{lead.domain}</p>
                        <span className="text-xs px-2 py-0.5 bg-gray-700 rounded">{lead.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-center">
                        <p className={`text-lg font-bold ${
                          lead.total_score >= 70 ? 'text-green-400' :
                          lead.total_score >= 50 ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          {lead.total_score || 0}
                        </p>
                        <p className="text-xs text-gray-500">ICP: {lead.icp_score || 0}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{lead.source}</td>
                    <td className="px-4 py-3">
                      {lead.last_agent ? (
                        <span className="text-sm">
                          {getAgentEmoji(lead.last_agent)} {getAgentName(lead.last_agent)}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No leads found matching filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Companies Table */}
      {activeTab === 'companies' && !loading && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Domain</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Has Assistant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Traffic</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Discovered By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {companies.map((company) => (
                  <tr key={company.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium">{company.name}</td>
                    <td className="px-4 py-3">
                      <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer"
                         className="text-blue-400 hover:underline">
                        {company.domain}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                        {company.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{company.region}</td>
                    <td className="px-4 py-3">
                      {company.has_shopping_assistant ? (
                        <span className="text-red-400">Yes</span>
                      ) : (
                        <span className="text-green-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {company.monthly_traffic ? company.monthly_traffic.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {company.discovered_by ? (
                        <span className="text-sm">
                          {getAgentEmoji(company.discovered_by)} {getAgentName(company.discovered_by)}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No companies found matching filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tasks Table */}
      {activeTab === 'tasks' && !loading && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Task Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Attempts</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        {getAgentEmoji(task.agent_type)} {getAgentName(task.agent_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{task.task_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{task.attempts}</td>
                    <td className="px-4 py-3 text-sm text-red-400 max-w-xs truncate">
                      {task.error || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(task.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {task.completed_at ? new Date(task.completed_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No tasks found matching filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Log */}
      {activeTab === 'activity' && !loading && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-700">
            {activities.length > 0 ? activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-700/30">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{getAgentEmoji(activity.agent)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{getAgentName(activity.agent)}</span>
                      <span className="text-gray-400">{activity.action}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{activity.target}</p>
                    {activity.details && (
                      <p className="text-xs text-gray-500 mt-1">{activity.details}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-gray-500">
                No activity found matching filters
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
