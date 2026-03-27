'use client';

import { useEffect, useState } from 'react';
import { supabase, listShoppingLists, getShoppingList, toggleShoppingItem, clearCheckedItems } from '@chefsbook/db';
import type { ShoppingList, ShoppingListItem } from '@chefsbook/db';
import { groupBy } from '@chefsbook/ui';

export default function ShopPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [currentList, setCurrentList] = useState<(ShoppingList & { items: ShoppingListItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
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
        items: currentList.items.map((i) => (i.id === id ? { ...i, is_checked: checked } : i)),
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
          <button onClick={() => setCurrentList(null)} className="text-cb-primary font-semibold hover:opacity-80">
            {'\u2190'} Back
          </button>
          <h1 className="text-xl font-bold">{currentList.name}</h1>
          {checkedCount > 0 && (
            <button onClick={handleClearChecked} className="text-cb-error text-sm hover:opacity-80">Clear done</button>
          )}
        </div>

        {Object.entries(grouped).map(([aisle, items]) => (
          <div key={aisle} className="mb-6">
            <h3 className="text-xs font-bold text-cb-primary uppercase tracking-wide mb-2">{aisle}</h3>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleToggle(item.id, !item.is_checked)}
                className="flex items-center gap-3 w-full text-left py-2 hover:bg-cb-surface-alt rounded px-2 transition-colors"
              >
                <span className="text-lg">{item.is_checked ? '\u2611' : '\u2610'}</span>
                <span className={`text-sm flex-1 ${item.is_checked ? 'line-through text-cb-text-tertiary' : 'text-cb-text'}`}>
                  {item.quantity ? `${item.quantity} ${item.unit ?? ''} ` : ''}{item.ingredient}
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
        <div className="text-center text-cb-text-secondary py-20">Loading...</div>
      ) : lists.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">{'\uD83D\uDED2'}</div>
          <h2 className="text-lg font-semibold mb-2">No shopping lists</h2>
          <p className="text-cb-text-secondary text-sm">Create a list or generate one from your meal plan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => openList(list.id)}
              className="w-full bg-cb-surface border border-cb-border rounded-xl p-4 text-left hover:border-cb-primary/50 transition-colors"
            >
              <div className="font-semibold">{list.name}</div>
              {list.date_range_start && (
                <div className="text-xs text-cb-text-secondary mt-1">{list.date_range_start} — {list.date_range_end}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
