import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

const API_URL = `${API_BASE}/api/dashboard`;

type DataTab = 'leads' | 'companies' | 'tasks' | 'emails';

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

export function DataView() {
  const [activeTab, setActiveTab] = useState<DataTab>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  const fetchData = async (tab: DataTab) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/data/${tab}`);
      if (res.ok) {
        const data = await res.json();
        if (tab === 'leads') setLeads(data.data || []);
        else if (tab === 'companies') setCompanies(data.data || []);
        else if (tab === 'tasks') setTasks(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400',
      researched: 'bg-purple-500/20 text-purple-400',
      contacted: 'bg-yellow-500/20 text-yellow-400',
      engaged: 'bg-orange-500/20 text-orange-400',
      meeting_booked: 'bg-green-500/20 text-green-400',
      closed_won: 'bg-green-600/20 text-green-300',
      closed_lost: 'bg-red-500/20 text-red-400',
      pending: 'bg-gray-500/20 text-gray-400',
      processing: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  const tabs = [
    { id: 'leads', label: 'Leads', count: leads.length },
    { id: 'companies', label: 'Companies', count: companies.length },
    { id: 'tasks', label: 'Tasks', count: tasks.length },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
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
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-black/20 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => fetchData(activeTab)}
          className="ml-auto px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          Refresh
        </button>
      </div>

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
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No leads found
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
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No companies found
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium">{task.agent_type}</td>
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
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No tasks found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
