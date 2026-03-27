'use client';

import { useEffect, useState } from 'react';
import {
  supabase,
  listShoppingLists,
  getShoppingList,
  toggleShoppingItem,
  clearCheckedItems,
} from '@chefsbook/db';
import type { ShoppingList, ShoppingListItem } from '@chefsbook/db';
import { groupBy } from '@chefsbook/ui';

export default function ShopPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [currentList, setCurrentList] = useState<
    (ShoppingList & { items: ShoppingListItem[] }) | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const data = await listShoppingLists(user.id);
      setLists(data);
    }
    setLoading(false);
  };

  const openList = async (id: string) => {
    const data = await getShoppingList(id);
    setCurrentList(data);
  };

  const handleToggle = async (id: string, checked: boolean) => {
    await toggleShoppingItem(id, checked);
    if (currentList) {
      setCurrentList({
        ...currentList,
        items: currentList.items.map((i) =>
          i.id === id ? { ...i, is_checked: checked } : i
        ),
      });
    }
  };

  const handleClearChecked = async () => {
    if (!currentList) return;
    await clearCheckedItems(currentList.id);
    setCurrentList({
      ...currentList,
      items: currentList.items.filter((i) => !i.is_checked),
    });
  };

  if (currentList) {
    const grouped = groupBy(currentList.items, (i) => i.aisle);
    const checkedCount = currentList.items.filter((i) => i.is_checked).length;

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setCurrentList(null)}
            className="text-cb-primary font-semibold hover:opacity-80 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold">{currentList.name}</h1>
          {checkedCount > 0 && (
            <button
              onClick={handleClearChecked}
              className="text-cb-primary text-sm hover:opacity-80"
            >
              Clear done
            </button>
          )}
        </div>

        {Object.entries(grouped).map(([aisle, items]) => (
          <div key={aisle} className="mb-6">
            <h3 className="text-xs font-bold text-cb-primary uppercase tracking-wide mb-2">
              {aisle}
            </h3>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleToggle(item.id, !item.is_checked)}
                className="flex items-center gap-3 w-full text-left py-2 hover:bg-cb-bg rounded-input px-2 transition-colors"
              >
                <span
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    item.is_checked
                      ? 'bg-cb-green border-cb-green text-white'
                      : 'border-cb-border'
                  }`}
                >
                  {item.is_checked && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span
                  className={`text-sm flex-1 ${
                    item.is_checked ? 'line-through text-cb-muted' : ''
                  }`}
                >
                  {item.quantity ? `${item.quantity} ${item.unit ?? ''} ` : ''}
                  {item.ingredient}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Shopping Lists</h1>
      {loading ? (
        <div className="text-center text-cb-muted py-20">Loading...</div>
      ) : lists.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No shopping lists</h2>
          <p className="text-cb-muted text-sm">
            Create a list or generate one from your meal plan.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => openList(list.id)}
              className="w-full bg-cb-card border border-cb-border rounded-card p-4 text-left hover:border-cb-primary/50 transition-colors"
            >
              <div className="font-semibold">{list.name}</div>
              {list.date_range_start && (
                <div className="text-xs text-cb-muted mt-1">
                  {list.date_range_start} — {list.date_range_end}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
