'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { abbreviateUnit, convertIngredient } from '@chefsbook/ui';
import { useUnits } from '@/lib/useUnits';
import {
  supabase,
  listShoppingLists,
  getShoppingList,
  createShoppingList,
  updateShoppingList,
  toggleShoppingItem,
  clearCheckedItems,
  deleteShoppingList,
  addManualItem,
  deleteShoppingItem,
  togglePin,
} from '@chefsbook/db';
import type { ShoppingList, ShoppingListItem } from '@chefsbook/db';
import { useConfirmDialog } from '@/components/useConfirmDialog';
import StorePickerDialog from '@/components/StorePickerDialog';
import StoreAvatar from '@/components/StoreAvatar';
import { getUserStores } from '@chefsbook/db';
import type { Store } from '@chefsbook/db';

type ViewMode = 'department' | 'recipe' | 'alpha';

const DEPT_ORDER = ['produce', 'meat_seafood', 'dairy_eggs', 'baking', 'bakery', 'pasta_grains', 'canned', 'condiments', 'spices', 'frozen', 'beverages', 'household', 'other'];
const DEPT_LABELS: Record<string, string> = {
  produce: 'Produce', meat_seafood: 'Meat & Seafood', dairy_eggs: 'Dairy & Eggs',
  baking: 'Baking', bakery: 'Bakery', pasta_grains: 'Pasta & Grains',
  canned: 'Canned & Jarred', condiments: 'Condiments & Sauces',
  spices: 'Spices & Seasonings', frozen: 'Frozen',
  beverages: 'Beverages', household: 'Household', other: 'Other',
};

