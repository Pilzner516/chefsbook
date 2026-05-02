import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
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
import { supabase, getMenuRecipeImages, type Menu } from '@chefsbook/db';

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
  const editMenuAction = useMenuStore((s) => s.editMenu);
  const removeMenu = useMenuStore((s) => s.removeMenu);
  const tabBarHeight = useTabBarHeight();

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createOccasion, setCreateOccasion] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Edit modal state
  const [editMenu, setEditMenu] = useState<Menu | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublicNotes, setEditPublicNotes] = useState('');
  const [editPrivateNotes, setEditPrivateNotes] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [recipeImages, setRecipeImages] = useState<{ recipe_id: string; recipe_title: string; photos: { url: string; is_primary: boolean }[] }[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  const confirmDelete = (menuId: string, menuTitle: string) => {
    setDeleteTarget({ id: menuId, title: menuTitle });
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setShowDeleteDialog(false);
    try {
      await removeMenu(deleteTarget.id);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
    setDeleteTarget(null);
  };

  const openEditModal = (menu: Menu) => {
    setEditMenu(menu);
    setEditTitle(menu.title);
    setEditOccasion(menu.occasion ?? '');
    setEditDescription(menu.description ?? '');
    setEditPublicNotes(menu.public_notes ?? '');
    setEditPrivateNotes(menu.private_notes ?? '');
    setEditCoverUrl(menu.cover_image_url);
    setShowImagePicker(false);
    setRecipeImages([]);
  };

  const handleSaveEdit = async () => {
    if (!editMenu || !editTitle.trim()) return;
    setSaving(true);
    try {
      await editMenuAction(editMenu.id, {
        title: editTitle.trim(),
        occasion: editOccasion || null,
        description: editDescription.trim() || null,
        public_notes: editPublicNotes.trim() || null,
        private_notes: editPrivateNotes.trim() || null,
        cover_image_url: editCoverUrl,
      });
      setEditMenu(null);
      if (session?.user?.id) fetchMenus(session.user.id);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
    setSaving(false);
  };

  const loadRecipeImages = async () => {
    if (!editMenu) return;
    setLoadingImages(true);
    try {
      const images = await getMenuRecipeImages(editMenu.id);
      setRecipeImages(images);
    } catch (err) {
      console.error('Failed to load recipe images:', err);
    }
    setLoadingImages(false);
  };

  const handleChooseFromRecipes = () => {
    setShowImagePicker(true);
    loadRecipeImages();
  };

  const handleSelectRecipeImage = (url: string) => {
    setEditCoverUrl(url);
    setShowImagePicker(false);
  };

  const handlePickImage = async () => {
    if (!editMenu) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.uri) return;

    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileName = `${editMenu.id}/cover-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('menu-covers')
        .upload(fileName, blob, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from('menu-covers').getPublicUrl(fileName);
      setEditCoverUrl(data.publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
      Alert.alert(t('common.errorTitle'), 'Failed to upload image');
    }
    setUploading(false);
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
              onLongPress={() => confirmDelete(menu.id, menu.title)}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => openEditModal(menu)}
                        style={{ padding: 8, marginTop: -4 }}
                      >
                        <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDelete(menu.id, menu.title)}
                        style={{ padding: 8, marginTop: -4, marginRight: -4 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
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

      {/* Edit Menu Modal */}
      <Modal visible={!!editMenu} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{
                backgroundColor: colors.bgScreen,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
                paddingBottom: insets.bottom + 16,
              }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{t('menus.editMenu')}</Text>
                  <TouchableOpacity onPress={() => setEditMenu(null)}>
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.title')} *</Text>
                <TextInput
                  value={editTitle}
                  onChangeText={(txt) => setEditTitle(txt.slice(0, 80))}
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
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>{editTitle.length}/80</Text>

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.occasion')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {OCCASIONS.map((o) => (
                    <TouchableOpacity
                      key={o.value}
                      onPress={() => setEditOccasion(o.value)}
                      style={{
                        backgroundColor: editOccasion === o.value ? colors.accent : colors.bgBase,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                        marginRight: 8,
                        borderWidth: 1,
                        borderColor: editOccasion === o.value ? colors.accent : colors.borderDefault,
                      }}
                    >
                      <Text style={{
                        color: editOccasion === o.value ? '#fff' : colors.textPrimary,
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
                  value={editDescription}
                  onChangeText={(txt) => setEditDescription(txt.slice(0, 200))}
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
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 16 }}>{editDescription.length}/200</Text>

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.publicNotes')}</Text>
                <TextInput
                  value={editPublicNotes}
                  onChangeText={setEditPublicNotes}
                  placeholder={t('menus.publicNotesPlaceholder')}
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
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>{t('menus.privateNotes')}</Text>
                <TextInput
                  value={editPrivateNotes}
                  onChangeText={setEditPrivateNotes}
                  placeholder={t('menus.privateNotesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={2}
                  style={{
                    backgroundColor: '#fffbeb',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 15,
                    color: colors.textPrimary,
                    borderWidth: 1,
                    borderColor: '#fcd34d',
                    height: 60,
                    textAlignVertical: 'top',
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>{t('menus.cover_image')}</Text>
                {editCoverUrl && (
                  <View style={{ marginBottom: 12, position: 'relative', alignSelf: 'flex-start' }}>
                    <Image
                      source={{ uri: editCoverUrl, headers: { apikey: Constants.expoConfig?.extra?.supabaseAnonKey ?? '' } }}
                      style={{ width: 100, height: 60, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => setEditCoverUrl(null)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: colors.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                {!showImagePicker ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    <TouchableOpacity
                      onPress={handleChooseFromRecipes}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name="images-outline" size={16} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('menus.choose_from_recipes')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePickImage}
                      disabled={uploading}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                        opacity: uploading ? 0.5 : 1,
                      }}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={16} color={colors.textSecondary} />
                          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('menus.upload_image')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{
                    borderWidth: 1,
                    borderColor: colors.borderDefault,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 20,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{t('menus.choose_from_recipes')}</Text>
                      <TouchableOpacity onPress={() => setShowImagePicker(false)}>
                        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                    </View>
                    {loadingImages ? (
                      <Text style={{ textAlign: 'center', color: colors.textSecondary, paddingVertical: 16 }}>{t('common.loading')}</Text>
                    ) : recipeImages.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: colors.textSecondary, paddingVertical: 16 }}>{t('menus.no_recipe_images')}</Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {recipeImages.flatMap((ri) =>
                          ri.photos.map((photo, idx) => (
                            <TouchableOpacity
                              key={`${ri.recipe_id}-${idx}`}
                              onPress={() => handleSelectRecipeImage(photo.url)}
                              style={{ marginRight: 8 }}
                            >
                              <Image
                                source={{ uri: photo.url, headers: { apikey: Constants.expoConfig?.extra?.supabaseAnonKey ?? '' } }}
                                style={{ width: 70, height: 70, borderRadius: 8 }}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={saving || !editTitle.trim()}
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: saving || !editTitle.trim() ? 0.5 : 1,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                    {saving ? t('common.saving') : t('common.save')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setEditMenu(null)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ChefsDialog
        visible={showDeleteDialog}
        title={deleteTarget ? t('menus.deleteMenuTitle', { title: deleteTarget.title }) : t('menus.deleteMenu')}
        body={t('menus.deleteMenuBodySafe')}
        onClose={() => setShowDeleteDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowDeleteDialog(false) },
          { label: t('common.delete'), variant: 'secondary', onPress: handleDelete },
        ]}
      />
    </View>
  );
}
