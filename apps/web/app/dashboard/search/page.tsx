'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, listRecipes, listTechniques, searchByIngredient, getPrimaryPhotos, getBatchTranslatedTitles } from '@chefsbook/db';
import type { Recipe, Technique } from '@chefsbook/db';
import { formatDuration, DIETARY_FLAGS } from '@chefsbook/ui';
import { getRecipeImageUrl, CHEFS_HAT_URL } from '@/lib/recipeImage';
import { useTranslation } from 'react-i18next';

const COURSES = ['breakfast', 'brunch', 'lunch', 'dinner', 'starter', 'main', 'side', 'dessert', 'snack', 'drink', 'bread'];
const SOURCES = [
  { value: 'url', label: 'Imported from URL' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'scan', label: 'Scanned' },
  { value: 'ai', label: 'AI Generated' },
  { value: 'manual', label: 'Manual Entry' },
  { value: 'cookbook', label: 'From Cookbook' },
];
const TIME_FILTERS = [
  { label: 'Any', value: 0 },
  { label: 'Under 30 min', value: 30 },
  { label: '30-60 min', value: 60 },
  { label: 'Over 1 hour', value: 999 },
];

export default function SearchPage() {
  const { i18n } = useTranslation();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});

  // Scope toggle
  const [scope, setScope] = useState<'all' | 'mine' | 'following' | 'whats-new'>('all');
  const [followingTimeFilter, setFollowingTimeFilter] = useState(30);
  const [whatsNewTimeFilter, setWhatsNewTimeFilter] = useState(30);

  // Filters
  const [cuisineFilter, setCuisineFilter] = useState(searchParams.get('cuisine') ?? '');
  const [courseFilter, setCourseFilter] = useState(searchParams.get('course') ?? '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState(0);
  const [sort, setSort] = useState<'relevance' | 'newest' | 'az' | 'time' | 'popular'>('relevance');
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [ingredientPills, setIngredientPills] = useState<string[]>([]);
  const [dietaryFilters, setDietaryFilters] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  useEffect(() => {
    if (userId) {
      const timer = setTimeout(() => doSearch(), 300);
      return () => clearTimeout(timer);
    }
  }, [query, cuisineFilter, courseFilter, sourceFilter, tagFilter, timeFilter, ingredientPills, dietaryFilters, userId, scope, followingTimeFilter, whatsNewTimeFilter, i18n.language]);

  const doSearch = async () => {
    if (!userId) return;
    setLoading(true);

    let recipeResults: Recipe[];

    // Following tab
    if (scope === 'following') {
      const days = followingTimeFilter;

      // First, get the list of users being followed
      const { data: follows } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', userId);

      const followingIds = (follows ?? []).map(f => f.following_id);

      if (followingIds.length === 0) {
        recipeResults = [];
      } else {
        const { data } = await supabase
          .from('recipes')
          .select('*')
          .in('user_id', followingIds)
          .eq('visibility', 'public')
          .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(100);

        recipeResults = (data ?? []) as Recipe[];
      }
    }
    // What's New tab
    else if (scope === 'whats-new') {
      const days = whatsNewTimeFilter;
      let query = supabase
        .from('recipes')
        .select('*, hot_score:like_count')
        .eq('visibility', 'public');

      if (days > 0) {
        query = query.gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      }

      const { data, error } = await query
        .order('like_count', { ascending: false })
        .limit(50);

      // Calculate hot score client-side since we can't do complex formulas in Supabase query
      recipeResults = ((data ?? []) as Recipe[]).map(r => {
        const hoursSincePosted = Math.max(1, (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        const hotScore = ((r.like_count ?? 0) + (r.save_count ?? 0)) / Math.pow(hoursSincePosted, 0.8);
        return { ...r, hot_score: hotScore };
      }).sort((a, b) => (b.hot_score ?? 0) - (a.hot_score ?? 0));
    }
    // All Recipes or My Recipes tabs
    else if (ingredientPills.length > 0) {
      // Ingredient search: intersect results
      recipeResults = await searchByIngredient(ingredientPills[0], userId);
      for (let i = 1; i < ingredientPills.length; i++) {
        const more = await searchByIngredient(ingredientPills[i], userId);
        const ids = new Set(more.map((r) => r.id));
        recipeResults = recipeResults.filter((r) => ids.has(r.id));
      }
      // Apply text search client-side
      if (query) {
        const q = query.toLowerCase();
        recipeResults = recipeResults.filter((r) => r.title.toLowerCase().includes(q));
      }
      if (cuisineFilter) recipeResults = recipeResults.filter((r) => r.cuisine === cuisineFilter);
      if (courseFilter) recipeResults = recipeResults.filter((r) => r.course === courseFilter);
    } else {
      recipeResults = await listRecipes({
        userId,
        search: query || undefined,
        cuisine: cuisineFilter || undefined,
        course: courseFilter || undefined,
        maxTime: timeFilter === 999 ? undefined : timeFilter || undefined,
        sourceType: sourceFilter || undefined,
        tags: tagFilter ? [tagFilter] : undefined,
        includePublic: scope === 'all',
        limit: 100,
      });
    }

    // Dietary filter
    if (dietaryFilters.length > 0) {
      recipeResults = recipeResults.filter((r) =>
        dietaryFilters.every((f) => (r.dietary_flags ?? []).includes(f))
      );
    }

    const techResults = query ? await listTechniques({ userId, search: query, limit: 20 }) : [];
    setRecipes(recipeResults);
    setTechniques(techResults);

    // Fetch primary photos and translated titles for all recipes
    if (recipeResults.length > 0) {
      getPrimaryPhotos(recipeResults.map((r) => r.id)).then(setPrimaryPhotos);
      // Fetch translated titles if language is not English
      const lang = i18n.language;
      if (lang && lang !== 'en') {
        getBatchTranslatedTitles(recipeResults.map((r) => r.id), lang).then(setTranslatedTitles);
      } else {
        setTranslatedTitles({}); // Clear translations when switching back to English
      }
    }

    setLoading(false);
  };

  // Derived data for filter panels
  const allCuisines = useMemo(() => [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))].sort(), [recipes]);
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) for (const t of r.tags ?? []) if (!t.startsWith('_')) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [recipes]);

  const sorted = useMemo(() => {
    let list = [...recipes];
    if (timeFilter === 999) list = list.filter((r) => (r.total_minutes ?? 0) > 60);
    if (sort === 'newest') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'time') list.sort((a, b) => (a.total_minutes ?? 999) - (b.total_minutes ?? 999));
    if (sort === 'popular') list.sort((a, b) => ((b.like_count ?? 0) + (b.save_count ?? 0)) - ((a.like_count ?? 0) + (a.save_count ?? 0)));
    return list;
  }, [recipes, sort, timeFilter]);

  const activeFilters = [
    cuisineFilter && { label: cuisineFilter, clear: () => setCuisineFilter('') },
    courseFilter && { label: courseFilter, clear: () => setCourseFilter('') },
    sourceFilter && { label: SOURCES.find((s) => s.value === sourceFilter)?.label ?? sourceFilter, clear: () => setSourceFilter('') },
    tagFilter && { label: tagFilter, clear: () => setTagFilter('') },
    timeFilter > 0 && { label: TIME_FILTERS.find((t) => t.value === timeFilter)?.label ?? '', clear: () => setTimeFilter(0) },
    ...ingredientPills.map((ing) => ({ label: `🥕 ${ing}`, clear: () => setIngredientPills((p) => p.filter((i) => i !== ing)) })),
    ...dietaryFilters.map((d) => {
      const info = DIETARY_FLAGS.find((f) => f.key === d);
      return { label: `${info?.emoji ?? ''} ${info?.label ?? d}`, clear: () => setDietaryFilters((prev) => prev.filter((f) => f !== d)) };
    }),
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="p-8 flex gap-6">
      {/* Left: Category drill-down */}
      <div className="w-[260px] shrink-0 space-y-4 hidden lg:block">
        {/* Cuisine */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Cuisine</h3>
          <div className="space-y-0.5">
            <button onClick={() => setCuisineFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!cuisineFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>All Cuisines</button>
            {allCuisines.map((c) => (
              <button key={c} onClick={() => setCuisineFilter(c!)} className={`block text-sm w-full text-left px-2 py-1 rounded ${cuisineFilter === c ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>{c}</button>
            ))}
          </div>
        </div>

        {/* Course */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Course</h3>
          <div className="space-y-0.5">
            <button onClick={() => setCourseFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!courseFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>All Courses</button>
            {COURSES.map((c) => (
              <button key={c} onClick={() => setCourseFilter(c)} className={`block text-sm w-full text-left px-2 py-1 rounded ${courseFilter === c ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
            ))}
          </div>
        </div>

        {/* Source */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Source</h3>
          <div className="space-y-0.5">
            <button onClick={() => setSourceFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!sourceFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>All Sources</button>
            {SOURCES.map((s) => (
              <button key={s.value} onClick={() => setSourceFilter(s.value)} className={`block text-sm w-full text-left px-2 py-1 rounded ${sourceFilter === s.value ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Tags</h3>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            <button onClick={() => setTagFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!tagFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>All Tags</button>
            {allTags.slice(0, 20).map(([tag, count]) => (
              <button key={tag} onClick={() => setTagFilter(tag)} className={`block text-sm w-full text-left px-2 py-1 rounded ${tagFilter === tag ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>{tag} <span className="text-[10px] text-cb-secondary">({count})</span></button>
            ))}
          </div>
        </div>

        {/* Ingredient search */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Ingredient</h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            const val = ingredientFilter.trim().toLowerCase();
            if (val && !ingredientPills.includes(val)) {
              setIngredientPills((p) => [...p, val]);
              setIngredientFilter('');
            }
          }} className="flex gap-1 mb-1">
            <input
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              placeholder="e.g. chicken..."
              className="flex-1 bg-cb-bg border border-cb-border rounded-input px-2 py-1 text-sm outline-none focus:border-cb-primary min-w-0"
            />
            <button type="submit" className="text-cb-primary text-sm font-medium px-2">+</button>
          </form>
          {ingredientPills.map((ing) => (
            <button key={ing} onClick={() => setIngredientPills((p) => p.filter((i) => i !== ing))} className="inline-flex items-center gap-1 bg-cb-primary/10 text-cb-primary text-xs font-medium px-2 py-0.5 rounded-full mr-1 mb-1 hover:bg-cb-primary/20">
              🥕 {ing}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          ))}
        </div>

        {/* Dietary Restrictions */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Dietary</h3>
          <div className="flex flex-wrap gap-1">
            {DIETARY_FLAGS.map((flag) => (
              <button
                key={flag.key}
                onClick={() => setDietaryFilters((prev) => prev.includes(flag.key) ? prev.filter((f) => f !== flag.key) : [...prev, flag.key])}
                className={`text-xs px-2 py-1 rounded-full ${dietaryFilters.includes(flag.key) ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
              >
                {flag.emoji} {flag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cook time */}
        <div>
          <h3 className="text-xs font-bold text-cb-secondary uppercase tracking-wide mb-2">Cook Time</h3>
          <div className="space-y-0.5">
            {TIME_FILTERS.map((t) => (
              <button key={t.value} onClick={() => setTimeFilter(t.value)} className={`block text-sm w-full text-left px-2 py-1 rounded ${timeFilter === t.value ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-secondary hover:text-cb-text'}`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 min-w-0">
        {/* Scope toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setScope('all')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${scope === 'all' ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
          >
            All Recipes
          </button>
          <button
            onClick={() => setScope('mine')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${scope === 'mine' ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
          >
            My Recipes
          </button>
          <button
            onClick={() => setScope('following')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${scope === 'following' ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
          >
            Following
          </button>
          <button
            onClick={() => setScope('whats-new')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${scope === 'whats-new' ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
          >
            What's New
          </button>
        </div>

        {/* Time filter for Following tab */}
        {scope === 'following' && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFollowingTimeFilter(7)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${followingTimeFilter === 7 ? 'bg-cb-primary/20 text-cb-primary' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
            >
              7 days
            </button>
            <button
              onClick={() => setFollowingTimeFilter(30)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${followingTimeFilter === 30 ? 'bg-cb-primary/20 text-cb-primary' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
            >
              30 days
            </button>
            <button
              onClick={() => setFollowingTimeFilter(90)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${followingTimeFilter === 90 ? 'bg-cb-primary/20 text-cb-primary' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
            >
              90 days
            </button>
          </div>
        )}

        {/* Time filter for What's New tab */}
        {scope === 'whats-new' && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setWhatsNewTimeFilter(7)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${whatsNewTimeFilter === 7 ? 'bg-cb-primary/20 text-cb-primary' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
            >
              Last 7 days
            </button>
            <button
              onClick={() => setWhatsNewTimeFilter(30)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${whatsNewTimeFilter === 30 ? 'bg-cb-primary/20 text-cb-primary' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
            >
              Last 30 days
            </button>
            <button
              onClick={() => setWhatsNewTimeFilter(0)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${whatsNewTimeFilter === 0 ? 'bg-cb-primary/20 text-cb-primary' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}
            >
              All time
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search recipes, ingredients, tags..."
            className="w-full bg-cb-card border border-cb-border rounded-card pl-11 pr-4 py-3.5 text-base placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
          />
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {activeFilters.map((f, i) => (
              <button key={i} onClick={f.clear} className="bg-cb-primary/10 text-cb-primary text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 hover:bg-cb-primary/20">
                {f.label}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            ))}
            <button onClick={() => { setCuisineFilter(''); setCourseFilter(''); setSourceFilter(''); setTagFilter(''); setTimeFilter(0); setIngredientPills([]); setDietaryFilters([]); }} className="text-xs text-cb-secondary hover:text-cb-text">Clear all</button>
          </div>
        )}

        {/* Result count + sort */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-cb-secondary">{sorted.length} recipe{sorted.length !== 1 ? 's' : ''}{techniques.length > 0 ? ` + ${techniques.length} technique${techniques.length !== 1 ? 's' : ''}` : ''}</p>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-cb-card border border-cb-border rounded-input px-2 py-1.5 text-xs text-cb-secondary outline-none">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="az">A-Z</option>
            <option value="time">Cook Time</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-cb-secondary py-16">Searching...</div>
        ) : sorted.length === 0 && techniques.length === 0 ? (
          <div className="text-center py-16">
            {scope === 'following' ? (
              <p className="text-cb-secondary">No new recipes from chefs you follow in the last {followingTimeFilter} days.</p>
            ) : scope === 'whats-new' ? (
              <p className="text-cb-secondary">No trending recipes yet — be the first to share one!</p>
            ) : (
              <>
                <p className="text-cb-secondary mb-2">No recipes found</p>
                {activeFilters.length > 0 && <button onClick={() => { setCuisineFilter(''); setCourseFilter(''); setSourceFilter(''); setTagFilter(''); setTimeFilter(0); }} className="text-cb-primary text-sm hover:underline">Clear all filters</button>}
              </>
            )}
          </div>
        ) : (
          <div>
            {/* Techniques */}
            {techniques.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-2">Techniques</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {techniques.map((t) => (
                    <Link key={t.id} href={`/technique/${t.id}`} className="bg-cb-card border border-cb-border rounded-card p-3 hover:border-purple-400 transition-colors flex items-center gap-3">
                      <span className="bg-purple-100 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">Technique</span>
                      <span className="text-sm font-medium truncate">{t.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recipes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((recipe) => (
                <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="group">
                  <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                    <div className="h-36 bg-cb-bg overflow-hidden relative">
                      {(() => {
                        const imgUrl = getRecipeImageUrl(primaryPhotos[recipe.id], recipe.image_url, recipe.youtube_video_id);
                        return imgUrl ? <img src={imgUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <img src={CHEFS_HAT_URL} alt="" className="w-20 h-20 object-contain opacity-30 mx-auto mt-6" />;
                      })()}
                      {recipe.visibility === 'private' && <div className="absolute top-2 right-2"><svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg></div>}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1 group-hover:text-cb-primary truncate">{translatedTitles[recipe.id] ?? recipe.title}</h3>
                      <div className="flex flex-wrap gap-1 text-[10px] text-cb-secondary">
                        {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-1.5 py-0.5 rounded">{recipe.cuisine}</span>}
                        {recipe.course && <span className="bg-cb-green/10 text-cb-green px-1.5 py-0.5 rounded">{recipe.course}</span>}
                        {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                        {(recipe.like_count ?? 0) > 0 && <span>♥ {recipe.like_count}</span>}
                        {(recipe.save_count ?? 0) > 0 && <span>🔖 {recipe.save_count}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
