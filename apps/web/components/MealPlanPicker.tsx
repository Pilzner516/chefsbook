'use client';

import { useState, useEffect } from 'react';
import { supabase, getMealPlansForWeek, addMealPlan } from '@chefsbook/db';
import type { MealPlan, MealSlot } from '@chefsbook/db';

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
  return d.toISOString().split('T')[0];
}

function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
}

interface Props {
  recipeId: string;
  recipeServings: number;
  onClose: () => void;
}

export default function MealPlanPicker({ recipeId, recipeServings, onClose }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | null>(null);
  const [servings, setServings] = useState(recipeServings || 4);
  const [existing, setExisting] = useState<MealPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const weekDays = getWeekDays(weekStart);
  const todayStr = formatDate(new Date());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const wEnd = new Date(weekStart); wEnd.setDate(wEnd.getDate() + 6);
        getMealPlansForWeek(uid, formatDate(weekStart), formatDate(wEnd)).then(setExisting);
      }
    });
  }, [weekStart]);

  const isDayFull = (date: string) =>
    MEAL_SLOTS.every((s) => existing.some((m) => m.plan_date === date && m.meal_slot === s));

  const isSlotOccupied = (date: string, slot: MealSlot) =>
    existing.some((m) => m.plan_date === date && m.meal_slot === slot);

  const handleSlotTap = (slot: MealSlot) => {
    if (!selectedDay) return;
    if (isSlotOccupied(selectedDay, slot)) {
      if (!confirm(`This slot already has a recipe. Add anyway?`)) return;
    }
    setSelectedSlot(slot);
  };

  const handleSave = async () => {
    if (!userId || !selectedDay || !selectedSlot) return;
    setSaving(true);
    try {
      await addMealPlan(userId, { plan_date: selectedDay, meal_slot: selectedSlot, recipe_id: recipeId, servings, notes: null });
      const dayIdx = weekDays.findIndex((d) => formatDate(d) === selectedDay);
      alert(`Added to ${DAY_NAMES[dayIdx]} · ${selectedSlot}`);
      onClose();
    } catch (e: any) {
      alert('Failed: ' + (e.message ?? 'Unknown error'));
    }
    setSaving(false);
  };

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelectedDay(null); setSelectedSlot(null); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelectedDay(null); setSelectedSlot(null); };

  const weekLabel = `${weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-cb-card rounded-card p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-cb-text">Add to Meal Plan</h2>
          <button onClick={onClose} className="text-cb-muted hover:text-cb-text">✕</button>
        </div>

        {/* Week nav */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={prevWeek} className="text-cb-text hover:text-cb-primary">◀</button>
          <span className="text-sm font-semibold text-cb-text">Week of {weekLabel}</span>
          <button onClick={nextWeek} className="text-cb-text hover:text-cb-primary">▶</button>
        </div>

        {/* Day pills */}
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {weekDays.map((d, i) => {
            const ds = formatDate(d);
            const full = isDayFull(ds);
            const sel = selectedDay === ds;
            const isToday = ds === todayStr;
            return (
              <button
                key={ds}
                onClick={() => { setSelectedDay(ds); setSelectedSlot(null); }}
                className={`text-center py-2 rounded-lg text-xs font-medium transition ${
                  sel
                    ? full ? 'bg-cb-primary text-white' : 'bg-cb-green text-white'
                    : full ? 'bg-red-50 text-cb-text hover:bg-red-100' : 'bg-green-50 text-cb-text hover:bg-green-100'
                }`}
              >
                <div className="font-semibold">{DAY_NAMES[i]}</div>
                <div className="text-base font-bold">{d.getDate()}</div>
                {isToday && <div className="text-[9px] opacity-70">Today</div>}
              </button>
            );
          })}
        </div>

        {/* Meal type pills */}
        {selectedDay && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-cb-secondary mb-2">Meal type</p>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_SLOTS.map((slot) => {
                const occ = isSlotOccupied(selectedDay, slot);
                const sel = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => handleSlotTap(slot)}
                    className={`py-2 rounded-lg text-sm font-semibold capitalize transition ${
                      sel
                        ? occ ? 'bg-cb-primary text-white' : 'bg-cb-green text-white'
                        : occ ? 'bg-red-50 text-cb-text hover:bg-red-100' : 'bg-green-50 text-cb-text hover:bg-green-100'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Servings stepper */}
        {selectedSlot && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-cb-secondary mb-2">Servings</p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center hover:bg-cb-bg">−</button>
              <span className="text-xl font-bold text-cb-text w-8 text-center">{servings}</span>
              <button onClick={() => setServings((s) => Math.min(20, s + 1))} className="w-8 h-8 rounded-full border border-cb-border flex items-center justify-center hover:bg-cb-bg">+</button>
            </div>
          </div>
        )}

        {/* Save button */}
        {selectedSlot && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-cb-primary text-white py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '...' : 'Add to Plan'}
          </button>
        )}
      </div>
    </div>
  );
}
