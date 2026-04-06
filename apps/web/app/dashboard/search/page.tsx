'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, listRecipes, listTechniques } from '@chefsbook/db';
import type { Recipe, Technique } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';

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
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [cuisineFilter, setCuisineFilter] = useState(searchParams.get('cuisine') ?? '');
  const [courseFilter, setCourseFilter] = useState(searchParams.get('course') ?? '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState(0);
  const [sort, setSort] = useState<'relevance' | 'newest' | 'az' | 'time'>('relevance');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  useEffect(() => {
    if (userId) {
      const timer = setTimeout(() => search(), 300);
      return () => clearTimeout(timer);
    }
  }, [query, cuisineFilter, courseFilter, sourceFilter, tagFilter, timeFilter, userId]);

  // Auto-tag state
  const [taggingCount, setTaggingCount] = useState<number | null>(null);
  const [tagging, setTagging] = useState(false);
  const [tagResult, setTagResult] = useState<{ total: number; updated: number } | null>(null);

  useEffect(() => {
    if (userId) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          fetch('/api/recipes/auto-tag', { headers: { Authorization: `Bearer ${session.access_token}` } })
            .then((r) => r.json())
            .then((d) => setTaggingCount(d.needsTagging ?? 0))
            .catch(() => {});
        }
      });
    }
  }, [userId]);

  const startAutoTag = async () => {
    setTagging(true);
    setTagResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch('/api/recipes/auto-tag', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setTagResult(data);
      search(); // Refresh results
    } catch {} finally { setTagging(false); }
  };

  const search = async () => {
    if (!userId) return;
    setLoading(true);
    const [recipeResults, techResults] = await Promise.all([
      listRecipes({
        userId,
        search: query || undefined,
        cuisine: cuisineFilter || undefined,
        course: courseFilter || undefined,
        maxTime: timeFilter === 999 ? undefined : timeFilter || undefined,
        sourceType: sourceFilter || undefined,
        tags: tagFilter ? [tagFilter] : undefined,
        limit: 100,
      }),
      query ? listTechniques({ userId, search: query, limit: 20 }) : Promise.resolve([]),
    ]);
    setRecipes(recipeResults);
    setTechniques(techResults);
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
    return list;
  }, [recipes, sort, timeFilter]);

  const activeFilters = [
    cuisineFilter && { label: cuisineFilter, clear: () => setCuisineFilter('') },
    courseFilter && { label: courseFilter, clear: () => setCourseFilter('') },
    sourceFilter && { label: SOURCES.find((s) => s.value === sourceFilter)?.label ?? sourceFilter, clear: () => setSourceFilter('') },
    tagFilter && { label: tagFilter, clear: () => setTagFilter('') },
    timeFilter > 0 && { label: TIME_FILTERS.find((t) => t.value === timeFilter)?.label ?? '', clear: () => setTimeFilter(0) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="p-8 flex gap-6">
      {/* Left: Category drill-down */}
      <div className="w-[260px] shrink-0 space-y-4 hidden lg:block">
        {/* Cuisine */}
        <div>
          <h3 className="text-xs font-bold text-cb-muted uppercase tracking-wide mb-2">Cuisine</h3>
          <div className="space-y-0.5">
            <button onClick={() => setCuisineFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!cuisineFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>All Cuisines</button>
            {allCuisines.map((c) => (
              <button key={c} onClick={() => setCuisineFilter(c!)} className={`block text-sm w-full text-left px-2 py-1 rounded ${cuisineFilter === c ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>{c}</button>
            ))}
          </div>
        </div>

        {/* Course */}
        <div>
          <h3 className="text-xs font-bold text-cb-muted uppercase tracking-wide mb-2">Course</h3>
          <div className="space-y-0.5">
            <button onClick={() => setCourseFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!courseFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>All Courses</button>
            {COURSES.map((c) => (
              <button key={c} onClick={() => setCourseFilter(c)} className={`block text-sm w-full text-left px-2 py-1 rounded ${courseFilter === c ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
            ))}
          </div>
        </div>

        {/* Source */}
        <div>
          <h3 className="text-xs font-bold text-cb-muted uppercase tracking-wide mb-2">Source</h3>
          <div className="space-y-0.5">
            <button onClick={() => setSourceFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!sourceFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>All Sources</button>
            {SOURCES.map((s) => (
              <button key={s.value} onClick={() => setSourceFilter(s.value)} className={`block text-sm w-full text-left px-2 py-1 rounded ${sourceFilter === s.value ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-xs font-bold text-cb-muted uppercase tracking-wide mb-2">Tags</h3>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            <button onClick={() => setTagFilter('')} className={`block text-sm w-full text-left px-2 py-1 rounded ${!tagFilter ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>All Tags</button>
            {allTags.slice(0, 20).map(([tag, count]) => (
              <button key={tag} onClick={() => setTagFilter(tag)} className={`block text-sm w-full text-left px-2 py-1 rounded ${tagFilter === tag ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>{tag} <span className="text-[10px] text-cb-muted">({count})</span></button>
            ))}
          </div>
        </div>

        {/* Cook time */}
        <div>
          <h3 className="text-xs font-bold text-cb-muted uppercase tracking-wide mb-2">Cook Time</h3>
          <div className="space-y-0.5">
            {TIME_FILTERS.map((t) => (
              <button key={t.value} onClick={() => setTimeFilter(t.value)} className={`block text-sm w-full text-left px-2 py-1 rounded ${timeFilter === t.value ? 'bg-cb-primary/10 text-cb-primary font-medium' : 'text-cb-muted hover:text-cb-text'}`}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 min-w-0">
        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search recipes, ingredients, tags..."
            className="w-full bg-cb-card border border-cb-border rounded-card pl-11 pr-4 py-3.5 text-base placeholder:text-cb-muted/60 outline-none focus:border-cb-primary transition-colors"
          />
        </div>

        {/* Auto-tag button */}
        {taggingCount != null && taggingCount > 0 && !tagResult && (
          <div className="flex items-center justify-between bg-cb-bg rounded-card p-3 mb-4">
            <p className="text-xs text-cb-muted">{taggingCount} recipe{taggingCount !== 1 ? 's' : ''} missing cuisine or course tags</p>
            <button onClick={startAutoTag} disabled={tagging} className="bg-cb-primary text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {tagging ? 'Tagging...' : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>Auto-tag all</>}
            </button>
          </div>
        )}
        {tagResult && (
          <div className="bg-cb-green/10 text-cb-green rounded-card p-3 mb-4 text-xs">
            Auto-tagging complete: {tagResult.updated} of {tagResult.total} recipes updated
            <button onClick={() => setTagResult(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {activeFilters.map((f, i) => (
              <button key={i} onClick={f.clear} className="bg-cb-primary/10 text-cb-primary text-xs font-medium px-2.5 py-1 rounded-full inline-flex items-center gap-1 hover:bg-cb-primary/20">
                {f.label}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            ))}
            <button onClick={() => { setCuisineFilter(''); setCourseFilter(''); setSourceFilter(''); setTagFilter(''); setTimeFilter(0); }} className="text-xs text-cb-muted hover:text-cb-text">Clear all</button>
          </div>
        )}

        {/* Result count + sort */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-cb-muted">{sorted.length} recipe{sorted.length !== 1 ? 's' : ''}{techniques.length > 0 ? ` + ${techniques.length} technique${techniques.length !== 1 ? 's' : ''}` : ''}</p>
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-cb-card border border-cb-border rounded-input px-2 py-1.5 text-xs text-cb-muted outline-none">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="az">A-Z</option>
            <option value="time">Cook Time</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-cb-muted py-16">Searching...</div>
        ) : sorted.length === 0 && techniques.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-cb-muted mb-2">No recipes found</p>
            {activeFilters.length > 0 && <button onClick={() => { setCuisineFilter(''); setCourseFilter(''); setSourceFilter(''); setTagFilter(''); setTimeFilter(0); }} className="text-cb-primary text-sm hover:underline">Clear all filters</button>}
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
                      {recipe.image_url ? <img src={recipe.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-cb-border"><svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M2.25 18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V6a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6v12Z" /></svg></div>}
                      {recipe.visibility === 'private' && <div className="absolute top-2 right-2"><svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg></div>}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1 group-hover:text-cb-primary truncate">{recipe.title}</h3>
                      <div className="flex flex-wrap gap-1 text-[10px] text-cb-muted">
                        {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-1.5 py-0.5 rounded">{recipe.cuisine}</span>}
                        {recipe.course && <span className="bg-cb-green/10 text-cb-green px-1.5 py-0.5 rounded">{recipe.course}</span>}
                        {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
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
