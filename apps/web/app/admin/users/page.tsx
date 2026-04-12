'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, supabaseAdmin, devChangePlan } from '@chefsbook/db';
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

interface AdminRow {
  user_id: string;
  role: string;
}

type SortKey = 'username' | 'email' | 'plan_tier' | 'created_at' | 'role';
type SortDir = 'asc' | 'desc';

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: 'bg-red-100', text: 'text-red-700', label: 'Super Admin' },
  admin: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Admin' },
  proctor: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Proctor' },
  user: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'User' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adminRoles, setAdminRoles] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabaseAdmin.from('user_profiles').select('*').order('created_at', { ascending: false }).limit(200);
      if (planFilter !== 'all') q = q.eq('plan_tier', planFilter);
      if (search.trim()) q = q.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
      const { data, error: err } = await q;
      if (err) throw err;
      setUsers((data ?? []) as UserRow[]);

      // Load admin roles
      const { data: admins } = await supabaseAdmin.from('admin_users').select('user_id, role');
      const roleMap = new Map<string, string>();
      for (const a of (admins ?? []) as AdminRow[]) roleMap.set(a.user_id, a.role);
      setAdminRoles(roleMap);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load users');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, planFilter]);

  const toggleSuspend = async (user: UserRow) => {
    setError(null);
    const { error: err } = await supabaseAdmin.from('user_profiles').update({ is_suspended: !user.is_suspended }).eq('id', user.id);
    if (err) setError(`Suspend toggle failed: ${err.message}`);
    load();
  };

  const changePlan = async (userId: string, plan: PlanTier) => {
    setError(null);
    try {
      await devChangePlan(userId, plan);
    } catch (e: any) {
      setError(`Plan change failed: ${e.message}`);
    }
    load();
  };

  const addAdminRole = async (userId: string, role: string) => {
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabaseAdmin.from('admin_users').upsert({ user_id: userId, role, added_by: user?.id }, { onConflict: 'user_id' });
    if (err) {
      setError(`Role change failed: ${err.message}`);
    }
    load();
  };

  const startEditUsername = (user: UserRow) => {
    setEditingUsername(user.id);
    setUsernameInput(user.username ?? '');
    setUsernameError(null);
  };

  const saveUsername = async (userId: string) => {
    const newName = usernameInput.trim().toLowerCase();
    if (!newName || newName.length < 3 || newName.length > 20) {
      setUsernameError('Username must be 3-20 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(newName)) {
      setUsernameError('Only lowercase letters, numbers, underscores');
      return;
    }
    setUsernameSaving(true);
    setUsernameError(null);
    // Check availability
    const { data: existing } = await supabaseAdmin.from('user_profiles').select('id').eq('username', newName).neq('id', userId).limit(1);
    if (existing && existing.length > 0) {
      setUsernameError('Username already taken');
      setUsernameSaving(false);
      return;
    }
    const { error: err } = await supabaseAdmin.from('user_profiles').update({ username: newName }).eq('id', userId);
    if (err) {
      setUsernameError(`Save failed: ${err.message}`);
    } else {
      setEditingUsername(null);
    }
    setUsernameSaving(false);
    load();
  };

  const getUserRole = (userId: string) => adminRoles.get(userId) ?? 'user';

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const sorted = useMemo(() => {
    const list = [...users];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'username': return dir * (a.username ?? '').localeCompare(b.username ?? '');
        case 'plan_tier': return dir * a.plan_tier.localeCompare(b.plan_tier);
        case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'role': return dir * getUserRole(a.id).localeCompare(getUserRole(b.id));
        default: return 0;
      }
    });
    return list;
  }, [users, sortKey, sortDir, adminRoles]);

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th
      onClick={() => toggleSort(sortKeyName)}
      className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none"
    >
      {label}{sortArrow(sortKeyName)}
    </th>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Management</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

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
                <SortHeader label="User" sortKeyName="username" />
                <SortHeader label="Plan" sortKeyName="plan_tier" />
                <SortHeader label="Role" sortKeyName="role" />
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recipes</th>
                <SortHeader label="Joined" sortKeyName="created_at" />
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const role = getUserRole(u.id);
                const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.user;
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{u.display_name ?? '—'}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {editingUsername === u.id ? (
                          <div className="flex items-center gap-1">
                            <span>@</span>
                            <input
                              value={usernameInput}
                              onChange={(e) => setUsernameInput(e.target.value)}
                              autoFocus
                              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28"
                              onKeyDown={(e) => { if (e.key === 'Enter') saveUsername(u.id); if (e.key === 'Escape') setEditingUsername(null); }}
                            />
                            <button onClick={() => saveUsername(u.id)} disabled={usernameSaving} className="text-green-600 hover:text-green-800 text-[10px] font-semibold">
                              {usernameSaving ? '...' : 'Save'}
                            </button>
                            <button onClick={() => setEditingUsername(null)} className="text-gray-400 hover:text-gray-600 text-[10px]">Cancel</button>
                            {usernameError && <span className="text-red-500 text-[10px]">{usernameError}</span>}
                          </div>
                        ) : (
                          <>
                            {u.username ? `@${u.username}` : 'no username'}
                            <button onClick={() => startEditUsername(u)} className="text-gray-400 hover:text-cb-primary" title="Edit username">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                            </button>
                          </>
                        )}
                      </div>
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
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                        {roleStyle.label}
                      </span>
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
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && <p className="p-8 text-center text-gray-500">No users found.</p>}
        </div>
      )}
    </div>
  );
}
