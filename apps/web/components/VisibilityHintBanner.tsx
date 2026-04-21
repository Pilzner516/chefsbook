'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@chefsbook/db';

export default function VisibilityHintBanner() {
  const [show, setShow] = useState(false);
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('visibility_hint_seen, recipe_count')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Show hint if: has recipes AND hasn't seen the hint
      if (profile.recipe_count > 0 && !profile.visibility_hint_seen) {
        setRecipeCount(profile.recipe_count);
        setShow(true);
      }
    })();
  }, []);

  const dismiss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_profiles')
      .update({ visibility_hint_seen: true })
      .eq('id', user.id);

    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-card px-4 py-3 mb-4 flex items-start justify-between gap-4">
      <div className="text-sm flex-1">
        <span className="text-lg mr-2">🍳</span>
        Your recipes are shared with the Chefsbook community by default — that's what makes it great. Want to keep something just for you? You can set any recipe to private, or change your default in Settings.
      </div>
      <button onClick={dismiss} className="text-xs text-blue-700 hover:text-blue-900 font-semibold shrink-0">
        Got it
      </button>
    </div>
  );
}
