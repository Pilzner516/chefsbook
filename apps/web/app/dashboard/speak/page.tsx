'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, createRecipe, isPro, checkRecipeLimit } from '@chefsbook/db';
import RecipeReviewPanel from '@/components/RecipeReviewPanel';
import { createRecipeWithModeration } from '@/lib/saveWithModeration';

type Step = 1 | 2 | 3;

export default function SpeakPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [userIsPro, setUserIsPro] = useState(false);
  const [checked, setChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [recipe, setRecipe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showExample, setShowExample] = useState(true);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setVoiceSupported(false);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) isPro(user.id).then((v) => { setUserIsPro(v); setChecked(true); });
      else setChecked(true);
    });
  }, []);

  // ── Step 1: Recording ──

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let final = '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
        else interim += event.results[i][0].transcript;
      }
      setTranscript(final + interim);
    };
    recognition.onerror = () => { setRecording(false); };
    recognition.onend = () => { setRecording(false); };
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setTranscript('');
    setError('');
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  // ── Step 2→3: Generate recipe ──

  const generateRecipe = async () => {
    if (!transcript.trim()) return;
    setStep(3);
    setGenerating(true);
    setError('');
    try {
      setGenStep('Your Sous Chef is reading your recipe...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const gate = await checkRecipeLimit(user.id);
      if (!gate.allowed) throw new Error(gate.reason!);

      setGenStep('Extracting ingredients...');
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate recipe');
      const result = data.recipe;

      setGenStep('Formatting steps...');
      setRecipe(result);

      // Fetch image for the review panel
      setRecipeImageUrl(null);
      fetch('/api/speak/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: result.title, cuisine: result.cuisine, page: 1 }),
      }).then((r) => r.json()).then((d) => {
        if (d.url) setRecipeImageUrl(d.url);
      }).catch(() => {});
    } catch (e: any) {
      setError(e.message);
      setStep(2);
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 3: Save ──

  const saveRecipe = async () => {
    if (!recipe) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { recipe: saved } = await createRecipeWithModeration(user.id, { ...recipe, image_url: recipeImageUrl || undefined });
      router.push(`/recipe/${saved.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  // ── Pro gate ──

  if (checked && !userIsPro) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center py-20">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Speak a Recipe</h1>
        <p className="text-cb-secondary mb-6">Voice recipe entry is a Pro feature. Dictate any recipe and your Sous Chef will format it for you.</p>
        <Link href="/dashboard/settings" className="bg-cb-primary text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 inline-block">Upgrade to Pro</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[{ n: 1, label: 'Record' }, { n: 2, label: 'Review' }, { n: 3, label: 'Recipe' }].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${step >= n ? 'bg-cb-primary text-white' : 'bg-cb-bg text-cb-secondary'}`}>{n}</div>
            <span className={`text-sm font-medium ${step >= n ? 'text-cb-text' : 'text-cb-secondary'}`}>{label}</span>
            {i < 2 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-cb-primary' : 'bg-cb-border'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-cb-primary rounded-input p-3 mb-6 text-sm">{error}</div>
      )}

      {/* ── STEP 1: Record ── */}
      {step === 1 && (
        <div className="text-center">
          <p className="text-cb-secondary text-sm mb-6">Speak your recipe naturally. Say the name, ingredients, and steps in any order.</p>

          {showExample && (
            <div className="bg-cb-bg rounded-card p-4 mb-6 text-left max-w-md mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-cb-secondary">Example</span>
                <button onClick={() => setShowExample(false)} className="text-[10px] text-cb-secondary hover:text-cb-text">Hide</button>
              </div>
              <p className="text-xs text-cb-secondary italic leading-relaxed">
                "Grandma's cookies. Two cups flour, one cup butter, two eggs, one cup chocolate chips. Cream butter and sugar, add eggs, fold in flour and chips, bake at 375 for 12 minutes."
              </p>
            </div>
          )}

          {/* Big mic button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={!voiceSupported}
            className={`w-[120px] h-[120px] rounded-full mx-auto flex items-center justify-center transition-all ${
              recording
                ? 'bg-red-500 shadow-lg shadow-red-500/30 animate-pulse'
                : 'bg-cb-primary hover:bg-cb-primary/90 shadow-lg shadow-cb-primary/20'
            } disabled:opacity-50`}
          >
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
          </button>
          <p className="text-sm font-medium mt-4 mb-2">{recording ? 'Listening...' : 'Tap to start'}</p>

          {!voiceSupported && (
            <p className="text-xs text-amber-600 mb-4">Use Chrome or Edge for voice recording</p>
          )}

          {/* Live transcript */}
          {transcript && (
            <div className="bg-cb-bg rounded-card p-4 mt-6 text-left min-h-[80px] max-h-[250px] overflow-y-auto text-base leading-relaxed">
              {transcript}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-3 mt-6">
            {recording && (
              <button onClick={stopRecording} className="bg-red-500 text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white" /> Stop
              </button>
            )}
            {!recording && transcript && (
              <>
                <button onClick={() => { setTranscript(''); }} className="border border-cb-border px-5 py-3 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text">Start Over</button>
                <button onClick={() => setStep(2)} className="bg-cb-primary text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90">Next: Review &rarr;</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: Review ── */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-bold mb-1">Review what was captured</h2>
          <p className="text-cb-secondary text-sm mb-4">Fix any mistakes before we generate your recipe.</p>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            className="w-full bg-cb-bg border border-cb-border rounded-card px-4 py-3 text-lg outline-none focus:border-cb-primary leading-relaxed mb-2"
            style={{ fontSize: 18, minHeight: 200 }}
          />
          <p className="text-xs text-cb-secondary mb-6">{transcript.length} characters</p>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="border border-cb-border px-5 py-3 rounded-input text-sm font-medium text-cb-secondary hover:text-cb-text">&larr; Re-record</button>
            <button onClick={() => setTranscript('')} className="text-sm text-cb-secondary hover:text-cb-text px-3">Clear</button>
            <span className="flex-1" />
            <button onClick={generateRecipe} disabled={!transcript.trim()} className="bg-cb-green text-white px-6 py-3 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
              Generate Recipe &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Recipe Result ── */}
      {step === 3 && generating && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg>
          </div>
          <p className="text-lg font-bold mb-2">Your Sous Chef is creating your recipe...</p>
          <p className="text-sm text-cb-secondary">{genStep}</p>
        </div>
      )}

      {step === 3 && !generating && recipe && (
        <RecipeReviewPanel
          recipe={recipe}
          imageUrl={recipeImageUrl}
          source="voice"
          onSave={async (edited, imgUrl) => {
            setSaving(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not signed in');
              const gate = await checkRecipeLimit(user.id);
              if (!gate.allowed) throw new Error(gate.reason!);
              const { recipe: saved } = await createRecipeWithModeration(user.id, { ...edited, image_url: imgUrl || undefined } as any);
              router.push(`/recipe/${saved.id}`);
            } catch (e: any) {
              setError(e.message);
              setSaving(false);
            }
          }}
          onRegenerate={() => { setRecipe(null); generateRecipe(); }}
          onBack={() => setStep(2)}
          saving={saving}
        />
      )}
    </div>
  );
}
