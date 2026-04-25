'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';

const DISMISS_KEY = 'cb-nutrition-banner-dismissed';
const MIN_RECIPES_TO_SHOW = 5;

export default function NutritionBanner() {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [queued, setQueued] = useState<number | null>(null);

  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    const countAtDismiss = localStorage.getItem(DISMISS_KEY + '_count');

    checkNutritionCount().then((n) => {
      setCount(n);
      if (dismissedAt && countAtDismiss) {
        const prevCount = parseInt(countAtDismiss, 10);
        if (n > prevCount + MIN_RECIPES_TO_SHOW) {
          setDismissed(false);
        }
      } else if (!dismissedAt) {
        setDismissed(false);
      }
    });
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    localStorage.setItem(DISMISS_KEY + '_count', String(count));
  };

  const handleGenerate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/recipes/bulk-generate-nutrition', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setQueued(data.queued);
        setTimeout(() => handleDismiss(), 3000);
      }
    } catch (err) {
      console.error('Failed to start bulk generation:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (dismissed || count <= MIN_RECIPES_TO_SHOW) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-card p-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">✨</span>
        {queued !== null ? (
          <span className="text-sm text-amber-800">
            Generating nutrition for {queued} recipes in the background...
          </span>
        ) : (
          <span className="text-sm text-amber-800">
            {count} of your recipes don't have nutrition data yet.
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {queued === null && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-sm font-medium text-amber-900 hover:underline disabled:opacity-50"
          >
            {generating ? 'Starting...' : 'Generate for all →'}
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-amber-600 hover:text-amber-800"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

async function checkNutritionCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('nutrition', null);

  return count ?? 0;
}
