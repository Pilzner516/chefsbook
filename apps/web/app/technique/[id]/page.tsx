'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, getTechnique, deleteTechnique, getRecipe } from '@chefsbook/db';
import type { Technique, TechniqueStep, Recipe } from '@chefsbook/db';
import { proxyIfNeeded } from '@/lib/recipeImage';
import { useConfirmDialog, useAlertDialog } from '@/components/useConfirmDialog';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-amber-100 text-amber-700',
  advanced: 'bg-red-100 text-red-700',
};

export default function TechniquePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [technique, setTechnique] = useState<Technique | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [relatedRecipes, setRelatedRecipes] = useState<Recipe[]>([]);
  const [showReimportMenu, setShowReimportMenu] = useState(false);
  const [converting, setConverting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [convertConfirm, ConvertDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();
  const reimportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const data = await getTechnique(id);
      setTechnique(data);
      const { data: { user } } = await supabase.auth.getUser();
      if (user && data && user.id === data.user_id) setIsOwner(true);
      // Load related recipes
      if (data?.related_recipe_ids?.length) {
        const recipes = await Promise.all(
          data.related_recipe_ids.slice(0, 6).map((rid) => getRecipe(rid)),
        );
        setRelatedRecipes(recipes.filter(Boolean) as Recipe[]);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTechnique(id);
      router.push('/dashboard');
    } catch (e: any) {
      showAlert({ title: 'Delete failed', body: e?.message ?? 'Please try again.' });
      setDeleting(false);
    }
  };

  const handleRefresh = async () => {
    if (!technique?.source_url) return;
    setRefreshing(true);
    setShowReimportMenu(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: technique.source_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-import failed');
      if (data.needsBrowserExtraction) {
        throw new Error(data.message || 'This site blocks server imports. Install the ChefsBook browser extension and try again.');
      }
      showAlert({ title: 'Re-import started', body: 'The technique is being refreshed from the source.' });
    } catch (e: any) {
      showAlert({ title: 'Re-import failed', body: e?.message ?? 'Please try again.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleConvertToRecipe = async () => {
    const confirmed = await convertConfirm({
      title: 'Move to My Recipes?',
      body: 'This will convert this technique into a recipe. Your title, description, steps, notes, tags, and photos will carry over. Tools & Equipment will become Ingredients. The original technique will be deleted. This cannot be undone.',
      confirmLabel: 'Yes, move it',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setConverting(true);
    setShowReimportMenu(false);
    try {
      const res = await fetch('/api/convert/technique-to-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techniqueId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      router.push(`/recipe/${data.recipeId}`);
    } catch (e: any) {
      showAlert({ title: 'Conversion failed', body: e?.message ?? 'Please try again.' });
      setConverting(false);
    }
  };

  // Close reimport menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (reimportMenuRef.current && !reimportMenuRef.current.contains(e.target as Node)) {
        setShowReimportMenu(false);
      }
    };
    if (showReimportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReimportMenu]);

  if (loading) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold"><span className="text-cb-primary">Chefs</span>book</Link>
        </nav>
        <div className="text-center text-cb-secondary py-20">Loading technique...</div>
      </main>
    );
  }

  if (!technique) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold"><span className="text-cb-primary">Chefs</span>book</Link>
        </nav>
        <div className="text-center py-20">
          <h2 className="text-lg font-semibold mb-2">Technique not found</h2>
          <Link href="/dashboard" className="text-cb-primary text-sm font-medium hover:underline">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  const steps = (technique.process_steps ?? []) as TechniqueStep[];

  return (
    <main className="min-h-screen bg-cb-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold"><span className="text-cb-primary">Chefs</span>book</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-cb-secondary hover:text-cb-text text-sm font-medium">Dashboard</Link>
          {isOwner && (
            <div className="relative" ref={reimportMenuRef}>
              <button
                onClick={() => setShowReimportMenu(!showReimportMenu)}
                disabled={refreshing || converting}
                className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${refreshing || converting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                </svg>
                {refreshing ? 'Updating...' : converting ? 'Converting...' : 'Re-import'}
                <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showReimportMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-cb-border rounded-input shadow-lg z-20">
                  {technique?.source_url && (
                    <button
                      onClick={handleRefresh}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-cb-bg flex items-center gap-2"
                    >
                      <span>🔄</span> Re-import from source
                    </button>
                  )}
                  <button
                    onClick={handleConvertToRecipe}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-cb-bg flex items-center gap-2 ${technique?.source_url ? 'border-t border-cb-border' : ''}`}
                  >
                    <span>🍳</span> Move to My Recipes
                  </button>
                </div>
              )}
            </div>
          )}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 border border-red-200 text-cb-primary px-4 py-2 rounded-input text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </nav>

      {/* Hero: YouTube embed or image */}
      {technique.youtube_video_id ? (
        <div className="max-w-4xl mx-auto px-6">
          <div className="aspect-video rounded-card overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${technique.youtube_video_id}?enablejsapi=1&autoplay=0&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : technique.image_url ? (
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-64 rounded-card overflow-hidden bg-cb-card">
            <img src={proxyIfNeeded(technique.image_url!)} alt={technique.title} className="w-full h-full object-cover" />
          </div>
        </div>
      ) : null}

      <article className="max-w-4xl mx-auto py-10 px-6">
        <ConvertDialog />
        <AlertDialog />
        {/* Header: title + difficulty */}
        <div className="flex items-start gap-3 mb-4">
          <h1 className="text-3xl font-bold flex-1">{technique.title}</h1>
          {technique.difficulty && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 mt-1 ${DIFFICULTY_COLORS[technique.difficulty] ?? 'bg-gray-100 text-gray-700'}`}>
              {technique.difficulty.charAt(0).toUpperCase() + technique.difficulty.slice(1)}
            </span>
          )}
        </div>

        {technique.description && (
          <p className="text-cb-secondary text-lg mb-6 leading-relaxed">{technique.description}</p>
        )}

        {/* Source links */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          {technique.source_url && (
            <a
              href={technique.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cb-primary hover:underline"
            >
              {technique.youtube_video_id ? (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
                  </svg>
                  Watch on YouTube
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  View original source
                </>
              )}
            </a>
          )}
          <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Technique</span>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: tools, tips, mistakes */}
          <div className="space-y-6">
            {/* Tools & Equipment */}
            {technique.tools_and_equipment.length > 0 && (
              <section className="bg-cb-card border border-cb-border rounded-card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-cb-secondary mb-3">Tools & Equipment</h3>
                <ul className="space-y-2">
                  {technique.tools_and_equipment.map((tool, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-cb-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
                      </svg>
                      {tool}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Key Tips */}
            {technique.tips.length > 0 && (
              <section className="bg-cb-card border border-cb-border rounded-card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-cb-secondary mb-3">Key Tips</h3>
                <div className="space-y-2">
                  {technique.tips.map((tip, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded-input p-3 text-sm text-green-800">
                      {tip}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Common Mistakes */}
            {technique.common_mistakes.length > 0 && (
              <section className="bg-cb-card border border-cb-border rounded-card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-cb-secondary mb-3">Common Mistakes</h3>
                <div className="space-y-2">
                  {technique.common_mistakes.map((mistake, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-input p-3 text-sm text-amber-800 flex gap-2">
                      <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                      <span>{mistake}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column: step-by-step process */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Step-by-Step Process</h2>
            <ol className="space-y-6">
              {steps.map((step) => (
                <li key={step.step_number} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                    {step.step_number}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="leading-relaxed">{step.instruction}</p>
                    {step.tip && (
                      <div className="bg-green-50 border border-green-200 rounded-input p-3 text-sm text-green-800 flex gap-2">
                        <span className="font-semibold shrink-0">Tip:</span>
                        <span>{step.tip}</span>
                      </div>
                    )}
                    {step.common_mistake && (
                      <div className="bg-amber-50 border border-amber-200 rounded-input p-3 text-sm text-amber-800 flex gap-2">
                        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                        <span>{step.common_mistake}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Related Recipes */}
        {relatedRecipes.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Recipes that use this technique</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedRecipes.map((r) => (
                <Link key={r.id} href={`/recipe/${r.id}`} className="group">
                  <div className="bg-cb-card border border-cb-border rounded-card overflow-hidden hover:border-cb-primary/50 transition-colors">
                    {r.image_url && (
                      <div className="h-28 overflow-hidden">
                        <img src={proxyIfNeeded(r.image_url!)} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="text-sm font-semibold group-hover:text-cb-primary transition-colors">{r.title}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Delete technique?</h2>
            <p className="text-cb-secondary text-sm mb-6">
              This will permanently delete &ldquo;{technique.title}&rdquo;. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
