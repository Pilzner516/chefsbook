'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';

interface PointsHistory {
  id: string;
  points: number;
  action: string;
  description: string;
  created_at: string;
}

interface Props {
  userId: string;
  isOwnProfile: boolean;
}

export default function PointsDisplay({ userId, isOwnProfile }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!isOwnProfile) return;

    const loadPoints = async () => {
      try {
        // Get points balance
        const { data: balanceData } = await supabase
          .from('user_points_balance')
          .select('total_points')
          .eq('user_id', userId)
          .single();

        setBalance(balanceData?.total_points || 0);

        // Get recent points history
        const { data: historyData } = await supabase
          .from('user_points')
          .select('id, points, action, description, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        setHistory(historyData || []);
      } catch (error) {
        console.error('Failed to load points:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPoints();
  }, [userId, isOwnProfile]);

  // Only show to profile owner
  if (!isOwnProfile) return null;
  if (loading) return null;
  if (balance === null || balance === 0) return null;

  return (
    <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-cb-text">Your Contributions</h2>
        <div className="text-2xl font-bold text-cb-primary">{balance} points</div>
      </div>

      <p className="text-sm text-cb-secondary mb-4">
        Earn points by contributing recipes, filling knowledge gaps, and helping the community.
      </p>

      {history.length > 0 && (
        <>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-cb-primary hover:underline mb-2"
          >
            {showHistory ? 'Hide' : 'Show'} recent activity
          </button>

          {showHistory && (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-cb-border last:border-0">
                  <div className="flex-1">
                    <p className="text-cb-text">{item.description}</p>
                    <p className="text-xs text-cb-muted">
                      {new Date(item.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className={`font-semibold ${item.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.points > 0 ? '+' : ''}{item.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