export default function ShopPage() {
  const [confirm, ConfirmDialog] = useConfirmDialog();
  const { units: unitSystem } = useUnits();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [currentList, setCurrentList] = useState<(ShoppingList & { items: ShoppingListItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('department');
  const [newItemText, setNewItemText] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [combinedView, setCombinedView] = useState<{ storeName: string; listNames: string[]; items: ShoppingListItem[] } | null>(null);

  const openCombinedView = async (storeName: string, storeLists: ShoppingList[]) => {
    const allItems: ShoppingListItem[] = [];
    for (const sl of storeLists) {
      try {
        const data = await getShoppingList(sl.id);
        if (data) for (const item of data.items) allItems.push({ ...item, recipe_name: item.recipe_name ?? sl.name });
      } catch {}
    }
    setCombinedView({ storeName, listNames: storeLists.map((l) => l.name), items: allItems });
  };
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [fontSize, setFontSize] = useState(16);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('shop_font_size');
    if (saved) setFontSize(parseInt(saved));
    loadLists();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!currentList) return;
    const channel = supabase
      .channel(`list-${currentList.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${currentList.id}` }, () => {
        // Reload list on any change
        refreshCurrentList();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentList?.id]);

  const loadLists = async () => {
    setLoading(true);
    setSyncStatus('syncing');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [data, storeData] = await Promise.all([
          listShoppingLists(user.id),
          getUserStores(user.id),
        ]);
        setLists(data);
        setStores(storeData);
      }
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
    }
    setLoading(false);
  };

  const refreshCurrentList = async () => {
    if (!currentList) return;
    const data = await getShoppingList(currentList.id);
    if (data) setCurrentList(data);
  };

  const openList = async (id: string) => {
    try {
      const data = await getShoppingList(id);
      setCurrentList(data);
    } catch (err: any) {
      alert('Failed to open list: ' + (err.message ?? 'Unknown error'));
    }
  };

  const handleToggle = async (id: string, checked: boolean) => {
    await toggleShoppingItem(id, checked);
    if (currentList) {
      setCurrentList({
        ...currentList,
        items: currentList.items.map((i) =>
          i.id === id ? { ...i, is_checked: checked, checked_at: checked ? new Date().toISOString() : null } : i
        ),
      });
    }
  };

  const handleClearChecked = async () => {
    if (!currentList) return;
    await clearCheckedItems(currentList.id);
    setCurrentList({ ...currentList, items: currentList.items.filter((i) => !i.is_checked) });
  };

  const handleAddManual = async () => {
    if (!currentList || !newItemText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const item = await addManualItem(currentList.id, user.id, newItemText.trim());
    setCurrentList({ ...currentList, items: [...currentList.items, item] });
    setNewItemText('');
    inputRef.current?.focus();
  };

  const handleDeleteItem = async (id: string) => {
    await deleteShoppingItem(id);
    if (currentList) {
      setCurrentList({ ...currentList, items: currentList.items.filter((i) => i.id !== id) });
    }
  };

  const handlePin = async (listId: string, pinned: boolean) => {
    await togglePin(listId, pinned);
    await loadLists();
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const list = await createShoppingList(user.id, newListName.trim(), { storeName: newListName.trim() });
      setNewListName('');
      setShowNewList(false);
      await loadLists();
      if (list?.id) openList(list.id);
    } catch (err: any) {
      alert('Failed to create list: ' + (err.message ?? 'Please try again.'));
    }
  };

  const handleSaveName = async (name: string) => {
    if (!currentList || !name.trim()) return;
    await updateShoppingList(currentList.id, { name: name.trim() });
    setCurrentList({ ...currentList, name: name.trim() });
    setEditingName(false);
  };

  const handleDeleteList = async () => {
    if (!currentList) return;
    const ok = await confirm({ icon: '\u{1F5D1}\uFE0F', title: 'Delete list?', body: `Delete "${currentList.name}"? This cannot be undone.`, confirmLabel: 'Delete' });
    if (!ok) return;
    await deleteShoppingList(currentList.id);
    setCurrentList(null);
    await loadLists();
  };

  const changeFontSize = (delta: number) => {
    const next = Math.max(12, Math.min(24, fontSize + delta));
    setFontSize(next);
    localStorage.setItem('shop_font_size', String(next));
  };

  // ── Grouping logic ──
  const groupItems = (items: ShoppingListItem[]) => {
    const unchecked = items.filter((i) => !i.is_checked);
    const checked = items.filter((i) => i.is_checked);

    if (viewMode === 'department') {
      const groups: Record<string, ShoppingListItem[]> = {};
      for (const item of unchecked) {
        const cat = item.category || item.aisle || 'other';
        (groups[cat] ??= []).push(item);
      }
      const sorted = DEPT_ORDER.filter((d) => groups[d]?.length).map((d) => ({ label: DEPT_LABELS[d] ?? d, items: groups[d]! }));
      // Add unlisted categories
      for (const [cat, items] of Object.entries(groups)) {
        if (!DEPT_ORDER.includes(cat)) sorted.push({ label: cat, items });
      }
      if (checked.length) sorted.push({ label: 'Done', items: checked });
      return sorted;
    }

    if (viewMode === 'recipe') {
      const groups: Record<string, ShoppingListItem[]> = {};
      for (const item of unchecked) {
        const key = item.recipe_name || 'Other items';
        (groups[key] ??= []).push(item);
      }
      const sorted = Object.entries(groups).map(([label, items]) => ({ label, items }));
      if (checked.length) sorted.push({ label: 'Done', items: checked });
      return sorted;
    }

    // alpha
    const all = [...unchecked.sort((a, b) => a.ingredient.localeCompare(b.ingredient))];
    if (checked.length) all.push(...checked);
    return [{ label: '', items: all }];
  };

  // ── Combined store view ──
  if (combinedView) {
    // Merge items by ingredient+unit
    const mergedMap = new Map<string, ShoppingListItem & { sourceLists: string[]; checked: boolean }>();
    for (const item of combinedView.items) {
      const key = `${item.ingredient.toLowerCase()}|${(item.unit ?? '').toLowerCase()}`;
      if (mergedMap.has(key)) {
        const ex = mergedMap.get(key)!;
        const q1 = parseFloat(ex.quantity_needed ?? '0') || 0;
        const q2 = parseFloat(item.quantity_needed ?? '0') || 0;
        if (q1 && q2) ex.quantity_needed = String(q1 + q2);
        if (!ex.sourceLists.includes(item.recipe_name ?? '')) ex.sourceLists.push(item.recipe_name ?? '');
      } else {
        mergedMap.set(key, { ...item, sourceLists: [item.recipe_name ?? ''], checked: false });
      }
    }
    const mergedItems = Array.from(mergedMap.values());

    // Group by department (same as individual list)
    const combinedGrouped = (() => {
      const unchecked = mergedItems.filter((i) => !i.checked);
      const checked = mergedItems.filter((i) => i.checked);
      const groups: Record<string, typeof mergedItems> = {};
      for (const item of unchecked) {
        const dept = item.category ?? 'other';
        (groups[dept] ??= []).push(item);
      }
      const sorted = DEPT_ORDER.filter((d) => groups[d]?.length).map((d) => ({ label: DEPT_LABELS[d] ?? d, items: groups[d] }));
      if (groups['other']?.length && !sorted.find((g) => g.label === 'Other')) sorted.push({ label: 'Other', items: groups['other'] });
      if (checked.length) sorted.push({ label: 'Done', items: checked });
      return sorted;
    })();

    return (
      <div className="p-8 max-w-[900px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setCombinedView(null)} className="text-cb-primary hover:opacity-80 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <h1 className="text-xl font-bold flex-1">All {combinedView.storeName}</h1>
        </div>

        {/* Banner */}
        <div className="bg-cb-bg border border-cb-border rounded-card p-3 mb-4">
          <p className="text-sm text-cb-secondary">📋 Combined view — items from {combinedView.listNames.map((n) => `"${n}"`).join(', ')}</p>
          <button onClick={() => setCombinedView(null)} className="text-xs text-cb-primary font-medium hover:underline mt-1">View individual lists →</button>
        </div>

        {/* Toolbar — font size + view mode */}
        <div className="flex items-center gap-2 mb-6 flex-wrap print:hidden">
          <span className="text-xs text-cb-secondary">{mergedItems.filter((i) => !i.checked).length} items</span>
          <span className="flex-1" />
          <button onClick={() => changeFontSize(-2)} className="text-xs text-cb-secondary border border-cb-border rounded px-1.5 py-0.5 hover:bg-cb-bg">A-</button>
          <button onClick={() => changeFontSize(2)} className="text-xs text-cb-secondary border border-cb-border rounded px-1.5 py-0.5 hover:bg-cb-bg">A+</button>
          <div className="flex bg-cb-card border border-cb-border rounded-input overflow-hidden">
            {([['department', 'Dept'], ['recipe', 'Recipe'], ['alpha', 'A-Z']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-2 py-1 text-[10px] font-medium ${viewMode === mode ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:text-cb-text'}`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Items */}
        <div style={{ fontSize }}>
          {combinedGrouped.map((group) => (
            <div key={group.label} className="mb-5">
              <h3 className="text-xs font-bold text-cb-primary uppercase tracking-wide mb-2 flex items-center gap-2">
                {group.label}
                <span className="text-cb-secondary font-normal">({group.items.length})</span>
              </h3>
              {group.items.map((item, i) => (
                <div key={i} className={`grid gap-1 py-1.5 items-center ${item.checked ? 'opacity-50' : ''}`} style={{ gridTemplateColumns: '24px 80px 1fr auto' }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => { item.checked = !item.checked; setCombinedView({ ...combinedView }); }}
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${item.checked ? 'bg-cb-green border-cb-green text-white' : 'border-cb-border hover:border-cb-green'}`}
                  >
                    {item.checked && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                  </button>
                  {/* Purchase unit */}
                  <span className="text-cb-primary font-semibold text-sm text-right">{item.purchase_unit ?? item.quantity_needed ?? ''}</span>
                  {/* Ingredient + usage + recipe source */}
                  <div>
                    <span className={`text-sm ${item.checked ? 'line-through text-cb-muted' : 'text-cb-text'}`}>{item.ingredient}</span>
                    <div className="flex gap-2 text-[10px]">
                      {item.quantity_needed && item.purchase_unit && (
                        <span className="text-cb-green">{item.quantity_needed}</span>
                      )}
                      {item.sourceLists.length > 0 && (
                        <span className="text-cb-muted">{item.sourceLists.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  {/* Multi-list badge */}
                  {item.sourceLists.length > 1 && (
                    <span className="text-[9px] text-cb-muted bg-cb-bg px-1.5 py-0.5 rounded">{item.sourceLists.length} lists</span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {mergedItems.length === 0 && <p className="text-cb-muted text-center py-8">No items in these lists.</p>}
        </div>
      </div>
    );
  }

  // ── Single list view ──
  if (currentList) {
    const grouped = groupItems(currentList.items);
    const checkedCount = currentList.items.filter((i) => i.is_checked).length;
    const totalCount = currentList.items.length;

    return (
      <div className="p-8 max-w-[900px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setCurrentList(null)} className="text-cb-primary hover:opacity-80 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          {editingName ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSaveName((e.currentTarget.elements.namedItem('n') as HTMLInputElement).value); }} className="flex-1">
              <input name="n" defaultValue={currentList.name} autoFocus onBlur={(e) => handleSaveName(e.target.value)} className="text-xl font-bold w-full bg-cb-bg border border-cb-primary rounded-input px-2 py-1 outline-none" />
            </form>
          ) : (
            <h1 className="text-xl font-bold flex-1 cursor-pointer hover:text-cb-primary/80" onClick={() => setEditingName(true)}>{currentList.name}</h1>
          )}
          {currentList.store_name && <span className="text-xs text-cb-secondary bg-cb-bg px-2 py-1 rounded-input">{currentList.store_name}</span>}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-6 flex-wrap print:hidden">
          <span className="text-xs text-cb-secondary">{totalCount - checkedCount} remaining</span>
          {checkedCount > 0 && <button onClick={handleClearChecked} className="text-xs text-cb-primary hover:underline">Clear {checkedCount} done</button>}
          <span className="flex-1" />
          {/* Font size */}
          <button onClick={() => changeFontSize(-2)} className="text-xs text-cb-secondary border border-cb-border rounded px-1.5 py-0.5 hover:bg-cb-bg">A-</button>
          <button onClick={() => changeFontSize(2)} className="text-xs text-cb-secondary border border-cb-border rounded px-1.5 py-0.5 hover:bg-cb-bg">A+</button>
          {/* View toggle */}
          <div className="flex bg-cb-card border border-cb-border rounded-input overflow-hidden">
            {([['department', 'Dept'], ['recipe', 'Recipe'], ['alpha', 'A-Z']] as const).map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-2 py-1 text-[10px] font-medium ${viewMode === mode ? 'bg-cb-primary text-white' : 'text-cb-secondary hover:text-cb-text'}`}>{label}</button>
            ))}
          </div>
          {/* Print */}
          <button onClick={() => window.print()} className="text-cb-secondary hover:text-cb-primary print:hidden" title="Print list">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>
          </button>
          {/* Refresh */}
          <button onClick={refreshCurrentList} className="text-cb-secondary hover:text-cb-primary print:hidden" title="Refresh">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
          </button>
          {/* Delete list */}
          <button onClick={handleDeleteList} className="text-cb-secondary hover:text-cb-primary" title="Delete list">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
          </button>
        </div>

        {/* Items grouped */}
        <div style={{ fontSize }} className={currentList.items.length > 12 ? 'print-two-col' : ''}>
          {grouped.map((group) => (
            <div key={group.label} className="mb-5">
              {group.label && (
                <h3 className="text-xs font-bold text-cb-primary uppercase tracking-wide mb-2 flex items-center gap-2">
                  {group.label}
                  <span className="text-cb-secondary font-normal">({group.items.length})</span>
                </h3>
              )}
              {group.items.map((item) => (
                <div key={item.id} className={`grid gap-1 py-1.5 group items-center shop-item-grid ${item.is_checked ? 'opacity-50' : ''}`}>
                  {/* Col 1: Checkbox */}
                  <button onClick={() => handleToggle(item.id, !item.is_checked)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${item.is_checked ? 'bg-cb-green border-cb-green text-white' : 'border-cb-border hover:border-cb-green'}`}>
                    {item.is_checked && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                  </button>
                  {/* Col 2: Purchase unit */}
                  <span className={`font-bold truncate ${item.is_checked ? 'line-through' : ''}`}>
                    {item.purchase_unit || '\u2014'}
                  </span>
                  {/* Col 3: Quantity needed */}
                  <span className="text-cb-secondary text-center truncate" style={{ fontSize: '0.8em' }}>
                    {item.quantity_needed ? (
                      <span className="inline-flex items-center gap-0.5">(<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>{abbreviateUnit(item.quantity_needed)})</span>
                    ) : item.quantity != null ? (
                      (() => { const c = convertIngredient(item.quantity, item.unit, unitSystem, item.ingredient); return <span>{c.quantity}{c.unit ? ` ${c.unit}` : ''}</span>; })()
                    ) : null}
                  </span>
                  {/* Col 4: Ingredient name */}
                  <span className={`truncate ${item.is_checked ? 'line-through text-cb-secondary' : ''}`}>
                    {item.ingredient}
                  </span>
                  {/* Col 5: Recipe source (hidden on mobile via CSS) */}
                  <span className="text-[10px] text-cb-secondary truncate shop-source">
                    {item.recipe_name && viewMode !== 'recipe' ? item.recipe_name : ''}
                  </span>
                  {/* Col 6: Delete */}
                  <button onClick={() => handleDeleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-cb-secondary hover:text-cb-primary transition-opacity">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Print watermark */}
        <div className="print-watermark hidden">
          Generated by ChefsBook &mdash; {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        {/* Manual add */}
        <div className="mt-4 flex gap-2 print:hidden">
          <input
            ref={inputRef}
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddManual(); }}
            placeholder="Add item..."
            className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-green"
          />
          <button onClick={handleAddManual} disabled={!newItemText.trim()} className="bg-cb-primary text-white px-4 py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">Add</button>
        </div>
        <ConfirmDialog />
      </div>
    );
  }

  // ── Lists index view ──
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Shopping</h1>
          {syncStatus === 'syncing' && <span className="text-xs text-cb-muted">↻ Syncing...</span>}
          {syncStatus === 'synced' && <span className="text-xs text-cb-green">✓ Synced</span>}
          {syncStatus === 'error' && <span className="text-xs text-amber-500">⚠️ Connection issue</span>}
        </div>
        <button data-onboard="new-list" onClick={() => setShowNewList(true)} className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New List
        </button>
      </div>

      {showNewList && (
        <StorePickerDialog
          onCreated={async (listId) => { setShowNewList(false); await loadLists(); openList(listId); }}
          onCancel={() => setShowNewList(false)}
        />
      )}

      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading...</div>
      ) : lists.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-green/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No shopping lists</h2>
          <p className="text-cb-secondary text-sm mb-4">Create a list or add ingredients from a recipe.</p>
          <button onClick={() => setShowNewList(true)} className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90">Create Your First List</button>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            // Group lists by store (case-insensitive)
            const grouped: Record<string, { displayName: string; lists: ShoppingList[] }> = {};
            for (const list of lists) {
              const key = (list.store_name ?? '').toLowerCase().trim() || 'other';
              if (!grouped[key]) grouped[key] = { displayName: list.store_name || 'Other', lists: [] };
              grouped[key].lists.push(list);
            }
            const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
              if (a === 'other') return 1;
              if (b === 'other') return -1;
              return a.localeCompare(b);
            });

            return sortedGroups.map(([key, { displayName: storeName, lists: groupLists }]) => {
              const store = stores.find((s) => s.name.toLowerCase() === key) ?? null;
              return (
                <div key={key} className="bg-cb-card border border-cb-border rounded-card overflow-hidden">
                  {/* Store group header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-cb-bg/50 border-b border-cb-border">
                    {key === 'other' ? (
                      <div className="w-9 h-9 rounded-full bg-cb-border flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                      </div>
                    ) : (
                      <StoreAvatar store={store} size={36} />
                    )}
                    <span className="font-semibold text-cb-text flex-1">{storeName}</span>
                    <span className="text-xs text-cb-muted">{groupLists.length} list{groupLists.length > 1 ? 's' : ''}</span>
                  </div>

                  {/* List rows */}
                  <div className="divide-y divide-cb-border/50">
                    {/* Combined entry — only for stores with 2+ lists */}
                    {groupLists.length >= 2 && key !== 'other' && (
                      <button
                        onClick={() => openCombinedView(storeName, groupLists)}
                        className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-cb-bg/50 transition-colors bg-cb-bg/30"
                      >
                        <span className="text-sm">📋</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-cb-text">All {storeName}</div>
                        </div>
                        <span className="text-[11px] font-semibold text-white bg-cb-green px-2 py-0.5 rounded-xl">COMBINED</span>
                        <svg className="w-4 h-4 text-cb-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                      </button>
                    )}
                    {groupLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => openList(list.id)}
                        className="flex items-center gap-3 w-full text-left px-4 py-3 hover:bg-cb-bg/50 transition-colors"
                      >
                        <span className="text-sm">📋</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-cb-text truncate">{list.name}</div>
                          {list.updated_at && (
                            <div className="text-[11px] text-cb-muted mt-0.5">
                              Updated {new Date(list.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                        {list.pinned && (
                          <svg className="w-3.5 h-3.5 text-cb-primary shrink-0" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                        )}
                        <svg className="w-4 h-4 text-cb-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
