import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { shareRecipe } from '../../lib/sharing';
import { formatDuration, formatServings, scaleQuantity, formatQuantity } from '@chefsbook/ui';
import { Badge, Button, Card, Divider, Loading } from '../../components/UIKit';

export default function RecipeDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentRecipe, loading, fetchRecipe, toggleFav, removeRecipe } = useRecipeStore();
  const [servings, setServings] = useState<number>(4);
  const [cookMode, setCookMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (id) fetchRecipe(id);
  }, [id]);

  useEffect(() => {
    if (currentRecipe) setServings(currentRecipe.servings);
  }, [currentRecipe]);

  if (loading || !currentRecipe) return <Loading message="Loading recipe..." />;

  const recipe = currentRecipe;
  const originalServings = recipe.servings || 4;

  if (cookMode) {
    const step = recipe.steps[currentStep];
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
          Step {currentStep + 1} of {recipe.steps.length}
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32, marginBottom: 24 }}>
          {step?.instruction}
        </Text>
        {step?.timer_minutes && (
          <Text style={{ color: colors.accent, fontSize: 16, textAlign: 'center', marginBottom: 24 }}>
            {'\u23F1'} {step.timer_minutes} min
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Previous" onPress={() => setCurrentStep((s) => Math.max(0, s - 1))} variant="secondary" disabled={currentStep === 0} />
          </View>
          <View style={{ flex: 1 }}>
            {currentStep < recipe.steps.length - 1 ? (
              <Button title="Next" onPress={() => setCurrentStep((s) => s + 1)} />
            ) : (
              <Button title="Done!" onPress={() => setCookMode(false)} />
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => setCookMode(false)} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Exit cook mode</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Button title={recipe.is_favourite ? '\u2764 Saved' : '\u2661 Save'} onPress={() => toggleFav(recipe.id, recipe.is_favourite)} variant="secondary" />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Share" onPress={() => shareRecipe(recipe)} variant="secondary" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <Button title="Cook Mode" onPress={() => { setCurrentStep(0); setCookMode(true); }} />
        </View>

        <Divider />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Ingredients</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setServings((s) => Math.max(1, s - 1))}>
              <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '700' }}>-</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{formatServings(servings)}</Text>
            <TouchableOpacity onPress={() => setServings((s) => s + 1)}>
              <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '700' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {recipe.ingredients.map((ing) => (
          <View key={ing.id} style={{ flexDirection: 'row', paddingVertical: 6 }}>
            <Text style={{ color: colors.accent, fontSize: 15, width: 70, textAlign: 'right', marginRight: 12 }}>
              {formatQuantity(scaleQuantity(ing.quantity, originalServings, servings))} {ing.unit ?? ''}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>
              {ing.ingredient}{ing.preparation ? `, ${ing.preparation}` : ''}{ing.optional ? ' (optional)' : ''}
            </Text>
          </View>
        ))}

        <Divider />

        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Steps</Text>
        {recipe.steps.map((step) => (
          <View key={step.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
              <Text style={{ color: colors.bgScreen, fontSize: 13, fontWeight: '700' }}>{step.step_number}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22 }}>{step.instruction}</Text>
              {step.timer_minutes && (
                <Text style={{ color: colors.accent, fontSize: 13, marginTop: 4 }}>{'\u23F1'} {step.timer_minutes} min</Text>
              )}
            </View>
          </View>
        ))}

        {recipe.notes && (
          <>
            <Divider />
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Notes</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{recipe.notes}</Text>
          </>
        )}

        <Divider />
        <Button
          title="Delete Recipe"
          onPress={() => {
            Alert.alert('Delete Recipe', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { await removeRecipe(recipe.id); router.back(); } },
            ]);
          }}
          variant="ghost"
        />
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}
