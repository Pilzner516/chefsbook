import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { RecipeCard, EmptyState, Loading, Card } from '../../components/UIKit';
import { FeedbackCard } from '../../components/FeedbackCard';
import { getRecipeVersions, getPrimaryPhotos, getBatchTranslatedTitles } from '@chefsbook/db';

type SortMode = 'recent' | 'alpha' | 'cuisine' | 'course';

export default function RecipesTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const recipes = useRecipeStore((s) => s.recipes);
  const loading = useRecipeStore((s) => s.loading);
  const fetchRecipes = useRecipeStore((s) => s.fetchRecipes);
  const tabBarHeight = useTabBarHeight();
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [versionPickerRecipeId, setVersionPickerRecipeId] = useState<string | null>(null);
  const [versionPickerVersions, setVersionPickerVersions] = useState<any[]>([]);
  const [primaryPhotos, setPrimaryPhotos] = useState<Record<string, string>>({});
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const i18n = useTranslation().i18n;

  // Refresh recipes + primary photos every time the tab gains focus
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) fetchRecipes(session.user.id);
    }, [session?.user?.id]),
  );

  // Batch-fetch primary user photos for all recipes
  useEffect(() => {
    if (recipes.length === 0) return;
    const ids = recipes.map((r) => r.id);
    getPrimaryPhotos(ids).then(setPrimaryPhotos);
    // Batch-fetch translated titles when language is not English
    const lang = i18n.language;
    if (lang && lang !== 'en') {
      getBatchTranslatedTitles(ids, lang).then(setTranslatedTitles);
    } else {
      setTranslatedTitles({});
    }
  }, [recipes, i18n.language]);

  // Filter out child versions — only show parent/standalone recipes in the list
  const topLevelRecipes = useMemo(() => recipes.filter((r) => !r.parent_recipe_id), [recipes]);

  // Compute version counts for parent recipes
  const versionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of recipes) {
      if (r.parent_recipe_id) {
        counts[r.parent_recipe_id] = (counts[r.parent_recipe_id] ?? 1) + 1;
      }
    }
    return counts;
  }, [recipes]);

  const sorted = useMemo(() => {
    const list = [...topLevelRecipes];
    switch (sortMode) {
      case 'alpha':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'cuisine':
        return list.sort((a, b) => (a.cuisine ?? '').localeCompare(b.cuisine ?? ''));
      case 'course':
        return list.sort((a, b) => (a.course ?? '').localeCompare(b.course ?? ''));
      default:
        return list;
    }
  }, [topLevelRecipes, sortMode]);

  const openVersionPicker = async (recipeId: string) => {
    try {
      const versions = await getRecipeVersions(recipeId);
      setVersionPickerVersions(versions);
      setVersionPickerRecipeId(recipeId);
    } catch {
      router.push(`/recipe/${recipeId}`);
    }
  };

  if (loading && recipes.length === 0) return <Loading message={t('common.loading')} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />

      {/* Subheader: count + search link + sort */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        {/* Tappable search bar (navigates to Search tab) */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/search')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bgBase,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 15, marginLeft: 8 }}>{t('recipes.searchPlaceholder')}</Text>
        </TouchableOpacity>

        {/* Sort button */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            onPress={() => setShowSortMenu(!showSortMenu)}
            style={{ marginLeft: 12, padding: 8, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="swap-vertical" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {showSortMenu && (
            <View
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                backgroundColor: colors.bgCard,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.borderDefault,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 4,
                zIndex: 100,
                minWidth: 150,
              }}
            >
              {([
                { key: 'recent' as SortMode, label: t('recipes.sortRecent') },
                { key: 'alpha' as SortMode, label: t('recipes.sortAZ') },
                { key: 'cuisine' as SortMode, label: t('recipes.sortCuisine') },
                { key: 'course' as SortMode, label: t('recipes.sortCourse') },
              ]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => { setSortMode(opt.key); setShowSortMenu(false); }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    minHeight: 44,
                    borderBottomWidth: opt.key === 'course' ? 0 : 1,
                    borderBottomColor: colors.borderDefault,
                  }}
                >
                  <Text
                    style={{
                      color: sortMode === opt.key ? colors.accent : colors.textPrimary,
                      fontSize: 15,
                      fontWeight: sortMode === opt.key ? '600' : '400',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Recipe count */}
      <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 16, marginBottom: 8 }}>
        {t('recipes.recipeCount', { count: topLevelRecipes.length })}
      </Text>

      <FlashList
        data={sorted}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarHeight }}
        ListHeaderComponent={<FeedbackCard />}
        renderItem={({ item }) => {
          const vc = item.is_parent ? (versionCounts[item.id] ?? 1) : undefined;
          return (
            <RecipeCard
              title={translatedTitles[item.id] ?? item.title}
              imageUrl={primaryPhotos[item.id] ?? item.image_url}
              cuisine={item.cuisine}
              totalMinutes={item.total_minutes}
              isFavourite={item.is_favourite}
              saveCount={item.save_count}
              versionCount={vc}
              attributedTo={item.original_submitter_username && item.original_submitter_id !== item.user_id ? item.original_submitter_username : undefined}
              onPress={() => {
                if (item.is_parent) {
                  openVersionPicker(item.id);
                } else {
                  router.push(`/recipe/${item.id}`);
                }
              }}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="👨‍🍳"
            title={t('recipes.emptyTitle')}
            message={t('recipes.emptyMessage')}
            action={{ label: t('recipes.importRecipe'), onPress: () => router.push('/(tabs)/scan') }}
          />
        }
      />

      {/* Version picker bottom sheet */}
      <Modal visible={!!versionPickerRecipeId} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingTop: 16, paddingBottom: insets.bottom + 16 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('recipes.recipeVersions')}</Text>
              <TouchableOpacity onPress={() => setVersionPickerRecipeId(null)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 16, maxHeight: 400 }}>
              {versionPickerVersions.map((v) => (
                <Card
                  key={v.id}
                  onPress={() => { setVersionPickerRecipeId(null); router.push(`/recipe/${v.id}`); }}
                  style={{ marginBottom: 10 }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                        {t('recipe.version')} {v.version_number}{v.version_label ? ` · ${v.version_label}` : ''}
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>{v.title}</Text>
                      {v.description && (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{v.description}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Card>
              ))}
            </ScrollView>
            <View style={{ padding: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  setVersionPickerRecipeId(null);
                  router.push({ pathname: '/recipe/new', params: { parentId: versionPickerRecipeId ?? '' } });
                }}
                style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('recipes.addNewVersion')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
