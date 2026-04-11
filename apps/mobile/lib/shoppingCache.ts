import * as FileSystem from 'expo-file-system/legacy';
import type { ShoppingList, ShoppingListItem } from '@chefsbook/db';

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'shopping_cache/';

interface ShoppingListCache {
  list: ShoppingList;
  items: ShoppingListItem[];
  checkedItemIds: string[];
  lastSyncedAt: string;
  pendingEdits: PendingEdit[];
}

interface PendingEdit {
  id: string;
  type: 'update_quantity' | 'delete_item';
  itemId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

function listPath(listId: string) { return CACHE_DIR + `list_${listId}.json`; }
function overviewPath(userId: string) { return CACHE_DIR + `overview_${userId}.json`; }

// ── List detail cache ──

export async function cacheListDetail(listId: string, list: ShoppingList, items: ShoppingListItem[]): Promise<void> {
  await ensureDir();
  const existing = await getListCache(listId);
  const cache: ShoppingListCache = {
    list,
    items,
    checkedItemIds: existing?.checkedItemIds ?? [],
    lastSyncedAt: new Date().toISOString(),
    pendingEdits: existing?.pendingEdits ?? [],
  };
  await FileSystem.writeAsStringAsync(listPath(listId), JSON.stringify(cache));
}

export async function getListCache(listId: string): Promise<ShoppingListCache | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(listPath(listId));
    return JSON.parse(raw);
  } catch { return null; }
}

export async function toggleCheckedLocal(listId: string, itemId: string): Promise<string[]> {
  const cache = await getListCache(listId);
  if (!cache) return [];
  const ids = cache.checkedItemIds.includes(itemId)
    ? cache.checkedItemIds.filter((id) => id !== itemId)
    : [...cache.checkedItemIds, itemId];
  cache.checkedItemIds = ids;
  await FileSystem.writeAsStringAsync(listPath(listId), JSON.stringify(cache));
  return ids;
}

export async function addPendingEdit(listId: string, edit: Omit<PendingEdit, 'id' | 'createdAt'>): Promise<void> {
  const cache = await getListCache(listId);
  if (!cache) return;
  cache.pendingEdits.push({ ...edit, id: Date.now().toString(), createdAt: new Date().toISOString() });
  await FileSystem.writeAsStringAsync(listPath(listId), JSON.stringify(cache));
}

export async function clearPendingEdits(listId: string): Promise<void> {
  const cache = await getListCache(listId);
  if (!cache) return;
  cache.pendingEdits = [];
  await FileSystem.writeAsStringAsync(listPath(listId), JSON.stringify(cache));
}

// ── List overview cache ──

export async function cacheListOverview(userId: string, lists: ShoppingList[]): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(overviewPath(userId), JSON.stringify({ lists, cachedAt: new Date().toISOString() }));
}

export async function getListOverviewCache(userId: string): Promise<{ lists: ShoppingList[]; cachedAt: string } | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(overviewPath(userId));
    return JSON.parse(raw);
  } catch { return null; }
}

// ── Sync pending edits ──

export async function syncPendingEdits(listId: string): Promise<number> {
  const { supabase } = await import('@chefsbook/db');
  const cache = await getListCache(listId);
  if (!cache?.pendingEdits?.length) return 0;

  let synced = 0;
  for (const edit of cache.pendingEdits) {
    try {
      if (edit.type === 'update_quantity') {
        await supabase.from('shopping_list_items').update({ quantity: edit.data.quantity }).eq('id', edit.itemId);
      } else if (edit.type === 'delete_item') {
        await supabase.from('shopping_list_items').delete().eq('id', edit.itemId);
      }
      synced++;
    } catch { break; }
  }

  if (synced > 0) {
    cache.pendingEdits = cache.pendingEdits.slice(synced);
    await FileSystem.writeAsStringAsync(listPath(listId), JSON.stringify(cache));
  }
  return synced;
}

// ── Network check (simple fetch timeout) ──

export async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch('https://api.chefsbk.app/rest/v1/', { signal: controller.signal, method: 'HEAD' });
    clearTimeout(timer);
    return true;
  } catch { return false; }
}
