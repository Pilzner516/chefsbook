import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { getRecipeByShareToken } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';
import { Badge, Divider, Loading, EmptyState } from '../../components/UIKit';

export default function SharedRecipe() {
  const { colors } = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) loadRecipe();
  }, [token]);

  const loadRecipe = async () => {
    const data = await getRecipeByShareToken(token!);
    setRecipe(data);
    setLoading(false);
  };

  if (loading) return <Loading message="Loading shared recipe..." />;
  if (!recipe) return <EmptyState icon="?" title="Recipe not found" message="This share link may have expired." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 8 }}>{recipe.title}</Text>
        {recipe.description && (
          <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 12 }}>{recipe.description}</Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {recipe.cuisine && <Badge label={recipe.cuisine} />}
          {recipe.course && <Badge label={recipe.course} />}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && <Badge label={formatDuration(recipe.total_minutes)} color={colors.accentGreen} />}
        </View>

        <Divider />
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Ingredients</Text>
        {recipe.ingredients.map((ing) => (
          <View key={ing.id} style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ color: colors.accent, fontSize: 15, width: 70, textAlign: 'right', marginRight: 12 }}>
              {formatQuantity(ing.quantity)} {ing.unit ?? ''}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>{ing.ingredient}</Text>
          </View>
        ))}

        <Divider />
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Steps</Text>
        {recipe.steps.map((step) => (
          <View key={step.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
              <Text style={{ color: colors.bgScreen, fontSize: 13, fontWeight: '700' }}>{step.step_number}</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22, flex: 1 }}>{step.instruction}</Text>
          </View>
        ))}

        {recipe.notes && (
          <>
            <Divider />
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Notes</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{recipe.notes}</Text>
          </>
        )}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}
