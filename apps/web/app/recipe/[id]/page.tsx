'use client';
// TODO(web): add version picker UI on recipe detail
// TODO(web): auto-tag should support multi-select

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SocialShareModal from '@/components/SocialShareModal';
import LikeButton from '@/components/LikeButton';
import VerifiedChefBadge from '@/components/VerifiedChefBadge';
import RecipeComments from '@/components/RecipeComments';
import MealPlanPicker from '@/components/MealPlanPicker';
import AddToMenuModal from '@/components/AddToMenuModal';
import { VersionTabSwitcher } from '@/components/VersionTabSwitcher';
import { AskSousChefModal } from '@/components/AskSousChefModal';
import StorePickerDialog from '@/components/StorePickerDialog';
import { RecipeStatusBanner } from '@/components/RecipeStatusBanner';
import { useConfirmDialog, useAlertDialog } from '@/components/useConfirmDialog';
import { RecipeLightbox } from '@/components/RecipeLightbox';
import NutritionCard from '@/components/NutritionCard';
import { proxyIfNeeded, CHEFS_HAT_URL } from '@/lib/recipeImage';
import { supabase, getRecipe, deleteRecipe, updateRecipe, replaceIngredients, replaceSteps, toggleFavourite, listCookingNotes, addCookingNote, deleteCookingNote, listShoppingLists, createShoppingList, listRecipePhotos, addRecipePhoto, deleteRecipePhoto, setPhotoPrimary, isPro, getCookbook, getRecipeTranslation, saveRecipeTranslation, saveRecipe, isTagBlocked, logTagRemoval, getPersonalVersions, getRecipeModifiers, upsertRecipeModifier, removeRecipeModifier, getPersonalVersionCount } from '@chefsbook/db';
import type { Cookbook, RecipeTranslation } from '@chefsbook/db';
import type { TranslatedRecipe, SousChefFeedbackResult } from '@chefsbook/ai';
import { REGEN_PILLS, moderateTag, moderateRecipe } from '@chefsbook/ai';
import { logAiCallFromClient } from '@chefsbook/db';
import { addIngredientsToList } from '@/lib/addToShoppingList';
import type { RecipeWithDetails, RecipeIngredient, RecipeStep, ShoppingList, RecipeUserPhoto } from '@chefsbook/db';
import type { CookingNote } from '@chefsbook/db';
import { formatDuration, formatQuantity, scaleQuantity, cleanIngredientName, CUISINE_LIST, convertIngredient } from '@chefsbook/ui';
import type { UnitSystem } from '@chefsbook/ui';
import { useUnits } from '@/lib/useUnits';
import { getIncompletePillText } from '@/lib/recipeCompleteness';

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { units: unitSystem } = useUnits();
  const refUsername = searchParams.get('ref');
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [servings, setServings] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);
  const [ownerTags, setOwnerTags] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState<{ isDuplicate: boolean; canonicalId?: string; canonicalTitle?: string } | null>(null);
  const [editingCuisine, setEditingCuisine] = useState(false);
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [editingTags, setEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [showSavers, setShowSavers] = useState(false);
  const [savers, setSavers] = useState<{ id: string; username: string | null; display_name: string | null }[]>([]);
  const [saversLoading, setSaversLoading] = useState(false);
  const [saversError, setSaversError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingServings, setEditingServings] = useState(false);
  const [regeneratingNutrition, setRegeneratingNutrition] = useState(false);
  const [editingIngredients, setEditingIngredients] = useState(false);
  const [editingSteps, setEditingSteps] = useState(false);
  const [draftIngredients, setDraftIngredients] = useState<{ quantity: string; unit: string; ingredient: string; preparation: string; group_label: string }[]>([]);
  const [draftSteps, setDraftSteps] = useState<{ instruction: string }[]>([]);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [addConfirm, setAddConfirm] = useState<{ count: number; listName: string; listId: string } | null>(null);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const [showAddToMenu, setShowAddToMenu] = useState(false);
  const [menuAddSuccess, setMenuAddSuccess] = useState<{ menu: string; course: string } | null>(null);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [printIncludeImage, setPrintIncludeImage] = useState(true);
  const [printIncludeComments, setPrintIncludeComments] = useState(true);
  const [pdfIncludeImage, setPdfIncludeImage] = useState(true);
  const [pdfIncludeComments, setPdfIncludeComments] = useState(true);
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
  const [userHasSaved, setUserHasSaved] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [copyrightConfirm, CopyrightDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSaversBlockDialog, setShowSaversBlockDialog] = useState(false);
  const [blockedSaverCount, setBlockedSaverCount] = useState(0);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSubmitted, setFlagSubmitted] = useState(false);
  const [selectedFlagReasons, setSelectedFlagReasons] = useState<string[]>([]);
  const [flagDetails, setFlagDetails] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [showChangeImageModal, setShowChangeImageModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showExtensionNotice, setShowExtensionNotice] = useState(false);
  const [extensionContentType, setExtensionContentType] = useState<string>('recipe');
  const [showReimportMenu, setShowReimportMenu] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertConfirm, ConvertDialog] = useConfirmDialog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reimportMenuRef = useRef<HTMLDivElement>(null);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);

  // Personal versions state
  const [personalVersions, setPersonalVersions] = useState<RecipeWithDetails[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [recipeModifiers, setRecipeModifiers] = useState<{ modifier_user_id: string; modifier_username: string }[]>([]);
  const [showAskSousChef, setShowAskSousChef] = useState(false);
  const [canCreateMoreVersions, setCanCreateMoreVersions] = useState(true);

  const seekYouTube = useCallback((seconds: number) => {
    ytIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
      '*',
    );
  }, []);

  useEffect(() => {
    // Check for ?new=1 query param to show extension import notice
    const isNewImport = searchParams.get('new') === '1';
    const contentType = searchParams.get('contentType') || 'recipe';
    if (isNewImport) {
      setShowExtensionNotice(true);
      setExtensionContentType(contentType);
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
      // Load cookbook if linked
      if (data?.cookbook_id) getCookbook(data.cookbook_id).then(setCookbook);
      // Fetch owner tags for verified badge
      if (data?.user_id) {
        supabase.from('user_account_tags').select('tag').eq('user_id', data.user_id)
          .then(({ data: tags }) => setOwnerTags((tags ?? []).map((t: { tag: string }) => t.tag)));
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Check if recipe owner is expelled - hide from non-owners/non-admins
      if (data) {
        const { data: ownerProfile } = await supabase
          .from('user_profiles')
          .select('account_status')
          .eq('id', data.user_id)
          .single();
        if (ownerProfile?.account_status === 'expelled') {
          const isCurrentUserOwner = user && user.id === data.user_id;
          const isAdmin = user ? (await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle()).data : null;
          if (!isCurrentUserOwner && !isAdmin) {
            router.push('/dashboard');
            return;
          }
        }
      }
      if (user) {
        setIsLoggedIn(true);
        isPro(user.id).then(async (pro) => {
          if (pro) { setUserIsPro(true); return; }
          // Admins get Pro-equivalent access (matches server-side bypass in PDF route)
          const { data: adminRow } = await supabase.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
          if (adminRow) {
            setUserIsPro(true);
            setIsAdmin(true);
          }
        });
        // Fetch user language preference
        supabase.from('user_profiles').select('preferred_language, username').eq('id', user.id).maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.preferred_language) setUserLanguage(profile.preferred_language);
            if (profile?.username) setOwnerUsername(profile.username);
          });
        if (data && user.id === data.user_id) {
          setIsOwner(true);
          listCookingNotes(id).then(setCookingNotes);
          listRecipePhotos(id).then(setUserPhotos);
        } else if (data) {
          // Check if non-owner has saved this recipe
          supabase
            .from('recipe_saves')
            .select('id')
            .eq('recipe_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data: saveRow }) => {
              setUserHasSaved(!!saveRow);
            });

          // Check if user has already flagged this recipe
          supabase
            .from('recipe_flags')
            .select('id')
            .eq('recipe_id', id)
            .eq('flagged_by', user.id)
            .maybeSingle()
            .then(({ data: flagRow }) => {
              setFlagSubmitted(!!flagRow);
            });
        }
      }
      setLoading(false);
    })();
  }, [id]);

  // Fetch personal versions and modifiers
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !recipe) return;

      // Only fetch if user has saved this recipe (non-owners only)
      if (recipe.user_id !== user.id) {
        const { data: saveRow } = await supabase
          .from('recipe_saves')
          .select('id')
          .eq('recipe_id', recipe.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (saveRow) {
          // Fetch personal versions
          const versions = await getPersonalVersions(recipe.id, user.id);
          setPersonalVersions(versions);

          // Check if user can create more versions
          const count = await getPersonalVersionCount(recipe.id, user.id);
          setCanCreateMoreVersions(count < 2);
        }
      }

      // Fetch modifiers (visible to everyone)
      const modifiers = await getRecipeModifiers(recipe.id);
      setRecipeModifiers(modifiers);
    })();
  }, [recipe]);

  // Translation: check cache or translate via server-side API route (CORS blocks direct Claude calls from browser)
  useEffect(() => {
    if (!recipe || userLanguage === 'en') { setTranslation(null); return; }
    let cancelled = false;
    (async () => {
      const cached = await getRecipeTranslation(recipe.id, userLanguage);
      if (cancelled) return;
      if (cached && !cached.is_title_only) { setTranslation(cached); return; }
      // Title-only translation — show the title but still trigger full translation
      setTranslating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Not authenticated');
        const recipePayload = {
          title: recipe.title,
          description: recipe.description,
          ingredients: (recipe.ingredients ?? []).map((i) => ({ quantity: i.quantity, unit: i.unit, ingredient: i.ingredient, preparation: i.preparation })),
          steps: (recipe.steps ?? []).map((s) => ({ instruction: s.instruction })),
          notes: recipe.notes,
        };
        const res = await fetch('/api/recipes/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ recipe: recipePayload, recipeId: recipe.id, targetLanguage: userLanguage }),
        });
        if (!res.ok) throw new Error(`Translation API returned ${res.status}`);
        const result = await res.json();
        if (cancelled) return;
        // Server-side route already saves the full translation to DB
        setTranslation({
          id: '', recipe_id: recipe.id, language: userLanguage,
          translated_title: result.title, translated_description: result.description,
          translated_ingredients: result.ingredients, translated_steps: result.steps,
          translated_notes: result.notes, is_title_only: false,
          created_at: '', updated_at: '',
        } as any);
      } catch (err) { console.warn('[RecipePage] Translation failed:', err); }
      finally { if (!cancelled) setTranslating(false); }
    })();
    return () => { cancelled = true; };
  }, [recipe?.id, userLanguage]);

  // Poll image-status while generation is pending/generating. Time out after 30s.
  useEffect(() => {
    if (!recipe) return;
    const status = (recipe as any).image_generation_status;
    if (status !== 'pending' && status !== 'generating') return;
    if (generationFailed) return;

    const MAX_POLL_ATTEMPTS = 20;
    const POLL_INTERVAL_MS = 1500;
    let attempts = 0;
    let cancelled = false;

    const timer = setInterval(async () => {
      if (cancelled) return;
      attempts++;
      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(timer);
        if (!cancelled) setGenerationFailed(true);
        return;
      }
      try {
        const res = await fetch(`/api/recipes/${recipe.id}/image-status`);
        if (!res.ok) return;
        const { status: next, url } = await res.json();
        if (cancelled) return;
        if (next === 'complete' && url) {
          clearInterval(timer);
          // Reload recipe photos so the new image renders
          listRecipePhotos(recipe.id).then(setUserPhotos).catch(() => {});
          setRecipe((prev) => prev ? ({ ...prev, image_generation_status: 'complete' } as any) : prev);
        } else if (next === 'failed') {
          clearInterval(timer);
          setGenerationFailed(true);
        }
      } catch { /* keep polling */ }
    }, POLL_INTERVAL_MS);

    return () => { cancelled = true; clearInterval(timer); };
  }, [recipe?.id, (recipe as any)?.image_generation_status, generationFailed]);

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

  const handleDelete = async (forceAdminDelete = false) => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const url = forceAdminDelete
        ? `/api/recipes/${id}?adminDelete=true`
        : `/api/recipes/${id}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'RECIPE_HAS_SAVERS') {
          setBlockedSaverCount(data.saverCount);
          setShowDeleteConfirm(false);
          setShowSaversBlockDialog(true);
          setDeleting(false);
          return;
        }
        throw new Error(data.error || 'Delete failed');
      }

      router.push('/dashboard');
    } catch (e: any) {
      showAlert({ title: 'Delete failed', body: e?.message ?? 'Please try again.' });
      setDeleting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('recipe_saves')
        .delete()
        .eq('recipe_id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Show success toast and redirect
      router.push('/dashboard');
    } catch (e: any) {
      showAlert({ title: 'Remove failed', body: e?.message ?? 'Please try again.' });
      setRemoving(false);
    }
  };

  const handleRefresh = async () => {
    if (!recipe?.source_url) return;
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // skipDuplicateCheck: this IS the recipe we're re-importing — bypass session 198's duplicate gate
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: recipe.source_url, skipDuplicateCheck: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-import failed');
      if (data.needsBrowserExtraction) {
        throw new Error(data.message || 'This site blocks server imports. Install the ChefsBook browser extension and try again.');
      }
      if (!data.recipe) {
        throw new Error(data.error || 'Re-import returned no recipe data.');
      }

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
      showAlert({ title: 'Re-import failed', body: e?.message ?? 'Please try again.' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleConvertToTechnique = async () => {
    const confirmed = await convertConfirm({
      title: 'Move to My Techniques?',
      body: 'This will convert this recipe into a technique. Your title, description, steps, notes, tags, and photos will carry over. Ingredients will become Tools & Equipment. The original recipe will be deleted. This cannot be undone.',
      confirmLabel: 'Yes, move it',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    setConverting(true);
    setShowReimportMenu(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/convert/recipe-to-technique', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ recipeId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      router.push(`/technique/${data.techniqueId}`);
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

  const COURSES = ['breakfast', 'brunch', 'lunch', 'dinner', 'starter', 'main', 'side', 'dessert', 'snack', 'drink', 'bread', 'other'] as const;

  // Personal version handlers
  const handleVersionChange = async (versionId: string | null) => {
    setCurrentVersionId(versionId);
    if (versionId === null) {
      // Switch to original
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
    } else {
      // Switch to version
      const version = personalVersions.find(v => v.id === versionId);
      if (version) {
        setRecipe(version);
        setServings(version.servings);
      }
    }
  };

  const handleSaveVersion = async (regenerated: SousChefFeedbackResult, baseVersionId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (baseVersionId === null) {
      // Create new version
      const res = await fetch(`/api/recipes/${id}/personal-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regenerated),
      });
      if (!res.ok) throw new Error('Failed to create version');
      const { version } = await res.json();
      setPersonalVersions(prev => [...prev, version]);
      setCurrentVersionId(version.id);
      setRecipe(version);
      setServings(version.servings);
    } else {
      // Update existing version
      const res = await fetch(`/api/personal-versions/${baseVersionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regenerated),
      });
      if (!res.ok) throw new Error('Failed to update version');
      const { version } = await res.json();
      setPersonalVersions(prev => prev.map(v => v.id === baseVersionId ? version : v));
      if (currentVersionId === baseVersionId) {
        setRecipe(version);
        setServings(version.servings);
      }
    }
  };

  const handleRenameVersion = async (versionId: string, newTitle: string) => {
    const res = await fetch(`/api/personal-versions/${versionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) throw new Error('Failed to rename');
    const { version } = await res.json();
    setPersonalVersions(prev => prev.map(v => v.id === versionId ? { ...v, title: newTitle } : v));
    if (currentVersionId === versionId) {
      setRecipe(prev => prev ? { ...prev, title: newTitle } : null);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!confirm('Delete this version? This can\'t be undone.')) return;

    const res = await fetch(`/api/personal-versions/${versionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');

    setPersonalVersions(prev => prev.filter(v => v.id !== versionId));
    if (currentVersionId === versionId) {
      // Switch back to original
      setCurrentVersionId(null);
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
    }

    // Refresh modifiers
    const modifiers = await getRecipeModifiers(id);
    setRecipeModifiers(modifiers);
  };

  const handlePromoteVersion = async (versionId: string) => {
    if (!confirm('This will create a standalone recipe in your collection. The version slot will be freed.')) return;

    const res = await fetch(`/api/personal-versions/${versionId}/promote`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to promote');

    const { promotedRecipe } = await res.json();
    setPersonalVersions(prev => prev.filter(v => v.id !== versionId));
    if (currentVersionId === versionId) {
      setCurrentVersionId(null);
      const data = await getRecipe(id);
      setRecipe(data);
      if (data) setServings(data.servings);
    }

    // Refresh modifiers
    const modifiers = await getRecipeModifiers(id);
    setRecipeModifiers(modifiers);

    alert('Recipe added to your collection');
    router.push(`/recipe/${promotedRecipe.id}`);
  };

  // Helper: Re-moderate public recipe after text edit (non-blocking)
  const reModerateIfPublic = (updatedRecipe: RecipeWithDetails) => {
    if (updatedRecipe.visibility !== 'public') return;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const result = await moderateRecipe({
          title: updatedRecipe.title,
          description: updatedRecipe.description,
          ingredients: updatedRecipe.ingredients?.map((i) => ({ ingredient: i.ingredient })),
          steps: updatedRecipe.steps?.map((s) => ({ instruction: s.instruction })),
          notes: updatedRecipe.notes,
        });

        await logAiCallFromClient({
          userId: user?.id,
          action: 'moderate_recipe_edit',
          model: 'haiku',
          tokensIn: 200,
          tokensOut: 50,
          recipeId: id,
          success: true,
        });

        if (result.verdict === 'spam') {
          // Handle spam detection: flag and create recipe_flags entry
          await updateRecipe(id, {
            visibility: 'private',
            moderation_status: 'flagged',
            ai_recipe_verdict: 'spam',
            moderation_flag_reason: result.reason ?? 'Auto-detected spam',
            moderation_flagged_at: new Date().toISOString(),
          } as any);

          // Auto-create a recipe_flags row via API
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await fetch('/api/recipes/flag', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  recipeId: id,
                  reasons: ['Spam or self-promotion'],
                  details: 'Auto-detected by AI proctor',
                  aiGenerated: true, // Special flag to bypass user check
                }),
              });
            }
          } catch {
            // Flag creation failure should not block
          }

          setRecipe({
            ...updatedRecipe,
            visibility: 'private',
            moderation_status: 'flagged',
          } as any);

          await showAlert({
            title: 'Recipe flagged',
            body: "Your recipe has been flagged for potential spam content and hidden while our team reviews it.",
          });
        } else if (result.verdict === 'mild' || result.verdict === 'serious') {
          // Hide recipe and update local state
          await updateRecipe(id, {
            visibility: 'private',
            moderation_status: result.verdict === 'serious' ? 'flagged_serious' : 'flagged_mild',
            moderation_flag_reason: result.reason ?? null,
            moderation_flagged_at: new Date().toISOString(),
          });

          setRecipe({
            ...updatedRecipe,
            visibility: 'private',
            moderation_status: result.verdict === 'serious' ? 'flagged_serious' : 'flagged_mild',
          });

          await showAlert({
            title: 'Recipe hidden',
            body: "Your recipe has been hidden while our team reviews a recent edit. You'll be notified when it's cleared.",
          });
        }
      } catch {
        // Moderation unavailable (CORS) or error — recipe stays public
      }
    })();
  };

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

    // Check blocked list FIRST (no AI call)
    const blocked = await isTagBlocked(tag);
    if (blocked) {
      await showAlert({
        title: 'Tag not allowed',
        body: "That tag isn't allowed on Chefsbook.",
      });
      setNewTag('');
      return;
    }

    const tags = [...recipe.tags, tag];
    await updateRecipe(id, { tags });
    setRecipe({ ...recipe, tags });
    setNewTag('');

    // Non-blocking tag moderation (fire-and-forget)
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const result = await moderateTag(tag);
        await logAiCallFromClient({
          userId: user?.id,
          action: 'moderate_tag',
          model: 'haiku',
          tokensIn: 50,
          tokensOut: 30,
          recipeId: id,
          success: true,
        });
        if (result.verdict === 'flagged') {
          // Remove the tag and log it
          const filteredTags = tags.filter((t) => t !== tag);
          await updateRecipe(id, { tags: filteredTags });
          setRecipe({ ...recipe, tags: filteredTags });

          // Log the AI moderation removal
          await logTagRemoval(id, tag, 'ai', result.reason || null, user?.id || null);

          await showAlert({
            title: 'Tag removed',
            body: "That tag was removed — it doesn't meet our community guidelines.",
          });
        }
      } catch {
        // Moderation unavailable on web (CORS) or other error — tag stays
      }
    })();
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
    const updated = { ...recipe, title: title.trim() };
    setRecipe(updated);
    setEditingTitle(false);
    reModerateIfPublic(updated);
  };

  const saveDescription = async (desc: string) => {
    if (!recipe) return;
    const val = desc.trim() || null;
    await updateRecipe(id, { description: val });
    const updated = { ...recipe, description: val };
    setRecipe(updated);
    setEditingDesc(false);
    reModerateIfPublic(updated);
  };

  const saveNotes = async (notes: string) => {
    if (!recipe) return;
    const val = notes.trim() || null;
    await updateRecipe(id, { notes: val });
    const updated = { ...recipe, notes: val };
    setRecipe(updated);
    setEditingNotes(false);
    reModerateIfPublic(updated);
  };

  const saveServings = async (newServings: number) => {
    if (!recipe || newServings < 1) return;
    await updateRecipe(id, { servings: newServings });
    const updated = { ...recipe, servings: newServings };
    setRecipe(updated);
    setServings(newServings);
    setEditingServings(false);

    // If nutrition exists, regenerate it for the new servings count
    if ((recipe as any).nutrition) {
      setRegeneratingNutrition(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch(`/api/recipes/${id}/generate-nutrition`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch {
        // Nutrition regeneration is best-effort
      } finally {
        setRegeneratingNutrition(false);
      }
    }
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
      const updated = { ...recipe, ingredients: saved };
      setRecipe(updated);
      setEditingIngredients(false);
      reModerateIfPublic(updated);
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
      const updated = { ...recipe, steps: saved };
      setRecipe(updated);
      setEditingSteps(false);
      reModerateIfPublic(updated);
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
      showAlert({ title: 'Error', body: e?.message ?? 'Failed to add items' });
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
      showAlert({ title: 'Error', body: e?.message ?? 'Failed to create shopping list' });
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!recipe) return;

    // Copyright confirmation dialog
    const confirmed = await copyrightConfirm({
      title: 'Image Upload Confirmation',
      body: (
        <div className="text-sm text-gray-600 space-y-3">
          <p>By uploading this image you confirm:</p>
          <ul className="space-y-1 ml-1">
            <li className="flex items-start gap-2"><span className="text-green-600">&#10003;</span> I took this photo myself, OR</li>
            <li className="flex items-start gap-2"><span className="text-green-600">&#10003;</span> I have permission to use this image, OR</li>
            <li className="flex items-start gap-2"><span className="text-green-600">&#10003;</span> This image is free to use (Creative Commons / public domain)</li>
          </ul>
          <p className="mt-2">I confirm this image is NOT:</p>
          <ul className="space-y-1 ml-1">
            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> Taken from the recipe website</li>
            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> Someone else&apos;s copyrighted photo</li>
            <li className="flex items-start gap-2"><span className="text-red-500">&#10007;</span> A screenshot of another app</li>
          </ul>
        </div>
      ),
      confirmLabel: 'Confirm & Upload',
      cancelLabel: 'Cancel',
      variant: 'positive',
    });

    if (!confirmed) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Check for watermarks via Claude Vision (fire-and-forget on low risk)
      let watermarkRisk = 'low';
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const checkRes = await fetch('/api/recipes/check-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        if (checkRes.ok) {
          const result = await checkRes.json();
          watermarkRisk = result.risk_level;
          if (result.risk_level === 'high') {
            showAlert({ title: 'Copyright Warning', body: 'This image appears to be from another site and may be copyrighted. Please upload your own photo or use "Generate image" to create a unique AI image for this recipe.' });
            setUploading(false);
            return;
          }
        }
      } catch {
        // Watermark check failure is non-blocking
      }

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
      showAlert({ title: 'Error', body: e.message });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!recipe) return;
    setGeneratingImage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/recipes/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
      if (!res.ok) throw new Error('Failed to start image generation');
      // The image will be generated in the background
      setRecipe({ ...recipe, image_generation_status: 'generating' } as any);
    } catch (e: any) {
      showAlert({ title: 'Error', body: e.message });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleFlagRecipe = async () => {
    if (!recipe || selectedFlagReasons.length === 0) return;
    setFlagSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch('/api/recipes/flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipeId: recipe.id,
          reasons: selectedFlagReasons,
          details: flagDetails.trim() || null,
        }),
      });

      if (res.status === 409) {
        showAlert({ title: 'Already flagged', body: 'You have already flagged this recipe.' });
      } else if (!res.ok) {
        throw new Error('Failed to submit flag');
      } else {
        setFlagSubmitted(true);
        setShowFlagModal(false);
        setSelectedFlagReasons([]);
        setFlagDetails('');
        showAlert({
          title: 'Thank you',
          body: 'Thank you for flagging this recipe. Our team will review it.',
        });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', body: e.message || 'Failed to submit flag. Please try again.' });
    } finally {
      setFlagSubmitting(false);
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
          {!isLoggedIn && (
            <Link href="/dashboard" className="text-cb-secondary hover:text-cb-text text-sm font-medium">
              Dashboard
            </Link>
          )}
          <button
            onClick={() => { setPrintIncludeImage(true); setPrintIncludeComments(true); setShowPrintOptions(true); }}
            className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors print:hidden"
            title="Print recipe"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={() => setShowMealPicker(true)}
            className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors print:hidden"
            title="Add to meal plan"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="hidden sm:inline">+ Meal Plan</span>
          </button>
          <button
            onClick={() => setShowAddToMenu(true)}
            className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors print:hidden"
            title="Add to menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <span className="hidden sm:inline">+ Menu</span>
          </button>
          <div className="relative print:hidden">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
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
                    showAlert({ title: 'Success', body: 'Link copied to clipboard!' });
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-cb-bg flex items-center gap-2"
                >
                  🔗 Copy link
                </button>
                <button
                  onClick={() => {
                    setShowShareMenu(false);
                    if (!userIsPro) {
                      showAlert({ title: 'PDF Export', body: 'PDF export requires the Pro plan. Upgrade in Settings.' });
                      return;
                    }
                    setPdfIncludeImage(true);
                    setPdfIncludeComments(true);
                    setShowPdfOptions(true);
                  }}
                  disabled={downloadingPdf}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cb-bg flex items-center gap-2 ${!userIsPro ? 'text-cb-muted' : ''} ${downloadingPdf ? 'opacity-50' : ''}`}
                >
                  {downloadingPdf ? '⏳ Your Sous Chef is working on it...' : '📄 Download PDF'}
                  {!userIsPro && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Pro</span>}
                </button>
                {isOwner && (
                  <button
                    onClick={() => {
                      setShowShareMenu(false);
                      if (!userIsPro) { showAlert({ title: 'Pro Feature', body: 'Social sharing is a Pro feature.' }); return; }
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
                  {recipe?.source_url && (
                    <button
                      onClick={() => { setShowReimportMenu(false); handleRefresh(); }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-cb-bg flex items-center gap-2"
                    >
                      <span>🔄</span> Re-import from source
                    </button>
                  )}
                  <button
                    onClick={handleConvertToTechnique}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-cb-bg flex items-center gap-2 border-t border-cb-border"
                  >
                    <span>📚</span> Move to My Techniques
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Delete button (owner or admin) */}
          {(isOwner || isAdmin) && (
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
          {/* Remove button (non-owner who saved the recipe) */}
          {!isOwner && userHasSaved && (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="flex items-center gap-2 border border-cb-border px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-card transition-colors text-cb-secondary"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Remove
            </button>
          )}
          {/* Flag button (non-owners only) */}
          {isLoggedIn && !isOwner && (
            <button
              onClick={() => {
                if (flagSubmitted) {
                  showAlert({ title: 'Already flagged', body: 'You have already flagged this recipe.' });
                } else {
                  setShowFlagModal(true);
                  setSelectedFlagReasons([]);
                  setFlagDetails('');
                }
              }}
              disabled={flagSubmitted}
              className={`flex items-center gap-2 border px-4 py-2 rounded-input text-sm font-medium transition-colors ${
                flagSubmitted
                  ? 'border-cb-border text-cb-muted bg-cb-bg cursor-not-allowed opacity-60'
                  : 'border-cb-border text-cb-secondary hover:bg-cb-card'
              }`}
              title={flagSubmitted ? 'You have flagged this recipe' : 'Flag this recipe'}
            >
              🚩 {flagSubmitted ? 'Flagged' : 'Flag'}
            </button>
          )}
          {/* Flag modal */}
          {showFlagModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFlagModal(false)}>
              <div className="bg-cb-card rounded-card p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-1">Flag this recipe</h3>
                <p className="text-sm text-cb-secondary mb-4">Help us keep Chefsbook safe and accurate</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    'Inappropriate content',
                    'Copyright violation',
                    'Missing or incorrect information',
                    'Spam or self-promotion',
                    'Duplicate recipe',
                    'Other',
                  ].map((reason) => {
                    const isSelected = selectedFlagReasons.includes(reason);
                    return (
                      <button
                        key={reason}
                        onClick={() => {
                          setSelectedFlagReasons((prev) =>
                            isSelected
                              ? prev.filter((r) => r !== reason)
                              : [...prev, reason]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          isSelected
                            ? 'bg-cb-primary text-white border-cb-primary'
                            : 'bg-cb-bg text-cb-text border-cb-border hover:border-cb-primary'
                        }`}
                      >
                        {reason}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value.slice(0, 300))}
                  placeholder="Additional details (optional)"
                  className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none h-20 mb-1 bg-cb-bg outline-none focus:border-cb-primary"
                />
                <p className="text-xs text-cb-muted mb-4 text-right">{flagDetails.length}/300</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowFlagModal(false)}
                    className="px-4 py-2 text-sm text-cb-secondary hover:text-cb-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFlagRecipe}
                    disabled={selectedFlagReasons.length === 0 || flagSubmitting}
                    className="px-4 py-2 text-sm font-medium bg-cb-primary text-white rounded-input disabled:opacity-40 hover:bg-cb-primary/90 transition-colors"
                  >
                    {flagSubmitting ? 'Submitting...' : 'Submit flag'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero: YouTube embed or image */}
      <div data-print-hero className="max-w-4xl mx-auto px-6">
        {recipe.youtube_video_id ? (
          <div className="aspect-video rounded-card overflow-hidden bg-black">
            <iframe
              ref={ytIframeRef}
              src={`https://www.youtube.com/embed/${recipe.youtube_video_id}?enablejsapi=1&autoplay=0&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
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
              className={`w-full h-full ${recipe.cookbook_id ? 'object-contain' : 'object-cover'} cursor-zoom-in`}
              onClick={() => setLightboxOpen(true)}
            />
            {isOwner && !regenerating && (
              <button
                onClick={() => setShowChangeImageModal(true)}
                className="absolute bottom-3 right-3 bg-black/60 text-white px-3 py-1.5 rounded-input text-xs font-medium cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
                Change image
              </button>
            )}
            {/* Hidden file input for upload from modal */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }} />
            {/* Regenerating overlay */}
            {regenerating && (
              <div className="absolute inset-0 bg-cb-bg/90 flex flex-col items-center justify-center gap-3 z-10">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center animate-pulse shadow-sm">
                  <img src="/images/chefs-hat.png" alt="" className="w-10 h-10 opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <p className="text-sm font-medium text-cb-text">Regenerating your image...</p>
                <p className="text-xs text-cb-secondary">This takes about 10-15 seconds</p>
              </div>
            )}
            {/* Status pills — bottom-centre */}
            {(() => {
              const isUnderReview = (recipe as any).copyright_review_pending === true ||
                ((recipe as any).moderation_status && (recipe as any).moderation_status !== 'clean') ||
                (recipe as any).ai_recipe_verdict === 'flagged';
              const incompletePillText = getIncompletePillText({ title: recipe.title, description: recipe.description, ingredients: recipe.ingredients, steps: recipe.steps });
              if (isUnderReview) {
                return <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-cb-primary text-white text-xs font-medium px-3 py-1 rounded-full z-20">🔍 Under Review by Chefsbook</div>;
              } else if (incompletePillText) {
                return <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-cb-primary text-white text-xs font-medium px-3 py-1 rounded-full z-20">{incompletePillText}</div>;
              }
              return null;
            })()}
          </div>
        ) : isOwner ? (
          <div className="h-48 rounded-card border-2 border-dashed border-cb-border bg-cb-card flex flex-col items-center justify-center gap-3">
            {generationFailed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-cb-bg flex items-center justify-center">
                  <img src="/images/chefs-hat.png" alt="" className="w-10 h-10 opacity-60" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <p className="text-cb-secondary text-sm">Image generation is temporarily unavailable.</p>
                <button
                  onClick={() => { setGenerationFailed(false); handleGenerateImage(); }}
                  disabled={generatingImage}
                  className="mt-1 px-4 py-2 rounded-input text-sm font-medium bg-cb-primary text-white hover:bg-cb-primary/90 transition-colors disabled:opacity-50"
                >
                  {generatingImage ? 'Starting...' : 'Try again'}
                </button>
              </div>
            ) : ((recipe as any).image_generation_status === 'generating' || (recipe as any).image_generation_status === 'pending') ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-cb-bg flex items-center justify-center animate-pulse">
                  <img src="/images/chefs-hat.png" alt="" className="w-10 h-10 opacity-60" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <span className="text-cb-secondary text-sm">Your Sous Chef is creating your image...</span>
                <span className="text-cb-muted text-xs">This takes about 10-15 seconds</span>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-input text-sm font-medium border border-cb-border hover:bg-cb-bg cursor-pointer transition-colors text-cb-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                    {uploading ? 'Uploading...' : 'Upload photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }} />
                  </label>
                  <button
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                    className="flex items-center gap-2 px-4 py-2 rounded-input text-sm font-medium bg-cb-primary text-white hover:bg-cb-primary/90 transition-colors disabled:opacity-50"
                  >
                    <span>&#127912;</span>
                    {generatingImage ? 'Starting...' : 'Generate image'}
                  </button>
                </div>
                <span className="text-cb-muted text-xs">Upload your own photo or let AI create one</span>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Change Image Modal */}
      {showChangeImageModal && recipe && (() => {
        const aiPhoto = userPhotos.find((p) => p.is_ai_generated);
        const hasAiImage = !!aiPhoto;
        const REGEN_LIMIT = 5;
        const regenCount = aiPhoto?.regen_count ?? 0;
        const regenRemaining = Math.max(0, REGEN_LIMIT - regenCount);
        const regenAvailable = hasAiImage && regenRemaining > 0;

        const handleRegenPill = async (pillId: string) => {
          setShowChangeImageModal(false);
          setRegenerating(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/recipes/regenerate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ recipeId: recipe.id, pillId }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              showAlert({ title: 'Error', body: body.error || 'Failed to regenerate' });
              setRegenerating(false);
              return;
            }
            // Poll for completion
            let attempts = 0;
            const poll = setInterval(async () => {
              attempts++;
              if (attempts > 20) {
                clearInterval(poll);
                setRegenerating(false);
                showAlert({ title: 'Image Generation', body: 'Image generation is taking longer than expected. Refresh the page in a minute.' });
                return;
              }
              try {
                const statusRes = await fetch(`/api/recipes/${recipe.id}/image-status`);
                const { status, url, regenCount } = await statusRes.json();
                if (status === 'complete' && url) {
                  clearInterval(poll);
                  setRegenerating(false);
                  // Update the photo in state — use the authoritative regenCount from the server
                  setUserPhotos((prev) => prev.map((p) =>
                    p.is_ai_generated ? { ...p, url, regen_count: regenCount ?? (p.regen_count ?? 0) + 1 } : p
                  ));
                } else if (status === 'failed') {
                  clearInterval(poll);
                  setRegenerating(false);
                  showAlert({ title: 'Error', body: 'Image generation failed. Please try again.' });
                }
              } catch { /* keep polling */ }
            }, 1500);
          } catch {
            setRegenerating(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowChangeImageModal(false)}>
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Change Recipe Image</h2>

              <button
                onClick={() => {
                  setShowChangeImageModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full text-left px-4 py-3 rounded-lg border border-cb-border hover:border-cb-primary hover:bg-cb-bg transition-colors mb-3 flex items-center gap-3"
              >
                <span className="text-lg">&#128247;</span>
                <div>
                  <p className="text-sm font-semibold text-cb-text">Upload your own photo</p>
                  <p className="text-xs text-cb-secondary">Use your own food photo</p>
                </div>
              </button>

              {hasAiImage && (
                <>
                  <div className="border-t border-cb-border my-3" />
                  <div className="px-1 mb-2">
                    <p className="text-sm font-semibold text-cb-text mb-1 flex items-center gap-1.5">
                      <span>&#127912;</span> Regenerate with AI
                    </p>
                    <p className="text-xs text-cb-secondary mb-3">Get a new AI-generated image</p>
                    {regenAvailable ? (
                      <>
                        <p className="text-xs text-cb-muted mb-2">Why doesn&apos;t it look right?</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {REGEN_PILLS.map((pill) => (
                            <button
                              key={pill.id}
                              onClick={() => handleRegenPill(pill.id)}
                              className="px-3 py-1.5 rounded-full text-xs font-medium bg-cb-card border border-cb-border text-cb-secondary hover:text-cb-text hover:border-cb-primary transition-colors"
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-cb-muted">
                          {regenRemaining} regeneration{regenRemaining === 1 ? '' : 's'} remaining
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-cb-muted">You&apos;ve used all {REGEN_LIMIT} regenerations for this recipe</p>
                    )}
                  </div>
                </>
              )}

              {!hasAiImage && (
                <>
                  <div className="border-t border-cb-border my-3" />
                  <button
                    onClick={() => {
                      setShowChangeImageModal(false);
                      handleGenerateImage();
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg border border-cb-border hover:border-cb-primary hover:bg-cb-bg transition-colors flex items-center gap-3"
                  >
                    <span className="text-lg">&#127912;</span>
                    <div>
                      <p className="text-sm font-semibold text-cb-text">Generate an AI image</p>
                      <p className="text-xs text-cb-secondary">Let AI create a food photo</p>
                    </div>
                  </button>
                </>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowChangeImageModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                        showAlert({ title: 'Upload Error', body: err?.message ?? 'Upload failed' });
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
        <CopyrightDialog />
        <AlertDialog />
        <ConvertDialog />
        {/* Copyright review banner (owner only) */}
        {isOwner && (recipe as any).copyright_review_pending && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-card">
            <div className="flex items-start gap-3">
              <span className="text-xl">&#9878;</span>
              <div>
                <h3 className="font-semibold text-amber-900">Under copyright review</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This recipe has been flagged for potential copyright issues and is temporarily private. ChefsBook will review it shortly. You&apos;ll receive a message with our decision.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Copyright removed banner */}
        {isOwner && (recipe as any).copyright_removed && (
          <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-card">
            <div className="flex items-start gap-3">
              <span className="text-xl">&#169;</span>
              <div>
                <h3 className="font-semibold text-red-900">Removed for copyright</h3>
                <p className="text-sm text-red-700 mt-1">
                  This recipe was removed from public view due to copyright concerns. You may keep it as a private reference or delete it.
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Flag submitted thank-you */}
        {flagSubmitted && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-card text-sm text-green-800">
            Thanks for your report. We&apos;ll review it shortly. &#10003;
          </div>
        )}
        {/* Extension import one-time notice */}
        {showExtensionNotice && (
          <div className="rounded-card border border-blue-200 bg-blue-50 px-4 py-3 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none" aria-hidden>ℹ️</span>
              <div className="flex-1">
                <div className="font-medium text-blue-900">
                  Your Sous Chef imported this as a {extensionContentType.charAt(0).toUpperCase() + extensionContentType.slice(1)}
                </div>
                <div className="mt-1 text-sm text-blue-800">
                  If that&apos;s not right, you can convert it using the Re-import button below.
                </div>
                <button
                  type="button"
                  onClick={() => setShowExtensionNotice(false)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-full px-3 py-1 hover:bg-blue-700"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Recipe status banner — incomplete OR flagged (owner-only) */}
        {isOwner && recipe && ((recipe as any).is_complete === false || (recipe as any).moderation_status === 'flagged' || (recipe as any).ai_recipe_verdict === 'flagged') && (
          <RecipeStatusBanner
            recipeId={recipe.id}
            sourceUrl={recipe.source_url}
            missingFields={((recipe as any).missing_fields ?? []) as string[]}
            moderationStatus={(recipe as any).moderation_status}
            aiRecipeVerdict={(recipe as any).ai_recipe_verdict}
            onRefreshed={() => window.location.reload()}
          />
        )}
        {/* Duplicate notice — shown when owner tries to make public but a similar recipe exists */}
        {isOwner && duplicateNotice?.isDuplicate && (
          <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none" aria-hidden>📖</span>
              <div className="flex-1">
                <div className="font-medium text-amber-900">
                  A similar public recipe already exists in ChefsBook.
                </div>
                <div className="mt-1 text-sm text-amber-800">
                  Your recipe has been kept private in your collection.
                </div>
                <div className="mt-2 flex gap-2">
                  {duplicateNotice.canonicalId && (
                    <a
                      href={`/recipe/${duplicateNotice.canonicalId}`}
                      className="inline-flex items-center gap-1.5 text-sm bg-cb-primary text-white rounded-full px-3 py-1"
                    >
                      View the public version
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setDuplicateNotice(null)}
                    className="inline-flex items-center gap-1.5 text-sm border border-amber-300 text-amber-900 rounded-full px-3 py-1 hover:bg-amber-100"
                  >
                    Edit to make it unique
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium px-4 py-2 rounded-card">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Hang tight — we're translating this recipe for you...
                  </div>
                )}
                {recipe.visibility === 'private' && (
                  <span className="bg-red-500 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-full tracking-wider">PRIVATE</span>
                )}
              </div>
            </div>
            {isOwner && !((recipe as any).copyright_review_pending || (recipe as any).copyright_removed) && (
              <button
                onClick={async () => {
                  // Check if system-locked (enforced private due to incompleteness)
                  if ((recipe as any).system_locked) {
                    await alert({
                      title: 'Recipe locked',
                      body: 'Complete this recipe to publish it. The system will automatically restore visibility once all required fields are filled in.',
                      confirmLabel: 'Got it'
                    });
                    return;
                  }

                  const next = recipe.visibility === 'private' ? 'public' : 'private';
                  if (next === 'public') {
                    // Check if recipe is flagged/under review
                    const isUnderReview = (recipe as any).copyright_review_pending === true ||
                      ((recipe as any).moderation_status && (recipe as any).moderation_status !== 'clean') ||
                      (recipe as any).ai_recipe_verdict === 'flagged';
                    if (isUnderReview) {
                      await alert({
                        title: 'Recipe is under review',
                        body: 'This recipe is currently being reviewed by Chefsbook. You\'ll be able to publish it once the review is complete.',
                        confirmLabel: 'Got it'
                      });
                      return;
                    }

                    // Completeness check removed — enforceCompleteness now handles this server-side

                    // Run server-side duplicate check before making public
                    try {
                      const res = await fetch('/api/recipes/check-duplicate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipeId: id }),
                      });
                      const dupResult = await res.json();
                      if (dupResult.isDuplicate) {
                        setDuplicateNotice(dupResult);
                        return; // Don't make public
                      }
                    } catch { /* non-blocking — proceed with visibility change */ }
                  }
                  await updateRecipe(id, { visibility: next as any });
                  setRecipe({ ...recipe, visibility: next as any });
                  if (next === 'public') setDuplicateNotice(null);
                }}
                className={`shrink-0 mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  recipe.visibility === 'private'
                    ? (recipe as any).system_locked
                      ? 'border-gray-300 text-gray-500 bg-gray-100 cursor-not-allowed opacity-75'
                      : 'border-red-300 text-red-500 bg-red-50 hover:bg-red-100 cursor-pointer'
                    : 'border-cb-green/30 text-cb-green bg-cb-green/5 hover:bg-cb-green/10 cursor-pointer'
                }`}
                title={
                  (recipe as any).system_locked
                    ? 'Complete this recipe to publish it'
                    : recipe.visibility === 'private'
                    ? 'Only you can see this recipe'
                    : 'Anyone with the link can view this recipe'
                }
              >
                {recipe.visibility === 'private' ? (
                  (recipe as any).system_locked ? (
                    <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>🔒 Locked</>
                  ) : (
                    <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>Private</>
                  )
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 0 1 6.69 14.036m0 0-.177-.529A2.25 2.25 0 0 0 17.128 15H16.5l-.324-.324a1.453 1.453 0 0 0-2.328.377l-.036.073a1.586 1.586 0 0 1-.982.816l-.99.282c-.55.157-.894.702-.8 1.267l.073.438c.08.474.49.821.97.821.846 0 1.598.542 1.865 1.345l.215.643m5.276-3.67a9.012 9.012 0 0 1-5.276 3.67m0 0a9 9 0 0 1-10.275-4.835M15.75 9c0 .896-.393 1.7-1.016 2.25" /></svg>Public</>
                )}
              </button>
            )}
          </div>
        )}
        {/* Likes + saves row below title */}
        <div className="flex items-center gap-4 mb-2">
          <LikeButton recipeId={recipe.id} likeCount={recipe.like_count ?? 0} recipeOwnerId={recipe.user_id} />
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-cb-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
            {isOwner && (recipe.save_count ?? 0) > 0 ? (
              <button onClick={async () => { setSaversLoading(true); setSaversError(null); setShowSavers(true); try { const { data: { session } } = await supabase.auth.getSession(); const res = await fetch(`/api/recipe/${recipe.id}/savers`, { headers: { Authorization: `Bearer ${session?.access_token}` } }); if (!res.ok) throw new Error('Failed to load'); const data = await res.json(); setSavers(data); } catch (e: any) { setSaversError(e.message ?? 'Failed to load'); } setSaversLoading(false); }} className="text-sm text-cb-muted hover:text-cb-primary transition">
                {recipe.save_count ?? 0}
              </button>
            ) : (
              <span className="text-sm text-cb-muted">{recipe.save_count ?? 0}</span>
            )}
          </div>
        </div>
        {/* Attribution row */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {(() => {
            const uploaderUsername = recipe.original_submitter_username ?? (isOwner ? ownerUsername : null);
            return uploaderUsername ? (
              <a href={`/dashboard/chef/${uploaderUsername}`} className="inline-flex items-center gap-1.5 bg-cb-bg border border-cb-border rounded-full px-3 py-1 text-xs font-medium text-cb-text hover:border-cb-primary/50 transition">
                <span className="w-4 h-4 rounded-full bg-cb-primary text-white flex items-center justify-center text-[8px] font-bold">{uploaderUsername.charAt(0).toUpperCase()}</span>
                @{uploaderUsername}
                {ownerTags.includes('Verified Chef') && <VerifiedChefBadge size="sm" />}
              </a>
            ) : null;
          })()}
          {recipe.source_url && (() => {
            try {
              const domain = new URL(recipe.source_url).hostname.replace('www.', '');
              return (
                <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-cb-bg border border-cb-border rounded-full px-3 py-1 text-xs font-medium text-cb-text hover:border-cb-primary/50 transition">
                  🔗 {domain} <span className="text-[10px] text-cb-muted">↗</span>
                </a>
              );
            } catch { return null; }
          })()}
          {recipe.cookbook_id && (
            <a href={`/dashboard/cookbooks/${recipe.cookbook_id}`} className="inline-flex items-center gap-1 bg-cb-bg border border-cb-border rounded-full px-3 py-1 text-xs font-medium text-cb-text hover:border-cb-primary/50 transition">
              📖 {(recipe as any).cookbook_title ?? 'Cookbook'}
            </a>
          )}
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
            <div className="relative">
              <input
                autoFocus
                value={cuisineFilter}
                onChange={(e) => setCuisineFilter(e.target.value)}
                onFocus={() => setCuisineFilter('')}
                placeholder="Type or select cuisine..."
                className="bg-cb-bg border border-cb-primary rounded-input px-2 py-1 text-sm w-44 outline-none"
                onBlur={() => { setTimeout(() => { if (cuisineFilter.trim()) saveCuisine(cuisineFilter.trim()); setEditingCuisine(false); setCuisineFilter(''); }, 150); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCuisine(cuisineFilter.trim() || recipe.cuisine || null); setEditingCuisine(false); setCuisineFilter(''); } if (e.key === 'Escape') { setEditingCuisine(false); setCuisineFilter(''); } }}
              />
              <div className="absolute top-full left-0 mt-1 w-52 bg-cb-card border border-cb-border rounded-input shadow-lg z-50 max-h-48 overflow-y-auto">
                {[...CUISINE_LIST].filter((c) => !cuisineFilter || c.toLowerCase().includes(cuisineFilter.toLowerCase())).map((c) => (
                  <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { saveCuisine(c); setEditingCuisine(false); setCuisineFilter(''); }} className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-cb-bg ${recipe.cuisine === c ? 'text-cb-primary font-medium bg-cb-primary/5' : 'text-cb-text'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
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
              href={`/dashboard/chef/${recipe.original_submitter_username}`}
              className="bg-cb-primary-soft text-cb-primary text-sm px-3 py-1 rounded-input font-medium inline-flex items-center gap-1 hover:ring-2 hover:ring-cb-primary/30"
            >
              🔒 Original by @{recipe.original_submitter_username}
            </Link>
          )}
          {recipe.shared_by_username && (
            <span className="bg-cb-base text-cb-text text-sm px-3 py-1 rounded-input font-medium inline-flex items-center gap-1">
              <Link href={`/dashboard/chef/${recipe.shared_by_username}`} className="hover:underline">
                Shared by @{recipe.shared_by_username}
              </Link>
            </span>
          )}

          {/* Modifier pills - show last 3 users who created personal versions */}
          {recipeModifiers.slice(-3).map((modifier) => (
            <Link
              key={modifier.modifier_user_id}
              href={`/dashboard/chef/${modifier.modifier_username}`}
              className="bg-purple-100 text-purple-800 border border-purple-300 text-sm px-3 py-1 rounded-input font-medium hover:ring-2 hover:ring-purple-400/30"
            >
              @{modifier.modifier_username}
            </Link>
          ))}
        </div>

        {/* Channel name only (YouTube recipes) */}
        {recipe.channel_name && !recipe.source_url && (
          <p className="text-sm text-cb-secondary mb-4">by <span className="font-medium text-cb-text">{recipe.channel_name}</span></p>
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

        {/* Attribution is shown in the attribution row above — no duplicate here */}

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
        {!recipe.video_only && <div className="bg-cb-card border border-cb-border rounded-card p-4 mb-10">
          {/* Base servings (editable by owner) */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-cb-border/50">
            <span className="text-sm text-cb-secondary">Recipe serves:</span>
            {editingServings ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseInt((e.currentTarget.elements.namedItem('servings') as HTMLInputElement).value);
                  if (val >= 1) saveServings(val);
                }}
                className="flex items-center gap-2"
              >
                <input
                  name="servings"
                  type="number"
                  min={1}
                  defaultValue={recipe.servings}
                  autoFocus
                  className="w-16 text-sm font-semibold bg-cb-bg border border-cb-primary rounded-input px-2 py-1 outline-none text-center"
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1) saveServings(val);
                    else setEditingServings(false);
                  }}
                />
                <span className="text-sm text-cb-muted">servings</span>
              </form>
            ) : (
              <>
                <span className="text-sm font-semibold">{recipe.servings}</span>
                {isOwner && (
                  <button
                    onClick={() => setEditingServings(true)}
                    className="text-xs text-cb-primary hover:underline ml-1"
                  >
                    Edit
                  </button>
                )}
                {regeneratingNutrition && (
                  <span className="text-xs text-cb-muted ml-2 flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Updating nutrition...
                  </span>
                )}
              </>
            )}
          </div>
          {/* Servings scaler for shopping */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-cb-secondary">Scale for shopping</span>
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
            {servings !== recipe.servings && (
              <button
                onClick={() => setServings(recipe.servings)}
                className="text-xs text-cb-muted hover:text-cb-primary"
              >
                Reset
              </button>
            )}
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
          </div>
        </div>}

        {!recipe.video_only && <>
        {/* Version tab switcher - only for users who have saved this recipe */}
        {personalVersions.length > 0 && recipe && (
          <VersionTabSwitcher
            original={recipe}
            versions={personalVersions}
            currentVersionId={currentVersionId}
            onVersionChange={handleVersionChange}
            onRename={handleRenameVersion}
            onDelete={handleDeleteVersion}
            onPromote={handlePromoteVersion}
            canCreateMore={canCreateMoreVersions}
          />
        )}

        {/* Ask Sous Chef button */}
        {userHasSaved && !isOwner && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAskSousChef(true)}
              className="bg-cb-primary text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium text-sm"
            >
              + Ask Sous Chef
            </button>
          </div>
        )}

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
                    {group.items.map((ing) => {
                      const scaled = scaleQuantity(ing.quantity, originalServings, servings);
                      const converted = convertIngredient(scaled, ing.unit, unitSystem, ing.ingredient);
                      return (
                      <tr key={ing.id} className="border-b border-cb-border/50 last:border-b-0">
                        <td className="py-2 pr-3 text-right align-top w-16 text-cb-primary font-semibold tabular-nums whitespace-nowrap">
                          {formatQuantity(converted.quantity)}
                        </td>
                        <td className="py-2 pr-3 align-top w-20 text-cb-secondary text-sm whitespace-nowrap">
                          {converted.unit}
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
                      );
                    })}
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

        {/* Nutrition Facts */}
        <NutritionCard
          recipeId={recipe.id}
          nutrition={(recipe as any).nutrition}
          isOwner={isOwner}
          servings={recipe.servings}
        />

        {/* Notes */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-cb-border">
            <h2 className="text-xl font-bold">Notes</h2>
            {isOwner && !editingNotes && (
              <button onClick={() => setEditingNotes(true)} className="text-xs text-cb-primary hover:underline">Edit</button>
            )}
          </div>
          {editingNotes ? (
            <div>
              <textarea
                defaultValue={recipe.notes ?? ''}
                autoFocus
                rows={4}
                className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary mb-2"
                id="notes-textarea"
              />
              <div className="flex items-center gap-2">
                <span className="flex-1" />
                <button onClick={() => setEditingNotes(false)} className="text-sm text-cb-secondary hover:text-cb-text">Cancel</button>
                <button onClick={() => {
                  const textarea = document.getElementById('notes-textarea') as HTMLTextAreaElement;
                  if (textarea) saveNotes(textarea.value);
                }} disabled={saving} className="bg-cb-primary text-white px-4 py-1.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (displayNotes || recipe.notes) ? (
            <p className="text-cb-secondary leading-relaxed">
              {displayNotes}
            </p>
          ) : isOwner ? (
            <p className="text-cb-secondary text-sm italic">No notes yet. Click Edit to add some.</p>
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
            <h3 className="text-lg font-semibold mb-2">{cloned ? 'Saved!' : 'Like this recipe?'}</h3>
            <p className="text-cb-secondary text-sm mb-4">
              {cloned
                ? 'This recipe has been added to your collection.'
                : isLoggedIn
                ? 'Save it to your Chefsbook and never lose a recipe again.'
                : 'Sign up to save recipes, plan meals, and generate shopping lists.'}
            </p>
            {cloned ? (
              <Link href="/dashboard" className="inline-block bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity">
                View My Recipes
              </Link>
            ) : isLoggedIn ? (
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user || !recipe) return;
                  setCloning(true);
                  try {
                    await saveRecipe(recipe.id, user.id);
                    setCloned(true);
                  } catch (e: any) {
                    showAlert({ title: 'Error', body: e.message ?? 'Failed to save recipe' });
                  }
                  setCloning(false);
                }}
                disabled={cloning}
                className="inline-block bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {cloning ? 'Saving...' : 'Add to my Chefsbook'}
              </button>
            ) : (
              <Link href="/auth" className="inline-block bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity">
                Sign up to save this recipe
              </Link>
            )}
          </div>
        )}
      </article>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">
              {isAdmin && !isOwner ? 'Permanently delete this recipe?' : 'Delete recipe?'}
            </h2>
            <p className="text-cb-secondary text-sm mb-6">
              {isAdmin && !isOwner ? (
                <>
                  This will permanently delete &ldquo;{recipe.title}&rdquo; and remove it from{' '}
                  {(recipe.save_count ?? 0) > 0
                    ? `${recipe.save_count} member${(recipe.save_count ?? 0) === 1 ? '' : 's'} who ${(recipe.save_count ?? 0) === 1 ? 'has' : 'have'} saved it`
                    : 'all collections'}.
                  This cannot be undone.
                </>
              ) : (
                <>This will permanently delete &ldquo;{recipe.title}&rdquo;. This cannot be undone.</>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(isAdmin && !isOwner)}
                disabled={deleting}
                className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : isAdmin && !isOwner ? 'Delete permanently' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Savers block dialog - shown when owner tries to delete a recipe others have saved */}
      {showSaversBlockDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">This recipe can&apos;t be deleted</h2>
            <p className="text-cb-secondary text-sm mb-6">
              {blockedSaverCount} member{blockedSaverCount === 1 ? ' has' : 's have'} saved this recipe to their collection.
              You can make it private so it no longer appears in search, but it will remain available to those who&apos;ve saved it.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSaversBlockDialog(false)}
                className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text"
              >
                Keep it
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateRecipe(id, { visibility: 'private' });
                    if (recipe) setRecipe({ ...recipe, visibility: 'private' });
                    setShowSaversBlockDialog(false);
                    showAlert({ title: 'Recipe is now private', body: 'This recipe is no longer visible in public search but remains available to those who saved it.' });
                  } catch (e: any) {
                    showAlert({ title: 'Update failed', body: e?.message ?? 'Please try again.' });
                  }
                }}
                className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Make it private
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Remove from My Recipes?</h2>
            <p className="text-cb-secondary text-sm mb-6">
              This will remove the recipe from your My Recipes but it can always be added again later. Do you want to continue?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="px-4 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text"
              >
                No
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Yes, remove it'}
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
                        className="bg-cb-bg border border-cb-border rounded-card p-3 text-left hover:border-cb-primary hover:bg-cb-primary/5 transition-colors"
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
                      className="border-2 border-dashed border-cb-border rounded-card p-3 text-center hover:border-cb-primary transition-colors"
                    >
                      <svg className="w-5 h-5 text-cb-secondary mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      <p className="text-xs text-cb-secondary">New list</p>
                    </button>
                  </div>
                )}
                {shoppingLists.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-cb-secondary text-sm mb-3">No shopping lists yet</p>
                    <button onClick={() => setShowNewListForm(true)} className="bg-cb-primary text-white px-5 py-2 rounded-input text-sm font-semibold hover:opacity-90">Create your first list</button>
                  </div>
                )}
              </>
            ) : (
              <StorePickerDialog
                onCreated={async (listId) => {
                  setShowNewListForm(false);
                  const lists = await listShoppingLists(recipe.user_id);
                  setShoppingLists(lists);
                  await handleAddToShoppingList(listId);
                }}
                onCancel={() => setShowNewListForm(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      {recipe && (
        <div data-print-comments className="max-w-3xl mx-auto px-4 mb-8">
          <RecipeComments recipeId={recipe.id} recipeOwnerId={recipe.user_id} recipeTitle={recipe.title} commentsEnabled={recipe.comments_enabled ?? true} />
        </div>
      )}

      {/* Social Share Modal */}
      {showMealPicker && recipe && (
        <MealPlanPicker recipeId={recipe.id} recipeServings={recipe.servings ?? 4} onClose={() => setShowMealPicker(false)} />
      )}

      {recipe && (
        <AddToMenuModal
          recipeIds={[recipe.id]}
          open={showAddToMenu}
          onClose={() => setShowAddToMenu(false)}
          onSuccess={(menu, course) => {
            setMenuAddSuccess({ menu, course });
            setTimeout(() => setMenuAddSuccess(null), 3000);
          }}
        />
      )}

      {menuAddSuccess && (
        <div className="fixed bottom-4 right-4 bg-cb-green text-white px-4 py-2 rounded-input shadow-lg z-50 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Added to {menuAddSuccess.menu} — {menuAddSuccess.course}
        </div>
      )}

      {showSocialShare && recipe && (
        <SocialShareModal recipe={recipe} onClose={() => setShowSocialShare(false)} />
      )}

      {/* Savers modal */}
      {showSavers && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowSavers(false)}>
          <div className="bg-cb-card rounded-card p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-cb-text">{(recipe?.save_count ?? 0) === 1 ? '1 person saved this' : `${recipe?.save_count ?? 0} people saved this`}</h3>
              <button onClick={() => setShowSavers(false)} className="text-cb-muted hover:text-cb-text">✕</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {saversError && <p className="text-sm text-cb-primary text-center py-4">{saversError}</p>}
              {saversLoading && <p className="text-sm text-cb-muted text-center py-4">Loading...</p>}
              {!saversLoading && !saversError && savers.map((u) => (
                <Link key={u.id} href={`/dashboard/chef/${u.username ?? u.id}`} className="flex items-center gap-3 py-2 hover:bg-cb-bg rounded-input px-2 transition" onClick={() => setShowSavers(false)}>
                  <div className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {u.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cb-text truncate">@{u.username ?? '?'}</p>
                    {u.display_name && <p className="text-xs text-cb-muted truncate">{u.display_name}</p>}
                  </div>
                </Link>
              ))}
              {!saversLoading && !saversError && savers.length === 0 && <p className="text-sm text-cb-muted text-center py-4">No savers found</p>}
            </div>
          </div>
        </div>
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
      {/* Print options modal */}
      {showPrintOptions && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center print:hidden" onClick={() => setShowPrintOptions(false)}>
          <div className="bg-cb-card rounded-card p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-cb-text mb-4">Print Options</h3>
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input type="checkbox" checked={printIncludeImage} onChange={(e) => setPrintIncludeImage(e.target.checked)} className="w-4 h-4 rounded accent-cb-primary" />
              <span className="text-sm text-cb-text">Include recipe image</span>
            </label>
            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <input type="checkbox" checked={printIncludeComments} onChange={(e) => setPrintIncludeComments(e.target.checked)} className="w-4 h-4 rounded accent-cb-primary" />
              <span className="text-sm text-cb-text">Include comments</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowPrintOptions(false)} className="flex-1 py-2 rounded-input text-sm font-medium border border-cb-border text-cb-secondary hover:bg-cb-bg">Cancel</button>
              <button
                onClick={() => {
                  setShowPrintOptions(false);
                  // Apply CSS classes to hide sections
                  if (!printIncludeImage) document.querySelector('[data-print-hero]')?.classList.add('print-hide');
                  if (!printIncludeComments) document.querySelector('[data-print-comments]')?.classList.add('print-hide');
                  setTimeout(() => {
                    window.print();
                    // Restore after print
                    setTimeout(() => {
                      document.querySelector('[data-print-hero]')?.classList.remove('print-hide');
                      document.querySelector('[data-print-comments]')?.classList.remove('print-hide');
                    }, 500);
                  }, 100);
                }}
                className="flex-1 py-2 rounded-input text-sm font-semibold bg-cb-primary text-white hover:opacity-90"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF options modal */}
      {showPdfOptions && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowPdfOptions(false)}>
          <div className="bg-cb-card rounded-card p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-cb-text mb-4">PDF Options</h3>
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input type="checkbox" checked={pdfIncludeImage} onChange={(e) => setPdfIncludeImage(e.target.checked)} className="w-4 h-4 rounded accent-cb-primary" />
              <span className="text-sm text-cb-text">Include recipe image</span>
            </label>
            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <input type="checkbox" checked={pdfIncludeComments} onChange={(e) => setPdfIncludeComments(e.target.checked)} className="w-4 h-4 rounded accent-cb-primary" />
              <span className="text-sm text-cb-text">Include comments</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setShowPdfOptions(false)} className="flex-1 py-2 rounded-input text-sm font-medium border border-cb-border text-cb-secondary hover:bg-cb-bg">Cancel</button>
              <button
                onClick={async () => {
                  setShowPdfOptions(false);
                  setDownloadingPdf(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) { showAlert({ title: 'PDF Export', body: 'Please sign in to download PDFs.' }); return; }
                    const params = new URLSearchParams();
                    if (!pdfIncludeImage) params.set('includeImage', 'false');
                    if (!pdfIncludeComments) params.set('includeComments', 'false');
                    const qs = params.toString() ? `?${params.toString()}` : '';
                    const res = await fetch(`/recipe/${recipe.id}/pdf${qs}`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (!res.ok) {
                      if (res.status === 403) showAlert({ title: 'PDF Export', body: 'PDF export requires the Pro plan.' });
                      else showAlert({ title: 'PDF Export', body: 'PDF generation failed. Please try again.' });
                      return;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const safeTitle = recipe.title.replace(/[/\\?%*:|"<>]/g, '-');
                    a.download = `ChefsBook - ${safeTitle}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {
                    showAlert({ title: 'PDF Export', body: 'PDF generation failed. Please try again.' });
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                disabled={downloadingPdf}
                className="flex-1 py-2 rounded-input text-sm font-semibold bg-cb-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {downloadingPdf ? 'Your Sous Chef is working on it...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Image Lightbox */}
      <RecipeLightbox
        images={(() => {
          const images: string[] = [];
          // Add user photos first
          if (userPhotos.length > 0) {
            images.push(...userPhotos.map(p => proxyIfNeeded(p.url)));
          }
          // Add original image_url if it exists and isn't already in the array
          if (recipe.image_url) {
            const proxiedImageUrl = proxyIfNeeded(recipe.image_url);
            if (!images.includes(proxiedImageUrl)) {
              // Only add if it's not the same as the first user photo
              if (userPhotos.length === 0 || userPhotos[0].url !== recipe.image_url) {
                images.push(proxiedImageUrl);
              }
            }
          }
          return images;
        })()}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Ask Sous Chef Modal */}
      {recipe && (
        <AskSousChefModal
          isOpen={showAskSousChef}
          onClose={() => setShowAskSousChef(false)}
          original={recipe}
          versions={personalVersions}
          onSave={handleSaveVersion}
        />
      )}
    </main>
  );
}
