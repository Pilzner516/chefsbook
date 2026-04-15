'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';
import Link from 'next/link';

export default function IncompleteRecipesBanner() {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('cb_incomplete_banner_dismissed') === '1') {
      setDismissed(true);
      return;
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { count: c } = await supabase
        .from('recipes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_complete', false);
      setCount(c ?? 0);
    });
  }, []);

  if (dismissed || count === 0) return null;

  const dismiss = () => {
    localStorage.setItem('cb_incomplete_banner_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-card px-4 py-3 mb-4 flex items-center justify-between">
      <div className="text-sm">
        ⚠️ You have {count} recipe{count === 1 ? '' : 's'} that need attention. They&apos;re saved as private until you complete them.{' '}
        <Link href="/dashboard?filter=incomplete" className="underline font-semibold">Review now →</Link>
      </div>
      <button onClick={dismiss} className="text-xs text-amber-700 hover:text-amber-900">Dismiss</button>
    </div>
  );
}
