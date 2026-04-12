'use client';

import { useState, useEffect } from 'react';
import { supabaseAdmin } from '@chefsbook/db';
import Link from 'next/link';

interface FlaggedMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  moderation_status: string;
  is_hidden: boolean;
  created_at: string;
  sender_username?: string;
  recipient_username?: string;
  flag_count?: number;
}

export default function MessageModerationPage() {
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabaseAdmin
      .from('direct_messages')
      .select('*')
      .or('is_hidden.eq.true,moderation_status.eq.mild,moderation_status.eq.serious')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      // Fetch sender/recipient usernames
      const userIds = new Set<string>();
      data.forEach((m: any) => { userIds.add(m.sender_id); userIds.add(m.recipient_id); });
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username').in('id', [...userIds]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));
      setMessages(data.map((m: any) => ({ ...m, sender_username: pMap.get(m.sender_id), recipient_username: pMap.get(m.recipient_id) })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    await supabaseAdmin.from('direct_messages').update({ is_hidden: false, moderation_status: 'clean' }).eq('id', id);
    load();
  };

  const handleRemove = async (id: string) => {
    await supabaseAdmin.from('direct_messages').update({ is_hidden: true }).eq('id', id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Message Moderation</h1>
      {loading ? <p className="text-gray-500">Loading...</p> : messages.length === 0 ? (
        <p className="text-gray-500">No flagged messages.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`bg-white rounded-lg border p-4 ${m.moderation_status === 'serious' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m.moderation_status === 'serious' ? 'bg-red-200 text-red-800' : m.is_hidden ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                      {m.is_hidden ? 'HIDDEN' : m.moderation_status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mb-1">{m.content}</p>
                  <p className="text-xs text-gray-500">
                    From <Link href={`/u/${m.sender_username}`} className="text-cb-primary hover:underline">@{m.sender_username}</Link> → <Link href={`/u/${m.recipient_username}`} className="text-cb-primary hover:underline">@{m.recipient_username}</Link>
                    {' · '}{new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleApprove(m.id)} className="text-xs px-3 py-1.5 rounded bg-green-100 text-green-800 hover:bg-green-200 font-medium">Approve</button>
                  <button onClick={() => handleRemove(m.id)} className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-800 hover:bg-red-200 font-medium">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
