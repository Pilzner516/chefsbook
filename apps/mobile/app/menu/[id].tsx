import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, FlatList, Alert, Modal, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useMenuStore } from '../../lib/zustand/menuStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { Card, Loading } from '../../components/UIKit';
import ChefsDialog from '../../components/ChefsDialog';
import { StorePicker } from '../../components/StorePicker';
import { getPrimaryPhotos, supabase } from '@chefsbook/db';
import { COURSE_ORDER, COURSE_LABELS, type MenuCourse } from '@chefsbook/db';
import { formatDuration } from '@chefsbook/ui';
import { suggestPurchaseUnits } from '@chefsbook/ai';

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export default function MenuDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const currentMenu = useMenuStore((s) => s.currentMenu);
  const loading = useMenuStore((s) => s.loading);
  const fetchMenu = useMenuStore((s) => s.fetchMenu);
  const editMenu = useMenuStore((s) => s.editMenu);
  const addRecipeToMenu = useMenuStore((s) => s.addRecipeToMenu);
  const removeRecipeFromMenu = useMenuStore((s) => s.removeRecipeFromMenu);
  const recipes = useRecipeStore((s) => s.recipes);
  const fetchRecipes = useRecipeStore((s) => s.fetchRecipes);
  const shoppingLists = useShoppingStore((s) => s.lists);
  const fetchShoppingLists = useShoppingStore((s) => s.fetchLists);
  const addItemsPipeline = useShoppingStore((s) => s.addItemsPipeline);

  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [pickerCourse, setPickerCourse] = useState<MenuCourse>('main');
  const [pickerSearch, setPickerSearch] = useState('');
  const [showListPicker, setShowListPicker] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchMenu(id);
    }
  }, [id]);

  useEffect(() => {
    if (session?.user?.id && recipes.length === 0) {
      fetchRecipes(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (currentMenu?.menu_items) {
      const recipeIds = currentMenu.menu_items.map((item) => item.recipe_id);
      if (recipeIds.length > 0) {
        getPrimaryPhotos(recipeIds).then(setPrimaryPhotos);
      }
    }
  }, [currentMenu?.menu_items]);

  const getItemsByCourse = (course: MenuCourse) => {
    if (!currentMenu) return [];
    return currentMenu.menu_items
      .filter((item) => item.course === course)
      .sort((a, b) => a.sort_order - b.sort_order);
  };

  const coursesWithItems = useMemo(() => {
    if (!currentMenu) return [];
    return COURSE_ORDER.filter((course) => getItemsByCourse(course).length > 0);
  }, [currentMenu]);

  const openRecipePicker = (course: MenuCourse) => {
    setPickerCourse(course);
    setPickerSearch('');
    setShowRecipePicker(true);
  };

  const handleAddRecipe = async (recipeId: string) => {
    if (!currentMenu) return;
    const existing = currentMenu.menu_items.filter((i) => i.course === pickerCourse);
    await addRecipeToMenu(currentMenu.id, recipeId, pickerCourse, existing.length);
    setShowRecipePicker(false);
    showToast(t('menus.recipeAdded'));
  };

  const confirmRemoveItem = (itemId: string) => {
    setDeleteItemId(itemId);
    setShowDeleteDialog(true);
  };

  const handleRemoveItem = async () => {
    if (!deleteItemId) return;
    setShowDeleteDialog(false);
    await removeRecipeFromMenu(deleteItemId);
    setDeleteItemId(null);
  };

  const filteredRecipes = useMemo(() => {
    if (!pickerSearch.trim()) return recipes;
    const q = pickerSearch.toLowerCase();
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, pickerSearch]);

  const handleShare = async () => {
    if (!currentMenu) return;
    if (!currentMenu.is_public) {
      await editMenu(currentMenu.id, { is_public: true });
    }
    const url = `https://chefsbk.app/menu/${currentMenu.id}`;
    try {
      await Share.share({ message: `Check out my menu: ${currentMenu.title}\n${url}`, url });
    } catch {}
  };

  const openListPicker = async () => {
    if (session?.user?.id) {
      await fetchShoppingLists(session.user.id);
    }
    setShowListPicker(true);
  };

  const handleAddToList = async (listId: string, listName: string) => {
    if (!session?.user?.id || !currentMenu) return;
    setShowListPicker(false);
    setAddingToList(true);

    try {
      const recipeIds = [...new Set(currentMenu.menu_items.map((i) => i.recipe_id))];
      if (recipeIds.length === 0) {
        Alert.alert(t('menus.noRecipes'), t('menus.noRecipesInMenu'));
        setAddingToList(false);
        return;
      }

      const { data: recipesData } = await supabase
        .from('recipes')
        .select('id, title')
        .in('id', recipeIds);

      const { data: allIngredients } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, ingredient, quantity, unit')
        .in('recipe_id', recipeIds);

      const recipeMap = new Map((recipesData ?? []).map((r) => [r.id, r.title]));

      const items = (allIngredients ?? [])
        .filter((ing) => ing.ingredient)
        .map((ing) => ({
          ingredient: ing.ingredient,
          quantity: ing.quantity,
          unit: ing.unit,
          quantity_needed: [ing.quantity, ing.unit].filter(Boolean).join(' ') || null,
          recipe_id: ing.recipe_id,
          recipe_name: recipeMap.get(ing.recipe_id) ?? 'Unknown',
        }));

      if (items.length === 0) {
        Alert.alert(t('menus.noIngredients'), t('menus.noIngredientsInMenu'));
        setAddingToList(false);
        return;
      }

      let aiSuggestions: Record<string, { purchase_unit: string; store_category: string }> = {};
      try {
        const aiResult = await suggestPurchaseUnits(items.map((i) => ({
          name: i.ingredient,
          quantity: i.quantity_needed || '',
        })));
        for (const s of aiResult) {
          aiSuggestions[s.ingredient.toLowerCase()] = { purchase_unit: s.purchase_unit, store_category: s.store_category };
        }
      } catch {}

      await addItemsPipeline(listId, session.user.id, items, aiSuggestions);
      showToast(`${t('menus.addedToList')} ${listName}`);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
    setAddingToList(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  if (loading || !currentMenu) {
    return <Loading message={t('menus.loading')} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
              {currentMenu.title}
            </Text>
            {currentMenu.occasion && (
              <Text style={{ fontSize: 12, color: colors.accent, marginTop: 2 }}>
                {currentMenu.occasion.replace(/_/g, ' ')}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleShare} style={{ padding: 8 }}>
            <Ionicons name="share-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast */}
      {toastMessage && (
        <View style={{
          position: 'absolute', top: insets.top + 60, left: 40, right: 40, zIndex: 100,
          backgroundColor: colors.accentGreen, borderRadius: 10, padding: 12, alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{toastMessage}</Text>
        </View>
      )}

      {/* Add to shopping list button */}
      {currentMenu.menu_items.length > 0 && (
        <TouchableOpacity
          onPress={openListPicker}
          disabled={addingToList}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginHorizontal: 16, marginTop: 12, paddingVertical: 12,
            backgroundColor: colors.accentGreenSoft, borderRadius: 10,
            opacity: addingToList ? 0.6 : 1,
          }}
        >
          <Ionicons name="cart" size={18} color={colors.accentGreen} />
          <Text style={{ color: colors.accentGreen, fontSize: 14, fontWeight: '600' }}>
            {addingToList ? t('menus.addingToList') : t('menus.addToShoppingList')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Start Cooking button */}
      {currentMenu.menu_items.length > 0 && (
        <TouchableOpacity
          onPress={() => router.push(`/cook-menu/${currentMenu.id}` as any)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginHorizontal: 16, marginTop: 8, paddingVertical: 14,
            backgroundColor: colors.accent, borderRadius: 10,
          }}
        >
          <Ionicons name="flame" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
            {t('menus.startCooking')}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {currentMenu.description && (
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
            {currentMenu.description}
          </Text>
        )}

        {/* Course sections */}
        {COURSE_ORDER.map((course) => {
          const items = getItemsByCourse(course);
          return (
            <View key={course} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                  {COURSE_LABELS[course]}
                </Text>
                <TouchableOpacity
                  onPress={() => openRecipePicker(course)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{t('common.add')}</Text>
                </TouchableOpacity>
              </View>

              {items.length === 0 ? (
                <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                  {t('menus.noRecipesInCourse')}
                </Text>
              ) : (
                items.map((item) => {
                  const recipe = item.recipe;
                  const imageUrl = primaryPhotos[item.recipe_id] ?? recipe?.image_url;
                  const totalTime = (recipe?.prep_minutes || 0) + (recipe?.cook_minutes || 0);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => router.push(`/recipe/${item.recipe_id}` as any)}
                      style={{
                        flexDirection: 'row',
                        backgroundColor: colors.bgCard,
                        borderRadius: 12,
                        marginBottom: 8,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: colors.borderDefault,
                      }}
                    >
                      <View style={{ width: 80, height: 80, backgroundColor: colors.bgBase }}>
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl, headers: { apikey: SUPABASE_ANON_KEY } }}
                            style={{ width: 80, height: 80 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="restaurant-outline" size={24} color={colors.textMuted} />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                          {recipe?.title || 'Recipe'}
                        </Text>
                        {totalTime > 0 && (
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                            {formatDuration(totalTime)}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => confirmRemoveItem(item.id)}
                        style={{ justifyContent: 'center', paddingHorizontal: 12 }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Recipe Picker Modal */}
      <Modal visible={showRecipePicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              maxHeight: '80%', paddingTop: 16, paddingBottom: insets.bottom + 16,
            }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                  {t('menus.addToCourse', { course: COURSE_LABELS[pickerCourse] })}
                </Text>
                <TouchableOpacity onPress={() => setShowRecipePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <TextInput
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  placeholder={t('menus.searchRecipes')}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                    fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault,
                  }}
                />
              </View>
              <FlatList
                data={filteredRecipes}
                keyExtractor={(r) => r.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleAddRecipe(item.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
                      borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>{item.title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {[item.cuisine, item.course].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={22} color={colors.accent} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 20 }}>
                    {t('menus.noRecipesFound')}
                  </Text>
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Shopping List Picker Modal */}
      <Modal visible={showListPicker} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 16, paddingBottom: insets.bottom + 16, maxHeight: '60%',
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                {t('menus.selectShoppingList')}
              </Text>
              <TouchableOpacity onPress={() => setShowListPicker(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {shoppingLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  onPress={() => handleAddToList(list.id, list.name)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
                    borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
                  }}
                >
                  <Ionicons name="list" size={20} color={colors.accent} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>{list.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => { setShowListPicker(false); setShowStorePicker(true); }}
              style={{
                backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14,
                alignItems: 'center', marginTop: 12,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{t('menus.newShoppingList')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StorePicker
        visible={showStorePicker}
        onCreated={(listId, listName) => {
          setShowStorePicker(false);
          handleAddToList(listId, listName);
        }}
        onCancel={() => setShowStorePicker(false)}
      />

      {/* Delete Item Dialog */}
      <ChefsDialog
        visible={showDeleteDialog}
        title={t('menus.removeRecipe')}
        body={t('menus.removeRecipeBody')}
        onClose={() => setShowDeleteDialog(false)}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowDeleteDialog(false) },
          { label: t('common.remove'), variant: 'secondary', onPress: handleRemoveItem },
        ]}
      />
    </View>
  );
}
