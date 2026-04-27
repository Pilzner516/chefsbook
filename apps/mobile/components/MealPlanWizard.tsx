import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { generateMealPlan } from '@chefsbook/ai';
import type { MealPlanSlot, NutritionGoals, DailySummary } from '@chefsbook/ai';
import type { Recipe, MealSlot } from '@chefsbook/db';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DIETARY_CHIPS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'Keto', 'Paleo'];
const CUISINE_CHIPS = ['Italian', 'Asian', 'Mediterranean', 'Mexican', 'American', 'Indian', 'French', 'Japanese'];
const EFFORT_OPTION_KEYS = [
  { labelKey: 'wizard.quickEffort', value: 'quick' },
  { labelKey: 'wizard.mediumEffort', value: 'medium' },
  { labelKey: 'wizard.fullEffort', value: 'full' },
];
const MACRO_PRESETS: { key: NutritionGoals['macroPriority']; labelKey: string; descKey: string }[] = [
  { key: 'none', labelKey: 'wizard.macroNone', descKey: 'wizard.macroNoneDesc' },
  { key: 'high_protein', labelKey: 'wizard.macroHighProtein', descKey: 'wizard.macroHighProteinDesc' },
  { key: 'low_carb', labelKey: 'wizard.macroLowCarb', descKey: 'wizard.macroLowCarbDesc' },
  { key: 'balanced', labelKey: 'wizard.macroBalanced', descKey: 'wizard.macroBalancedDesc' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  userRecipes: Recipe[];
  weekDates: string[];
  onSave: (slots: { plan_date: string; meal_slot: MealSlot; recipe_id: string | null; title: string; servings: number }[]) => Promise<void>;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function MealPlanWizard({ visible, onClose, userRecipes, weekDates, onSave }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [selectedDays, setSelectedDays] = useState(new Set(DAY_KEYS));
  const [selectedSlots, setSelectedSlots] = useState(new Set(['breakfast', 'lunch', 'dinner']));
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [effort, setEffort] = useState('medium');
  const [source, setSource] = useState<'my_recipes' | 'mix' | 'community'>('mix');
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<MealPlanSlot[]>([]);
  const [dailySummaries, setDailySummaries] = useState<Record<string, DailySummary>>({});
  const [saving, setSaving] = useState(false);

  // Step 4: Nutritional Goals (optional)
  const [dailyCalories, setDailyCalories] = useState('');
  const [macroPriority, setMacroPriority] = useState<NutritionGoals['macroPriority']>('none');
  const [maxCaloriesPerMeal, setMaxCaloriesPerMeal] = useState('');

  const hasNutritionGoals = dailyCalories || macroPriority !== 'none' || maxCaloriesPerMeal;

  const toggleSet = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const toggleArray = (arr: string[], value: string, setter: (a: string[]) => void) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const effortLevel = effort === 'quick' ? 10 : effort === 'medium' ? 50 : 90;
      const nutritionGoals: NutritionGoals | undefined = hasNutritionGoals ? {
        dailyCalories: dailyCalories ? parseInt(dailyCalories) : undefined,
        macroPriority: macroPriority !== 'none' ? macroPriority : undefined,
        maxCaloriesPerMeal: maxCaloriesPerMeal ? parseInt(maxCaloriesPerMeal) : undefined,
      } : undefined;
      const result = await generateMealPlan(
        {
          days: [...selectedDays],
          slots: [...selectedSlots],
          dietary,
          likesDislikesText: '',
          cuisineVariety: 50,
          preferredCuisines: cuisines,
          effortLevel,
          adventurousness: 50,
          servings: 4,
          source,
          nutritionGoals,
        },
        userRecipes.map((r) => ({
          id: r.id, title: r.title, cuisine: r.cuisine, course: r.course,
          tags: r.tags ?? [], total_minutes: r.total_minutes,
        })),
      );
      setPlan(result.plan);
      setDailySummaries(result.daily_summaries ?? {});
      setStep(5);
    } catch (e: any) {
      Alert.alert(t('wizard.generationFailed'), e.message);
    } finally {
      setGenerating(false);
    }
  };

  const removePlanSlot = (day: string, slot: string) => {
    setPlan((prev) => prev.filter((p) => !(p.day === day && p.slot === slot)));
  };

  const swapPlanSlot = async (day: string, slot: string) => {
    // Remove old and regenerate just this slot
    const old = plan.find((p) => p.day === day && p.slot === slot);
    if (!old) return;
    setGenerating(true);
    try {
      const nutritionGoals: NutritionGoals | undefined = hasNutritionGoals ? {
        dailyCalories: dailyCalories ? parseInt(dailyCalories) : undefined,
        macroPriority: macroPriority !== 'none' ? macroPriority : undefined,
        maxCaloriesPerMeal: maxCaloriesPerMeal ? parseInt(maxCaloriesPerMeal) : undefined,
      } : undefined;
      const result = await generateMealPlan(
        { days: [day], slots: [slot], dietary, likesDislikesText: `Don't repeat: ${old.title}`,
          cuisineVariety: 50, preferredCuisines: cuisines,
          effortLevel: effort === 'quick' ? 10 : effort === 'medium' ? 50 : 90,
          adventurousness: 70, servings: 4, source, nutritionGoals },
        userRecipes.map((r) => ({ id: r.id, title: r.title, cuisine: r.cuisine, course: r.course, tags: r.tags ?? [], total_minutes: r.total_minutes })),
      );
      if (result.plan.length > 0) {
        setPlan((prev) => prev.map((p) => p.day === day && p.slot === slot ? result.plan[0]! : p));
        if (result.daily_summaries) setDailySummaries(result.daily_summaries);
      }
    } catch {} finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (plan.length === 0) return;
    setSaving(true);
    try {
      const slots = plan.map((p) => {
        const dayIdx = DAY_KEYS.indexOf(p.day);
        return {
          plan_date: weekDates[dayIdx] ?? weekDates[0],
          meal_slot: p.slot as MealSlot,
          recipe_id: p.recipe_id,
          title: p.title,
          servings: 4,
        };
      });
      await onSave(slots);
      onClose();
    } catch (e: any) {
      Alert.alert(t('wizard.saveFailed'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setPlan([]);
    setDailySummaries({});
    setSelectedDays(new Set(DAY_KEYS));
    setSelectedSlots(new Set(['breakfast', 'lunch', 'dinner']));
    setDietary([]);
    setCuisines([]);
    setEffort('medium');
    setSource('mix');
    setDailyCalories('');
    setMacroPriority('none');
    setMaxCaloriesPerMeal('');
  };

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.accent : colors.bgBase,
        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8,
        borderWidth: 1, borderColor: selected ? colors.accent : colors.borderDefault,
      }}
    >
      <Text style={{ color: selected ? '#fff' : colors.textPrimary, fontSize: 13, fontWeight: selected ? '600' : '400' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, paddingTop: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('wizard.title')}</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View key={s} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: step >= s ? colors.accent : colors.borderDefault }} />
          ))}
        </View>

        {generating ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 16 }}>{t('wizard.generating')}</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Step 1: Days & Meals */}
            {step === 1 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{t('wizard.daysAndMeals')}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>{t('wizard.whichDays')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {DAY_KEYS.map((d) => <Chip key={d} label={t(`days.${d}`)} selected={selectedDays.has(d)} onPress={() => toggleSet(selectedDays, d, setSelectedDays)} />)}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 }}>{t('wizard.whichMeals')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {SLOTS.map((s) => <Chip key={s} label={t(`plan.${s}`)} selected={selectedSlots.has(s)} onPress={() => toggleSet(selectedSlots, s, setSelectedSlots)} />)}
                </View>
              </View>
            )}

            {/* Step 2: Preferences */}
            {step === 2 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{t('wizard.preferences')}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>{t('wizard.dietaryLabel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {DIETARY_CHIPS.map((d) => <Chip key={d} label={d} selected={dietary.includes(d)} onPress={() => toggleArray(dietary, d, setDietary)} />)}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 }}>{t('wizard.cuisineLabel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {CUISINE_CHIPS.map((c) => <Chip key={c} label={c} selected={cuisines.includes(c)} onPress={() => toggleArray(cuisines, c, setCuisines)} />)}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 }}>{t('wizard.effortLevel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {EFFORT_OPTION_KEYS.map((o) => <Chip key={o.value} label={t(o.labelKey)} selected={effort === o.value} onPress={() => setEffort(o.value)} />)}
                </View>
              </View>
            )}

            {/* Step 3: Sources */}
            {step === 3 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>{t('wizard.recipeSources')}</Text>
                {[
                  { value: 'my_recipes' as const, label: t('wizard.fromMyRecipes'), desc: t('wizard.fromMyRecipesDesc') },
                  { value: 'mix' as const, label: t('wizard.mixRecipes'), desc: t('wizard.mixRecipesDesc') },
                  { value: 'community' as const, label: t('wizard.aiSuggest'), desc: t('wizard.aiSuggestDesc') },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setSource(opt.value)}
                    style={{
                      padding: 16, borderRadius: 12, marginBottom: 10,
                      borderWidth: 2, borderColor: source === opt.value ? colors.accent : colors.borderDefault,
                      backgroundColor: source === opt.value ? colors.accentSoft : colors.bgCard,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{opt.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Step 4: Nutritional Goals (Optional) */}
            {step === 4 && (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>{t('wizard.nutritionGoals')}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>{t('wizard.nutritionGoalsDesc')}</Text>

                  {/* Daily Calorie Target */}
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t('wizard.dailyCalories')}</Text>
                  <TextInput
                    value={dailyCalories}
                    onChangeText={(v) => setDailyCalories(v.replace(/\D/g, ''))}
                    placeholder={t('wizard.dailyCaloriesPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    returnKeyType="done"
                    style={{
                      backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 4,
                    }}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 16 }}>{t('wizard.dailyCaloriesHint')}</Text>

                  {/* Macro Priority */}
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t('wizard.macroPriority')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {MACRO_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.key}
                        onPress={() => setMacroPriority(preset.key)}
                        style={{
                          flex: 1, minWidth: '45%', padding: 12, borderRadius: 10,
                          borderWidth: 2, borderColor: macroPriority === preset.key ? colors.accent : colors.borderDefault,
                          backgroundColor: macroPriority === preset.key ? colors.accentSoft : colors.bgCard,
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t(preset.labelKey)}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{t(preset.descKey)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Max Calories per Meal */}
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t('wizard.maxCaloriesPerMeal')}</Text>
                  <TextInput
                    value={maxCaloriesPerMeal}
                    onChangeText={(v) => setMaxCaloriesPerMeal(v.replace(/\D/g, ''))}
                    placeholder={t('wizard.maxCaloriesPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    returnKeyType="done"
                    style={{
                      backgroundColor: colors.bgBase, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
                      fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.borderDefault, marginBottom: 4,
                    }}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('wizard.maxCaloriesHint')}</Text>
                </View>
              </KeyboardAvoidingView>
            )}

            {/* Step 5: Review */}
            {step === 5 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>{t('wizard.reviewPlan')}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                  {plan.length} {t('wizard.mealsPlanned')}{hasNutritionGoals && dailyCalories ? ` · ${dailyCalories} ${t('wizard.kcalTarget')}` : ''}
                </Text>
                {DAY_KEYS.filter((d) => plan.some((p) => p.day === d)).map((day) => {
                  const daySlots = plan.filter((p) => p.day === day);
                  const daySummary = dailySummaries[day];
                  const hasAnyNutrition = daySlots.some((s) => s.estimated_nutrition) || daySummary;
                  return (
                    <View key={day} style={{ marginBottom: 16 }}>
                      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>{t(`days.${day}`)}</Text>
                      {daySlots.map((slot) => (
                        <View key={`${slot.day}-${slot.slot}`} style={{
                          flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
                          borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.borderDefault,
                        }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' }}>{slot.slot}</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{slot.title}</Text>
                            {slot.estimated_nutrition && (
                              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                                ~{slot.estimated_nutrition.calories} kcal
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity onPress={() => swapPlanSlot(slot.day, slot.slot)} style={{ padding: 6 }}>
                            <Ionicons name="refresh" size={18} color={colors.accent} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removePlanSlot(slot.day, slot.slot)} style={{ padding: 6 }}>
                            <Ionicons name="close" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {/* Daily Nutrition Summary */}
                      {hasAnyNutrition && daySummary && (
                        <View style={{
                          marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderDefault,
                        }}>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                            ~{daySummary.calories.toLocaleString()} kcal · {daySummary.protein_g}g {t('nutrition.protein_g').toLowerCase()} · {daySummary.carbs_g}g {t('nutrition.carbs_g').toLowerCase()} · {daySummary.fat_g}g {t('nutrition.fat_g').toLowerCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}

        {/* Footer buttons */}
        {!generating && (
          <View style={{ padding: 16, paddingBottom: insets.bottom + 16, flexDirection: 'row', gap: 12 }}>
            {step > 1 && step < 5 && (
              <TouchableOpacity
                onPress={() => setStep((s) => (s - 1) as Step)}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}
            {step < 3 && (
              <TouchableOpacity
                onPress={() => setStep((s) => (s + 1) as Step)}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('common.next')}</Text>
              </TouchableOpacity>
            )}
            {step === 3 && (
              <TouchableOpacity
                onPress={() => setStep(4)}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('common.next')}</Text>
              </TouchableOpacity>
            )}
            {step === 4 && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setDailyCalories('');
                    setMacroPriority('none');
                    setMaxCaloriesPerMeal('');
                    handleGenerate();
                  }}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>{t('wizard.skipNutrition')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleGenerate}
                  style={{ flex: 1, backgroundColor: colors.accentGreen, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                >
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('wizard.generatePlan')}</Text>
                </TouchableOpacity>
              </>
            )}
            {step === 5 && (
              <>
                <TouchableOpacity
                  onPress={() => setStep(4)}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t('speak.reGenerate')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving || plan.length === 0}
                  style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{saving ? t('common.loading') : t('wizard.savePlan')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
