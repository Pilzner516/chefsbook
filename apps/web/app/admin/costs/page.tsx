'use client';

import { useEffect, useState } from 'react';
import { adminFetch, adminPost } from '@/lib/adminFetch';

interface ServiceData {
  service: string;
  cost: number;
  count: number;
  allTimeCost: number;
}

interface FeatureData {
  feature: string;
  cost: number;
  count: number;
}

interface ServiceModelData {
  service: string;
  model: string;
  action: string;
  cost: number;
  count: number;
}

interface DailySpend {
  date: string;
  cost: number;
}

interface CostsData {
  todayCost: number;
  monthCost: number;
  last30Cost: number;
  allTimeCost: number;
  avgPerUser: number;
  mostExpensiveFeature: FeatureData | null;
  byAction: [string, number][];
  byModel: [string, number][];
  byDay: [string, number][];
  byService: ServiceData[];
  byFeature: FeatureData[];
  byServiceModel: ServiceModelData[];
  dailySpend: DailySpend[];
  topUsers: any[];
  throttled: any[];
  totalCalls: number;
  totalCallsLast30: number;
  totalCallsAllTime: number;
}

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null);
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
  const fmtShort = (n: number) => `$${n.toFixed(2)}`;

  const maxDailyCost = data.dailySpend.length > 0 ? Math.max(...data.dailySpend.map(d => d.cost)) : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">API Costs Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'This Month', value: fmtShort(data.monthCost), sub: `${data.totalCalls} calls` },
          { label: 'Last 30 Days', value: fmtShort(data.last30Cost), sub: `${data.totalCallsLast30} calls` },
          { label: 'All Time', value: fmtShort(data.allTimeCost), sub: `${data.totalCallsAllTime} calls` },
          { label: 'Top Feature', value: data.mostExpensiveFeature ? fmtShort(data.mostExpensiveFeature.cost) : '-', sub: data.mostExpensiveFeature?.feature ?? 'None' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase">{card.label}</p>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Service Balance Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Anthropic */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🧠</span>
            <span className="font-semibold">Anthropic</span>
          </div>
          <p className="text-sm text-gray-500">This Month: <span className="font-mono">{fmtShort(data.byService.find(s => s.service === 'Anthropic')?.cost ?? 0)}</span></p>
          <p className="text-sm text-gray-500">All Time: <span className="font-mono">{fmtShort(data.byService.find(s => s.service === 'Anthropic')?.allTimeCost ?? 0)}</span></p>
          <p className="text-xs text-gray-400 mt-2">Check <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">console.anthropic.com</a> for balance</p>
        </div>

        {/* Replicate */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎨</span>
            <span className="font-semibold">Replicate</span>
          </div>
          <p className="text-sm text-gray-500">This Month: <span className="font-mono">{fmtShort(data.byService.find(s => s.service === 'Replicate')?.cost ?? 0)}</span></p>
          <p className="text-sm text-gray-500">All Time: <span className="font-mono">{fmtShort(data.byService.find(s => s.service === 'Replicate')?.allTimeCost ?? 0)}</span></p>
          <p className="text-xs text-gray-400 mt-2">Balance: <a href="https://replicate.com/account/billing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">replicate.com/account/billing</a></p>
        </div>

        {/* OpenAI (if any) */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <span className="font-semibold">OpenAI</span>
          </div>
          <p className="text-sm text-gray-500">This Month: <span className="font-mono">{fmtShort(data.byService.find(s => s.service === 'OpenAI')?.cost ?? 0)}</span></p>
          <p className="text-sm text-gray-500">All Time: <span className="font-mono">{fmtShort(data.byService.find(s => s.service === 'OpenAI')?.allTimeCost ?? 0)}</span></p>
          <p className="text-xs text-gray-400 mt-2">Not configured</p>
        </div>
      </div>

      {/* Daily Spend Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Daily Spend (Last 30 Days)</h2>
        {data.dailySpend.length === 0 ? (
          <p className="text-gray-400 text-sm">No data yet</p>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {data.dailySpend.map((d, i) => {
              const height = maxDailyCost > 0 ? (d.cost / maxDailyCost) * 100 : 0;
              const isToday = d.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className={`w-full rounded-t ${isToday ? 'bg-cb-primary' : 'bg-blue-400'} transition-all`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {d.date}: {fmt(d.cost)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{data.dailySpend[0]?.date ?? ''}</span>
          <span>{data.dailySpend[data.dailySpend.length - 1]?.date ?? ''}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Spending by Service Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3">Spending by Service (MTD)</h2>
          {data.byServiceModel.length === 0 ? (
            <p className="text-gray-400 text-sm">No AI calls logged yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs">
                <tr>
                  <th className="text-left pb-2">Service</th>
                  <th className="text-left pb-2">Model</th>
                  <th className="text-left pb-2">Feature</th>
                  <th className="text-right pb-2">Calls</th>
                  <th className="text-right pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.byServiceModel.slice(0, 15).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        row.service === 'Anthropic' ? 'bg-purple-100 text-purple-700' :
                        row.service === 'Replicate' ? 'bg-amber-100 text-amber-700' :
                        row.service === 'OpenAI' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{row.service}</span>
                    </td>
                    <td className="py-1.5 text-gray-600 text-xs">{row.model}</td>
                    <td className="py-1.5 text-gray-600 text-xs">{row.action}</td>
                    <td className="py-1.5 text-right text-gray-500">{row.count}</td>
                    <td className="py-1.5 text-right font-mono">{fmt(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Spending by Feature Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3">Spending by Feature (MTD)</h2>
          {data.byFeature.length === 0 ? (
            <p className="text-gray-400 text-sm">No AI calls logged yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs">
                <tr>
                  <th className="text-left pb-2">Feature</th>
                  <th className="text-right pb-2">Calls</th>
                  <th className="text-right pb-2">Cost</th>
                  <th className="text-right pb-2">Avg/Call</th>
                </tr>
              </thead>
              <tbody>
                {data.byFeature.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5">{row.feature}</td>
                    <td className="py-1.5 text-right text-gray-500">{row.count}</td>
                    <td className="py-1.5 text-right font-mono">{fmt(row.cost)}</td>
                    <td className="py-1.5 text-right font-mono text-gray-500">{fmt(row.count > 0 ? row.cost / row.count : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Cost by Action */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-3">Cost by Action (MTD)</h2>
          {data.byAction.length === 0 ? (
            <p className="text-gray-400 text-sm">No AI calls logged yet</p>
          ) : (
            <div className="space-y-2">
              {data.byAction.slice(0, 10).map(([action, cost]) => {
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
              {data.byModel.map(([model, cost]) => {
                const colors: Record<string, string> = {
                  haiku: 'bg-blue-400', sonnet: 'bg-purple-400',
                  'flux-schnell': 'bg-amber-400', 'flux-dev': 'bg-green-400',
                };
                const colorKey = Object.keys(colors).find(k => model.toLowerCase().includes(k)) ?? '';
                const pct = data.monthCost > 0 ? (cost / data.monthCost) * 100 : 0;
                return (
                  <div key={model} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-32 truncate">{model}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className={`h-full rounded ${colors[colorKey] ?? 'bg-gray-400'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
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
