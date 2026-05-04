import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../context/ThemeContext';
import {
  getCookingSession,
  updateCookingSession,
  persistRecomputedPlan,
  subscribeToCookingSession,
} from '@chefsbook/db';
import { recomputeFromOverrun, buildStepCallout } from '@chefsbook/ui';
import type { CookingSession, ScheduledStep } from '@chefsbook/ui';
import { formatCountdown } from '../../../lib/timers';

// ---- helpers ----------------------------------------------------------------

function minutesBetween(a: Date | null, b: Date): number {
  if (!a) return 0;
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function timerSecondsForStep(step: ScheduledStep): number {
  const dur = step.step.duration_max;
  if (!dur) return 0;
  return dur * 60;
}

// ---- component --------------------------------------------------------------

export default function ActiveCookingScreen() {
  useKeepAwake();

  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [session, setSession] = useState<CookingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // countdown state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const stepStartRef = useRef<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load session on mount
  useEffect(() => {
    let cancelled = false;
    getCookingSession(sessionId).then((s) => {
      if (cancelled) return;
      setSession(s);
      setLoading(false);
      if (s) resetTimerForIndex(s, s.current_step_index);
    });
    return () => { cancelled = true; };
  }, [sessionId]);

  // Subscribe to realtime updates (multi-device sync)
  useEffect(() => {
    if (!sessionId) return;
    const channel = subscribeToCookingSession(sessionId, (updated) => {
      setSession((prev) => {
        if (!prev) return updated;
        if (updated.version > prev.version) {
          showToast('Another device updated');
          resetTimerForIndex(updated, updated.current_step_index);
          return updated;
        }
        return prev;
      });
    });
    return () => { channel.unsubscribe(); };
  }, [sessionId]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            setTimerRunning(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const resetTimerForIndex = (s: CookingSession, index: number) => {
    const step = s.plan.steps[index];
    if (!step) return;
    const secs = timerSecondsForStep(step);
    setTimerSeconds(secs);
    setTimerRunning(false);
    stepStartRef.current = new Date();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const speakStep = (step: ScheduledStep) => {
    try {
      const Speech = require('expo-speech');
      Speech.stop();
      const callout = buildStepCallout(step, step.chef_name);
      Speech.speak(callout, { language: 'en' });
    } catch {
      // ignore TTS errors
    }
  };

  const handleStepComplete = useCallback(async () => {
    if (!session) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const now = new Date();
    const currentStep = session.plan.steps[session.current_step_index];
    if (!currentStep) return;

    // Stop timer
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);

    // Build actuals record
    const overrunMinutes = currentStep.planned_end
      ? Math.max(0, minutesBetween(currentStep.planned_end, now))
      : 0;

    const newActuals = [
      ...(session.step_actuals ?? []),
      {
        step_id: currentStep.step.id,
        actual_start: stepStartRef.current?.toISOString() ?? now.toISOString(),
        actual_end: now.toISOString(),
        overrun_minutes: overrunMinutes,
      },
    ];

    // Recompute plan if overrun > 2 min
    let updatedPlan = session.plan;
    if (overrunMinutes > 2) {
      updatedPlan = recomputeFromOverrun(session.plan, currentStep.step.id, now);
      const persisted = await persistRecomputedPlan(session.id, updatedPlan, session.version);
      if (!persisted) {
        // Version conflict — refetch
        const fresh = await getCookingSession(session.id);
        if (fresh) {
          setSession(fresh);
          showToast('Another device updated');
          return;
        }
      }
    }

    const nextIndex = session.current_step_index + 1;
    const isComplete = nextIndex >= session.plan.steps.length;

    const { success, session: updated } = await updateCookingSession(
      session.id,
      {
        current_step_index: nextIndex,
        step_actuals: newActuals,
        plan: updatedPlan,
        status: isComplete ? 'complete' : 'cooking',
        completed_at: isComplete ? now.toISOString() : undefined,
      },
      session.version
    );

    if (!success || !updated) {
      // Version conflict — refetch
      const fresh = await getCookingSession(session.id);
      if (fresh) {
        setSession(fresh);
        showToast('Another device updated');
        resetTimerForIndex(fresh, fresh.current_step_index);
      }
      return;
    }

    if (isComplete) {
      router.replace(`/cook-menu/${id}` as any);
      return;
    }

    setSession(updated);
    resetTimerForIndex(updated, nextIndex);

    // Speak the next step
    const nextStep = updated.plan.steps[nextIndex];
    if (nextStep) speakStep(nextStep);
  }, [session, id, router]);

  // ---- render ----------------------------------------------------------------

  if (loading || !session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  const steps = session.plan.steps;
  const currentIndex = session.current_step_index;
  const currentStep = steps[currentIndex];

  if (!currentStep) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.accentGreen, textAlign: 'center', marginBottom: 8 }}>
          Service complete!
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 32 }}>
          All steps done. Enjoy your meal.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(`/cook-menu/${id}` as any)}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.accent,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Back to menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextStep = steps[currentIndex + 1] ?? null;

  // Parallel steps being worked on by other chefs at the same time
  const parallelSteps = currentStep.parallel_with
    .map((pid) => steps.find((s) => s.step.id === pid))
    .filter((s): s is ScheduledStep => !!s && s.chef_name !== currentStep.chef_name);

  const hasTimer = timerSeconds > 0;
  const timerDone = hasTimer && timerSeconds === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* Toast */}
      {!!toast && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 20,
            right: 20,
            zIndex: 100,
            backgroundColor: '#1f2937',
            borderRadius: 10,
            padding: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#f9fafb', fontSize: 14 }}>{toast}</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Chef + recipe context */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '600', letterSpacing: 0.5 }}>
            {currentStep.chef_name.toUpperCase()} • {currentStep.recipe_title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            Step {currentStep.step.step_number} of {steps.length}
          </Text>
        </View>

        {/* Main step card */}
        <View
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: 18,
            padding: 24,
            borderWidth: 1,
            borderColor: currentStep.is_critical_path ? colors.accent : colors.borderDefault,
            marginBottom: 16,
          }}
        >
          {currentStep.is_critical_path && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: colors.accentSoft,
                borderRadius: 8,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>CRITICAL PATH</Text>
            </View>
          )}

          <Text style={{ fontSize: 22, color: colors.textPrimary, lineHeight: 34, fontWeight: '400' }}>
            {currentStep.step.instruction}
          </Text>
        </View>

        {/* Countdown timer */}
        {hasTimer && (
          <View
            style={{
              backgroundColor: timerDone ? colors.accentGreenSoft : colors.bgCard,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: timerDone ? colors.accentGreen : timerRunning ? colors.accent : colors.borderDefault,
              padding: 20,
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 56,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: timerDone ? colors.accentGreen : timerRunning ? colors.accent : colors.textPrimary,
              }}
            >
              {formatCountdown(timerSeconds)}
            </Text>
            {!timerDone && (
              <TouchableOpacity
                onPress={() => setTimerRunning((r) => !r)}
                style={{
                  marginTop: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: timerRunning ? colors.bgBase : colors.accent,
                  borderWidth: timerRunning ? 1 : 0,
                  borderColor: colors.borderDefault,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: timerRunning ? colors.textPrimary : '#fff',
                  }}
                >
                  {timerRunning ? 'Pause' : 'Start timer'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Parallel activities */}
        {parallelSteps.length > 0 && (
          <View
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, letterSpacing: 0.5 }}>
              HAPPENING IN PARALLEL
            </Text>
            {parallelSteps.map((ps) => (
              <View key={ps.step.id} style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{ps.chef_name}: </Text>
                  {ps.step.instruction.length > 80
                    ? ps.step.instruction.slice(0, 80) + '...'
                    : ps.step.instruction}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Next step preview */}
        {nextStep && (
          <View
            style={{
              backgroundColor: colors.bgBase,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.5 }}>
              UP NEXT — {nextStep.chef_name.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>
              {nextStep.step.instruction.length > 100
                ? nextStep.step.instruction.slice(0, 100) + '...'
                : nextStep.step.instruction}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Done, Chef button */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: colors.bgCard,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}
      >
        <TouchableOpacity
          onPress={handleStepComplete}
          activeOpacity={0.85}
          style={{
            height: 64,
            borderRadius: 16,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>
            Done, Chef
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
