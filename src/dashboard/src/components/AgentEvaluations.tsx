import { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { API_BASE } from '../config/api';

const API_URL = `${API_BASE}/api`;

interface Evaluation {
  agent_type: string;
  agent_name: string;
  evaluation: string;
  score: string;
  feedback: string;
  created_at: string;
}

export function AgentEvaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvaluations();
    const interval = setInterval(fetchEvaluations, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvaluations = async () => {
    try {
      const res = await fetch(`${API_URL}/evaluations`);
      const data = await res.json();
      setEvaluations(data);
    } catch (error) {
      console.error('Failed to fetch evaluations:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-gray-400">Loading evaluations...</div>;
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No evaluations yet</p>
        <p className="text-sm">Chief will evaluate agents daily</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
      {evaluations.map((evaluation, index) => (
        <EvaluationCard key={index} evaluation={evaluation} />
      ))}
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  const getScoreColor = (score: string) => {
    const numScore = parseInt(score);
    if (numScore >= 80) return 'text-green-400 bg-green-500/20';
    if (numScore >= 60) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getTrendIcon = (evaluation: string) => {
    const lower = evaluation.toLowerCase();
    if (lower.includes('excellent') || lower.includes('outstanding')) {
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    }
    if (lower.includes('poor') || lower.includes('needs improvement')) {
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gray-700/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{evaluation.agent_name}</span>
          {getTrendIcon(evaluation.evaluation)}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(evaluation.score)}`}>
            {evaluation.score}/100
          </span>
        </div>
      </div>
      {evaluation.feedback && (
        <p className="text-sm text-gray-400 italic">&ldquo;{evaluation.feedback}&rdquo;</p>
      )}
      <p className="text-xs text-gray-500 mt-2">{formatDate(evaluation.created_at)}</p>
    </div>
  );
}
