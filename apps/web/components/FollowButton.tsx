'use client';

import { useState, useEffect } from 'react';
import { supabase, followUser, unfollowUser, isFollowing as checkIsFollowing, canDo, getUserPlanTier } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { useConfirmDialog } from './useConfirmDialog';

export default function FollowButton({ targetUserId, targetUsername }: { targetUserId: string; targetUsername: string | null }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canFollow, setCanFollow] = useState(false);
  const [confirmUnfollow, ConfirmDialog] = useConfirmDialog();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id === targetUserId) { setLoading(false); return; }
      setCurrentUserId(user.id);
      const [following, tier] = await Promise.all([
        checkIsFollowing(user.id, targetUserId),
        getUserPlanTier(user.id),
      ]);
      setIsFollowing(following);
      setCanFollow(canDo(tier, 'canFollow'));
      setLoading(false);
    })();
  }, [targetUserId]);

  if (loading || !currentUserId) return null;

  const handleFollow = async () => {
    if (!canFollow) return;
    if (isFollowing) {
      const ok = await confirmUnfollow({ icon: '👋', title: 'Unfollow?', body: `Unfollow @${targetUsername ?? 'this user'}?`, confirmLabel: 'Unfollow' });
      if (!ok) return;
      setIsFollowing(false);
      try { await unfollowUser(currentUserId, targetUserId); } catch { setIsFollowing(true); }
    } else {
      setIsFollowing(true);
      try { await followUser(currentUserId, targetUserId); } catch { setIsFollowing(false); }
    }
  };

  if (!canFollow) {
    return (
      <button className="mt-3 px-6 py-2 rounded-full text-sm font-medium bg-cb-base text-cb-muted border border-cb-border cursor-not-allowed">
        🔒 Follow — Chef Plan Required
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleFollow}
        className={`mt-3 px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
          isFollowing
            ? 'bg-cb-card border border-cb-border text-cb-secondary hover:border-red-300 hover:text-red-500'
            : 'bg-cb-primary text-white hover:bg-cb-primary/90'
        }`}
      >
        {isFollowing ? 'Following ✓' : 'Follow +'}
      </button>
      <ConfirmDialog />
    </>
  );
}
