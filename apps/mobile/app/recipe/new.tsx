import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { Button, Input, Card } from '../../components/UIKit';
import type { ScannedRecipe } from '@chefsbook/db';

export default function NewRecipe() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('4');
  const [prepMinutes, setPrepMinutes] = useState('');
  const [cookMinutes, setCookMinutes] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!title.trim() || !session?.user?.id) {
      Alert.alert('Error', 'Please enter a recipe title.');
      return;
    }

    setSaving(true);
    try {
      const ingredients = ingredientsText.split('\n').filter(Boolean).map((line, i) => ({
        quantity: null,
        unit: null,
        ingredient: line.trim(),
        preparation: null,
        optional: false,
        group_label: null,
      }));

      const steps = stepsText.split('\n').filter(Boolean).map((line, i) => ({
        step_number: i + 1,
        instruction: line.trim(),
        timer_minutes: null,
        group_label: null,
      }));

      const recipe: ScannedRecipe = {
        title: title.trim(),
        description: description.trim() || null,
        servings: parseInt(servings) || 4,
        prep_minutes: parseInt(prepMinutes) || null,
        cook_minutes: parseInt(cookMinutes) || null,
        cuisine: cuisine.trim() || null,
        course: null,
        ingredients,
        steps,
        notes: notes.trim() || null,
        source_type: 'manual',
      };

      const created = await addRecipe(session.user.id, recipe);
      router.replace(`/recipe/${created.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ padding: 16, gap: 16 }}>
        <Input value={title} onChangeText={setTitle} placeholder="Recipe title *" />
        <Input value={description} onChangeText={setDescription} placeholder="Description (optional)" multiline />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input value={servings} onChangeText={setServings} placeholder="Servings" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input value={prepMinutes} onChangeText={setPrepMinutes} placeholder="Prep (min)" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input value={cookMinutes} onChangeText={setCookMinutes} placeholder="Cook (min)" keyboardType="numeric" />
          </View>
        </View>

        <Input value={cuisine} onChangeText={setCuisine} placeholder="Cuisine (e.g. Italian)" />

        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Ingredients</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>One ingredient per line</Text>
          <Input value={ingredientsText} onChangeText={setIngredientsText} placeholder="2 cups flour\n1 tsp salt\n..." multiline />
        </Card>

        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Steps</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>One step per line</Text>
          <Input value={stepsText} onChangeText={setStepsText} placeholder="Mix dry ingredients\nAdd wet ingredients\n..." multiline />
        </Card>

        <Input value={notes} onChangeText={setNotes} placeholder="Notes (optional)" multiline />

        <Button title="Save Recipe" onPress={handleSave} loading={saving} disabled={!title.trim()} />
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}
