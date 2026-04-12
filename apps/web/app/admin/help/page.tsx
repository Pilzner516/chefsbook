'use client';

import { useState, useEffect } from 'react';
import { supabaseAdmin } from '@chefsbook/db';

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

export default function UserIdeasPage() {
  const [requests, setRequests] = useState<HelpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabaseAdmin.from('help_requests').select('*').order('created_at', { ascending: false }).limit(50);
        if (err) throw err;
        setRequests((data ?? []) as HelpRow[]);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load ideas');
      }
      setLoading(false);
    })();
  }, []);

  const markResolved = async (id: string) => {
    await supabaseAdmin.from('help_requests').update({ status: 'resolved' }).eq('id', id);
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
          <p className="text-gray-400 text-sm mt-1">Users haven't submitted any feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className={`bg-white rounded-lg border p-4 ${r.status === 'open' ? 'border-blue-300' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                    {r.username && <span className="text-xs text-gray-500">@{r.username}</span>}
                    {r.user_email && <span className="text-xs text-gray-400">{r.user_email}</span>}
                  </div>
                  {r.subject && <h3 className="font-medium text-gray-900">{r.subject}</h3>}
                  <p className="text-sm text-gray-600 mt-1">{r.message || r.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                {r.status === 'open' && (
                  <button onClick={() => markResolved(r.id)} className="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium shrink-0">
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
