'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getFollowedRecipes } from '@chefsbook/db';
import type { Recipe } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';
import { proxyIfNeeded, CHEFS_HAT_URL } from '@/lib/recipeImage';

type FeedRecipe = Recipe & { author_username: string | null; author_avatar: string | null };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function WhatsNewFeed() {
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const data = await getFollowedRecipes(user.id);
      setRecipes(data);
      setLoading(false);
    })();
  }, []);

  if (loading || !userId) return null;
  if (recipes.length === 0 && !expanded) {
    return (
      <div className="mb-8 p-6 bg-cb-card border border-cb-border rounded-card text-center">
        <p className="text-cb-secondary text-sm">
          Follow chefs to see their latest recipes here.
        </p>
        <Link href="/dashboard/search" className="text-cb-primary text-sm font-semibold hover:underline mt-2 inline-block">
          Find people to follow
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-4 group"
      >
        <span className="text-lg">✨</span>
        <h2 className="text-lg font-bold text-cb-text group-hover:text-cb-primary transition-colors">What&apos;s New</h2>
        <span className="text-xs text-cb-muted bg-cb-base px-2 py-0.5 rounded-full">{recipes.length}</span>
        <svg className={`w-4 h-4 text-cb-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="group">
              <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                <div className="h-40 bg-cb-bg overflow-hidden flex items-center justify-center">
                  {recipe.image_url ? (
                    <img src={proxyIfNeeded(recipe.image_url!)} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <svg className="w-12 h-12 text-cb-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M2.25 18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V6a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6v12Z" />
                    </svg>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors">{recipe.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-cb-secondary">
                    <span>@{recipe.author_username ?? '?'}</span>
                    <span>·</span>
                    <span>{timeAgo(recipe.created_at)}</span>
                    {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-1.5 py-0.5 rounded text-[10px]">{recipe.cuisine}</span>}
                    {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
