'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase, getMealPlansForWeek } from '@chefsbook/db';
import type { MealPlan } from '@chefsbook/db';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

export default function PlanPage() {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [weekStart, setWeekStart] = useState(new Date().toISOString().split('T')[0]!);
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  useEffect(() => {
    loadPlans();
  }, [weekStart]);

  const loadPlans = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user && weekDates.length === 7) {
      const data = await getMealPlansForWeek(user.id, weekDates[0]!, weekDates[6]!);
      setPlans(data);
    }
    setLoading(false);
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().split('T')[0]!);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Meal Plan</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigateWeek(-1)} className="text-cb-primary font-semibold hover:opacity-80">{'\u2190'} Prev</button>
          <span className="text-sm text-cb-text-secondary">{weekDates[0]} — {weekDates[6]}</span>
          <button onClick={() => navigateWeek(1)} className="text-cb-primary font-semibold hover:opacity-80">Next {'\u2192'}</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-cb-text-secondary py-20">Loading meal plan...</div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {weekDates.map((date, i) => {
            const dayPlans = plans.filter((p: any) => p.plan_date === date);
            return (
              <div key={date} className="bg-cb-surface border border-cb-border rounded-xl p-4 min-h-[200px]">
                <div className="text-sm font-semibold mb-1">{DAYS[i]}</div>
                <div className="text-xs text-cb-text-tertiary mb-3">{date}</div>
                {dayPlans.length === 0 ? (
                  <p className="text-xs text-cb-text-tertiary">No meals</p>
                ) : (
                  dayPlans.map((plan: any) => (
                    <div key={plan.id} className="mb-2">
                      <span className="text-xs text-cb-primary font-medium">{plan.meal_slot}</span>
                      {plan.recipe_id ? (
                        <Link href={`/recipe/${plan.recipe_id}`} className="block text-sm hover:text-cb-primary transition-colors">
                          {(plan as any).recipe?.title ?? 'Recipe'}
                        </Link>
                      ) : (
                        <p className="text-sm text-cb-text-secondary">{plan.notes ?? '-'}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
