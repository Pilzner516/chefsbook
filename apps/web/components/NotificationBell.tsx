'use client';

import { useState, useEffect } from 'react';
import { supabase, getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '@chefsbook/db';
import Link from 'next/link';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'comment_reply', label: 'Comments' },
  { key: 'recipe_like', label: 'Likes' },
  { key: 'new_follower', label: 'Followers' },
  { key: 'moderation', label: 'Moderation' },
];

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (uid) {
        setUserId(uid);
        getUnreadCount(uid).then(setCount);
      }
    });
  }, []);

  const openPanel = async () => {
    if (!userId) return;
    setOpen(true);
    const data = await getNotifications(userId, tab === 'all' ? undefined : tab);
    setNotifications(data);
  };

  const switchTab = async (t: string) => {
    setTab(t);
    if (!userId) return;
    const data = await getNotifications(userId, t === 'all' ? undefined : t);
    setNotifications(data);
  };

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!userId) return;
    await markAllNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  };

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <>
      <button onClick={openPanel} className="relative p-2 text-cb-secondary hover:text-cb-text transition" title="Notifications">
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-cb-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-cb-card shadow-2xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-cb-border">
              <h2 className="font-bold text-cb-text">Notifications</h2>
              <div className="flex gap-2">
                <button onClick={markAllRead} className="text-xs text-cb-muted hover:text-cb-primary">Mark all read</button>
                <button onClick={() => setOpen(false)} className="text-cb-muted hover:text-cb-text">✕</button>
              </div>
            </div>

            <div className="flex gap-1 p-2 border-b border-cb-border overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => switchTab(t.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${tab === t.key ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:bg-cb-bg'}`}>{t.label}</button>
              ))}
            </div>

            <div className="divide-y divide-cb-border/50">
              {notifications.length === 0 && <p className="text-center text-cb-muted text-sm py-8">No notifications</p>}
              {notifications.map((n) => (
                <div key={n.id} onClick={() => !n.is_read && markRead(n.id)} className={`p-4 hover:bg-cb-bg/50 transition cursor-pointer ${!n.is_read ? 'border-l-2 border-l-cb-primary' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-cb-primary/10 flex items-center justify-center text-sm shrink-0">
                      {n.type === 'recipe_like' ? '❤️' : n.type === 'new_follower' ? '👤' : n.type === 'moderation' ? '🛡️' : '💬'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-cb-text">
                        {n.actor_username && <span className="font-semibold">@{n.actor_username} </span>}
                        {n.batch_count > 1 ? `${n.batch_count} people ` : ''}
                        {n.message}
                      </p>
                      {n.recipe_title && <p className="text-xs text-cb-muted mt-0.5 truncate">{n.recipe_title}</p>}
                      <p className="text-[11px] text-cb-muted mt-1">{timeAgo(n.created_at)}</p>
                      {n.recipe_id && (
                        <Link href={`/recipe/${n.recipe_id}${n.comment_id ? `?comment=${n.comment_id}` : ''}`} onClick={() => setOpen(false)} className="text-xs text-cb-primary hover:underline mt-1 inline-block">View Recipe →</Link>
                      )}
                      {n.type === 'new_follower' && n.actor_username && !n.recipe_id && (
                        <Link href={`/u/${n.actor_username}`} onClick={() => setOpen(false)} className="text-xs text-cb-primary hover:underline mt-1 inline-block">View Profile →</Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
