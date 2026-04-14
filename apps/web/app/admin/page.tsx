'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminFetch';

interface Stats {
  totalUsers: number;
  planCounts: Record<string, number>;
  newToday: number;
  totalRecipes: number;
  flaggedCount: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch({ page: 'overview' })
      .then((data) => setStats(data))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-600 text-sm">{error}</div>;
  if (!stats) return <div className="text-gray-500 text-sm">Loading...</div>;

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'text-blue-600' },
    { label: 'New Today', value: stats.newToday, color: 'text-green-600' },
    { label: 'Total Recipes', value: stats.totalRecipes, color: 'text-purple-600' },
    { label: 'Flagged Comments', value: stats.flaggedCount, color: stats.flaggedCount > 0 ? 'text-red-600' : 'text-gray-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Users by Plan</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['free', 'chef', 'family', 'pro'].map((plan) => (
          <div key={plan} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-500 capitalize">{plan}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.planCounts[plan] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
