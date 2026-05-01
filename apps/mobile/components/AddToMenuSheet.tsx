import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { getUserMenus, createMenu, addMenuItem, isRecipeInMenu, getMaxSortOrder } from '@chefsbook/db';
import type { Menu, MenuCourse } from '@chefsbook/db';
import { COURSE_ORDER, COURSE_LABELS } from '@chefsbook/db';

interface Props {
  recipeIds: string[];
  visible: boolean;
  onClose: () => void;
  onSuccess?: (menuTitle: string, course: string, added: number, skipped: number) => void;
}

const OCCASIONS = [
  { value: '', label: 'None' },
  { value: 'dinner_party', label: 'Dinner Party' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'date_night', label: 'Date Night' },
  { value: 'special_occasion', label: 'Special Occasion' },
  { value: 'everyday', label: 'Everyday' },
];

export function AddToMenuSheet({ recipeIds, visible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);

  const [step, setStep] = useState<'menu' | 'course'>('menu');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<MenuCourse>('main');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newMenuTitle, setNewMenuTitle] = useState('');
  const [newMenuOccasion, setNewMenuOccasion] = useState('');
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('menu');
      setSelectedMenu(null);
      setSelectedCourse('main');
      setShowNewMenu(false);
      setNewMenuTitle('');
      setNewMenuOccasion('');
      loadMenus();
    }
  }, [visible]);

  const loadMenus = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const data = await getUserMenus(session.user.id);
      setMenus(data);
    } catch (err) {
      console.error('Failed to load menus:', err);
    }
    setLoading(false);
  };

  const handleCreateMenu = async () => {
    if (!session?.user?.id || !newMenuTitle.trim()) return;
    setCreating(true);
    try {
      const menu = await createMenu({
        user_id: session.user.id,
        title: newMenuTitle.trim(),
        occasion: newMenuOccasion || null,
      });
      setMenus((prev) => [menu, ...prev]);
      setSelectedMenu(menu);
      setShowNewMenu(false);
      setNewMenuTitle('');
      setNewMenuOccasion('');
      setStep('course');
    } catch (err) {
      console.error('Failed to create menu:', err);
    }
    setCreating(false);
  };

  const handleSelectMenu = (menu: Menu) => {
    setSelectedMenu(menu);
    setStep('course');
  };

  const handleAddToMenu = async () => {
    if (!selectedMenu) return;
    setAdding(true);

    let added = 0;
    let skipped = 0;

    try {
      for (const recipeId of recipeIds) {
        const exists = await isRecipeInMenu(selectedMenu.id, recipeId, selectedCourse);
        if (exists) {
          skipped++;
          continue;
        }
        const sortOrder = await getMaxSortOrder(selectedMenu.id, selectedCourse);
        await addMenuItem(selectedMenu.id, recipeId, selectedCourse, sortOrder + 1);
        added++;
      }

      onSuccess?.(selectedMenu.title, COURSE_LABELS[selectedCourse], added, skipped);
      onClose();
    } catch (err) {
      console.error('Failed to add to menu:', err);
    }
    setAdding(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.bgScreen,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 16,
            paddingBottom: insets.bottom + 16,
            maxHeight: '80%',
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                {step === 'menu' ? t('menus.pick_a_menu') : t('menus.pick_a_course')}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {step === 'menu' ? (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {loading ? (
                  <Text style={{ textAlign: 'center', color: colors.textSecondary, paddingVertical: 20 }}>
                    {t('common.loading')}
                  </Text>
                ) : showNewMenu ? (
                  <View>
                    <TextInput
                      value={newMenuTitle}
                      onChangeText={(t) => setNewMenuTitle(t.slice(0, 80))}
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
                        marginBottom: 12,
                      }}
                      autoFocus
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      {OCCASIONS.map((o) => (
                        <TouchableOpacity
                          key={o.value}
                          onPress={() => setNewMenuOccasion(o.value)}
                          style={{
                            backgroundColor: newMenuOccasion === o.value ? colors.accent : colors.bgBase,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 8,
                            marginRight: 8,
                            borderWidth: 1,
                            borderColor: newMenuOccasion === o.value ? colors.accent : colors.borderDefault,
                          }}
                        >
                          <Text style={{
                            color: newMenuOccasion === o.value ? '#fff' : colors.textPrimary,
                            fontSize: 13,
                          }}>
                            {o.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => setShowNewMenu(false)}
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.borderDefault,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                          {t('common.cancel')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleCreateMenu}
                        disabled={creating || !newMenuTitle.trim()}
                        style={{
                          flex: 1,
                          backgroundColor: colors.accent,
                          paddingVertical: 12,
                          borderRadius: 10,
                          alignItems: 'center',
                          opacity: creating || !newMenuTitle.trim() ? 0.5 : 1,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                          {creating ? t('common.creating') : t('menus.create')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    {menus.map((menu) => (
                      <TouchableOpacity
                        key={menu.id}
                        onPress={() => handleSelectMenu(menu)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 14,
                          paddingHorizontal: 12,
                          backgroundColor: colors.bgBase,
                          borderRadius: 10,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: colors.borderDefault,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                            {menu.title}
                          </Text>
                          {menu.occasion && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                              {menu.occasion.replace(/_/g, ' ')}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setShowNewMenu(true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingVertical: 14,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.accent,
                      }}
                    >
                      <Ionicons name="add" size={18} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                        {t('menus.create_new_menu')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            ) : (
              <View>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}>
                  {t('menus.adding_to')} <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{selectedMenu?.title}</Text>
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {COURSE_ORDER.map((course) => (
                    <TouchableOpacity
                      key={course}
                      onPress={() => setSelectedCourse(course)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 8,
                        backgroundColor: selectedCourse === course ? colors.accent : colors.bgBase,
                        borderWidth: 1,
                        borderColor: selectedCourse === course ? colors.accent : colors.borderDefault,
                      }}
                    >
                      <Text style={{
                        color: selectedCourse === course ? '#fff' : colors.textPrimary,
                        fontSize: 14,
                        fontWeight: '500',
                      }}>
                        {COURSE_LABELS[course]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {recipeIds.length > 1 && (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16 }}>
                    {t('menus.course_applies_to_all', { count: recipeIds.length })}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setStep('menu')}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.borderDefault,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>
                      {t('common.back')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddToMenu}
                    disabled={adding}
                    style={{
                      flex: 1,
                      backgroundColor: colors.accent,
                      paddingVertical: 14,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: adding ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
                      {adding ? t('common.adding') : t('menus.add_to_menu')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
