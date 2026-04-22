'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@chefsbook/db';

interface TagLog {
  id: string;
  tag: string;
  recipeId: string;
  recipeTitle: string;
  recipeOwner: string;
  removedBy: string;
  reason: string | null;
  createdAt: string;
  reinstated: boolean;
}

interface BlockedTag {
  id: string;
  tag: string;
  reason: string | null;
  blockedBy: string | null;
  createdAt: string;
}

export default function AdminTagsPage() {
  const [logs, setLogs] = useState<TagLog[]>([]);
  const [blocked, setBlocked] = useState<BlockedTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newReason, setNewReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const [logsRes, blockedRes] = await Promise.all([
        fetch('/api/admin/tags/log', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/admin/tags/blocked', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (!logsRes.ok) {
        const err = await logsRes.json();
        throw new Error(err.error || 'Failed to load logs');
      }
      if (!blockedRes.ok) {
        const err = await blockedRes.json();
        throw new Error(err.error || 'Failed to load blocked tags');
      }

      const logsData = await logsRes.json();
      const blockedData = await blockedRes.json();

      setLogs(logsData.logs || []);
      setBlocked(blockedData.blocked || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleBlockTag = async () => {
    if (!newTag.trim()) return;
    setBlocking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/tags/blocked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tag: newTag.trim(), reason: newReason.trim() || null }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to block tag');
      }

      setNewTag('');
      setNewReason('');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setBlocking(false);
  };

  const handleUnblock = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/admin/tags/blocked/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to unblock tag');
      }

      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleReinstate = async (logId: string, recipeId: string, tag: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/tags/reinstate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ logId, recipeId, tag }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reinstate tag');
      }

      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleBlockFromLog = async (tag: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/tags/blocked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tag, reason: 'Blocked from moderation log' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to block tag');
      }

      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Calculate stats
  const thisWeek = logs.filter(l => new Date(l.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
  const thisMonth = logs.filter(l => new Date(l.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;
  const bySource = logs.reduce((acc, l) => {
    acc[l.removedBy] = (acc[l.removedBy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const tagCounts = logs.reduce((acc, l) => {
    acc[l.tag] = (acc[l.tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Tag Management</h1>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-6">
          {/* Section C — Tag Statistics */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Tag Statistics</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold text-gray-900">{thisWeek}</div>
                <div className="text-sm text-gray-500">Removed this week</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold text-gray-900">{thisMonth}</div>
                <div className="text-sm text-gray-500">Removed this month</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
                <div className="text-sm text-gray-500">Total removals</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Removals by source</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(bySource).map(([source, count]) => (
                    <div key={source} className="flex justify-between">
                      <span className="text-gray-600 capitalize">{source.replace('_', ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Top 10 blocked terms</h3>
                <div className="space-y-1 text-sm">
                  {topTags.map(([tag, count]) => (
                    <div key={tag} className="flex justify-between">
                      <span className="text-gray-600">{tag}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section B — Blocked Tag List */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Blocked Tags ({blocked.length})</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Tag to block..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason (optional)..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={handleBlockTag}
                disabled={!newTag.trim() || blocking}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {blocking ? 'Blocking...' : 'Block Tag'}
              </button>
            </div>
            {blocked.length === 0 ? (
              <p className="text-sm text-gray-500">No blocked tags yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Tag</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Reason</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Blocked By</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocked.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{b.tag}</td>
                        <td className="px-4 py-2 text-gray-600">{b.reason || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">@{b.blockedBy || 'Unknown'}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleUnblock(b.id)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            Remove block
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section A — Recently Removed Tags */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recently Removed Tags ({logs.length})</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500">No tag removals logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Tag</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Recipe</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Owner</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Removed By</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Reason</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{log.tag}</td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/recipe/${log.recipeId}`}
                            target="_blank"
                            className="text-cb-primary hover:underline"
                          >
                            {log.recipeTitle}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-600">@{log.recipeOwner}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                            log.removedBy === 'ai' ? 'bg-blue-50 text-blue-700' :
                            log.removedBy === 'blocked_list' ? 'bg-red-50 text-red-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {log.removedBy === 'ai' ? 'AI' :
                             log.removedBy === 'blocked_list' ? 'Blocked List' :
                             'Admin'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-xs">{log.reason || '—'}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            {!log.reinstated && (
                              <button
                                onClick={() => handleReinstate(log.id, log.recipeId, log.tag)}
                                className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100"
                              >
                                Reinstate
                              </button>
                            )}
                            {log.reinstated && (
                              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
                                Reinstated
                              </span>
                            )}
                            <button
                              onClick={() => handleBlockFromLog(log.tag)}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                            >
                              Block
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
