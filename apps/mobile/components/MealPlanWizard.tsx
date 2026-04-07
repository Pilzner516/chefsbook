import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { generateMealPlan } from '@chefsbook/ai';
import type { MealPlanSlot } from '@chefsbook/ai';
import type { Recipe, MealSlot } from '@chefsbook/db';

const DAYS_MAP: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};
const DAY_KEYS = Object.keys(DAYS_MAP);
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DIETARY_CHIPS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Low-Carb', 'Keto', 'Paleo'];
const CUISINE_CHIPS = ['Italian', 'Asian', 'Mediterranean', 'Mexican', 'American', 'Indian', 'French', 'Japanese'];
const EFFORT_OPTIONS = [
  { label: 'Quick (<30min)', value: 'quick' },
  { label: 'Medium (30-60min)', value: 'medium' },
  { label: 'Full project', value: 'full' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  userRecipes: Recipe[];
  weekDates: string[];
  onSave: (slots: { plan_date: string; meal_slot: MealSlot; recipe_id: string | null; title: string; servings: number }[]) => Promise<void>;
}

type Step = 1 | 2 | 3 | 4;

export function MealPlanWizard({ visible, onClose, userRecipes, weekDates, onSave }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(1);
  const [selectedDays, setSelectedDays] = useState(new Set(DAY_KEYS));
  const [selectedSlots, setSelectedSlots] = useState(new Set(['breakfast', 'lunch', 'dinner']));
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [effort, setEffort] = useState('medium');
  const [source, setSource] = useState<'my_recipes' | 'mix' | 'community'>('mix');
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<MealPlanSlot[]>([]);
  const [saving, setSaving] = useState(false);

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
        },
        userRecipes.map((r) => ({
          id: r.id, title: r.title, cuisine: r.cuisine, course: r.course,
          tags: r.tags ?? [], total_minutes: r.total_minutes,
        })),
      );
      setPlan(result);
      setStep(4);
    } catch (e: any) {
      Alert.alert('Generation failed', e.message);
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
      const result = await generateMealPlan(
        { days: [day], slots: [slot], dietary, likesDislikesText: `Don't repeat: ${old.title}`,
          cuisineVariety: 50, preferredCuisines: cuisines,
          effortLevel: effort === 'quick' ? 10 : effort === 'medium' ? 50 : 90,
          adventurousness: 70, servings: 4, source },
        userRecipes.map((r) => ({ id: r.id, title: r.title, cuisine: r.cuisine, course: r.course, tags: r.tags ?? [], total_minutes: r.total_minutes })),
      );
      if (result.length > 0) {
        setPlan((prev) => prev.map((p) => p.day === day && p.slot === slot ? result[0] : p));
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
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setPlan([]);
    setSelectedDays(new Set(DAY_KEYS));
    setSelectedSlots(new Set(['breakfast', 'lunch', 'dinner']));
    setDietary([]);
    setCuisines([]);
    setEffort('medium');
    setSource('mix');
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
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>AI Meal Planner</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: step >= s ? colors.accent : colors.borderDefault }} />
          ))}
        </View>

        {generating ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 16 }}>Generating your meal plan...</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Step 1: Days & Meals */}
            {step === 1 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Days & Meals</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Which days?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {DAY_KEYS.map((d) => <Chip key={d} label={DAYS_MAP[d]!} selected={selectedDays.has(d)} onPress={() => toggleSet(selectedDays, d, setSelectedDays)} />)}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 }}>Which meals?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {SLOTS.map((s) => <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} selected={selectedSlots.has(s)} onPress={() => toggleSet(selectedSlots, s, setSelectedSlots)} />)}
                </View>
              </View>
            )}

            {/* Step 2: Preferences */}
            {step === 2 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Preferences</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Dietary</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {DIETARY_CHIPS.map((d) => <Chip key={d} label={d} selected={dietary.includes(d)} onPress={() => toggleArray(dietary, d, setDietary)} />)}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 }}>Cuisine</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {CUISINE_CHIPS.map((c) => <Chip key={c} label={c} selected={cuisines.includes(c)} onPress={() => toggleArray(cuisines, c, setCuisines)} />)}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 12 }}>Effort level</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {EFFORT_OPTIONS.map((o) => <Chip key={o.value} label={o.label} selected={effort === o.value} onPress={() => setEffort(o.value)} />)}
                </View>
              </View>
            )}

            {/* Step 3: Sources */}
            {step === 3 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Recipe Sources</Text>
                {[
                  { value: 'my_recipes' as const, label: 'From my recipes only', desc: 'Claude picks from your collection' },
                  { value: 'mix' as const, label: 'Mix my recipes + AI suggestions', desc: 'Best of both worlds' },
                  { value: 'community' as const, label: 'Let AI suggest anything', desc: 'Claude creates new ideas' },
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

            {/* Step 4: Review */}
            {step === 4 && (
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Review Your Plan</Text>
                {DAY_KEYS.filter((d) => plan.some((p) => p.day === d)).map((day) => (
                  <View key={day} style={{ marginBottom: 16 }}>
                    <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>{DAYS_MAP[day]}</Text>
                    {plan.filter((p) => p.day === day).map((slot) => (
                      <View key={`${slot.day}-${slot.slot}`} style={{
                        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
                        borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.borderDefault,
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' }}>{slot.slot}</Text>
                          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{slot.title}</Text>
                          {slot.reason && <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{slot.reason}</Text>}
                        </View>
                        <TouchableOpacity onPress={() => swapPlanSlot(slot.day, slot.slot)} style={{ padding: 6 }}>
                          <Ionicons name="refresh" size={18} color={colors.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removePlanSlot(slot.day, slot.slot)} style={{ padding: 6 }}>
                          <Ionicons name="close" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Footer buttons */}
        {!generating && (
          <View style={{ padding: 16, flexDirection: 'row', gap: 12 }}>
            {step > 1 && step < 4 && (
              <TouchableOpacity
                onPress={() => setStep((s) => (s - 1) as Step)}
                style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 3 && (
              <TouchableOpacity
                onPress={() => setStep((s) => (s + 1) as Step)}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Next</Text>
              </TouchableOpacity>
            )}
            {step === 3 && (
              <TouchableOpacity
                onPress={handleGenerate}
                style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Generate Plan</Text>
              </TouchableOpacity>
            )}
            {step === 4 && (
              <>
                <TouchableOpacity
                  onPress={() => setStep(3)}
                  style={{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Re-generate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving || plan.length === 0}
                  style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: saving ? 0.6 : 1 }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{saving ? 'Saving...' : 'Save Plan'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
