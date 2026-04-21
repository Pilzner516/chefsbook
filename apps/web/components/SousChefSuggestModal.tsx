'use client';

import { useState, useEffect } from 'react';

interface Ingredient {
  amount: string;
  unit: string;
  name: string;
  notes?: string;
}

interface Step {
  order: number;
  instruction: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  suggestions: {
    ingredients?: Ingredient[];
    steps?: Step[];
  };
  hadSourceScrape: boolean;
  onSave: (data: { ingredients?: Ingredient[]; steps?: Step[] }) => Promise<void>;
}

export function SousChefSuggestModal({ isOpen, onClose, suggestions, hadSourceScrape, onSave }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIngredients(suggestions.ingredients ?? []);
      setSteps(suggestions.steps ?? []);
    }
  }, [isOpen, suggestions]);

  if (!isOpen) return null;

  const hasIngredients = ingredients.length > 0;
  const hasSteps = steps.length > 0;

  const addIngredient = () => {
    setIngredients([...ingredients, { amount: '', unit: '', name: '', notes: '' }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const addStep = () => {
    const newOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order)) + 1 : 1;
    setSteps([...steps, { order: newOrder, instruction: '' }]);
  };

  const removeStep = (index: number) => {
    const filtered = steps.filter((_, i) => i !== index);
    // Reorder
    const reordered = filtered.map((step, i) => ({ ...step, order: i + 1 }));
    setSteps(reordered);
  };

  const updateStep = (index: number, instruction: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], instruction };
    setSteps(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ingredients: hasIngredients ? ingredients.filter(i => i.name.trim()) : undefined,
        steps: hasSteps ? steps.filter(s => s.instruction.trim()) : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-cb-card rounded-card w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-cb-border">
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-cb-text flex items-center gap-2">
              <span>✨</span>
              Your Sous Chef's Suggestions
            </h2>
            <p className="mt-1 text-sm text-cb-secondary">
              Your Sous Chef has suggested the following based on the recipe title, description, and source.
              Please review carefully before saving — you know this recipe better than anyone.
            </p>
            {!hadSourceScrape && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg inline-block">
                The original source couldn't be reached, so these are based on the recipe details only.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-cb-muted hover:text-cb-text transition-colors ml-4 text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Ingredients Section */}
          {hasIngredients && (
            <div>
              <h3 className="text-lg font-semibold text-cb-text mb-3">Ingredients</h3>
              <div className="space-y-2">
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                      placeholder="Amt"
                      className="w-20 px-3 py-2 border border-cb-border rounded-input outline-none focus:border-cb-primary text-sm"
                    />
                    <input
                      type="text"
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      placeholder="Unit"
                      className="w-24 px-3 py-2 border border-cb-border rounded-input outline-none focus:border-cb-primary text-sm"
                    />
                    <input
                      type="text"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1 px-3 py-2 border border-cb-border rounded-input outline-none focus:border-cb-primary text-sm"
                    />
                    <input
                      type="text"
                      value={ingredient.notes || ''}
                      onChange={(e) => updateIngredient(index, 'notes', e.target.value)}
                      placeholder="Notes"
                      className="w-32 px-3 py-2 border border-cb-border rounded-input outline-none focus:border-cb-primary text-sm"
                    />
                    <button
                      onClick={() => removeIngredient(index)}
                      className="text-cb-muted hover:text-red-600 transition-colors p-2 text-xl"
                      aria-label="Remove ingredient"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addIngredient}
                className="mt-3 text-sm text-cb-primary hover:text-cb-primary/80 flex items-center gap-1"
              >
                <span className="text-lg">+</span>
                Add ingredient
              </button>
            </div>
          )}

          {/* Steps Section */}
          {hasSteps && (
            <div>
              <h3 className="text-lg font-semibold text-cb-text mb-3">Steps</h3>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="w-8 h-8 flex items-center justify-center bg-cb-primary text-white rounded-full text-sm font-semibold flex-shrink-0 mt-1">
                      {step.order}
                    </div>
                    <textarea
                      value={step.instruction}
                      onChange={(e) => updateStep(index, e.target.value)}
                      placeholder="Instruction"
                      rows={2}
                      className="flex-1 px-3 py-2 border border-cb-border rounded-input outline-none focus:border-cb-primary text-sm resize-none"
                    />
                    <button
                      onClick={() => removeStep(index)}
                      className="text-cb-muted hover:text-red-600 transition-colors p-2 text-xl"
                      aria-label="Remove step"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addStep}
                className="mt-3 text-sm text-cb-primary hover:text-cb-primary/80 flex items-center gap-1"
              >
                <span className="text-lg">+</span>
                Add step
              </button>
            </div>
          )}

          {!hasIngredients && !hasSteps && (
            <div className="text-center py-12 text-cb-secondary">
              <p>Your Sous Chef found this recipe complete!</p>
              <p className="text-sm mt-1">No suggestions at this time.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-cb-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-cb-text hover:bg-cb-base rounded-input transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!hasIngredients && !hasSteps)}
            className="px-6 py-2 bg-cb-primary text-white rounded-input hover:bg-cb-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save to recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
