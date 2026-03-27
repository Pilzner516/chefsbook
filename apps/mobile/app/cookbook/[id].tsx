import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useCookbookStore } from '../../lib/zustand/cookbookStore';
import { supabase } from '@chefsbook/db';
import type { Recipe } from '@chefsbook/db';
import { RecipeCard, Badge, Loading, EmptyState } from '../../components/UIKit';

export default function CookbookDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentCookbook, fetchCookbook } = useCookbookStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCookbook(id);
      loadRecipes();
    }
  }, [id]);

  const loadRecipes = async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('cookbook_id', id)
      .order('page_number');
    setRecipes((data ?? []) as Recipe[]);
    setLoading(false);
  };

  if (loading || !currentCookbook) return <Loading message="Loading cookbook..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 4 }}>{currentCookbook.title}</Text>
        {currentCookbook.author && (
          <Text style={{ color: colors.textSecondary, fontSize: 16, marginBottom: 12 }}>by {currentCookbook.author}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {currentCookbook.publisher && <Badge label={currentCookbook.publisher} />}
          {currentCookbook.year && <Badge label={String(currentCookbook.year)} />}
          {currentCookbook.location && <Badge label={currentCookbook.location} color={colors.accentGreen} />}
        </View>
        {currentCookbook.notes && (
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>{currentCookbook.notes}</Text>
        )}

        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
          Recipes ({recipes.length})
        </Text>
        {recipes.length === 0 ? (
          <EmptyState icon={'\uD83D\uDCD6'} title="No recipes indexed" message="Scan pages from this cookbook to add recipes." />
        ) : (
          recipes.map((r) => (
            <RecipeCard
              key={r.id}
              title={r.title}
              imageUrl={r.image_url}
              cuisine={r.cuisine}
              totalMinutes={r.total_minutes}
              isFavourite={r.is_favourite}
              onPress={() => router.push(`/recipe/${r.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
