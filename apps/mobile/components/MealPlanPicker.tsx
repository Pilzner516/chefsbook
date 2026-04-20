import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { getMealPlansForWeek, addMealPlan, PLAN_LIMITS, canDo } from '@chefsbook/db';
import ChefsDialog from './ChefsDialog';
import type { MealPlan, MealSlot, PlanTier } from '@chefsbook/db';

const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

interface Props {
  visible: boolean;
  recipeId: string;
  recipeServings: number;
  onClose: () => void;
  onAdded?: () => void;
}

export function MealPlanPicker({ visible, recipeId, recipeServings, onClose, onAdded }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | null>(null);
  const [servings, setServings] = useState(recipeServings || 4);
  const [existing, setExisting] = useState<MealPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSlotOccupiedDialog, setShowSlotOccupiedDialog] = useState(false);
  const [pendingSlotInfo, setPendingSlotInfo] = useState<{ slot: MealSlot; dayName: string } | null>(null);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);
  const [mismatchInfo, setMismatchInfo] = useState<{ refServing: number; servings: number; dayName: string } | null>(null);
  const mismatchResolveRef = useRef<(v: boolean) => void>(() => {});

  const weekDays = getWeekDays(weekStart);
  const todayStr = formatDate(new Date());

  useEffect(() => {
    if (visible && session?.user?.id) {
      const wEnd = new Date(weekStart); wEnd.setDate(wEnd.getDate() + 6);
      getMealPlansForWeek(session.user.id, formatDate(weekStart), formatDate(wEnd)).then(setExisting).catch(() => {});
    }
  }, [visible, weekStart, session?.user?.id]);

  useEffect(() => { setServings(recipeServings || 4); }, [recipeServings]);

  const isDayFull = (date: string) => {
    const dayMeals = existing.filter((m) => m.plan_date === date);
    return MEAL_SLOTS.every((s) => dayMeals.some((m) => m.meal_slot === s));
  };

  const isSlotOccupied = (date: string, slot: MealSlot) =>
    existing.some((m) => m.plan_date === date && m.meal_slot === slot);

  const handleSlotTap = (slot: MealSlot) => {
    if (!selectedDay) return;
    if (isSlotOccupied(selectedDay, slot)) {
      const dayName = DAY_NAMES[weekDays.findIndex((d) => formatDate(d) === selectedDay)] ?? '';
      setPendingSlotInfo({ slot, dayName });
      setShowSlotOccupiedDialog(true);
    } else {
      setSelectedSlot(slot);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id || !selectedDay || !selectedSlot) return;

    // Check servings mismatch
    const dayMeals = existing.filter((m) => m.plan_date === selectedDay && m.recipe_id);
    if (dayMeals.length > 0) {
      const refServing = dayMeals[0]?.servings ?? 4;
      if (refServing && (servings / refServing > 2 || refServing / servings > 2)) {
        const dayName = DAY_NAMES[weekDays.findIndex((d) => formatDate(d) === selectedDay)] ?? '';
        const proceed = await new Promise<boolean>((resolve) => {
          mismatchResolveRef.current = resolve;
          setMismatchInfo({ refServing, servings, dayName });
          setShowMismatchDialog(true);
        });
        if (!proceed) return;
      }
    }

    setSaving(true);
    try {
      await addMealPlan(session.user.id, {
        plan_date: selectedDay,
        meal_slot: selectedSlot,
        recipe_id: recipeId,
        servings,
        notes: null,
      });
      const dayName = DAY_NAMES[weekDays.findIndex((d) => formatDate(d) === selectedDay)] ?? '';
      Alert.alert(t('mealPicker.added', { day: dayName, meal: selectedSlot }));
      onAdded?.();
      onClose();
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelectedDay(null); setSelectedSlot(null); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelectedDay(null); setSelectedSlot(null); };

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('mealPicker.title')}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
          </View>

          {/* Week navigator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
            <TouchableOpacity onPress={prevWeek}><Ionicons name="chevron-back" size={22} color={colors.textPrimary} /></TouchableOpacity>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>{t('mealPicker.weekOf')} {weekLabel}</Text>
            <TouchableOpacity onPress={nextWeek}><Ionicons name="chevron-forward" size={22} color={colors.textPrimary} /></TouchableOpacity>
          </View>

          {/* Day pills — 2 rows */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              {weekDays.slice(0, 5).map((d, i) => {
                const ds = formatDate(d);
                const full = isDayFull(ds);
                const sel = selectedDay === ds;
                const isToday = ds === todayStr;
                return (
                  <TouchableOpacity
                    key={ds}
                    onPress={() => { setSelectedDay(ds); setSelectedSlot(null); }}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
                      backgroundColor: sel ? (full ? colors.accent : colors.accentGreen) : (full ? '#fdecea' : '#e8f5ee'),
                      borderWidth: sel ? 2 : 0, borderColor: sel ? (full ? colors.accent : colors.accentGreen) : 'transparent',
                    }}
                  >
                    <Text style={{ color: sel ? '#ffffff' : colors.textPrimary, fontSize: 11, fontWeight: '600' }}>{DAY_NAMES[i]}</Text>
                    <Text style={{ color: sel ? '#ffffff' : colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{d.getDate()}</Text>
                    {isToday && <Text style={{ color: sel ? '#ffffff' : colors.textMuted, fontSize: 9 }}>{t('mealPicker.today')}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {weekDays.slice(5).map((d, i) => {
                const ds = formatDate(d);
                const full = isDayFull(ds);
                const sel = selectedDay === ds;
                const isToday = ds === todayStr;
                return (
                  <TouchableOpacity
                    key={ds}
                    onPress={() => { setSelectedDay(ds); setSelectedSlot(null); }}
                    style={{
                      flex: 1, maxWidth: '28%', alignItems: 'center', paddingVertical: 8, borderRadius: 10,
                      backgroundColor: sel ? (full ? colors.accent : colors.accentGreen) : (full ? '#fdecea' : '#e8f5ee'),
                      borderWidth: sel ? 2 : 0, borderColor: sel ? (full ? colors.accent : colors.accentGreen) : 'transparent',
                    }}
                  >
                    <Text style={{ color: sel ? '#ffffff' : colors.textPrimary, fontSize: 11, fontWeight: '600' }}>{DAY_NAMES[5 + i]}</Text>
                    <Text style={{ color: sel ? '#ffffff' : colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{d.getDate()}</Text>
                    {isToday && <Text style={{ color: sel ? '#ffffff' : colors.textMuted, fontSize: 9 }}>{t('mealPicker.today')}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Meal type pills */}
          {selectedDay && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t('mealPicker.mealType')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MEAL_SLOTS.map((slot) => {
                  const occ = isSlotOccupied(selectedDay, slot);
                  const sel = selectedSlot === slot;
                  return (
                    <TouchableOpacity
                      key={slot}
                      onPress={() => handleSlotTap(slot)}
                      style={{
                        width: '47%', paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                        backgroundColor: sel ? (occ ? colors.accent : colors.accentGreen) : (occ ? '#fdecea' : '#e8f5ee'),
                      }}
                    >
                      <Text style={{ color: sel ? '#ffffff' : colors.textPrimary, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>{slot}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Servings stepper */}
          {selectedSlot && (
            <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>{t('mealPicker.servings')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <TouchableOpacity onPress={() => setServings((s) => Math.max(1, s - 1))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', minWidth: 30, textAlign: 'center' }}>{servings}</Text>
                <TouchableOpacity onPress={() => setServings((s) => Math.min(20, s + 1))} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Add button */}
          {selectedSlot && (
            <View style={{ paddingHorizontal: 16 }}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: saving ? 0.5 : 1 }}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{saving ? '...' : t('mealPicker.addToPlan')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <ChefsDialog
        visible={showSlotOccupiedDialog}
        title={t('mealPicker.slotOccupied')}
        body={pendingSlotInfo ? t('mealPicker.slotOccupiedBody', { day: pendingSlotInfo.dayName, meal: pendingSlotInfo.slot }) : ''}
        onClose={() => setShowSlotOccupiedDialog(false)}
        buttons={[
          { label: t('mealPicker.pickAnother'), variant: 'cancel', onPress: () => setShowSlotOccupiedDialog(false) },
          { label: t('mealPicker.addAnyway'), variant: 'primary', onPress: () => { setShowSlotOccupiedDialog(false); if (pendingSlotInfo) { setSelectedSlot(pendingSlotInfo.slot); setPendingSlotInfo(null); } } },
        ]}
      />
      <ChefsDialog
        visible={showMismatchDialog}
        title="Servings mismatch"
        body={mismatchInfo ? `This recipe serves ${mismatchInfo.servings}, but other recipes on ${mismatchInfo.dayName} serve ${mismatchInfo.refServing}. Add anyway?` : ''}
        onClose={() => { setShowMismatchDialog(false); mismatchResolveRef.current(false); }}
        buttons={[
          { label: t('common.cancel'), variant: 'cancel', onPress: () => { setShowMismatchDialog(false); mismatchResolveRef.current(false); } },
          { label: t('mealPicker.addAnyway'), variant: 'primary', onPress: () => { setShowMismatchDialog(false); mismatchResolveRef.current(true); } },
        ]}
      />
    </Modal>
  );
}
