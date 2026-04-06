'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, getCookbook, listCookbookRecipes, deleteCookbook, matchCookbookRecipe, createRecipe } from '@chefsbook/db';
import type { Cookbook, CookbookRecipe } from '@chefsbook/db';
import RecipeReviewPanel from '@/components/RecipeReviewPanel';

export default function CookbookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cookbook, setCookbook] = useState<Cookbook | null>(null);
  const [recipes, setRecipes] = useState<CookbookRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingToc, setFetchingToc] = useState(false);
  const [search, setSearch] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<Record<string, 'searching' | 'success' | 'failed'>>({});
  const [reviewRecipe, setReviewRecipe] = useState<any>(null);
  const [reviewCbRecipe, setReviewCbRecipe] = useState<CookbookRecipe | null>(null);
  const [reviewSourceUrl, setReviewSourceUrl] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);

  const handleImportRecipe = async (cbRecipe: CookbookRecipe) => {
    if (!cookbook) return;
    setImportingId(cbRecipe.id);
    setImportStatus((prev) => ({ ...prev, [cbRecipe.id]: 'searching' }));

    try {
      const res = await fetch('/api/cookbooks/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeName: cbRecipe.title,
          cookbookTitle: cookbook.title,
          author: cookbook.author,
          year: cookbook.year,
          description: cookbook.description,
        }),
      });
      const data = await res.json();

      if (!data.recipe) {
        setImportStatus((prev) => ({ ...prev, [cbRecipe.id]: 'failed' }));
        return;
      }

      // Prepare recipe for review (don't save yet)
      const cookbookTag = `Book: ${cookbook.title.split(':')[0]!.trim()}`;
      const tags = [cookbookTag, ...(data.recipe.tags ?? [])];
      if (!data.sourceUrl) tags.push('AI Adaptation');
      const bookRef = `From "${cookbook.title.split(':')[0]!.trim()}" by ${cookbook.author ?? 'unknown'}${cbRecipe.page_number ? `, page ${cbRecipe.page_number}` : ''}`;
      const desc = data.recipe.description
        ? `${data.recipe.description}\n\n${bookRef}`
        : bookRef;

      setReviewRecipe({ ...data.recipe, description: desc, tags });
      setReviewCbRecipe(cbRecipe);
      setReviewSourceUrl(data.sourceUrl ?? null);
      setImportStatus((prev) => ({ ...prev, [cbRecipe.id]: 'success' }));
    } catch {
      setImportStatus((prev) => ({ ...prev, [cbRecipe.id]: 'failed' }));
    } finally {
      setImportingId(null);
    }
  };

  const handleSaveReviewedRecipe = async (edited: any, imageUrl: string | null) => {
    if (!cookbook || !reviewCbRecipe) return;
    setReviewSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const saved = await createRecipe(user.id, {
        ...edited,
        image_url: imageUrl || cookbook.cover_url || undefined,
        source_type: reviewSourceUrl ? 'url' : 'ai',
        source_url: reviewSourceUrl ?? null,
        cookbook_id: cookbook.id,
        page_number: reviewCbRecipe.page_number ?? null,
      });

      await matchCookbookRecipe(reviewCbRecipe.id, saved.id);
      setRecipes((prev) => prev.map((r) => r.id === reviewCbRecipe.id ? { ...r, matched_recipe_id: saved.id } : r));
      setReviewRecipe(null);
      setReviewCbRecipe(null);
      router.push(`/recipe/${saved.id}`);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save recipe');
    } finally {
      setReviewSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      const cb = await getCookbook(id);
      setCookbook(cb);
      if (cb) {
        const recs = await listCookbookRecipes(id);
        setRecipes(recs);
        // Auto-fetch TOC if not done
        if (!cb.toc_fetched && recs.length === 0) {
          fetchToc();
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const fetchToc = async () => {
    setFetchingToc(true);
    try {
      const res = await fetch('/api/cookbooks/toc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookbookId: id }),
      });
      if (res.ok) {
        const recs = await listCookbookRecipes(id);
        setRecipes(recs);
        if (cookbook) setCookbook({ ...cookbook, toc_fetched: true, total_recipes: recs.length });
      }
    } finally {
      setFetchingToc(false);
    }
  };

  const filtered = search
    ? recipes.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : recipes;

  const chapters = [...new Set(filtered.map((r) => r.chapter).filter(Boolean))] as string[];

  if (loading) return <div className="p-8 text-cb-muted">Loading...</div>;
  if (!cookbook) return <div className="p-8"><p>Cookbook not found</p><Link href="/dashboard/cookbooks" className="text-cb-primary hover:underline text-sm">Back</Link></div>;

  // Show review panel when a recipe has been generated
  if (reviewRecipe && cookbook) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6">Review Recipe</h1>
        <RecipeReviewPanel
          recipe={reviewRecipe}
          imageUrl={cookbook.cover_url}
          defaultImages={cookbook.cover_url ? [cookbook.cover_url] : []}
          source="cookbook"
          cookbookAttribution={{
            title: cookbook.title.split(':')[0]!.trim(),
            author: cookbook.author,
            cookbookId: cookbook.id,
            pageNumber: reviewCbRecipe?.page_number,
            isAiAdaptation: !reviewSourceUrl,
          }}
          onSave={handleSaveReviewedRecipe}
          onRegenerate={() => { setReviewRecipe(null); if (reviewCbRecipe) handleImportRecipe(reviewCbRecipe); }}
          onBack={() => { setReviewRecipe(null); setReviewCbRecipe(null); }}
          saving={reviewSaving}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex gap-6 mb-8">
        {cookbook.cover_url ? (
          <img src={cookbook.cover_url} alt={cookbook.title} className="w-32 h-44 rounded-card object-cover shrink-0 shadow-md" />
        ) : (
          <div className="w-32 h-44 rounded-card bg-cb-bg border border-cb-border flex items-center justify-center shrink-0">
            <svg className="w-10 h-10 text-cb-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-1">{cookbook.title}</h1>
          {cookbook.author && <p className="text-cb-muted mb-1">by {cookbook.author}</p>}
          <div className="flex flex-wrap gap-2 text-xs text-cb-muted mb-2">
            {cookbook.publisher && <span>{cookbook.publisher}</span>}
            {cookbook.year && <span>{cookbook.year}</span>}
            {cookbook.isbn && <span>ISBN: {cookbook.isbn}</span>}
          </div>
          {cookbook.description && <p className="text-sm text-cb-muted line-clamp-3 mb-3">{cookbook.description}</p>}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{recipes.length} recipes</span>
            {cookbook.rating && <span className="text-amber-500">{'★'.repeat(cookbook.rating)}{'☆'.repeat(5 - cookbook.rating)}</span>}
            {!cookbook.toc_fetched && (
              <button onClick={fetchToc} disabled={fetchingToc} className="text-xs text-cb-primary hover:underline disabled:opacity-50">
                {fetchingToc ? 'Fetching contents...' : 'Fetch table of contents'}
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Link href="/dashboard/cookbooks" className="text-sm text-cb-muted hover:text-cb-text">Back</Link>
            <button onClick={async () => { if (confirm('Delete this cookbook?')) { await deleteCookbook(id); router.push('/dashboard/cookbooks'); } }} className="text-sm text-cb-primary hover:underline">Delete</button>
          </div>
        </div>
      </div>

      {/* Search */}
      {recipes.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes in this book..."
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary mb-6"
        />
      )}

      {/* Fetching indicator */}
      {fetchingToc && (
        <div className="text-center py-8 text-cb-muted">
          <p className="text-sm font-medium">AI is generating the table of contents...</p>
          <p className="text-xs mt-1">This may take a moment</p>
        </div>
      )}

      {/* Recipe list by chapter */}
      {chapters.length > 0 ? (
        chapters.map((chapter) => {
          const chapterRecipes = filtered.filter((r) => r.chapter === chapter);
          return (
            <div key={chapter} className="mb-8">
              <h2 className="text-sm font-bold text-cb-muted uppercase tracking-wide mb-3 pb-1 border-b border-cb-border">{chapter} <span className="font-normal">({chapterRecipes.length})</span></h2>
              <div className="space-y-1.5">
                {chapterRecipes.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-cb-card border border-cb-border rounded-input px-4 py-2.5 hover:border-cb-primary/50 transition-colors">
                    {r.matched_recipe_id ? (
                      <span className="w-5 h-5 rounded-full bg-cb-green/20 text-cb-green flex items-center justify-center shrink-0 text-xs">✓</span>
                    ) : r.ai_generated ? (
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 text-xs">✦</span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-cb-bg flex items-center justify-center shrink-0 text-xs text-cb-border">📖</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-[10px] text-cb-muted">
                        {r.page_number ? `Page ${r.page_number}` : ''}
                        {r.ai_generated ? ' · AI suggestion' : ''}
                        {r.matched_recipe_id ? ' · In your collection' : ''}
                      </p>
                    </div>
                    {r.matched_recipe_id ? (
                      <Link href={`/recipe/${r.matched_recipe_id}`} className="bg-cb-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:opacity-90 shrink-0">View</Link>
                    ) : importStatus[r.id] === 'searching' ? (
                      <span className="bg-cb-bg text-cb-muted text-xs font-medium px-4 py-1.5 rounded-full shrink-0 animate-pulse">Searching...</span>
                    ) : importStatus[r.id] === 'success' ? (
                      <Link href={`/recipe/${recipes.find((rx) => rx.id === r.id)?.matched_recipe_id ?? ''}`} className="bg-cb-green text-white text-xs font-semibold px-4 py-1.5 rounded-full shrink-0">✓ View</Link>
                    ) : importStatus[r.id] === 'failed' ? (
                      <div className="flex gap-2 shrink-0">
                        <Link href={`/dashboard/scan?q=${encodeURIComponent(cookbook.title + ' ' + r.title + ' recipe')}`} className="bg-cb-bg text-cb-muted text-[10px] font-medium px-3 py-1.5 rounded-full hover:text-cb-text">Manual</Link>
                        <button onClick={() => handleImportRecipe(r)} className="bg-cb-green/10 text-cb-green text-[10px] font-semibold px-3 py-1.5 rounded-full hover:bg-cb-green/20">Retry</button>
                      </div>
                    ) : (
                      <button onClick={() => handleImportRecipe(r)} className="bg-cb-green text-white text-xs font-semibold px-5 py-1.5 rounded-full hover:opacity-90 shrink-0">Import</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      ) : filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-cb-card border border-cb-border rounded-input px-4 py-2.5">
              <p className="text-sm font-medium flex-1">{r.title}</p>
              {r.page_number && <span className="text-xs text-cb-muted">p.{r.page_number}</span>}
            </div>
          ))}
        </div>
      ) : !fetchingToc ? (
        <div className="text-center py-12">
          <p className="text-cb-muted text-sm">No recipes cataloged yet.</p>
          <button onClick={fetchToc} disabled={fetchingToc} className="text-cb-primary text-sm mt-2 hover:underline">Generate table of contents with AI</button>
        </div>
      ) : null}
    </div>
  );
}
