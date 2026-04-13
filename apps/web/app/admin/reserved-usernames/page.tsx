'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import { useConfirmDialog } from '@/components/useConfirmDialog';

interface ReservedRow {
  id: string;
  username: string;
  reason: string | null;
  is_approved: boolean;
  approved_for_user_id: string | null;
  approved_for_username?: string | null;
  approved_note: string | null;
  created_at: string;
}

interface FlaggedUsername {
  id: string;
  user_id: string;
  username: string | null;
  flag_type: string;
  note: string | null;
  created_at: string;
}

interface UserResult {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

type Filter = 'all' | 'reserved' | 'approved';

export default function ReservedUsernamesPage() {
  const [confirmDel, ConfirmDialog] = useConfirmDialog();
  const [items, setItems] = useState<ReservedRow[]>([]);
  const [flaggedUsernames, setFlaggedUsernames] = useState<FlaggedUsername[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newReason, setNewReason] = useState('');
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [approveUserId, setApproveUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [reservedData, flaggedData] = await Promise.all([
        adminFetch({ page: 'reserved-usernames' }),
        adminFetch({ page: 'flagged-usernames' }),
      ]);
      // Enrich approved_for with username
      const reserved = reservedData.reserved ?? [];
      if (reserved.some((r: any) => r.approved_for_user_id)) {
        const userIds = reserved.filter((r: any) => r.approved_for_user_id).map((r: any) => r.approved_for_user_id);
        // Fetch usernames for approved users
        const promises = userIds.map((uid: string) => adminFetch({ page: 'user-search', q: uid }));
        // Actually let's just look them up in the items we already have
        // For simplicity, we'll fetch individually
      }
      setItems(reserved);
      setFlaggedUsernames(flaggedData.flags ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // User search for approve modal
  useEffect(() => {
    if (!userSearch.trim() || userSearch.length < 2) { setUserResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const data = await adminFetch({ page: 'user-search', q: userSearch });
        setUserResults(data.users ?? []);
      } catch { setUserResults([]); }
      setSearchingUsers(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [userSearch]);

  const filtered = items.filter((r) => {
    if (filter === 'reserved') return !r.is_approved;
    if (filter === 'approved') return r.is_approved;
    return true;
  });

  const handleAdd = async () => {
    const name = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!name) return;
    try {
      await adminPost({ action: 'addReserved', username: name, reason: newReason.trim() || null });
      setNewUsername(''); setNewReason(''); setShowAdd(false);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminPost({ action: 'approveReserved', reservedId: id, userId: approveUserId, note: approveNote.trim() || null });
      setApproveId(null); setApproveNote(''); setApproveUserId(null); setUserSearch(''); setUserResults([]);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleRevoke = async (id: string) => {
    try { await adminPost({ action: 'revokeReserved', reservedId: id }); load(); } catch (e: any) { setError(e.message); }
  };

  const handleRemove = async (id: string) => {
    const ok = await confirmDel({ icon: '🗑️', title: 'Remove reserved username?', body: 'This username will be available for anyone to claim.', confirmLabel: 'Remove' });
    if (!ok) return;
    try { await adminPost({ action: 'removeReserved', reservedId: id }); load(); } catch (e: any) { setError(e.message); }
  };

  const handleAddFlaggedToReserved = async (username: string) => {
    try {
      await adminPost({ action: 'addReserved', username, reason: 'AI-flagged impersonation' });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleDismissFlag = async (flagId: string) => {
    try {
      await adminPost({ action: 'resolveFlag', flagId, note: 'Dismissed — false positive' });
      load();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Reserved Usernames</h1>
        <button onClick={() => setShowAdd(true)} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90">+ Add Username</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button></div>}

      {/* AI-flagged usernames section */}
      {flaggedUsernames.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Recently Flagged Usernames <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full ml-2">{flaggedUsernames.length}</span>
          </h2>
          <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Flag Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">AI Note</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flaggedUsernames.map((f) => (
                  <tr key={f.id} className="border-b border-amber-100 last:border-0">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">@{f.username ?? '?'}</td>
                    <td className="px-4 py-3">
                      {f.username ? <Link href={`/u/${f.username}`} className="text-cb-primary hover:underline text-xs">@{f.username}</Link> : <span className="text-xs text-gray-400">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{f.note ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => f.username && handleAddFlaggedToReserved(f.username)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Add to Reserved</button>
                        <button onClick={() => handleDismissFlag(f.id)} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100">Dismiss</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 mb-4">
        {(['all', 'reserved', 'approved'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === f ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'all' ? `All (${items.length})` : f === 'reserved' ? `Reserved (${items.filter((r) => !r.is_approved).length})` : `Approved (${items.filter((r) => r.is_approved).length})`}
          </button>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Add Reserved Username</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username</label>
              <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reason</label>
              <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. brand, admin role" className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48" />
            </div>
            <button onClick={handleAdd} disabled={!newUsername.trim()} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-50">Add</button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Username</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Approved For</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">@{r.username}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.is_approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.is_approved ? 'Approved' : 'Reserved'}
                    </span>
                    {r.approved_note && <span className="text-[10px] text-gray-400 ml-2">{r.approved_note}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.approved_for_user_id ? (
                      <Link href={`/u/${r.approved_for_username ?? r.approved_for_user_id}`} className="text-cb-primary hover:underline">
                        @{r.approved_for_username ?? r.approved_for_user_id.slice(0, 8)}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {!r.is_approved ? (
                        approveId === r.id ? (
                          <div className="flex flex-col gap-2 min-w-[220px]">
                            <input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Note (optional)" className="border border-gray-300 rounded px-2 py-1 text-xs" />
                            <div className="relative">
                              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search user to assign..." className="border border-gray-300 rounded px-2 py-1 text-xs w-full" />
                              {userResults.length > 0 && (
                                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto">
                                  {userResults.map((u) => (
                                    <button key={u.id} onClick={() => { setApproveUserId(u.id); setUserSearch(u.username ?? ''); setUserResults([]); }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-cb-primary/10 text-cb-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                                        {(u.username ?? '?')[0].toUpperCase()}
                                      </span>
                                      <span className="font-medium">@{u.username}</span>
                                      {u.display_name && <span className="text-gray-400">{u.display_name}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {searchingUsers && <span className="absolute right-2 top-1 text-[10px] text-gray-400">...</span>}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => handleApprove(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Confirm</button>
                              <button onClick={() => { setApproveId(null); setApproveUserId(null); setUserSearch(''); }} className="text-xs text-gray-400">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setApproveId(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Approve</button>
                        )
                      ) : (
                        <button onClick={() => handleRevoke(r.id)} className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100">Revoke</button>
                      )}
                      <button onClick={() => handleRemove(r.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-8 text-center text-gray-500">No reserved usernames.</p>}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
