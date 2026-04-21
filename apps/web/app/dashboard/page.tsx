'use client';
// TODO(web): add recipe version sub-cards to recipe list cards

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, listRecipes, deleteRecipe, toggleFavourite, getRecipe, listShoppingLists, getPrimaryPhotos, getBatchTranslatedTitles } from '@chefsbook/db';
import type { Recipe, ShoppingList } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';
import { useTranslation } from 'react-i18next';
import { addIngredientsToList } from '@/lib/addToShoppingList';
import { getRecipeImageUrl, CHEFS_HAT_URL } from '@/lib/recipeImage';
import FeedbackCard from '@/components/FeedbackCard';
import NotificationBell from '@/components/NotificationBell';
import IncompleteRecipesBanner from '@/components/IncompleteRecipesBanner';
import { useConfirmDialog } from '@/components/useConfirmDialog';
import ThemePickerModal from '@/components/ThemePickerModal';
import { IMAGE_THEMES } from '@chefsbook/ai';
import type { ImageTheme } from '@chefsbook/ai';

type ViewMode = 'grid' | 'list' | 'table';
type SortKey = 'date' | 'title-asc' | 'title-desc' | 'time' | 'cuisine';

function getStoredView(): ViewMode {
  if (typeof window === 'undefined') return 'grid';
  return (localStorage.getItem('cb_view') as ViewMode) ?? 'grid';
}
function getStoredSort(): SortKey {
  if (typeof window === 'undefined') return 'date';
  return (localStorage.getItem('cb_sort') as SortKey) ?? 'date';
}

