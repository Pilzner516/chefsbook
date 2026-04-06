import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActionSheetIOS, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useMealPlanStore } from '../../lib/zustand/mealPlanStore';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Card, EmptyState, Loading } from '../../components/UIKit';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d).toISOString().split('T')[0]!);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function PlanTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const plans = useMealPlanStore((s) => s.plans);
  const loading = useMealPlanStore((s) => s.loading);
  const weekStart = useMealPlanStore((s) => s.weekStart);
  const setWeekStart = useMealPlanStore((s) => s.setWeekStart);
  const fetchWeek = useMealPlanStore((s) => s.fetchWeek);
  const removePlan = useMealPlanStore((s) => s.removePlan);

  const showMealActions = (plan: any) => {
    const options = ['View recipe', 'Remove from plan', 'Cancel'];
    const destructiveIndex = 1;
    const cancelIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex, cancelButtonIndex: cancelIndex },
        (idx) => handleMealAction(idx, plan),
      );
    } else {
      Alert.alert(
        (plan as any).recipe?.title ?? plan.meal_slot,
        'What would you like to do?',
        [
          { text: 'View recipe', onPress: () => plan.recipe_id && router.push(`/recipe/${plan.recipe_id}`) },
          { text: 'Remove from plan', style: 'destructive', onPress: () => confirmRemove(plan) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  const handleMealAction = (idx: number, plan: any) => {
    if (idx === 0 && plan.recipe_id) router.push(`/recipe/${plan.recipe_id}`);
    if (idx === 1) confirmRemove(plan);
  };

  const confirmRemove = (plan: any) => {
    Alert.alert('Remove meal', `Remove "${(plan as any).recipe?.title ?? plan.meal_slot}" from this day?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await removePlan(plan.id);
        if (session?.user?.id && weekDates.length === 7) {
          fetchWeek(session.user.id, weekDates[0]!, weekDates[6]!);
        }
      }},
    ]);
  };

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  useEffect(() => {
    if (session?.user?.id && weekDates.length === 7) {
      fetchWeek(session.user.id, weekDates[0]!, weekDates[6]!);
    }
  }, [session?.user?.id, weekStart]);

  const navigateWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().split('T')[0]!);
  };

  const hasMeals = plans.length > 0;

  if (loading) return <Loading message="Loading meal plan..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />

      {/* Week navigation */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => navigateWeek(-1)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
            <Ionicons name="chevron-back" size={16} color={colors.accent} /> Prev
          </Text>
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {weekDates[0]} — {weekDates[6]}
        </Text>
        <TouchableOpacity onPress={() => navigateWeek(1)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>
            Next <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add whole week to list */}
      {hasMeals && (
        <TouchableOpacity
          onPress={() => Alert.alert(
            'Add week to shopping list',
            `Add all ingredients from ${plans.length} meals this week to your shopping list?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Add All', onPress: () => Alert.alert('Coming soon', 'Whole-week cart sync will be available soon.') },
            ],
          )}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginHorizontal: 16, marginBottom: 8, paddingVertical: 10,
            backgroundColor: colors.accentGreenSoft, borderRadius: 10,
          }}
        >
          <Ionicons name="cart" size={18} color={colors.accentGreen} />
          <Text style={{ color: colors.accentGreen, fontSize: 14, fontWeight: '600' }}>Add week to shopping list</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        {!hasMeals ? (
          <EmptyState
            icon="📅"
            title="No meals planned this week"
            message="Browse recipes and add them to your meal plan."
            action={{ label: 'Browse Recipes', onPress: () => router.push('/(tabs)/search') }}
          />
        ) : (
          weekDates.map((date, i) => {
            const SLOT_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2 };
            const dayPlans = plans
              .filter((p: any) => p.plan_date === date)
              .sort((a: any, b: any) => (SLOT_ORDER[a.meal_slot?.toLowerCase()] ?? 9) - (SLOT_ORDER[b.meal_slot?.toLowerCase()] ?? 9));
            return (
              <Card
                key={date}
                style={{
                  marginBottom: 12,
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View>
                    <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '700' }}>
                      {DAYS[i]}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  {/* Cart sync button */}
                  {dayPlans.length > 0 && (() => {
                    const synced = dayPlans.some((p: any) => p.synced_to_list_id);
                    return (
                      <TouchableOpacity
                        onPress={() => Alert.alert('Add to list', `Add ingredients from ${DAYS[i]} to your shopping list?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Add', onPress: () => Alert.alert('Coming soon', 'Smart cart sync will be available soon.') },
                        ])}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          backgroundColor: synced ? colors.accentGreenSoft : colors.bgBase,
                          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                          borderWidth: 1, borderColor: synced ? colors.accentGreen : colors.borderDefault,
                        }}
                      >
                        <Ionicons name={synced ? 'checkmark-circle' : 'cart-outline'} size={14} color={synced ? colors.accentGreen : colors.textMuted} />
                        <Text style={{ color: synced ? colors.accentGreen : colors.textMuted, fontSize: 11, fontWeight: '600' }}>
                          {synced ? 'Added' : 'Add to list'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
                {dayPlans.length === 0 ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>No meals planned</Text>
                ) : (
                  dayPlans.map((plan: any) => (
                    <TouchableOpacity
                      key={plan.id}
                      onPress={() => plan.recipe_id && router.push(`/recipe/${plan.recipe_id}`)}
                      onLongPress={() => showMealActions(plan)}
                      delayLongPress={400}
                      style={{ paddingVertical: 6, minHeight: 44, justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.accent, fontSize: 11, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 }}>
                        {plan.meal_slot}
                      </Text>
                      <Text style={{ color: colors.textPrimary, fontSize: 15 }}>
                        {(plan as any).recipe?.title ?? plan.notes ?? 'No recipe'}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}

                {/* Add meal button */}
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(tabs)/search', params: { addToPlan: date } })}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginTop: 4 }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Add meal</Text>
                </TouchableOpacity>
              </Card>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
