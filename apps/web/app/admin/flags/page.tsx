'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';

interface FlaggedItem {
  id: string;
  type: string;
  actor_id: string | null;
  recipe_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export default function FlaggedCommentsPage() {
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'comment_flagged')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data ?? []) as FlaggedItem[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Flagged Comments</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No flagged comments</p>
          <p className="text-gray-400 text-sm mt-1">All clear!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className={`bg-white rounded-lg border p-4 ${item.is_read ? 'border-gray-200' : 'border-red-300 bg-red-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${item.is_read ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                    {item.is_read ? 'Reviewed' : 'Pending Review'}
                  </span>
                  <p className="text-sm text-gray-700">{item.message ?? 'No details'}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                {!item.is_read && (
                  <div className="flex gap-2">
                    <button onClick={() => markRead(item.id)} className="text-xs px-3 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium">
                      Approve
                    </button>
                    <button onClick={() => markRead(item.id)} className="text-xs px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 font-medium">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
