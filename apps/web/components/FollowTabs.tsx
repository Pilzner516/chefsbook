'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFollowers, getFollowing } from '@chefsbook/db';
import type { UserProfile } from '@chefsbook/db';

export default function FollowTabs({ userId }: { userId: string }) {
  const [tab, setTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (loaded[tab]) return;
    setLoading(true);
    const fn = tab === 'followers' ? getFollowers : getFollowing;
    fn(userId).then((data) => {
      if (tab === 'followers') setFollowers(data);
      else setFollowing(data);
      setLoaded((p) => ({ ...p, [tab]: true }));
      setLoading(false);
    });
  }, [tab, userId]);

  const users = tab === 'followers' ? followers : following;

  return (
    <div className="mt-8">
      <div className="flex border-b border-cb-border mb-4">
        <button
          onClick={() => setTab('followers')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'followers' ? 'border-cb-primary text-cb-primary' : 'border-transparent text-cb-secondary hover:text-cb-text'
          }`}
        >
          Followers
        </button>
        <button
          onClick={() => setTab('following')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'following' ? 'border-cb-primary text-cb-primary' : 'border-transparent text-cb-secondary hover:text-cb-text'
          }`}
        >
          Following
        </button>
      </div>

      {loading ? (
        <p className="text-cb-secondary text-sm text-center py-6">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-cb-muted text-sm text-center py-6">
          {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Link
              key={user.id}
              href={user.username ? `/dashboard/chef/${user.username}` : '#'}
              className="flex items-center gap-3 p-3 bg-cb-card rounded-card border border-cb-border hover:border-cb-border-strong transition"
            >
              <div className="w-10 h-10 rounded-full bg-cb-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                {user.display_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                {user.username && <p className="text-sm font-semibold text-cb-text">@{user.username}</p>}
                {user.display_name && <p className="text-xs text-cb-secondary truncate">{user.display_name}</p>}
              </div>
              <span className="text-xs text-cb-muted">{user.follower_count} followers</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
