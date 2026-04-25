import React, { useEffect, useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, Linking, Image, ActivityIndicator, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { usePinStore } from '../../lib/zustand/pinStore';
import { useCookingNotesStore } from '../../lib/zustand/cookingNotesStore';
import { useShoppingStore } from '../../lib/zustand/shoppingStore';
import { useAuthStore } from '../../lib/zustand/authStore';
import { shareRecipe, getShareUrl } from '../../lib/sharing';
import * as Clipboard from 'expo-clipboard';
import { canDo } from '@chefsbook/db';
import { parseTimers, ParsedTimer } from '../../lib/timers';
import { formatDuration, formatServings, scaleQuantity, formatQuantity, DIETARY_FLAGS, CUISINE_LIST, COURSE_LIST, convertIngredient, convertTemperatureInText } from '@chefsbook/ui';
import { usePreferencesStore } from '../../lib/zustand/preferencesStore';
import { suggestPurchaseUnits, callClaude, extractJSON } from '@chefsbook/ai';
import { supabase, updateRecipe, updateRecipeMetadata, replaceIngredients, replaceSteps, getRecipeVersions, getRecipeTranslation, saveRecipeTranslation, removeSharedBy, cloneRecipe } from '@chefsbook/db';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RecipeTranslation } from '@chefsbook/db';
import { translateRecipe } from '@chefsbook/ai';
import type { TranslatedRecipe } from '@chefsbook/ai';
// TODO(web): add version picker UI on recipe detail
import { Badge, Button, Card, Divider, Loading, Input } from '../../components/UIKit';
import { CountdownTimer } from '../../components/CountdownTimer';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { EditImageGallery } from '../../components/EditImageGallery';
import { AiImageGenerationModal } from '../../components/AiImageGenerationModal';
import { takePhoto, pickImage, uploadRecipePhoto } from '../../lib/image';
import { RecipeImage } from '../../components/RecipeImage';
import { LikeButton } from '../../components/LikeButton';
import { RecipeComments } from '../../components/RecipeComments';
import { MealPlanPicker } from '../../components/MealPlanPicker';
import { HeroGallery } from '../../components/HeroGallery';
import { useConfirmDialog } from '../../components/useDialog';
import ChefsDialog from '../../components/ChefsDialog';
import { StorePicker } from '../../components/StorePicker';
import { NutritionCard } from '../../components/NutritionCard';
import type { NutritionEstimate } from '@chefsbook/ai';

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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const step = steps[currentStep];
  const autoTimers = useMemo(() => parseTimers(step?.instruction ?? ''), [step]);
  const allTimers = useMemo(() => {
    const timers = [...autoTimers];
    if (step?.timer_minutes && !timers.some((t) => t.minutes === step.timer_minutes)) {
      timers.push({ label: `${step.timer_minutes} min`, minutes: step.timer_minutes, startIndex: 0, endIndex: 0 });
    }
    return timers;
  }, [autoTimers, step]);

  const speakStep = (instruction: string) => {
    const Speech = require('expo-speech');
    Speech.stop();
    Speech.speak(instruction, { language: 'en' });
  };

  const navigateStep = (next: number) => {
    setCurrentStep(next);
    if (ttsEnabled && steps[next]?.instruction) {
      speakStep(steps[next].instruction);
    }
  };

  const handleExit = () => {
    const Speech = require('expo-speech');
    Speech.stop();
    onExit();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* TTS toggle header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDefault,
      }}>
        <TouchableOpacity
          onPress={() => setTtsEnabled((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: ttsEnabled ? '#ce2b37' : colors.bgBase,
            borderWidth: 1,
            borderColor: ttsEnabled ? '#ce2b37' : colors.borderDefault,
          }}
        >
          <Ionicons
            name={ttsEnabled ? 'volume-high' : 'volume-high-outline'}
            size={18}
            color={ttsEnabled ? '#ffffff' : colors.textSecondary}
          />
          <Text style={{ fontSize: 13, fontWeight: '600', color: ttsEnabled ? '#ffffff' : colors.textSecondary }}>
            {t('recipe.ttsToggle')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
          Step {currentStep + 1} of {steps.length}
        </Text>

        {/* Step instruction + "read this step" one-shot button */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32, marginBottom: 12 }}>
            {step?.instruction}
          </Text>
          <TouchableOpacity
            onPress={() => step?.instruction && speakStep(step.instruction)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              alignSelf: 'center',
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: colors.bgBase,
              borderWidth: 1,
              borderColor: colors.borderDefault,
            }}
          >
            <Ionicons name="volume-medium-outline" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>{t('recipe.readStep')}</Text>
          </TouchableOpacity>
        </View>

        {allTimers.length > 0 && (
          <View style={{ gap: 12, marginBottom: 24 }}>
            {allTimers.map((t, i) => (
              <CountdownTimer key={`${currentStep}-${i}`} minutes={t.minutes} label={t.label} />
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Previous" onPress={() => navigateStep(Math.max(0, currentStep - 1))} variant="secondary" disabled={currentStep === 0} />
          </View>
          <View style={{ flex: 1 }}>
            {currentStep < steps.length - 1 ? (
              <Button title="Next" onPress={() => navigateStep(currentStep + 1)} />
            ) : (
              <Button title="Done!" onPress={handleExit} />
            )}
          </View>
        </View>
        <TouchableOpacity onPress={handleExit} style={{ marginTop: 20, alignItems: 'center', paddingBottom: insets.bottom + 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('recipe.exitCookMode')}</Text>
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
  const { t } = useTranslation();
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
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('recipe.cookingNotes')}</Text>
        <TouchableOpacity onPress={() => setShowInput(!showInput)}>
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{showInput ? t('common.cancel') : t('recipe.addNote')}</Text>
        </TouchableOpacity>
      </View>

      {showInput && (
        <View style={{ marginBottom: 12 }}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder={t('recipe.notePlaceholder')}
            multiline
          />
          <View style={{ marginTop: 8 }}>
            <Button title={t('recipe.saveNote')} onPress={handleAdd} size="sm" />
          </View>
        </View>
      )}

      {notes.length === 0 && !showInput && (
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('recipe.noNotes')}</Text>
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

const DESCRIPTOR_UNITS = new Set([
  'handful', 'pinch', 'dash', 'splash', 'sprig', 'drizzle',
  'bunch', 'knob', 'clove', 'slice', 'piece', 'spoonful',
]);

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

  // If quantity is 0 or null but a descriptor unit is present, display 1
  const displayQuantity = useMemo(() => {
    if ((converted.quantity === 0 || converted.quantity === null) && converted.unit) {
      const unitWord = converted.unit.toLowerCase().split(' ')[0] ?? '';
      if (DESCRIPTOR_UNITS.has(unitWord)) return 1;
    }
    return converted.quantity;
  }, [converted.quantity, converted.unit]);

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
        {formatQuantity(displayQuantity)} {converted.unit}
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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sourceLabel = SOURCE_LABELS[recipe.source_type] ?? recipe.source_type;
  const bookmarkFolder = recipe.tags?.find((t) => !['breakfast', 'lunch', 'dinner', 'dessert', 'snack'].includes(t.toLowerCase()));

  return (
    <View>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{t('recipe.sourceLabel')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <Badge label={sourceLabel} />
        {bookmarkFolder && <Badge label={bookmarkFolder} color={colors.accentGreen} />}
      </View>
      {recipe.source_url && (
        <TouchableOpacity onPress={() => Linking.openURL(recipe.source_url!)}>
          <Text style={{ color: colors.accent, fontSize: 14, textDecorationLine: 'underline' }} numberOfLines={1}>
            {t('recipe.viewOriginal')}
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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const sanitizeTag = (t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();

  const addTag = async (raw: string) => {
    const tag = sanitizeTag(raw);
    if (!tag || tags.includes(tag)) return;
    try {
      await updateRecipe(recipeId, { tags: [...tags, tag] });
      onTagsChanged();
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
  };

  const removeTag = async (tag: string) => {
    try {
      await updateRecipe(recipeId, { tags: tags.filter((t) => t !== tag) });
      onTagsChanged();
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
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
      setSelectedSuggestions(new Set());
    } catch (err: any) {
      Alert.alert(t('recipe.autoTagFailed'), err.message);
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
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('recipe.tags')}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={autoTag} disabled={loadingSuggestions}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
              {loadingSuggestions ? 'Thinking...' : t('recipe.autoTag')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowInput(!showInput)}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{showInput ? t('common.cancel') : t('recipe.addTag')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Existing tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {tags.length === 0 && !showInput && suggestions.length === 0 && (
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('recipe.noTags')}</Text>
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
            placeholder={t('recipe.tagPlaceholder')}
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
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t('common.add')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI suggestions — multi-select */}
      {suggestions.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>{t('recipe.suggestedTags')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {suggestions.map((tag) => {
              const selected = selectedSuggestions.has(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => {
                    setSelectedSuggestions((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag)) next.delete(tag); else next.add(tag);
                      return next;
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: selected ? colors.accentGreen : colors.accentGreenSoft,
                    borderRadius: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: colors.accentGreen,
                    borderStyle: selected ? 'solid' : 'dashed',
                    gap: 4,
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  <Text style={{ color: selected ? '#fff' : colors.accentGreen, fontSize: 13, fontWeight: '600' }}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={async () => {
                for (const tag of selectedSuggestions) {
                  await addTag(tag);
                }
                setSuggestions([]);
                setSelectedSuggestions(new Set());
              }}
              disabled={selectedSuggestions.size === 0}
              style={{
                backgroundColor: selectedSuggestions.size > 0 ? colors.accentGreen : colors.bgBase,
                borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
                opacity: selectedSuggestions.size > 0 ? 1 : 0.5,
              }}
            >
              <Text style={{ color: selectedSuggestions.size > 0 ? '#fff' : colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                {selectedSuggestions.size > 0 ? t('recipe.addSelected', { count: selectedSuggestions.size }) : t('recipe.addSelectedDefault')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSuggestions([]); setSelectedSuggestions(new Set()); }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('common.dismiss')}</Text>
            </TouchableOpacity>
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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const loading = useRecipeStore((s) => s.loading);
  const fetchRecipe = useRecipeStore((s) => s.fetchRecipe);
  const toggleFav = useRecipeStore((s) => s.toggleFav);
  const removeRecipe = useRecipeStore((s) => s.removeRecipe);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const pin = usePinStore((s) => s.pin);
  const unpin = usePinStore((s) => s.unpin);
  const pinnedList = usePinStore((s) => s.pinned);
  const preferredUnits = usePreferencesStore((s) => s.units);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const planTier = useAuthStore((s) => s.planTier);
  const fetchShoppingLists = useShoppingStore((s) => s.fetchLists);
  const addShoppingList = useShoppingStore((s) => s.addList);
  const addItemsPipeline = useShoppingStore((s) => s.addItemsPipeline);
  const [confirmAction, ConfirmActionDialog] = useConfirmDialog();
  const [showRecipeStorePicker, setShowRecipeStorePicker] = useState(false);
  const [servings, setServings] = useState<number>(4);
  const [cookMode, setCookMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingClone, setSavingClone] = useState(false);
  const [savedClone, setSavedClone] = useState(false);
  const insets = useSafeAreaInsets();
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCuisine, setEditCuisine] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editIngredients, setEditIngredients] = useState<{ quantity: string; unit: string; ingredient: string; preparation: string; optional: boolean }[]>([]);
  const [editSteps, setEditSteps] = useState<{ instruction: string; timer_minutes: string }[]>([]);
  const [editDietaryFlags, setEditDietaryFlags] = useState<string[]>([]);
  const [editVisibility, setEditVisibility] = useState<'private' | 'shared_link' | 'public'>('private');
  const [savingEdit, setSavingEdit] = useState(false);
  const [heroRefreshKey, setHeroRefreshKey] = useState(0);
  const [showAiGenerationModal, setShowAiGenerationModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);
  const [showMealPicker, setShowMealPicker] = useState(false);
  const language = usePreferencesStore((s) => s.language);
  const [translation, setTranslation] = useState<RecipeTranslation | null>(null);
  const [translating, setTranslating] = useState(false);
  // Dialog state — replaces Alert.alert for all user-facing choices
  const [showChangeImageDialog, setShowChangeImageDialog] = useState(false);
  const [showShareOptionsDialog, setShowShareOptionsDialog] = useState(false);
  const [showPrivateShareDialog, setShowPrivateShareDialog] = useState(false);
  const [showWhichListDialog, setShowWhichListDialog] = useState(false);
  const [whichListOptions, setWhichListOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [showVersionPickerDialog, setShowVersionPickerDialog] = useState(false);
  const [versionPickerOptions, setVersionPickerOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [showReimportSoonDialog, setShowReimportSoonDialog] = useState(false);
  const [showAiChefDialog, setShowAiChefDialog] = useState(false);
  // Refs hold the recipe/action target for dialogs (avoids extra re-renders)
  const shareTargetRef = React.useRef<typeof currentRecipe>(null);
  const privateSharUrlRef = React.useRef<string>('');
  const addToListRef = React.useRef<(listId: string, listName: string) => void>(() => {});

  useEffect(() => {
    if (id) fetchRecipe(id);
  }, [id]);

  useEffect(() => {
    if (currentRecipe) setServings(currentRecipe.servings ?? 4);
  }, [currentRecipe?.id]);

  // Translation: check cache or translate in background
  useEffect(() => {
    if (!currentRecipe || language === 'en') {
      setTranslation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // Check cache first
      const cached = await getRecipeTranslation(currentRecipe.id, language);
      if (cancelled) return;
      if (cached) { setTranslation(cached); return; }

      // No cache — translate in background
      setTranslating(true);
      try {
        const result = await translateRecipe(
          {
            title: currentRecipe.title,
            description: currentRecipe.description,
            ingredients: (currentRecipe.ingredients ?? []).map((i) => ({
              quantity: i.quantity,
              unit: i.unit,
              ingredient: i.ingredient,
              preparation: i.preparation,
            })),
            steps: (currentRecipe.steps ?? []).map((s) => ({ instruction: s.instruction })),
            notes: currentRecipe.notes,
          },
          language,
        );
        if (cancelled) return;
        await saveRecipeTranslation(currentRecipe.id, language, {
          title: result.title,
          description: result.description,
          ingredients: result.ingredients,
          steps: result.steps,
          notes: result.notes,
        });
        // Re-fetch from DB to get proper structure
        const saved = await getRecipeTranslation(currentRecipe.id, language);
        if (!cancelled) setTranslation(saved);
      } catch (err) {
        console.warn('[RecipeDetail] Translation failed:', err);
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentRecipe?.id, language]);

  const handleAddToShoppingList = async () => {
    const userId = session?.user?.id;
    if (!userId || !currentRecipe) return;

    const makeItems = () => {
      const ings = currentRecipe.ingredients ?? [];
      return ings
        .filter((ing) => ing != null && ing.ingredient)
        .map((ing) => {
          let scaled: number | null = null;
          try {
            scaled = scaleQuantity(ing.quantity, currentRecipe.servings || 4, servings);
          } catch { scaled = ing.quantity; }
          return {
            ingredient: ing.ingredient,
            quantity: scaled,
            unit: ing.unit,
            quantity_needed: [scaled, ing.unit].filter(Boolean).join(' ') || null,
            recipe_id: currentRecipe.id,
            recipe_name: currentRecipe.title,
          };
        });
    };

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
      Alert.alert(t('recipe.addedTitle'), t('recipe.addedBody', { inserted: result.inserted, merged: result.merged, listName }));
    };

    try {
      await fetchShoppingLists(userId);
      const lists = useShoppingStore.getState().lists;
      if (lists.length === 0) {
        setShowRecipeStorePicker(true);
      } else {
        addToListRef.current = addToList;
        setWhichListOptions(lists.slice(0, 5));
        setShowWhichListDialog(true);
      }
    } catch (err) {
      console.error('[RecipeDetail] shopping list error:', err);
      Alert.alert(t('common.errorTitle'), t('recipe.failedAddIngredients'));
    }
  };

  const handleShareRecipe = (r: typeof recipe) => {
    if (!r) return;
    shareTargetRef.current = r;
    setShowShareOptionsDialog(true);
  };

  const executeShareViaLink = async () => {
    const r = shareTargetRef.current;
    if (!r) return;
    const profile = useAuthStore.getState().profile;
    if (r.visibility === 'private') {
      const url = getShareUrl(r.share_token, profile?.username);
      privateSharUrlRef.current = url;
      setShowShareOptionsDialog(false);
      setShowPrivateShareDialog(true);
      return;
    }
    const url = getShareUrl(r.share_token, profile?.username);
    await Clipboard.setStringAsync(url);
    Alert.alert(t('share.linkCopied'));
    shareRecipe(r, profile?.username);
  };

  const executeShareAsPdf = async () => {
    const r = shareTargetRef.current;
    if (!r) return;
    const userPlan = useAuthStore.getState().profile?.plan_tier ?? 'free';
    if (!canDo(userPlan, 'canPDF')) {
      Alert.alert(t('share.proOnly'), t('share.proOnlyMessage'));
      return;
    }
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.access_token) return;
      const FileSystem = require('expo-file-system/legacy');
      const Sharing = require('expo-sharing');
      const pdfUri = FileSystem.cacheDirectory + `${r.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.pdf`;
      const result = await FileSystem.downloadAsync(
        `https://chefsbk.app/recipe/${r.id}/pdf`,
        pdfUri,
        { headers: { Authorization: `Bearer ${sess.access_token}` } },
      );
      if (result.status === 200) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `Share ${r.title}` });
      } else {
        Alert.alert(t('common.errorTitle'), 'PDF generation failed');
      }
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    }
  };

  // ── Image management ──

  const handlePhotoUpload = async (localUri: string) => {
    if (!session?.user?.id || !currentRecipe) return;
    const ok = await confirmAction({
      title: t('imageManager.copyrightTitle'),
      body: t('imageManager.copyrightBody'),
      confirmLabel: t('imageManager.iOwnThis'),
    });
    if (!ok) return;
    setUploadingImage(true);
    try {
      const publicUrl = await uploadRecipePhoto(localUri, currentRecipe.id);
      await supabase.from('recipe_user_photos')
        .update({ is_primary: false })
        .eq('recipe_id', currentRecipe.id).eq('is_primary', true);
      await supabase.from('recipe_user_photos').insert({
        recipe_id: currentRecipe.id,
        user_id: session.user.id,
        storage_path: `${currentRecipe.id}/${Date.now()}.jpg`,
        url: publicUrl,
        is_primary: true,
        sort_order: 0,
      });
      await updateRecipe(currentRecipe.id, { image_url: publicUrl });
      setHeroRefreshKey((k) => k + 1);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const uri = await takePhoto();
      if (uri) await handlePhotoUpload(uri);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const uri = await pickImage();
      if (uri) await handlePhotoUpload(uri);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
  };

  const handleRemoveImage = async () => {
    if (!currentRecipe) return;
    try {
      const { data: photos } = await supabase
        .from('recipe_user_photos')
        .select('id')
        .eq('recipe_id', currentRecipe.id);
      for (const photo of photos ?? []) {
        await supabase.from('recipe_user_photos').delete().eq('id', photo.id);
      }
      await updateRecipe(currentRecipe.id, { image_url: null });
      setHeroRefreshKey((k) => k + 1);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message);
    }
  };

  const handleChangeImageTap = () => {
    setShowChangeImageDialog(true);
  };

  const handleImageGenerated = () => {
    setHeroRefreshKey((k) => k + 1);
  };

  const handleToggleVisibility = async (recipe: typeof currentRecipe) => {
    if (!recipe || visibilityUpdating) return;
    const isPublic = recipe.visibility === 'public';
    const ok = await confirmAction({
      title: isPublic ? t('recipe.makePrivate') : t('recipe.makePublic'),
      body: isPublic ? t('recipe.makePrivateBody') : t('recipe.makePublicBody'),
      confirmLabel: isPublic ? t('recipe.visibilityPrivate') : t('recipe.visibilityPublic'),
    });
    if (!ok) return;
    const newVisibility = isPublic ? 'private' : 'public';
    setVisibilityUpdating(true);
    try {
      await updateRecipe(recipe.id, { visibility: newVisibility as any });
      await fetchRecipe(recipe.id);
    } catch {
      Alert.alert(t('common.errorTitle'), t('recipe.visibilityUpdateFailed'));
    } finally {
      setVisibilityUpdating(false);
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
    setEditVisibility((currentRecipe.visibility as 'private' | 'shared_link' | 'public') ?? 'private');
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

  const cancelEditing = async () => {
    const ok = await confirmAction({
      title: t('recipe.unsavedChanges'),
      body: t('recipe.unsavedChangesBody'),
      confirmLabel: t('recipe.discard'),
    });
    if (ok) {
      setEditing(false);
      setHeroRefreshKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (!editing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmAction({
        title: t('recipe.unsavedChanges'),
        body: t('recipe.unsavedChangesBody'),
        confirmLabel: t('recipe.discard'),
      }).then((ok) => {
        if (ok) {
          setEditing(false);
          setHeroRefreshKey((k) => k + 1);
        }
      });
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

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
        visibility: editVisibility,
      });
      // Only update dietary_flags if they actually changed
      const flagsChanged =
        JSON.stringify(editDietaryFlags) !== JSON.stringify(currentRecipe.dietary_flags ?? []);
      if (flagsChanged) {
        await updateRecipeMetadata(currentRecipe.id, {
          dietary_flags: editDietaryFlags,
        });
      }
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
      setHeroRefreshKey((k) => k + 1);
    } catch (err: any) {
      Alert.alert(t('recipe.saveFailed'), err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Translated display values — must be above early return to maintain hook order
  const _ingredients = currentRecipe?.ingredients ?? [];
  const _steps = currentRecipe?.steps ?? [];
  const displayIngredients = useMemo(() => {
    if (!translation?.translated_ingredients) return _ingredients;
    return _ingredients.map((ing, i) => {
      const tr = (translation.translated_ingredients as any[])?.[i];
      if (!tr) return ing;
      return { ...ing, ingredient: tr.name ?? ing.ingredient, preparation: tr.notes ?? ing.preparation };
    });
  }, [_ingredients, translation]);
  const displaySteps = useMemo(() => {
    if (!translation?.translated_steps) return _steps;
    return _steps.map((step, i) => {
      const tr = (translation.translated_steps as any[])?.[i];
      if (!tr) return step;
      return { ...step, instruction: tr.instruction ?? step.instruction };
    });
  }, [_steps, translation]);

  if (loading || !currentRecipe) return <Loading message="Loading recipe..." />;

  const recipe = currentRecipe;
  const ingredients = recipe.ingredients ?? [];
  const steps = recipe.steps ?? [];
  const tags = recipe.tags ?? [];
  const originalServings = recipe.servings || 4;
  const pinned = pinnedList.some((r) => r.id === recipe.id);

  const displayTitle = translation?.translated_title ?? recipe.title;
  const displayDescription = translation?.translated_description ?? recipe.description;
  const displayNotes = translation?.translated_notes ?? recipe.notes;

  if (cookMode && steps.length > 0) {
    return <CookMode steps={steps} onExit={() => setCookMode(false)} />;
  }

  if (editing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('recipe.editRecipe')}</Text>
            <TouchableOpacity onPress={cancelEditing}>
              <Text style={{ color: colors.accent, fontSize: 15 }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('recipe.title')}</Text>
          <TextInput value={editTitle} onChangeText={setEditTitle} style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 12 }} />

          {/* Photo gallery — edit mode */}
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('recipe.photos')}</Text>
          {session?.user?.id && (
            <EditImageGallery recipeId={currentRecipe.id} userId={session.user.id} editing={true} recipeTitle={editTitle || currentRecipe.title} />
          )}

          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('recipe.description')}</Text>
          <TextInput value={editDesc} onChangeText={setEditDesc} multiline style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' }} />

          {/* Cuisine chip selector */}
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{t('search.cuisine')}</Text>
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
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{t('search.course')}</Text>
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
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{t('recipe.dietaryFlags')}</Text>
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

          {/* Visibility picker */}
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Visibility</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {([
              { key: 'private', label: 'Private', emoji: '🔒' },
              { key: 'shared_link', label: 'Shared Link', emoji: '🔗' },
              { key: 'public', label: 'Public', emoji: '🌐' },
            ] as const).map((opt) => {
              const active = editVisibility === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={async () => {
                    const isDowngrade = editVisibility === 'public' && opt.key === 'private';
                    if (isDowngrade) {
                      const ok = await confirmAction({
                        icon: '⚠️',
                        title: 'Make private?',
                        body: 'This will hide the recipe from other users. Continue?',
                        confirmLabel: 'Make Private',
                        variant: 'primary',
                      });
                      if (!ok) return;
                    }
                    setEditVisibility(opt.key);
                  }}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 4, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10,
                    backgroundColor: active ? colors.accent : colors.bgBase,
                    borderWidth: 1, borderColor: active ? colors.accent : colors.borderDefault,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                  <Text style={{ color: active ? '#ffffff' : colors.textPrimary, fontSize: 12, fontWeight: active ? '600' : '500' }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Attribution tags (read-only in edit mode) */}
          {currentRecipe?.original_submitter_username && currentRecipe.original_submitter_id !== currentRecipe.user_id && (
            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => router.push(`/chef/${currentRecipe.original_submitter_id}`)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: colors.accentSoft, borderRadius: 16,
                  paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
                }}
              >
                <Ionicons name="lock-closed" size={12} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                  {t('attribution.originalBy')} @{currentRecipe.original_submitter_username}
                </Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{t('recipe.originalSource')}</Text>
            </View>
          )}

          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('recipe.ingredients')}</Text>
            <TouchableOpacity onPress={() => setEditIngredients([...editIngredients, { quantity: '', unit: '', ingredient: '', preparation: '', optional: false }])}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{t('recipe.addIngredient')}</Text>
            </TouchableOpacity>
          </View>
          {editIngredients.map((ing, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <TextInput
                value={ing.quantity} placeholder={t('recipe.qty')}
                placeholderTextColor={colors.textSecondary}
                onChangeText={(v) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], quantity: v }; setEditIngredients(arr); }}
                style={{ width: 50, backgroundColor: colors.bgBase, borderRadius: 6, padding: 8, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, textAlign: 'center' }}
                keyboardType="decimal-pad"
              />
              <TextInput
                value={ing.unit} placeholder={t('recipe.unit')}
                placeholderTextColor={colors.textSecondary}
                onChangeText={(v) => { const arr = [...editIngredients]; arr[i] = { ...arr[i], unit: v }; setEditIngredients(arr); }}
                style={{ width: 55, backgroundColor: colors.bgBase, borderRadius: 6, padding: 8, fontSize: 13, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault }}
              />
              <TextInput
                value={ing.ingredient} placeholder={t('recipe.ingredientLabel')}
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
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('recipe.steps')}</Text>
            <TouchableOpacity onPress={() => setEditSteps([...editSteps, { instruction: '', timer_minutes: '' }])}>
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{t('recipe.addStep')}</Text>
            </TouchableOpacity>
          </View>
          {editSteps.map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={step.instruction} placeholder={t('recipe.stepPlaceholder')}
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
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{t('recipe.notes')}</Text>
          <TextInput value={editNotes} onChangeText={setEditNotes} multiline style={{ backgroundColor: colors.bgBase, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' }} />

          <View style={{ height: 16 }} />
        </View>
      </ScrollView>

      {/* Floating save bar */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.bgScreen,
        borderTopWidth: 1,
        borderTopColor: colors.borderDefault,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12 + insets.bottom,
        flexDirection: 'row',
        gap: 10,
      }}>
        <TouchableOpacity
          onPress={async () => {
            if (!session?.user?.id || !currentRecipe) return;
            setSavingClone(true);
            try {
              const copy = await addRecipe(session.user.id, {
                title: (currentRecipe.title ?? '') + ' (Copy)',
                description: currentRecipe.description ?? null,
                cuisine: currentRecipe.cuisine ?? null,
                course: currentRecipe.course as any,
                servings: currentRecipe.servings ?? 4,
                prep_minutes: currentRecipe.prep_minutes ?? null,
                cook_minutes: currentRecipe.cook_minutes ?? null,
                notes: currentRecipe.notes ?? null,
                source_type: 'manual' as any,
                ingredients: (currentRecipe.ingredients ?? []).map((i) => ({
                  quantity: i.quantity,
                  unit: i.unit,
                  ingredient: i.ingredient,
                  preparation: i.preparation,
                  optional: i.optional,
                  group_label: i.group_label,
                })),
                steps: (currentRecipe.steps ?? []).map((s) => ({
                  step_number: s.step_number,
                  instruction: s.instruction,
                  timer_minutes: s.timer_minutes,
                  group_label: s.group_label,
                })),
              });
              if ((currentRecipe.tags?.length ?? 0) > 0 || (currentRecipe.dietary_flags?.length ?? 0) > 0) {
                await updateRecipe(copy.id, {
                  tags: currentRecipe.tags ?? [],
                  dietary_flags: currentRecipe.dietary_flags ?? [],
                });
              }
              Alert.alert(t('recipe.copySaved'));
              router.replace(`/recipe/${copy.id}`);
            } catch (err: any) {
              Alert.alert(t('common.errorTitle'), err.message);
            } finally {
              setSavingClone(false);
            }
          }}
          disabled={savingClone || savingEdit}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: colors.bgBase,
            borderRadius: 10,
            paddingVertical: 13,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            opacity: savingClone || savingEdit ? 0.5 : 1,
          }}
        >
          <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
            {savingClone ? t('recipe.saving') : t('recipe.saveACopy')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={saveEditing}
          disabled={savingEdit || savingClone}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.accent,
            borderRadius: 10,
            paddingVertical: 13,
            opacity: savingEdit || savingClone ? 0.5 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
            {savingEdit ? t('recipe.saving') : t('common.save')}
          </Text>
        </TouchableOpacity>
      </View>
      <ConfirmActionDialog />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />
      <ScrollView style={{ flex: 1 }}>
      {/* Hero image gallery — user photos or fallback to recipe.image_url / chef's hat */}
      <View style={{ position: 'relative' }}>
        <HeroGallery recipeId={recipe.id} fallbackImageUrl={recipe.image_url} refreshKey={heroRefreshKey} />
        {recipe.user_id === session?.user?.id && (
          <TouchableOpacity
            onPress={handleChangeImageTap}
            disabled={uploadingImage}
            style={{
              position: 'absolute', bottom: 12, right: 12,
              backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
              paddingHorizontal: 10, paddingVertical: 6,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}
          >
            {uploadingImage
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera-outline" size={16} color="#fff" />
            }
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              {uploadingImage ? t('imageManager.uploading') : t('imageManager.changeImage')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ padding: 16 }}>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '700', flex: 1 }}>{displayTitle}</Text>
          {translating && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, gap: 6 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>{t('recipe.translating')}</Text>
            </View>
          )}
        </View>
        {/* Version indicator */}
        {(recipe.is_parent || recipe.parent_recipe_id) && (
          <TouchableOpacity
            onPress={async () => {
              const parentId = recipe.parent_recipe_id || recipe.id;
              try {
                const versions = await getRecipeVersions(parentId);
                const otherVersions = versions.filter((v) => v.id !== recipe.id);
                if (otherVersions.length === 0) return;
                setVersionPickerOptions(otherVersions.map((v) => ({
                  id: v.id,
                  label: `V${v.version_number}${v.version_label ? ` (${v.version_label})` : ''} — ${v.title}`,
                })));
                setShowVersionPickerDialog(true);
              } catch {}
            }}
            style={{ marginBottom: 8 }}
          >
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
              {t('recipe.version')} {recipe.version_number}{recipe.version_label ? ` · ${recipe.version_label}` : ''} — {t('recipe.tapToSwitch')}
            </Text>
          </TouchableOpacity>
        )}
        {!recipe.is_parent && !recipe.parent_recipe_id && <View style={{ marginBottom: 4 }} />}

        {/* Attribution row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(() => {
            const uploaderUsername = recipe.original_submitter_username ?? (recipe.user_id === session?.user?.id ? profile?.username : null);
            const uploaderId = recipe.original_submitter_id ?? (recipe.user_id === session?.user?.id ? session.user.id : null);
            return uploaderUsername ? (
              <TouchableOpacity
                onPress={() => uploaderId && router.push(`/chef/${uploaderId}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgBase, borderRadius: 24, paddingLeft: 6, paddingRight: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.borderDefault }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '700' }}>{uploaderUsername.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>@{uploaderUsername}</Text>
              </TouchableOpacity>
            ) : null;
          })()}
          {recipe.source_url ? (
            <TouchableOpacity
              onPress={() => { try { Linking.openURL(recipe.source_url!); } catch {} }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgBase, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.borderDefault }}
            >
              <Text style={{ fontSize: 13 }}>🔗</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{(() => { try { return new URL(recipe.source_url!).hostname.replace('www.', ''); } catch { return 'Source'; } })()}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>↗</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {displayDescription && (
          <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 12 }}>{displayDescription}</Text>
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

        {/* Save count */}
        {(recipe.save_count ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <Ionicons name="heart" size={14} color={colors.accent} />
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {recipe.user_id === session?.user?.id
                ? `${recipe.save_count} people saved this`
                : `${recipe.save_count} saves`}
            </Text>
          </View>
        )}

        {/* Visibility toggle — owner only */}
        {recipe.user_id === session?.user?.id && (
          <TouchableOpacity
            onPress={() => handleToggleVisibility(recipe)}
            disabled={visibilityUpdating}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: recipe.visibility === 'public' ? colors.accentGreenSoft : colors.bgBase,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 5,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: recipe.visibility === 'public' ? colors.accentGreen : colors.borderDefault,
              opacity: visibilityUpdating ? 0.5 : 1,
            }}
          >
            <Ionicons
              name={recipe.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
              size={13}
              color={recipe.visibility === 'public' ? colors.accentGreen : colors.textMuted}
            />
            <Text style={{
              color: recipe.visibility === 'public' ? colors.accentGreen : colors.textMuted,
              fontSize: 12,
              fontWeight: '600',
            }}>
              {recipe.visibility === 'public' ? t('recipe.visibilityPublic') : t('recipe.visibilityPrivate')}
            </Text>
          </TouchableOpacity>
        )}

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
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{t('recipe.missingSection')}</Text>
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
                onPress={async () => {
                  if (!recipe.source_url) return;
                  const ok = await confirmAction({
                    title: t('recipe.reimportTitle'),
                    body: t('recipe.reimportBody'),
                    confirmLabel: t('recipe.reimportTitle'),
                  });
                  if (ok) setShowReimportSoonDialog(true);
                }}
                style={{ flex: 1, backgroundColor: colors.bgCard, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('recipe.tryReimport')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowAiChefDialog(true)}
                style={{ flex: 1, backgroundColor: colors.accentGreenSoft, borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
              >
                <Text style={{ color: colors.accentGreen, fontSize: 13, fontWeight: '600' }}>{'\u2728'} {t('recipe.completeAiChef')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* aiChef badge */}
        {recipe.aichef_assisted && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ backgroundColor: colors.accentGreenSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: colors.accentGreen, fontSize: 12, fontWeight: '700' }}>{'\u2728'} {t('recipe.aiChefAssisted')}</Text>
            </View>
          </View>
        )}

        {/* Source attribution shown in attribution row above — no duplicate here */}

        {/* Attribution tags */}
        {(recipe.original_submitter_username || recipe.shared_by_username) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {recipe.original_submitter_username && recipe.original_submitter_id !== recipe.user_id && (
              <TouchableOpacity
                onPress={() => router.push(`/chef/${recipe.original_submitter_id}`)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: colors.accentSoft, borderRadius: 16,
                  paddingHorizontal: 12, paddingVertical: 6,
                }}
              >
                <Ionicons name="lock-closed" size={12} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                  {t('attribution.originalBy')} @{recipe.original_submitter_username}
                </Text>
              </TouchableOpacity>
            )}
            {recipe.shared_by_username && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: colors.bgBase, borderRadius: 16,
                paddingHorizontal: 12, paddingVertical: 6,
              }}>
                <TouchableOpacity onPress={() => router.push(`/chef/${recipe.shared_by_id}`)}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                    {t('attribution.sharedBy')} @{recipe.shared_by_username}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const ok = await confirmAction({
                      title: t('attribution.removeSharedBy'),
                      body: t('attribution.removeSharedByConfirm'),
                      confirmLabel: t('common.delete'),
                    });
                    if (ok) { await removeSharedBy(recipe.id); fetchRecipe(recipe.id); }
                  }}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Action icons */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 14, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={async () => {
              if (!canDo(planTier, 'canLike')) {
                const ok = await confirmAction({
                  icon: '💎',
                  title: 'Upgrade to Like Recipes',
                  body: 'Liking recipes is available on Chef plan and above. Upgrade to interact with the community.',
                  confirmLabel: t('plans.upgrade'),
                  cancelLabel: t('plans.maybeLater'),
                });
                if (ok) router.push('/plans' as any);
                return;
              }
              toggleFav(recipe.id, recipe.is_favourite);
            }}
            style={{ padding: 6 }}
          >
            <Ionicons
              name={recipe.is_favourite ? 'heart' : 'heart-outline'}
              size={26}
              color={recipe.is_favourite ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleShareRecipe(recipe)} style={{ padding: 6 }}>
            <Ionicons name="share-social-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (pinned ? unpin(recipe.id) : pin(recipe))} style={{ padding: 6 }}>
            <Text style={{ fontSize: 22, opacity: pinned ? 1 : 0.3 }}>📌</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={startEditing} style={{ padding: 6 }}>
            <Ionicons name="create-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!canDo(planTier, 'canMealPlan')) {
                Alert.alert(t('mealPicker.planRequired'), t('mealPicker.planRequiredBody'));
                return;
              }
              setShowMealPicker(true);
            }}
            style={{ padding: 6 }}
          >
            <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <MealPlanPicker
          visible={showMealPicker}
          recipeId={recipe.id}
          recipeServings={recipe.servings ?? 4}
          onClose={() => setShowMealPicker(false)}
        />

        {/* Add to shopping list */}
        {ingredients.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Button
              title={`🛒 ${t('recipe.addToList')}`}
              onPress={() => handleAddToShoppingList()}
              variant="secondary"
            />
          </View>
        )}

        {steps.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Button title={t('recipe.cookMode')} onPress={() => setCookMode(true)} />
          </View>
        )}

        <Divider />

        {/* Ingredients with serving scaler */}
        {ingredients.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('recipe.ingredients')}</Text>
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
        {displayIngredients.map((ing) => (
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
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{t('recipe.steps')}</Text>
        )}
        {displaySteps.map((step) => {
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
        {displayNotes && (
          <>
            <Divider />
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{t('recipe.notes')}</Text>
            {displayNotes
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

        {/* Source shown in attribution row — SourceSection removed */}

        {/* Nutrition card */}
        <Divider />
        <NutritionCard
          recipeId={recipe.id}
          nutrition={recipe.nutrition as NutritionEstimate | null}
          isOwner={recipe.user_id === session?.user?.id}
          servings={recipe.servings}
          onNutritionUpdated={() => fetchRecipe(recipe.id)}
        />

        {/* Feature #4: cooking notes */}
        <Divider />
        <CookingNotesSection recipeId={recipe.id} />

        {/* Likes + Saves */}
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <LikeButton recipeId={recipe.id} likeCount={recipe.like_count ?? 0} isOwner={recipe.user_id === session?.user?.id} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{recipe.save_count ?? 0}</Text>
          </View>
        </View>

        {/* Comments (public recipes only) */}
        <RecipeComments
          recipeId={recipe.id}
          recipeOwnerId={recipe.user_id}
          recipeTitle={recipe.title}
          commentsEnabled={recipe.comments_enabled ?? true}
          isPublic={recipe.visibility === 'public'}
        />

        <Divider />
        <Button
          title={t('recipe.deleteRecipe')}
          onPress={async () => {
            const ok = await confirmAction({ icon: '🗑️', title: t('recipe.deleteRecipe'), body: t('recipe.areYouSure'), confirmLabel: t('common.delete') });
            if (ok) { await removeRecipe(recipe.id); router.back(); }
          }}
          variant="ghost"
        />
        <View style={{ height: recipe.user_id !== session?.user?.id ? 100 : 40 }} />
      </View>
    </ScrollView>
    {/* Save bar for non-owned recipes */}
    {recipe && session?.user?.id && recipe.user_id !== session.user.id && !editing && (
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.borderDefault,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12,
      }}>
        {savedClone ? (
          <View style={{ backgroundColor: colors.accentGreenSoft, borderRadius: 10, padding: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.accentGreen, fontWeight: '700', fontSize: 15 }}>{t('share.savedToCollection')} ✓</Text>
          </View>
        ) : (
          <Button
            title={savingClone ? t('common.saving') : `💾 ${t('share.saveToMyCollection')}`}
            onPress={async () => {
              const profile = useAuthStore.getState().profile;
              if (!canDo(profile?.plan_tier ?? 'free', 'canImport')) {
                Alert.alert(t('share.planRequired'), t('share.planRequiredMessage'));
                return;
              }
              setSavingClone(true);
              try {
                const ref = recipe.original_submitter_username ?? undefined;
                await cloneRecipe(recipe.id, session.user.id, ref);
                setSavedClone(true);
              } catch (e: any) {
                Alert.alert(t('common.errorTitle'), e.message);
              } finally {
                setSavingClone(false);
              }
            }}
            loading={savingClone}
          />
        )}
      </View>
    )}
    <ConfirmActionDialog />
    {/* Change Image option picker */}
    <ChefsDialog
      visible={showChangeImageDialog}
      title={t('imageManager.changeImage')}
      body=""
      layout="vertical"
      onClose={() => setShowChangeImageDialog(false)}
      buttons={[
        { label: t('imageManager.generateAiImage'), variant: 'primary', onPress: () => { setShowChangeImageDialog(false); setShowAiGenerationModal(true); } },
        { label: t('imageManager.chooseFromLibrary'), variant: 'positive', onPress: () => { setShowChangeImageDialog(false); handleChooseFromLibrary(); } },
        { label: t('imageManager.takePhoto'), variant: 'positive', onPress: () => { setShowChangeImageDialog(false); handleTakePhoto(); } },
        { label: t('imageManager.removeImage'), variant: 'secondary', onPress: async () => { setShowChangeImageDialog(false); const ok = await confirmAction({ title: t('imageManager.removeImageTitle'), body: t('imageManager.removeImageBody'), confirmLabel: t('common.remove') }); if (ok) await handleRemoveImage(); } },
        { label: t('common.cancel'), variant: 'text', onPress: () => setShowChangeImageDialog(false) },
      ]}
    />
    {/* Share options picker */}
    <ChefsDialog
      visible={showShareOptionsDialog}
      title={t('share.title')}
      body=""
      layout="vertical"
      onClose={() => setShowShareOptionsDialog(false)}
      buttons={[
        { label: `🔗 ${t('share.shareViaLink')}`, variant: 'primary', onPress: () => { setShowShareOptionsDialog(false); executeShareViaLink(); } },
        { label: `📄 ${t('share.shareAsPdf')}`, variant: 'positive', onPress: () => { setShowShareOptionsDialog(false); executeShareAsPdf(); } },
        { label: t('common.cancel'), variant: 'text', onPress: () => setShowShareOptionsDialog(false) },
      ]}
    />
    {/* Private recipe share confirmation */}
    <ChefsDialog
      visible={showPrivateShareDialog}
      title={t('share.privacyWarningTitle')}
      body={t('share.privacyWarningMessage')}
      onClose={() => setShowPrivateShareDialog(false)}
      buttons={[
        { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowPrivateShareDialog(false) },
        { label: t('share.shareAnyway'), variant: 'primary', onPress: async () => {
          setShowPrivateShareDialog(false);
          const r = shareTargetRef.current;
          if (!r) return;
          const userProfile = useAuthStore.getState().profile;
          await updateRecipe(r.id, { visibility: 'shared_link' });
          fetchRecipe(r.id);
          const url = privateSharUrlRef.current || getShareUrl(r.share_token, userProfile?.username);
          await Clipboard.setStringAsync(url);
          Alert.alert(t('share.linkCopied'));
          shareRecipe(r, userProfile?.username);
        }},
      ]}
    />
    {/* Which shopping list picker */}
    <ChefsDialog
      visible={showWhichListDialog}
      title={t('recipe.addToList')}
      body={t('recipe.whichList')}
      layout="vertical"
      onClose={() => setShowWhichListDialog(false)}
      buttons={[
        ...whichListOptions.map((list) => ({
          label: list.name,
          variant: 'positive' as const,
          onPress: () => { setShowWhichListDialog(false); addToListRef.current(list.id, list.name); },
        })),
        { label: t('recipe.newList'), variant: 'secondary' as const, onPress: () => { setShowWhichListDialog(false); setShowRecipeStorePicker(true); } },
        { label: t('common.cancel'), variant: 'text' as const, onPress: () => setShowWhichListDialog(false) },
      ]}
    />
    {/* Recipe version picker */}
    <ChefsDialog
      visible={showVersionPickerDialog}
      title={t('recipes.recipeVersions')}
      body=""
      layout="vertical"
      onClose={() => setShowVersionPickerDialog(false)}
      buttons={[
        ...versionPickerOptions.map((v) => ({
          label: v.label,
          variant: 'positive' as const,
          onPress: () => { setShowVersionPickerDialog(false); router.push(`/recipe/${v.id}` as any); },
        })),
        { label: t('common.cancel'), variant: 'text' as const, onPress: () => setShowVersionPickerDialog(false) },
      ]}
    />
    <ChefsDialog
      visible={showReimportSoonDialog}
      title={t('recipe.comingSoon')}
      body={t('recipe.reimportSoon')}
      onClose={() => setShowReimportSoonDialog(false)}
      buttons={[{ label: t('common.ok'), variant: 'primary', onPress: () => setShowReimportSoonDialog(false) }]}
    />
    <ChefsDialog
      visible={showAiChefDialog}
      title="aiChef"
      body={t('recipe.aiChefBody')}
      onClose={() => setShowAiChefDialog(false)}
      buttons={[{ label: t('common.ok'), variant: 'primary', onPress: () => setShowAiChefDialog(false) }]}
    />
    <StorePicker
      visible={showRecipeStorePicker}
      onCreated={async (listId, listName) => {
        setShowRecipeStorePicker(false);
        if (currentRecipe && session?.user?.id) {
          const userId = session.user.id;
          const items = currentRecipe.ingredients.map((ing: any) => ({
            ingredient: ing.ingredient,
            quantity: ing.quantity,
            unit: ing.unit,
          }));
          try {
            const { suggestPurchaseUnits } = await import('@chefsbook/ai');
            const aiResults = await suggestPurchaseUnits(items.map((i: any) => ({ name: i.ingredient, quantity: [i.quantity, i.unit].filter(Boolean).join(' ') })));
            const aiMap: Record<string, { purchase_unit: string; store_category: string }> = {};
            for (const s of aiResults) aiMap[s.ingredient.toLowerCase()] = { purchase_unit: s.purchase_unit, store_category: s.store_category };
            await addItemsPipeline(listId, userId, items, aiMap);
          } catch {
            await addItemsPipeline(listId, userId, items);
          }
          Alert.alert(t('recipe.addedTitle'), t('recipe.addedBody', { inserted: items.length, merged: 0, listName }));
        }
      }}
      onCancel={() => setShowRecipeStorePicker(false)}
    />
    {currentRecipe && (
      <AiImageGenerationModal
        visible={showAiGenerationModal}
        recipeId={currentRecipe.id}
        onClose={() => setShowAiGenerationModal(false)}
        onImageGenerated={handleImageGenerated}
      />
    )}
    </View>
  );
}
