import React, { useEffect, useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../../context/ThemeContext';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { usePinStore } from '../../lib/zustand/pinStore';
import { useCookingNotesStore } from '../../lib/zustand/cookingNotesStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { useAuthStore } from '../../lib/zustand/authStore';
import { shareRecipe } from '../../lib/sharing';
import { parseTimers, ParsedTimer } from '../../lib/timers';
import { formatDuration, formatServings, scaleQuantity, formatQuantity, DIETARY_FLAGS, CUISINE_LIST, COURSE_LIST, convertIngredient, convertTemperatureInText } from '@chefsbook/ui';
import { usePreferencesStore } from '../../lib/zustand/preferencesStore';
import { suggestPurchaseUnits, callClaude, extractJSON } from '@chefsbook/ai';
import { updateRecipe, updateRecipeMetadata, replaceIngredients, replaceSteps } from '@chefsbook/db';
import { Badge, Button, Card, Divider, Loading, Input } from '../../components/UIKit';
import { CountdownTimer } from '../../components/CountdownTimer';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';

// --- Error boundary to catch render crashes ---
class RecipeErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RecipeDetail] Render crash:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// --- Cook Mode (feature #2) ---
function CookMode({
  steps,
  onExit,
}: {
  steps: { step_number: number; instruction: string; timer_minutes: number | null }[];
  onExit: () => void;
}) {
  useKeepAwake();
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const autoTimers = useMemo(() => parseTimers(step?.instruction ?? ''), [step]);
  const allTimers = useMemo(() => {
    const timers = [...autoTimers];
    if (step?.timer_minutes && !timers.some((t) => t.minutes === step.timer_minutes)) {
      timers.push({ label: `${step.timer_minutes} min`, minutes: step.timer_minutes, startIndex: 0, endIndex: 0 });
    }
    return timers;
  }, [autoTimers, step]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
          Step {currentStep + 1} of {steps.length}
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32, marginBottom: 24 }}>
          {step?.instruction}
        </Text>

        {allTimers.length > 0 && (
          <View style={{ gap: 12, marginBottom: 24 }}>
            {allTimers.map((t, i) => (
              <CountdownTimer key={`${currentStep}-${i}`} minutes={t.minutes} label={t.label} />
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Previous" onPress={() => setCurrentStep((s) => Math.max(0, s - 1))} variant="secondary" disabled={currentStep === 0} />
          </View>
          <View style={{ flex: 1 }}>
            {currentStep < steps.length - 1 ? (
              <Button title="Next" onPress={() => setCurrentStep((s) => s + 1)} />
            ) : (
              <Button title="Done!" onPress={onExit} />
            )}
          </View>
        </View>
        <TouchableOpacity onPress={onExit} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Exit cook mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// --- Tappable Timer Badge (feature #1) ---
function TimerBadge({ timer }: { timer: ParsedTimer }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <View style={{ marginTop: 8 }}>
        <CountdownTimer minutes={timer.minutes} label={timer.label} compact />
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={() => setExpanded(true)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.accentSoft,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        gap: 4,
        marginTop: 4,
      }}
    >
      <Text style={{ fontSize: 12 }}>{'\u23F1'}</Text>
      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{timer.label}</Text>
    </TouchableOpacity>
  );
}

// --- Cooking Notes section (feature #4) ---
function CookingNotesSection({ recipeId }: { recipeId: string }) {
  const { colors } = useTheme();
  const addNote = useCookingNotesStore((s) => s.addNote);
  const removeNote = useCookingNotesStore((s) => s.removeNote);
  const allNotes = useCookingNotesStore((s) => s.notes);
  const notes = useMemo(() => allNotes.filter((n) => n.recipeId === recipeId), [allNotes, recipeId]);
  const [text, setText] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleAdd = () => {
    if (!text.trim()) return;
    addNote(recipeId, text.trim());
    setText('');
    setShowInput(false);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Cooking Notes</Text>
        <TouchableOpacity onPress={() => setShowInput(!showInput)}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{showInput ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {showInput && (
        <View style={{ marginBottom: 12 }}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="How did it turn out? Any adjustments?"
            multiline
          />
          <View style={{ marginTop: 8 }}>
            <Button title="Save Note" onPress={handleAdd} size="sm" />
          </View>
        </View>
      )}

      {notes.length === 0 && !showInput && (
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No cooking notes yet. Tap + Add after cooking!</Text>
      )}

      {notes.map((note) => (
        <View key={note.id} style={{
          backgroundColor: colors.bgBase,
          borderRadius: 10,
          padding: 12,
          marginBottom: 8,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {new Date(note.cookedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => removeNote(note.id)}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{'\u00D7'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{note.text}</Text>
        </View>
      ))}
    </View>
  );
}

// --- Linked ingredient row (feature #6) ---
function IngredientRow({
  ing,
  scaled,
  colors,
}: {
  ing: { id: string; quantity: number | null; unit: string | null; ingredient: string; preparation: string | null; optional: boolean };
  scaled: number | null;
  colors: any;
}) {
  const router = useRouter();
  const recipes = useRecipeStore((s) => s.recipes);
  const units = usePreferencesStore((s) => s.units);

  // Convert units based on preference
  const converted = useMemo(() => {
    return convertIngredient(scaled, ing.unit, units, ing.ingredient);
  }, [scaled, ing.unit, units, ing.ingredient]);

  // Check if this ingredient matches another recipe title (sub-recipe linking)
  const linked = useMemo(() => {
    const name = ing.ingredient.toLowerCase();
    return recipes.find((r) =>
      r.title.toLowerCase() === name ||
      name.includes(r.title.toLowerCase())
    );
  }, [ing.ingredient, recipes]);

  const handlePress = () => {
    if (linked) router.push(`/recipe/${linked.id}`);
  };

  return (
    <TouchableOpacity
      onPress={linked ? handlePress : undefined}
      disabled={!linked}
      style={{ flexDirection: 'row', paddingVertical: 6 }}
    >
      <Text
        numberOfLines={1}
        style={{ color: colors.accent, fontSize: 15, width: 80, textAlign: 'right', marginRight: 12 }}
      >
        {formatQuantity(converted.quantity)} {converted.unit}
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{
          color: colors.textPrimary,
          fontSize: 15,
          textDecorationLine: linked ? 'underline' : 'none',
          textDecorationColor: colors.accent,
        }}>
          {ing.ingredient}{ing.preparation ? `, ${ing.preparation}` : ''}{ing.optional ? ' (optional)' : ''}
        </Text>
        {linked && (
          <Text style={{ color: colors.accent, fontSize: 12, marginLeft: 4 }}>{'\u2197'}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// --- Source section (bookmark import metadata) ---
const SOURCE_LABELS: Record<string, string> = {
  url: 'Imported',
  scan: 'Scanned',
  manual: 'Manual',
  ai: 'AI generated',
  social: 'Social',
  cookbook: 'Cookbook',
};

function SourceSection({ recipe }: { recipe: { source_url: string | null; source_type: string; tags: string[] } }) {
  const { colors } = useTheme();
  const sourceLabel = SOURCE_LABELS[recipe.source_type] ?? recipe.source_type;
  const bookmarkFolder = recipe.tags?.find((t) => !['breakfast', 'lunch', 'dinner', 'dessert', 'snack'].includes(t.toLowerCase()));

  return (
    <View>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Source</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <Badge label={sourceLabel} />
        {bookmarkFolder && <Badge label={bookmarkFolder} color={colors.accentGreen} />}
      </View>
      {recipe.source_url && (
        <TouchableOpacity onPress={() => Linking.openURL(recipe.source_url!)}>
          <Text style={{ color: colors.accent, fontSize: 14, textDecorationLine: 'underline' }} numberOfLines={1}>
            View original recipe
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {recipe.source_url}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- Tag Management section ---
function TagManager({
  recipeId,
  tags,
  recipe,
  onTagsChanged,
}: {
  recipeId: string;
  tags: string[];
  recipe: { title: string; cuisine: string | null; ingredients?: { ingredient: string }[]; steps?: { instruction: string }[] };
  onTagsChanged: () => void;
}) {
  const { colors } = useTheme();
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const sanitizeTag = (t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();

  const addTag = async (raw: string) => {
    const tag = sanitizeTag(raw);
    if (!tag || tags.includes(tag)) return;
    try {
      await updateRecipe(recipeId, { tags: [...tags, tag] });
      onTagsChanged();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const removeTag = async (tag: string) => {
    try {
      await updateRecipe(recipeId, { tags: tags.filter((t) => t !== tag) });
      onTagsChanged();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    addTag(inputValue);
    setInputValue('');
  };

  const autoTag = async () => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const ingList = (recipe.ingredients ?? []).map((i) => i.ingredient).slice(0, 10).join(', ');
      const stepList = (recipe.steps ?? []).map((s) => s.instruction).slice(0, 5).join('. ');
      const prompt = `Suggest 5-8 tags for this recipe. Tags should be lowercase single words or hyphenated (e.g. "one-pot", "gluten-free"). Cover: main protein, cooking method, characteristics, diet flags if applicable.

Title: ${recipe.title}
Cuisine: ${recipe.cuisine ?? 'unknown'}
Ingredients: ${ingList}
Steps: ${stepList}

Return ONLY a JSON array of strings, e.g. ["chicken","baked","comfort-food"]`;

      const text = await callClaude({ prompt, maxTokens: 200 });
      const result = extractJSON<string[]>(text);
      const cleaned = result.map(sanitizeTag).filter((t) => t && !tags.includes(t));
      setSuggestions(cleaned);
    } catch (err: any) {
      Alert.alert('Auto-tag failed', err.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const addSuggestion = (tag: string) => {
    addTag(tag);
    setSuggestions((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Tags</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={autoTag} disabled={loadingSuggestions}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
              {loadingSuggestions ? 'Thinking...' : '🤖 Auto-tag'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowInput(!showInput)}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{showInput ? 'Cancel' : '+ Add Tag'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Existing tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {tags.length === 0 && !showInput && suggestions.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No tags yet. Tap + Add Tag or Auto-tag.</Text>
        )}
        {tags.map((tag) => (
          <View
            key={tag}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.accentSoft,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{tag}</Text>
            <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>{'\u00D7'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Add tag input */}
      {showInput && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Type a tag..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            style={{
              flex: 1,
              backgroundColor: colors.bgBase,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.borderDefault,
            }}
          />
          <TouchableOpacity
            onPress={handleSubmit}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 8,
              paddingHorizontal: 16,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI suggestions */}
      {suggestions.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Suggested tags — tap to add:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => addSuggestion(tag)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.accentGreenSoft,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: colors.accentGreen,
                  borderStyle: 'dashed',
                }}
              >
                <Text style={{ color: colors.accentGreen, fontSize: 13, fontWeight: '600' }}>+ {tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// --- Main Recipe Detail ---
export default function RecipeDetail() {
  return (
    <RecipeErrorBoundary>
      <RecipeDetailInner />
    </RecipeErrorBoundary>
  );
}

function RecipeDetailInner() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const loading = useRecipeStore((s) => s.loading);
  const fetchRecipe = useRecipeStore((s) => s.fetchRecipe);
  const toggleFav = useRecipeStore((s) => s.toggleFav);
  const removeRecipe = useRecipeStore((s) => s.removeRecipe);
  const pin = usePinStore((s) => s.pin);
  const unpin = usePinStore((s) => s.unpin);
  const pinnedList = usePinStore((s) => s.pinned);
  const preferredUnits = usePreferencesStore((s) => s.units);
  const session = useAuthStore((s) => s.session);
  const fetchShoppingLists = useShoppingStore((s) => s.fetchLists);
  const addShoppingList = useShoppingStore((s) => s.addList);
  const addItemsPipeline = useShoppingStore((s) => s.addItemsPipeline);
  const [servings, setServings] = useState<number>(4);
  const [cookMode, setCookMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIngredients, setEditIngredients] = useState<{ quantity: string; unit: string; ingredient: string; preparation: string; optional: boolean }[]>([]);
  const [editSteps, setEditSteps] = useState<{ instruction: string; timer_minutes: string }[]>([]);
  const [editDietaryFlags, setEditDietaryFlags] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (id) fetchRecipe(id);
  }, [id]);

  useEffect(() => {
    if (currentRecipe) setServings(currentRecipe.servings ?? 4);
  }, [currentRecipe?.id]);

  useEffect(() => {
    if (currentRecipe) {
      console.log('[RecipeDetail] recipe loaded:', currentRecipe.id, currentRecipe.title);
      console.log('[RecipeDetail] ingredients:', currentRecipe.ingredients?.length ?? 'MISSING');
      console.log('[RecipeDetail] steps:', currentRecipe.steps?.length ?? 'MISSING');
    } else if (!loading) {
      console.log('[RecipeDetail] recipe is null after loading finished');
    }
  }, [currentRecipe?.id, loading]);

  const handleAddToShoppingList = async () => {
    const userId = session?.user?.id;
    if (!userId || !currentRecipe) return;

    const makeItems = () => (currentRecipe.ingredients ?? []).map((ing) => {
      const scaled = scaleQuantity(ing.quantity, currentRecipe.servings || 4, servings);
      return {
        ingredient: ing.ingredient,
        quantity: scaled,
        unit: ing.unit,
        quantity_needed: [scaled, ing.unit].filter(Boolean).join(' ') || null,
        recipe_id: currentRecipe.id,
        recipe_name: currentRecipe.title,
      };
    });

    const addToList = async (listId: string, listName: string) => {
      const items = makeItems();
      // Get AI purchase unit suggestions
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
      const result = await addItemsPipeline(listId, userId, items, aiSuggestions);
      Alert.alert('Added!', `${result.inserted} new, ${result.merged} merged in "${listName}"`);
    };

    try {
      await fetchShoppingLists(userId);
      const lists = useShoppingStore.getState().lists;
      if (lists.length === 0) {
        const newList = await addShoppingList(userId, currentRecipe.title);
        await addToList(newList.id, newList.name);
      } else {
        Alert.alert('Add to Shopping List', 'Which list?', [
          ...lists.slice(0, 5).map((list) => ({
            text: list.name,
            onPress: () => addToList(list.id, list.name),
          })),
          { text: 'New List', onPress: async () => {
            const newList = await addShoppingList(userId, currentRecipe.title);
            await addToList(newList.id, newList.name);
          }},
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } catch (err) {
      console.error('[RecipeDetail] shopping list error:', err);
      Alert.alert('Error', 'Failed to add ingredients to shopping list');
    }
  };

  const startEditing = () => {
    if (!currentRecipe) return;
    setEditTitle(currentRecipe.title);
    setEditDesc(currentRecipe.description || '');
    setEditCuisine(currentRecipe.cuisine || '');
    setEditCourse(currentRecipe.course || '');
    setEditNotes(currentRecipe.notes || '');
    setEditDietaryFlags(currentRecipe.dietary_flags ?? []);
    setEditIngredients((currentRecipe.ingredients ?? []).map((ing) => ({
      quantity: ing.quantity != null ? String(ing.quantity) : '',
      unit: ing.unit || '',
      ingredient: ing.ingredient,
      preparation: ing.preparation || '',
      optional: ing.optional,
    })));
    setEditSteps((currentRecipe.steps ?? []).map((s) => ({
      instruction: s.instruction || '',
      timer_minutes: s.timer_minutes != null ? String(s.timer_minutes) : '',
    })));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEditing = async () => {
    if (!currentRecipe || !session?.user?.id) return;
    setSavingEdit(true);
    try {
      await updateRecipe(currentRecipe.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        cuisine: editCuisine.trim() || null,
        course: (editCourse.trim() || null) as any,
        notes: editNotes.trim() || null,
      });
      await updateRecipeMetadata(currentRecipe.id, {
        dietary_flags: editDietaryFlags,
      });
      await replaceIngredients(currentRecipe.id, session.user.id, editIngredients.map((ing, i) => ({
        quantity: ing.quantity ? parseFloat(ing.quantity) : null,
        unit: ing.unit || null,
        ingredient: ing.ingredient,
        preparation: ing.preparation || null,
        optional: ing.optional,
        group_label: null,
      })));
      await replaceSteps(currentRecipe.id, session.user.id, editSteps.map((s, i) => ({
        step_number: i + 1,
        instruction: s.instruction,
        timer_minutes: s.timer_minutes ? parseInt(s.timer_minutes) : null,
        group_label: null,
      })));
      await fetchRecipe(currentRecipe.id);
      setEditing(false);
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading || !currentRecipe) return <Loading message="Loading recipe..." />;

  const recipe = currentRecipe;
  const ingredients = recipe.ingredients ?? [];
  const steps = recipe.steps ?? [];
  const tags = recipe.tags ?? [];
  const originalServings = recipe.servings || 4;
  const pinned = pinnedList.some((r) => r.id === recipe.id);

  if (cookMode && steps.length > 0) {
    return <CookMode steps={steps} onExit={() => setCookMode(false)} />;
  }

  if (editing) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>Edit Recipe</Text>
            <TouchableOpacity onPress={cancelEditing}>
              <Text style={{ color: colors.accent, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Title</Text>
          <TextInput value={editTitle} onChangeText={setEditTitle} style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 12 }} />

          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Description</Text>
          <TextInput value={editDesc} onChangeText={setEditDesc} multiline style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' }} />

          {/* Cuisine chip selector */}
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Cuisine</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 40 }}>
            {CUISINE_LIST.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setEditCuisine(editCuisine === c ? '' : c)}
                style={{
                  backgroundColor: editCuisine === c ? colors.accent : colors.bgBase,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: editCuisine === c ? colors.accent : colors.borderDefault,
                }}
              >
                <Text style={{ color: editCuisine === c ? '#ffffff' : colors.textPrimary, fontSize: 13, fontWeight: editCuisine === c ? '600' : '400' }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Course chip selector */}
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Course</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 40 }}>
            {COURSE_LIST.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setEditCourse(editCourse.toLowerCase() === c.toLowerCase() ? '' : c.toLowerCase())}
                style={{
                  backgroundColor: editCourse.toLowerCase() === c.toLowerCase() ? colors.accent : colors.bgBase,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: editCourse.toLowerCase() === c.toLowerCase() ? colors.accent : colors.borderDefault,
                }}
              >
                <Text style={{ color: editCourse.toLowerCase() === c.toLowerCase() ? '#ffffff' : colors.textPrimary, fontSize: 13, fontWeight: editCourse.toLowerCase() === c.toLowerCase() ? '600' : '400' }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Dietary Flags toggle grid */}
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Dietary Flags</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {DIETARY_FLAGS.map((flag) => {
              const active = editDietaryFlags.includes(flag.key);
              return (
                <TouchableOpacity
                  key={flag.key}
                  onPress={() => setEditDietaryFlags(active ? editDietaryFlags.filter((f) => f !== flag.key) : [...editDietaryFlags, flag.key])}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: active ? colors.accent : colors.bgBase,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: active ? colors.accent : colors.borderDefault,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{flag.emoji}</Text>
                  <Text style={{ color: active ? '#ffffff' : colors.textPrimary, fontSize: 13, fontWeight: active ? '600' : '400' }}>{flag.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Attribution tag (read-only) */}
          {currentRecipe?.attributed_to_username && (
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => router.push(`/chef/${currentRecipe.attributed_to_username}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgBase,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  alignSelf: 'flex-start',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13 }}>🔗</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>via @{currentRecipe.attributed_to_username}</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>Original source — cannot be removed</Text>
            </View>
          )}

          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Ingredients</Text>
            <TouchableOpacity onPress={() => setEditIngredients([...editIngredients, { quantity: '', unit: '', ingredient: '', preparation: '', optional: false }])}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {editIngredients.map((ing, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <TextInput
                value={ing.quantity} placeholder="Qty"
                placeholderTextColor={colors.textSecondary}
                onChangeText={(v) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], quantity: v }; setEditIngredients(arr); }}
                style={{ width: 50, backgroundColor: colors.bgBase, borderRadius: 6, padding: 8, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, textAlign: 'center' }}
                keyboardType="decimal-pad"
              />
              <TextInput
                value={ing.unit} placeholder="Unit"
                placeholderTextColor={colors.textSecondary}
                onChangeText={(v) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], unit: v }; setEditIngredients(arr); }}
                style={{ width: 55, backgroundColor: colors.bgBase, borderRadius: 6, padding: 8, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault }}
              />
              <TextInput
                value={ing.ingredient} placeholder="Ingredient"
                placeholderTextColor={colors.textSecondary}
                onChangeText={(v) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], ingredient: v }; setEditIngredients(arr); }}
                style={{ flex: 1, backgroundColor: colors.bgBase, borderRadius: 6, padding: 8, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault }}
              />
              <TouchableOpacity onPress={() => setEditIngredients(editIngredients.filter((_, j) => j !== i))} style={{ padding: 4 }}>
                <Text style={{ color: colors.danger, fontSize: 18 }}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Steps</Text>
            <TouchableOpacity onPress={() => setEditSteps([...editSteps, { instruction: '', timer_minutes: '' }])}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {editSteps.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={step.instruction} placeholder="Step instruction..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  onChangeText={(v) => { const arr = [...editSteps]; arr[i] = { ...arr[i], instruction: v }; setEditSteps(arr); }}
                  style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 10, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, minHeight: 60, textAlignVertical: 'top' }}
                />
              </View>
              <TouchableOpacity onPress={() => setEditSteps(editSteps.filter((_, j) => j !== i))} style={{ padding: 4, marginTop: 8 }}>
                <Text style={{ color: colors.danger, fontSize: 18 }}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Divider />
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>Notes</Text>
          <TextInput value={editNotes} onChangeText={setEditNotes} multiline style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' }} />

          <Button title={savingEdit ? 'Saving...' : 'Save Changes'} onPress={saveEditing} disabled={savingEdit} />
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />
      <ScrollView style={{ flex: 1 }}>
      {/* Recipe image */}
      {recipe.image_url && /^https?:\/\//.test(recipe.image_url) ? (
        <Image
          source={{ uri: recipe.image_url }}
          style={{ width: '100%', height: 220 }}
          resizeMode="cover"
          onError={() => {}} // silently fail — layout still shows
        />
      ) : (
        <View style={{
          width: '100%', height: 220, backgroundColor: '#faf7f0',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
        </View>
      )}

      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 8 }}>{recipe.title}</Text>
        {recipe.description && (
          <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 12 }}>{recipe.description}</Text>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {recipe.cuisine && <Badge label={recipe.cuisine} />}
          {recipe.course && <Badge label={recipe.course} />}
          {recipe.total_minutes != null && recipe.total_minutes > 0 && <Badge label={formatDuration(recipe.total_minutes)} color={colors.accentGreen} />}
          {(recipe.dietary_flags ?? []).map((flag) => {
            const info = DIETARY_FLAGS.find((f) => f.key === flag);
            return info ? <Badge key={flag} label={`${info.emoji} ${info.label}`} color={colors.accentGreen} /> : null;
          })}
        </View>

        {/* Import status warning banner */}
        {recipe.import_status === 'partial' && (recipe.missing_sections?.length ?? 0) > 0 && (
          <View style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>{'\u26A0\uFE0F'}</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>Some sections could not be imported</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(recipe.missing_sections ?? []).map((section: string) => (
                <View key={section} style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{section}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (recipe.source_url) {
                    Alert.alert('Reimport', 'Re-fetch this recipe from the original URL?', [
                      { text: 'Cancel' },
                      { text: 'Reimport', onPress: () => Alert.alert('Coming soon', 'Reimport will be available soon.') },
                    ]);
                  }
                }}
                style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Try reimporting</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('aiChef', 'aiChef completion will suggest missing content based on the recipe title and available data.')}
                style={{ flex: 1, backgroundColor: colors.accentGreenSoft, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentGreen, fontSize: 13, fontWeight: '600' }}>{'\u2728'} Complete with aiChef</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* aiChef badge */}
        {recipe.aichef_assisted && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: colors.accentGreenSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: colors.accentGreen, fontSize: 12, fontWeight: '700' }}>{'\u2728'} aiChef assisted</Text>
            </View>
          </View>
        )}

        {/* Source attribution */}
        {recipe.source_url && (
          <TouchableOpacity
            onPress={() => { try { const { Linking } = require('react-native'); Linking.openURL(recipe.source_url!); } catch {} }}
            style={{ marginBottom: 8 }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {'\uD83D\uDCD6'} Original recipe{recipe.source_author ? ` by ${recipe.source_author}` : ''} at {new URL(recipe.source_url).hostname.replace('www.', '')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Attribution tag */}
        {recipe.attributed_to_username && (
          <TouchableOpacity
            onPress={() => router.push(`/chef/${recipe.attributed_to_username}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bgBase,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 6,
              alignSelf: 'flex-start',
              marginBottom: 16,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13 }}>🔗</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>via @{recipe.attributed_to_username}</Text>
          </TouchableOpacity>
        )}

        {/* Action icons */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 14, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => toggleFav(recipe.id, recipe.is_favourite)} style={{ padding: 6 }}>
            <Ionicons
              name={recipe.is_favourite ? 'heart' : 'heart-outline'}
              size={26}
              color={recipe.is_favourite ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shareRecipe(recipe)} style={{ padding: 6 }}>
            <Ionicons name="share-social-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (pinned ? unpin(recipe.id) : pin(recipe))} style={{ padding: 6 }}>
            <Text style={{ fontSize: 22, opacity: pinned ? 1 : 0.3 }}>📌</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={startEditing} style={{ padding: 6 }}>
            <Ionicons name="create-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Add to shopping list */}
        {ingredients.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Button
              title="🛒 Add to Shopping List"
              onPress={() => handleAddToShoppingList()}
              variant="secondary"
            />
          </View>
        )}

        {steps.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Button title="Cook Mode" onPress={() => setCookMode(true)} />
          </View>
        )}

        <Divider />

        {/* Ingredients with serving scaler */}
        {ingredients.length > 0 && (
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
        )}

        {/* Feature #6: linked sub-recipes */}
        {ingredients.map((ing) => (
          <IngredientRow
            key={ing.id}
            ing={ing}
            scaled={scaleQuantity(ing.quantity, originalServings, servings)}
            colors={colors}
          />
        ))}

        <Divider />

        {/* Steps with auto-detected timers (feature #1) */}
        {steps.length > 0 && (
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Steps</Text>
        )}
        {steps.map((step) => {
          const timers = parseTimers(step.instruction ?? '');
          // Include the DB timer_minutes if not already detected
          const allTimers = [...timers];
          if (step.timer_minutes && !timers.some((t) => t.minutes === step.timer_minutes)) {
            allTimers.push({ label: `${step.timer_minutes} min`, minutes: step.timer_minutes, startIndex: 0, endIndex: 0 });
          }

          return (
            <View key={step.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Text style={{ color: colors.bgScreen, fontSize: 13, fontWeight: '700' }}>{step.step_number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22 }}>{convertTemperatureInText(step.instruction ?? '', preferredUnits)}</Text>
                {allTimers.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {allTimers.map((t, i) => (
                      <TimerBadge key={i} timer={t} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Recipe notes */}
        {recipe.notes && (
          <>
            <Divider />
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Notes</Text>
            {recipe.notes
              .split(/\n+/)
              .flatMap((line: string) =>
                line.split(/(?<=\.)\s+(?=[A-Z][a-zA-Z\s/]*:\s)/)
              )
              .filter((p: string) => p.trim())
              .map((paragraph: string, i: number) => (
                <Text key={i} style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 10 }}>
                  {paragraph.trim()}
                </Text>
              ))}
          </>
        )}

        {/* Tag management */}
        <Divider />
        <TagManager
          recipeId={recipe.id}
          tags={tags}
          recipe={{ title: recipe.title, cuisine: recipe.cuisine, ingredients, steps }}
          onTagsChanged={() => fetchRecipe(recipe.id)}
        />

        {/* Source metadata (bookmark import) */}
        <Divider />
        <SourceSection recipe={{ ...recipe, tags }} />

        {/* Feature #4: cooking notes */}
        <Divider />
        <CookingNotesSection recipeId={recipe.id} />

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
    </View>
  );
}
