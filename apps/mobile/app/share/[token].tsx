import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { getRecipeByShareToken, saveRecipe } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';
import { formatDuration, formatQuantity } from '@chefsbook/ui';
import { Badge, Button, Divider, Loading, EmptyState } from '../../components/UIKit';
import { useTabBarHeight } from '../../lib/useTabBarHeight';

export default function SharedRecipe() {
  const { colors } = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExternalUrl, setIsExternalUrl] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Check if this looks like an external recipe URL rather than a share token
    if (token.startsWith('http') || token.includes('.')) {
      setIsExternalUrl(true);
      setLoading(false);
      return;
    }

    loadRecipe();
  }, [token]);

  const loadRecipe = async () => {
    const data = await getRecipeByShareToken(token!);
    setRecipe(data);
    setLoading(false);
  };

  const handleImportUrl = async () => {
    if (!session?.user?.id || !token) return;
    setImporting(true);
    try {
      const url = decodeURIComponent(token);
      const res = await fetch(url);
      const html = await res.text();
      const { importFromUrl } = await import('@chefsbook/ai');
      const scanned = await importFromUrl(html, url);
      const imported = await addRecipe(session.user.id, { ...scanned, source_url: url });
      router.replace(`/recipe/${imported.id}`);
    } catch (e: any) {
      Alert.alert('Import failed', e.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <Loading message="Loading shared recipe..." />;

  // External URL shared from browser — offer to import
  if (isExternalUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>{'\uD83D\uDD17'}</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
          Import this recipe?
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }} numberOfLines={2}>
          {decodeURIComponent(token!)}
        </Text>
        <View style={{ width: '100%', gap: 10 }}>
          <Button title="Import Recipe" onPress={handleImportUrl} loading={importing} />
          <Button title="Cancel" onPress={() => router.back()} variant="ghost" />
        </View>
      </View>
    );
  }

  if (!recipe) return <EmptyState icon="?" title="Recipe not found" message="This share link may have expired." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }} contentContainerStyle={{ paddingBottom: tabBarHeight }}>
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

        {/* Save CTA */}
        {session?.user && recipe.user_id !== session.user.id && (
          <View style={{ marginTop: 24 }}>
            <Button
              title={saving ? 'Saving...' : 'Add to my Chefsbook'}
              onPress={async () => {
                if (!session?.user?.id) return;
                setSaving(true);
                try {
                  // Extract ref from deep link if present (token may contain ?ref=)
                  let ref: string | null = null;
                  if (token?.includes('?ref=')) {
                    ref = token.split('?ref=')[1];
                  }
                  await saveRecipe(recipe.id, session.user.id);
                  router.replace(`/recipe/${recipe.id}`);
                } catch (e: any) {
                  Alert.alert('Error', e.message ?? 'Failed to save recipe');
                } finally {
                  setSaving(false);
                }
              }}
              loading={saving}
            />
          </View>
        )}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}
