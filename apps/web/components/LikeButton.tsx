'use client';

import { useState, useEffect } from 'react';
import { supabase, isLiked, getLikers } from '@chefsbook/db';
import Link from 'next/link';

interface Props {
  recipeId: string;
  likeCount: number;
  recipeOwnerId?: string;
}

export default function LikeButton({ recipeId, likeCount: initial, recipeOwnerId }: Props) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initial);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState<{ id: string; username: string | null; display_name: string | null }[]>([]);

  const isOwner = userId != null && userId === recipeOwnerId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setToken(data.session?.access_token ?? null);
      if (uid) isLiked(recipeId, uid).then(setLiked);
    });
  }, [recipeId]);

  useEffect(() => { setCount(initial); }, [initial]);

  const handleToggle = async () => {
    if (!userId || !token) return;
    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!liked);
    setCount(c => c + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/recipe/${recipeId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Like failed');
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.like_count);
    } catch {
      // Revert on error
      setLiked(prevLiked);
      setCount(prevCount);
    }
  };

  const handleShowLikers = async () => {
    if (!isOwner || count === 0) return;
    const data = await getLikers(recipeId);
    setLikers(data);
    setShowLikers(true);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Heart toggle */}
        <button onClick={handleToggle} disabled={!userId} className="group">
          <span className={`text-lg ${liked ? 'text-cb-primary' : 'text-cb-muted group-hover:text-cb-primary'} transition`}>
            {liked ? '❤️' : '♡'}
          </span>
        </button>
        {/* Count — clickable for owner, plain text for others */}
        {isOwner && count > 0 ? (
          <button onClick={handleShowLikers} className="text-sm text-cb-muted hover:text-cb-primary transition">
            {count}
          </button>
        ) : (
          <span className="text-sm text-cb-muted">{count}</span>
        )}
      </div>

      {/* Likers modal */}
      {showLikers && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowLikers(false)}>
          <div className="bg-cb-card rounded-card p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-cb-text">{count} people liked this</h3>
              <button onClick={() => setShowLikers(false)} className="text-cb-muted hover:text-cb-text">✕</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {likers.map((u) => (
                <Link
                  key={u.id}
                  href={`/u/${u.username ?? u.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-cb-bg rounded-input px-2 transition"
                  onClick={() => setShowLikers(false)}
                >
                  <div className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {u.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cb-text truncate">@{u.username ?? '?'}</p>
                    {u.display_name && <p className="text-xs text-cb-muted truncate">{u.display_name}</p>}
                  </div>
                  <span className="text-cb-muted text-xs">↗</span>
                </Link>
              ))}
              {likers.length === 0 && <p className="text-sm text-cb-muted text-center py-4">Loading...</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
