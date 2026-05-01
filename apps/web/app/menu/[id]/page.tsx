'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getMenu, getPrimaryPhotos } from '@chefsbook/db';
import { getRecipeImageUrl } from '@/lib/recipeImage';
import type { MenuWithItems } from '@chefsbook/db';
import { COURSE_ORDER, COURSE_LABELS, type MenuCourse } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';

export default function PublicMenuPage() {
  const { id } = useParams<{ id: string }>();
  const [menu, setMenu] = useState<MenuWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    loadMenu(id);
  }, [id]);

  const loadMenu = async (menuId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMenu(menuId);
      if (!data) {
        setError('Menu not found');
        setLoading(false);
        return;
      }
      if (!data.is_public) {
        setError('This menu is private');
        setLoading(false);
        return;
      }
      setMenu(data);

      const recipeIds = data.menu_items.map((item) => item.recipe_id);
      if (recipeIds.length > 0) {
        const photos = await getPrimaryPhotos(recipeIds);
        setPrimaryPhotos(photos);
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
      setError('Failed to load menu');
    }
    setLoading(false);
  };

  const getItemsByCourse = (course: MenuCourse) => {
    if (!menu) return [];
    return menu.menu_items
      .filter((item) => item.course === course)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const getTotalTime = (item: MenuWithItems['menu_items'][0]) => {
    const recipe = item.recipe;
    if (!recipe) return null;
    const total = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
    return total > 0 ? formatDuration(total) : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cb-bg flex items-center justify-center">
        <p className="text-cb-secondary">Loading menu...</p>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-screen bg-cb-bg flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-cb-text">{error || 'Menu not found'}</h1>
        <Link href="/" className="text-cb-primary hover:underline">
          Go to ChefsBook
        </Link>
      </div>
    );
  }

  const coursesWithItems = COURSE_ORDER.filter(
    (course) => getItemsByCourse(course).length > 0
  );

  return (
    <div className="min-h-screen bg-cb-bg">
      <header className="bg-cb-card border-b border-cb-border">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link href="/" className="text-cb-primary hover:underline text-sm mb-4 inline-block">
            ← ChefsBook
          </Link>
          <h1 className="text-3xl font-bold text-cb-text">{menu.title}</h1>
          {menu.occasion && (
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium bg-cb-primary-soft text-cb-primary">
              {menu.occasion.replace(/_/g, ' ')}
            </span>
          )}
          {menu.description && (
            <p className="text-cb-secondary mt-4">{menu.description}</p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {coursesWithItems.length === 0 ? (
          <div className="bg-cb-card border border-cb-border rounded-card p-8 text-center">
            <p className="text-cb-secondary">This menu has no recipes yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {coursesWithItems.map((course) => (
              <section key={course}>
                <h2 className="text-xl font-bold text-cb-text mb-4">
                  {COURSE_LABELS[course]}
                </h2>
                <div className="space-y-3">
                  {getItemsByCourse(course).map((item) => {
                    const recipe = item.recipe;
                    if (!recipe) return null;
                    const photo = primaryPhotos[item.recipe_id];
                    const imageUrl = getRecipeImageUrl(photo, recipe.image_url);
                    const time = getTotalTime(item);

                    return (
                      <Link
                        key={item.id}
                        href={`/recipe/${recipe.id}`}
                        className="flex gap-4 bg-cb-card border border-cb-border rounded-card p-4 hover:border-cb-primary transition"
                      >
                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-cb-base">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={recipe.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-cb-muted">
                              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-cb-text truncate">{recipe.title}</h3>
                          {recipe.description && (
                            <p className="text-sm text-cb-secondary line-clamp-2 mt-1">
                              {recipe.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-cb-muted">
                            {time && <span>{time}</span>}
                            {item.servings_override && (
                              <span>{item.servings_override} servings</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-cb-secondary mt-1 italic">{item.notes}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-cb-secondary mb-4">Want to create your own menus?</p>
          <Link
            href="/"
            className="inline-block bg-cb-primary text-white px-6 py-3 rounded-input font-semibold hover:opacity-90 transition"
          >
            Try ChefsBook Free
          </Link>
        </div>
      </main>
    </div>
  );
}