export default function DashboardPage() {
  const { i18n } = useTranslation();
  const searchParams = useSearchParams();
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') === 'incomplete' ? 'Incomplete' : 'All');
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{ id: string; email: string; username: string | null } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [tableSortCol, setTableSortCol] = useState<string>('date');
  const [tableSortAsc, setTableSortAsc] = useState(false);
  const [imageTheme, setImageTheme] = useState<ImageTheme>('bright_fresh');
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    setViewMode(getStoredView());
    setSortKey(getStoredSort());
  }, []);

  // Update activeFilter when URL param changes
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'incomplete') {
      setActiveFilter('Incomplete');
    } else if (filterParam === 'favourites') {
      setActiveFilter('Favourites');
    } else if (!filterParam || filterParam === 'all') {
      setActiveFilter('All');
    }
  }, [searchParams]);

  const changeView = (v: ViewMode) => { setViewMode(v); localStorage.setItem('cb_view', v); };
  const changeSort = (s: SortKey) => { setSortKey(s); localStorage.setItem('cb_sort', s); };

  useEffect(() => {
    const timer = setTimeout(() => loadRecipes(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadRecipes = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const data = await listRecipes({ userId: user.id, search: search || undefined });
      setRecipes(data);
      if (data.length > 0) {
        getPrimaryPhotos(data.map((r) => r.id)).then(setPrimaryPhotos);
        // Fetch translated titles if language is not English
        const lang = i18n.language;
        if (lang && lang !== 'en') {
          getBatchTranslatedTitles(data.map((r) => r.id), lang).then(setTranslatedTitles);
        }
      }
      if (!userInfo) {
        const { data: profile } = await supabase.from('user_profiles').select('username, image_theme').eq('id', user.id).single();
        setUserInfo({ id: user.id, email: user.email ?? '', username: profile?.username ?? null });
        if (profile?.image_theme) setImageTheme(profile.image_theme as ImageTheme);
      }
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map((r) => r.id)));
  };

  const handleBulkReimport = async () => {
    if (selected.size === 0) return;
    setBulkAction('reimporting');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBulkAction(null); return; }

    try {
      const res = await fetch('/api/import/reimport', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recipeIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBulkAction(`Re-importing ${data.started} recipes...`);
      // Poll until done — just wait and reload
      setTimeout(async () => {
        await loadRecipes();
        setBulkAction(null);
        setSelectMode(false);
        setSelected(new Set());
      }, data.started * 3000 + 2000);
    } catch (e: any) {
      alert(e.message);
      setBulkAction(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const ok = await confirm({ icon: '\u{1F5D1}\uFE0F', title: 'Delete recipes?', body: `Delete ${selected.size} recipe${selected.size > 1 ? 's' : ''}? This cannot be undone.`, confirmLabel: 'Delete' });
    if (!ok) return;
    setBulkAction('deleting');
    try {
      for (const id of selected) {
        await deleteRecipe(id);
      }
      await loadRecipes();
    } catch (e: any) {
      alert(e.message);
    }
    setBulkAction(null);
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleToggleFavourite = async (e: React.MouseEvent, recipeId: string, current: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleFavourite(recipeId, !current);
    setRecipes((prev) => prev.map((r) => r.id === recipeId ? { ...r, is_favourite: !current } : r));
  };

  // Cart quick-add
  const [cartRecipeId, setCartRecipeId] = useState<string | null>(null);
  const [cartLists, setCartLists] = useState<ShoppingList[]>([]);
  const [cartLoading, setCartLoading] = useState(false);

  const openCartPopover = async (e: React.MouseEvent, recipeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const lists = await listShoppingLists(user.id);
    setCartLists(lists);
    // If user has a pinned list, add directly
    const pinned = lists.find((l) => l.pinned);
    if (pinned) {
      await quickAddToList(recipeId, pinned.id, pinned.name);
      return;
    }
    setCartRecipeId(recipeId);
  };

  const quickAddToList = async (recipeId: string, listId: string, listName: string) => {
    setCartLoading(true);
    try {
      const full = await getRecipe(recipeId);
      if (!full || !full.ingredients.length) {
        alert('This recipe has no ingredients to add');
        return;
      }
      const items = full.ingredients.map((ing) => ({
        ingredient: ing.ingredient,
        quantity: ing.quantity,
        unit: ing.unit,
        quantity_needed: [ing.quantity, ing.unit].filter(Boolean).join(' ') || null,
        recipe_id: full.id,
        recipe_name: full.title,
      }));
      await addIngredientsToList(listId, items);
      setCartRecipeId(null);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add items');
    } finally {
      setCartLoading(false);
    }
  };

  // Build dynamic filters from actual recipe data
  const dynamicFilters = (() => {
    const pills: { label: string; test: (r: Recipe) => boolean }[] = [
      { label: 'All', test: () => true },
    ];
    if (recipes.some((r) => (r as any).is_complete === false)) {
      pills.push({ label: 'Incomplete', test: (r) => (r as any).is_complete === false });
    }
    if (recipes.some((r) => r.is_favourite)) {
      pills.push({ label: 'Favourites', test: (r) => r.is_favourite });
    }
    // Course filters
    const courses = [...new Set(recipes.map((r) => r.course).filter(Boolean))];
    for (const c of courses) {
      pills.push({ label: c!.charAt(0).toUpperCase() + c!.slice(1), test: (r) => r.course === c });
    }
    // Cuisine filters (top 5 by count)
    const cuisineCounts = new Map<string, number>();
    for (const r of recipes) {
      if (r.cuisine) cuisineCounts.set(r.cuisine, (cuisineCounts.get(r.cuisine) ?? 0) + 1);
    }
    const topCuisines = [...cuisineCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);
    for (const c of topCuisines) {
      if (!pills.some((p) => p.label.toLowerCase() === c.toLowerCase())) {
        pills.push({ label: c, test: (r) => r.cuisine?.toLowerCase() === c.toLowerCase() });
      }
    }
    // Quick (under 30 min)
    if (recipes.some((r) => r.total_minutes != null && r.total_minutes > 0 && r.total_minutes <= 30)) {
      pills.push({ label: 'Quick', test: (r) => r.total_minutes != null && r.total_minutes <= 30 });
    }
    return pills;
  })();

  const activeFilterDef = dynamicFilters.find((f) => f.label === activeFilter) ?? dynamicFilters[0];
  const filtered = recipes.filter(activeFilterDef.test);

  const sortFn = (a: Recipe, b: Recipe): number => {
    const key = viewMode === 'table' ? tableSortCol : sortKey;
    const asc = viewMode === 'table' ? tableSortAsc : key === 'title-asc';
    const dir = asc ? 1 : -1;
    if (key === 'title-asc' || key === 'title-desc' || key === 'title') return dir * a.title.localeCompare(b.title);
    if (key === 'time' || key === 'cook_time') return dir * ((a.total_minutes ?? 999) - (b.total_minutes ?? 999));
    if (key === 'cuisine') return dir * (a.cuisine ?? '').localeCompare(b.cuisine ?? '');
    if (key === 'course') return dir * (a.course ?? '').localeCompare(b.course ?? '');
    // default: date desc
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  };
  const sorted = [...filtered].sort(sortFn);

  const toggleTableSort = (col: string) => {
    if (tableSortCol === col) setTableSortAsc(!tableSortAsc);
    else { setTableSortCol(col); setTableSortAsc(true); }
  };

  return (
    <div className="p-8">
      <IncompleteRecipesBanner />
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Recipes</h1>
        <div className="flex items-center gap-3">
          {/* Notification bell — opens slide-in panel */}
          <NotificationBell />
          {selectMode ? (
            <>
              <span className="text-sm text-cb-secondary">{selected.size} selected</span>
              <button onClick={selectAll} className="text-sm text-cb-primary hover:underline">
                Select all
              </button>
              <button
                onClick={handleBulkReimport}
                disabled={selected.size === 0 || !!bulkAction}
                className="bg-cb-green text-white px-4 py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className={`w-4 h-4 ${bulkAction === 'reimporting' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                Re-import
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selected.size === 0 || !!bulkAction}
                className="border border-red-200 text-cb-primary px-4 py-2 rounded-input text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                className="text-sm text-cb-secondary hover:text-cb-text"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {recipes.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="border border-cb-border px-4 py-2 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text hover:bg-cb-card transition-colors"
                >
                  Select
                </button>
              )}
              <button
                onClick={() => setShowThemePicker(true)}
                className="border border-cb-border px-4 py-2 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text hover:bg-cb-card transition-colors flex items-center gap-1.5"
              >
                {IMAGE_THEMES[imageTheme]?.emoji} My Image Theme
              </button>
              <Link
                href="/dashboard/scan"
                className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Recipe
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Bulk action status */}
      {bulkAction && typeof bulkAction === 'string' && bulkAction !== 'deleting' && bulkAction !== 'reimporting' && (
        <div className="bg-cb-green/10 text-cb-green border border-cb-green/20 rounded-input p-3 mb-4 text-sm font-medium">
          {bulkAction}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="w-full bg-cb-card border border-cb-border rounded-input pl-10 pr-4 py-3 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
        />
      </div>

      {/* Filter pills + view toggle + sort */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-2 flex-1">
          {dynamicFilters.map((f) => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f.label)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === f.label
                  ? 'bg-cb-primary text-white'
                  : 'bg-cb-card border border-cb-border text-cb-secondary hover:text-cb-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Sort dropdown */}
        <select
          value={sortKey}
          onChange={(e) => changeSort(e.target.value as SortKey)}
          className="bg-cb-card border border-cb-border rounded-input px-2 py-1.5 text-xs text-cb-secondary outline-none"
        >
          <option value="date">Date Added</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
          <option value="time">Cook Time</option>
          <option value="cuisine">Cuisine</option>
        </select>
        {/* View toggle */}
        <div className="flex bg-cb-card border border-cb-border rounded-input overflow-hidden">
          <button onClick={() => changeView('grid')} className={`px-2.5 py-1.5 ${viewMode === 'grid' ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:text-cb-text'}`} title="Grid view">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" /></svg>
          </button>
          <button onClick={() => changeView('list')} className={`px-2.5 py-1.5 border-x border-cb-border ${viewMode === 'list' ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:text-cb-text'}`} title="List view">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>
          </button>
          <button onClick={() => changeView('table')} className={`px-2.5 py-1.5 ${viewMode === 'table' ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:text-cb-text'}`} title="Table view">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" /></svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading recipes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No recipes yet</h2>
          <p className="text-cb-secondary text-sm mb-6">
            Scan a recipe, import from a URL, or add one manually.
          </p>
          <Link
            href="/dashboard/scan"
            className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add Your First Recipe
          </Link>
        </div>
      ) : (
        <>
        {/* Grid view */}
        {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!selectMode && userInfo && (
            <FeedbackCard userId={userInfo.id} username={userInfo.username} email={userInfo.email} />
          )}
          {sorted.map((recipe) => {
            const isSelected = selected.has(recipe.id);
            const Wrapper = selectMode ? 'div' as const : Link;
            const wrapperProps = selectMode
              ? { onClick: () => toggleSelect(recipe.id), className: 'group cursor-pointer' }
              : { href: `/recipe/${recipe.id}`, className: 'group' };
            return (
              <Wrapper key={recipe.id} {...wrapperProps as any}>
                <div className={`bg-cb-card border rounded-card overflow-hidden transition-colors relative ${isSelected ? 'border-cb-primary ring-2 ring-cb-primary/30' : 'border-cb-border hover:border-cb-primary/50'}`}>
                  {selectMode && (<div className="absolute top-3 left-3 z-10"><span className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-cb-primary border-cb-primary text-white' : 'bg-white/80 border-cb-border'}`}>{isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}</span></div>)}
                  <div className="h-40 bg-cb-bg overflow-hidden flex items-center justify-center relative">
                    {(() => { const imgUrl = getRecipeImageUrl(primaryPhotos[recipe.id], recipe.image_url); return imgUrl ? <img src={imgUrl} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <img src={CHEFS_HAT_URL} alt="ChefsBook" className="w-20 h-20 object-contain opacity-30" />; })()}
                    {recipe.youtube_video_id && <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg"><svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div></div>}
                    {recipe.visibility === 'private' && <div className="absolute top-2 right-2 bg-white/80 rounded-full p-0.5"><svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg></div>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1.5 group-hover:text-cb-primary transition-colors">{translatedTitles[recipe.id] ?? recipe.title}</h3>
                    {recipe.original_submitter_username && recipe.original_submitter_id !== recipe.user_id && (
                      <p className="text-[11px] text-cb-muted mb-1">by @{recipe.original_submitter_username}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1 text-xs text-cb-secondary">
                      {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-1.5 py-0.5 rounded text-[10px]">{recipe.cuisine}</span>}
                      {recipe.course && <span className="bg-cb-green/10 text-cb-green px-1.5 py-0.5 rounded text-[10px]">{recipe.course}</span>}
                      {recipe.youtube_video_id && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-0.5"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>Video</span>}
                      {recipe.tags?.filter((t) => !t.startsWith('_')).slice(0, 3).map((tag) => (
                        <span key={tag} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                      ))}
                      {(recipe.tags?.filter((t) => !t.startsWith('_')).length ?? 0) > 3 && <span className="text-[10px] text-cb-secondary">+{(recipe.tags?.filter((t) => !t.startsWith('_')).length ?? 0) - 3}</span>}
                      {recipe.total_minutes != null && recipe.total_minutes > 0 && <span className="text-[10px]">{formatDuration(recipe.total_minutes)}</span>}
                      <span className="ml-auto flex items-center gap-1.5 shrink-0">
                        <button onClick={(e) => openCartPopover(e, recipe.id)} className="text-cb-border hover:text-cb-green transition-colors" title="Add to shopping list">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                        </button>
                        <button onClick={(e) => handleToggleFavourite(e, recipe.id, recipe.is_favourite)} className={`transition-colors ${recipe.is_favourite ? 'text-cb-primary' : 'text-cb-border hover:text-cb-primary/60'}`}>{recipe.is_favourite ? '\u2665' : '\u2661'}</button>
                      </span>
                    </div>
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
        )}

        {/* List view */}
        {viewMode === 'list' && (
        <div className="space-y-1">
          {sorted.map((recipe) => (
            <Link key={recipe.id} href={`/recipe/${recipe.id}`} className="flex items-center gap-4 bg-cb-card border border-cb-border rounded-input px-4 py-2.5 hover:border-cb-primary/50 transition-colors group">
              <div className="w-16 h-16 rounded-input overflow-hidden bg-cb-bg shrink-0 relative">
                {(() => { const imgUrl = getRecipeImageUrl(primaryPhotos[recipe.id], recipe.image_url); return imgUrl ? <img src={imgUrl} alt="" className="w-full h-full object-cover" /> : <img src={CHEFS_HAT_URL} alt="" className="w-10 h-10 object-contain opacity-30 mx-auto mt-3" />; })()}
                {recipe.youtube_video_id && <div className="absolute inset-0 flex items-center justify-center"><div className="w-6 h-6 rounded-full bg-red-600/90 flex items-center justify-center"><svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm group-hover:text-cb-primary transition-colors truncate">{translatedTitles[recipe.id] ?? recipe.title}</p>
                {recipe.original_submitter_username && recipe.original_submitter_id !== recipe.user_id && (
                  <p className="text-[10px] text-cb-muted">by @{recipe.original_submitter_username}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-cb-secondary mt-0.5">
                  {recipe.cuisine && <span className="bg-cb-primary/10 text-cb-primary px-1.5 py-0.5 rounded text-[10px]">{recipe.cuisine}</span>}
                  {recipe.course && <span className="bg-cb-green/10 text-cb-green px-1.5 py-0.5 rounded text-[10px]">{recipe.course}</span>}
                  {recipe.total_minutes != null && recipe.total_minutes > 0 && <span>{formatDuration(recipe.total_minutes)}</span>}
                </div>
              </div>
              <button onClick={(e) => openCartPopover(e, recipe.id)} className="shrink-0 text-cb-border hover:text-cb-green transition-colors" title="Add to shopping list">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
              </button>
              <button onClick={(e) => handleToggleFavourite(e, recipe.id, recipe.is_favourite)} className={`shrink-0 transition-colors ${recipe.is_favourite ? 'text-cb-primary' : 'text-cb-border hover:text-cb-primary/60'}`}>{recipe.is_favourite ? '\u2665' : '\u2661'}</button>
            </Link>
          ))}
        </div>
        )}

        {/* Table view */}
        {viewMode === 'table' && (
        <div className="border border-cb-border rounded-card overflow-hidden">
          <div className="text-xs text-cb-secondary px-3 py-1.5 bg-cb-bg border-b border-cb-border">
            Showing {sorted.length} of {recipes.length} recipes
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cb-bg border-b border-cb-border text-left text-xs text-cb-secondary">
                <th className="px-3 py-2 w-10"></th>
                {[
                  { key: 'title', label: 'Title' },
                  { key: 'cuisine', label: 'Cuisine' },
                  { key: 'course', label: 'Course' },
                  { key: 'cook_time', label: 'Time' },
                  { key: 'date', label: 'Added' },
                ].map((col) => (
                  <th key={col.key} className="px-3 py-2 cursor-pointer hover:text-cb-text select-none" onClick={() => toggleTableSort(col.key)}>
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {tableSortCol === col.key && <span>{tableSortAsc ? '\u25B2' : '\u25BC'}</span>}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 w-8" title="Shopping list"><svg className="w-4 h-4 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg></th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((recipe, i) => (
                <tr key={recipe.id} className={`border-b border-cb-border/50 hover:bg-cb-bg/50 transition-colors ${i % 2 === 1 ? 'bg-cb-bg/30' : ''}`}>
                  <td className="px-3 py-1.5">
                    <Link href={`/recipe/${recipe.id}`}>
                      {(() => { const imgUrl = getRecipeImageUrl(primaryPhotos[recipe.id], recipe.image_url); return imgUrl ? <img src={imgUrl} alt="" className="w-8 h-8 rounded object-cover" /> : <img src={CHEFS_HAT_URL} alt="" className="w-8 h-8 rounded object-contain opacity-30" />; })()}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5"><Link href={`/recipe/${recipe.id}`} className="font-medium hover:text-cb-primary">{translatedTitles[recipe.id] ?? recipe.title}</Link></td>
                  <td className="px-3 py-1.5 text-cb-secondary text-xs">{recipe.cuisine ?? '-'}</td>
                  <td className="px-3 py-1.5 text-cb-secondary text-xs">{recipe.course ?? '-'}</td>
                  <td className="px-3 py-1.5 text-cb-secondary text-xs">{recipe.total_minutes ? formatDuration(recipe.total_minutes) : '-'}</td>
                  <td className="px-3 py-1.5 text-cb-secondary text-xs">{new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className="px-3 py-1.5">
                    <button onClick={(e) => openCartPopover(e, recipe.id)} className="text-cb-border hover:text-cb-green transition-colors" title="Add to shopping list">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <button onClick={(e) => handleToggleFavourite(e, recipe.id, recipe.is_favourite)} className={`transition-colors ${recipe.is_favourite ? 'text-cb-primary' : 'text-cb-border hover:text-cb-primary/60'}`}>{recipe.is_favourite ? '\u2665' : '\u2661'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        </>
      )}

      {/* Cart quick-add popover */}
      {cartRecipeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCartRecipeId(null)}>
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3">Add to shopping list</h3>
            {cartLists.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {cartLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => quickAddToList(cartRecipeId, list.id, list.name)}
                    disabled={cartLoading}
                    className="bg-cb-bg border border-cb-border rounded-card p-3 text-left hover:border-cb-green hover:bg-cb-green/5 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      {list.pinned && <span className="text-cb-primary text-[10px]">{'\u2605'}</span>}
                      <p className="text-sm font-medium truncate">{list.name}</p>
                    </div>
                    {list.store_name && <p className="text-[10px] text-cb-secondary truncate">{list.store_name}</p>}
                  </button>
                ))}
                <Link
                  href="/dashboard/shop"
                  onClick={() => setCartRecipeId(null)}
                  className="border-2 border-dashed border-cb-border rounded-card p-3 text-center hover:border-cb-green transition-colors flex flex-col items-center justify-center"
                >
                  <svg className="w-5 h-5 text-cb-secondary mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  <p className="text-xs text-cb-secondary">New list</p>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-cb-secondary text-sm mb-3">No shopping lists yet</p>
                <Link href="/dashboard/shop" onClick={() => setCartRecipeId(null)} className="bg-cb-green text-white px-5 py-2 rounded-input text-sm font-semibold hover:opacity-90 inline-block">Create a list</Link>
              </div>
            )}
            <button onClick={() => setCartRecipeId(null)} className="mt-3 w-full text-center text-xs text-cb-secondary hover:text-cb-text">Cancel</button>
          </div>
        </div>
      )}
      <ConfirmDialog />
      {showThemePicker && (
        <ThemePickerModal
          currentTheme={imageTheme}
          onClose={() => setShowThemePicker(false)}
          onSave={async (theme) => {
            setImageTheme(theme);
            setShowThemePicker(false);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              await fetch('/api/user/theme', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify({ theme }),
              });
            } catch { /* silent */ }
          }}
        />
      )}
    </div>
  );
}
