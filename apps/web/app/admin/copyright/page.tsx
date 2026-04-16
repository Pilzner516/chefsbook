'use client';

import { useEffect, useState } from 'react';
import { adminFetch, adminPost } from '../../../lib/adminFetch';

interface CopyrightFlag {
  id: string;
  recipe_id: string;
  flagged_by: string;
  flag_type: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  recipe_title: string | null;
  recipe_source_url: string | null;
  recipe_owner_id: string | null;
  recipe_owner_username: string | null;
  recipe_visibility: string | null;
  copyright_review_pending: boolean;
  copyright_previous_visibility: string | null;
  flagger_username: string | null;
  flagger_flag_count: number;
}

export default function CopyrightPage() {
  const [flags, setFlags] = useState<CopyrightFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch({ page: 'copyright' });
      setFlags(data.flags ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = flags.filter((f) => {
    if (filter === 'pending') return f.status === 'pending';
    if (filter === 'resolved') return f.status !== 'pending';
    return true;
  });

  const handleAction = async (action: string, flagId: string, flaggerId: string) => {
    setActionLoading(flagId);
    try {
      await adminPost({ action, flagId, flaggerId });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const statusPill = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      removed: 'bg-red-100 text-red-800',
      dismissed: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Copyright Review</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === f
                ? 'bg-cb-primary text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {f === 'pending' ? `Pending (${flags.filter((fl) => fl.status === 'pending').length})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No {filter === 'pending' ? 'pending' : ''} copyright flags
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Recipe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Flagged by</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((flag) => (
                <tr key={flag.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <a
                      href={`/recipe/${flag.recipe_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cb-primary hover:underline font-medium"
                    >
                      {flag.recipe_title ?? 'Unknown recipe'}
                    </a>
                    {flag.recipe_source_url && (
                      <div className="mt-0.5">
                        <a
                          href={flag.recipe_source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:underline truncate block max-w-[200px]"
                        >
                          {flag.recipe_source_url}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700">@{flag.recipe_owner_username ?? '?'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700">@{flag.flagger_username ?? '?'}</span>
                    <span className="ml-1 text-xs text-gray-400" title="Total flags submitted by this user">
                      ({flag.flagger_flag_count})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                    {flag.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(flag.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{statusPill(flag.status)}</td>
                  <td className="px-4 py-3">
                    {flag.status === 'pending' ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAction('approveCopyright', flag.id, flag.flagged_by)}
                          disabled={actionLoading === flag.id}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction('removeCopyright', flag.id, flag.flagged_by)}
                          disabled={actionLoading === flag.id}
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => handleAction('dismissCopyright', flag.id, flag.flagged_by)}
                          disabled={actionLoading === flag.id}
                          className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {flag.admin_note || 'Resolved'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
