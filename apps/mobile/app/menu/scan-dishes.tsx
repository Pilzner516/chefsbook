import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useMenuStore } from '../../lib/zustand/menuStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import ChefsDialog from '../../components/ChefsDialog';
import { processImage, uploadRecipePhoto } from '../../lib/image';
import { createMenu, addMenuItem, createRecipe, addRecipePhoto } from '@chefsbook/db';
import type { MenuCourse } from '@chefsbook/db';
import { generateMenuRecipe } from '@chefsbook/ai';
import type { ExtractedDish, ExtractMenuDishesResult } from '@chefsbook/ai';

type DishSelection = {
  dish: ExtractedDish;
  selected: boolean;
  imageUri: string | null;
  imageBase64: string | null;
};

type ImageSheetDish = {
  index: number;
  dish: ExtractedDish;
};

export default function ScanDishesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);

  const params = useLocalSearchParams<{
    menuData?: string;
  }>();

  const [menuResult, setMenuResult] = useState<ExtractMenuDishesResult | null>(() => {
    if (params.menuData) {
      try {
        return JSON.parse(params.menuData);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [selections, setSelections] = useState<DishSelection[]>(() => {
    if (!menuResult?.dishes) return [];
    return menuResult.dishes.map((dish) => ({
      dish,
      selected: true,
      imageUri: null,
      imageBase64: null,
    }));
  });

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPreGenModal, setShowPreGenModal] = useState(false);
  const [restaurantName, setRestaurantName] = useState(menuResult?.restaurant_name ?? '');
  const [customTag, setCustomTag] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const [imageSheetDish, setImageSheetDish] = useState<ImageSheetDish | null>(null);

  const selectedCount = selections.filter((s) => s.selected).length;

  const toggleSelection = (index: number) => {
    setSelections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const selectAll = () => {
    setSelections((prev) => prev.map((s) => ({ ...s, selected: true })));
  };

  const deselectAll = () => {
    setSelections((prev) => prev.map((s) => ({ ...s, selected: false })));
  };

  const openImageSheet = (index: number) => {
    setImageSheetDish({ index, dish: selections[index].dish });
  };

  const handlePickFromGallery = async () => {
    if (imageSheetDish === null) return;
    const index = imageSheetDish.index;
    setImageSheetDish(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const processed = await processImage(result.assets[0].uri);
      setSelections((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, imageUri: result.assets[0].uri, imageBase64: processed.base64 } : s
        )
      );
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e?.message ?? String(e));
    }
  };

  const handleTakePhoto = async () => {
    if (imageSheetDish === null) return;
    const index = imageSheetDish.index;
    setImageSheetDish(null);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const processed = await processImage(result.assets[0].uri);
      setSelections((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, imageUri: result.assets[0].uri, imageBase64: processed.base64 } : s
        )
      );
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e?.message ?? String(e));
    }
  };

  const handleRemoveImage = () => {
    if (imageSheetDish === null) return;
    const index = imageSheetDish.index;
    setImageSheetDish(null);
    setSelections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, imageUri: null, imageBase64: null } : s))
    );
  };

  const handleGenerate = () => {
    if (selectedCount === 0) return;
    setShowPreGenModal(true);
  };

  const sanitizeTag = (tag: string): string => {
    return tag.toLowerCase().replace(/[^a-z0-9-\s]/g, '').replace(/\s+/g, '-').slice(0, 30);
  };

  const doGenerate = async () => {
    if (!session?.user?.id) return;
    setShowPreGenModal(false);
    setGenerating(true);

    const selectedDishes = selections.filter((s) => s.selected);
    setGenerationProgress({ done: 0, total: selectedDishes.length });

    const tags: string[] = [];
    if (restaurantName.trim()) tags.push(sanitizeTag(restaurantName));
    if (customTag.trim()) tags.push(sanitizeTag(customTag));

    try {
      const menu = await createMenu({
        user_id: session.user.id,
        title: restaurantName.trim() || t('menuScan.scannedMenu'),
        notes: userNotes.trim() || null,
        is_public: false,
      });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < selectedDishes.length; i++) {
        const sel = selectedDishes[i];
        try {
          const generated = await generateMenuRecipe(
            {
              name: sel.dish.name,
              description: sel.dish.description,
              course: sel.dish.suggested_course,
              imageBase64: sel.imageBase64 ?? undefined,
            },
            restaurantName.trim() || null,
            userNotes.trim() || null
          );

          const recipeTags = [...(generated.tags ?? []), ...tags];
          const sourceNotes = restaurantName.trim()
            ? `Inspired by ${restaurantName}`
            : 'Inspired by a restaurant menu';

          const recipe = await addRecipe(session.user.id, {
            title: generated.title,
            description: generated.description,
            ingredients: generated.ingredients,
            steps: generated.steps.map((s) => ({ instruction: s.instruction, timer_minutes: s.timer_minutes })),
            cuisine: generated.cuisine,
            prep_minutes: generated.prep_minutes,
            cook_minutes: generated.cook_minutes,
            servings: generated.servings ?? 4,
            tags: recipeTags,
            visibility: 'private',
            source_type: 'ai',
            source_notes: sourceNotes,
            is_inspired_by_menu: true,
          } as any);

          if (sel.imageUri) {
            try {
              const photoUrl = await uploadRecipePhoto(sel.imageUri, recipe.id);
              await addRecipePhoto(recipe.id, session.user.id, `${recipe.id}/${Date.now()}.jpg`, photoUrl);
            } catch {}
          }

          await addMenuItem(
            menu.id,
            recipe.id,
            sel.dish.suggested_course,
            i
          );

          successCount++;
        } catch (e) {
          console.warn('[scan-dishes] Failed to generate', sel.dish.name, e);
          failCount++;
        }

        setGenerationProgress({ done: i + 1, total: selectedDishes.length });
      }

      setGenerating(false);

      if (successCount > 0) {
        const message =
          failCount > 0
            ? t('menuScan.partialSuccess', { success: successCount, fail: failCount })
            : t('menuScan.allSuccess', { count: successCount });
        Alert.alert(t('menuScan.complete'), message);
        router.replace(`/menu/${menu.id}` as any);
      } else {
        Alert.alert(t('common.errorTitle'), t('menuScan.allFailed'));
      }
    } catch (e: any) {
      setGenerating(false);
      Alert.alert(t('common.errorTitle'), e?.message ?? String(e));
    }
  };

  const handleCancel = () => {
    if (selections.some((s) => s.selected || s.imageUri)) {
      setShowCancelDialog(true);
    } else {
      router.back();
    }
  };

  if (!menuResult || menuResult.dishes.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, textAlign: 'center' }}>
          {t('menuScan.noDishesFound')}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.accent, borderRadius: 10 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (generating) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 20 }}>
          {t('menuScan.creatingRecipes')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>
          {t('menuScan.progress', { done: generationProgress.done, total: generationProgress.total })}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bgScreen }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
          backgroundColor: colors.bgCard,
        }}
      >
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
            {t('menuScan.selectDishes')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {t('menuScan.tapToSelect')}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 }}>
        <TouchableOpacity onPress={selectedCount === selections.length ? deselectAll : selectAll}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
            {selectedCount === selections.length ? t('menuScan.deselectAll') : t('menuScan.selectAll')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}>
        {selections.map((sel, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bgCard,
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: sel.selected ? colors.accent : colors.borderDefault,
            }}
          >
            <TouchableOpacity onPress={() => toggleSelection(index)} style={{ marginRight: 12 }}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: sel.selected ? colors.accent : colors.textMuted,
                  backgroundColor: sel.selected ? colors.accent : 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {sel.selected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                {sel.dish.name}
              </Text>
              {sel.dish.description && (
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {sel.dish.description}
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={() => openImageSheet(index)} style={{ marginLeft: 8, padding: 6 }}>
              <View style={{ position: 'relative' }}>
                <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                {sel.imageUri && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.accentGreen,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={8} color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bgCard,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
          {t('menuScan.dishesSelected', { count: selectedCount })}
        </Text>
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={selectedCount === 0}
          style={{
            backgroundColor: selectedCount > 0 ? colors.accent : colors.bgBase,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: selectedCount > 0 ? 1 : 0.5,
          }}
        >
          <Text style={{ color: selectedCount > 0 ? '#fff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
            {t('menuScan.generateRecipes')}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={imageSheetDish !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setImageSheetDish(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setImageSheetDish(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        >
          <View
            style={{
              backgroundColor: colors.bgCard,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault }} />
            </View>
            {imageSheetDish && selections[imageSheetDish.index]?.imageUri && (
              <TouchableOpacity
                onPress={handleRemoveImage}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
              >
                <Ionicons name="trash-outline" size={22} color={colors.accent} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{t('menuScan.removePhoto')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handlePickFromGallery}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <Ionicons name="images-outline" size={22} color={colors.textPrimary} style={{ marginRight: 12 }} />
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{t('menuScan.pickFromGallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}
            >
              <Ionicons name="camera-outline" size={22} color={colors.textPrimary} style={{ marginRight: 12 }} />
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{t('menuScan.takePhoto')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ChefsDialog
        visible={showPreGenModal}
        title={t('menuScan.preGenTitle')}
        onClose={() => setShowPreGenModal(false)}
        buttons={[
          { label: t('common.back'), variant: 'secondary', onPress: () => setShowPreGenModal(false) },
          { label: t('menuScan.generate'), variant: 'primary', onPress: doGenerate },
        ]}
        body={
          <View style={{ paddingVertical: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
              {t('menuScan.restaurantLabel')}
            </Text>
            <TextInput
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder={t('menuScan.restaurantPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bgBase,
                borderWidth: 1,
                borderColor: colors.borderDefault,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: colors.textPrimary,
                marginBottom: 16,
              }}
            />

            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
              {t('menuScan.customTagLabel')}
            </Text>
            <TextInput
              value={customTag}
              onChangeText={setCustomTag}
              placeholder={t('menuScan.customTagPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bgBase,
                borderWidth: 1,
                borderColor: colors.borderDefault,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: colors.textPrimary,
                marginBottom: 4,
              }}
            />
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 16 }}>
              {t('menuScan.customTagHelp')}
            </Text>

            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
              {t('menuScan.notesLabel')}
            </Text>
            <TextInput
              value={userNotes}
              onChangeText={setUserNotes}
              placeholder={t('menuScan.notesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.bgBase,
                borderWidth: 1,
                borderColor: colors.borderDefault,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: colors.textPrimary,
                minHeight: 70,
                textAlignVertical: 'top',
              }}
            />
          </View>
        }
      />

      <ChefsDialog
        visible={showCancelDialog}
        title={t('menuScan.discardTitle')}
        body={t('menuScan.discardBody')}
        onClose={() => setShowCancelDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'secondary', onPress: () => setShowCancelDialog(false) },
          { label: t('menuScan.discardConfirm'), variant: 'primary', onPress: () => router.back() },
        ]}
      />
    </KeyboardAvoidingView>
  );
}
