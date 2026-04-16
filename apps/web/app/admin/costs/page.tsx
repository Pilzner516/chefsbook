'use client';

import { useEffect, useState } from 'react';
import { adminFetch, adminPost } from '@/lib/adminFetch';

export default function CostsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await adminFetch({ page: 'costs' });
      setData(d);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load cost data</p>;

  const fmt = (n: number) => `$${n.toFixed(4)}`;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">AI Cost Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Today', value: fmt(data.todayCost), sub: 'AI spend' },
          { label: 'This Month', value: fmt(data.monthCost), sub: `${data.totalCalls} calls` },
          { label: 'Avg / User', value: fmt(data.avgPerUser), sub: 'monthly' },
          { label: 'Throttled', value: String(data.throttled?.length ?? 0), sub: 'users' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Cost by Action */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3">Cost by Action (MTD)</h2>
          {data.byAction.length === 0 ? (
            <p className="text-gray-400 text-sm">No AI calls logged yet</p>
          ) : (
            <div className="space-y-2">
              {(data.byAction as [string, number][]).map(([action, cost]) => {
                const pct = data.monthCost > 0 ? (cost / data.monthCost) * 100 : 0;
                return (
                  <div key={action} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-40 truncate">{action}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-cb-primary/70 rounded" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{fmt(cost)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cost by Model */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3">Cost by Model (MTD)</h2>
          {data.byModel.length === 0 ? (
            <p className="text-gray-400 text-sm">No AI calls logged yet</p>
          ) : (
            <div className="space-y-2">
              {(data.byModel as [string, number][]).map(([model, cost]) => {
                const colors: Record<string, string> = {
                  haiku: 'bg-blue-400', sonnet: 'bg-purple-400',
                  'flux-schnell': 'bg-amber-400', 'flux-dev': 'bg-green-400',
                };
                const pct = data.monthCost > 0 ? (cost / data.monthCost) * 100 : 0;
                return (
                  <div key={model} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-28">{model}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className={`h-full rounded ${colors[model] ?? 'bg-gray-400'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{fmt(cost)}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Top Cost Users (MTD)</h2>
        {data.topUsers.length === 0 ? (
          <p className="text-gray-400 text-sm">No user AI costs yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr><th className="text-left pb-2">User</th><th className="text-left pb-2">Plan</th><th className="text-right pb-2">Cost</th></tr>
            </thead>
            <tbody>
              {data.topUsers.map((u: any) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="py-1.5">@{u.username ?? u.id?.slice(0, 8)}</td>
                  <td className="py-1.5"><span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{u.plan_tier}</span></td>
                  <td className="py-1.5 text-right font-mono">{fmt(u.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Throttled Users */}
      {data.throttled.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h2 className="text-sm font-semibold mb-3 text-red-700">Throttled Users</h2>
          <div className="space-y-2">
            {data.throttled.map((t: any) => (
              <div key={t.user_id} className="flex items-center justify-between text-sm">
                <div>
                  <span className={`mr-2 ${t.throttle_level === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                    {t.throttle_level === 'red' ? '🔴' : '⚠️'} {t.throttle_level}
                  </span>
                  <span className="text-gray-500 text-xs">{t.throttled_reason}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => { await adminPost({ action: 'removeThrottle', userId: t.user_id }); load(); }}
                    className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                  >
                    Remove
                  </button>
                  <button
                    onClick={async () => { await adminPost({ action: 'whitelistUser', userId: t.user_id }); load(); }}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    Whitelist
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
