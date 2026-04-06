import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useMealPlanStore } from '../../lib/zustand/mealPlanStore';
import { Card, EmptyState, Loading } from '../../components/UIKit';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function getWeekDates(startDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);
  // Adjust to Monday
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

  if (loading) return <Loading message="Loading meal plan..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
        <TouchableOpacity onPress={() => navigateWeek(-1)}>
          <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '600' }}>{'\u2190'} Prev</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {weekDates[0]} — {weekDates[6]}
        </Text>
        <TouchableOpacity onPress={() => navigateWeek(1)}>
          <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '600' }}>Next {'\u2192'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        {weekDates.map((date, i) => {
          const dayPlans = plans.filter((p: any) => p.plan_date === date);
          return (
            <Card key={date} style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>
                {DAYS[i]} — {date}
              </Text>
              {dayPlans.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No meals planned</Text>
              ) : (
                dayPlans.map((plan: any) => (
                  <TouchableOpacity
                    key={plan.id}
                    onPress={() => plan.recipe_id && router.push(`/recipe/${plan.recipe_id}`)}
                    style={{ paddingVertical: 4 }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {plan.meal_slot}: {(plan as any).recipe?.title ?? plan.notes ?? 'No recipe'}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
