'use client';

import { useState, useEffect } from 'react';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import { useConfirmDialog } from '@/components/useConfirmDialog';

interface ReservedRow {
  id: string;
  username: string;
  reason: string | null;
  is_approved: boolean;
  approved_for_user_id: string | null;
  approved_note: string | null;
  created_at: string;
}

type Filter = 'all' | 'reserved' | 'approved';

export default function ReservedUsernamesPage() {
  const [confirmDel, ConfirmDialog] = useConfirmDialog();
  const [items, setItems] = useState<ReservedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newReason, setNewReason] = useState('');
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveNote, setApproveNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch({ page: 'reserved-usernames' });
      setItems(data.reserved ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
      await adminPost({ action: 'approveReserved', reservedId: id, note: approveNote.trim() || null });
      setApproveId(null); setApproveNote('');
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Reserved Usernames</h1>
        <button onClick={() => setShowAdd(true)} className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90">+ Add Username</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}<button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button></div>}

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
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {!r.is_approved ? (
                        approveId === r.id ? (
                          <div className="flex items-center gap-1">
                            <input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Note (optional)" className="border border-gray-300 rounded px-2 py-1 text-xs w-32" />
                            <button onClick={() => handleApprove(r.id)} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Confirm</button>
                            <button onClick={() => setApproveId(null)} className="text-xs text-gray-400">Cancel</button>
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
