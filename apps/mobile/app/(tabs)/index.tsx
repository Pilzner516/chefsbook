import React, { useEffect, useCallback } from 'react';
import { View, TextInput, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { RecipeCard, Chip, EmptyState, Loading } from '../../components/UIKit';

const COURSES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'side', 'drink'];

export default function RecipesTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const { recipes, loading, searchQuery, filterCourse, setSearch, setFilterCourse, fetchRecipes } = useRecipeStore();

  useEffect(() => {
    if (session?.user?.id) fetchRecipes(session.user.id);
  }, [session?.user?.id, searchQuery, filterCourse]);

  if (loading && recipes.length === 0) return <Loading message="Loading recipes..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearch}
          placeholder="Search recipes..."
          placeholderTextColor={colors.textSecondary}
          style={{
            backgroundColor: colors.bgBase,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            borderRadius: 10,
            padding: 12,
            fontSize: 15,
            color: colors.textPrimary,
          }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, maxHeight: 50 }}>
        <Chip label="All" selected={!filterCourse} onPress={() => setFilterCourse(null)} />
        {COURSES.map((c) => (
          <Chip key={c} label={c} selected={filterCourse === c} onPress={() => setFilterCourse(filterCourse === c ? null : c)} />
        ))}
      </ScrollView>
      <FlashList
        data={recipes}
        estimatedItemSize={200}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <RecipeCard
            title={item.title}
            imageUrl={item.image_url}
            cuisine={item.cuisine}
            totalMinutes={item.total_minutes}
            isFavourite={item.is_favourite}
            onPress={() => router.push(`/recipe/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={'\uD83D\uDCD6'}
            title="No recipes yet"
            message="Scan a recipe, import from a URL, or add one manually."
            action={{ label: 'Add Recipe', onPress: () => router.push('/recipe/new') }}
          />
        }
      />
    </View>
  );
}
