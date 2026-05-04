'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  supabase,
  getMenuWithSteps,
  createCookingSession,
} from '@chefsbook/db';
import { createCookingPlan } from '@chefsbook/ui';
import type { ChefSetup } from '@chefsbook/ui';

type Step = 1 | 2 | 3 | 4;
type OvenCount = 0 | 1 | 2;
type ServiceStyle = 'plated' | 'buffet';

const STEP_LABELS = ['Who\'s cooking', 'Ovens', 'Serving style', 'Serve time'];

export default function CookSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: menuId } = use(params);
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [chefs, setChefs] = useState<string[]>([]);
  const [chefInput, setChefInput] = useState('');
  const [ovenCount, setOvenCount] = useState<OvenCount>(1);
  const [serviceStyle, setServiceStyle] = useState<ServiceStyle>('plated');
  const [eatingAtTable, setEatingAtTable] = useState(true);
  const [serveTime, setServeTime] = useState('');
  const [earliestStart, setEarliestStart] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recompute earliest start hint whenever serve time or chefs change
  useEffect(() => {
    if (!serveTime || chefs.length === 0) {
      setEarliestStart(null);
      return;
    }
    // Build a rough "start by" hint using serve time minus 2 hours as estimate
    const [hh, mm] = serveTime.split(':').map(Number);
    const now = new Date();
    const serve = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh!, mm!);
    const startBy = new Date(serve.getTime() - 2 * 60 * 60 * 1000);
    setEarliestStart(
      startBy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }, [serveTime, chefs]);

  const addChef = () => {
    const name = chefInput.trim();
    if (!name || chefs.includes(name)) return;
    setChefs((prev) => [...prev, name]);
    setChefInput('');
  };

  const removeChef = (name: string) => {
    setChefs((prev) => prev.filter((c) => c !== name));
  };

  const canProceed = (): boolean => {
    if (step === 1) return chefs.length >= 1;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return true;
    return false;
  };

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const handleMeetChef = async () => {
    setCreating(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Not signed in.');
        setCreating(false);
        return;
      }

      const menu = await getMenuWithSteps(menuId);

      let serveDate: Date | null = null;
      if (serveTime) {
        const [hh, mm] = serveTime.split(':').map(Number);
        const now = new Date();
        serveDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh!, mm!);
      }

      const setup: ChefSetup = {
        chefs,
        oven_count: ovenCount,
        service_style: serviceStyle,
        chefs_eating_at_table: eatingAtTable,
        serve_time: serveDate,
      };

      const plan = createCookingPlan(menu as any, setup);
      const cookingSession = await createCookingSession(
        menuId,
        session.user.id,
        setup,
        plan
      );

      router.push(`/dashboard/menus/${menuId}/cook/briefing?session=${cookingSession.id}`);
    } catch (err) {
      console.error('Failed to create cooking session:', err);
      setError('Something went wrong. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative bg-cb-card rounded-card shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <button
              key={s}
              onClick={() => s < step && setStep(s)}
              className={`rounded-full transition-all ${
                s === step
                  ? 'w-6 h-2.5 bg-cb-primary'
                  : s < step
                  ? 'w-2.5 h-2.5 bg-cb-primary opacity-50 cursor-pointer'
                  : 'w-2.5 h-2.5 bg-cb-border'
              }`}
              aria-label={`Step ${s}: ${STEP_LABELS[s - 1]}`}
            />
          ))}
        </div>

        {/* Step label */}
        <p className="text-center text-xs font-medium text-cb-muted mt-1 mb-4">
          Step {step} of 4 — {STEP_LABELS[step - 1]}
        </p>

        {/* Content */}
        <div className="px-6 pb-6 flex-1">
          {step === 1 && (
            <StepWhosCooking
              chefs={chefs}
              chefInput={chefInput}
              setChefInput={setChefInput}
              addChef={addChef}
              removeChef={removeChef}
            />
          )}
          {step === 2 && (
            <StepOvens ovenCount={ovenCount} setOvenCount={setOvenCount} />
          )}
          {step === 3 && (
            <StepServingStyle
              serviceStyle={serviceStyle}
              setServiceStyle={setServiceStyle}
              eatingAtTable={eatingAtTable}
              setEatingAtTable={setEatingAtTable}
            />
          )}
          {step === 4 && (
            <StepServeTime
              serveTime={serveTime}
              setServeTime={setServeTime}
              earliestStart={earliestStart}
            />
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 py-3 border border-cb-border rounded-input text-sm font-medium text-cb-secondary hover:bg-cb-bg transition"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 py-3 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleMeetChef}
                disabled={creating}
                className="flex-1 py-3 bg-cb-primary text-white rounded-input text-base font-bold hover:opacity-90 transition disabled:opacity-40"
              >
                {creating ? 'Setting up...' : 'Meet Chef'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step sub-components
// ---------------------------------------------------------------------------

function StepWhosCooking({
  chefs,
  chefInput,
  setChefInput,
  addChef,
  removeChef,
}: {
  chefs: string[];
  chefInput: string;
  setChefInput: (v: string) => void;
  addChef: () => void;
  removeChef: (name: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-cb-text mb-1">Who's cooking tonight?</h2>
      <p className="text-sm text-cb-secondary mb-5">Add the name of each person in the kitchen.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={chefInput}
          onChange={(e) => setChefInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addChef()}
          placeholder="Chef name..."
          className="flex-1 border border-cb-border rounded-input px-3 py-2 text-sm focus:outline-none focus:border-cb-primary"
          maxLength={30}
        />
        <button
          onClick={addChef}
          disabled={!chefInput.trim()}
          className="px-4 py-2 bg-cb-primary text-white rounded-input text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {chefs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chefs.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cb-primary-soft text-cb-primary rounded-full text-sm font-medium"
            >
              {name}
              <button
                onClick={() => removeChef(name)}
                className="text-cb-primary/60 hover:text-cb-primary transition"
                aria-label={`Remove ${name}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {chefs.length === 0 && (
        <p className="text-sm text-cb-muted italic">At least one chef required.</p>
      )}
    </div>
  );
}

function StepOvens({
  ovenCount,
  setOvenCount,
}: {
  ovenCount: OvenCount;
  setOvenCount: (v: OvenCount) => void;
}) {
  const options: { value: OvenCount; label: string }[] = [
    { value: 1, label: '1 oven' },
    { value: 2, label: '2 ovens' },
    { value: 0, label: 'None needed' },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-cb-text mb-1">Ovens available</h2>
      <p className="text-sm text-cb-secondary mb-5">This helps avoid oven conflicts in the schedule.</p>

      <div className="flex rounded-input border border-cb-border overflow-hidden">
        {options.map((opt, i) => (
          <button
            key={opt.value}
            onClick={() => setOvenCount(opt.value)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              i < options.length - 1 ? 'border-r border-cb-border' : ''
            } ${
              ovenCount === opt.value
                ? 'bg-cb-primary text-white'
                : 'bg-cb-card text-cb-secondary hover:bg-cb-bg'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepServingStyle({
  serviceStyle,
  setServiceStyle,
  eatingAtTable,
  setEatingAtTable,
}: {
  serviceStyle: ServiceStyle;
  setServiceStyle: (v: ServiceStyle) => void;
  eatingAtTable: boolean;
  setEatingAtTable: (v: boolean) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-cb-text mb-1">Serving style</h2>
      <p className="text-sm text-cb-secondary mb-5">This affects how courses are timed.</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {(['plated', 'buffet'] as ServiceStyle[]).map((style) => (
          <button
            key={style}
            onClick={() => setServiceStyle(style)}
            className={`py-8 rounded-card border-2 flex flex-col items-center gap-2 transition ${
              serviceStyle === style
                ? 'border-cb-primary bg-cb-primary-soft'
                : 'border-cb-border bg-cb-card hover:border-cb-primary/40'
            }`}
          >
            <span className="text-3xl">{style === 'plated' ? '🍽' : '🥘'}</span>
            <span className={`text-sm font-semibold capitalize ${serviceStyle === style ? 'text-cb-primary' : 'text-cb-text'}`}>
              {style}
            </span>
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setEatingAtTable(!eatingAtTable)}
          className={`relative w-11 h-6 rounded-full transition-colors ${eatingAtTable ? 'bg-cb-primary' : 'bg-cb-border'}`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${eatingAtTable ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </div>
        <span className="text-sm font-medium text-cb-text">Eating at table?</span>
      </label>
    </div>
  );
}

function StepServeTime({
  serveTime,
  setServeTime,
  earliestStart,
}: {
  serveTime: string;
  setServeTime: (v: string) => void;
  earliestStart: string | null;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-cb-text mb-1">When do you want to serve?</h2>
      <p className="text-sm text-cb-secondary mb-5">The schedule works backwards from your serve time.</p>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="time"
          value={serveTime}
          onChange={(e) => setServeTime(e.target.value)}
          className="border border-cb-border rounded-input px-3 py-2 text-base font-medium w-36 focus:outline-none focus:border-cb-primary"
        />
        {serveTime && (
          <button
            onClick={() => setServeTime('')}
            className="text-sm text-cb-secondary hover:text-cb-primary transition"
          >
            Clear
          </button>
        )}
      </div>

      {earliestStart && (
        <div className="flex items-center gap-2 p-3 bg-cb-base border border-cb-border rounded-input">
          <svg className="w-4 h-4 text-cb-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-sm text-cb-secondary">
            Start by <span className="font-semibold text-cb-text">{earliestStart}</span>
          </span>
        </div>
      )}

      {!serveTime && (
        <p className="text-sm text-cb-muted italic">Optional — you can skip this and start now.</p>
      )}
    </div>
  );
}
