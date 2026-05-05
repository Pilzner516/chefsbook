'use client';

import { use, useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getCookingSession,
  updateCookingSession,
  persistRecomputedPlan,
  subscribeToCookingSession,
} from '@chefsbook/db';
import { recomputeFromOverrun, buildStepCallout } from '@chefsbook/ui';
import type { CookingSession, ScheduledStep } from '@chefsbook/ui';

// ---------------------------------------------------------------------------
// Speech helper
// ---------------------------------------------------------------------------
function speakText(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 1.0;
  window.speechSynthesis.speak(utt);
}

// ---------------------------------------------------------------------------
// Timer component — counts down from durationMs, shows MM:SS
// ---------------------------------------------------------------------------
function CountdownTimer({ durationMs, onExpire }: { durationMs: number; onExpire?: () => void }) {
  const [remaining, setRemaining] = useState(durationMs);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setRemaining(durationMs);
    if (durationMs <= 0) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [durationMs]);

  const totalSec = Math.max(0, Math.round(remaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const isWarning = remaining <= 60_000 && remaining > 0;
  const isExpired = remaining <= 0;

  return (
    <span
      className={`font-mono text-5xl font-bold tabular-nums transition-colors ${
        isExpired
          ? 'text-cb-primary'
          : isWarning
          ? 'text-amber-400'
          : 'text-white'
      }`}
    >
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main active view content
// ---------------------------------------------------------------------------
function ActiveCookingContent({ menuId }: { menuId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  // All session state lives here — no external store needed since this is a
  // single focused client page with no SSR concerns.
  const [session, setSession] = useState<CookingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Wake lock ref
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Step start timestamp (for overrun calculation)
  const stepStartRef = useRef<Date>(new Date());

  // ---------------------------------------------------------------------------
  // Load session on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID. Please go back and set up again.');
      setLoading(false);
      return;
    }

    getCookingSession(sessionId).then((s) => {
      if (!s) {
        setError('Session not found.');
      } else {
        setSession(s);
        stepStartRef.current = new Date();
        // Speak first step callout
        const firstStep = s.plan.steps[s.current_step_index ?? 0];
        if (firstStep) {
          const chefName = firstStep.chef_name;
          const callout = buildStepCallout(firstStep, chefName);
          setTimeout(() => speakText(callout), 600);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to load cooking session:', err);
      setError('Failed to load session.');
      setLoading(false);
    });
  }, [sessionId]);

  // ---------------------------------------------------------------------------
  // Wake lock
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!session) return;
    const acquire = async () => {
      try {
        if (navigator.wakeLock) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Wake lock not supported or denied — non-fatal
      }
    };
    acquire();

    return () => {
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [!!session]);

  // ---------------------------------------------------------------------------
  // Real-time subscription for multi-device sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId || !session) return;

    const subscription = subscribeToCookingSession(sessionId, (updated) => {
      setSession(updated);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [sessionId, !!session]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const currentIndex = session?.current_step_index ?? 0;
  const steps = session?.plan?.steps ?? [];
  const currentStep: ScheduledStep | undefined = steps[currentIndex];
  const nextStep: ScheduledStep | undefined = steps[currentIndex + 1];

  // Other chefs' steps that overlap with the current step
  const parallelSteps = currentStep
    ? steps.filter(
        (s) =>
          s.step.id !== currentStep.step.id &&
          currentStep.parallel_with.includes(s.step.id)
      )
    : [];

  // Timer duration from step timing
  const timerMs = currentStep?.step.duration_max
    ? currentStep.step.duration_max * 60 * 1000
    : 0;

  // ---------------------------------------------------------------------------
  // handleStepComplete
  // ---------------------------------------------------------------------------
  const handleStepComplete = async () => {
    if (!session || !currentStep || completing) return;
    setCompleting(true);

    try {

    const actualEnd = new Date();
    const plannedEnd = currentStep.planned_end;
    const overrunMinutes = plannedEnd
      ? Math.max(0, (actualEnd.getTime() - plannedEnd.getTime()) / 60_000)
      : 0;

    // 1. Record actual in step_actuals
    const newActual = {
      step_id: currentStep.step.id,
      actual_start: stepStartRef.current.toISOString(),
      actual_end: actualEnd.toISOString(),
      overrun_minutes: overrunMinutes,
    };
    const updatedActuals = [...(session.step_actuals ?? []), newActual];

    const isLastStep = currentIndex >= steps.length - 1;
    const nextIndex = currentIndex + 1;

    // 2. Recompute plan if overrun > 2 min
    let updatedPlan = session.plan;
    if (overrunMinutes > 2) {
      updatedPlan = recomputeFromOverrun(session.plan, currentStep.step.id, actualEnd);
      const persistSuccess = await persistRecomputedPlan(session.id, updatedPlan, session.version);

      if (!persistSuccess) {
        // Version conflict during plan persist — refetch and let user retry
        const fresh = await getCookingSession(session.id);
        if (fresh) {
          setSession(fresh);
          stepStartRef.current = new Date();
        }
        alert('Another device updated the session. Please try again.');
        return;
      }
    }

    // 3. Update session: advance step index and record actuals
    const newStatus = isLastStep ? 'complete' : session.status;
    const result = await updateCookingSession(
      session.id,
      {
        current_step_index: isLastStep ? currentIndex : nextIndex,
        step_actuals: updatedActuals,
        status: newStatus,
        plan: updatedPlan,
        ...(isLastStep ? { completed_at: new Date().toISOString() } : {}),
      },
      session.version
    );

    if (!result.success || !result.session) {
      // Version conflict — refetch fresh session and let user retry
      const fresh = await getCookingSession(session.id);
      if (fresh) {
        setSession(fresh);
        stepStartRef.current = new Date();
      }
      alert('Another device updated the session. Please try again.');
      return;
    }

    // Success! Update local state
    setSession(result.session);
    stepStartRef.current = new Date();

    if (isLastStep) {
      window.speechSynthesis?.cancel();
      router.push(`/dashboard/menus/${menuId}?cooked=1`);
      return;
    }

    // 4. Speak next step
    const nextStep = result.session.plan.steps[nextIndex];
    if (nextStep) {
      const callout = buildStepCallout(nextStep, nextStep.chef_name);
      speakText(callout);
    }
    } catch (err) {
      console.error('handleStepComplete failed:', err);
      alert('Failed to advance step. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-red-400 mb-6">{error ?? 'Session unavailable.'}</p>
        <button
          onClick={() => router.push(`/dashboard/menus/${menuId}/cook`)}
          className="px-6 py-3 border border-white/30 text-white rounded-input hover:bg-white/10 transition text-sm"
        >
          Back to Setup
        </button>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🍽</div>
        <p className="text-white text-2xl font-bold mb-2">All done!</p>
        <p className="text-white/60 text-sm mb-8">Service complete. Enjoy the meal.</p>
        <button
          onClick={() => router.push(`/dashboard/menus/${menuId}`)}
          className="px-8 py-3 bg-cb-green text-white rounded-input font-semibold hover:opacity-90 transition"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] flex flex-col">
      {/* Chef name + context */}
      <div className="px-6 pt-8 pb-2">
        <p className="text-white/50 text-sm font-medium tracking-wide uppercase">
          {currentStep.chef_name} — now
        </p>
        <p className="text-white/40 text-xs mt-0.5">
          Step {currentIndex + 1} of {steps.length} · {currentStep.recipe_title}
        </p>
      </div>

      {/* Main instruction card */}
      <div className="flex-1 flex flex-col px-6 py-4">
        <div className="bg-white/5 border border-white/10 rounded-card p-6 flex-1 flex flex-col">
          {/* Instruction */}
          <p className="text-white text-2xl font-semibold leading-snug">
            {currentStep.step.instruction}
          </p>

          {/* Sub-hint: passive / oven */}
          {(currentStep.step.is_passive || currentStep.step.uses_oven) && (
            <p className="mt-3 text-white/50 text-sm">
              {currentStep.step.is_passive
                ? 'Passive — keep going with other tasks.'
                : currentStep.step.oven_temp_celsius
                ? `Oven at ${currentStep.step.oven_temp_celsius}°C.`
                : 'Uses oven.'}
            </p>
          )}

          {/* Timer */}
          {timerMs > 0 && (
            <div className="mt-6 flex items-center justify-center">
              <CountdownTimer
                durationMs={timerMs}
                onExpire={() => speakText(`${currentStep.chef_name}: time's up.`)}
              />
            </div>
          )}
        </div>

        {/* Done, Chef button */}
        <button
          onClick={handleStepComplete}
          disabled={completing}
          className="w-full mt-4 py-5 bg-cb-primary text-white rounded-card text-xl font-bold hover:opacity-90 transition disabled:opacity-40"
        >
          {completing ? 'Recording...' : 'Done, Chef'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs">coming up</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Up next */}
        {nextStep ? (
          <div className="bg-white/5 rounded-input px-4 py-3">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-1">
              Up next · {nextStep.chef_name}
            </p>
            <p className="text-white/70 text-sm leading-snug line-clamp-2">
              {nextStep.step.instruction}
            </p>
          </div>
        ) : (
          <div className="bg-white/5 rounded-input px-4 py-3">
            <p className="text-white/40 text-xs">This is the final step.</p>
          </div>
        )}

        {/* Parallel steps for other chefs */}
        {parallelSteps.length > 0 && (
          <div className="mt-3 space-y-2">
            {parallelSteps.map((ps) => (
              <div key={ps.step.id} className="bg-white/5 rounded-input px-4 py-3">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-1">
                  Parallel · {ps.chef_name}
                </p>
                <p className="text-white/60 text-sm line-clamp-1">
                  {ps.step.instruction}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom safe area padding */}
      <div className="h-6" />
    </div>
  );
}

export default function ActiveCookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: menuId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#111] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <ActiveCookingContent menuId={menuId} />
    </Suspense>
  );
}
