'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase, addMealPlan } from '@chefsbook/db';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DIETS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-free', 'Low-carb', 'High-protein', 'Kid-friendly'];
const CUISINES = ['Italian', 'French', 'Asian', 'Mexican', 'Mediterranean', 'American', 'Indian', 'Japanese', 'Thai'];
const SERVINGS = [1, 2, 4, 6];

interface PlanSlot {
  day: string;
  slot: string;
  recipe_id: string | null;
  title: string;
  source: string;
  cuisine: string;
  estimated_time: number;
  reason: string;
}

export default function MealPlanWizard({
  weekDates,
  onClose,
  onAccept,
}: {
  weekDates: string[];
  onClose: () => void;
  onAccept: () => void;
}) {
  const [step, setStep] = useState(1);

  // Step 1
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS);
  const [selectedSlots, setSelectedSlots] = useState<string[]>(['lunch', 'dinner']);
  const [skipExisting, setSkipExisting] = useState(true);

  // Step 2
  const [dietary, setDietary] = useState<string[]>([]);
  const [likesText, setLikesText] = useState('');
  const [cuisineVariety, setCuisineVariety] = useState(50);
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);
  const [effortLevel, setEffortLevel] = useState(40);
  const [adventurousness, setAdventurousness] = useState(50);
  const [servings, setServings] = useState(4);

  // Step 3
  const [source, setSource] = useState<'my_recipes' | 'mix' | 'community'>('mix');

  // Step 4
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [plan, setPlan] = useState<PlanSlot[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: string) => setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  const toggleSlot = (s: string) => setSelectedSlots((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleDiet = (d: string) => setDietary((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  const toggleCuisine = (c: string) => setPreferredCuisines((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const generate = async () => {
    setStep(4);
    setGenerating(true);
    setGenStep('Analyzing your preferences...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      setGenStep('Selecting recipes...');
      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          days: selectedDays,
          slots: selectedSlots,
          dietary,
          likesDislikesText: likesText,
          cuisineVariety,
          preferredCuisines,
          effortLevel,
          adventurousness,
          servings,
          source,
        }),
      });
      const data = await res.json();
      setGenStep('Balancing your week...');
      setPlan(data.plan ?? []);
    } catch {} finally {
      setGenerating(false);
    }
  };

  const swapSlot = async (day: string, slot: string) => {
    // Re-generate just this one slot
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/meal-plan/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ days: [day], slots: [slot], dietary, likesDislikesText: likesText, cuisineVariety, preferredCuisines, effortLevel, adventurousness, servings, source }),
    });
    const data = await res.json();
    if (data.plan?.[0]) {
      setPlan((prev) => prev.map((p) => p.day === day && p.slot === slot ? data.plan[0] : p));
    }
  };

  const removeSlot = (day: string, slot: string) => {
    setPlan((prev) => prev.filter((p) => !(p.day === day && p.slot === slot)));
  };

  const acceptPlan = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    for (const entry of plan) {
      const dayIdx = DAYS.indexOf(entry.day);
      if (dayIdx < 0 || dayIdx >= weekDates.length) continue;
      const planDate = weekDates[dayIdx]!;
      await addMealPlan(user.id, {
        plan_date: planDate,
        meal_slot: entry.slot as any,
        recipe_id: entry.recipe_id ?? null,
        servings: entry.recipe_id ? servings : null,
        notes: entry.recipe_id ? null : entry.title,
      });
    }
    setSaving(false);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-cb-card w-full max-w-3xl max-h-[90vh] rounded-card shadow-xl flex flex-col mx-4">
        {/* Header */}
        <div className="p-5 border-b border-cb-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">AI Meal Planner</h2>
          <button onClick={onClose} className="text-cb-secondary hover:text-cb-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 flex gap-1 shrink-0">
          {['Days & Meals', 'Preferences', 'Sources', 'Review'].map((label, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full mb-1 ${step > i + 1 ? 'bg-cb-primary' : step === i + 1 ? 'bg-cb-primary/50' : 'bg-cb-border'}`} />
              <p className={`text-[10px] ${step === i + 1 ? 'text-cb-primary font-semibold' : 'text-cb-secondary'}`}>{i + 1}. {label}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: Days & Meals */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold mb-3">Which days and meals?</h3>
              <div className="flex gap-1.5 mb-2">
                {DAYS.map((d, i) => (
                  <button key={d} onClick={() => toggleDay(d)} className={`flex-1 py-2 rounded-input text-xs font-medium ${selectedDays.includes(d) ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>{DAY_LABELS[i]}</button>
                ))}
              </div>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setSelectedDays(DAYS.slice(0, 5))} className="text-[10px] text-cb-primary hover:underline">Weekdays</button>
                <button onClick={() => setSelectedDays(DAYS.slice(5))} className="text-[10px] text-cb-primary hover:underline">Weekend</button>
                <button onClick={() => setSelectedDays([...DAYS])} className="text-[10px] text-cb-primary hover:underline">Full Week</button>
              </div>
              <div className="flex gap-2 mb-4">
                {SLOTS.map((s) => (
                  <button key={s} onClick={() => toggleSlot(s)} className={`px-4 py-2 rounded-full text-xs font-medium ${selectedSlots.includes(s) ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>
                    {s === 'breakfast' ? '🌅' : s === 'lunch' ? '☀️' : s === 'dinner' ? '🌙' : '🍎'} {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-cb-secondary">
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} className="rounded" />
                Skip slots that already have recipes
              </label>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Dietary preferences</h4>
                <div className="flex flex-wrap gap-1.5">
                  {DIETS.map((d) => (
                    <button key={d} onClick={() => toggleDiet(d)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${dietary.includes(d) ? 'bg-cb-green text-white' : 'bg-cb-bg text-cb-secondary'}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Likes & dislikes</h4>
                <input value={likesText} onChange={(e) => setLikesText(e.target.value.slice(0, 200))} placeholder="e.g. love chocolate desserts, hate cilantro, prefer fish on Fridays" className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Cuisine variety <span className="font-normal text-cb-secondary">{cuisineVariety < 30 ? '(same cuisine)' : cuisineVariety > 70 ? '(mix it up!)' : '(moderate)'}</span></h4>
                <input type="range" min={0} max={100} value={cuisineVariety} onChange={(e) => setCuisineVariety(parseInt(e.target.value))} className="w-full" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CUISINES.map((c) => (
                    <button key={c} onClick={() => toggleCuisine(c)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${preferredCuisines.includes(c) ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Effort level <span className="font-normal text-cb-secondary">{effortLevel < 30 ? '(quick & easy)' : effortLevel > 70 ? '(love to cook)' : '(moderate)'}</span></h4>
                <input type="range" min={0} max={100} value={effortLevel} onChange={(e) => setEffortLevel(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Cooking for</h4>
                <div className="flex gap-2">
                  {SERVINGS.map((s) => (
                    <button key={s} onClick={() => setServings(s)} className={`w-12 h-10 rounded-input text-sm font-medium ${servings === s ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>{s}{s === 6 ? '+' : ''}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Sources */}
          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-semibold mb-2">Where should we find recipes?</h3>
              {([
                { key: 'my_recipes' as const, icon: '🗂️', title: 'My recipes only', desc: 'Pick from recipes you\'ve already saved' },
                { key: 'mix' as const, icon: '✨', title: 'My recipes + suggestions', desc: 'Combine your collection with AI recipe suggestions' },
                { key: 'community' as const, icon: '🌍', title: 'Discover new recipes', desc: 'Suggest popular recipes — great for finding new favorites' },
              ]).map((opt) => (
                <button key={opt.key} onClick={() => setSource(opt.key)} className={`w-full text-left p-4 rounded-card border-2 transition-colors ${source === opt.key ? 'border-cb-primary bg-cb-primary/5' : 'border-cb-border hover:border-cb-primary/30'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{opt.title}</p>
                      <p className="text-xs text-cb-secondary">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && generating && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>
              </div>
              <p className="font-bold mb-1">Building your meal plan...</p>
              <p className="text-sm text-cb-secondary">{genStep}</p>
            </div>
          )}

          {step === 4 && !generating && (
            <div>
              <p className="text-sm text-cb-secondary mb-4">{plan.length} meals planned</p>
              <div className="space-y-2">
                {DAYS.filter((d) => selectedDays.includes(d)).map((day) => {
                  const daySlots = plan.filter((p) => p.day === day);
                  if (daySlots.length === 0) return null;
                  return (
                    <div key={day}>
                      <p className="text-xs font-bold text-cb-secondary uppercase mb-1">{day.charAt(0).toUpperCase() + day.slice(1)}</p>
                      <div className="space-y-1">
                        {daySlots.map((entry) => (
                          <div key={`${entry.day}-${entry.slot}`} className="flex items-center gap-3 bg-cb-bg rounded-input px-3 py-2">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${entry.slot === 'breakfast' ? 'bg-amber-100 text-amber-700' : entry.slot === 'lunch' ? 'bg-blue-100 text-blue-700' : entry.slot === 'dinner' ? 'bg-cb-primary/10 text-cb-primary' : 'bg-green-100 text-green-700'}`}>{entry.slot}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{entry.title}</p>
                              <p className="text-[10px] text-cb-secondary">{entry.cuisine} · {entry.estimated_time}min · {entry.reason}</p>
                            </div>
                            <button onClick={() => swapSlot(day, entry.slot)} className="text-cb-secondary hover:text-cb-primary shrink-0" title="Swap">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                            </button>
                            <button onClick={() => removeSlot(day, entry.slot)} className="text-cb-secondary hover:text-cb-primary shrink-0" title="Remove">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-cb-border flex items-center gap-3 shrink-0">
          {step > 1 && step < 4 && <button onClick={() => setStep((s) => (s - 1) as any)} className="text-sm text-cb-secondary hover:text-cb-text">&larr; Back</button>}
          <span className="flex-1" />
          {step < 3 && <button onClick={() => setStep((s) => (s + 1) as any)} disabled={step === 1 && (selectedDays.length === 0 || selectedSlots.length === 0)} className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">Next &rarr;</button>}
          {step === 3 && <button onClick={generate} className="bg-cb-green text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>Generate Plan</button>}
          {step === 4 && !generating && (
            <>
              <button onClick={() => setStep(2)} className="text-sm text-cb-secondary hover:text-cb-text">&larr; Change preferences</button>
              <button onClick={generate} className="border border-cb-border px-4 py-2 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text">Regenerate</button>
              <button onClick={acceptPlan} disabled={saving || plan.length === 0} className="bg-cb-green text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving ? 'Saving...' : 'Accept Plan'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
