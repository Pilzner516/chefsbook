'use client';
// TODO(web): add version picker UI on recipe detail
// TODO(web): auto-tag should support multi-select

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SocialShareModal from '@/components/SocialShareModal';
import LikeButton from '@/components/LikeButton';
import RecipeComments from '@/components/RecipeComments';
import { proxyIfNeeded, CHEFS_HAT_URL } from '@/lib/recipeImage';
import { supabase, getRecipe, deleteRecipe, updateRecipe, replaceIngredients, replaceSteps, toggleFavourite, listCookingNotes, addCookingNote, deleteCookingNote, listShoppingLists, createShoppingList, listRecipePhotos, addRecipePhoto, deleteRecipePhoto, setPhotoPrimary, isPro, getCookbook, getRecipeTranslation, saveRecipeTranslation } from '@chefsbook/db';
import type { Cookbook, RecipeTranslation } from '@chefsbook/db';
import { translateRecipe } from '@chefsbook/ai';
import type { TranslatedRecipe } from '@chefsbook/ai';
import { addIngredientsToList } from '@/lib/addToShoppingList';
import type { RecipeWithDetails, RecipeIngredient, RecipeStep, ShoppingList, RecipeUserPhoto } from '@chefsbook/db';
import type { CookingNote } from '@chefsbook/db';
import { formatDuration, formatQuantity, scaleQuantity, cleanIngredientName } from '@chefsbook/ui';

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refUsername = searchParams.get('ref');
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingIngredients, setEditingIngredients] = useState(false);
  const [editingSteps, setEditingSteps] = useState(false);
  const [draftIngredients, setDraftIngredients] = useState<{ quantity: string; unit: string; ingredient: string; preparation: string; group_label: string }[]>([]);
  const [draftSteps, setDraftSteps] = useState<{ instruction: string }[]>([]);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [addConfirm, setAddConfirm] = useState<{ count: number; listName: string; listId: string } | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  useEffect(() => { if (addConfirm) { const t = setTimeout(() => setAddConfirm(null), 4000); return () => clearTimeout(t); } }, [addConfirm]);
  const [saving, setSaving] = useState(false);
  const [cookingNotes, setCookingNotes] = useState<CookingNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [userPhotos, setUserPhotos] = useState<RecipeUserPhoto[]>([]);
  const [userIsPro, setUserIsPro] = useState(false);
  const [cookbook, setCookbook] = useState<Cookbook | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [userLanguage, setUserLanguage] = useState('en');
  const [translation, setTranslation] = useState<RecipeTranslation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);

  const seekYouTube = useCallback((seconds: number) => {
    ytIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
      '*',
    );
  }, []);

  useEffect(() => {
    (async () => {
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
      // Load cookbook if linked
      if (data?.cookbook_id) getCookbook(data.cookbook_id).then(setCookbook);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        isPro(user.id).then(setUserIsPro);
        // Fetch user language preference
        supabase.from('user_profiles').select('preferred_language').eq('id', user.id).maybeSingle()
          .then(({ data: profile }) => { if (profile?.preferred_language) setUserLanguage(profile.preferred_language); });
        if (data && user.id === data.user_id) {
          setIsOwner(true);
          listCookingNotes(id).then(setCookingNotes);
          listRecipePhotos(id).then(setUserPhotos);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  // Translation: check cache or translate in background
  useEffect(() => {
    if (!recipe || userLanguage === 'en') { setTranslation(null); return; }
    let cancelled = false;
    (async () => {
      const cached = await getRecipeTranslation(recipe.id, userLanguage);
      if (cancelled) return;
      if (cached) { setTranslation(cached); return; }
      setTranslating(true);
      try {
        const result = await translateRecipe(
          {
            title: recipe.title,
            description: recipe.description,
            ingredients: (recipe.ingredients ?? []).map((i) => ({ quantity: i.quantity, unit: i.unit, ingredient: i.ingredient, preparation: i.preparation })),
            steps: (recipe.steps ?? []).map((s) => ({ instruction: s.instruction })),
            notes: recipe.notes,
          },
          userLanguage,
        );
        if (cancelled) return;
        await saveRecipeTranslation(recipe.id, userLanguage, { title: result.title, description: result.description, ingredients: result.ingredients, steps: result.steps, notes: result.notes });
        const saved = await getRecipeTranslation(recipe.id, userLanguage);
        if (!cancelled) setTranslation(saved);
      } catch (err) { console.warn('[RecipePage] Translation failed:', err); }
      finally { if (!cancelled) setTranslating(false); }
    })();
    return () => { cancelled = true; };
  }, [recipe?.id, userLanguage]);

  // Translated display values
  const displayTitle = translation?.translated_title ?? recipe?.title ?? '';
  const displayDescription = translation?.translated_description ?? recipe?.description ?? null;
  const displayNotes = translation?.translated_notes ?? recipe?.notes ?? null;
  const getDisplayIngredientName = (ing: RecipeIngredient, i: number) => {
    const tr = (translation?.translated_ingredients as any[])?.[i];
    return tr?.name ?? ing.ingredient;
  };
  const getDisplayStepInstruction = (step: RecipeStep, i: number) => {
    const tr = (translation?.translated_steps as any[])?.[i];
    return tr?.instruction ?? step.instruction;
  };

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: recipe.source_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-import failed');

      // Update AI-derived fields — preserve user edits (tags, notes, title, custom images)
      await updateRecipe(id, {
        description: data.recipe.description,
        servings: data.recipe.servings ?? recipe.servings,
        prep_minutes: data.recipe.prep_minutes,
        cook_minutes: data.recipe.cook_minutes,
        cuisine: recipe.cuisine || data.recipe.cuisine,
        course: recipe.course || data.recipe.course,
        image_url: recipe.image_url || data.imageUrl || null,
      });

      // Replace ingredients and steps with fresh extracted data
      if (data.recipe.ingredients?.length) {
        await replaceIngredients(id, user.id, data.recipe.ingredients.map((ing: any) => ({
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          ingredient: ing.ingredient,
          preparation: ing.preparation ?? null,
          optional: ing.optional ?? false,
          group_label: ing.group_label ?? null,
        })));
      }
      if (data.recipe.steps?.length) {
        await replaceSteps(id, user.id, data.recipe.steps.map((step: any) => ({
          step_number: step.step_number,
          instruction: step.instruction,
          timer_minutes: step.timer_minutes ?? null,
          group_label: step.group_label ?? null,
        })));
      }

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

  const saveTitle = async (title: string) => {
    if (!recipe || !title.trim()) return;
    await updateRecipe(id, { title: title.trim() });
    setRecipe({ ...recipe, title: title.trim() });
    setEditingTitle(false);
  };

  const saveDescription = async (desc: string) => {
    if (!recipe) return;
    const val = desc.trim() || null;
    await updateRecipe(id, { description: val });
    setRecipe({ ...recipe, description: val });
    setEditingDesc(false);
  };

  const saveNotes = async (notes: string) => {
    if (!recipe) return;
    const val = notes.trim() || null;
    await updateRecipe(id, { notes: val });
    setRecipe({ ...recipe, notes: val });
    setEditingNotes(false);
  };

  const startEditIngredients = () => {
    if (!recipe) return;
    setDraftIngredients(recipe.ingredients.map((ing) => ({
      quantity: ing.quantity != null ? String(ing.quantity) : '',
      unit: ing.unit ?? '',
      ingredient: ing.ingredient,
      preparation: ing.preparation ?? '',
      group_label: ing.group_label ?? '',
    })));
    setEditingIngredients(true);
  };

  const updateDraftIng = (idx: number, field: string, value: string) => {
    setDraftIngredients((prev) => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const addDraftIng = () => {
    setDraftIngredients((prev) => [...prev, { quantity: '', unit: '', ingredient: '', preparation: '', group_label: '' }]);
  };

  const removeDraftIng = (idx: number) => {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveIngredients = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const parsed = draftIngredients
        .filter((row) => row.ingredient.trim())
        .map((row) => ({
          quantity: row.quantity ? parseFloat(row.quantity) || null : null,
          unit: row.unit.trim() || null,
          ingredient: row.ingredient.trim(),
          preparation: row.preparation.trim() || null,
          optional: false,
          group_label: row.group_label.trim() || null,
        }));
      const saved = await replaceIngredients(recipe.id, user.id, parsed);
      setRecipe({ ...recipe, ingredients: saved });
      setEditingIngredients(false);
    } finally {
      setSaving(false);
    }
  };

  const startEditSteps = () => {
    if (!recipe) return;
    setDraftSteps(recipe.steps.map((s) => ({ instruction: s.instruction })));
    setEditingSteps(true);
  };

  const updateDraftStep = (idx: number, value: string) => {
    setDraftSteps((prev) => prev.map((row, i) => i === idx ? { instruction: value } : row));
  };

  const addDraftStep = () => {
    setDraftSteps((prev) => [...prev, { instruction: '' }]);
  };

  const removeDraftStep = (idx: number) => {
    setDraftSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveSteps = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const parsed = draftSteps
        .filter((row) => row.instruction.trim())
        .map((row, i) => ({
          step_number: i + 1,
          instruction: row.instruction.trim(),
          timer_minutes: null,
          group_label: null,
        }));
      const saved = await replaceSteps(recipe.id, user.id, parsed);
      setRecipe({ ...recipe, steps: saved });
      setEditingSteps(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddToShoppingList = async (listId: string) => {
    if (!recipe) return;
    try {
      const items = recipe.ingredients.map((ing) => ({
        ingredient: ing.ingredient,
        quantity: scaleQuantity(ing.quantity, originalServings, servings),
        unit: ing.unit,
        quantity_needed: [scaleQuantity(ing.quantity, originalServings, servings), ing.unit].filter(Boolean).join(' ') || null,
        recipe_id: recipe.id,
        recipe_name: recipe.title,
      }));
      const result = await addIngredientsToList(listId, items);
      setShowShoppingModal(false);
      setAddConfirm({ count: result.total, listName: shoppingLists.find((l) => l.id === listId)?.name ?? 'list', listId });
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add items');
    }
  };

  const handleNewShoppingList = async () => {
    if (!newListName.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const list = await createShoppingList(user.id, newListName.trim(), { storeName: newStoreName.trim() || undefined });
      setShoppingLists((prev) => [...prev, list]);
      await handleAddToShoppingList(list.id);
      setNewListName('');
      setNewStoreName('');
      setShowNewListForm(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create shopping list');
    }
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
        <div className="text-center text-cb-secondary py-20">Loading recipe...</div>
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

  // Sign-in wall for unauthenticated users (not guest)
  if (!isLoggedIn && !isGuest) {
    return (
      <main className="min-h-screen bg-cb-bg flex items-center justify-center">
        <div className="max-w-sm mx-auto text-center px-6">
          <Link href="/" className="text-2xl font-bold inline-block mb-8">
            <span className="text-cb-primary">Chefs</span>book
          </Link>
          {refUsername && (
            <p className="text-cb-secondary text-sm mb-2">@{refUsername} shared a recipe with you</p>
          )}
          <h2 className="text-xl font-bold text-cb-text mb-6">&ldquo;{recipe.title}&rdquo;</h2>
          <div className="space-y-3">
            <Link href="/auth" className="block w-full bg-cb-primary text-white py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity text-center">
              Sign in
            </Link>
            <Link href="/auth" className="block w-full border border-cb-border py-3 rounded-input text-sm font-semibold text-cb-text hover:bg-cb-card transition-colors text-center">
              Create account
            </Link>
            <a href="https://play.google.com/store/apps/details?id=com.chefsbook.app" className="block w-full border border-cb-border py-3 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text transition-colors text-center">
              📱 Download the app
            </a>
          </div>
          <div className="mt-6 pt-6 border-t border-cb-border">
            <p className="text-cb-muted text-xs mb-3">Continue as guest</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!guestEmail.trim() || !guestEmail.includes('@')) return;
              setGuestSubmitting(true);
              await supabase.from('guest_sessions').insert({ email: guestEmail.trim(), recipe_id: id });
              setIsGuest(true);
              setGuestSubmitting(false);
            }} className="flex gap-2">
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 border border-cb-border rounded-input px-3 py-2 text-sm bg-white text-cb-text placeholder:text-cb-muted focus:outline-none focus:ring-2 focus:ring-cb-primary/30"
              />
              <button
                type="submit"
                disabled={guestSubmitting || !guestEmail.includes('@')}
                className="bg-cb-base text-cb-text px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors disabled:opacity-50"
              >
                {guestSubmitting ? '...' : 'View'}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cb-bg">
      {/* Guest banner */}
      {isGuest && (
        <div className="bg-cb-primary text-white text-center py-2 text-sm font-medium">
          Viewing as guest · <Link href="/auth" className="underline font-semibold">Sign up to save recipes</Link>
        </div>
      )}
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold">
          <span className="text-cb-primary">Chefs</span>book
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-cb-secondary hover:text-cb-text text-sm font-medium">
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
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors print:hidden"
            title="Print recipe"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            <span className="hidden sm:inline">Print</span>
          </button>
          <div className="relative print:hidden">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
            {showShareMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-cb-card border border-cb-border rounded-card shadow-lg z-50 py-1">
                <button
                  onClick={async () => {
                    const url = `https://chefsbk.app/recipe/${recipe.id}`;
                    await navigator.clipboard.writeText(url);
                    setShowShareMenu(false);
                    alert('Link copied to clipboard!');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-cb-bg flex items-center gap-2"
                >
                  🔗 Copy link
                </button>
                <button
                  onClick={async () => {
                    setShowShareMenu(false);
                    if (!userIsPro) {
                      alert('PDF export requires the Pro plan. Upgrade in Settings.');
                      return;
                    }
                    window.open(`/recipe/${recipe.id}/pdf`, '_blank');
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cb-bg flex items-center gap-2 ${!userIsPro ? 'text-cb-muted' : ''}`}
                >
                  📄 Download PDF
                  {!userIsPro && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Pro</span>}
                </button>
                {isOwner && (
                  <button
                    onClick={() => {
                      setShowShareMenu(false);
                      if (!userIsPro) { alert('Social sharing is a Pro feature.'); return; }
                      setShowSocialShare(true);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cb-bg flex items-center gap-2 ${!userIsPro ? 'text-cb-muted' : ''}`}
                  >
                    📣 Social post
                    {!userIsPro && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Pro</span>}
                  </button>
                )}
              </div>
            )}
          </div>
          {isOwner && (
            <button
              onClick={async () => {
                await toggleFavourite(id, !recipe.is_favourite);
                setRecipe({ ...recipe, is_favourite: !recipe.is_favourite });
              }}
              className={`flex items-center gap-2 border px-4 py-2 rounded-input text-sm font-medium transition-colors ${
                recipe.is_favourite
                  ? 'border-cb-primary text-cb-primary bg-cb-primary/5'
                  : 'border-cb-border text-cb-secondary hover:bg-cb-card'
              }`}
              title={recipe.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <span className="text-base">{recipe.is_favourite ? '\u2665' : '\u2661'}</span>
              {recipe.is_favourite ? 'Favourited' : 'Favourite'}
            </button>
          )}
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

      {/* Hero: YouTube embed or image */}
      <div className="max-w-4xl mx-auto px-6">
        {recipe.youtube_video_id ? (
          <div className="aspect-video rounded-card overflow-hidden bg-black">
            <iframe
              ref={ytIframeRef}
              src={`https://www.youtube.com/embed/${recipe.youtube_video_id}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (userPhotos.length > 0 || recipe.image_url) ? (
          <div className={`rounded-card overflow-hidden relative group ${recipe.cookbook_id ? 'bg-cb-bg flex items-center justify-center' : 'bg-cb-card'}`} style={{ height: recipe.cookbook_id ? 300 : 288 }}>
            <img
              src={userPhotos.length > 0 ? proxyIfNeeded(userPhotos[0].url) : proxyIfNeeded(recipe.image_url!)}
              alt={recipe.title}
              className={`w-full h-full ${recipe.cookbook_id ? 'object-contain' : 'object-cover'}`}
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
            <svg className="w-10 h-10 text-cb-secondary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
            <span className="text-cb-secondary text-sm">{uploading ? 'Uploading...' : 'Add a photo'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }} />
          </label>
        ) : null}
      </div>

      {/* User Photo Gallery */}
      {isOwner && (
        <div className="max-w-4xl mx-auto px-6 mt-4">
          {userIsPro ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-cb-secondary">Your Photos <span className="font-normal">{userPhotos.length}/10</span></h3>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {userPhotos.map((photo) => (
                  <div key={photo.id} className="w-20 h-20 rounded-input overflow-hidden bg-cb-bg shrink-0 relative group">
                    <img src={proxyIfNeeded(photo.url)} alt={photo.caption ?? ''} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button onClick={async () => { await setPhotoPrimary(photo.id, id); if (recipe) { await updateRecipe(id, { image_url: photo.url }); setRecipe({ ...recipe, image_url: photo.url }); } }} className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-[10px]" title="Set as main">★</button>
                      <button onClick={async () => { await deleteRecipePhoto(photo.id); setUserPhotos((prev) => prev.filter((p) => p.id !== photo.id)); }} className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-[10px] text-cb-primary" title="Delete">✕</button>
                    </div>
                    {photo.is_primary && <span className="absolute top-0.5 left-0.5 bg-cb-primary text-white text-[8px] px-1 rounded">Main</span>}
                  </div>
                ))}
                {userPhotos.length < 10 && (
                  <label className="w-20 h-20 rounded-input border-2 border-dashed border-cb-border flex items-center justify-center cursor-pointer hover:border-cb-primary transition-colors shrink-0">
                    {uploadingPhoto ? (
                      <span className="text-[10px] text-cb-secondary">...</span>
                    ) : (
                      <svg className="w-6 h-6 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !recipe) return;
                      setUploadingPhoto(true);
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        const ext = file.name.split('.').pop() ?? 'jpg';
                        const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`;
                        const { error: upErr } = await supabase.storage.from('recipe-user-photos').upload(path, file, { contentType: file.type });
                        if (upErr) throw upErr;
                        const { data: { publicUrl } } = supabase.storage.from('recipe-user-photos').getPublicUrl(path);
                        const photo = await addRecipePhoto(id, user.id, path, publicUrl);
                        setUserPhotos((prev) => [...prev, photo]);
                      } catch (err: any) {
                        alert(err?.message ?? 'Upload failed');
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }} />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-cb-bg rounded-card p-3 flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
              <p className="text-xs text-cb-secondary">Upgrade to Pro to add your own photos to any recipe.</p>
              <a href="/pricing" className="text-xs text-cb-primary font-semibold hover:underline shrink-0">Upgrade</a>
            </div>
          )}
        </div>
      )}

      <article className="max-w-4xl mx-auto py-10 px-6">
        {/* Title & meta */}
        {editingTitle ? (
          <form onSubmit={(e) => { e.preventDefault(); saveTitle((e.currentTarget.elements.namedItem('title') as HTMLInputElement).value); }} className="mb-4">
            <input
              name="title"
              defaultValue={recipe.title}
              autoFocus
              className="text-3xl font-bold w-full bg-cb-bg border border-cb-primary rounded-input px-3 py-1 outline-none"
              onBlur={(e) => saveTitle(e.target.value)}
            />
          </form>
        ) : (
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className={`text-3xl font-bold ${isOwner ? 'cursor-pointer hover:text-cb-primary/80' : ''}`}
                  onClick={() => isOwner && setEditingTitle(true)}
                  title={isOwner ? 'Click to edit title' : undefined}
                >
                  {displayTitle}
                </h1>
                {translating && (
                  <span className="inline-flex items-center gap-1.5 bg-cb-primary/10 text-cb-primary text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">
                    Translating…
                  </span>
                )}
                {recipe.visibility === 'private' && (
                  <span className="bg-red-500 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-full tracking-wider">PRIVATE</span>
                )}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={async () => {
                  const next = recipe.visibility === 'private' ? 'public' : 'private';
                  await updateRecipe(id, { visibility: next as any });
                  setRecipe({ ...recipe, visibility: next as any });
                }}
                className={`shrink-0 mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  recipe.visibility === 'private'
                    ? 'border-red-300 text-red-500 bg-red-50 hover:bg-red-100'
                    : 'border-cb-green/30 text-cb-green bg-cb-green/5 hover:bg-cb-green/10'
                }`}
                title={recipe.visibility === 'private' ? 'Only you can see this recipe' : 'Anyone with the link can view this recipe'}
              >
                {recipe.visibility === 'private' ? (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>Private</>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 0 1 6.69 14.036m0 0-.177-.529A2.25 2.25 0 0 0 17.128 15H16.5l-.324-.324a1.453 1.453 0 0 0-2.328.377l-.036.073a1.586 1.586 0 0 1-.982.816l-.99.282c-.55.157-.894.702-.8 1.267l.073.438c.08.474.49.821.97.821.846 0 1.598.542 1.865 1.345l.215.643m5.276-3.67a9.012 9.012 0 0 1-5.276 3.67m0 0a9 9 0 0 1-10.275-4.835M15.75 9c0 .896-.393 1.7-1.016 2.25" /></svg>Public</>
                )}
              </button>
            )}
          </div>
        )}
        {/* Likes row below title */}
        <div className="flex items-center gap-3 mb-4">
          <LikeButton recipeId={recipe.id} likeCount={recipe.like_count ?? 0} />
          {recipe.visibility === 'public' && <span className="text-xs text-cb-green bg-cb-green/10 px-2 py-0.5 rounded-full font-medium">Public</span>}
        </div>
        {editingDesc ? (
          <form onSubmit={(e) => { e.preventDefault(); saveDescription((e.currentTarget.elements.namedItem('desc') as HTMLTextAreaElement).value); }} className="mb-6">
            <textarea
              name="desc"
              defaultValue={recipe.description ?? ''}
              autoFocus
              rows={3}
              className="w-full bg-cb-bg border border-cb-primary rounded-input px-3 py-2 text-lg text-cb-secondary outline-none leading-relaxed"
              onBlur={(e) => saveDescription(e.target.value)}
            />
          </form>
        ) : (displayDescription || recipe.description) ? (
          <p
            className={`text-cb-secondary text-lg mb-6 leading-relaxed ${isOwner ? 'cursor-pointer hover:bg-cb-bg/50 rounded-input px-1 -mx-1' : ''}`}
            onClick={() => isOwner && setEditingDesc(true)}
            title={isOwner ? 'Click to edit description' : undefined}
          >
            {displayDescription}
          </p>
        ) : isOwner ? (
          <button
            onClick={() => setEditingDesc(true)}
            className="text-sm text-cb-secondary mb-6 border border-dashed border-cb-border rounded-input px-3 py-1 hover:border-cb-primary hover:text-cb-primary"
          >
            + Add description
          </button>
        ) : null}

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
              className="text-sm px-3 py-1 rounded-input font-medium border border-dashed border-cb-border text-cb-secondary hover:border-cb-primary hover:text-cb-primary"
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
              className="text-sm px-3 py-1 rounded-input font-medium border border-dashed border-cb-border text-cb-secondary hover:border-cb-green hover:text-cb-green"
            >
              + Course
            </button>
          ) : null}

          {/* Duration */}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && (
            <span className="bg-cb-card text-cb-secondary text-sm px-3 py-1 rounded-input border border-cb-border">
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
                className="text-sm px-3 py-1 rounded-input font-medium border border-dashed border-cb-border text-cb-secondary hover:border-blue-400 hover:text-blue-600"
              >
                + Tag
              </button>
            )
          )}

          {/* Dietary flags */}
          {(recipe.dietary_flags ?? []).map((flag: string) => (
            <span key={flag} className="bg-cb-green-soft text-cb-green text-sm px-3 py-1 rounded-input font-medium">
              {flag}
            </span>
          ))}

          {/* Attribution tags */}
          {recipe.original_submitter_username && recipe.original_submitter_id !== recipe.user_id && (
            <Link
              href={`/u/${recipe.original_submitter_username}`}
              className="bg-cb-primary-soft text-cb-primary text-sm px-3 py-1 rounded-input font-medium inline-flex items-center gap-1 hover:ring-2 hover:ring-cb-primary/30"
            >
              🔒 Original by @{recipe.original_submitter_username}
            </Link>
          )}
          {recipe.shared_by_username && (
            <span className="bg-cb-base text-cb-text text-sm px-3 py-1 rounded-input font-medium inline-flex items-center gap-1">
              <Link href={`/u/${recipe.shared_by_username}`} className="hover:underline">
                Shared by @{recipe.shared_by_username}
              </Link>
            </span>
          )}
        </div>

        {(recipe.source_url || recipe.channel_name) && (
          <div className="mb-8 flex items-center gap-4 flex-wrap">
            {recipe.channel_name && (
              <span className="text-sm text-cb-secondary">
                by <span className="font-medium text-cb-text">{recipe.channel_name}</span>
              </span>
            )}
            {recipe.source_url && (
              <a
                href={recipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-cb-primary hover:underline"
              >
                {recipe.youtube_video_id ? (
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
                    View original
                  </>
                )}
              </a>
            )}
          </div>
        )}

        {/* Cookbook attribution */}
        {cookbook && (
          <div className="bg-cb-bg border border-cb-border rounded-card p-4 mb-6 flex items-center gap-3">
            {cookbook.cover_url ? (
              <img src={proxyIfNeeded(cookbook.cover_url!)} alt="" className="w-12 h-16 rounded object-cover shrink-0" />
            ) : (
              <div className="w-12 h-16 rounded bg-cb-card border border-cb-border flex items-center justify-center shrink-0 text-lg">📚</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Book: {cookbook.title.split(':')[0]!.trim()}</p>
              {cookbook.author && <p className="text-xs text-cb-secondary">by {cookbook.author}</p>}
              {recipe.page_number && <p className="text-[10px] text-cb-secondary">Page {recipe.page_number}</p>}
              {recipe.tags?.includes('AI Adaptation') && (
                <p className="text-[10px] text-amber-600 mt-0.5">AI adaptation — refer to the original cookbook for the exact recipe</p>
              )}
            </div>
            <Link href={`/dashboard/cookbooks/${cookbook.id}`} className="text-xs text-cb-primary hover:underline shrink-0">View Cookbook &rarr;</Link>
          </div>
        )}

        {/* video_only: no recipe extracted */}
        {recipe.video_only && (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-6 mb-10 text-center">
            <p className="text-sm font-medium text-amber-800 mb-1">No recipe found in this video</p>
            <p className="text-xs text-amber-600">
              This video was saved as a bookmark. You can watch it above or try re-importing.
            </p>
          </div>
        )}

        {/* Source attribution */}
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cb-muted hover:text-cb-primary mb-2 block">
            📖 Original recipe{recipe.source_author ? ` by ${recipe.source_author}` : ''} at {new URL(recipe.source_url).hostname.replace('www.', '')}
          </a>
        )}
        {recipe.original_submitter_username && recipe.original_submitter_id !== recipe.user_id && (
          <a href={`/u/${recipe.original_submitter_username}`} className="text-xs text-cb-muted hover:text-cb-primary mb-2 block">
            🔒 Original by @{recipe.original_submitter_username}
          </a>
        )}

        {/* aiChef badge */}
        {recipe.aichef_assisted && (
          <span className="inline-flex items-center gap-1 bg-cb-green-soft text-cb-green text-xs font-bold px-2.5 py-1 rounded-full mb-4">
            ✨ aiChef assisted
          </span>
        )}

        {/* Import status warning */}
        {recipe.import_status === 'partial' && (recipe.missing_sections?.length ?? 0) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span>⚠️</span>
              <p className="text-sm font-semibold text-amber-800">Some sections could not be imported</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(recipe.missing_sections ?? []).map((section: string) => (
                <span key={section} className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full capitalize">{section}</span>
              ))}
            </div>
            <div className="flex gap-2">
              {recipe.source_url && (
                <button onClick={handleRefresh} className="text-xs font-medium px-3 py-1.5 rounded-input border border-cb-border hover:border-cb-primary">
                  Try reimporting
                </button>
              )}
              <button className="text-xs font-medium px-3 py-1.5 rounded-input bg-cb-green-soft text-cb-green hover:bg-cb-green/20">
                ✨ Complete with aiChef
              </button>
            </div>
          </div>
        )}

        {!recipe.video_only && recipe.tags?.includes('_incomplete') && (
          <div className="bg-amber-50 border border-amber-200 rounded-card p-4 mb-6 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">This recipe may be incomplete</p>
              <p className="text-xs text-amber-600">Some ingredients or steps may be missing. Try re-importing or edit manually.</p>
            </div>
          </div>
        )}

        {/* Servings scaler + shopping list — hide for video_only */}
        {!recipe.video_only && <div className="bg-cb-card border border-cb-border rounded-card p-4 mb-10 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-cb-secondary">Servings</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition-colors"
            >
              -
            </button>
            <span className="w-8 text-center font-semibold">{servings}</span>
            <button
              onClick={() => setServings((s) => s + 1)}
              className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition-colors"
            >
              +
            </button>
          </div>
          {isOwner && recipe.ingredients.length > 0 && (
            <button
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const lists = await listShoppingLists(user.id);
                setShoppingLists(lists);
                setShowShoppingModal(true);
              }}
              className="ml-auto flex items-center gap-1.5 border border-cb-green text-cb-green px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-green hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              Add to shopping list
            </button>
          )}
        </div>}

        {!recipe.video_only && <>
        {/* Ingredients */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-cb-border">
            <h2 className="text-xl font-bold">Ingredients</h2>
            {isOwner && !editingIngredients && (
              <button onClick={startEditIngredients} className="text-xs text-cb-primary hover:underline">Edit</button>
            )}
          </div>
          {editingIngredients ? (
            <div>
              <div className="space-y-1.5 mb-3">
                {draftIngredients.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input value={row.quantity} onChange={(e) => updateDraftIng(idx, 'quantity', e.target.value)} placeholder="Qty" className="w-14 bg-cb-bg border border-cb-border rounded-input px-2 py-1.5 text-sm outline-none focus:border-cb-primary text-right tabular-nums" />
                    <input value={row.unit} onChange={(e) => updateDraftIng(idx, 'unit', e.target.value)} placeholder="Unit" className="w-16 bg-cb-bg border border-cb-border rounded-input px-2 py-1.5 text-sm outline-none focus:border-cb-primary" />
                    <input value={row.ingredient} onChange={(e) => updateDraftIng(idx, 'ingredient', e.target.value)} placeholder="Ingredient" className="flex-1 bg-cb-bg border border-cb-border rounded-input px-2 py-1.5 text-sm outline-none focus:border-cb-primary" />
                    <input value={row.preparation} onChange={(e) => updateDraftIng(idx, 'preparation', e.target.value)} placeholder="Prep" className="w-28 bg-cb-bg border border-cb-border rounded-input px-2 py-1.5 text-sm outline-none focus:border-cb-primary text-cb-secondary" />
                    <button onClick={() => removeDraftIng(idx)} className="text-cb-secondary hover:text-cb-primary shrink-0" title="Remove">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addDraftIng} className="text-xs text-cb-primary hover:underline">+ Add row</button>
                <span className="flex-1" />
                <button onClick={() => setEditingIngredients(false)} className="text-sm text-cb-secondary hover:text-cb-text">Cancel</button>
                <button onClick={saveIngredients} disabled={saving} className="bg-cb-primary text-white px-4 py-1.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
          <>
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
                  <h3 className="text-sm font-semibold text-cb-secondary uppercase tracking-wide mb-3">
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
                        <td className="py-2 pr-3 align-top w-20 text-cb-secondary text-sm whitespace-nowrap">
                          {ing.unit ?? ''}
                        </td>
                        <td className="py-2 align-top">
                          {getDisplayIngredientName(ing, recipe.ingredients.indexOf(ing))}
                          {ing.preparation && (
                            <span className="text-cb-secondary">, {ing.preparation}</span>
                          )}
                          {ing.optional && (
                            <span className="text-cb-secondary text-xs ml-1">(optional)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ));
          })()}
          </>
          )}
        </section>

        {/* Steps */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-cb-border">
            <h2 className="text-xl font-bold">Steps</h2>
            {isOwner && !editingSteps && (
              <button onClick={startEditSteps} className="text-xs text-cb-primary hover:underline">Edit</button>
            )}
          </div>
          {editingSteps ? (
            <div>
              <ol className="space-y-3 mb-3">
                {draftSteps.map((row, idx) => (
                  <li key={idx} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-cb-primary/20 text-cb-primary flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                      {idx + 1}
                    </div>
                    <textarea
                      value={row.instruction}
                      onChange={(e) => updateDraftStep(idx, e.target.value)}
                      rows={2}
                      placeholder={`Step ${idx + 1}...`}
                      className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
                    />
                    <button onClick={() => removeDraftStep(idx)} className="text-cb-secondary hover:text-cb-primary shrink-0 mt-1" title="Remove step">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="flex items-center gap-2">
                <button onClick={addDraftStep} className="text-xs text-cb-primary hover:underline">+ Add step</button>
                <span className="flex-1" />
                <button onClick={() => setEditingSteps(false)} className="text-sm text-cb-secondary hover:text-cb-text">Cancel</button>
                <button onClick={saveSteps} disabled={saving} className="bg-cb-primary text-white px-4 py-1.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
          <ol className="space-y-6">
            {recipe.steps.map((step, stepIdx) => (
              <li key={step.id} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <p className="leading-relaxed">{getDisplayStepInstruction(step, stepIdx)}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {step.timestamp_seconds != null && recipe.youtube_video_id && (
                      <button
                        onClick={() => seekYouTube(step.timestamp_seconds!)}
                        className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-cb-primary bg-cb-primary/10 px-2 py-0.5 rounded hover:bg-cb-primary/20 transition-colors"
                        title="Jump to this step in the video"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        {formatTimestamp(step.timestamp_seconds)}
                      </button>
                    )}
                    {step.timer_minutes != null && step.timer_minutes > 0 && (
                      <span className="text-cb-primary text-sm font-medium">
                        &#9201; {formatDuration(step.timer_minutes)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          )}
        </section>
        </>}

        {/* Notes */}
        <section className="mb-10">
          {editingNotes ? (
            <div>
              <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Notes</h2>
              <textarea
                defaultValue={recipe.notes ?? ''}
                autoFocus
                rows={4}
                className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary mb-2"
                onBlur={(e) => saveNotes(e.target.value)}
              />
            </div>
          ) : (displayNotes || recipe.notes) ? (
            <div>
              <h2 className="text-xl font-bold mb-4 pb-2 border-b border-cb-border">Notes</h2>
              <p
                className={`text-cb-secondary leading-relaxed ${isOwner ? 'cursor-pointer hover:bg-cb-bg/50 rounded-input px-2 py-1 -mx-2' : ''}`}
                onClick={() => isOwner && setEditingNotes(true)}
                title={isOwner ? 'Click to edit notes' : undefined}
              >
                {displayNotes}
              </p>
            </div>
          ) : isOwner ? (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-sm text-cb-secondary border border-dashed border-cb-border rounded-input px-3 py-1 hover:border-cb-primary hover:text-cb-primary"
            >
              + Add notes
            </button>
          ) : null}
        </section>

        {/* Cooking Notes (owner only) */}
        {isOwner && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-cb-border">
              <h2 className="text-xl font-bold">Cooking Log</h2>
              {!addingNote && (
                <button onClick={() => setAddingNote(true)} className="text-xs text-cb-primary hover:underline">+ Log a cook</button>
              )}
            </div>
            {addingNote && (
              <div className="bg-cb-card border border-cb-border rounded-card p-4 mb-4">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="How did it turn out? Any adjustments?"
                  rows={3}
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary mb-2"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!newNote.trim()) return;
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      const note = await addCookingNote(user.id, id, newNote.trim());
                      setCookingNotes((prev) => [note, ...prev]);
                      setNewNote('');
                      setAddingNote(false);
                    }}
                    className="bg-cb-primary text-white px-4 py-1.5 rounded-input text-sm font-semibold hover:opacity-90"
                  >
                    Save
                  </button>
                  <button onClick={() => { setAddingNote(false); setNewNote(''); }} className="text-sm text-cb-secondary hover:text-cb-text">Cancel</button>
                </div>
              </div>
            )}
            {cookingNotes.length > 0 ? (
              <div className="space-y-3">
                {cookingNotes.map((note) => (
                  <div key={note.id} className="bg-cb-card border border-cb-border rounded-input p-3 flex gap-3">
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{note.note}</p>
                      <p className="text-[10px] text-cb-secondary mt-1">
                        {new Date(note.cooked_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteCookingNote(note.id);
                        setCookingNotes((prev) => prev.filter((n) => n.id !== note.id));
                      }}
                      className="text-cb-secondary hover:text-cb-primary shrink-0 self-start"
                      title="Delete note"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : !addingNote ? (
              <p className="text-cb-secondary text-sm">No cooking log entries yet. Click &ldquo;Log a cook&rdquo; after you make this recipe.</p>
            ) : null}
          </section>
        )}

        {/* Print watermark */}
        <div className="print-watermark hidden">
          {recipe.source_url && <p style={{ fontSize: '8pt', color: '#aaa', marginBottom: '0.5em' }}>Source: {recipe.source_url}</p>}
          Saved with ChefsBook &mdash; chefsbook.com
        </div>

        {/* CTA — only for non-owners */}
        {!isOwner && (
          <div className="bg-cb-card border border-cb-border rounded-card p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Like this recipe?</h3>
            <p className="text-cb-secondary text-sm mb-4">
              {isLoggedIn
                ? 'Save it to your Chefsbook and never lose a recipe again.'
                : 'Sign up to save recipes, plan meals, and generate shopping lists.'}
            </p>
            <Link
              href={isLoggedIn ? '/dashboard' : '/auth'}
              className="inline-block bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {isLoggedIn ? 'Add to my Chefsbook' : 'Sign up to save this recipe'}
            </Link>
          </div>
        )}
      </article>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Delete recipe?</h2>
            <p className="text-cb-secondary text-sm mb-6">
              This will permanently delete &ldquo;{recipe.title}&rdquo;. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text"
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

      {/* Shopping list picker modal */}
      {showShoppingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowShoppingModal(false); setShowNewListForm(false); }}>
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-md mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Add {recipe?.ingredients.length} ingredients to:</h2>
              <button onClick={() => { setShowShoppingModal(false); setShowNewListForm(false); }} className="text-cb-secondary hover:text-cb-text">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {!showNewListForm ? (
              <>
                {shoppingLists.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {shoppingLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => handleAddToShoppingList(list.id)}
                        className="bg-cb-bg border border-cb-border rounded-card p-3 text-left hover:border-cb-green hover:bg-cb-green/5 transition-colors"
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          {list.pinned && <span className="text-cb-primary text-[10px]">{'\u2605'}</span>}
                          <p className="text-sm font-medium truncate">{list.name}</p>
                        </div>
                        {list.store_name && <p className="text-[10px] text-cb-secondary truncate">{list.store_name}</p>}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowNewListForm(true)}
                      className="border-2 border-dashed border-cb-border rounded-card p-3 text-center hover:border-cb-green transition-colors"
                    >
                      <svg className="w-5 h-5 text-cb-secondary mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      <p className="text-xs text-cb-secondary">New list</p>
                    </button>
                  </div>
                )}
                {shoppingLists.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-cb-secondary text-sm mb-3">No shopping lists yet</p>
                    <button onClick={() => setShowNewListForm(true)} className="bg-cb-green text-white px-5 py-2 rounded-input text-sm font-semibold hover:opacity-90">Create your first list</button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  autoFocus
                  placeholder="List name"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm outline-none focus:border-cb-green"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNewShoppingList(); }}
                />
                <input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Store name (optional, e.g. Whole Foods)"
                  className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-green"
                />
                <div className="flex gap-2 pt-1">
                  <button onClick={handleNewShoppingList} disabled={!newListName.trim()} className="flex-1 bg-cb-green text-white py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">Create & Add</button>
                  {shoppingLists.length > 0 && <button onClick={() => setShowNewListForm(false)} className="text-sm text-cb-secondary hover:text-cb-text px-3">Back</button>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {recipe && recipe.visibility === 'public' && (
        <div className="max-w-3xl mx-auto px-4 mb-8">
          <RecipeComments recipeId={recipe.id} recipeOwnerId={recipe.user_id} commentsEnabled={recipe.comments_enabled ?? true} />
        </div>
      )}

      {/* Social Share Modal */}
      {showSocialShare && recipe && (
        <SocialShareModal recipe={recipe} onClose={() => setShowSocialShare(false)} />
      )}

      {/* Added to list confirmation */}
      {addConfirm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-cb-card border border-cb-green/30 shadow-lg rounded-card p-4 flex items-center gap-4 max-w-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="w-10 h-10 rounded-full bg-cb-green/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-cb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{addConfirm.count} items added to {addConfirm.listName}</p>
          </div>
          <Link href={`/dashboard/shop`} onClick={() => setAddConfirm(null)} className="text-xs text-cb-green font-semibold hover:underline shrink-0">Go to list</Link>
          <button onClick={() => setAddConfirm(null)} className="text-cb-secondary hover:text-cb-text shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* CTA card for non-logged-in or guest users */}
      {(!isLoggedIn || isGuest) && (
        <div className="max-w-3xl mx-auto px-6 pb-12">
          <div className="bg-cb-card border border-cb-border rounded-card p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Love this recipe?</h3>
            <p className="text-cb-secondary text-sm mb-4">Save it to your ChefsBook collection</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/auth" className="bg-cb-green text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity">
                Sign up free
              </Link>
              <a href="https://play.google.com/store/apps/details?id=com.chefsbook.app" className="border border-cb-border px-6 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text transition-colors">
                Download the app
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
