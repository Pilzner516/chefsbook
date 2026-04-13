'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, getConversationList, getConversation, sendMessage, markMessagesRead, flagMessage } from '@chefsbook/db';
import type { ConversationPreview, DirectMessage } from '@chefsbook/db';
import { moderateMessage } from '@chefsbook/ai';

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

export default function MessagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [convos, setConvos] = useState<ConversationPreview[]>([]);
  const [selected, setSelected] = useState<ConversationPreview | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) getConversationList(uid).then((c) => { setConvos(c); setLoading(false); });
    });
  }, []);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('dm-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${userId}`,
      }, (payload: any) => {
        const newMsg = payload.new as DirectMessage;
        // If the open conversation matches, append the message
        if (selected && newMsg.sender_id === selected.other_user_id) {
          setMessages((prev) => [...prev, newMsg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        // Update conversation list
        getConversationList(userId).then(setConvos);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, selected?.other_user_id]);

  const openConvo = async (convo: ConversationPreview) => {
    if (!userId) return;
    setSelected(convo);
    const msgs = await getConversation(userId, convo.other_user_id);
    setMessages(msgs);
    await markMessagesRead(userId, convo.other_user_id);
    setConvos((prev) => prev.map((c) => c.other_user_id === convo.other_user_id ? { ...c, unread_count: 0 } : c));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSend = async () => {
    if (!text.trim() || !userId || !selected || sending) return;
    setSending(true);
    try {
      let modStatus = 'clean';
      try {
        const mod = await moderateMessage(text.trim());
        modStatus = mod.verdict;
      } catch { /* moderation failure = allow */ }
      const msg = await sendMessage(userId, selected.other_user_id, text.trim(), modStatus);
      setMessages((prev) => [...prev, { ...msg, sender_username: undefined, sender_display_name: undefined, sender_avatar_url: undefined }]);
      setText('');
      setConvos((prev) => prev.map((c) => c.other_user_id === selected.other_user_id ? { ...c, last_message: text.trim().slice(0, 80), last_message_at: new Date().toISOString() } : c));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      if (modStatus === 'serious') alert('Your message was flagged and hidden for review.');
    } catch (e: any) {
      alert(e.message ?? 'Failed to send');
    }
    setSending(false);
  };

  const handleFlag = async (msgId: string, reason: string) => {
    if (!userId) return;
    await flagMessage(msgId, userId, reason);
    setFlagging(null);
    alert('Thanks for reporting.');
  };

  if (loading) return <div className="p-8 text-cb-secondary">Loading messages...</div>;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Conversation list */}
      <div className={`${selected ? 'hidden md:block' : ''} w-full md:w-80 border-r border-cb-border overflow-y-auto bg-cb-card`}>
        <div className="p-4 border-b border-cb-border">
          <h1 className="text-lg font-bold text-cb-text">Messages</h1>
        </div>
        {convos.length === 0 ? (
          <p className="p-4 text-cb-muted text-sm">No messages yet.</p>
        ) : (
          convos.map((c) => (
            <button
              key={c.other_user_id}
              onClick={() => openConvo(c)}
              className={`w-full text-left px-4 py-3 border-b border-cb-border/50 hover:bg-cb-bg transition-colors ${selected?.other_user_id === c.other_user_id ? 'bg-cb-bg' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(c.other_display_name ?? c.other_username ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cb-text truncate">@{c.other_username}</span>
                    <span className="text-[10px] text-cb-muted shrink-0">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-cb-secondary truncate">{c.last_message}</p>
                </div>
                {c.unread_count > 0 && (
                  <span className="w-5 h-5 rounded-full bg-cb-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread_count}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Thread view */}
      <div className={`flex-1 flex flex-col ${!selected ? 'hidden md:flex' : 'flex'}`}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-cb-muted text-sm">
            Select a conversation
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-cb-border bg-cb-card">
              <button onClick={() => setSelected(null)} className="md:hidden text-cb-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <div className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold">
                {(selected.other_display_name ?? selected.other_username ?? '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <Link href={`/u/${selected.other_username}`} className="text-sm font-semibold text-cb-text hover:underline">@{selected.other_username}</Link>
                {selected.other_display_name && <p className="text-xs text-cb-secondary">{selected.other_display_name}</p>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.sender_id === userId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group gap-2`}>
                    {/* Avatar for received messages */}
                    {!isMine && (
                      <div className="w-7 h-7 rounded-full bg-cb-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                        {(selected.other_display_name ?? selected.other_username ?? '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-text border border-cb-border'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-cb-muted'}`}>{timeAgo(msg.created_at)}</span>
                        {!isMine && (
                          <button
                            onClick={() => setFlagging(flagging === msg.id ? null : msg.id)}
                            className="text-[10px] text-cb-muted hover:text-cb-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          >⚑</button>
                        )}
                      </div>
                      {flagging === msg.id && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {['Inappropriate', 'Harassment', 'Spam', 'Other'].map((r) => (
                            <button key={r} onClick={() => handleFlag(msg.id, r)} className="text-[10px] bg-cb-card border border-cb-border rounded-full px-2 py-0.5 hover:bg-cb-base">{r}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Compose */}
            <div className="p-3 border-t border-cb-border bg-cb-card">
              <div className="flex gap-2 items-end">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message..."
                  maxLength={1000}
                  rows={1}
                  className="flex-1 bg-cb-bg border border-cb-border rounded-2xl px-4 py-2 text-sm outline-none focus:border-cb-primary resize-none max-h-32"
                  style={{ height: 'auto', minHeight: '36px' }}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  className="bg-cb-primary text-white w-9 h-9 rounded-full flex items-center justify-center hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                </button>
              </div>
              {text.length > 900 && <p className="text-[10px] text-cb-muted text-right mt-1">{text.length}/1000</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
