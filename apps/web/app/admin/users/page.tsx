'use client';

import { useState, useEffect } from 'react';
import { supabase, devChangePlan } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';

interface UserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan_tier: string;
  is_suspended: boolean;
  is_searchable: boolean;
  follower_count: number;
  recipe_count: number;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('user_profiles').select('*').order('created_at', { ascending: false }).limit(100);
    if (planFilter !== 'all') q = q.eq('plan_tier', planFilter);
    if (search.trim()) q = q.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    const { data } = await q;
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, planFilter]);

  const toggleSuspend = async (user: UserRow) => {
    await supabase.from('user_profiles').update({ is_suspended: !user.is_suspended }).eq('id', user.id);
    load();
  };

  const changePlan = async (userId: string, plan: PlanTier) => {
    await devChangePlan(userId, plan);
    load();
  };

  const addAdminRole = async (userId: string, role: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('admin_users').upsert({ user_id: userId, role, added_by: session?.user?.id }, { onConflict: 'user_id' });
    alert(`Admin role ${role} granted.`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Management</h1>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username or name..."
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="chef">Chef</option>
          <option value="family">Family</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Plan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recipes</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.display_name ?? '—'}</div>
                    <div className="text-xs text-gray-500">{u.username ? `@${u.username}` : 'no username'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan_tier}
                      onChange={(e) => changePlan(u.id, e.target.value as PlanTier)}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      {['free', 'chef', 'family', 'pro'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.is_suspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {u.is_suspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.recipe_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => toggleSuspend(u)} className={`text-xs px-2 py-1 rounded ${u.is_suspended ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
                        {u.is_suspended ? 'Restore' : 'Suspend'}
                      </button>
                      <button onClick={() => addAdminRole(u.id, 'proctor')} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100">
                        + Proctor
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="p-8 text-center text-gray-500">No users found.</p>}
        </div>
      )}
    </div>
  );
}
