import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { Button, Card, EmptyState, Loading, Input } from '../../components/UIKit';
import { canDo } from '@chefsbook/db/subscriptions';
import { groupBy } from '@chefsbook/ui';

export default function ShopTab() {
  const { colors } = useTheme();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);
  const { lists, currentList, loading, fetchLists, fetchList, addList, toggleItem, clearChecked } = useShoppingStore();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (session?.user?.id) fetchLists(session.user.id);
  }, [session?.user?.id]);

  const handleCreate = async () => {
    if (!session?.user?.id || !newName.trim()) return;
    await addList(session.user.id, newName.trim());
    setNewName('');
    setShowNew(false);
  };

  if (loading && !currentList) return <Loading message="Loading shopping lists..." />;

  if (currentList) {
    const grouped = groupBy(currentList.items, (i) => i.aisle);
    const checkedCount = currentList.items.filter((i) => i.is_checked).length;

    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity onPress={() => useShoppingStore.setState({ currentList: null })}>
            <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>{currentList.name}</Text>
          {checkedCount > 0 && (
            <TouchableOpacity onPress={() => clearChecked(currentList.id)}>
              <Text style={{ color: colors.danger, fontSize: 13 }}>Clear done</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {Object.entries(grouped).map(([aisle, items]) => (
            <View key={aisle} style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' }}>
                {aisle}
              </Text>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggleItem(item.id, !item.is_checked)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
                >
                  <Text style={{ fontSize: 18, marginRight: 10 }}>{item.is_checked ? '\u2611' : '\u2610'}</Text>
                  <Text
                    style={{
                      color: item.is_checked ? colors.textSecondary : colors.textPrimary,
                      fontSize: 15,
                      textDecorationLine: item.is_checked ? 'line-through' : 'none',
                      flex: 1,
                    }}
                  >
                    {item.quantity ? `${item.quantity} ${item.unit ?? ''} ` : ''}{item.ingredient}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

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

      {!showNew && <Button title="New Shopping List" onPress={() => setShowNew(true)} style={{ marginBottom: 16 }} />}

      <ScrollView>
        {lists.length === 0 ? (
          <EmptyState icon={'\uD83D\uDED2'} title="No shopping lists" message="Create a list or generate one from your meal plan." />
        ) : (
          lists.map((list) => (
            <Card key={list.id} onPress={() => fetchList(list.id)} style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{list.name}</Text>
              {list.date_range_start && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  {list.date_range_start} — {list.date_range_end}
                </Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
