# ChefsBook — Session 68: Offline Shopping List
# Source: Feature request 2026-04-11
# Target: apps/mobile (primary) + apps/web (sync indicator only)

---

## CROSS-PLATFORM REQUIREMENT
Offline storage is mobile-only (phones lose signal in supermarkets).
Web gets a sync status indicator only.
Read .claude/agents/data-flow.md, .claude/agents/ui-guardian.md,
and .claude/agents/deployment.md before starting.

---

## CONTEXT

Shopping lists must be fully usable offline. When a user opens a list in a
supermarket with no signal, they must see all items and be able to check them
off. When signal returns, quantity/item edits sync back to Supabase.
Checking off items is local-only (not synced — fresh list each trip).

---

## STORAGE ARCHITECTURE

Use **MMKV** for fast local storage on mobile (already available via
`react-native-mmkv` if installed, otherwise use AsyncStorage as fallback):

```bash
# Check if already installed:
grep "mmkv\|AsyncStorage" apps/mobile/package.json

# If not installed, use AsyncStorage (already in Expo):
# expo-secure-store is for auth, use @react-native-async-storage/async-storage
# for shopping list cache
```

### Cache structure
```ts
// Key: `shopping_list_${listId}`
// Value: JSON stringified ShoppingListCache
interface ShoppingListCache {
  list: ShoppingList;
  items: ShoppingListItem[];
  checkedItemIds: string[];  // local only, never synced
  lastSyncedAt: string;      // ISO timestamp
  pendingEdits: PendingEdit[]; // edits made offline, to sync
}

interface PendingEdit {
  id: string;
  type: 'update_quantity' | 'delete_item' | 'add_item';
  itemId?: string;
  data: Record<string, unknown>;
  createdAt: string;
}
```

---

## OFFLINE DETECTION

```ts
import NetInfo from '@react-native-community/netinfo';

// Hook to detect online/offline status:
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
```

Install if not present:
```bash
npx expo install @react-native-community/netinfo
```

---

## SHOPPING LIST STORE CHANGES

In the Zustand shopping store, update the list detail loading:

### On list open (online)
1. Fetch fresh data from Supabase
2. Cache to AsyncStorage: `shopping_list_${listId}`
3. Show data from Supabase

### On list open (offline)
1. Attempt Supabase fetch — fails/times out
2. Load from AsyncStorage cache
3. Show cached data with offline indicator banner
4. All interactions work against local cache only

### Checking off items (local only, never synced)
```ts
const toggleItemChecked = (itemId: string) => {
  // Update local cache only — never call Supabase for this
  updateLocalCache(listId, cache => ({
    ...cache,
    checkedItemIds: cache.checkedItemIds.includes(itemId)
      ? cache.checkedItemIds.filter(id => id !== itemId)
      : [...cache.checkedItemIds, itemId]
  }));
};
```

Checked state is stored in `checkedItemIds` in the local cache.
It is NEVER sent to Supabase. It resets when the list is refreshed online.

### Editing items (syncs when online)
When user edits a quantity or deletes an item while offline:
1. Apply change to local cache immediately (optimistic)
2. Add to `pendingEdits` array in cache
3. When online: process `pendingEdits` in order against Supabase
4. Clear `pendingEdits` after successful sync

```ts
const syncPendingEdits = async (listId: string) => {
  const cache = await getLocalCache(listId);
  if (!cache?.pendingEdits?.length) return;

  for (const edit of cache.pendingEdits) {
    try {
      if (edit.type === 'update_quantity') {
        await supabase.from('shopping_list_items')
          .update({ quantity: edit.data.quantity })
          .eq('id', edit.itemId);
      } else if (edit.type === 'delete_item') {
        await supabase.from('shopping_list_items')
          .delete().eq('id', edit.itemId);
      }
    } catch (e) {
      // Keep edit in pending if sync fails
      break;
    }
  }

  // Clear synced edits
  await updateLocalCache(listId, cache => ({ ...cache, pendingEdits: [] }));
};
```

Call `syncPendingEdits()` whenever the network status changes to online.

---

## OFFLINE UI

### Offline banner (shown at top of list when no connection)
```
┌─────────────────────────────────────────┐
│  📵  Offline — showing saved list       │
│  Changes will sync when you reconnect   │
└─────────────────────────────────────────┘
```
- Background: amber `#f59e0b`, white text
- Dismissible: no — stays visible while offline
- Disappears automatically when connection returns

### Sync indicator (shown when online, after offline session)
```
┌─────────────────────────────────────────┐
│  ✓  Back online — syncing changes...   │
└─────────────────────────────────────────┘
```
- Background: basil green `#009246`, white text
- Auto-dismisses after 3 seconds

### Last synced timestamp
Below the list name, show:
`Last updated: 2 hours ago` (relative time from `lastSyncedAt`)
Only show when offline — hidden when online.

### Checked items styling
Checked items show with:
- Strikethrough text
- Reduced opacity (0.5)
- Checkbox filled (green checkmark)
These are purely visual — no DB change.

---

## LIST OVERVIEW SCREEN (offline)

Cache the list overview (all lists with names and store info) separately:
```ts
// Key: `shopping_lists_overview_${userId}`
```

When offline, show the cached list of lists with a banner.
Tapping a list loads its cached detail.

---

## WEB SYNC INDICATOR

On the web shopping page, add a small sync status indicator in the header:
```
✓ Synced  (green, shown after successful Supabase fetch)
↻ Syncing... (grey, shown during fetch)
```

Web has no offline mode — if Supabase is unreachable, show:
```
⚠️ Connection issue — data may be outdated
```

---

## TESTING

Test offline mode on the emulator:
1. Load a shopping list (verify it caches)
2. Enable airplane mode on emulator:
   `adb shell svc wifi disable && adb shell svc data disable`
3. Close and reopen the app
4. Navigate to the shopping list — should load from cache with offline banner
5. Check off several items — verify strikethrough appears
6. Re-enable network: `adb shell svc wifi enable`
7. Verify sync banner appears briefly, checked items remain checked locally
8. Verify no Supabase errors in Metro logs

---

## DEPLOYMENT

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/repo
git pull
cd apps/web
NODE_OPTIONS=--max-old-space-size=1024 npm run build 2>&1 | tail -20
pm2 restart chefsbook-web
```

---

## COMPLETION CHECKLIST

- [ ] `@react-native-community/netinfo` installed
- [ ] `AsyncStorage` or MMKV used for shopping list cache
- [ ] List detail cached on load (online)
- [ ] List detail loads from cache when offline
- [ ] Offline banner shown when no connection
- [ ] Checked items stored locally only (never synced to Supabase)
- [ ] Checked items show strikethrough + reduced opacity
- [ ] Quantity/item edits queued as pendingEdits when offline
- [ ] pendingEdits sync to Supabase when connection returns
- [ ] Sync success banner shown briefly after reconnection
- [ ] Last synced timestamp shown when offline
- [ ] List overview also cached (can see all lists offline)
- [ ] Web: sync status indicator in shopping header
- [ ] Tested with airplane mode on emulator
- [ ] Deployed to RPi5 (web sync indicator)
- [ ] Run /wrapup to update DONE.md and CLAUDE.md
