'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@chefsbook/db';

interface NutritionData {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

interface NutritionEstimate {
  per_serving: NutritionData;
  per_100g: NutritionData | null;
  total_weight_g: number | null;
  confidence: number;
  notes: string | null;
}

interface NutritionCardProps {
  recipeId: string;
  nutrition: NutritionEstimate | null;
  isOwner: boolean;
  servings: number | null;
}

const NUTRIENT_CONFIG = [
  { key: 'calories', label: 'Calories', unit: '', color: 'text-cb-primary' },
  { key: 'protein_g', label: 'Protein', unit: 'g', color: 'text-blue-600' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g', color: 'text-amber-600' },
  { key: 'fat_g', label: 'Fat', unit: 'g', color: 'text-orange-600' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g', color: 'text-green-600' },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', color: 'text-pink-600' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', color: 'text-purple-600' },
] as const;

export default function NutritionCard({
  recipeId,
  nutrition: initialNutrition,
  isOwner,
  servings,
}: NutritionCardProps) {
  const [nutrition, setNutrition] = useState<NutritionEstimate | null>(initialNutrition);
  const [view, setView] = useState<'serving' | '100g'>('serving');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore toggle preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cb-nutrition-toggle');
    if (saved === '100g' && nutrition?.per_100g) {
      setView('100g');
    }
  }, [nutrition]);

  const handleToggle = (newView: 'serving' | '100g') => {
    setView(newView);
    localStorage.setItem('cb-nutrition-toggle', newView);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`/api/recipes/${recipeId}/generate-nutrition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      const { nutrition: newNutrition } = await res.json();
      setNutrition(newNutrition);
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate nutrition');
      setTimeout(() => setError(null), 5000);
    } finally {
      setGenerating(false);
    }
  };

  // If no nutrition and not owner, hide entirely
  if (!nutrition && !isOwner) {
    return null;
  }

  // Empty state with Generate CTA for owner
  if (!nutrition) {
    return (
      <section className="mb-10">
        <div className="bg-[#faf7f0] border border-cb-border rounded-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-l-4 border-cb-primary">
            <span className="text-lg">🥗</span>
            <span className="text-sm text-cb-secondary">
              Nutrition data not yet generated
            </span>
            <span className="flex-1" />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 bg-cb-primary text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-cb-primary/90 transition disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg
                    className="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span> Generate Nutrition
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-700 text-xs">
              {error}
            </div>
          )}
        </div>
      </section>
    );
  }

  // Get the data to display based on toggle
  const data = view === '100g' && nutrition.per_100g ? nutrition.per_100g : nutrition.per_serving;
  const isLowConfidence = nutrition.confidence < 0.5;

  return (
    <section className="mb-10">
      <div className="bg-[#faf7f0] border border-cb-border rounded-card overflow-hidden">
        {/* Header with red accent stripe */}
        <div className="flex items-center justify-between px-4 py-3 border-l-4 border-cb-primary">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-cb-text">Nutrition Facts</h2>
            <span className="text-xs text-cb-secondary flex items-center gap-1">
              <span>✨</span> Sous Chef estimate
            </span>
          </div>
          {/* Toggle - only show if per_100g exists */}
          {nutrition.per_100g && (
            <div className="flex gap-0.5 bg-cb-bg rounded-full p-0.5">
              <button
                onClick={() => handleToggle('serving')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  view === 'serving'
                    ? 'bg-cb-primary text-white'
                    : 'text-cb-secondary hover:text-cb-text'
                }`}
              >
                Per Serving
              </button>
              <button
                onClick={() => handleToggle('100g')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  view === '100g'
                    ? 'bg-cb-primary text-white'
                    : 'text-cb-secondary hover:text-cb-text'
                }`}
              >
                Per 100g
              </button>
            </div>
          )}
        </div>

        {/* Low confidence warning */}
        {isLowConfidence && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
            <span className="text-amber-600">⚠️</span>
            <span className="text-xs text-amber-800">
              Limited ingredient data — these values are rough estimates only.
            </span>
          </div>
        )}

        {/* Nutrient grid */}
        <div className="p-4 border-t border-cb-border/50">
          {generating ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {NUTRIENT_CONFIG.map((n) => (
                <div
                  key={n.key}
                  className="bg-white rounded-lg p-3 border border-cb-border/50 animate-pulse"
                >
                  <div className="h-3 w-12 bg-cb-bg rounded mb-2" />
                  <div className="h-6 w-16 bg-cb-bg rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {NUTRIENT_CONFIG.map((n) => {
                const value = data[n.key as keyof NutritionData];
                return (
                  <div
                    key={n.key}
                    className="bg-white rounded-lg p-3 border border-cb-border/50"
                  >
                    <div className="text-xs text-cb-secondary mb-1">{n.label}</div>
                    <div className={`text-xl font-bold ${n.color}`}>
                      {typeof value === 'number' ? value.toFixed(1) : '—'}
                      <span className="text-sm font-normal text-cb-secondary ml-0.5">
                        {n.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with disclaimer and regenerate */}
        <div className="px-4 py-2 border-t border-cb-border/50 flex items-center justify-between">
          <span className="text-[10px] text-cb-muted">
            Estimated by Sous Chef. Not a substitute for professional dietary advice.
          </span>
          {isOwner && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs text-cb-secondary hover:text-cb-primary transition flex items-center gap-1 disabled:opacity-50"
            >
              ↻ Regenerate
            </button>
          )}
        </div>

        {/* Error toast */}
        {error && (
          <div className="px-4 py-2 bg-red-50 text-red-700 text-xs border-t border-red-100">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
