import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { Button, Card, EmptyState, Loading, Input } from '../../components/UIKit';
import type { ShoppingListItem, StoreCategory } from '@chefsbook/db';

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
  const [viewMode, setViewMode] = useState<ViewMode>('department');
  const [manualInput, setManualInput] = useState('');
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState('');

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

  if (loading && !currentList) return <Loading message="Loading shopping lists..." />;

  // ── List detail view ──
  if (currentList) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => useShoppingStore.setState({ currentList: null })}>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'} Lists</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>{currentList.name}</Text>
          {checkedCount > 0 && (
            <TouchableOpacity onPress={() => clearChecked(currentList.id)}>
              <Text style={{ color: colors.danger, fontSize: 13 }}>Clear {checkedCount}</Text>
            </TouchableOpacity>
          )}
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
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                {DEPT_LABELS[group] || group}
              </Text>
              {groupItems.map((item) => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  {/* Checkbox */}
                  <TouchableOpacity onPress={() => toggleItem(item.id, !item.is_checked)} style={{ marginRight: 10 }}>
                    <Text style={{ fontSize: 18 }}>{'\u2610'}</Text>
                  </TouchableOpacity>

                  {/* Quantity (tappable to edit) */}
                  {editingQty === item.id ? (
                    <TextInput
                      value={editQtyValue}
                      onChangeText={setEditQtyValue}
                      onBlur={() => handleSaveQty(item.id)}
                      onSubmitEditing={() => handleSaveQty(item.id)}
                      autoFocus
                      style={{
                        width: 70, fontSize: 13, color: colors.accent,
                        borderBottomWidth: 1, borderBottomColor: colors.accent,
                        paddingVertical: 2, marginRight: 8,
                      }}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingQty(item.id);
                        setEditQtyValue(item.quantity_needed || [item.quantity, item.unit].filter(Boolean).join(' ') || '');
                      }}
                      style={{ marginRight: 8, minWidth: 50 }}
                    >
                      <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                        {item.quantity_needed || [item.quantity, item.unit].filter(Boolean).join(' ') || ''}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Ingredient name + recipe source */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{item.ingredient}</Text>
                    {item.recipe_name && (
                      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.recipe_name}</Text>
                    )}
                    {item.purchase_unit && (
                      <Text style={{ color: colors.accentGreen, fontSize: 11 }}>Buy: {item.purchase_unit}</Text>
                    )}
                  </View>

                  {/* Delete */}
                  <TouchableOpacity onPress={() => handleDeleteItem(item)} style={{ padding: 4 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{'\u00D7'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
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
            <EmptyState icon="🛒" title="Empty list" message="Add items from a recipe or type one above." />
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    );
  }

  // ── List overview ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen, padding: 16 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 16 }}>Shopping Lists</Text>

      {showNew && (
        <Card style={{ marginBottom: 16 }}>
          <Input value={newName} onChangeText={setNewName} placeholder="List name..." />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}><Button title="Create" onPress={handleCreate} /></View>
            <View style={{ flex: 1 }}><Button title="Cancel" onPress={() => setShowNew(false)} variant="ghost" /></View>
          </View>
        </Card>
      )}

      {!showNew && <View style={{ marginBottom: 16 }}><Button title="New Shopping List" onPress={() => setShowNew(true)} /></View>}

      <ScrollView>
        {lists.length === 0 ? (
          <EmptyState icon="🛒" title="No shopping lists" message="Create a list or generate one from your meal plan." />
        ) : (
          lists.map((list) => (
            <Card key={list.id} onPress={() => fetchList(list.id)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                    {list.pinned ? '📌 ' : ''}{list.name}
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
