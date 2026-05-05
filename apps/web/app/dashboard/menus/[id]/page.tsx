'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  supabase,
  getMenu,
  updateMenu,
  deleteMenu,
  addMenuItem,
  removeMenuItem,
  updateMenuItem,
  reorderMenuItems,
  listRecipes,
  getPrimaryPhotos,
  listShoppingLists,
  createShoppingList,
} from '@chefsbook/db';
import type { MenuWithItems, MenuCourse, Recipe, ShoppingList } from '@chefsbook/db';
import { COURSE_ORDER, COURSE_LABELS } from '@chefsbook/db';
import { addIngredientsToList } from '@/lib/addToShoppingList';
import { useConfirmDialog, useAlertDialog } from '@/components/useConfirmDialog';
import ChefsDialog from '@/components/ChefsDialog';
import { proxyIfNeeded, CHEFS_HAT_URL, getRecipeImageUrl } from '@/lib/recipeImage';

const OCCASIONS = [
  { value: '', label: 'None' },
  { value: 'dinner_party', label: 'Dinner Party' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'special_occasion', label: 'Special Occasion' },
  { value: 'everyday', label: 'Everyday' },
  { value: 'custom', label: 'Custom' },
];

export default function MenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: menuId } = use(params);
  const router = useRouter();
  const [menu, setMenu] = useState<MenuWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublicNotes, setEditPublicNotes] = useState('');
  const [editPrivateNotes, setEditPrivateNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Add recipe modal
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [addToCourse, setAddToCourse] = useState<MenuCourse>('main');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [servingsOverride, setServingsOverride] = useState<number | null>(null);
  const [addingRecipe, setAddingRecipe] = useState(false);

  // Share state
  const [isPublic, setIsPublic] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Shopping list modal
  const [showShopPicker, setShowShopPicker] = useState(false);
  const [shopLists, setShopLists] = useState<ShoppingList[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [addingToShop, setAddingToShop] = useState(false);

  // Cookbook picker modal
  const [showCookbookPicker, setShowCookbookPicker] = useState(false);
  const [printCookbooks, setPrintCookbooks] = useState<{ id: string; title: string; recipe_ids: string[] }[]>([]);
  const [cookbooksLoading, setCookbooksLoading] = useState(false);
  const [addingToCookbook, setAddingToCookbook] = useState(false);
  const [cookbookToast, setCookbookToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Cook mode
  const [showCookMode, setShowCookMode] = useState(false);

  // Move recipe state
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [moveFromCourse, setMoveFromCourse] = useState<MenuCourse | null>(null);
  const [movingItem, setMovingItem] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadMenu();
        loadRecipes(session.user.id);
      }
    });
  }, [menuId]);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const data = await getMenu(menuId);
      setMenu(data);
      if (data) {
        setIsPublic(data.is_public);
        const recipeIds = data.menu_items.map((i) => i.recipe_id);
        if (recipeIds.length > 0) {
          const photos = await getPrimaryPhotos(recipeIds);
          setPrimaryPhotos(photos);
        }
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
    }
    setLoading(false);
  };

  const loadRecipes = async (uid: string) => {
    setRecipesLoading(true);
    try {
      const data = await listRecipes({ userId: uid });
      setRecipes(data);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    }
    setRecipesLoading(false);
  };

  const openEditModal = () => {
    if (!menu) return;
    setEditTitle(menu.title);
    setEditOccasion(menu.occasion ?? '');
    setEditDescription(menu.description ?? '');
    setEditPublicNotes(menu.public_notes ?? '');
    setEditPrivateNotes(menu.private_notes ?? '');
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      await updateMenu(menuId, {
        title: editTitle.trim(),
        occasion: editOccasion || null,
        description: editDescription.trim() || null,
        public_notes: editPublicNotes.trim() || null,
        private_notes: editPrivateNotes.trim() || null,
      });
      setShowEdit(false);
      loadMenu();
    } catch (err) {
      console.error('Failed to update menu:', err);
    }
    setEditSaving(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete "${menu?.title}"?`,
      body: 'Your recipes will not be deleted — they stay in My Recipes. Only this menu grouping will be removed.',
      confirmLabel: 'Delete Menu',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    try {
      await deleteMenu(menuId);
      router.push('/dashboard/menus');
    } catch (err) {
      console.error('Failed to delete menu:', err);
    }
  };

  const openAddRecipeModal = (course: MenuCourse) => {
    setAddToCourse(course);
    setSelectedRecipe(null);
    setServingsOverride(null);
    setRecipeSearch('');
    setShowAddRecipe(true);
  };

  const handleAddRecipe = async () => {
    if (!selectedRecipe || !menu) return;
    setAddingRecipe(true);
    try {
      const courseItems = menu.menu_items.filter((i) => i.course === addToCourse);
      const nextOrder = courseItems.length;
      await addMenuItem(menuId, selectedRecipe.id, addToCourse, nextOrder, servingsOverride);
      setShowAddRecipe(false);
      loadMenu();
    } catch (err) {
      console.error('Failed to add recipe:', err);
    }
    setAddingRecipe(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeMenuItem(itemId);
      loadMenu();
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  const toggleShare = async () => {
    setSharingLoading(true);
    try {
      await updateMenu(menuId, { is_public: !isPublic });
      setIsPublic(!isPublic);
    } catch (err) {
      console.error('Failed to toggle share:', err);
    }
    setSharingLoading(false);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/menu/${menuId}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const openShopPicker = async () => {
    if (!userId) return;
    setShopLoading(true);
    try {
      const lists = await listShoppingLists(userId);
      setShopLists(lists);
    } catch (err) {
      console.error('Failed to load shopping lists:', err);
    }
    setShopLoading(false);
    setShowShopPicker(true);
  };

  const handleAddToShoppingList = async (listId: string) => {
    if (!menu) return;
    setAddingToShop(true);
    try {
      const allIngredients: { ingredient: string; quantity: number | null; unit: string | null; recipeTitle: string }[] = [];
      for (const item of menu.menu_items) {
        const fullRecipe = await supabase
          .from('recipes')
          .select('*, recipe_ingredients(*)')
          .eq('id', item.recipe_id)
          .single();
        if (fullRecipe.data?.recipe_ingredients) {
          const servingsMultiplier = item.servings_override
            ? item.servings_override / (fullRecipe.data.servings || 4)
            : 1;
          for (const ing of fullRecipe.data.recipe_ingredients) {
            allIngredients.push({
              ingredient: ing.ingredient,
              quantity: ing.quantity ? ing.quantity * servingsMultiplier : null,
              unit: ing.unit,
              recipeTitle: fullRecipe.data.title,
            });
          }
        }
      }
      await addIngredientsToList(listId, allIngredients);
      setShowShopPicker(false);
      showAlert({ title: 'Added to list', body: `${allIngredients.length} ingredients added.` });
    } catch (err) {
      console.error('Failed to add to shopping list:', err);
    }
    setAddingToShop(false);
  };

  const openCookbookPicker = async () => {
    setCookbooksLoading(true);
    setShowCookbookPicker(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/print-cookbooks', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const { cookbooks } = await res.json();
        setPrintCookbooks(cookbooks ?? []);
      }
    } catch (err) {
      console.error('Failed to load cookbooks:', err);
    }
    setCookbooksLoading(false);
  };

  const handleAddToCookbook = async (cookbookId: string, cookbookTitle: string) => {
    if (!menu) return;
    setAddingToCookbook(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/print-cookbooks/${cookbookId}/add-menu`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ menu_id: menu.id }),
      });
      const data = await res.json();
      setShowCookbookPicker(false);
      if (data.already_exists) {
        setCookbookToast({ message: `Already in ${cookbookTitle}`, type: 'info' });
      } else if (data.success) {
        setCookbookToast({ message: `${menu.title} added to ${cookbookTitle}`, type: 'success' });
      }
      setTimeout(() => setCookbookToast(null), 3000);
    } catch (err) {
      console.error('Failed to add to cookbook:', err);
    }
    setAddingToCookbook(false);
  };

  const getOccasionLabel = (value: string | null) => {
    if (!value) return null;
    return OCCASIONS.find((o) => o.value === value)?.label ?? value;
  };

  const openMovePopover = (itemId: string, currentCourse: MenuCourse) => {
    setMoveItemId(itemId);
    setMoveFromCourse(currentCourse);
  };

  const handleMoveToCourse = async (newCourse: MenuCourse) => {
    if (!moveItemId || !moveFromCourse) return;
    setMovingItem(true);
    try {
      await updateMenuItem(moveItemId, { course: newCourse });
      setMoveItemId(null);
      setMoveFromCourse(null);
      loadMenu();
    } catch (err) {
      console.error('Failed to move recipe:', err);
      showAlert({ title: 'Error', body: 'Failed to move recipe. Please try again.' });
    }
    setMovingItem(false);
  };

  const filteredRecipes = recipes.filter((r) =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const itemsByCourse = COURSE_ORDER.reduce((acc, course) => {
    acc[course] = menu?.menu_items.filter((i) => i.course === course).sort((a, b) => a.sort_order - b.sort_order) ?? [];
    return acc;
  }, {} as Record<MenuCourse, MenuWithItems['menu_items']>);

  const usedCourses = COURSE_ORDER.filter((c) => itemsByCourse[c].length > 0);
  const availableCourses = COURSE_ORDER.filter((c) => itemsByCourse[c].length === 0);

  if (loading) {
    return <div className="p-8"><p className="text-cb-secondary">Loading...</p></div>;
  }

  if (!menu) {
    return (
      <div className="p-8">
        <p className="text-cb-secondary">Menu not found</p>
        <Link href="/dashboard/menus" className="text-cb-primary hover:underline mt-4 inline-block">← Back to menus</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/dashboard/menus" className="text-cb-primary hover:underline text-sm mb-4 inline-block">← Back to menus</Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-cb-text">{menu.title}</h1>
            {menu.occasion && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium bg-cb-primary-soft text-cb-primary">
                {getOccasionLabel(menu.occasion)}
              </span>
            )}
            {menu.description && (
              <p className="text-cb-secondary mt-2">{menu.description}</p>
            )}
            {(menu.public_notes || menu.private_notes) && (
              <div className="mt-4 space-y-3">
                {menu.public_notes && (
                  <div className="p-3 bg-cb-base border border-cb-border rounded-input">
                    <p className="text-xs font-medium text-cb-muted mb-1">Notes</p>
                    <p className="text-sm text-cb-text">{menu.public_notes}</p>
                  </div>
                )}
                {menu.private_notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-input">
                    <p className="text-xs font-medium text-amber-700 mb-1">Private Notes 🔒</p>
                    <p className="text-sm text-cb-text">{menu.private_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={openEditModal}
            className="text-cb-secondary hover:text-cb-primary transition p-2"
            title="Edit menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={toggleShare}
            disabled={sharingLoading}
            className={`px-4 py-2 rounded-input text-sm font-medium transition flex items-center gap-2 ${isPublic ? 'bg-cb-green text-white' : 'border border-cb-border text-cb-secondary hover:border-cb-primary hover:text-cb-primary'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
            {isPublic ? 'Public' : 'Share'}
          </button>
          {isPublic && (
            <button
              onClick={copyShareLink}
              className="px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition flex items-center gap-2"
            >
              {copySuccess ? '✓ Copied!' : 'Copy Link'}
            </button>
          )}
          <button
            onClick={openShopPicker}
            className="px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            Add to Shopping
          </button>
          <button
            onClick={openCookbookPicker}
            className="px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Add to Cookbook
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-red-500 hover:border-red-500 transition"
          >
            Delete
          </button>
          {menu.menu_items.length > 0 && (
            <button
              onClick={() => router.push(`/dashboard/menus/${menuId}/cook`)}
              className="px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
              </svg>
              Start Cooking
            </button>
          )}
        </div>
      </div>

      {/* Course sections */}
      {usedCourses.map((course) => (
        <div key={course} className="mb-6">
          <h2 className="text-lg font-bold text-cb-text mb-3">{COURSE_LABELS[course]}</h2>
          <div className="space-y-3">
            {itemsByCourse[course].map((item) => {
              const imgUrl = getRecipeImageUrl(primaryPhotos[item.recipe_id], item.recipe?.image_url, null);
              return (
                <div key={item.id} className="flex items-center gap-4 bg-cb-card border border-cb-border rounded-card p-3 group">
                  <Link href={`/recipe/${item.recipe_id}`} className="shrink-0">
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-20 h-14 rounded-input object-cover" />
                    ) : (
                      <div className="w-20 h-14 rounded-input bg-cb-bg flex items-center justify-center">
                        <img src={CHEFS_HAT_URL} alt="" className="w-8 h-8 object-contain opacity-30" />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/recipe/${item.recipe_id}`} className="font-medium text-cb-text hover:text-cb-primary transition truncate block">
                      {item.recipe?.title ?? 'Recipe'}
                    </Link>
                    <div className="text-xs text-cb-secondary mt-1">
                      {item.recipe?.prep_minutes || item.recipe?.cook_minutes ? (
                        <span>
                          {item.recipe.prep_minutes ? `${item.recipe.prep_minutes}m prep` : ''}
                          {item.recipe.prep_minutes && item.recipe.cook_minutes ? ' · ' : ''}
                          {item.recipe.cook_minutes ? `${item.recipe.cook_minutes}m cook` : ''}
                        </span>
                      ) : null}
                      {item.servings_override && (
                        <span className="ml-2">· {item.servings_override} servings</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openMovePopover(item.id, course)}
                    className="text-cb-secondary hover:text-cb-primary transition p-2 opacity-0 group-hover:opacity-100 flex items-center gap-1"
                    title="Move to different course"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    <span className="text-xs font-medium">Move</span>
                  </button>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-cb-muted hover:text-red-500 transition p-2 opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => openAddRecipeModal(course)}
            className="mt-3 w-full py-2 border-2 border-dashed border-cb-border rounded-input text-sm text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add recipe to {COURSE_LABELS[course]}
          </button>
        </div>
      ))}

      {/* Add a course */}
      {availableCourses.length > 0 && (
        <div className="mt-8">
          <p className="text-sm text-cb-muted mb-2">Add a course:</p>
          <div className="flex flex-wrap gap-2">
            {availableCourses.map((course) => (
              <button
                key={course}
                onClick={() => openAddRecipeModal(course)}
                className="px-3 py-1.5 border border-cb-border rounded-full text-sm text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition"
              >
                + {COURSE_LABELS[course]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <ChefsDialog open={showEdit} onClose={() => setShowEdit(false)} title="Edit Menu">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Title *</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, 80))}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
              maxLength={80}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Occasion</label>
            <select
              value={editOccasion}
              onChange={(e) => setEditOccasion(e.target.value)}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
            >
              {OCCASIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, 200))}
              rows={2}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Notes</label>
            <p className="text-xs text-cb-muted mb-1">Visible to anyone you share this menu with</p>
            <textarea
              value={editPublicNotes}
              onChange={(e) => setEditPublicNotes(e.target.value)}
              rows={2}
              placeholder="e.g. This menu works beautifully for a dinner party of 6"
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cb-text mb-1">Private Notes 🔒</label>
            <p className="text-xs text-cb-muted mb-1">Only visible to you — never shared</p>
            <textarea
              value={editPrivateNotes}
              onChange={(e) => setEditPrivateNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Start the risotto 30 min before guests arrive"
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none bg-amber-50"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowEdit(false)} className="flex-1 px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:bg-cb-bg transition">
            Cancel
          </button>
          <button onClick={handleSaveEdit} disabled={editSaving || !editTitle.trim()} className="flex-1 px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {editSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </ChefsDialog>

      {/* Add Recipe Modal */}
      <ChefsDialog open={showAddRecipe} onClose={() => setShowAddRecipe(false)} title={`Add to ${COURSE_LABELS[addToCourse]}`}>
        <div className="space-y-4">
          <input
            type="text"
            value={recipeSearch}
            onChange={(e) => setRecipeSearch(e.target.value)}
            placeholder="Search your recipes..."
            className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
          />
          <div className="max-h-64 overflow-y-auto border border-cb-border rounded-input">
            {recipesLoading ? (
              <p className="p-4 text-cb-secondary text-sm">Loading...</p>
            ) : filteredRecipes.length === 0 ? (
              <p className="p-4 text-cb-secondary text-sm">No recipes found</p>
            ) : (
              filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-cb-bg transition flex items-center gap-3 ${selectedRecipe?.id === recipe.id ? 'bg-cb-primary-soft' : ''}`}
                >
                  <span className="flex-1 truncate">{recipe.title}</span>
                  {selectedRecipe?.id === recipe.id && <span className="text-cb-primary">✓</span>}
                </button>
              ))
            )}
          </div>
          {selectedRecipe && (
            <div>
              <label className="block text-sm font-medium text-cb-text mb-1">Servings override (optional)</label>
              <input
                type="number"
                value={servingsOverride ?? ''}
                onChange={(e) => setServingsOverride(e.target.value ? parseInt(e.target.value) : null)}
                placeholder={`Default: ${selectedRecipe.servings ?? 4}`}
                className="w-full border border-cb-border rounded-input px-3 py-2 text-sm"
                min={1}
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setShowAddRecipe(false)} className="flex-1 px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:bg-cb-bg transition">
            Cancel
          </button>
          <button onClick={handleAddRecipe} disabled={addingRecipe || !selectedRecipe} className="flex-1 px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {addingRecipe ? 'Adding...' : 'Add'}
          </button>
        </div>
      </ChefsDialog>

      {/* Shopping List Picker */}
      <ChefsDialog open={showShopPicker} onClose={() => setShowShopPicker(false)} title="Add to Shopping List">
        <div className="max-h-64 overflow-y-auto">
          {shopLoading ? (
            <p className="p-4 text-cb-secondary text-sm">Loading...</p>
          ) : shopLists.length === 0 ? (
            <p className="p-4 text-cb-secondary text-sm">No shopping lists. Create one first.</p>
          ) : (
            shopLists.map((list) => (
              <button
                key={list.id}
                onClick={() => handleAddToShoppingList(list.id)}
                disabled={addingToShop}
                className="w-full text-left px-4 py-3 text-sm hover:bg-cb-bg transition border-b border-cb-border last:border-0"
              >
                {list.name}
              </button>
            ))
          )}
        </div>
      </ChefsDialog>

      {/* Cookbook Picker */}
      <ChefsDialog open={showCookbookPicker} onClose={() => setShowCookbookPicker(false)} title="Add to Cookbook">
        <div className="max-h-64 overflow-y-auto">
          {cookbooksLoading ? (
            <p className="p-4 text-cb-secondary text-sm">Loading...</p>
          ) : printCookbooks.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-cb-secondary text-sm mb-4">No print cookbooks yet.</p>
              <a
                href="/dashboard/print-cookbook/new"
                className="text-cb-primary hover:underline text-sm font-medium"
              >
                + Create new cookbook
              </a>
            </div>
          ) : (
            <>
              {printCookbooks.map((cb) => (
                <button
                  key={cb.id}
                  onClick={() => handleAddToCookbook(cb.id, cb.title)}
                  disabled={addingToCookbook}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-cb-bg transition border-b border-cb-border last:border-0 flex justify-between items-center"
                >
                  <span>{cb.title}</span>
                  <span className="text-xs text-cb-muted">{cb.recipe_ids?.length ?? 0} recipes</span>
                </button>
              ))}
              <a
                href="/dashboard/print-cookbook/new"
                className="block px-4 py-3 text-sm text-cb-primary hover:bg-cb-bg transition"
              >
                + Create new cookbook
              </a>
            </>
          )}
        </div>
      </ChefsDialog>

      {/* Cookbook Toast */}
      {cookbookToast && (
        <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-card shadow-lg z-50 ${cookbookToast.type === 'success' ? 'bg-cb-green text-white' : 'bg-cb-base border border-cb-border text-cb-text'}`}>
          {cookbookToast.message}
        </div>
      )}

      <ConfirmDialog />
      <AlertDialog />

      {/* Move Recipe Course Selector */}
      <ChefsDialog
        open={!!moveItemId}
        onClose={() => { setMoveItemId(null); setMoveFromCourse(null); }}
        title="Move to Course"
      >
        <div className="space-y-2">
          {COURSE_ORDER.map((course) => {
            const isCurrent = course === moveFromCourse;
            return (
              <button
                key={course}
                onClick={() => !isCurrent && handleMoveToCourse(course)}
                disabled={isCurrent || movingItem}
                className={`w-full text-left px-4 py-3 rounded-input text-sm font-medium transition ${
                  isCurrent
                    ? 'bg-cb-bg text-cb-muted cursor-not-allowed opacity-60'
                    : 'bg-cb-card border border-cb-border hover:border-cb-primary hover:bg-cb-primary-soft'
                }`}
              >
                {COURSE_LABELS[course]}
                {isCurrent && <span className="ml-2 text-xs">(current)</span>}
              </button>
            );
          })}
        </div>
      </ChefsDialog>

      {/* Cook Mode Timeline Panel */}
      {showCookMode && (
        <CookModeTimeline
          menu={menu}
          primaryPhotos={primaryPhotos}
          onClose={() => setShowCookMode(false)}
        />
      )}
    </div>
  );
}

interface CookModeTimelineProps {
  menu: MenuWithItems;
  primaryPhotos: Record<string, string>;
  onClose: () => void;
}

function CookModeTimeline({ menu, primaryPhotos, onClose }: CookModeTimelineProps) {
  const [serveTime, setServeTime] = useState<string>('');
  const [checkedRecipes, setCheckedRecipes] = useState<Set<string>>(new Set());
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [recipeDetails, setRecipeDetails] = useState<Record<string, { ingredients: any[]; steps: any[] }>>({});

  const timelineRecipes = useMemo(() => {
    return menu.menu_items
      .map((item) => ({
        id: item.recipe_id,
        title: item.recipe?.title ?? 'Recipe',
        course: item.course,
        prepMinutes: item.recipe?.prep_minutes ?? 0,
        cookMinutes: item.recipe?.cook_minutes ?? 0,
        totalMinutes: (item.recipe?.prep_minutes ?? 0) + (item.recipe?.cook_minutes ?? 0),
        imageUrl: getRecipeImageUrl(primaryPhotos[item.recipe_id], item.recipe?.image_url, null),
        servingsOverride: item.servings_override,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [menu.menu_items, primaryPhotos]);

  const maxTotalMinutes = Math.max(...timelineRecipes.map((r) => r.totalMinutes), 1);

  useEffect(() => {
    const loadRecipeDetails = async () => {
      const recipeIds = timelineRecipes.map((r) => r.id);
      if (recipeIds.length === 0) return;

      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, ingredient, quantity, unit')
        .in('recipe_id', recipeIds);

      const { data: steps } = await supabase
        .from('recipe_steps')
        .select('recipe_id, step_number, instruction')
        .in('recipe_id', recipeIds)
        .order('step_number');

      const details: Record<string, { ingredients: any[]; steps: any[] }> = {};
      for (const id of recipeIds) {
        details[id] = {
          ingredients: (ingredients ?? []).filter((i) => i.recipe_id === id),
          steps: (steps ?? []).filter((s) => s.recipe_id === id),
        };
      }
      setRecipeDetails(details);
    };
    loadRecipeDetails();
  }, [timelineRecipes]);

  const toggleCheck = (recipeId: string) => {
    setCheckedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });
  };

  const getStartOffset = (recipe: typeof timelineRecipes[0]): number => {
    return maxTotalMinutes - recipe.totalMinutes;
  };

  const formatStartLabel = (recipe: typeof timelineRecipes[0]): string | null => {
    if (!serveTime) return null;
    const offset = getStartOffset(recipe);
    if (offset === 0) return 'Start now';
    return `Start ${offset} min before`;
  };

  const allChecked = timelineRecipes.length > 0 && checkedRecipes.size === timelineRecipes.length;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-cb-bg shadow-xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cb-border bg-cb-card">
          <div>
            <h2 className="text-lg font-bold text-cb-text">{menu.title}</h2>
            <p className="text-sm text-cb-secondary">Cooking Timeline</p>
          </div>
          <button onClick={onClose} className="p-2 text-cb-muted hover:text-cb-text transition">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Serve time picker */}
        <div className="p-4 border-b border-cb-border bg-cb-card">
          <label className="block text-sm font-medium text-cb-text mb-2">Serve at (optional)</label>
          <input
            type="time"
            value={serveTime}
            onChange={(e) => setServeTime(e.target.value)}
            className="border border-cb-border rounded-input px-3 py-2 text-sm w-40"
          />
          {serveTime && (
            <button onClick={() => setServeTime('')} className="ml-2 text-cb-secondary hover:text-cb-primary text-sm">
              Clear
            </button>
          )}
        </div>

        {/* Recipe timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {timelineRecipes.map((recipe) => {
            const isExpanded = expandedRecipeId === recipe.id;
            const isChecked = checkedRecipes.has(recipe.id);
            const startLabel = formatStartLabel(recipe);
            const barWidth = recipe.totalMinutes > 0 ? (recipe.totalMinutes / maxTotalMinutes) * 100 : 0;
            const prepWidth = recipe.totalMinutes > 0 ? (recipe.prepMinutes / recipe.totalMinutes) * 100 : 0;
            const details = recipeDetails[recipe.id];

            return (
              <div key={recipe.id} className="bg-cb-card border border-cb-border rounded-card overflow-hidden">
                <button
                  onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                  className="w-full p-4 flex items-start gap-4 text-left hover:bg-cb-bg/50 transition"
                >
                  {/* Recipe image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-cb-bg flex-shrink-0">
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <img src={CHEFS_HAT_URL} alt="" className="w-6 h-6 opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Recipe info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-cb-text truncate">{recipe.title}</span>
                      {startLabel && (
                        <span className="text-xs font-medium text-cb-primary whitespace-nowrap">{startLabel}</span>
                      )}
                    </div>

                    {recipe.totalMinutes > 0 ? (
                      <>
                        <p className="text-xs text-cb-secondary mt-1">
                          Prep: {recipe.prepMinutes}m · Cook: {recipe.cookMinutes}m
                        </p>
                        {/* Time bar */}
                        <div className="h-2 bg-cb-bg rounded-full mt-2 overflow-hidden" style={{ width: `${barWidth}%` }}>
                          <div className="h-full flex">
                            <div className="bg-cb-primary" style={{ width: `${prepWidth}%` }} />
                            <div className="bg-amber-400 flex-1" />
                          </div>
                        </div>
                        <div className="flex gap-4 mt-1">
                          <span className="text-[10px] text-cb-muted flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-cb-primary inline-block" /> Prep
                          </span>
                          <span className="text-[10px] text-cb-muted flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Cook
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-cb-muted mt-1 italic">No time estimate</p>
                    )}
                  </div>

                  <svg
                    className={`w-5 h-5 text-cb-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Expanded details */}
                {isExpanded && details && (
                  <div className="px-4 pb-4 pt-2 border-t border-cb-border">
                    {details.ingredients.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-cb-text mb-2">Ingredients</h4>
                        <ul className="text-xs text-cb-secondary space-y-1">
                          {details.ingredients.slice(0, 5).map((ing, i) => (
                            <li key={i}>• {ing.quantity ?? ''} {ing.unit ?? ''} {ing.ingredient}</li>
                          ))}
                          {details.ingredients.length > 5 && (
                            <li className="italic text-cb-muted">+{details.ingredients.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {details.steps.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-cb-text mb-2">Steps</h4>
                        <ol className="text-xs text-cb-secondary space-y-1">
                          {details.steps.slice(0, 3).map((step) => (
                            <li key={step.step_number}>{step.step_number}. {step.instruction}</li>
                          ))}
                          {details.steps.length > 3 && (
                            <li className="italic text-cb-muted">+{details.steps.length - 3} more steps</li>
                          )}
                        </ol>
                      </div>
                    )}

                    <Link
                      href={`/recipe/${recipe.id}`}
                      className="text-xs font-medium text-cb-primary hover:underline"
                    >
                      Go to recipe →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* All prepped checklist */}
        <div className="p-4 border-t border-cb-border bg-cb-card">
          <h3 className="font-semibold text-cb-text mb-3">All prepped?</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {timelineRecipes.map((recipe) => (
              <label key={recipe.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkedRecipes.has(recipe.id)}
                  onChange={() => toggleCheck(recipe.id)}
                  className="w-4 h-4 rounded border-cb-border text-cb-primary focus:ring-cb-primary"
                />
                <span className="text-sm text-cb-text">{recipe.title} — ready</span>
              </label>
            ))}
          </div>

          {allChecked && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-input text-center">
              <span className="text-green-700 font-medium">You're ready to plate! 🍽</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
