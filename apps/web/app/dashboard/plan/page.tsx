'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase, getMealPlansForWeek, addMealPlan, deleteMealPlan, listRecipes, getRecipe, createShoppingList, listShoppingLists } from '@chefsbook/db';
import type { MealPlan, Recipe, ShoppingList } from '@chefsbook/db';
import { addIngredientsToList } from '@/lib/addToShoppingList';
import MealPlanWizard from '@/components/MealPlanWizard';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS = ['breakfast', 'brunch', 'lunch', 'dinner', 'snack'] as const;
const SLOT_TO_COURSE: Record<string, string> = { breakfast: 'breakfast', brunch: 'brunch', lunch: 'lunch', dinner: 'dinner', snack: 'snack' };

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(startDate + 'T12:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  for (let i = 0; i < 7; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${dd}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const SLOT_COLORS: Record<string, string> = {
  breakfast: 'bg-amber-100 text-amber-700',
  brunch: 'bg-orange-100 text-orange-700',
  lunch: 'bg-blue-100 text-blue-700',
  dinner: 'bg-cb-primary/10 text-cb-primary',
  snack: 'bg-green-100 text-green-700',
};

function DayCard({ date, dayName, plans, onOpenPicker, onOpenNote, onOpenDayShop, onRemovePlan }: {
  date: string;
  dayName: string;
  plans: any[];
  onOpenPicker: (date: string) => void;
  onOpenNote: (date: string) => void;
  onOpenDayShop: (date: string) => void;
  onRemovePlan: (id: string) => void;
}) {
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const hasRecipes = plans.some((p) => p.recipe_id);

  return (
    <div className="bg-cb-card border border-cb-border rounded-card p-3 min-h-[200px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-bold">{dayName}</div>
          <div className="text-xs text-cb-secondary">{dateLabel}</div>
        </div>
        {hasRecipes && (
          <button onClick={() => onOpenDayShop(date)} className="text-cb-secondary hover:text-cb-green transition-colors" title="Add day to shopping list">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
          </button>
        )}
      </div>

      {/* Meal slots */}
      <div className="flex-1 space-y-2 mt-2">
        {plans.map((plan) => (
          <div key={plan.id} className="group">
            {plan.recipe_id ? (
              /* Recipe entry */
              <div className="relative">
                <span className={`absolute top-2 left-2 z-10 text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${SLOT_COLORS[plan.meal_slot] ?? 'bg-cb-bg text-cb-secondary'}`}>
                  {plan.meal_slot}
                </span>
                <button
                  onClick={() => onRemovePlan(plan.id)}
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
                <Link href={`/recipe/${plan.recipe_id}`} className="block">
                  {plan.recipe?.image_url ? (
                    <img src={plan.recipe.image_url} alt={plan.recipe?.title ?? ''} className="w-full aspect-[3/2] object-cover rounded-input" />
                  ) : (
                    <div className="w-full aspect-[3/2] bg-cb-bg rounded-input flex items-center justify-center">
                      <svg className="w-8 h-8 text-cb-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M2.25 18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V6a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6v12Z" /></svg>
                    </div>
                  )}
                  <p className="text-xs font-medium mt-1.5 line-clamp-2 hover:text-cb-primary transition-colors">
                    {plan.recipe?.title ?? 'Recipe'}
                  </p>
                </Link>
              </div>
            ) : (
              /* Note entry */
              <div className="bg-amber-50 border border-amber-200 rounded-input px-2.5 py-2 group relative">
                <span className={`text-[9px] uppercase tracking-wide font-bold ${SLOT_COLORS[plan.meal_slot] ?? 'text-cb-secondary'} block mb-0.5`}>
                  {plan.meal_slot}
                </span>
                <p className="text-xs text-amber-800 flex items-center gap-1">
                  <span className="text-[10px]">📝</span> {plan.notes ?? '-'}
                </p>
                <button onClick={() => onRemovePlan(plan.id)} className="absolute top-1.5 right-1.5 text-amber-400 hover:text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="mt-3 flex gap-1.5">
        <button onClick={() => onOpenPicker(date)} className="flex-1 py-2 border-2 border-dashed border-cb-border rounded-input text-xs text-cb-secondary hover:border-cb-primary hover:text-cb-primary transition-colors flex items-center justify-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add recipe
        </button>
        <button onClick={() => onOpenNote(date)} className="py-2 px-3 border-2 border-dashed border-amber-300 rounded-input text-xs text-amber-500 hover:border-amber-500 hover:bg-amber-50 transition-colors" title="Add note">📝</button>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [weekStart, setWeekStart] = useState(new Date().toISOString().split('T')[0]!);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Smart picker state
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<string>('dinner');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [pickerTab, setPickerTab] = useState<'favourites' | 'all' | 'ai'>('all');
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Note state
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [noteSlot, setNoteSlot] = useState<string>('dinner');
  const [noteText, setNoteText] = useState('');

  // Shopping modal
  const [showShopModal, setShowShopModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [shopLists, setShopLists] = useState<ShoppingList[]>([]);
  const [addingToShop, setAddingToShop] = useState(false);
  const [dayShopDate, setDayShopDate] = useState<string | null>(null);
  const [dayShopListId, setDayShopListId] = useState<string>('');

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  useEffect(() => { loadPlans(); }, [weekStart, userId]);

  const loadPlans = async () => {
    if (!userId) return;
    setLoading(true);
    if (weekDates.length === 7) {
      const data = await getMealPlansForWeek(userId, weekDates[0]!, weekDates[6]!);
      setPlans(data);
    }
    setLoading(false);
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().split('T')[0]!);
  };

  // ── Smart Picker ──

  const openPicker = async (date: string, slot?: string) => {
    setPickerDate(date);
    setPickerSlot(slot ?? 'dinner');
    setRecipeSearch('');
    setCuisineFilter('');
    setSelectedRecipeId(null);
    setPickerTab('all');
    if (userId && recipes.length === 0) {
      const data = await listRecipes({ userId, limit: 500 });
      setRecipes(data);
    }
  };

  const assignRecipe = async () => {
    if (!userId || !pickerDate || !selectedRecipeId) return;
    await addMealPlan(userId, { plan_date: pickerDate, meal_slot: pickerSlot as any, recipe_id: selectedRecipeId, servings: null, notes: null });
    setPickerDate(null);
    setSelectedRecipeId(null);
    await loadPlans();
  };

  const removePlan = async (planId: string) => {
    await deleteMealPlan(planId);
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  };

  // ── Notes ──

  const openNoteEntry = (date: string, slot?: string) => {
    setNoteDate(date);
    setNoteSlot(slot ?? 'dinner');
    setNoteText('');
  };

  const saveNote = async () => {
    if (!userId || !noteDate || !noteText.trim()) return;
    await addMealPlan(userId, { plan_date: noteDate, meal_slot: noteSlot as any, recipe_id: null, servings: null, notes: noteText.trim() });
    setNoteDate(null);
    setNoteText('');
    await loadPlans();
  };

  // ── Shopping ──

  const addWeekToShoppingList = async (listId: string) => {
    if (!userId) return;
    setAddingToShop(true);
    try {
      const recipePlans = plans.filter((p: any) => p.recipe_id);
      if (recipePlans.length === 0) { setAddingToShop(false); return; }
      // Count how many times each recipe appears in the week
      const recipeCounts = new Map<string, number>();
      for (const p of recipePlans) {
        recipeCounts.set(p.recipe_id!, (recipeCounts.get(p.recipe_id!) ?? 0) + 1);
      }
      const recipeDetails = await Promise.all([...recipeCounts.keys()].map((rid) => getRecipe(rid)));
      const items: any[] = [];
      for (const r of recipeDetails) {
        if (!r) continue;
        const count = recipeCounts.get(r.id) ?? 1;
        for (const ing of r.ingredients) {
          const scaledQty = ing.quantity != null ? Math.round(ing.quantity * count * 100) / 100 : null;
          items.push({ ingredient: ing.ingredient, quantity: scaledQty, unit: ing.unit, quantity_needed: [scaledQty, ing.unit].filter(Boolean).join(' ') || null, recipe_name: r.title, recipe_id: r.id });
        }
      }
      if (items.length > 0) await addIngredientsToList(listId, items);
      setShowShopModal(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add items');
    } finally { setAddingToShop(false); }
  };

  const openDayShop = async (date: string) => {
    if (!userId) return;
    const lists = await listShoppingLists(userId);
    setShopLists(lists);
    setDayShopDate(date);
    setDayShopListId(lists[0]?.id ?? '');
  };

  const addDayToShoppingList = async () => {
    if (!userId || !dayShopDate) return;
    setAddingToShop(true);
    try {
      let listId = dayShopListId;
      if (!listId) {
        const dayName = new Date(dayShopDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
        const list = await createShoppingList(userId, `${dayName} meals`);
        listId = list.id;
      }
      const dayPlans = plans.filter((p: any) => p.plan_date === dayShopDate && p.recipe_id);
      if (dayPlans.length === 0) { setAddingToShop(false); setDayShopDate(null); return; }
      // Count how many times each recipe appears on this day
      const recipeCounts = new Map<string, number>();
      for (const p of dayPlans) {
        recipeCounts.set(p.recipe_id!, (recipeCounts.get(p.recipe_id!) ?? 0) + 1);
      }
      const recipeDetails = await Promise.all([...recipeCounts.keys()].map((rid) => getRecipe(rid)));
      const items: any[] = [];
      for (const r of recipeDetails) {
        if (!r) continue;
        const count = recipeCounts.get(r.id) ?? 1;
        for (const ing of r.ingredients) {
          const scaledQty = ing.quantity != null ? Math.round(ing.quantity * count * 100) / 100 : null;
          items.push({ ingredient: ing.ingredient, quantity: scaledQty, unit: ing.unit, quantity_needed: [scaledQty, ing.unit].filter(Boolean).join(' ') || null, recipe_name: r.title, recipe_id: r.id });
        }
      }
      if (items.length > 0) await addIngredientsToList(listId, items);
      setDayShopDate(null);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add items');
    } finally { setAddingToShop(false); }
  };

  // ── Filter logic ──

  const userCuisines = useMemo(() => [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))], [recipes]);

  const filteredRecipes = useMemo(() => {
    let list = recipes;
    if (pickerTab === 'favourites') list = list.filter((r) => r.is_favourite);
    if (recipeSearch) list = list.filter((r) => r.title.toLowerCase().includes(recipeSearch.toLowerCase()));
    if (cuisineFilter) list = list.filter((r) => r.cuisine?.toLowerCase() === cuisineFilter.toLowerCase());
    // Sort by course match, then favourites, then recent
    const slotCourse = SLOT_TO_COURSE[pickerSlot];
    list = [...list].sort((a, b) => {
      if (a.course === slotCourse && b.course !== slotCourse) return -1;
      if (b.course === slotCourse && a.course !== slotCourse) return 1;
      if (a.is_favourite && !b.is_favourite) return -1;
      if (b.is_favourite && !a.is_favourite) return 1;
      return 0;
    });
    return list;
  }, [recipes, pickerTab, recipeSearch, cuisineFilter, pickerSlot]);

  // ── Render ──

  const dayLabel = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Meal Plan</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowWizard(true)} className="bg-cb-primary text-white px-4 py-2 rounded-input text-sm font-semibold hover:opacity-90 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
            AI Plan my week
          </button>
          {plans.some((p: any) => p.recipe_id) && (
            <button onClick={async () => { if (!userId) return; setShopLists(await listShoppingLists(userId)); setShowShopModal(true); }} className="border border-cb-green text-cb-green px-4 py-2 rounded-input text-sm font-medium hover:bg-cb-green hover:text-white transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
              Add week to list
            </button>
          )}
          <Link href="/dashboard/plan/templates" className="border border-cb-border px-4 py-2 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text hover:bg-cb-card transition-colors">Templates</Link>
          <div className="flex items-center gap-2 bg-cb-card border border-cb-border rounded-input px-1">
            <button onClick={() => navigateWeek(-1)} className="px-3 py-2 text-cb-secondary hover:text-cb-primary"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
            <span className="text-sm text-cb-secondary px-2">{weekDates[0]} — {weekDates[6]}</span>
            <button onClick={() => navigateWeek(1)} className="px-3 py-2 text-cb-secondary hover:text-cb-primary"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></button>
          </div>
        </div>
      </div>

      {/* Calendar grid — Row 1: Mon-Fri, Row 2: Sat-Sun */}
      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading meal plan...</div>
      ) : (
        <div className="space-y-3">
          {/* Row 1: Mon–Fri */}
          <div className="grid grid-cols-5 gap-3">
            {weekDates.slice(0, 5).map((date, i) => {
              const dayPlans = plans.filter((p: any) => p.plan_date === date);
              return <DayCard key={date} date={date} dayName={DAYS[i]!} plans={dayPlans} onOpenPicker={openPicker} onOpenNote={openNoteEntry} onOpenDayShop={openDayShop} onRemovePlan={removePlan} />;
            })}
          </div>
          {/* Row 2: Sat–Sun (same column width as row 1) */}
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, calc((100% - 4 * 0.75rem) / 5))' }}>
            {weekDates.slice(5, 7).map((date, i) => {
              const dayPlans = plans.filter((p: any) => p.plan_date === date);
              return <DayCard key={date} date={date} dayName={DAYS[5 + i]!} plans={dayPlans} onOpenPicker={openPicker} onOpenNote={openNoteEntry} onOpenDayShop={openDayShop} onRemovePlan={removePlan} />;
            })}
          </div>
        </div>
      )}

      {/* ── Day shopping popover ── */}
      {dayShopDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-xs mx-4 p-5">
            <h3 className="text-sm font-bold mb-1">Add {new Date(dayShopDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}'s meals to:</h3>
            <p className="text-[10px] text-cb-secondary mb-3">{plans.filter((p: any) => p.plan_date === dayShopDate && p.recipe_id).length} recipe{plans.filter((p: any) => p.plan_date === dayShopDate && p.recipe_id).length !== 1 ? 's' : ''}</p>
            {shopLists.length > 0 && (
              <select value={dayShopListId} onChange={(e) => setDayShopListId(e.target.value)} className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none mb-2">
                {shopLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <button onClick={addDayToShoppingList} disabled={addingToShop} className="flex-1 bg-cb-green text-white py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">{addingToShop ? 'Adding...' : 'Add'}</button>
              <button onClick={async () => { if (!userId) return; const list = await createShoppingList(userId, `${new Date(dayShopDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })} meals`); setDayShopListId(list.id); await addDayToShoppingList(); }} disabled={addingToShop} className="text-xs text-cb-green hover:underline">+ New list</button>
              <button onClick={() => setDayShopDate(null)} className="text-sm text-cb-secondary hover:text-cb-text">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Note entry modal ── */}
      {noteDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-1">Add a note</h2>
            <p className="text-cb-secondary text-xs mb-3">{dayLabel(noteDate)}</p>
            <div className="flex gap-1.5 mb-3">
              {MEAL_SLOTS.map((slot) => (
                <button key={slot} onClick={() => setNoteSlot(slot)} className={`px-2.5 py-1 rounded-full text-xs font-medium ${noteSlot === slot ? 'bg-amber-500 text-white' : 'bg-cb-bg text-cb-secondary'}`}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</button>
              ))}
            </div>
            <input value={noteText} onChange={(e) => setNoteText(e.target.value.slice(0, 100))} onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); }} autoFocus placeholder='e.g. "Use leftovers", "Date night — go out"' className="w-full bg-cb-bg border border-amber-300 rounded-input px-3 py-2 text-sm outline-none focus:border-amber-500 mb-1" />
            <p className="text-[10px] text-cb-secondary mb-3">{noteText.length}/100</p>
            <div className="flex gap-2">
              <button onClick={saveNote} disabled={!noteText.trim()} className="flex-1 bg-amber-500 text-white py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">Save note</button>
              <button onClick={() => setNoteDate(null)} className="text-sm text-cb-secondary hover:text-cb-text px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shopping list modal ── */}
      {showShopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-cb-card border border-cb-border rounded-card w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold mb-1">Add week to shopping list</h2>
            <p className="text-cb-secondary text-xs mb-4">{plans.filter((p: any) => p.recipe_id).length} recipes</p>
            {shopLists.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {shopLists.map((list) => (
                  <button key={list.id} onClick={() => addWeekToShoppingList(list.id)} disabled={addingToShop} className="w-full text-left px-3 py-2 rounded-input text-sm hover:bg-cb-bg border border-cb-border disabled:opacity-50">{list.name}</button>
                ))}
              </div>
            )}
            <button onClick={async () => { if (!userId) return; const list = await createShoppingList(userId, `Week of ${weekDates[0]}`); await addWeekToShoppingList(list.id); }} disabled={addingToShop} className="w-full bg-cb-green text-white py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50 mb-2">{addingToShop ? 'Adding...' : 'Create new list & add'}</button>
            <button onClick={() => setShowShopModal(false)} className="w-full text-center text-sm text-cb-secondary py-1">Cancel</button>
          </div>
        </div>
      )}

      {/* ── AI Meal Plan Wizard ── */}
      {showWizard && (
        <MealPlanWizard
          weekDates={weekDates}
          onClose={() => setShowWizard(false)}
          onAccept={() => { setShowWizard(false); loadPlans(); }}
        />
      )}

      {/* ── Smart Recipe Picker Panel ── */}
      {pickerDate && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-cb-card border-l border-cb-border w-full max-w-lg h-full flex flex-col shadow-xl animate-in slide-in-from-right">
            {/* Header */}
            <div className="p-5 border-b border-cb-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Add recipe</h2>
                <p className="text-xs text-cb-secondary">{dayLabel(pickerDate)} · {pickerSlot.charAt(0).toUpperCase() + pickerSlot.slice(1)}</p>
              </div>
              <button onClick={() => { setPickerDate(null); setSelectedRecipeId(null); }} className="text-cb-secondary hover:text-cb-text">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Meal slot filter */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex gap-1.5 mb-3 overflow-x-auto">
                {MEAL_SLOTS.map((slot) => (
                  <button key={slot} onClick={() => setPickerSlot(slot)} className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${pickerSlot === slot ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary hover:text-cb-text'}`}>{slot.charAt(0).toUpperCase() + slot.slice(1)}</button>
                ))}
              </div>

              {/* Cuisine filter */}
              {userCuisines.length > 0 && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto">
                  <button onClick={() => setCuisineFilter('')} className={`px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 ${!cuisineFilter ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>All</button>
                  {userCuisines.map((c) => (
                    <button key={c} onClick={() => setCuisineFilter(c!)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0 ${cuisineFilter === c ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>{c}</button>
                  ))}
                </div>
              )}

              {/* Search */}
              <input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} placeholder="Search recipes..." className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-cb-border px-5">
              {([['favourites', '\u2605 Favourites'], ['all', 'All Recipes']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setPickerTab(key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${pickerTab === key ? 'border-cb-primary text-cb-primary' : 'border-transparent text-cb-secondary hover:text-cb-text'}`}>{label}</button>
              ))}
            </div>

            {/* Recipe list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredRecipes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-cb-secondary text-sm">{pickerTab === 'favourites' ? 'No favourited recipes match these filters.' : 'No recipes found.'}</p>
                  {pickerTab === 'favourites' && <button onClick={() => setPickerTab('all')} className="text-cb-primary text-sm mt-2 hover:underline">Try All Recipes</button>}
                </div>
              ) : (
                filteredRecipes.map((r) => (
                  <button key={r.id} onClick={() => setSelectedRecipeId(selectedRecipeId === r.id ? null : r.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-input transition-colors text-left ${selectedRecipeId === r.id ? 'bg-cb-primary/10 ring-2 ring-cb-primary/30' : 'hover:bg-cb-bg'}`}>
                    <div className="w-12 h-12 rounded-input overflow-hidden bg-cb-bg shrink-0">
                      {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-[10px] text-cb-secondary">{[r.cuisine, r.course, r.total_minutes ? `${r.total_minutes}min` : null].filter(Boolean).join(' · ')}</p>
                    </div>
                    {r.is_favourite && <span className="text-cb-primary text-xs shrink-0">{'\u2665'}</span>}
                    {selectedRecipeId === r.id && (
                      <span className="w-5 h-5 rounded-full bg-cb-primary text-white flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer: Add to plan + Add note */}
            <div className="p-4 border-t border-cb-border space-y-2">
              <button onClick={assignRecipe} disabled={!selectedRecipeId} className="w-full bg-cb-primary text-white py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {selectedRecipeId ? `Add to ${DAYS[weekDates.indexOf(pickerDate!)]} · ${pickerSlot.charAt(0).toUpperCase() + pickerSlot.slice(1)}` : 'Select a recipe'}
              </button>
              <button onClick={() => { setPickerDate(null); openNoteEntry(pickerDate!); }} className="w-full text-center text-xs text-cb-secondary hover:text-amber-600">Add a note instead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
