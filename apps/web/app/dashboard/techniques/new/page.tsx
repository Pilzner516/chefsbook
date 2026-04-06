'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, createTechnique } from '@chefsbook/db';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export default function NewTechniquePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<string>('beginner');
  const [steps, setSteps] = useState([{ instruction: '', tip: '', common_mistake: '' }]);
  const [tips, setTips] = useState(['']);
  const [mistakes, setMistakes] = useState(['']);
  const [tools, setTools] = useState(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateStep = (idx: number, field: string, value: string) => {
    setSteps((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const technique = await createTechnique(user.id, {
        title: title.trim(),
        description: description.trim() || null,
        process_steps: steps
          .filter((s) => s.instruction.trim())
          .map((s, i) => ({
            step_number: i + 1,
            instruction: s.instruction.trim(),
            tip: s.tip.trim() || null,
            common_mistake: s.common_mistake.trim() || null,
          })),
        tips: tips.filter((t) => t.trim()),
        common_mistakes: mistakes.filter((m) => m.trim()),
        tools_and_equipment: tools.filter((t) => t.trim()),
        difficulty: difficulty as any,
        source_type: 'manual',
      });
      router.push(`/technique/${technique.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Add Technique</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-6 text-sm">{error}</div>
      )}

      {/* Title + Difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-3">
          <label className="text-sm font-medium text-cb-muted mb-1 block">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How to brunoise, Tempering chocolate"
            className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-cb-muted mb-1 block">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="text-sm font-medium text-cb-muted mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What is this technique and why does it matter?"
          className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-purple-500"
        />
      </div>

      {/* Process Steps */}
      <div className="mb-6">
        <label className="text-sm font-medium text-cb-muted mb-2 block">Process Steps</label>
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-cb-card border border-cb-border rounded-card p-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={step.instruction}
                    onChange={(e) => updateStep(idx, 'instruction', e.target.value)}
                    rows={2}
                    placeholder="What to do in this step..."
                    className="w-full bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-purple-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={step.tip}
                      onChange={(e) => updateStep(idx, 'tip', e.target.value)}
                      placeholder="Pro tip (optional)"
                      className="bg-green-50 border border-green-200 rounded-input px-2 py-1.5 text-xs outline-none focus:border-green-400 placeholder:text-green-400"
                    />
                    <input
                      value={step.common_mistake}
                      onChange={(e) => updateStep(idx, 'common_mistake', e.target.value)}
                      placeholder="Common mistake (optional)"
                      className="bg-amber-50 border border-amber-200 rounded-input px-2 py-1.5 text-xs outline-none focus:border-amber-400 placeholder:text-amber-400"
                    />
                  </div>
                </div>
                {steps.length > 1 && (
                  <button onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))} className="text-cb-muted hover:text-cb-primary shrink-0 mt-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setSteps((prev) => [...prev, { instruction: '', tip: '', common_mistake: '' }])} className="text-xs text-purple-600 hover:underline mt-2">+ Add step</button>
      </div>

      {/* Tools & Equipment */}
      <div className="mb-6">
        <label className="text-sm font-medium text-cb-muted mb-1 block">Tools & Equipment</label>
        {tools.map((t, idx) => (
          <div key={idx} className="flex gap-2 mb-1.5">
            <input
              value={t}
              onChange={(e) => setTools((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
              placeholder="e.g. Chef's knife, Mandoline"
              className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-1.5 text-sm outline-none focus:border-purple-500"
            />
            {tools.length > 1 && (
              <button onClick={() => setTools((prev) => prev.filter((_, i) => i !== idx))} className="text-cb-muted hover:text-cb-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setTools((prev) => [...prev, ''])} className="text-xs text-purple-600 hover:underline mt-1">+ Add tool</button>
      </div>

      {/* Key Tips */}
      <div className="mb-6">
        <label className="text-sm font-medium text-cb-muted mb-1 block">Key Tips</label>
        {tips.map((t, idx) => (
          <div key={idx} className="flex gap-2 mb-1.5">
            <input
              value={t}
              onChange={(e) => setTips((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
              placeholder="A helpful tip..."
              className="flex-1 bg-green-50 border border-green-200 rounded-input px-3 py-1.5 text-sm outline-none focus:border-green-400"
            />
            {tips.length > 1 && (
              <button onClick={() => setTips((prev) => prev.filter((_, i) => i !== idx))} className="text-cb-muted hover:text-cb-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setTips((prev) => [...prev, ''])} className="text-xs text-green-600 hover:underline mt-1">+ Add tip</button>
      </div>

      {/* Common Mistakes */}
      <div className="mb-8">
        <label className="text-sm font-medium text-cb-muted mb-1 block">Common Mistakes</label>
        {mistakes.map((m, idx) => (
          <div key={idx} className="flex gap-2 mb-1.5">
            <input
              value={m}
              onChange={(e) => setMistakes((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
              placeholder="A common mistake to avoid..."
              className="flex-1 bg-amber-50 border border-amber-200 rounded-input px-3 py-1.5 text-sm outline-none focus:border-amber-400"
            />
            {mistakes.length > 1 && (
              <button onClick={() => setMistakes((prev) => prev.filter((_, i) => i !== idx))} className="text-cb-muted hover:text-cb-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setMistakes((prev) => [...prev, ''])} className="text-xs text-amber-600 hover:underline mt-1">+ Add mistake</button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="bg-purple-600 text-white px-6 py-2.5 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Technique'}
        </button>
        <button onClick={() => router.back()} className="text-sm text-cb-muted hover:text-cb-text">Cancel</button>
      </div>
    </div>
  );
}
