'use client';

import { useState, useEffect } from 'react';
import { supabase, toggleLike, isLiked } from '@chefsbook/db';

interface Props {
  recipeId: string;
  likeCount: number;
}

export default function LikeButton({ recipeId, likeCount: initial }: Props) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initial);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) isLiked(recipeId, uid).then(setLiked);
    });
  }, [recipeId]);

  useEffect(() => { setCount(initial); }, [initial]);

  const handleToggle = async () => {
    if (!userId) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));
    await toggleLike(recipeId, userId);
  };

  return (
    <button onClick={handleToggle} className="flex items-center gap-1.5 group" disabled={!userId}>
      <span className={`text-lg ${liked ? 'text-cb-primary' : 'text-cb-muted group-hover:text-cb-primary'} transition`}>
        {liked ? '❤️' : '♡'}
      </span>
      <span className="text-sm text-cb-muted">{count}</span>
    </button>
  );
}
