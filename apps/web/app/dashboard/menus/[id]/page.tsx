'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  supabase,
  getMenu,
  updateMenu,
  deleteMenu,
  addMenuItem,
  removeMenuItem,
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
  const [editNotes, setEditNotes] = useState('');
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
    setEditNotes(menu.notes ?? '');
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
        notes: editNotes.trim() || null,
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
      title: 'Delete menu?',
      body: 'This cannot be undone.',
      confirmLabel: 'Delete',
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

  const getOccasionLabel = (value: string | null) => {
    if (!value) return null;
    return OCCASIONS.find((o) => o.value === value)?.label ?? value;
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
            onClick={handleDelete}
            className="px-4 py-2 border border-cb-border rounded-input text-sm font-medium text-red-500 hover:border-red-500 transition"
          >
            Delete
          </button>
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
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full border border-cb-border rounded-input px-3 py-2 text-sm resize-none"
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

      <ConfirmDialog />
      <AlertDialog />
    </div>
  );
}
