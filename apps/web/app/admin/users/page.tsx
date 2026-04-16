'use client';

import { useState, useEffect, useMemo } from 'react';
import type { PlanTier } from '@chefsbook/db';
import { adminFetch, adminPost } from '@/lib/adminFetch';

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
}

interface TagRow { user_id: string; tag: string; }
interface FlagRow { id: string; user_id: string; flag_type: string; note: string | null; created_at: string; }

const GREEN_TAGS = new Set(['VIP', 'Beta Tester', 'Partner', 'Influencer', 'Press', 'Paid', 'Comped', 'Trial Extended']);
const DEFAULT_TAGS = ['VIP', 'Beta Tester', 'Partner', 'Influencer', 'Press', 'Flagged', 'Under Review', 'Canceled', 'Churned', 'Paid', 'Comped', 'Trial Extended', 'Banned'];

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

  const toggleSuspend = async (user: UserRow) => {
    setError(null);
    try {
      await adminPost({ action: 'toggleSuspend', userId: user.id, suspended: !user.is_suspended });
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
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Management</h1>

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
                <SortHeader label="Role" sortKeyName="role" />
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tags</th>
                <th className="px-2 py-3 text-left font-medium text-gray-500 w-6">⚑</th>
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
                      <div className="font-medium text-gray-900">{u.display_name ?? '—'}</div>
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
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => toggleSuspend(u)} className={`text-xs px-2 py-1 rounded ${u.is_suspended ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{u.is_suspended ? 'Restore' : 'Suspend'}</button>
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
    </div>
  );
}
