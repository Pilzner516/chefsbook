import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../../context/ThemeContext';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { usePinStore } from '../../lib/zustand/pinStore';
import { useCookingNotesStore } from '../../lib/zustand/cookingNotesStore';
import { shareRecipe } from '../../lib/sharing';
import { parseTimers, ParsedTimer } from '../../lib/timers';
import { formatDuration, formatServings, scaleQuantity, formatQuantity } from '@chefsbook/ui';
import { Badge, Button, Card, Divider, Loading, Input } from '../../components/UIKit';
import { CountdownTimer } from '../../components/CountdownTimer';

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
  const { addNote, removeNote, getNotesForRecipe } = useCookingNotesStore();
  const notes = useCookingNotesStore((s) => s.notes.filter((n) => n.recipeId === recipeId));
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
      <Text style={{ color: colors.accent, fontSize: 15, width: 70, textAlign: 'right', marginRight: 12 }}>
        {formatQuantity(scaled)} {ing.unit ?? ''}
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

// --- Main Recipe Detail ---
export default function RecipeDetail() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentRecipe, loading, fetchRecipe, toggleFav, removeRecipe } = useRecipeStore();
  const { pin, unpin, isPinned } = usePinStore();
  const [servings, setServings] = useState<number>(4);
  const [cookMode, setCookMode] = useState(false);

  useEffect(() => {
    if (id) fetchRecipe(id);
  }, [id]);

  useEffect(() => {
    if (currentRecipe) setServings(currentRecipe.servings);
  }, [currentRecipe]);

  if (loading || !currentRecipe) return <Loading message="Loading recipe..." />;

  const recipe = currentRecipe;
  const originalServings = recipe.servings || 4;
  const pinned = isPinned(recipe.id);

  if (cookMode) {
    return <CookMode steps={recipe.steps} onExit={() => setCookMode(false)} />;
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

        {/* Action buttons: Save, Share (feature #5), Pin (feature #3) */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title={recipe.is_favourite ? '\u2764 Saved' : '\u2661 Save'} onPress={() => toggleFav(recipe.id, recipe.is_favourite)} variant="secondary" />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="\uD83D\uDD17 Share" onPress={() => shareRecipe(recipe)} variant="secondary" />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={pinned ? '\uD83D\uDCCC Pinned' : '\uD83D\uDCCC Pin'}
              onPress={() => (pinned ? unpin(recipe.id) : pin(recipe))}
              variant={pinned ? 'primary' : 'secondary'}
            />
          </View>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Button title="Cook Mode" onPress={() => setCookMode(true)} />
        </View>

        <Divider />

        {/* Ingredients with serving scaler */}
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

        {/* Feature #6: linked sub-recipes */}
        {recipe.ingredients.map((ing) => (
          <IngredientRow
            key={ing.id}
            ing={ing}
            scaled={scaleQuantity(ing.quantity, originalServings, servings)}
            colors={colors}
          />
        ))}

        <Divider />

        {/* Steps with auto-detected timers (feature #1) */}
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Steps</Text>
        {recipe.steps.map((step) => {
          const timers = parseTimers(step.instruction);
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
                <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22 }}>{step.instruction}</Text>
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
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{recipe.notes}</Text>
          </>
        )}

        {/* Source metadata (bookmark import) */}
        <Divider />
        <SourceSection recipe={recipe} />

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
  );
}
