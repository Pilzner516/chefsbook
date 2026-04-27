'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/adminFetch';

interface FeedbackRow {
  id: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  type: 'bug' | 'suggestion' | 'praise';
  screen: string | null;
  description: string;
  app_version: string | null;
  platform: string | null;
  created_at: string;
}

const TYPE_BADGES: Record<string, { bg: string; text: string; icon: string }> = {
  bug: { bg: 'bg-red-100', text: 'text-red-700', icon: '🐛' },
  suggestion: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '💡' },
  praise: { bg: 'bg-green-100', text: 'text-green-700', icon: '🎉' },
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function UserFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await adminFetch({ page: 'feedback' });
        setFeedback((data.feedback ?? []) as FeedbackRow[]);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load feedback');
      }
      setLoading(false);
    })();
  }, []);

  const filtered = filterType === 'all' ? feedback : feedback.filter((f) => f.type === filterType);

  const stats = {
    bug: feedback.filter((f) => f.type === 'bug').length,
    suggestion: feedback.filter((f) => f.type === 'suggestion').length,
    praise: feedback.filter((f) => f.type === 'praise').length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Feedback</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          All ({feedback.length})
        </button>
        <button
          onClick={() => setFilterType('bug')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterType === 'bug' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
        >
          🐛 Bugs ({stats.bug})
        </button>
        <button
          onClick={() => setFilterType('suggestion')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterType === 'suggestion' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
        >
          💡 Suggestions ({stats.suggestion})
        </button>
        <button
          onClick={() => setFilterType('praise')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterType === 'praise' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
        >
          🎉 Praise ({stats.praise})
        </button>
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No feedback yet</p>
          <p className="text-gray-400 text-sm mt-1">Users haven&apos;t submitted any feedback from the mobile app yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const badge = TYPE_BADGES[f.type] ?? TYPE_BADGES.bug;
            return (
              <div key={f.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-2">
                      {f.username ? (
                        <Link href={`/chef/${f.username}`} className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 hover:ring-cb-primary/30 transition">
                          {f.username.charAt(0).toUpperCase()}
                        </Link>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold shrink-0">?</div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {f.username ? (
                          <Link href={`/chef/${f.username}`} className="text-sm font-semibold text-gray-900 hover:text-cb-primary hover:underline transition">
                            @{f.username}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">Anonymous</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                          {badge.icon} {f.type}
                        </span>
                        {f.screen && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            {f.screen}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{f.description}</p>

                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">{timeAgo(f.created_at)}</span>
                      {f.platform && (
                        <span className="text-xs text-gray-400">
                          {f.platform === 'ios' ? '📱 iOS' : f.platform === 'android' ? '🤖 Android' : f.platform}
                        </span>
                      )}
                      {f.app_version && (
                        <span className="text-xs text-gray-400">v{f.app_version}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
