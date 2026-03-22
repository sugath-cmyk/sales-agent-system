import { useState, useEffect } from 'react';
import { Mail, Linkedin, Search, FileText, Target, Award, Megaphone } from 'lucide-react';
import { API_BASE } from '../config/api';

const API_URL = `${API_BASE}/api`;

interface ActivityEvent {
  id: string;
  event_type: string;
  agent_type: string;
  agent_name: string;
  lead_id: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchActivity = async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard/activity?limit=20`);
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading activity...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
      {events.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </div>
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const getIcon = () => {
    const agentType = event.agent_type;
    switch (agentType) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'linkedin':
        return <Linkedin className="w-4 h-4" />;
      case 'lead_research':
        return <Search className="w-4 h-4" />;
      case 'content':
        return <FileText className="w-4 h-4" />;
      case 'orchestrator':
        return <Target className="w-4 h-4" />;
      case 'leader':
        return <Award className="w-4 h-4" />;
      case 'ads':
        return <Megaphone className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getColor = () => {
    switch (event.event_type) {
      case 'email_sent':
      case 'sequence_started':
        return 'text-blue-400 bg-blue-500/20';
      case 'email_opened':
      case 'email_clicked':
        return 'text-green-400 bg-green-500/20';
      case 'positive_reply_received':
      case 'meeting_booked':
        return 'text-green-400 bg-green-500/20';
      case 'lead_discovered':
      case 'store_scanned':
        return 'text-purple-400 bg-purple-500/20';
      case 'lead_scored':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'daily_review':
      case 'feedback':
        return 'text-orange-400 bg-orange-500/20';
      case 'campaign_created':
        return 'text-pink-400 bg-pink-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getMessage = () => {
    switch (event.event_type) {
      case 'email_sent':
        return 'Email sent';
      case 'email_opened':
        return 'Email opened';
      case 'email_clicked':
        return 'Link clicked';
      case 'sequence_started':
        return 'Email sequence started';
      case 'positive_reply_received':
        return 'Positive reply received!';
      case 'meeting_booked':
        return 'Meeting booked!';
      case 'lead_discovered':
        return 'New lead discovered';
      case 'store_scanned':
        return 'Store scanned';
      case 'lead_scored':
        return `Lead scored: ${event.properties?.total_score || 'N/A'}`;
      case 'daily_review':
        return 'Daily review completed';
      case 'feedback':
        return 'Agent feedback given';
      case 'campaign_created':
        return 'Ad campaign created';
      case 'campaign_paused':
        return 'Ad campaign paused';
      default:
        return event.event_type.replace(/_/g, ' ');
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getColor()}`}>
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{event.agent_name || 'System'}</span>
          <span className="text-xs text-gray-500">{timeAgo(event.created_at)}</span>
        </div>
        <p className="text-sm text-gray-400">{getMessage()}</p>
      </div>
      {event.event_type === 'meeting_booked' && (
        <span className="text-xl">🎉</span>
      )}
    </div>
  );
}
