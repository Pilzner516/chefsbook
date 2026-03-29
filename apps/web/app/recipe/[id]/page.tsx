'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, getRecipe, deleteRecipe, updateRecipe } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity, scaleQuantity } from '@chefsbook/ui';

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [editingCuisine, setEditingCuisine] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
      const { data: { user } } = await supabase.auth.getUser();
      if (user && data && user.id === data.user_id) setIsOwner(true);
      setLoading(false);
    })();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRecipe(id);
      router.push('/dashboard');
    } catch (e: any) {
      alert(e.message);
      setDeleting(false);
    }
  };

  const handleRefresh = async () => {
    if (!recipe?.source_url) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: recipe.source_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-import failed');

      // Only update AI-derived fields — preserve user edits (tags, notes, title, custom images)
      await updateRecipe(id, {
        description: data.recipe.description,
        servings: data.recipe.servings ?? recipe.servings,
        prep_minutes: data.recipe.prep_minutes,
        cook_minutes: data.recipe.cook_minutes,
        cuisine: recipe.cuisine || data.recipe.cuisine,
        course: recipe.course || data.recipe.course,
        image_url: recipe.image_url || data.imageUrl || null,
      });

      // Refresh page data
      const updated = await getRecipe(id);
      if (updated) {
        setRecipe(updated);
        setServings(updated.servings);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const COURSES = ['breakfast', 'brunch', 'lunch', 'dinner', 'starter', 'main', 'side', 'dessert', 'snack', 'drink', 'bread', 'other'] as const;

  const saveCourse = async (course: string | null) => {
    if (!recipe) return;
    await updateRecipe(id, { course: course as any });
    setRecipe({ ...recipe, course: course as any });
    setEditingCourse(false);
  };

  const saveCuisine = async (cuisine: string | null) => {
    if (!recipe) return;
    await updateRecipe(id, { cuisine });
    setRecipe({ ...recipe, cuisine });
    setEditingCuisine(false);
  };

  const addTag = async () => {
    if (!recipe || !newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    if (recipe.tags.includes(tag)) { setNewTag(''); return; }
    const tags = [...recipe.tags, tag];
    await updateRecipe(id, { tags });
    setRecipe({ ...recipe, tags });
    setNewTag('');
  };

  const removeTag = async (tag: string) => {
    if (!recipe) return;
    const tags = recipe.tags.filter((t) => t !== tag);
    await updateRecipe(id, { tags });
    setRecipe({ ...recipe, tags });
  };

  const handleImageUpload = async (file: File) => {
    if (!recipe) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${id}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('recipe-images')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('recipe-images')
        .getPublicUrl(path);

      await updateRecipe(id, { image_url: publicUrl });
      setRecipe({ ...recipe, image_url: publicUrl });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
        </nav>
        <div className="text-center text-cb-muted py-20">Loading recipe...</div>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="min-h-screen bg-cb-bg">
        <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link href="/" className="text-xl font-bold">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
        </nav>
        <div className="text-center py-20">
          <h2 className="text-lg font-semibold mb-2">Recipe not found</h2>
          <Link href="/dashboard" className="text-cb-primary text-sm font-medium hover:underline">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const originalServings = recipe.servings;

  return (
    <main className="min-h-screen bg-cb-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-cb-muted hover:text-cb-text text-sm font-medium">
            Dashboard
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {copied ? 'Copied!' : 'Share'}
          </button>
          {isOwner && recipe?.source_url && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              {refreshing ? 'Updating...' : 'Re-import'}
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 border border-red-200 text-cb-primary px-4 py-2 rounded-input text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </nav>

      {/* Hero image */}
      <div className="max-w-4xl mx-auto px-6">
        {recipe.image_url ? (
          <div className="h-72 rounded-card overflow-hidden bg-cb-card relative group">
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
            {isOwner && (
              <label className="absolute bottom-3 right-3 bg-black/60 text-white px-3 py-1.5 rounded-input text-xs font-medium cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
                {uploading ? 'Uploading...' : 'Change image'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }} />
              </label>
            )}
          </div>
        ) : isOwner ? (
          <label className="h-48 rounded-card border-2 border-dashed border-cb-border bg-cb-card flex flex-col items-center justify-center cursor-pointer hover:border-cb-primary transition-colors">
            <svg className="w-10 h-10 text-cb-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            <span className="text-cb-muted text-sm">{uploading ? 'Uploading...' : 'Add a photo'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }} />
          </label>
        ) : null}
      </div>

      <article className="max-w-4xl mx-auto py-10 px-6">
        {/* Title & meta */}
        <h1 className="text-3xl font-bold mb-4">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-cb-muted text-lg mb-6 leading-relaxed">{recipe.description}</p>
        )}

        <div className="flex flex-wrap gap-3 mb-4 items-center">
          {/* Cuisine */}
          {editingCuisine ? (
            <form
              onSubmit={(e) => { e.preventDefault(); saveCuisine((e.currentTarget.elements.namedItem('cuisine') as HTMLInputElement).value || null); }}
              className="flex items-center gap-1"
            >
              <input
                name="cuisine"
                defaultValue={recipe.cuisine ?? ''}
                autoFocus
                placeholder="Cuisine"
                className="bg-cb-bg border border-cb-primary rounded-input px-2 py-1 text-sm w-28 outline-none"
                onBlur={(e) => saveCuisine(e.target.value || null)}
              />
            </form>
          ) : recipe.cuisine ? (
            <button
              onClick={() => isOwner && setEditingCuisine(true)}
              className={`bg-cb-primary/10 text-cb-primary text-sm px-3 py-1 rounded-input font-medium ${isOwner ? 'cursor-pointer hover:ring-2 hover:ring-cb-primary/30' : ''}`}
              title={isOwner ? 'Click to edit cuisine' : undefined}
            >
              {recipe.cuisine}
            </button>
          ) : isOwner ? (
            <button
              onClick={() => setEditingCuisine(true)}
              className="text-sm px-3 py-1 rounded-input font-medium border border-dashed border-cb-border text-cb-muted hover:border-cb-primary hover:text-cb-primary"
            >
              + Cuisine
            </button>
          ) : null}

          {/* Course */}
          {editingCourse ? (
            <div className="relative">
              <select
                autoFocus
                value={recipe.course ?? ''}
                onChange={(e) => saveCourse(e.target.value || null)}
                onBlur={() => setEditingCourse(false)}
                className="bg-cb-bg border border-cb-green rounded-input px-2 py-1 text-sm outline-none appearance-none pr-6"
              >
                <option value="">None</option>
                {COURSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          ) : recipe.course ? (
            <button
              onClick={() => isOwner && setEditingCourse(true)}
              className={`bg-cb-green/10 text-cb-green text-sm px-3 py-1 rounded-input font-medium ${isOwner ? 'cursor-pointer hover:ring-2 hover:ring-cb-green/30' : ''}`}
              title={isOwner ? 'Click to edit course' : undefined}
            >
              {recipe.course}
            </button>
          ) : isOwner ? (
            <button
              onClick={() => setEditingCourse(true)}
              className="text-sm px-3 py-1 rounded-input font-medium border border-dashed border-cb-border text-cb-muted hover:border-cb-green hover:text-cb-green"
            >
              + Course
            </button>
          ) : null}

          {/* Duration */}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && (
            <span className="bg-cb-card text-cb-muted text-sm px-3 py-1 rounded-input border border-cb-border">
              {formatDuration(recipe.total_minutes)}
            </span>
          )}

          {/* Tags */}
          {recipe.tags && recipe.tags.map((tag) => (
            <span key={tag} className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-input font-medium inline-flex items-center gap-1.5">
              {tag}
              {isOwner && (
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-600"
                  title="Remove tag"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}

          {/* Add tag */}
          {isOwner && (
            editingTags ? (
              <form
                onSubmit={(e) => { e.preventDefault(); addTag(); }}
                className="flex items-center gap-1"
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  autoFocus
                  placeholder="New tag"
                  className="bg-cb-bg border border-blue-400 rounded-input px-2 py-1 text-sm w-24 outline-none"
                  onBlur={() => { if (!newTag.trim()) setEditingTags(false); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setNewTag(''); setEditingTags(false); } }}
                />
                <button type="submit" className="text-blue-600 text-sm font-medium hover:underline">Add</button>
              </form>
            ) : (
              <button
                onClick={() => setEditingTags(true)}
                className="text-sm px-3 py-1 rounded-input font-medium border border-dashed border-cb-border text-cb-muted hover:border-blue-400 hover:text-blue-600"
              >
                + Tag
              </button>
            )
          )}
        </div>

        {recipe.source_url && (
          <div className="mb-8">
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-cb-primary hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View original
            </a>
          </div>
        )}

        {/* Servings scaler */}
        <div className="bg-cb-card border border-cb-border rounded-card p-4 mb-10 inline-flex items-center gap-4">
          <span className="text-sm font-medium text-cb-muted">Servings</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center text-cb-muted hover:border-cb-primary hover:text-cb-primary transition-colors"
            >
              -
            </button>
            <span className="w-8 text-center font-semibold">{servings}</span>
            <button
              onClick={() => setServings((s) => s + 1)}
              className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center text-cb-muted hover:border-cb-primary hover:text-cb-primary transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Ingredients */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">
            Ingredients
          </h2>
          {(() => {
            const groups: { label: string | null; items: typeof recipe.ingredients }[] = [];
            for (const ing of recipe.ingredients) {
              const label = ing.group_label ?? null;
              const last = groups[groups.length - 1];
              if (last && last.label === label) {
                last.items.push(ing);
              } else {
                groups.push({ label, items: [ing] });
              }
            }
            return groups.map((group, gi) => (
              <div key={gi} className={gi > 0 ? 'mt-6' : ''}>
                {group.label && (
                  <h3 className="text-sm font-semibold text-cb-muted uppercase tracking-wide mb-3">
                    {group.label}
                  </h3>
                )}
                <table className="w-full">
                  <tbody>
                    {group.items.map((ing) => (
                      <tr key={ing.id} className="border-b border-cb-border/50 last:border-b-0">
                        <td className="py-2 pr-3 text-right align-top w-16 text-cb-primary font-semibold tabular-nums whitespace-nowrap">
                          {formatQuantity(scaleQuantity(ing.quantity, originalServings, servings))}
                        </td>
                        <td className="py-2 pr-3 align-top w-20 text-cb-muted text-sm whitespace-nowrap">
                          {ing.unit ?? ''}
                        </td>
                        <td className="py-2 align-top">
                          {ing.ingredient}
                          {ing.preparation && (
                            <span className="text-cb-muted">, {ing.preparation}</span>
                          )}
                          {ing.optional && (
                            <span className="text-cb-muted text-xs ml-1">(optional)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ));
          })()}
        </section>

        {/* Steps */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Steps</h2>
          <ol className="space-y-6">
            {recipe.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <p className="leading-relaxed">{step.instruction}</p>
                  {step.timer_minutes != null && step.timer_minutes > 0 && (
                    <p className="text-cb-primary text-sm mt-1 font-medium">
                      &#9201; {formatDuration(step.timer_minutes)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Notes */}
        {recipe.notes && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Notes</h2>
            <p className="text-cb-muted leading-relaxed">{recipe.notes}</p>
          </section>
        )}

        {/* CTA for non-logged-in users */}
        <div className="bg-cb-card border border-cb-border rounded-card p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Like this recipe?</h3>
          <p className="text-cb-muted text-sm mb-4">
            Save it to your Chefsbook and never lose a recipe again.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add to my Chefsbook
          </Link>
        </div>
      </article>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Delete recipe?</h2>
            <p className="text-cb-muted text-sm mb-6">
              This will permanently delete &ldquo;{recipe.title}&rdquo;. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
