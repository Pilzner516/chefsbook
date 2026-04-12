'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch, adminPost } from '@/lib/adminFetch';

interface HelpRow {
  id: string;
  user_id: string;
  user_email: string | null;
  username: string | null;
  subject: string;
  body: string;
  message: string | null;
  status: string;
  admin_reply: string | null;
  created_at: string;
}

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function UserIdeasPage() {
  const [requests, setRequests] = useState<HelpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await adminFetch({ page: 'help' });
        setRequests((data.requests ?? []) as HelpRow[]);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load ideas');
      }
      setLoading(false);
    })();
  }, []);

  const markResolved = async (id: string) => {
    try { await adminPost({ action: 'resolveHelp', requestId: id }); } catch {}
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Ideas</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No user ideas yet</p>
          <p className="text-gray-400 text-sm mt-1">Users haven&apos;t submitted any feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className={`bg-white rounded-lg border p-4 ${r.status === 'open' ? 'border-blue-300' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Sender info */}
                  <div className="flex items-center gap-2.5 mb-2">
                    {/* Avatar */}
                    {r.username ? (
                      <Link href={`/u/${r.username}`} className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 hover:ring-cb-primary/30 transition">
                        {r.username.charAt(0).toUpperCase()}
                      </Link>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold shrink-0">?</div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.username ? (
                        <Link href={`/u/${r.username}`} className="text-sm font-semibold text-gray-900 hover:text-cb-primary hover:underline transition">
                          @{r.username}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-500">Anonymous</span>
                      )}
                      {r.user_email && (
                        <span className="text-xs text-gray-400">{r.user_email}</span>
                      )}
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${r.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>

                  {/* Message */}
                  {r.subject && r.subject !== 'Feedback' && <h3 className="font-medium text-gray-900 mb-1">{r.subject}</h3>}
                  <p className="text-sm text-gray-600">{r.message || r.body}</p>

                  {/* Timestamp */}
                  <p className="text-xs text-gray-400 mt-2">{timeAgo(r.created_at)}</p>
                </div>
                {r.status === 'open' && (
                  <button onClick={() => markResolved(r.id)} className="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium shrink-0 ml-3">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
