'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, listRecipes, deleteRecipe } from '@chefsbook/db';
import type { Recipe } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';

const filters = ['All', 'Favourites', 'Italian', 'Quick'];

export default function DashboardPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);

  useEffect(() => {
    loadRecipes();
  }, [search]);

  const loadRecipes = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const data = await listRecipes({ userId: user.id, search: search || undefined });
      setRecipes(data);
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
    if (!confirm(`Delete ${selected.size} recipe${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
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

  const filtered = recipes.filter((r) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Favourites') return r.is_favourite;
    if (activeFilter === 'Italian') return r.cuisine?.toLowerCase() === 'italian';
    if (activeFilter === 'Quick') return r.total_minutes != null && r.total_minutes <= 30;
    return true;
  });

  return (
    <div className="p-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Recipes</h1>
        <div className="flex items-center gap-3">
          {selectMode ? (
            <>
              <span className="text-sm text-cb-muted">{selected.size} selected</span>
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
                className="text-sm text-cb-muted hover:text-cb-text"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {recipes.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="border border-cb-border px-4 py-2 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text hover:bg-cb-card transition-colors"
                >
                  Select
                </button>
              )}
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
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cb-muted"
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
          className="w-full bg-cb-card border border-cb-border rounded-input pl-10 pr-4 py-3 text-sm placeholder:text-cb-muted/60 outline-none focus:border-cb-primary transition-colors"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-8">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f
                ? 'bg-cb-primary text-white'
                : 'bg-cb-card border border-cb-border text-cb-muted hover:text-cb-text'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-cb-muted py-20">Loading recipes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No recipes yet</h2>
          <p className="text-cb-muted text-sm mb-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((recipe) => {
            const isSelected = selected.has(recipe.id);
            const Wrapper = selectMode ? 'div' as const : Link;
            const wrapperProps = selectMode
              ? { onClick: () => toggleSelect(recipe.id), className: 'group cursor-pointer' }
              : { href: `/recipe/${recipe.id}`, className: 'group' };

            return (
              <Wrapper key={recipe.id} {...wrapperProps as any}>
                <div className={`bg-cb-card border rounded-card overflow-hidden transition-colors relative ${
                  isSelected ? 'border-cb-primary ring-2 ring-cb-primary/30' : 'border-cb-border hover:border-cb-primary/50'
                }`}>
                  {selectMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`w-5 h-5 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-cb-primary border-cb-primary text-white' : 'bg-white/80 border-cb-border'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="h-40 bg-cb-bg overflow-hidden flex items-center justify-center">
                    {recipe.image_url ? (
                      <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <svg className="w-12 h-12 text-cb-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M2.25 18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V6a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6v12Z" />
                      </svg>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1.5 group-hover:text-cb-primary transition-colors">
                      {recipe.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-cb-muted">
                      {recipe.cuisine && (
                        <span className="bg-cb-primary/10 text-cb-primary px-2 py-0.5 rounded">
                          {recipe.cuisine}
                        </span>
                      )}
                      {recipe.tags && recipe.tags.length > 0 && recipe.tags.map((tag) => (
                        <span key={tag} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                      {recipe.total_minutes != null && recipe.total_minutes > 0 && (
                        <span>{formatDuration(recipe.total_minutes)}</span>
                      )}
                      {recipe.source_url && (
                        <span className="text-cb-muted truncate max-w-[120px]" title={recipe.source_url}>
                          &#128279; {(() => { try { return new URL(recipe.source_url).hostname; } catch { return 'link'; } })()}
                        </span>
                      )}
                      {recipe.is_favourite && (
                        <span className="text-cb-primary ml-auto">&#9829;</span>
                      )}
                    </div>
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
