'use client';

import { useState, useEffect } from 'react';
import { supabase, getUserStores, createStore, createShoppingList } from '@chefsbook/db';
import type { Store } from '@chefsbook/db';

interface Props {
  onCreated: (listId: string) => void;
  onCancel: () => void;
}

export default function StorePickerDialog({ onCreated, onCancel }: Props) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [listName, setListName] = useState('');
  const [showNewStore, setShowNewStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) getUserStores(uid).then(setStores);
    });
  }, []);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setListName(store.name);
    setShowNewStore(false);
  };

  const handleAddNewStore = async () => {
    if (!userId || !newStoreName.trim()) return;
    setCreating(true);
    try {
      const store = await createStore({ userId, name: newStoreName.trim() });
      setStores((prev) => [store, ...prev]);
      handleSelectStore(store);
      setNewStoreName('');
    } catch {}
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      const list = await createShoppingList(userId, listName.trim() || selectedStore?.name || 'Shopping List', {
        storeName: selectedStore?.name,
        storeId: selectedStore?.id,
      });
      onCreated(list.id);
    } catch (e: any) {
      alert('Failed to create list: ' + (e.message ?? ''));
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="bg-cb-card rounded-card p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-cb-text mb-4">New Shopping List</h2>

        <p className="text-sm font-medium text-cb-secondary mb-2">Select a store</p>
        <div className="border border-cb-border rounded-input divide-y divide-cb-border mb-4 max-h-48 overflow-y-auto">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => handleSelectStore(store)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-cb-bg text-sm ${selectedStore?.id === store.id ? 'bg-cb-bg font-semibold' : ''}`}
            >
              {store.logo_url ? (
                <img src={store.logo_url} alt="" className="w-7 h-7 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-7 h-7 rounded bg-cb-primary text-white flex items-center justify-center text-[10px] font-bold">{store.initials}</div>
              )}
              <span className="text-cb-text">{store.name}</span>
            </button>
          ))}
          {!showNewStore && (
            <button onClick={() => setShowNewStore(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-cb-bg text-sm text-cb-primary font-medium">
              <div className="w-7 h-7 rounded border border-dashed border-cb-border flex items-center justify-center text-cb-primary text-lg">+</div>
              New store...
            </button>
          )}
        </div>

        {showNewStore && (
          <div className="flex gap-2 mb-4">
            <input
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="Store name"
              autoFocus
              className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
            />
            <button onClick={handleAddNewStore} disabled={!newStoreName.trim() || creating} className="bg-cb-primary text-white px-3 py-2 rounded-input text-sm font-semibold disabled:opacity-50">
              {creating ? '...' : 'Add'}
            </button>
          </div>
        )}

        <p className="text-sm font-medium text-cb-secondary mb-1">List name (optional)</p>
        <input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder={selectedStore?.name ?? 'Shopping List'}
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary mb-4"
        />

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-cb-border text-cb-text py-2 rounded-input text-sm font-medium hover:bg-cb-bg">Cancel</button>
          <button onClick={handleCreate} disabled={creating} className="flex-1 bg-cb-green text-white py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {creating ? '...' : 'Create List'}
          </button>
        </div>
      </div>
    </div>
  );
}
