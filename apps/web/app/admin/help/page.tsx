'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';

interface HelpRow {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
}

export default function HelpRequestsPage() {
  const [requests, setRequests] = useState<HelpRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('help_requests').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setRequests((data ?? []) as HelpRow[]); setLoading(false); });
  }, []);

  const markResolved = async (id: string) => {
    await supabase.from('help_requests').update({ status: 'resolved' }).eq('id', id);
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Help Requests</h1>

      {loading ? <p className="text-gray-500">Loading...</p> : requests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No help requests</p>
          <p className="text-gray-400 text-sm mt-1">Users haven't submitted any requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className={`bg-white rounded-lg border p-4 ${r.status === 'open' ? 'border-blue-300' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${r.status === 'open' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                  <h3 className="font-medium text-gray-900">{r.subject}</h3>
                  <p className="text-sm text-gray-600 mt-1">{r.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                {r.status === 'open' && (
                  <button onClick={() => markResolved(r.id)} className="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium">
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
