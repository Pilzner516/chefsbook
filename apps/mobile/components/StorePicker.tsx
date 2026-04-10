import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { getUserStores, createStore, createShoppingList } from '@chefsbook/db';
import type { Store } from '@chefsbook/db';

interface Props {
  visible: boolean;
  onCreated: (listId: string, listName: string) => void;
  onCancel: () => void;
}

export function StorePicker({ visible, onCreated, onCancel }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [listName, setListName] = useState('');
  const [showNewStore, setShowNewStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible && session?.user?.id) {
      getUserStores(session.user.id).then(setStores);
    }
  }, [visible, session?.user?.id]);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setListName(store.name);
    setShowNewStore(false);
  };

  const handleAddNewStore = async () => {
    if (!session?.user?.id || !newStoreName.trim()) return;
    setCreating(true);
    try {
      const store = await createStore({ userId: session.user.id, name: newStoreName.trim() });
      setStores((prev) => [store, ...prev]);
      handleSelectStore(store);
      setNewStoreName('');
    } catch {}
    setCreating(false);
  };

  const handleCreate = async () => {
    if (!session?.user?.id) return;
    setCreating(true);
    try {
      const name = listName.trim() || selectedStore?.name || 'Shopping List';
      const list = await createShoppingList(session.user.id, name, {
        storeName: selectedStore?.name,
        storeId: selectedStore?.id,
      });
      onCreated(list.id, name);
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    }
    setCreating(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: insets.bottom + 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('storePicker.selectStore')}</Text>
            <TouchableOpacity onPress={onCancel}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 20, maxHeight: 250 }}>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.id}
                onPress={() => handleSelectStore(store)}
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12,
                  borderRadius: 10, marginBottom: 4,
                  backgroundColor: selectedStore?.id === store.id ? colors.accentSoft : 'transparent',
                }}
              >
                {store.logo_url ? (
                  <Image source={{ uri: store.logo_url }} style={{ width: 32, height: 32, borderRadius: 6 }} resizeMode="contain" />
                ) : (
                  <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>{store.initials}</Text>
                  </View>
                )}
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: selectedStore?.id === store.id ? '600' : '400', marginLeft: 12 }}>{store.name}</Text>
              </TouchableOpacity>
            ))}

            {/* New store option */}
            {!showNewStore && (
              <TouchableOpacity
                onPress={() => setShowNewStore(true)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={18} color={colors.accent} />
                </View>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600', marginLeft: 12 }}>{t('storePicker.newStore')}</Text>
              </TouchableOpacity>
            )}

            {showNewStore && (
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8 }}>
                <TextInput
                  value={newStoreName}
                  onChangeText={setNewStoreName}
                  placeholder={t('storePicker.storeName')}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  style={{
                    flex: 1, backgroundColor: colors.bgBase, borderRadius: 10, borderWidth: 1,
                    borderColor: colors.borderDefault, padding: 10, fontSize: 14, color: colors.textPrimary,
                  }}
                />
                <TouchableOpacity
                  onPress={handleAddNewStore}
                  disabled={!newStoreName.trim() || creating}
                  style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', opacity: newStoreName.trim() && !creating ? 1 : 0.5 }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>{creating ? '...' : t('storePicker.addStore')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* List name + create */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('storePicker.listName')}</Text>
            <TextInput
              value={listName}
              onChangeText={setListName}
              placeholder={selectedStore?.name ?? 'Shopping List'}
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bgBase, borderRadius: 10, borderWidth: 1,
                borderColor: colors.borderDefault, padding: 12, fontSize: 15, color: colors.textPrimary,
                marginBottom: 12,
              }}
            />
            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating}
              style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: creating ? 0.5 : 1 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{creating ? '...' : t('storePicker.createList')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
