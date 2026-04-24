'use client';

import { useState, useEffect, useMemo } from 'react';
import type { PlanTier } from '@chefsbook/db';
import { supabase } from '@chefsbook/db';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import { useConfirmDialog, useAlertDialog } from '@/components/useConfirmDialog';

interface UserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  plan_tier: string;
  image_quality_override: 'schnell' | 'dev' | null;
  is_suspended: boolean;
  is_searchable: boolean;
  follower_count: number;
  recipe_count: number;
  created_at: string;
  account_status: 'active' | 'suspended' | 'expelled';
  last_seen_at: string | null;
  last_sign_in_at: string | null;
  login_count: number;
}

interface TagRow { user_id: string; tag: string; }
interface FlagRow { id: string; user_id: string; flag_type: string; note: string | null; created_at: string; }

const GREEN_TAGS = new Set(['VIP', 'Beta Tester', 'Partner', 'Influencer', 'Press', 'Paid', 'Comped', 'Trial Extended', 'Verified Chef', 'Featured Chef', 'Author']);
const DEFAULT_TAGS = ['Verified Chef', 'Featured Chef', 'Author', 'VIP', 'Beta Tester', 'Partner', 'Influencer', 'Press', 'Flagged', 'Under Review', 'Canceled', 'Churned', 'Paid', 'Comped', 'Trial Extended', 'Banned'];

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
  user: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Member' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [adminRoles, setAdminRoles] = useState<Map<string, string>>(new Map());
  const [userTags, setUserTags] = useState<Map<string, string[]>>(new Map());
  const [userFlags, setUserFlags] = useState<Map<string, FlagRow[]>>(new Map());
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [showBulkMessage, setShowBulkMessage] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [tagPopover, setTagPopover] = useState<string | null>(null);

  // Create account modal state
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createPlan, setCreatePlan] = useState<'free' | 'chef' | 'family' | 'pro'>('free');
  const [createRole, setCreateRole] = useState<'user' | 'admin'>('user');
  const [createSendWelcome, setCreateSendWelcome] = useState(false);
  const [createShowPassword, setCreateShowPassword] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [statusConfirm, StatusDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();
  const [statusReason, setStatusReason] = useState('');
  const [statusAction, setStatusAction] = useState<{ userId: string; type: 'suspend' | 'expel' } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'users', plan: planFilter, search });
      setUsers((data.users ?? []) as UserRow[]);
      const roleMap = new Map<string, string>();
      for (const a of (data.admins ?? []) as AdminRow[]) roleMap.set(a.user_id, a.role);
      setAdminRoles(roleMap);
      // Tags
      const tMap = new Map<string, string[]>();
      for (const t of (data.tags ?? []) as TagRow[]) {
        if (!tMap.has(t.user_id)) tMap.set(t.user_id, []);
        tMap.get(t.user_id)!.push(t.tag);
      }
      setUserTags(tMap);
      // Flags
      const fMap = new Map<string, FlagRow[]>();
      for (const f of (data.flags ?? []) as FlagRow[]) {
        if (!fMap.has(f.user_id)) fMap.set(f.user_id, []);
        fMap.get(f.user_id)!.push(f);
      }
      setUserFlags(fMap);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load users');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, planFilter]);

  const createAccount = async () => {
    setCreateError(null);

    // Validate fields
    if (!createEmail || !createPassword || !createUsername) {
      setCreateError('Please fill in all required fields');
      return;
    }

    if (createPassword.length < 8) {
      setCreateError('Password must be at least 8 characters');
      return;
    }

    setCreateSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: createEmail,
          password: createPassword,
          username: createUsername,
          displayName: createDisplayName,
          plan: createPlan,
          role: createRole,
          sendWelcomeEmail: createSendWelcome,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }

      const result = await response.json();

      // Close modal and reset form
      setShowCreateAccount(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateUsername('');
      setCreateDisplayName('');
      setCreatePlan('free');
      setCreateRole('user');
      setCreateSendWelcome(false);
      setCreateShowPassword(false);
      setEmailAvailable(null);
      setUsernameAvailable(null);

      // Show success message
      setError(null);
      showAlert({ title: 'Success', body: `Account created for ${result.email}` });

      // Reload users list
      load();
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create account. Please try again.');
    }
    setCreateSaving(false);
  };

  const checkEmailAvailability = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailAvailable(null);
      return;
    }

    setEmailChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session found for email check');
        return;
      }

      const response = await fetch(`/api/admin/users/check-email?email=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setEmailAvailable(result.available);
      }
    } catch (err) {
      console.error('Failed to check email availability:', err);
    }
    setEmailChecking(false);
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setUsernameChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No session found for username check');
        return;
      }

      const response = await fetch(`/api/admin/users/check-username?username=${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUsernameAvailable(result.available);
      }
    } catch (err) {
      console.error('Failed to check username availability:', err);
    }
    setUsernameChecking(false);
  };

  const handleSuspend = async (user: UserRow) => {
    const confirmed = await statusConfirm({
      title: 'Suspend this user?',
      body: `@${user.username ?? 'user'} will be restricted to the Free plan. Their content remains visible but they lose access to paid features. They will be notified and can message support.`,
      confirmLabel: 'Suspend',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    setError(null);
    try {
      await adminPost({ action: 'suspendUser', userId: user.id, reason: statusReason || null });
      setStatusReason('');
    } catch (e: any) { setError(e.message); }
    load();
  };

  const handleUnsuspend = async (user: UserRow) => {
    setError(null);
    try {
      await adminPost({ action: 'unsuspendUser', userId: user.id });
    } catch (e: any) { setError(e.message); }
    load();
  };

  const handleExpel = async (user: UserRow) => {
    const confirmed = await statusConfirm({
      title: 'Expel this user?',
      body: `ALL of @${user.username ?? 'user'}'s content (recipes, techniques, comments, messages) will be hidden from every member immediately. This includes recipes others have saved. They will be notified and can message support.`,
      confirmLabel: 'Expel',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;
    setError(null);
    try {
      await adminPost({ action: 'expelUser', userId: user.id, reason: statusReason || null });
      setStatusReason('');
    } catch (e: any) { setError(e.message); }
    load();
  };

  const handleReinstate = async (user: UserRow) => {
    setError(null);
    try {
      await adminPost({ action: 'reinstateUser', userId: user.id });
    } catch (e: any) { setError(e.message); }
    load();
  };

  const changePlan = async (userId: string, plan: PlanTier) => {
    setError(null);
    try {
      await adminPost({ action: 'changePlan', userId, plan });
    } catch (e: any) { setError(e.message); }
    load();
  };

  const changeImageQuality = async (userId: string, value: string) => {
    setError(null);
    const override = value === 'dev' || value === 'schnell' ? value : null;
    // Optimistic update so the select reflects the choice immediately
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, image_quality_override: override } : u));
    try {
      await adminPost({ action: 'setImageQuality', userId, override });
    } catch (e: any) {
      setError(e.message);
      load();
    }
  };

  const addAdminRole = async (userId: string, role: string) => {
    setError(null);
    try {
      await adminPost({ action: 'addAdminRole', userId, role });
    } catch (e: any) { setError(e.message); }
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
    try {
      await adminPost({ action: 'updateUsername', userId, username: newName });
      setEditingUsername(null);
    } catch (e: any) {
      setUsernameError(e.message ?? 'Save failed');
    }
    setUsernameSaving(false);
    load();
  };

  const getUserRole = (userId: string) => adminRoles.get(userId) ?? 'user';

  const addTag = async (userId: string, tag: string) => {
    try { await adminPost({ action: 'addTag', userId, tag }); load(); } catch (e: any) { setError(e.message); }
  };
  const removeTag = async (userId: string, tag: string) => {
    try { await adminPost({ action: 'removeTag', userId, tag }); load(); } catch (e: any) { setError(e.message); }
  };
  const addFlag = async (userId: string, flagType: string, note: string) => {
    try { await adminPost({ action: 'addFlag', userId, flagType, note }); load(); } catch (e: any) { setError(e.message); }
  };
  const resolveFlag = async (flagId: string, note: string) => {
    try { await adminPost({ action: 'resolveFlag', flagId, note }); load(); } catch (e: any) { setError(e.message); }
  };
  const sendMsg = async (recipientId: string) => {
    if (!messageText.trim()) return;
    setMessageSending(true);
    try { await adminPost({ action: 'sendMessage', recipientId, content: messageText.trim() }); setShowMessage(null); setMessageText(''); } catch (e: any) { setError(e.message); }
    setMessageSending(false);
  };
  const sendBulk = async () => {
    setMessageSending(true);
    const ids = [...selected];
    for (let i = 0; i < ids.length; i++) {
      setBulkProgress(`Sending ${i + 1}/${ids.length}...`);
      try { await adminPost({ action: 'sendMessage', recipientId: ids[i], content: messageText.trim() }); } catch {}
    }
    setBulkProgress(null);
    setShowBulkMessage(false);
    setMessageText('');
    setSelected(new Set());
    setMessageSending(false);
  };

  const toggleSelect = (id: string) => setSelected((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const selectAll = () => setSelected(new Set(sorted.map((u) => u.id)));

  // All unique tags for filter pills
  const allTags = useMemo(() => {
    const s = new Set<string>();
    userTags.forEach((tags) => tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [userTags]);

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
    let list = [...users];
    if (tagFilter) list = list.filter((u) => (userTags.get(u.id) ?? []).includes(tagFilter));
    if (flaggedOnly) list = list.filter((u) => (userFlags.get(u.id) ?? []).length > 0);
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'username': return dir * (a.username ?? '').localeCompare(b.username ?? '');
        case 'email': return dir * (a.email ?? '').localeCompare(b.email ?? '');
        case 'plan_tier': return dir * a.plan_tier.localeCompare(b.plan_tier);
        case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'role': return dir * getUserRole(a.id).localeCompare(getUserRole(b.id));
        default: return 0;
      }
    });
    return list;
  }, [users, sortKey, sortDir, adminRoles, tagFilter, flaggedOnly, userTags, userFlags]);

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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => setShowCreateAccount(true)}
          className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Account
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search username or name..." className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" />
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="chef">Chef</option>
          <option value="family">Family</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Tag + flag filter pills */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button onClick={() => { setTagFilter(null); setFlaggedOnly(false); }} className={`px-3 py-1 rounded-full text-xs font-semibold ${!tagFilter && !flaggedOnly ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600'}`}>All Users</button>
        <button onClick={() => setFlaggedOnly(!flaggedOnly)} className={`px-3 py-1 rounded-full text-xs font-semibold ${flaggedOnly ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600'}`}>⚑ Flagged</button>
        {allTags.map((t) => (
          <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)} className={`px-3 py-1 rounded-full text-xs font-semibold ${tagFilter === t ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600'}`}>{t}</button>
        ))}
      </div>

      {/* Bulk message button */}
      {selected.size > 0 && (
        <button onClick={() => { setMessageText(''); setShowBulkMessage(true); }} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold mb-4 hover:opacity-90">
          Message Selected ({selected.size})
        </button>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-2 py-3 w-8"><input type="checkbox" checked={selected.size === sorted.length && sorted.length > 0} onChange={() => selected.size === sorted.length ? setSelected(new Set()) : selectAll()} /></th>
                <SortHeader label="User" sortKeyName="username" />
                <SortHeader label="Email" sortKeyName="email" />
                <SortHeader label="Plan" sortKeyName="plan_tier" />
                <th className="px-4 py-3 text-left font-medium text-gray-500">Image Quality</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 text-xs">Cost</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 text-xs">Rev</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 text-xs">Delta</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs">Throttle</th>
                <SortHeader label="Role" sortKeyName="role" />
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tags</th>
                <th className="px-2 py-3 text-left font-medium text-gray-500 w-6">⚑</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs">Last Active</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 text-xs">Last Login</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500 text-xs">Logins</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500 text-xs">Recipes</th>
                <SortHeader label="Joined" sortKeyName="created_at" />
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const role = getUserRole(u.id);
                const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.user;
                const tags = userTags.get(u.id) ?? [];
                const flags = userFlags.get(u.id) ?? [];
                return (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{u.display_name ?? '—'}</span>
                        {u.account_status === 'suspended' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">Suspended</span>
                        )}
                        {u.account_status === 'expelled' && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">Expelled</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {editingUsername === u.id ? (
                          <div className="flex items-center gap-1">
                            <span>@</span>
                            <input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} autoFocus className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-28" onKeyDown={(e) => { if (e.key === 'Enter') saveUsername(u.id); if (e.key === 'Escape') setEditingUsername(null); }} />
                            <button onClick={() => saveUsername(u.id)} disabled={usernameSaving} className="text-green-600 text-[10px] font-semibold">{usernameSaving ? '...' : 'Save'}</button>
                            <button onClick={() => setEditingUsername(null)} className="text-gray-400 text-[10px]">Cancel</button>
                            {usernameError && <span className="text-red-500 text-[10px]">{usernameError}</span>}
                          </div>
                        ) : (
                          <>
                            {u.username ? `@${u.username}` : 'no username'}
                            <button onClick={() => startEditUsername(u)} className="text-gray-400 hover:text-cb-primary"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg></button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select value={u.plan_tier} onChange={(e) => changePlan(u.id, e.target.value as PlanTier)} className="text-xs border border-gray-300 rounded px-2 py-1">
                        {['free', 'chef', 'family', 'pro'].map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={u.image_quality_override ?? 'auto'}
                          onChange={(e) => changeImageQuality(u.id, e.target.value)}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                          title="AI image model override"
                        >
                          <option value="auto">Auto (plan default)</option>
                          <option value="schnell">Standard (Flux Schnell)</option>
                          <option value="dev">Premium (Flux Dev)</option>
                        </select>
                        {u.image_quality_override === 'dev' && (
                          <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">🎨 Dev</span>
                        )}
                      </div>
                    </td>
                    {(() => {
                      const planPrices: Record<string, number> = { free: 0, chef: 4.99, family: 9.99, pro: 14.99 };
                      const cost = (u as any).monthly_cost_usd ?? 0;
                      const rev = planPrices[u.plan_tier] ?? 0;
                      const delta = rev - cost;
                      const tLevel = (u as any).throttle_level;
                      return (<>
                        <td className={`px-3 py-3 text-right text-xs font-mono ${cost > 1 ? 'text-red-600' : cost > 0.3 ? 'text-amber-600' : 'text-gray-400'}`}>${cost.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-xs font-mono text-gray-500">${rev.toFixed(2)}</td>
                        <td className={`px-3 py-3 text-right text-xs font-mono ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</td>
                        <td className="px-3 py-3">{tLevel === 'red' ? <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Red</span> : tLevel === 'yellow' ? <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Yellow</span> : <span className="text-[10px] text-gray-300">—</span>}</td>
                      </>);
                    })()}
                    <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>{roleStyle.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <span key={t} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${GREEN_TAGS.has(t) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} onClick={() => removeTag(u.id, t)} title="Click to remove">{t}</span>
                        ))}
                        {tagPopover === u.id ? (
                          <div className="flex gap-1 flex-wrap">
                            {DEFAULT_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                              <button key={t} onClick={() => { addTag(u.id, t); setTagPopover(null); }} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">{t}</button>
                            ))}
                            <button onClick={() => setTagPopover(null)} className="text-[10px] text-gray-400">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setTagPopover(u.id)} className="text-gray-400 hover:text-cb-primary text-xs">+</button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {flags.length > 0 && <span className="text-red-500 cursor-pointer" title={flags.map((f) => `${f.flag_type}: ${f.note ?? ''}`).join('\n')} onClick={() => flags.forEach((f) => resolveFlag(f.id, 'Resolved by admin'))}>⚑</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {u.last_seen_at ? (
                        <div className="flex items-center gap-1">
                          {(() => {
                            const lastSeen = new Date(u.last_seen_at);
                            const fiveMinAgo = Date.now() - 5 * 60 * 1000;
                            const isOnline = lastSeen.getTime() > fiveMinAgo;
                            return <span className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} title={isOnline ? 'Online' : 'Offline'} />;
                          })()}
                          <span>{new Date(u.last_seen_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500">{u.login_count ?? 0}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-500">{u.recipe_count ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.account_status === 'active' && (
                          <>
                            <button onClick={() => handleSuspend(u)} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100">Suspend</button>
                            <button onClick={() => handleExpel(u)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Expel</button>
                          </>
                        )}
                        {u.account_status === 'suspended' && (
                          <>
                            <button onClick={() => handleUnsuspend(u)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Unsuspend</button>
                            <button onClick={() => handleExpel(u)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Expel</button>
                          </>
                        )}
                        {u.account_status === 'expelled' && (
                          <button onClick={() => handleReinstate(u)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Reinstate</button>
                        )}
                        <button onClick={() => { setShowMessage(u.id); setMessageText(''); }} className="text-xs px-2 py-1 rounded bg-cb-primary/10 text-cb-primary hover:bg-cb-primary/20">Message</button>
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

      {/* Single message modal */}
      {showMessage && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowMessage(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-3">Message @{users.find((u) => u.id === showMessage)?.username ?? '?'}</h3>
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value.slice(0, 1000))} placeholder="Write a message..." rows={4} maxLength={1000} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none mb-1" />
            <p className="text-xs text-gray-400 text-right mb-3">{messageText.length}/1000</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowMessage(null)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              <button onClick={() => sendMsg(showMessage)} disabled={messageSending || !messageText.trim()} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50">{messageSending ? 'Sending...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk message modal */}
      {showBulkMessage && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowBulkMessage(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-2">Message {selected.size} users</h3>
            <div className="max-h-20 overflow-y-auto mb-3 text-xs text-gray-500">{[...selected].map((id) => `@${users.find((u) => u.id === id)?.username ?? '?'}`).join(', ')}</div>
            <textarea value={messageText} onChange={(e) => setMessageText(e.target.value.slice(0, 1000))} placeholder="Write a message..." rows={4} maxLength={1000} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none mb-1" />
            <p className="text-xs text-gray-400 text-right mb-3">{messageText.length}/1000</p>
            {bulkProgress && <p className="text-sm text-cb-primary mb-2">{bulkProgress}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkMessage(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              <button onClick={sendBulk} disabled={messageSending || !messageText.trim()} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50">{messageSending ? 'Sending...' : `Send to ${selected.size}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Dialog (suspend/expel confirmations) */}
      <StatusDialog />
      <AlertDialog />

      {/* Create Account Modal */}
      {showCreateAccount && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreateAccount(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Create Account</h3>

            {createError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2 mb-4">
                {createError}
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => {
                      setCreateEmail(e.target.value);
                      setEmailAvailable(null);
                    }}
                    onBlur={(e) => checkEmailAvailability(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-28"
                  />
                  {emailChecking && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      Checking...
                    </span>
                  )}
                  {!emailChecking && emailAvailable === true && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">
                      ✓ Available
                    </span>
                  )}
                  {!emailChecking && emailAvailable === false && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-600 font-medium">
                      ✗ Already registered
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={createShowPassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateShowPassword(!createShowPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {createShowPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={createUsername}
                    onChange={(e) => {
                      setCreateUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                      setUsernameAvailable(null);
                    }}
                    onBlur={(e) => checkUsernameAvailability(e.target.value)}
                    placeholder="username"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-28"
                  />
                  {usernameChecking && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      Checking...
                    </span>
                  )}
                  {!usernameChecking && usernameAvailable === true && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">
                      ✓ Available
                    </span>
                  )}
                  {!usernameChecking && usernameAvailable === false && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-600 font-medium">
                      ✗ Already taken
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan <span className="text-red-500">*</span>
                </label>
                <select
                  value={createPlan}
                  onChange={(e) => setCreatePlan(e.target.value as 'free' | 'chef' | 'family' | 'pro')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="chef">Chef</option>
                  <option value="family">Family</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as 'user' | 'admin')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendWelcome"
                  checked={createSendWelcome}
                  onChange={(e) => setCreateSendWelcome(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="sendWelcome" className="text-sm text-gray-700">
                  Send welcome email
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateAccount(false);
                  setCreateError(null);
                  setEmailAvailable(null);
                  setUsernameAvailable(null);
                }}
                className="text-sm text-gray-500 px-4 py-2"
                disabled={createSaving}
              >
                Cancel
              </button>
              <button
                onClick={createAccount}
                disabled={createSaving || !createEmail || !createPassword || !createUsername || emailAvailable === false || usernameAvailable === false}
                className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
              >
                {createSaving ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
