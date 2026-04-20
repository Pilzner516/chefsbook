import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreferencesStore } from '../../lib/zustand/preferencesStore';
import { convertIngredient, formatQuantity as formatQty } from '@chefsbook/ui';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { StoreAvatar } from '../../components/StoreAvatar';
import { Button, Card, EmptyState, Loading, Input } from '../../components/UIKit';
import ChefsDialog from '../../components/ChefsDialog';
import { StorePicker } from '../../components/StorePicker';
import type { ShoppingListItem, StoreCategory } from '@chefsbook/db';

// TODO(web): replicate store-first creation flow and store grouping in apps/web/dashboard/shopping

type FontSize = 'small' | 'medium' | 'large';
const FONT_KEY = 'shopping_font_size';
const FONT_SCALES: Record<FontSize, { qty: number; name: number; sub: number; dept: number }> = {
  small:  { qty: 12, name: 13, sub: 10, dept: 11 },
  medium: { qty: 14, name: 15, sub: 11, dept: 13 },
  large:  { qty: 17, name: 18, sub: 13, dept: 15 },
};
const FONT_LABELS: FontSize[] = ['small', 'medium', 'large'];

const DEPT_ORDER: (StoreCategory | 'uncategorized')[] = [
  'produce', 'meat_seafood', 'dairy_eggs', 'baking', 'bakery',
  'pasta_grains', 'canned', 'condiments', 'spices', 'frozen',
  'beverages', 'household', 'other',
];

const DEPT_LABELS: Record<string, string> = {
  produce: 'Produce',
  meat_seafood: 'Meat & Seafood',
  dairy_eggs: 'Dairy & Eggs',
  baking: 'Baking',
  bakery: 'Bakery',
  pasta_grains: 'Pasta & Grains',
  canned: 'Canned & Jarred',
  condiments: 'Condiments & Sauces',
  spices: 'Spices & Seasonings',
  frozen: 'Frozen',
  beverages: 'Beverages',
  household: 'Household',
  other: 'Other',
  uncategorized: 'Other',
};

type ViewMode = 'department' | 'recipe' | 'alpha';

