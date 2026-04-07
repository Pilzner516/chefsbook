import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferencesStore } from '../../lib/zustand/preferencesStore';
import { convertIngredient, formatQuantity as formatQty } from '@chefsbook/ui';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Button, Card, EmptyState, Loading, Input } from '../../components/UIKit';
import type { ShoppingListItem, StoreCategory } from '@chefsbook/db';

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
  const router = useRouter();
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
  const removeList = useShoppingStore((s) => s.removeList);
  const subscribeLists = useShoppingStore((s) => s.subscribeLists);
  const subscribeItems = useShoppingStore((s) => s.subscribeItems);
  const unsubscribe = useShoppingStore((s) => s.unsubscribe);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedStore, setSelectedStore] = useState<string | null>(null); // null = Level 1 store view
  const [viewMode, setViewMode] = useState<ViewMode>('department');
  const [manualInput, setManualInput] = useState('');
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState('');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
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

  const handleCreate = async () => {
    if (!session?.user?.id || !newName.trim()) return;
    await addList(session.user.id, newName.trim());
    setNewName('');
    setShowNew(false);
  };

  const handleAddManual = async () => {
    if (!session?.user?.id || !currentList || !manualInput.trim()) return;
    await addManual(currentList.id, session.user.id, manualInput.trim());
    setManualInput('');
  };

  const handleDeleteItem = (item: ShoppingListItem) => {
    Alert.alert('Delete Item', `Remove "${item.ingredient}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(item.id) },
    ]);
  };

  const handleSaveQty = (itemId: string) => {
    updateItem(itemId, { quantity_needed: editQtyValue.trim() || null });
    setEditingQty(null);
  };

  const handleRemoveRecipeGroup = (groupName: string, groupItems: ShoppingListItem[]) => {
    Alert.alert(
      'Remove recipe',
      `Remove ${groupName} and its ${groupItems.length} ingredients from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            for (const item of groupItems) {
              await deleteItem(item.id);
            }
          },
        },
      ],
    );
  };

  const handleDeleteList = (listId: string, name: string) => {
    Alert.alert('Delete List', `Delete "${name}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeList(listId) },
    ]);
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

  // Group lists by store name for Level 1 (must be before early returns)
  const storeGroups = useMemo(() => {
    const groups: Record<string, typeof lists> = {};
    for (const list of lists) {
      const store = list.store_name || 'General';
      if (!groups[store]) groups[store] = [];
      groups[store].push(list);
    }
    return Object.entries(groups).sort(([a], [b]) =>
      a === 'General' ? 1 : b === 'General' ? -1 : a.localeCompare(b)
    );
  }, [lists]);

  const filteredLists = useMemo(() => {
    if (!selectedStore) return lists;
    if (selectedStore === '__all__') return lists;
    return lists.filter((l) => (l.store_name || 'General') === selectedStore);
  }, [lists, selectedStore]);

  if (loading && !currentList) return <Loading message="Loading shopping lists..." />;

  // ── List detail view ──
  if (currentList) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <ChefsBookHeader />
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => { useShoppingStore.setState({ currentList: null }); }}>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'} Lists</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>{currentList.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {checkedCount > 0 && (
              <TouchableOpacity onPress={() => clearChecked(currentList.id)}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>Clear {checkedCount}</Text>
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
                {mode === 'department' ? 'Dept' : mode === 'recipe' ? 'Recipe' : 'A-Z'}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={{ color: colors.textSecondary, fontSize: 13, alignSelf: 'center', marginLeft: 'auto' }}>
            {unchecked.length} items
          </Text>
        </View>

        {/* Add item manually */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
          <TextInput
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="Add item..."
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
            <EmptyState icon="🛒" title="Your shopping list is empty" message="Add recipes to your meal plan to generate a shopping list." action={{ label: 'Plan Meals', onPress: () => router.push('/(tabs)/plan') }} />
          )}

          <View style={{ height: tabBarHeight }} />
        </ScrollView>
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
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'} Stores</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
            {selectedStore === '__all__' ? 'All Lists' : selectedStore}
          </Text>

          {showNew && (
            <Card style={{ marginBottom: 16 }}>
              <Input value={newName} onChangeText={setNewName} placeholder="List name..." />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}><Button title="Create" onPress={handleCreate} /></View>
                <View style={{ flex: 1 }}><Button title="Cancel" onPress={() => setShowNew(false)} variant="ghost" /></View>
              </View>
            </Card>
          )}

          {!showNew && <View style={{ marginBottom: 16 }}><Button title="+ New Shopping List" onPress={() => setShowNew(true)} /></View>}

          {filteredLists.length === 0 ? (
            <EmptyState icon="🛒" title="No lists here" message="Create a new shopping list." />
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
      </View>
    );
  }

  // ── Level 1: Store/Group selector ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>Shopping Lists</Text>

        {/* All Lists quick access */}
        <Card onPress={() => setSelectedStore('__all__')} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22 }}>{'\uD83D\uDED2'}</Text>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>All Lists</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{lists.length} lists</Text>
              </View>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>{'\u203A'}</Text>
          </View>
        </Card>

        {/* Store groups */}
        {storeGroups.map(([store, storeLists]) => (
          <Card key={store} onPress={() => setSelectedStore(store)} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>{'\uD83C\uDFEA'}</Text>
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{store}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{storeLists.length} {storeLists.length === 1 ? 'list' : 'lists'}</Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 18 }}>{'\u203A'}</Text>
            </View>
          </Card>
        ))}

        {lists.length === 0 && (
          <EmptyState icon="🛒" title="No shopping lists" message="Create a list or generate one from your meal plan." action={{ label: 'Plan Meals', onPress: () => router.push('/(tabs)/plan') }} />
        )}

        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <Button title="+ New Shopping List" onPress={() => { setSelectedStore('__all__'); setShowNew(true); }} />
        </View>
      </ScrollView>
    </View>
  );
}
