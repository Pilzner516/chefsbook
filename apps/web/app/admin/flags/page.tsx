'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch, adminPost } from '@/lib/adminFetch';

interface FlaggedComment {
  id: string;
  comment_id: string;
  flagged_by: string;
  reason: string | null;
  created_at: string;
  comment_content: string | null;
  comment_user_id: string | null;
  commenter_username: string | null;
  recipe_id: string | null;
  flagged_by_username: string | null;
}

export default function FlaggedCommentsPage() {
  const [flags, setFlags] = useState<FlaggedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'flagged-comments' });
      setFlags(data.flags ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (f: FlaggedComment) => {
    setActing(f.id);
    try { await adminPost({ action: 'approveComment', commentId: f.comment_id }); } catch {}
    setActing(null);
    load();
  };

  const handleRemove = async (f: FlaggedComment) => {
    setActing(f.id);
    try { await adminPost({ action: 'removeComment', commentId: f.comment_id }); } catch {}
    setActing(null);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Flagged Comments</h1>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}

      {loading ? <p className="text-gray-500">Loading...</p> : flags.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No flagged comments</p>
          <p className="text-gray-400 text-sm mt-1">All clear!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Comment</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Recipe</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Commenter</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Flag Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Flagged By</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{f.comment_content ?? '(deleted)'}</td>
                  <td className="px-4 py-3">
                    {f.recipe_id ? <Link href={`/recipe/${f.recipe_id}`} className="text-cb-primary hover:underline text-xs">View</Link> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {f.commenter_username ? <Link href={`/u/${f.commenter_username}`} className="text-cb-primary hover:underline text-xs">@{f.commenter_username}</Link> : <span className="text-xs text-gray-400">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{f.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    {f.flagged_by_username ? <span className="text-xs text-gray-600">@{f.flagged_by_username}</span> : <span className="text-xs text-gray-400">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(f)} disabled={acting === f.id} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">Approve</button>
                      <button onClick={() => handleRemove(f)} disabled={acting === f.id} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">Remove</button>
                    </div>
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
