'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/adminFetch';

interface Stats {
  totalUsers: number;
  planCounts: Record<string, number>;
  newToday: number;
  totalRecipes: number;
  flaggedCount: number;
}

interface CostData {
  todayCost: number;
  monthCost: number;
  totalCalls: number;
  throttled: any[];
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [costs, setCosts] = useState<CostData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch({ page: 'overview' }).then(setStats).catch((e) => setError(e.message));
    adminFetch({ page: 'costs' }).then(setCosts).catch(() => {});
  }, []);

  if (error) return <div className="text-red-600 text-sm">{error}</div>;
  if (!stats) return <div className="text-gray-500 text-sm">Loading...</div>;

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const planPrices: Record<string, number> = { free: 0, chef: 4.99, family: 9.99, pro: 14.99 };
  const mrr = Object.entries(stats.planCounts).reduce((s, [plan, count]) => s + (planPrices[plan] ?? 0) * count, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Command Center</h1>

      {/* Section 1 — Platform Health KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-600' },
          { label: 'New Today', value: stats.newToday, color: 'text-green-600' },
          { label: 'Total Recipes', value: stats.totalRecipes, color: 'text-purple-600' },
          { label: 'Flagged', value: stats.flaggedCount, color: stats.flaggedCount > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'AI Calls MTD', value: costs?.totalCalls ?? '—', color: 'text-amber-600' },
          { label: 'Throttled', value: costs?.throttled?.length ?? 0, color: (costs?.throttled?.length ?? 0) > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Section 2 — Revenue & Cost */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase">MRR</p>
          <p className="text-2xl font-bold text-green-600">{fmt(mrr)}</p>
          <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
            {['chef', 'family', 'pro'].map((p) => (
              <div key={p}><span className="capitalize">{p}:</span> {stats.planCounts[p] ?? 0}</div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase">AI Cost MTD</p>
          <p className="text-2xl font-bold text-amber-600">{costs ? fmt(costs.monthCost) : '—'}</p>
          {costs && mrr > 0 && (
            <p className="text-[10px] text-gray-400 mt-1">
              Margin: {((1 - costs.monthCost / mrr) * 100).toFixed(0)}%
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Plan Distribution</p>
          <div className="mt-1 space-y-1">
            {['free', 'chef', 'family', 'pro'].map((p) => {
              const pct = stats.totalUsers > 0 ? ((stats.planCounts[p] ?? 0) / stats.totalUsers * 100) : 0;
              return (
                <div key={p} className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 w-12 capitalize">{p}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full bg-cb-primary/50 rounded" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 w-8 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase">AI Cost Today</p>
          <p className="text-2xl font-bold">{costs ? fmt(costs.todayCost) : '—'}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            {costs?.totalCalls ?? 0} API calls this month
          </p>
        </div>
      </div>

      {/* Section 3 — Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { href: '/admin/import-sites', label: 'Import Sites' },
          { href: '/admin/incomplete-recipes', label: 'Incomplete Recipes' },
          { href: '/admin/flags', label: 'Flagged Comments' },
          { href: '/admin/copyright', label: 'Copyright Queue' },
          { href: '/admin/costs', label: 'Cost Dashboard' },
          { href: '/admin/settings', label: 'Settings' },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className="px-3 py-1.5 text-sm rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition"
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Section 4 — Users by Plan (detail) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold mb-3">Users by Plan</h2>
        <div className="grid grid-cols-4 gap-3">
          {['free', 'chef', 'family', 'pro'].map((plan) => (
            <div key={plan} className="text-center">
              <p className="text-2xl font-bold">{stats.planCounts[plan] ?? 0}</p>
              <p className="text-xs text-gray-500 capitalize">{plan}</p>
              {plan !== 'free' && <p className="text-[10px] text-gray-400">{fmt(planPrices[plan])}/mo</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
