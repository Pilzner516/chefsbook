import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { RecipeCard, EmptyState, Loading } from '../../components/UIKit';

type SortMode = 'recent' | 'alpha' | 'cuisine' | 'course';

export default function RecipesTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const recipes = useRecipeStore((s) => s.recipes);
  const loading = useRecipeStore((s) => s.loading);
  const fetchRecipes = useRecipeStore((s) => s.fetchRecipes);
  const tabBarHeight = useTabBarHeight();
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    if (session?.user?.id) fetchRecipes(session.user.id);
  }, [session?.user?.id]);

  const sorted = React.useMemo(() => {
    const list = [...recipes];
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
  }, [recipes, sortMode]);

  if (loading && recipes.length === 0) return <Loading message="Loading recipes..." />;

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
          <Text style={{ color: colors.textMuted, fontSize: 15, marginLeft: 8 }}>Search recipes...</Text>
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
                { key: 'recent', label: 'Recent' },
                { key: 'alpha', label: 'A-Z' },
                { key: 'cuisine', label: 'Cuisine' },
                { key: 'course', label: 'Course' },
              ] as const).map((opt) => (
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
        {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
      </Text>

      <FlashList
        data={sorted}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarHeight }}
        renderItem={({ item }) => (
          <RecipeCard
            title={item.title}
            imageUrl={item.image_url}
            cuisine={item.cuisine}
            totalMinutes={item.total_minutes}
            isFavourite={item.is_favourite}
            saveCount={item.save_count}
            onPress={() => router.push(`/recipe/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="👨‍🍳"
            title="Your recipe collection is empty"
            message="Import your first recipe to get started."
            action={{ label: 'Import a Recipe', onPress: () => router.push('/(tabs)/scan') }}
          />
        }
      />
    </View>
  );
}
