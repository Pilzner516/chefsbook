import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useMenuStore } from '../../lib/zustand/menuStore';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Card, EmptyState, Loading } from '../../components/UIKit';
import ChefsDialog from '../../components/ChefsDialog';

const OCCASIONS = [
  { value: '', label: 'None' },
  { value: 'dinner_party', label: 'Dinner Party' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'special_occasion', label: 'Special Occasion' },
  { value: 'everyday', label: 'Everyday' },
  { value: 'custom', label: 'Custom' },
];

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function MenusTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const menus = useMenuStore((s) => s.menus);
  const loading = useMenuStore((s) => s.loading);
  const fetchMenus = useMenuStore((s) => s.fetchMenus);
  const addMenu = useMenuStore((s) => s.addMenu);
  const removeMenu = useMenuStore((s) => s.removeMenu);
  const tabBarHeight = useTabBarHeight();

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createOccasion, setCreateOccasion] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchMenus(session.user.id);
    }
  }, [session?.user?.id]);

  const handleCreate = async () => {
    if (!session?.user?.id || !createTitle.trim()) return;
    setSaving(true);
    try {
      const menu = await addMenu(session.user.id, {
        title: createTitle.trim(),
        occasion: createOccasion || null,
        description: createDescription.trim() || null,
      });
      setShowCreate(false);
      setCreateTitle('');
      setCreateOccasion('');
      setCreateDescription('');
      router.push(`/menu/${menu.id}` as any);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
    setSaving(false);
  };

  const confirmDelete = (menuId: string) => {
    setDeleteTarget(menuId);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setShowDeleteDialog(false);
    try {
      await removeMenu(deleteTarget);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
    setDeleteTarget(null);
  };

  const getOccasionLabel = (value: string | null) => {
    if (!value) return null;
    return OCCASIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ');
  };

  if (loading) return <Loading message={t('menus.loading')} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>{t('menus.myMenus')}</Text>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.accent,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            gap: 6,
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t('menus.newMenu')}</Text>
        </TouchableOpacity>
      </View>

      {menus.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="restaurant-outline" size={64} color={colors.textMuted} style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
            {t('menus.emptyTitle')}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
            {t('menus.emptyMessage')}
          </Text>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('menus.createFirst')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
          {menus.map((menu) => (
            <TouchableOpacity
              key={menu.id}
              onPress={() => router.push(`/menu/${menu.id}` as any)}
              onLongPress={() => confirmDelete(menu.id)}
              delayLongPress={500}
              style={{ marginBottom: 12 }}
            >
              <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.borderDefault }}>
                {/* Cover image */}
                {menu.cover_image_url ? (
                  <Image
                    source={{
                      uri: menu.cover_image_url,
                      headers: { apikey: Constants.expoConfig?.extra?.supabaseAnonKey ?? '' },
                    }}
                    style={{ width: '100%', height: 100 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: '100%', height: 80, backgroundColor: colors.bgBase, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="restaurant-outline" size={32} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ padding: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                        {menu.title}
                      </Text>
                      {menu.occasion && (
                        <View style={{
                          marginTop: 6,
                          backgroundColor: colors.accentSoft,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 12,
                          alignSelf: 'flex-start',
                        }}>
                          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '500' }}>
                            {getOccasionLabel(menu.occasion)}
                          </Text>
                        </View>
                      )}
                      {menu.description && (
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }} numberOfLines={2}>
                          {menu.description}
                        </Text>
                      )}
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
                        {relativeTime(menu.updated_at)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => confirmDelete(menu.id)}
                      style={{ padding: 8, marginTop: -4, marginRight: -4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create Menu Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: colors.bgScreen,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              paddingBottom: insets.bottom + 16,
            }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{t('menus.createMenu')}</Text>
                <TouchableOpacity onPress={() => setShowCreate(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.title')} *</Text>
              <TextInput
                value={createTitle}
                onChangeText={(t) => setCreateTitle(t.slice(0, 80))}
                placeholder={t('menus.titlePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.bgBase,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                  marginBottom: 4,
                }}
                maxLength={80}
              />
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>{createTitle.length}/80</Text>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.occasion')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {OCCASIONS.map((o) => (
                  <TouchableOpacity
                    key={o.value}
                    onPress={() => setCreateOccasion(o.value)}
                    style={{
                      backgroundColor: createOccasion === o.value ? colors.accent : colors.bgBase,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: createOccasion === o.value ? colors.accent : colors.borderDefault,
                    }}
                  >
                    <Text style={{
                      color: createOccasion === o.value ? '#fff' : colors.textPrimary,
                      fontSize: 13,
                      fontWeight: '500',
                    }}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.description')}</Text>
              <TextInput
                value={createDescription}
                onChangeText={(t) => setCreateDescription(t.slice(0, 200))}
                placeholder={t('menus.descriptionPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: colors.bgBase,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                  height: 60,
                  textAlignVertical: 'top',
                  marginBottom: 4,
                }}
                maxLength={200}
              />
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 20 }}>{createDescription.length}/200</Text>

              <TouchableOpacity
                onPress={handleCreate}
                disabled={saving || !createTitle.trim()}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: saving || !createTitle.trim() ? 0.5 : 1,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {saving ? t('common.saving') : t('menus.create')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowCreate(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ChefsDialog
        visible={showDeleteDialog}
        title={t('menus.deleteMenu')}
        body={t('menus.deleteMenuBody')}
        onClose={() => setShowDeleteDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowDeleteDialog(false) },
          { label: t('common.delete'), variant: 'secondary', onPress: handleDelete },
        ]}
      />
    </View>
  );
}