export default function ShopTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const session = useAuthStore((s) => s.session);
  const lists = useShoppingStore((s) => s.lists);
  const currentList = useShoppingStore((s) => s.currentList);
  const loading = useShoppingStore((s) => s.loading);
  const fetchLists = useShoppingStore((s) => s.fetchLists);
  const fetchList = useShoppingStore((s) => s.fetchList);
  const addList = useShoppingStore((s) => s.addList);
  const toggleItem = useShoppingStore((s) => s.toggleItem);
  const deleteItem = useShoppingStore((s) => s.deleteItem);
  const updateItem = useShoppingStore((s) => s.updateItem);
  const addManual = useShoppingStore((s) => s.addManual);
  const clearChecked = useShoppingStore((s) => s.clearChecked);
  const isOffline = useShoppingStore((s) => s.isOffline);
  const checkedItemIds = useShoppingStore((s) => s.checkedItemIds);
  const toggleItemLocal = useShoppingStore((s) => s.toggleItemLocal);
  const lastSyncedAt = useShoppingStore((s) => s.lastSyncedAt);
  const removeList = useShoppingStore((s) => s.removeList);
  const subscribeLists = useShoppingStore((s) => s.subscribeLists);
  const subscribeItems = useShoppingStore((s) => s.subscribeItems);
  const unsubscribe = useShoppingStore((s) => s.unsubscribe);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newStoreStep, setNewStoreStep] = useState<'store' | 'name'>('store');
  const [selectedStore, setSelectedStore] = useState<string | null>(null); // null = Level 1 store view
  const [showCombined, setShowCombined] = useState<string | null>(null); // store name for combined view
  const [viewMode, setViewMode] = useState<ViewMode>('department');
  const [manualInput, setManualInput] = useState('');
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState('');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<ShoppingListItem | null>(null);
  const [showRemoveRecipeDialog, setShowRemoveRecipeDialog] = useState(false);
  const [pendingRemoveGroup, setPendingRemoveGroup] = useState<{ name: string; items: ShoppingListItem[] } | null>(null);
  const [showDeleteListDialog, setShowDeleteListDialog] = useState(false);
  const [pendingDeleteList, setPendingDeleteList] = useState<{ id: string; name: string } | null>(null);
  const fs = FONT_SCALES[fontSize];
  const preferredUnits = usePreferencesStore((s) => s.units);

  // Load persisted font size
  useEffect(() => {
    SecureStore.getItemAsync(FONT_KEY).then((v) => {
      if (v && FONT_LABELS.includes(v as FontSize)) setFontSize(v as FontSize);
    });
  }, []);

  const cycleFontSize = useCallback(() => {
    const next = FONT_LABELS[(FONT_LABELS.indexOf(fontSize) + 1) % FONT_LABELS.length];
    setFontSize(next);
    SecureStore.setItemAsync(FONT_KEY, next);
  }, [fontSize]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchLists(session.user.id);
      subscribeLists(session.user.id);
    }
    return () => unsubscribe();
  }, [session?.user?.id]);

  useEffect(() => {
    if (currentList?.id) subscribeItems(currentList.id);
  }, [currentList?.id]);

  const openNewListModal = () => {
    setShowNewModal(true);
  };

  const handleStorePickerCreated = async (listId: string, listName: string) => {
    setShowNewModal(false);
    if (session?.user?.id) await fetchLists(session.user.id);
  };

  const handleAddManual = async () => {
    if (!session?.user?.id || !currentList || !manualInput.trim()) return;
    await addManual(currentList.id, session.user.id, manualInput.trim());
    setManualInput('');
  };

  const handleDeleteItem = (item: ShoppingListItem) => {
    setPendingDeleteItem(item);
    setShowDeleteItemDialog(true);
  };

  const handleSaveQty = (itemId: string) => {
    updateItem(itemId, { quantity_needed: editQtyValue.trim() || null });
    setEditingQty(null);
  };

  const handleRemoveRecipeGroup = (groupName: string, groupItems: ShoppingListItem[]) => {
    setPendingRemoveGroup({ name: groupName, items: groupItems });
    setShowRemoveRecipeDialog(true);
  };

  const handleDeleteList = (listId: string, name: string) => {
    setPendingDeleteList({ id: listId, name });
    setShowDeleteListDialog(true);
  };

  const items = currentList?.items ?? [];
  const unchecked = useMemo(() => items.filter((i) => !i.is_checked), [items]);
  const checked = useMemo(() => items.filter((i) => i.is_checked), [items]);
  const checkedCount = checked.length;

  // Group items based on view mode
  const grouped = useMemo(() => {
    if (viewMode === 'department') {
      const groups: Record<string, ShoppingListItem[]> = {};
      for (const item of unchecked) {
        const dept = item.category || 'other';
        if (!groups[dept]) groups[dept] = [];
        groups[dept].push(item);
      }
      const sorted: [string, ShoppingListItem[]][] = [];
      for (const dept of DEPT_ORDER) {
        if (groups[dept]) sorted.push([dept, groups[dept]]);
      }
      for (const [dept, items] of Object.entries(groups)) {
        if (!DEPT_ORDER.includes(dept as any)) sorted.push([dept, items]);
      }
      return sorted;
    }
    if (viewMode === 'recipe') {
      const groups: Record<string, ShoppingListItem[]> = {};
      for (const item of unchecked) {
        const recipe = item.recipe_name || 'Uncategorized';
        if (!groups[recipe]) groups[recipe] = [];
        groups[recipe].push(item);
      }
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }
    // alpha
    const sorted = [...unchecked].sort((a, b) => a.ingredient.localeCompare(b.ingredient));
    return [['All Items', sorted]] as [string, ShoppingListItem[]][];
  }, [unchecked, viewMode]);

  // Group lists by store name for Level 1 — case-insensitive
  const storeGroups = useMemo(() => {
    const groups: Record<string, { displayName: string; items: typeof lists }> = {};
    for (const list of lists) {
      const key = (list.store_name ?? '').toLowerCase().trim() || 'general';
      if (!groups[key]) groups[key] = { displayName: list.store_name || 'General', items: [] };
      groups[key].items.push(list);
    }
    return Object.entries(groups)
      .map(([key, { displayName, items }]) => [displayName, items] as [string, typeof lists])
      .sort(([a], [b]) => a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b));
  }, [lists]);

  const filteredLists = useMemo(() => {
    if (!selectedStore) return lists;
    if (selectedStore === '__all__') return lists;
    return lists.filter((l) => (l.store_name ?? '').toLowerCase().trim() === selectedStore.toLowerCase().trim());
  }, [lists, selectedStore]);

  // Unique store names for the creation picker
  const existingStores = useMemo(() => {
    const stores = new Set<string>();
    for (const list of lists) {
      if (list.store_name) stores.add(list.store_name);
    }
    return [...stores].sort();
  }, [lists]);

  if (loading && !currentList) return <Loading message={t('common.loading')} />;

  // ── Combined view: read-only merged items for a store ──
  if (showCombined) {
    return (
      <CombinedStoreView
        storeName={showCombined}
        lists={lists.filter((l) => (l.store_name || 'General') === showCombined)}
        colors={colors}
        tabBarHeight={tabBarHeight}
        preferredUnits={preferredUnits}
        onBack={() => setShowCombined(null)}
        onOpenList={(id) => { setShowCombined(null); fetchList(id); }}
      />
    );
  }

  const shopDialogs = (
    <>
      <ChefsDialog
        visible={showDeleteItemDialog}
        title={t('shop.deleteItem')}
        body={pendingDeleteItem ? t('shop.removeIngredient', { name: pendingDeleteItem.ingredient }) : ''}
        onClose={() => setShowDeleteItemDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowDeleteItemDialog(false) },
          { label: t('common.delete'), variant: 'secondary', onPress: () => { setShowDeleteItemDialog(false); if (pendingDeleteItem) { deleteItem(pendingDeleteItem.id); setPendingDeleteItem(null); } } },
        ]}
      />
      <ChefsDialog
        visible={showRemoveRecipeDialog}
        title={t('shop.removeRecipe')}
        body={pendingRemoveGroup ? t('shop.removeRecipeBody', { name: pendingRemoveGroup.name, count: pendingRemoveGroup.items.length }) : ''}
        onClose={() => setShowRemoveRecipeDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowRemoveRecipeDialog(false) },
          { label: t('common.remove'), variant: 'secondary', onPress: async () => { setShowRemoveRecipeDialog(false); if (pendingRemoveGroup) { for (const item of pendingRemoveGroup.items) await deleteItem(item.id); setPendingRemoveGroup(null); } } },
        ]}
      />
      <ChefsDialog
        visible={showDeleteListDialog}
        title={t('shop.deleteList')}
        body={pendingDeleteList ? t('shop.deleteListBody', { name: pendingDeleteList.name }) : ''}
        onClose={() => setShowDeleteListDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowDeleteListDialog(false) },
          { label: t('common.delete'), variant: 'secondary', onPress: () => { setShowDeleteListDialog(false); if (pendingDeleteList) { removeList(pendingDeleteList.id); setPendingDeleteList(null); } } },
        ]}
      />
    </>
  );

  // ── List detail view ──
  if (currentList) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <ChefsBookHeader />
        {/* Offline banner */}
        {isOffline && (
          <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>📵 Offline — showing saved list</Text>
          </View>
        )}
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => { useShoppingStore.setState({ currentList: null }); }}>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'} {t('shop.shoppingLists')}</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>{currentList.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {checkedCount > 0 && (
              <TouchableOpacity onPress={() => clearChecked(currentList.id)}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>{t('shop.clearCount', { count: checkedCount })}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={cycleFontSize} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.bgBase }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
                {fontSize === 'small' ? 'A' : fontSize === 'medium' ? 'A+' : 'A++'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View mode toggle */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
          {(['department', 'recipe', 'alpha'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                backgroundColor: viewMode === mode ? colors.accent : colors.bgBase,
              }}
            >
              <Text style={{
                color: viewMode === mode ? '#fff' : colors.textSecondary,
                fontSize: 13, fontWeight: '600',
              }}>
                {mode === 'department' ? t('shop.dept') : mode === 'recipe' ? t('shop.recipe2') : t('shop.az')}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color: colors.textSecondary, fontSize: 13, alignSelf: 'center', marginLeft: 'auto' }}>
            {t('shop.items', { count: unchecked.length })}
          </Text>
        </View>

        {/* Add item manually */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
          <TextInput
            value={manualInput}
            onChangeText={setManualInput}
            placeholder={t('shop.addItem')}
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={handleAddManual}
            returnKeyType="done"
            style={{
              flex: 1, backgroundColor: colors.bgBase, borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 8,
              fontSize: 14, color: colors.textPrimary,
              borderWidth: 1, borderColor: colors.borderDefault,
            }}
          />
          <TouchableOpacity
            onPress={handleAddManual}
            disabled={!manualInput.trim()}
            style={{
              backgroundColor: manualInput.trim() ? colors.accent : colors.bgBase,
              borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center',
            }}
          >
            <Text style={{ color: manualInput.trim() ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 14 }}>+</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          {/* Active items grouped */}
          {grouped.map(([group, groupItems]) => (
            <View key={group} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: colors.accent, fontSize: fs.dept, fontWeight: '700', textTransform: 'uppercase', flex: 1 }}>
                  {DEPT_LABELS[group] || group}
                </Text>
                {viewMode === 'recipe' && group !== 'Uncategorized' && (
                  <TouchableOpacity onPress={() => handleRemoveRecipeGroup(group, groupItems)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {groupItems.map((item) => {
                const converted = convertIngredient(item.quantity, item.unit, preferredUnits, item.ingredient);
                const rawQty = [converted.quantity ? formatQty(converted.quantity) : item.quantity, converted.unit || item.unit].filter(Boolean).join(' ');
                const displayQty = item.purchase_unit || rawQty;
                const usageQty = item.purchase_unit ? rawQty : '';

                return (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 }}>
                    {/* Checkbox */}
                    <TouchableOpacity onPress={() => toggleItem(item.id, !item.is_checked)} style={{ marginRight: 10, marginTop: 2 }}>
                      <Text style={{ fontSize: 18 }}>{'\u2610'}</Text>
                    </TouchableOpacity>

                    {/* Purchase unit (tappable to edit) */}
                    {editingQty === item.id ? (
                      <TextInput
                        value={editQtyValue}
                        onChangeText={setEditQtyValue}
                        onBlur={() => handleSaveQty(item.id)}
                        onSubmitEditing={() => handleSaveQty(item.id)}
                        autoFocus
                        style={{
                          width: 80, fontSize: fs.qty, color: colors.accent,
                          borderBottomWidth: 1, borderBottomColor: colors.accent,
                          paddingVertical: 2, marginRight: 8,
                        }}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setEditingQty(item.id);
                          setEditQtyValue(item.purchase_unit || rawQty || '');
                        }}
                        style={{ marginRight: 8, minWidth: 55 }}
                      >
                        <Text style={{ color: colors.accent, fontSize: fs.qty, fontWeight: '600' }}>
                          {displayQty || ''}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Ingredient name + recipe source + usage */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: fs.name }}>{item.ingredient}</Text>
                      {item.recipe_name && (
                        <Text style={{ color: colors.textSecondary, fontSize: fs.sub }}>{item.recipe_name}</Text>
                      )}
                      {usageQty ? (
                        <Text style={{ color: colors.accentGreen, fontSize: fs.sub }}>{usageQty} in recipe</Text>
                      ) : null}
                    </View>

                    {/* Delete */}
                    <TouchableOpacity onPress={() => handleDeleteItem(item)} style={{ padding: 4 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'\u00D7'}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Checked items at bottom */}
          {checked.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                Done ({checked.length})
              </Text>
              {checked.map((item) => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                  <TouchableOpacity onPress={() => toggleItem(item.id, false)} style={{ marginRight: 10 }}>
                    <Text style={{ fontSize: 18 }}>{'\u2611'}</Text>
                  </TouchableOpacity>
                  <Text style={{
                    color: colors.textSecondary, fontSize: 14, flex: 1,
                    textDecorationLine: 'line-through',
                  }}>
                    {item.quantity_needed ? `${item.quantity_needed} ` : ''}{item.ingredient}
                  </Text>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={{ padding: 4 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'\u00D7'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {items.length === 0 && (
            <EmptyState icon="🛒" title={t('shop.emptyTitle')} message={t('shop.emptyMessage')} action={{ label: t('shop.planMeals'), onPress: () => router.push('/(tabs)/plan') }} />
          )}

          <View style={{ height: tabBarHeight }} />
        </ScrollView>
        {shopDialogs}
      </View>
    );
  }

  // ── Level 2: Lists within a store ──
  if (selectedStore) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <ChefsBookHeader />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}>
          <TouchableOpacity onPress={() => setSelectedStore(null)} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'} {t('shop.shoppingLists')}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            {selectedStore !== '__all__' && <StoreAvatar storeName={selectedStore} size={48} />}
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', flex: 1 }}>
              {selectedStore === '__all__' ? t('shop.allLists') : selectedStore}
            </Text>
          </View>

          {/* Concatenated "All [Store]" entry for multi-list stores */}
          {selectedStore !== '__all__' && filteredLists.length > 1 && (
            <Card onPress={() => setShowCombined(selectedStore)} style={{ marginBottom: 10, borderWidth: 1, borderColor: colors.accentGreen, borderStyle: 'dashed' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons name="layers-outline" size={20} color={colors.accentGreen} />
                  <View>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t('shop.allStore', { store: selectedStore })}</Text>
                    <Text style={{ color: colors.accentGreen, fontSize: 12, fontWeight: '600' }}>{t('shop.combinedView')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </View>
            </Card>
          )}

          <View style={{ marginBottom: 16 }}>
            <Button title={t('shop.newListShort')} onPress={openNewListModal} />
          </View>

          {filteredLists.length === 0 ? (
            <EmptyState icon="🛒" title={t('shop.noListsHere')} message={t('shop.createList')} />
          ) : (
            filteredLists.map((list) => (
              <Card key={list.id} onPress={() => fetchList(list.id)} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                      {list.pinned ? '\uD83D\uDCCC ' : ''}{list.name}
                    </Text>
                    {list.date_range_start && (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                        {list.date_range_start} — {list.date_range_end}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); handleDeleteList(list.id, list.name); }}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'\u00D7'}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </ScrollView>

        {/* New List Modal */}
        <StorePicker
          visible={showNewModal}
          onCreated={handleStorePickerCreated}
          onCancel={() => setShowNewModal(false)}
        />
        {shopDialogs}
      </View>
    );
  }

  // ── Level 1: Store/Group selector ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>{t('shop.shoppingLists')}</Text>

        {/* Store groups */}
        {storeGroups.map(([store, storeLists]) => (
          <Card key={store} onPress={() => setSelectedStore(store)} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <StoreAvatar storeName={store} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{store}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    {t('shop.listCount', { count: storeLists.length })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </Card>
        ))}

        {lists.length === 0 && (
          <EmptyState icon="🛒" title={t('shop.noLists')} message={t('shop.noListsMessage')} action={{ label: t('shop.planMeals'), onPress: () => router.push('/(tabs)/plan') }} />
        )}

        <View style={{ marginTop: 12, marginBottom: insets.bottom + 16 }}>
          <Button title={t('shop.newList')} onPress={openNewListModal} />
        </View>
      </ScrollView>

      {/* New List Modal */}
      <StorePicker
        visible={showNewModal}
        onCreated={handleStorePickerCreated}
        onCancel={() => setShowNewModal(false)}
      />
    </View>
  );
}

// ── Combined Store View (read-only merged items) ──

function CombinedStoreView({
  storeName, lists: storeLists, colors, tabBarHeight, preferredUnits, onBack, onOpenList,
}: {
  storeName: string;
  lists: any[];
  colors: any;
  tabBarHeight: number;
  preferredUnits: 'metric' | 'imperial';
  onBack: () => void;
  onOpenList: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('department');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const fs = FONT_SCALES[fontSize];
  const toggleCheck = (id: string) => setCheckedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const cycleFontSize = () => {
    const next = FONT_LABELS[(FONT_LABELS.indexOf(fontSize) + 1) % FONT_LABELS.length];
    setFontSize(next);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import('@chefsbook/db');
      const listIds = storeLists.map((l) => l.id);
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*')
        .in('list_id', listIds)
        .eq('is_checked', false)
        .order('category')
        .order('ingredient');
      if (!cancelled) {
        // Merge duplicates: same ingredient + unit → sum quantities
        const merged = new Map<string, ShoppingListItem>();
        for (const item of (data ?? []) as ShoppingListItem[]) {
          const key = `${item.ingredient.toLowerCase()}|${(item.unit || '').toLowerCase()}`;
          const existing = merged.get(key);
          if (existing) {
            existing.quantity = (existing.quantity ?? 0) + (item.quantity ?? 0);
            if (item.recipe_name && existing.recipe_name && !existing.recipe_name.includes(item.recipe_name)) {
              existing.recipe_name = `${existing.recipe_name}, ${item.recipe_name}`;
            }
          } else {
            merged.set(key, { ...item });
          }
        }
        setAllItems([...merged.values()]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeLists.map((l) => l.id).join(',')]);

  const unchecked = allItems.filter((i) => !checkedIds.has(i.id));

  // Group items based on view mode (same logic as individual list)
  const grouped = useMemo(() => {
    if (viewMode === 'department') {
      const groups: Record<string, ShoppingListItem[]> = {};
      for (const item of unchecked) {
        const dept = item.category || 'other';
        if (!groups[dept]) groups[dept] = [];
        groups[dept].push(item);
      }
      return Object.entries(groups).sort(([a], [b]) => {
        const ai = DEPT_ORDER.indexOf(a as any);
        const bi = DEPT_ORDER.indexOf(b as any);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }).map(([key, items]) => ({ label: DEPT_LABELS[key] || key, items }));
    }
    if (viewMode === 'recipe') {
      const groups: Record<string, ShoppingListItem[]> = {};
      for (const item of unchecked) {
        const key = item.recipe_name || 'Other items';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
      return Object.entries(groups).map(([label, items]) => ({ label, items }));
    }
    // alpha
    return [{ label: '', items: [...unchecked].sort((a, b) => a.ingredient.localeCompare(b.ingredient)) }];
  }, [allItems, checkedIds, viewMode]);

  if (loading) return <Loading message={t('common.loading')} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 12 }}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'}</Text>
        </TouchableOpacity>
        <StoreAvatar storeName={storeName} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>{t('shop.allStore', { store: storeName })}</Text>
          <Text style={{ color: colors.accentGreen, fontSize: 12, fontWeight: '600' }}>{t('shop.combinedItems', { count: unchecked.length })}</Text>
        </View>
        <TouchableOpacity onPress={cycleFontSize} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.bgBase }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
            {fontSize === 'small' ? 'A' : fontSize === 'medium' ? 'A+' : 'A++'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Banner — source lists */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36, paddingHorizontal: 16, marginBottom: 8 }}>
        {storeLists.map((list) => (
          <TouchableOpacity
            key={list.id}
            onPress={() => onOpenList(list.id)}
            style={{
              backgroundColor: colors.bgBase, borderRadius: 16,
              paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
              borderWidth: 1, borderColor: colors.borderDefault,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{list.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* View mode toggle */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
        {(['department', 'recipe', 'alpha'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
              backgroundColor: viewMode === mode ? colors.accent : colors.bgBase,
            }}
          >
            <Text style={{
              color: viewMode === mode ? '#fff' : colors.textSecondary,
              fontSize: 13, fontWeight: '600',
            }}>
              {mode === 'department' ? t('shop.dept') : mode === 'recipe' ? t('shop.recipe2') : t('shop.az')}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={{ color: colors.textSecondary, fontSize: 13, alignSelf: 'center', marginLeft: 'auto' }}>
          {t('shop.items', { count: unchecked.length })}
        </Text>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {grouped.map((group) => (
          <View key={group.label} style={{ marginBottom: 16 }}>
            {group.label ? (
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 }}>
                {group.label} ({group.items.length})
              </Text>
            ) : null}
            {group.items.map((item) => {
              const converted = convertIngredient(item.quantity, item.unit, preferredUnits, item.ingredient);
              const rawQty = [converted.quantity ? formatQty(converted.quantity) : null, converted.unit || item.unit].filter(Boolean).join(' ');
              const displayQty = item.purchase_unit || rawQty;
              const usageQty = item.purchase_unit ? rawQty : '';

              const isChecked = checkedIds.has(item.id);
              return (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, opacity: isChecked ? 0.5 : 1 }}>
                  <TouchableOpacity onPress={() => toggleCheck(item.id)} style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: isChecked ? colors.accentGreen : colors.borderDefault, backgroundColor: isChecked ? colors.accentGreen : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 1 }}>
                    {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </TouchableOpacity>
                  <Text style={{ color: colors.accent, fontSize: fs.qty, fontWeight: '600', minWidth: 60, marginRight: 8 }}>
                    {displayQty}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: fs.name, textDecorationLine: isChecked ? 'line-through' : 'none' }}>{item.ingredient}</Text>
                    {item.recipe_name && viewMode !== 'recipe' && (
                      <Text style={{ color: colors.textSecondary, fontSize: fs.sub }}>{item.recipe_name}</Text>
                    )}
                    {usageQty ? (
                      <Text style={{ color: colors.accentGreen, fontSize: fs.sub }}>{usageQty} in recipe</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <View style={{ height: tabBarHeight }} />
      </ScrollView>
    </View>
  );
}

// ── New List Modal (store-first creation) ──

function NewListModal({
  visible, onClose, step, storeName, listName, existingStores,
  onSelectStore, onChangeStoreName, onChangeListName, onBack, onCreate, colors,
}: {
  visible: boolean;
  onClose: () => void;
  step: 'store' | 'name';
  storeName: string;
  listName: string;
  existingStores: string[];
  onSelectStore: (store: string) => void;
  onChangeStoreName: (name: string) => void;
  onChangeListName: (name: string) => void;
  onBack: () => void;
  onCreate: () => void;
  colors: any;
}) {
  const { t } = useTranslation();
  const [customStore, setCustomStore] = useState('');
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: '80%', paddingTop: 16, paddingBottom: insets.bottom + 16,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />

          {step === 'store' ? (
            // Step 1: Select or create a store
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('shop.selectStore')}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {/* Existing stores */}
                {existingStores.map((store) => (
                  <TouchableOpacity
                    key={store}
                    onPress={() => onSelectStore(store)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: colors.borderDefault, gap: 12,
                    }}
                  >
                    <StoreAvatar storeName={store} size={36} />
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500', flex: 1 }}>{store}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}

                {/* New store input */}
                <View style={{ padding: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t('shop.newStore')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={customStore}
                      onChangeText={setCustomStore}
                      placeholder={t('shop.storePlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      style={{
                        flex: 1, backgroundColor: colors.bgBase, borderRadius: 10,
                        paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
                        color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (customStore.trim()) {
                          onSelectStore(customStore.trim());
                          setCustomStore('');
                        }
                      }}
                      disabled={!customStore.trim()}
                      style={{
                        backgroundColor: customStore.trim() ? colors.accent : colors.bgBase,
                        borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: customStore.trim() ? '#fff' : colors.textMuted, fontWeight: '600' }}>{t('common.next')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          ) : (
            // Step 2: Name the list
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={onBack}>
                  <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
                    <Ionicons name="chevron-back" size={16} color={colors.accent} /> {t('common.back')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <StoreAvatar storeName={storeName} size={48} />
                <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>{storeName}</Text>
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                {t('shop.listNameOptional')}
              </Text>
              <TextInput
                value={listName}
                onChangeText={onChangeListName}
                placeholder={storeName}
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.bgBase, borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
                  color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault,
                  marginBottom: 20,
                }}
              />

              <TouchableOpacity
                onPress={onCreate}
                style={{
                  backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14,
                  alignItems: 'center', marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('shop.createList2')}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
