'use client';

import { useState } from 'react';
import type { RecipeWithDetails } from '@chefsbook/db';
import type { SousChefFeedbackResult } from '@chefsbook/ai';

interface AskSousChefModalProps {
  isOpen: boolean;
  onClose: () => void;
  original: RecipeWithDetails;
  versions: RecipeWithDetails[];
  onSave: (regenerated: SousChefFeedbackResult, baseVersionId: string | null) => Promise<void>;
}

type BaseVersion = 'original' | 'v1' | 'v2';

export function AskSousChefModal({
  isOpen,
  onClose,
  original,
  versions,
  onSave,
}: AskSousChefModalProps) {
  const [baseVersion, setBaseVersion] = useState<BaseVersion>('original');
  const [feedback, setFeedback] = useState('');
  const [generating, setGenerating] = useState(false);
  const [regenerated, setRegenerated] = useState<SousChefFeedbackResult | null>(null);
  const [saving, setSaving] = useState(false);

  const v1 = versions.find(v => v.personal_version_slot === 1);
  const v2 = versions.find(v => v.personal_version_slot === 2);

  // Hide Original pill when both slots are full
  const hideOriginal = v1 && v2;

  const handleGenerate = async () => {
    if (!feedback.trim()) return;

    setGenerating(true);
    try {
      const res = await fetch(`/api/recipes/${original.id}/ask-sous-chef`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim(), baseVersion }),
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.error === 'PLAN_REQUIRED') {
          alert('Ask Sous Chef requires Chef plan or above');
          return;
        }
        throw new Error(error.error || 'Failed to generate');
      }

      const data = await res.json();
      setRegenerated(data.regenerated);
    } catch (err) {
      console.error('Failed to generate:', err);
      alert('Failed to generate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!regenerated) return;

    setSaving(true);
    try {
      const baseVersionId = baseVersion === 'original' ? null :
                           baseVersion === 'v1' ? (v1?.id ?? null) :
                           (v2?.id ?? null);
      await onSave(regenerated, baseVersionId);
      setRegenerated(null);
      setFeedback('');
      setBaseVersion('original');
      onClose();
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-cb-border flex justify-between items-center">
          <h2 className="text-2xl font-bold text-cb-text">Ask Sous Chef</h2>
          <button
            onClick={onClose}
            className="text-cb-secondary hover:text-cb-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!regenerated ? (
          <div className="p-6 space-y-4">
            {/* Base version selector */}
            <div>
              <label className="block text-sm font-medium text-cb-text mb-2">
                Which version would you like to refine?
              </label>
              <div className="flex gap-2">
                {!hideOriginal && (
                  <button
                    onClick={() => setBaseVersion('original')}
                    className={`
                      px-4 py-2 rounded-lg border text-sm font-medium transition-all
                      ${baseVersion === 'original'
                        ? 'bg-cb-primary text-white border-cb-primary'
                        : 'bg-white text-cb-text border-cb-border hover:border-cb-primary'
                      }
                    `}
                  >
                    Original
                  </button>
                )}
                {v1 && (
                  <button
                    onClick={() => setBaseVersion('v1')}
                    className={`
                      px-4 py-2 rounded-lg border text-sm font-medium transition-all
                      ${baseVersion === 'v1'
                        ? 'bg-cb-primary text-white border-cb-primary'
                        : 'bg-white text-cb-text border-cb-border hover:border-cb-primary'
                      }
                    `}
                  >
                    {v1.title}
                  </button>
                )}
                {v2 && (
                  <button
                    onClick={() => setBaseVersion('v2')}
                    className={`
                      px-4 py-2 rounded-lg border text-sm font-medium transition-all
                      ${baseVersion === 'v2'
                        ? 'bg-cb-primary text-white border-cb-primary'
                        : 'bg-white text-cb-text border-cb-border hover:border-cb-primary'
                      }
                    `}
                  >
                    {v2.title}
                  </button>
                )}
              </div>
            </div>

            {/* Feedback textarea */}
            <div>
              <label htmlFor="feedback" className="block text-sm font-medium text-cb-text mb-2">
                What did the Sous Chef miss? Add any corrections or extra details.
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-cb-border rounded-lg bg-white text-cb-text resize-none focus:outline-none focus:ring-2 focus:ring-cb-primary"
                placeholder="e.g., The recipe is missing heavy cream in the ingredients..."
              />
            </div>

            {/* Generate button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-cb-border rounded-lg text-cb-text hover:bg-cb-base"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!feedback.trim() || generating}
                className="px-4 py-2 bg-cb-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Your Sous Chef is reviewing this recipe…' : 'Generate'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Review panel */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-cb-text">{regenerated.title}</h3>
              <p className="text-cb-text">{regenerated.description}</p>

              <div>
                <h4 className="font-semibold text-cb-text mb-2">Ingredients</h4>
                <ul className="space-y-1">
                  {regenerated.ingredients.map((ing, idx) => (
                    <li key={idx} className="text-cb-text text-sm">
                      {ing.quantity} {ing.unit} {ing.name}
                      {ing.group && <span className="text-cb-secondary ml-2">({ing.group})</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-cb-text mb-2">Steps</h4>
                <ol className="space-y-2">
                  {regenerated.steps.map((step, idx) => (
                    <li key={idx} className="text-cb-text text-sm">
                      <span className="font-medium">{idx + 1}.</span> {step.instruction}
                      {step.duration_minutes && (
                        <span className="text-cb-secondary ml-2">({step.duration_minutes} min)</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {regenerated.notes && (
                <div>
                  <h4 className="font-semibold text-cb-text mb-2">Notes</h4>
                  <p className="text-cb-text text-sm">{regenerated.notes}</p>
                </div>
              )}
            </div>

            {/* Save/Cancel buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRegenerated(null);
                  setFeedback('');
                }}
                className="px-4 py-2 border border-cb-border rounded-lg text-cb-text hover:bg-cb-base"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-cb-primary text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Version'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
