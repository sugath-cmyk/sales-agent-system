import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import { Play, DollarSign, Clock, AlertTriangle, CheckCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = `${API_BASE}/api`;

interface Parameter {
  name: string;
  type: 'number' | 'string' | 'select' | 'boolean';
  label: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

interface Trigger {
  id: string;
  name: string;
  description: string;
  parameters: Parameter[];
}

interface KRA {
  id: string;
  name: string;
  description: string;
  target: string;
  impact: string;
  metric: string;
  targetValue?: number;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  channel: string;
  goal: string;
  impactStatement: string;
  kras: KRA[];
  triggers: Trigger[];
}

interface CostPreview {
  agent: { id: string; name: string; emoji: string };
  trigger: { id: string; name: string; description: string };
  parameters: Record<string, unknown>;
  costEstimate: {
    anthropicCost: string;
    externalApiCost: string;
    totalCost: string;
    estimatedTime: string;
    breakdown: string[];
  };
  apiStatus: Record<string, boolean>;
  canRun: boolean;
  warnings: string[];
  message: string;
}

export function AgentTriggers() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<{ agentId: string; trigger: Trigger } | null>(null);
  const [triggerParams, setTriggerParams] = useState<Record<string, unknown>>({});
  const [costPreview, setCostPreview] = useState<CostPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/agents/full`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const selectTrigger = (agentId: string, trigger: Trigger) => {
    setSelectedTrigger({ agentId, trigger });
    setCostPreview(null);
    setResult(null);
    // Initialize params with defaults
    const defaults: Record<string, unknown> = {};
    trigger.parameters.forEach(p => {
      defaults[p.name] = p.default;
    });
    setTriggerParams(defaults);
  };

  const previewCost = async () => {
    if (!selectedTrigger) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/agents/${selectedTrigger.agentId}/triggers/${selectedTrigger.trigger.id}/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(triggerParams),
        }
      );
      if (res.ok) {
        const preview = await res.json();
        setCostPreview(preview);
      }
    } catch (error) {
      console.error('Failed to preview cost:', error);
    }
    setLoading(false);
  };

  const executeTrigger = async () => {
    if (!selectedTrigger || !costPreview?.canRun) return;
    setExecuting(true);
    try {
      const res = await fetch(
        `${API_URL}/agents/${selectedTrigger.agentId}/triggers/${selectedTrigger.trigger.id}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: triggerParams, approved: true }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message });
        setCostPreview(null);
        setSelectedTrigger(null);
      } else {
        setResult({ success: false, message: data.error || 'Execution failed' });
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error' });
    }
    setExecuting(false);
  };

  const renderParamInput = (param: Parameter) => {
    const value = triggerParams[param.name] ?? param.default;

    if (param.type === 'number') {
      return (
        <input
          type="number"
          min={param.min}
          max={param.max}
          value={value as number}
          onChange={(e) => setTriggerParams({ ...triggerParams, [param.name]: parseInt(e.target.value) })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
        />
      );
    }

    if (param.type === 'select') {
      return (
        <select
          value={value as string}
          onChange={(e) => setTriggerParams({ ...triggerParams, [param.name]: e.target.value })}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
        >
          {param.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (param.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => setTriggerParams({ ...triggerParams, [param.name]: e.target.checked })}
            className="w-5 h-5 rounded bg-gray-700 border-gray-600"
          />
          <span className="text-gray-300">{param.label}</span>
        </label>
      );
    }

    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => setTriggerParams({ ...triggerParams, [param.name]: e.target.value })}
        placeholder={param.label}
        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Result notification */}
      {result && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{result.message}</span>
          <button onClick={() => setResult(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Agent list with KRAs */}
      <div className="grid gap-4">
        {agents.map(agent => (
          <div key={agent.id} className="bg-gray-800 rounded-lg overflow-hidden">
            {/* Agent header */}
            <button
              onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{agent.emoji}</span>
                <div className="text-left">
                  <h3 className="font-bold text-lg">{agent.name}</h3>
                  <p className="text-gray-400 text-sm">{agent.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                  {agent.triggers.length} triggers
                </span>
                {expandedAgent === agent.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>

            {/* Expanded content */}
            {expandedAgent === agent.id && (
              <div className="border-t border-gray-700 p-4 space-y-4">
                {/* Impact statement */}
                <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-3">
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold text-white">Impact:</span> {agent.impactStatement}
                  </p>
                </div>

                {/* KRAs */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Key Result Areas</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {agent.kras.map(kra => (
                      <div key={kra.id} className="bg-gray-700/50 rounded-lg p-3">
                        <p className="font-medium text-sm">{kra.name}</p>
                        <p className="text-lg font-bold text-green-400">{kra.target}</p>
                        <p className="text-xs text-gray-400 mt-1">{kra.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Triggers */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase mb-2">Available Actions</h4>
                  <div className="grid gap-2">
                    {agent.triggers.map(trigger => (
                      <button
                        key={trigger.id}
                        onClick={() => selectTrigger(agent.id, trigger)}
                        className={`p-3 rounded-lg text-left transition-colors ${
                          selectedTrigger?.trigger.id === trigger.id && selectedTrigger?.agentId === agent.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{trigger.name}</span>
                          <Play className="w-4 h-4" />
                        </div>
                        <p className="text-sm text-gray-300 mt-1">{trigger.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Trigger configuration modal */}
      {selectedTrigger && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agents.find(a => a.id === selectedTrigger.agentId)?.emoji}</span>
                <div>
                  <h3 className="font-bold">{selectedTrigger.trigger.name}</h3>
                  <p className="text-sm text-gray-400">{selectedTrigger.trigger.description}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedTrigger(null); setCostPreview(null); }} className="p-2 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Parameters */}
            <div className="p-4 space-y-4">
              <h4 className="font-semibold">Configure Parameters</h4>
              {selectedTrigger.trigger.parameters.map(param => (
                <div key={param.name}>
                  <label className="block text-sm text-gray-400 mb-1">{param.label}</label>
                  {renderParamInput(param)}
                </div>
              ))}

              {/* Preview button */}
              <button
                onClick={previewCost}
                disabled={loading}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4" />
                {loading ? 'Calculating...' : 'Preview Cost'}
              </button>

              {/* Cost preview */}
              {costPreview && (
                <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    Cost Estimate
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-800 rounded p-2">
                      <p className="text-gray-400">Anthropic API</p>
                      <p className="font-bold text-lg">{costPreview.costEstimate.anthropicCost}</p>
                    </div>
                    <div className="bg-gray-800 rounded p-2">
                      <p className="text-gray-400">External APIs</p>
                      <p className="font-bold text-lg">{costPreview.costEstimate.externalApiCost}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-green-600/20 rounded p-3">
                    <div>
                      <p className="text-sm text-gray-300">Total Estimated Cost</p>
                      <p className="text-2xl font-bold text-green-400">{costPreview.costEstimate.totalCost}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-300">Estimated Time</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {costPreview.costEstimate.estimatedTime}
                      </p>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="text-xs text-gray-400 space-y-1">
                    {costPreview.costEstimate.breakdown.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  {/* Warnings */}
                  {costPreview.warnings.length > 0 && (
                    <div className="bg-yellow-500/20 rounded p-3">
                      {costPreview.warnings.map((warning, i) => (
                        <p key={i} className="text-yellow-400 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Execute button */}
                  {costPreview.canRun ? (
                    <button
                      onClick={executeTrigger}
                      disabled={executing}
                      className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {executing ? 'Executing...' : 'Approve & Execute'}
                    </button>
                  ) : (
                    <div className="text-center text-red-400 py-3">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                      <p>{costPreview.message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
