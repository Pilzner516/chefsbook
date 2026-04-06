'use client';

import { useState, useEffect } from 'react';
import { abbreviateUnitMedium } from '@chefsbook/ui';

interface ReviewRecipe {
  title?: string;
  description?: string | null;
  servings?: number | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  cuisine?: string | null;
  course?: string | null;
  ingredients?: { quantity?: number | null; unit?: string | null; ingredient: string; preparation?: string | null }[];
  steps?: { step_number: number; instruction: string }[];
  notes?: string | null;
  [key: string]: any;
}

interface CookbookAttribution {
  title: string;
  author: string | null;
  cookbookId: string;
  pageNumber?: number | null;
  isAiAdaptation?: boolean;
}

export default function RecipeReviewPanel({
  recipe: initial,
  imageUrl: initialImage,
  defaultImages,
  source,
  cookbookAttribution,
  onSave,
  onRegenerate,
  onBack,
  saving,
}: {
  recipe: ReviewRecipe;
  imageUrl?: string | null;
  defaultImages?: string[];
  source: 'voice' | 'cookbook' | 'import';
  cookbookAttribution?: CookbookAttribution;
  onSave: (recipe: ReviewRecipe, imageUrl: string | null) => void;
  onRegenerate?: () => void;
  onBack: () => void;
  saving?: boolean;
}) {
  const [recipe, setRecipe] = useState<ReviewRecipe>(initial);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(initialImage ?? null);
  const [imageHistory, setImageHistory] = useState<string[]>(initialImage ? [initialImage] : (defaultImages ?? []));
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePage, setImagePage] = useState(1);

  useEffect(() => { setRecipe(initial); }, [initial]);
  useEffect(() => {
    if (initialImage) { setRecipeImageUrl(initialImage); setImageHistory((prev) => prev.includes(initialImage) ? prev : [...prev, initialImage]); }
  }, [initialImage]);

  const isCookbookCover = source === 'cookbook' && recipeImageUrl != null && (defaultImages ?? []).includes(recipeImageUrl);

  const fetchImage = async (page: number) => {
    setImageLoading(true);
    try {
      const res = await fetch('/api/speak/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: recipe.title, cuisine: recipe.cuisine, page }),
      });
      const data = await res.json();
      if (data.url) {
        setRecipeImageUrl(data.url);
        setImageHistory((prev) => [...prev, data.url]);
      }
    } catch {} finally { setImageLoading(false); }
  };

  return (
    <div>
      {/* Image section */}
      <div className="mb-4">
        {imageLoading ? (
          <div className="w-full h-48 bg-cb-bg rounded-card flex items-center justify-center animate-pulse">
            <span className="text-sm text-cb-muted">Finding image...</span>
          </div>
        ) : recipeImageUrl ? (
          <div>
            <div className={`w-full rounded-card mb-2 overflow-hidden ${isCookbookCover ? 'bg-cb-bg flex items-center justify-center' : ''}`} style={{ maxHeight: 300 }}>
              <img src={recipeImageUrl} alt={recipe.title ?? ''} className={`w-full ${isCookbookCover ? 'h-[300px] object-contain' : 'h-56 object-cover'}`} />
            </div>
            <div className="flex items-center gap-2">
              {imageHistory.map((url, idx) => (
                <button key={idx} onClick={() => setRecipeImageUrl(url)} className={`w-14 h-10 rounded overflow-hidden border-2 shrink-0 ${recipeImageUrl === url ? 'border-cb-primary' : 'border-cb-border opacity-60 hover:opacity-100'}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {imageHistory.length < 3 && (
                <button onClick={() => { const next = imagePage + 1; setImagePage(next); fetchImage(next); }} className="h-10 px-3 rounded border-2 border-dashed border-cb-border flex items-center justify-center gap-1.5 shrink-0 hover:border-cb-primary hover:bg-cb-primary/5 transition-colors">
                  <svg className="w-3.5 h-3.5 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
                  <span className="text-[10px] font-medium text-cb-primary">Generate image</span>
                </button>
              )}
              <span className="flex-1" />
              <label className="text-xs text-cb-primary hover:underline cursor-pointer">
                Upload photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setRecipeImageUrl(url); setImageHistory((prev) => [...prev, url]); } }} />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => fetchImage(1)} className="flex-1 h-36 bg-cb-bg rounded-card border-2 border-dashed border-cb-border flex flex-col items-center justify-center hover:border-cb-primary transition-colors">
              <svg className="w-6 h-6 text-cb-muted mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
              <span className="text-xs text-cb-muted">Generate image</span>
            </button>
            <label className="flex-1 h-36 bg-cb-bg rounded-card border-2 border-dashed border-cb-border flex flex-col items-center justify-center hover:border-cb-primary transition-colors cursor-pointer">
              <svg className="w-6 h-6 text-cb-muted mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M2.25 18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V6a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6v12Z" /></svg>
              <span className="text-xs text-cb-muted">Upload photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const url = URL.createObjectURL(f); setRecipeImageUrl(url); setImageHistory([url]); } }} />
            </label>
          </div>
        )}
      </div>

      {/* Cookbook attribution */}
      {cookbookAttribution && (
        <div className="bg-cb-bg border border-cb-border rounded-card p-3 mb-4 flex items-center gap-3">
          <span className="text-lg">📚</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Book: {cookbookAttribution.title}</p>
            {cookbookAttribution.author && <p className="text-[10px] text-cb-muted">by {cookbookAttribution.author}</p>}
            {cookbookAttribution.pageNumber && <p className="text-[10px] text-cb-muted">Page {cookbookAttribution.pageNumber}</p>}
            {cookbookAttribution.isAiAdaptation && <p className="text-[10px] text-amber-600">AI adaptation</p>}
          </div>
        </div>
      )}

      {/* Recipe card */}
      <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-6">
        <input value={recipe.title ?? ''} onChange={(e) => setRecipe({ ...recipe, title: e.target.value })} className="text-2xl font-bold w-full bg-transparent outline-none mb-2 placeholder:text-cb-muted" placeholder="Recipe title" />
        <textarea value={recipe.description ?? ''} onChange={(e) => setRecipe({ ...recipe, description: e.target.value })} rows={2} className="w-full bg-transparent outline-none text-cb-muted text-sm leading-relaxed mb-4 resize-none" placeholder="Description" />

        <div className="flex flex-wrap gap-3 mb-6 text-sm">
          <label className="flex items-center gap-1.5"><span className="text-cb-muted">Prep:</span><input type="number" value={recipe.prep_minutes ?? ''} onChange={(e) => setRecipe({ ...recipe, prep_minutes: parseInt(e.target.value) || null })} className="w-14 bg-cb-bg border border-cb-border rounded px-2 py-1 text-sm outline-none" /><span className="text-cb-muted text-xs">min</span></label>
          <label className="flex items-center gap-1.5"><span className="text-cb-muted">Cook:</span><input type="number" value={recipe.cook_minutes ?? ''} onChange={(e) => setRecipe({ ...recipe, cook_minutes: parseInt(e.target.value) || null })} className="w-14 bg-cb-bg border border-cb-border rounded px-2 py-1 text-sm outline-none" /><span className="text-cb-muted text-xs">min</span></label>
          <label className="flex items-center gap-1.5"><span className="text-cb-muted">Servings:</span><input type="number" value={recipe.servings ?? ''} onChange={(e) => setRecipe({ ...recipe, servings: parseInt(e.target.value) || null })} className="w-14 bg-cb-bg border border-cb-border rounded px-2 py-1 text-sm outline-none" /></label>
          <label className="flex items-center gap-1.5"><span className="text-cb-muted">Cuisine:</span><input value={recipe.cuisine ?? ''} onChange={(e) => setRecipe({ ...recipe, cuisine: e.target.value })} className="w-24 bg-cb-bg border border-cb-border rounded px-2 py-1 text-sm outline-none" /></label>
        </div>

        <h3 className="text-sm font-bold text-cb-muted uppercase tracking-wide mb-2">Ingredients</h3>
        <div className="space-y-1 mb-6">
          {(recipe.ingredients ?? []).map((ing, i) => (
            <div key={i} className="grid items-start gap-1 text-sm" style={{ gridTemplateColumns: '40px 80px 1fr 24px' }}>
              <span className="text-cb-primary font-semibold text-right tabular-nums">{ing.quantity ?? ''}</span>
              <span className="text-cb-muted">{ing.unit ? abbreviateUnitMedium(ing.unit) : ''}</span>
              <span className="break-words">{ing.ingredient}</span>
              <button onClick={() => setRecipe({ ...recipe, ingredients: recipe.ingredients?.filter((_, j) => j !== i) })} className="text-cb-muted hover:text-cb-primary text-xs text-center">✕</button>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-bold text-cb-muted uppercase tracking-wide mb-2">Steps</h3>
        <ol className="space-y-3 mb-4">
          {(recipe.steps ?? []).map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-cb-primary/20 text-cb-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
              <p className="flex-1 leading-relaxed">{step.instruction}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Bottom controls */}
      <div className="flex gap-3">
        <button onClick={onBack} className="border border-cb-border px-5 py-3 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text">&larr; Back</button>
        {onRegenerate && <button onClick={onRegenerate} className="border border-cb-border px-5 py-3 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text">Regenerate</button>}
        <span className="flex-1" />
        <button onClick={() => onSave(recipe, recipeImageUrl)} disabled={saving} className="bg-cb-green text-white px-8 py-3 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Recipe'}
        </button>
      </div>
    </div>
  );
}
