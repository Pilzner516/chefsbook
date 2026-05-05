'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { CookingPlan, ChefSetup, ScheduledStep } from '@chefsbook/ui';

type Screen = 'setup' | 'plan' | 'active' | 'complete';

interface SessionData {
  sessionId: string;
  plan: CookingPlan;
  briefing: string;
}

export default function CookModePage({ params }: { params: Promise<{ recipeId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [screen, setScreen] = useState<Screen>('setup');
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup screen state
  const [serveTime, setServeTime] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));
  const [ovenCount, setOvenCount] = useState<1 | 2>(1);
  const [briefing, setBriefing] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');

  // Session data
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // Active screen state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timer, setTimer] = useState(0); // seconds elapsed
  const [isPaused, setIsPaused] = useState(false);
  const [wasStepPaused, setWasStepPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());

  // Completion state
  const [totalTime, setTotalTime] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(0);

  // Wake Lock API for preventing screen sleep
  useEffect(() => {
    if (screen === 'active' && 'wakeLock' in navigator) {
      let wakeLock: any = null;
      (async () => {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          // Fail silently - wake lock not critical
        }
      })();
      return () => {
        if (wakeLock) {
          wakeLock.release().catch(() => {});
        }
      };
    }
  }, [screen]);

  // Load recipe
  useEffect(() => {
    async function loadRecipe() {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id,
          title,
          image_url,
          recipe_steps (
            id,
            recipe_id,
            step_number,
            instruction,
            duration_min,
            duration_max,
            is_passive,
            uses_oven,
            oven_temp_celsius,
            phase,
            timing_confidence,
            technique,
            ingredient_category
          )
        `)
        .eq('id', resolvedParams.recipeId)
        .single();

      if (error || !data) {
        setError('Recipe not found');
        setLoading(false);
        return;
      }

      setRecipe(data);
      setLoading(false);
    }

    loadRecipe();
  }, [resolvedParams.recipeId]);

  // Typewriter effect for briefing
  useEffect(() => {
    if (!briefing || screen !== 'setup') return;

    let index = 0;
    const interval = setInterval(() => {
      if (index < briefing.length) {
        setTypewriterText(briefing.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 30); // 30ms per character

    return () => clearInterval(interval);
  }, [briefing, screen]);

  // Timer for active screen
  useEffect(() => {
    if (screen === 'active' && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [screen, isPaused]);

  async function handleStartCooking() {
    if (!recipe) return;

    setBriefingLoading(true);

    const setup: ChefSetup = {
      chefs: ['Chef'],
      oven_count: ovenCount,
      service_style: 'plated',
      chefs_eating_at_table: true,
      serve_time: serveTime,
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/cook/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipe_id: resolvedParams.recipeId,
          setup,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data: SessionData = await response.json();
      setSessionData(data);
      setBriefing(data.briefing);
      setBriefingLoading(false);
    } catch (err) {
      setError('Failed to start cooking session');
      setBriefingLoading(false);
    }
  }

  async function handleStepComplete() {
    if (!sessionData) return;

    const actualDurationSeconds = timer;
    const currentStep = sessionData.plan.steps[currentStepIndex];

    if (!currentStep) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/cook/sessions/${sessionData.sessionId}/step-actual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipe_id: currentStep.recipe_id,
          recipe_step_id: currentStep.step.id,
          planned_duration_min: currentStep.step.duration_min,
          planned_duration_max: currentStep.step.duration_max,
          actual_duration_seconds: actualDurationSeconds,
          step_index: currentStepIndex,
          technique: currentStep.step.technique || null,
          ingredient_category: currentStep.step.ingredient_category || null,
          is_passive: currentStep.step.is_passive,
          was_paused: wasStepPaused,
        }),
      });

      // Move to next step or complete
      if (currentStepIndex < sessionData.plan.steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setTimer(0);
        setIsPaused(false);
        setWasStepPaused(false);
        stepStartTimeRef.current = Date.now();
      } else {
        await handleSessionComplete();
      }
    } catch (err) {
      console.error('Failed to record step actual:', err);
      // Continue anyway
      if (currentStepIndex < sessionData.plan.steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
        setTimer(0);
        setIsPaused(false);
        setWasStepPaused(false);
      } else {
        await handleSessionComplete();
      }
    }
  }

  async function handleSessionComplete() {
    if (!sessionData) return;

    const sessionDuration = Math.floor((Date.now() - stepStartTimeRef.current) / 1000);
    setTotalTime(sessionDuration);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setScreen('complete');
        return;
      }

      const response = await fetch(`/api/cook/sessions/${sessionData.sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPointsAwarded(data.pointsAwarded || 0);
      }
    } catch (err) {
      console.error('Failed to complete session:', err);
    }

    setScreen('complete');
  }

  function togglePause() {
    setIsPaused(!isPaused);
    if (!isPaused) {
      setWasStepPaused(true);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cb-cream flex items-center justify-center">
        <div className="text-cb-textPrimary">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cb-cream flex items-center justify-center">
        <div className="text-cb-accent">{error}</div>
      </div>
    );
  }

  if (!recipe) return null;

  // Screen 1: Setup
  if (screen === 'setup') {
    return (
      <div className="min-h-screen bg-cb-cream p-8">
        <div className="max-w-2xl mx-auto">
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-32 h-32 object-cover rounded-lg mb-6"
            />
          )}

          <h1 className="text-3xl font-bold text-cb-textPrimary mb-6">{recipe.title}</h1>

          {/* Briefing */}
          {briefing && (
            <div className="bg-white rounded-lg p-6 mb-6 min-h-[120px]">
              <p className="text-cb-textPrimary leading-relaxed">{typewriterText}</p>
            </div>
          )}

          {briefingLoading && (
            <div className="bg-white rounded-lg p-6 mb-6">
              <div className="animate-pulse h-4 bg-gray-200 rounded mb-2"></div>
              <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          )}

          {/* Serve Time */}
          <div className="mb-6">
            <label className="block text-cb-textPrimary font-semibold mb-2">
              When do you want to eat?
            </label>
            <input
              type="time"
              value={serveTime.toTimeString().slice(0, 5)}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(':');
                const newTime = new Date();
                newTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                setServeTime(newTime);
              }}
              className="w-full p-3 rounded-lg border border-gray-300"
            />
          </div>

          {/* Oven Count */}
          <div className="mb-8">
            <label className="block text-cb-textPrimary font-semibold mb-2">
              How many ovens do you have?
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setOvenCount(1)}
                className={`flex-1 p-4 rounded-lg font-semibold ${
                  ovenCount === 1
                    ? 'bg-cb-accent text-white'
                    : 'bg-white text-cb-textPrimary border border-gray-300'
                }`}
              >
                1 Oven
              </button>
              <button
                onClick={() => setOvenCount(2)}
                className={`flex-1 p-4 rounded-lg font-semibold ${
                  ovenCount === 2
                    ? 'bg-cb-accent text-white'
                    : 'bg-white text-cb-textPrimary border border-gray-300'
                }`}
              >
                2 Ovens
              </button>
            </div>
          </div>

          {/* Start Button */}
          {!briefing ? (
            <button
              onClick={handleStartCooking}
              disabled={briefingLoading}
              className="w-full bg-cb-accent text-white py-4 rounded-lg font-bold text-lg hover:opacity-90 disabled:opacity-50"
            >
              {briefingLoading ? 'Preparing...' : 'Start Cooking →'}
            </button>
          ) : (
            <button
              onClick={() => setScreen('plan')}
              className="w-full bg-cb-accent text-white py-4 rounded-lg font-bold text-lg hover:opacity-90"
            >
              View Plan →
            </button>
          )}
        </div>
      </div>
    );
  }

  // Screen 2: Plan
  if (screen === 'plan' && sessionData) {
    return (
      <div className="min-h-screen bg-cb-cream p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-cb-textPrimary mb-6">Your Cooking Plan</h1>

          {sessionData.plan.warnings.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              {sessionData.plan.warnings.map((w, i) => (
                <p key={i} className="text-yellow-800">{w.message}</p>
              ))}
            </div>
          )}

          <div className="space-y-3 mb-8">
            {sessionData.plan.steps.map((step, index) => (
              <div
                key={step.step.id}
                className={`bg-white rounded-lg p-4 ${
                  step.is_critical_path ? 'border-l-4 border-cb-accent' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-16 text-sm text-cb-textSecondary">
                    {step.planned_start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        step.step.phase === 'prep' ? 'bg-blue-100 text-blue-800' :
                        step.step.phase === 'cook' ? 'bg-orange-100 text-orange-800' :
                        step.step.phase === 'rest' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {step.step.phase}
                      </span>
                      {step.step.is_passive && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                          passive
                        </span>
                      )}
                      {step.parallel_with.length > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                          ⚡ parallel
                        </span>
                      )}
                    </div>
                    <p className="text-cb-textPrimary">
                      {step.step.instruction.length > 100
                        ? step.step.instruction.slice(0, 100) + '...'
                        : step.step.instruction}
                    </p>
                    {step.step.duration_max && (
                      <p className="text-sm text-cb-textSecondary mt-1">
                        ~{step.step.duration_max} minutes
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setScreen('active');
              stepStartTimeRef.current = Date.now();
            }}
            className="w-full bg-cb-accent text-white py-4 rounded-lg font-bold text-lg hover:opacity-90"
          >
            Let's Go →
          </button>
        </div>
      </div>
    );
  }

  // Screen 3: Active
  if (screen === 'active' && sessionData) {
    const currentStep = sessionData.plan.steps[currentStepIndex];
    if (!currentStep) return null;

    const maxDuration = currentStep.step.duration_max || 5;
    const maxSeconds = maxDuration * 60;
    const remaining = Math.max(0, maxSeconds - timer);
    const isOvertime = timer > maxSeconds;
    const progress = Math.min(100, (timer / maxSeconds) * 100);

    return (
      <div className="min-h-screen bg-cb-cream flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <button
            onClick={() => router.back()}
            className="text-cb-textSecondary hover:text-cb-textPrimary"
          >
            Exit
          </button>
          <div className="text-cb-textSecondary">
            Step {currentStepIndex + 1} of {sessionData.plan.steps.length}
          </div>
          <button
            onClick={togglePause}
            className="text-cb-textSecondary hover:text-cb-textPrimary"
          >
            {isPaused ? 'Resume' : '⏸ Pause'}
          </button>
        </div>

        {/* Step Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-2xl w-full text-center">
            <p className="text-2xl md:text-3xl text-cb-textPrimary mb-12 leading-relaxed">
              {currentStep.step.instruction}
            </p>

            <div className={`text-6xl md:text-7xl font-bold mb-6 ${
              isOvertime ? 'text-cb-accent animate-pulse' : 'text-cb-textPrimary'
            }`}>
              {isOvertime ? '+' : ''}{formatTime(isOvertime ? timer - maxSeconds : remaining)}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-8">
              <div
                className={`h-3 rounded-full transition-all ${
                  isOvertime ? 'bg-cb-accent' : 'bg-cb-accentGreen'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-center gap-4 text-sm text-cb-textSecondary mb-8">
              <span>Phase: {currentStep.step.phase}</span>
              {currentStep.step.technique && <span>• {currentStep.step.technique}</span>}
              {currentStep.step.ingredient_category && <span>• {currentStep.step.ingredient_category}</span>}
            </div>

            {currentStep.step.is_passive && (
              <p className="text-cb-textSecondary mb-8">
                This step runs in the background
              </p>
            )}

            {currentStep.parallel_with.length > 0 && (
              <p className="text-cb-textSecondary mb-8">
                ⚡ Parallel — you can do this while other steps run
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={() => {
              if (currentStepIndex > 0) {
                setCurrentStepIndex(currentStepIndex - 1);
                setTimer(0);
                setIsPaused(false);
                setWasStepPaused(false);
              }
            }}
            disabled={currentStepIndex === 0}
            className="text-cb-textSecondary hover:text-cb-textPrimary disabled:opacity-50"
          >
            ← Previous
          </button>

          <button
            onClick={handleStepComplete}
            className="bg-cb-accent text-white px-8 py-3 rounded-lg font-bold hover:opacity-90"
          >
            Done — Next Step →
          </button>
        </div>
      </div>
    );
  }

  // Screen 4: Complete
  if (screen === 'complete' && recipe) {
    return (
      <div className="min-h-screen bg-cb-cream flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center">
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-64 h-64 object-cover rounded-lg mx-auto mb-8"
            />
          )}

          <h1 className="text-4xl font-bold text-cb-textPrimary mb-4">
            You cooked {recipe.title}!
          </h1>

          {totalTime > 0 && (
            <p className="text-xl text-cb-textSecondary mb-4">
              Time taken: {Math.floor(totalTime / 60)} minutes
            </p>
          )}

          {pointsAwarded > 0 && (
            <div className="bg-cb-accentGreen text-white px-6 py-3 rounded-lg inline-block mb-8">
              +{pointsAwarded} points earned!
            </div>
          )}

          <button
            onClick={() => router.push(`/recipe/${recipe.id}`)}
            className="bg-cb-accent text-white px-8 py-4 rounded-lg font-bold text-lg hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
