'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPublicFeed, getPrimaryPhotos } from '@chefsbook/db';
import type { Recipe } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';
import WhatsNewFeed from '@/components/WhatsNewFeed';
import { getRecipeImageUrl, CHEFS_HAT_URL } from '@/lib/recipeImage';

type FeedRecipe = Recipe & { author_name: string; author_avatar: string | null };

export default function DiscoverPage() {
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFeed();
  }, [cuisineFilter]);

  const loadFeed = async () => {
    setLoading(true);
    const data = await getPublicFeed({ limit: 30, cuisineFilter: cuisineFilter || undefined });
    setRecipes(data as FeedRecipe[]);
    if (data.length > 0) {
      getPrimaryPhotos(data.map((r) => r.id)).then(setPrimaryPhotos);
    }
    setLoading(false);
  };

  const cuisines = [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Discover</h1>
      <p className="text-cb-secondary text-sm mb-6">Public recipes from the ChefsBook community.</p>

      <WhatsNewFeed />

      {cuisines.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCuisineFilter('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!cuisineFilter ? 'bg-cb-primary text-white' : 'bg-cb-card border border-cb-border text-cb-secondary hover:text-cb-text'}`}
          >
            All
          </button>
          {cuisines.map((c) => (
            <button
              key={c}
              onClick={() => setCuisineFilter(c!)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${cuisineFilter === c ? 'bg-cb-primary text-white' : 'bg-cb-card border border-cb-border text-cb-secondary hover:text-cb-text'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-cb-secondary">No public recipes yet. Be the first to share one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="group">
              <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                <div className="h-40 bg-cb-bg overflow-hidden flex items-center justify-center">
                  {(() => { const imgUrl = getRecipeImageUrl(primaryPhotos[recipe.id], recipe.image_url); return imgUrl ? <img src={imgUrl} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <img src={CHEFS_HAT_URL} alt="ChefsBook" className="w-20 h-20 object-contain opacity-30" />; })()}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1 group-hover:text-cb-primary transition-colors">{recipe.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-cb-secondary">
                    {recipe.author_avatar ? (
                      <img src={recipe.author_avatar} alt="" className="w-4 h-4 rounded-full" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-cb-primary/20 flex items-center justify-center text-[8px] font-bold text-cb-primary">
                        {recipe.author_name?.charAt(0) ?? '?'}
                      </div>
                    )}
                    <span>{recipe.author_name}</span>
                    {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-1.5 py-0.5 rounded text-[10px]">{recipe.cuisine}</span>}
                    {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                  </div>
                  {recipe.attributed_to_username && (
                    <div className="mt-1 text-xs text-cb-secondary">
                      <span className="bg-cb-base px-1.5 py-0.5 rounded">🔗 via @{recipe.attributed_to_username}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
