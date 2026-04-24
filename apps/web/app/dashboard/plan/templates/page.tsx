'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, listRecipes, addMealPlan } from '@chefsbook/db';
import type { Recipe, MealSlot } from '@chefsbook/db';
import { useAlertDialog } from '@/components/useConfirmDialog';

interface TemplateSlot {
  day: number; // 0=Mon ... 6=Sun
  meal_slot: MealSlot;
  recipe_id: string;
  recipe_title: string;
}

interface MenuTemplate {
  id: string;
  name: string;
  description: string;
  slots: TemplateSlot[];
  created_at: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const STORAGE_KEY = 'chefsbook_menu_templates';

function loadTemplates(): MenuTemplate[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveTemplates(templates: MenuTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export default function MenuTemplatesPage() {
  const router = useRouter();
  const [showAlert, AlertDialog] = useAlertDialog();
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [creating, setCreating] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);

  // New template form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<TemplateSlot[]>([]);
  const [addSlotDay, setAddSlotDay] = useState(0);
  const [addSlotMeal, setAddSlotMeal] = useState<MealSlot>('dinner');
  const [addSlotRecipe, setAddSlotRecipe] = useState('');

  useEffect(() => {
    setTemplates(loadTemplates());
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const data = await listRecipes({ userId: user.id });
      setRecipes(data);
    }
  };

  const handleAddSlot = () => {
    if (!addSlotRecipe) return;
    const recipe = recipes.find((r) => r.id === addSlotRecipe);
    if (!recipe) return;
    setSlots([
      ...slots,
      {
        day: addSlotDay,
        meal_slot: addSlotMeal,
        recipe_id: recipe.id,
        recipe_title: recipe.title,
      },
    ]);
    setAddSlotRecipe('');
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = () => {
    if (!name.trim() || slots.length === 0) return;
    const template: MenuTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      slots,
      created_at: new Date().toISOString(),
    };
    const updated = [...templates, template];
    setTemplates(updated);
    saveTemplates(updated);
    setCreating(false);
    setName('');
    setDescription('');
    setSlots([]);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
  };

  const handleDeploy = async (template: MenuTemplate) => {
    setDeploying(template.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      // Deploy starting from next Monday
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysUntilMonday);

      for (const slot of template.slots) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + slot.day);
        const dateStr = date.toISOString().split('T')[0]!;

        await addMealPlan(user.id, {
          plan_date: dateStr,
          meal_slot: slot.meal_slot,
          recipe_id: slot.recipe_id,
          servings: 2,
          notes: `From template: ${template.name}`,
        });
      }

      router.push('/dashboard/plan');
    } catch (e: any) {
      showAlert({ title: 'Error', body: e.message });
    } finally {
      setDeploying(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/plan"
              className="text-cb-secondary hover:text-cb-text text-sm"
            >
              Meal Plan
            </Link>
            <svg className="w-3 h-3 text-cb-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-sm font-medium">Templates</span>
          </div>
          <h1 className="text-2xl font-bold">Menu Templates</h1>
          <p className="text-cb-secondary text-sm mt-1">
            Save weekly menus as templates and deploy them to your meal planner in one click.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="bg-cb-primary text-white px-5 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Template
          </button>
        )}
      </div>

      {/* Create template form */}
      {creating && (
        <div className="bg-cb-card border border-cb-border rounded-card p-6 mb-8">
          <h2 className="font-semibold mb-4">Create Template</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-cb-secondary block mb-1">
                Template name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mediterranean Week"
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-cb-secondary block mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quick weeknight meals with Mediterranean flavours"
                className="w-full bg-cb-bg border border-cb-border rounded-input px-4 py-2.5 text-sm placeholder:text-cb-secondary/60 outline-none focus:border-cb-primary transition-colors"
              />
            </div>
          </div>

          {/* Add slot */}
          <div className="bg-cb-bg rounded-input p-4 mb-4">
            <p className="text-sm font-medium mb-3">Add a meal slot</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-cb-secondary block mb-1">Day</label>
                <select
                  value={addSlotDay}
                  onChange={(e) => setAddSlotDay(Number(e.target.value))}
                  className="bg-cb-card border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-cb-secondary block mb-1">Meal</label>
                <select
                  value={addSlotMeal}
                  onChange={(e) => setAddSlotMeal(e.target.value as MealSlot)}
                  className="bg-cb-card border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
                >
                  {MEAL_SLOTS.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-cb-secondary block mb-1">Recipe</label>
                <select
                  value={addSlotRecipe}
                  onChange={(e) => setAddSlotRecipe(e.target.value)}
                  className="w-full bg-cb-card border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
                >
                  <option value="">Select a recipe...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddSlot}
                disabled={!addSlotRecipe}
                className="bg-cb-green text-white px-4 py-2 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Slots preview */}
          {slots.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-cb-secondary font-medium uppercase tracking-wide mb-2">
                {slots.length} meal{slots.length !== 1 ? 's' : ''} in template
              </p>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day, dayIndex) => {
                  const daySlots = slots.filter((s) => s.day === dayIndex);
                  return (
                    <div key={day} className="bg-cb-bg rounded-input p-2 min-h-[80px]">
                      <p className="text-xs font-semibold text-cb-secondary mb-1">{day}</p>
                      {daySlots.map((slot, i) => {
                        const globalIndex = slots.indexOf(slot);
                        return (
                          <div
                            key={i}
                            className="bg-cb-card border border-cb-border rounded px-2 py-1 mb-1 text-xs group flex items-start justify-between"
                          >
                            <div>
                              <span className="text-cb-primary font-medium">
                                {slot.meal_slot}
                              </span>
                              <p className="truncate">{slot.recipe_title}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveSlot(globalIndex)}
                              className="text-cb-secondary hover:text-cb-primary opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
                            >
                              &times;
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveTemplate}
              disabled={!name.trim() || slots.length === 0}
              className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Save Template
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setName('');
                setDescription('');
                setSlots([]);
              }}
              className="border border-cb-border px-6 py-2.5 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !creating ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No templates yet</h2>
          <p className="text-cb-secondary text-sm mb-6">
            Create a weekly menu template to quickly populate your meal planner.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="bg-cb-primary text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-cb-card border border-cb-border rounded-card p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.description && (
                    <p className="text-cb-secondary text-sm mt-0.5">{template.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="text-cb-secondary hover:text-cb-primary text-sm"
                  title="Delete template"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>

              {/* Mini week preview */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {DAYS.map((day, i) => {
                  const count = template.slots.filter((s) => s.day === i).length;
                  return (
                    <div key={day} className="text-center">
                      <p className="text-[10px] text-cb-secondary">{day}</p>
                      <div
                        className={`w-full h-6 rounded flex items-center justify-center text-xs ${
                          count > 0
                            ? 'bg-cb-primary/10 text-cb-primary font-medium'
                            : 'bg-cb-bg text-cb-secondary/50'
                        }`}
                      >
                        {count > 0 ? count : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-cb-secondary mb-4">
                {template.slots.length} meal{template.slots.length !== 1 ? 's' : ''} across{' '}
                {new Set(template.slots.map((s) => s.day)).size} days
              </p>

              <button
                onClick={() => handleDeploy(template)}
                disabled={deploying === template.id}
                className="w-full bg-cb-green text-white py-2.5 rounded-input text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deploying === template.id ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deploying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    Deploy to next week
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
      <AlertDialog />
    </div>
  );
}
