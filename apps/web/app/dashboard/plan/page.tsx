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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/plan/templates"
            className="border border-cb-border px-4 py-2 rounded-input text-sm font-medium text-cb-muted hover:text-cb-text hover:bg-cb-card transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Templates
          </Link>
          <div className="flex items-center gap-2 bg-cb-card border border-cb-border rounded-input px-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="px-3 py-2 text-cb-muted hover:text-cb-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-sm text-cb-muted px-2">
              {weekDates[0]} — {weekDates[6]}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="px-3 py-2 text-cb-muted hover:text-cb-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-cb-muted py-20">Loading meal plan...</div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {weekDates.map((date, i) => {
            const dayPlans = plans.filter((p: any) => p.plan_date === date);
            return (
              <div
                key={date}
                className="bg-cb-card border border-cb-border rounded-card p-4 min-h-[200px]"
              >
                <div className="text-sm font-semibold mb-0.5">{DAYS[i]}</div>
                <div className="text-xs text-cb-muted mb-3">{date}</div>
                {dayPlans.length === 0 ? (
                  <p className="text-xs text-cb-muted/60">No meals</p>
                ) : (
                  dayPlans.map((plan: any) => (
                    <div key={plan.id} className="mb-2">
                      <span className="text-[10px] uppercase tracking-wide text-cb-primary font-semibold">
                        {plan.meal_slot}
                      </span>
                      {plan.recipe_id ? (
                        <Link
                          href={`/recipe/${plan.recipe_id}`}
                          className="block text-sm hover:text-cb-primary transition-colors"
                        >
                          {(plan as any).recipe?.title ?? 'Recipe'}
                        </Link>
                      ) : (
                        <p className="text-sm text-cb-muted">{plan.notes ?? '-'}</p>
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
