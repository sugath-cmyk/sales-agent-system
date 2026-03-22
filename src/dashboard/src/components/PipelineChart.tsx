
interface PipelineData {
  new?: number;
  researched?: number;
  contacted?: number;
  engaged?: number;
  meeting_booked?: number;
  demo_done?: number;
  proposal_sent?: number;
  negotiating?: number;
  closed_won?: number;
  closed_lost?: number;
  total_leads?: number;
}

export function PipelineChart({ data }: { data: PipelineData }) {
  const stages = [
    { key: 'new', label: 'New', color: 'bg-gray-500' },
    { key: 'researched', label: 'Researched', color: 'bg-blue-500' },
    { key: 'contacted', label: 'Contacted', color: 'bg-purple-500' },
    { key: 'engaged', label: 'Engaged', color: 'bg-yellow-500' },
    { key: 'meeting_booked', label: 'Meeting', color: 'bg-orange-500' },
    { key: 'demo_done', label: 'Demo', color: 'bg-pink-500' },
    { key: 'proposal_sent', label: 'Proposal', color: 'bg-cyan-500' },
    { key: 'closed_won', label: 'Won', color: 'bg-green-500' },
  ];

  const total = data.total_leads || Object.values(data).reduce((a, b) => a + (b || 0), 0) || 1;

  return (
    <div className="space-y-4">
      {/* Funnel Visualization */}
      <div className="relative">
        <div className="flex items-end justify-between h-40 gap-1">
          {stages.map((stage) => {
            const value = data[stage.key as keyof PipelineData] as number || 0;
            const percentage = Math.max((value / total) * 100, 2);
            const height = Math.max(percentage * 2, 10);

            return (
              <div
                key={stage.key}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className={`w-full ${stage.color} rounded-t-lg transition-all duration-500 hover:opacity-80 cursor-pointer relative group`}
                  style={{ height: `${height}%`, minHeight: '20px' }}
                >
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                    {value} leads
                  </div>
                </div>
                <span className={`text-2xl font-bold mt-2 ${value > 0 ? 'text-white' : 'text-gray-600'}`}>
                  {value}
                </span>
                <span className="text-xs text-gray-500 mt-1">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion Rates */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <ConversionRate
          from="New"
          to="Contacted"
          fromValue={data.new || 0}
          toValue={data.contacted || 0}
        />
        <ConversionRate
          from="Contacted"
          to="Engaged"
          fromValue={data.contacted || 0}
          toValue={data.engaged || 0}
        />
        <ConversionRate
          from="Engaged"
          to="Meeting"
          fromValue={data.engaged || 0}
          toValue={data.meeting_booked || 0}
        />
        <ConversionRate
          from="Meeting"
          to="Won"
          fromValue={data.meeting_booked || 0}
          toValue={data.closed_won || 0}
        />
      </div>
    </div>
  );
}

function ConversionRate({
  from,
  to,
  fromValue,
  toValue,
}: {
  from: string;
  to: string;
  fromValue: number;
  toValue: number;
}) {
  const rate = fromValue > 0 ? ((toValue / fromValue) * 100).toFixed(0) : '0';

  return (
    <div className="text-center">
      <p className="text-xs text-gray-500">
        {from} → {to}
      </p>
      <p className={`text-lg font-bold ${parseInt(rate) > 30 ? 'text-green-400' : parseInt(rate) > 15 ? 'text-yellow-400' : 'text-red-400'}`}>
        {rate}%
      </p>
    </div>
  );
}
