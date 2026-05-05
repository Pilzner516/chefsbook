import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '@chefsbook/db';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import type { CookingPlan, ChefSetup, ScheduledStep } from '@chefsbook/ui';

type Screen = 'setup' | 'plan' | 'active' | 'complete';

interface SessionData {
  sessionId: string;
  plan: CookingPlan;
  briefing: string;
}

export default function CookMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [screen, setScreen] = useState<Screen>('setup');
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Setup state
  const [serveTime, setServeTime] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [ovenCount, setOvenCount] = useState<1 | 2>(1);
  const [briefing, setBriefing] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');

  // Session data
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // Active state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [wasStepPaused, setWasStepPaused] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepStartTimeRef = useRef<number>(Date.now());

  // Completion state
  const [totalTime, setTotalTime] = useState(0);
  const [pointsAwarded, setPointsAwarded] = useState(0);

  // Keep screen awake during active cooking
  useEffect(() => {
    if (screen === 'active') {
      activateKeepAwake();
      return () => {
        deactivateKeepAwake();
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
          is_complete,
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
        .eq('id', id)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Recipe not found');
        router.back();
        return;
      }

      setRecipe(data);
      setLoading(false);
    }

    loadRecipe();
  }, [id]);

  // Typewriter effect
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
    }, 30);

    return () => clearInterval(interval);
  }, [briefing, screen]);

  // Timer
  useEffect(() => {
    if (screen === 'active' && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000) as unknown as NodeJS.Timeout;
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

  // TTS for step navigation
  useEffect(() => {
    if (screen === 'active' && ttsEnabled && sessionData) {
      const currentStep = sessionData.plan.steps[currentStepIndex];
      if (currentStep) {
        Speech.speak(currentStep.step.instruction, { language: 'en' });
      }
    }

    return () => {
      Speech.stop();
    };
  }, [currentStepIndex, screen, ttsEnabled]);

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
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(':8000', ':3000')}/api/cook/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipe_id: id,
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
      Alert.alert('Error', 'Failed to start cooking session');
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

      const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(':8000', ':3000');
      await fetch(`${apiUrl}/api/cook/sessions/${sessionData.sessionId}/step-actual`, {
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

      const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(':8000', ':3000');
      const response = await fetch(`${apiUrl}/api/cook/sessions/${sessionData.sessionId}/complete`, {
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
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textPrimary }}>Loading...</Text>
      </View>
    );
  }

  if (!recipe) return null;

  // Screen 1: Setup
  if (screen === 'setup') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bgScreen }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
          {recipe.title}
        </Text>

        {briefing && (
          <View style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 16, minHeight: 100 }}>
            <Text style={{ color: colors.textPrimary, lineHeight: 24 }}>{typewriterText}</Text>
          </View>
        )}

        {briefingLoading && (
          <View style={{ backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: colors.textSecondary }}>Preparing briefing...</Text>
          </View>
        )}

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
            When do you want to eat?
          </Text>
          <TextInput
            value={serveTime.toTimeString().slice(0, 5)}
            onChangeText={(text) => {
              const [hours, minutes] = text.split(':');
              if (hours && minutes) {
                const newTime = new Date();
                newTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                setServeTime(newTime);
              }
            }}
            placeholder="HH:MM"
            style={{
              backgroundColor: colors.bgCard,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: colors.textPrimary,
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
            How many ovens?
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setOvenCount(1)}
              style={{
                flex: 1,
                backgroundColor: ovenCount === 1 ? colors.accent : colors.bgCard,
                padding: 16,
                borderRadius: 8,
                borderWidth: ovenCount === 1 ? 0 : 1,
                borderColor: colors.borderDefault,
              }}
            >
              <Text style={{
                textAlign: 'center',
                fontWeight: '600',
                color: ovenCount === 1 ? '#ffffff' : colors.textPrimary,
              }}>
                1 Oven
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOvenCount(2)}
              style={{
                flex: 1,
                backgroundColor: ovenCount === 2 ? colors.accent : colors.bgCard,
                padding: 16,
                borderRadius: 8,
                borderWidth: ovenCount === 2 ? 0 : 1,
                borderColor: colors.borderDefault,
              }}
            >
              <Text style={{
                textAlign: 'center',
                fontWeight: '600',
                color: ovenCount === 2 ? '#ffffff' : colors.textPrimary,
              }}>
                2 Ovens
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!briefing ? (
          <TouchableOpacity
            onPress={handleStartCooking}
            disabled={briefingLoading}
            style={{
              backgroundColor: briefingLoading ? colors.borderDefault : colors.accentGreen,
              padding: 16,
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            <Text style={{ textAlign: 'center', color: '#ffffff', fontWeight: '700', fontSize: 18 }}>
              {briefingLoading ? 'Preparing...' : 'Start Cooking →'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setScreen('plan')}
            style={{
              backgroundColor: colors.accentGreen,
              padding: 16,
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            <Text style={{ textAlign: 'center', color: '#ffffff', fontWeight: '700', fontSize: 18 }}>
              View Plan →
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // Screen 2: Plan
  if (screen === 'plan' && sessionData) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
            Your Cooking Plan
          </Text>

          {sessionData.plan.warnings.map((w, i) => (
            <View key={i} style={{ backgroundColor: '#fef3c7', borderLeftWidth: 4, borderLeftColor: '#f59e0b', padding: 12, marginBottom: 12 }}>
              <Text style={{ color: '#92400e' }}>{w.message}</Text>
            </View>
          ))}

          <View style={{ gap: 12 }}>
            {sessionData.plan.steps.map((step, index) => (
              <View
                key={step.step.id}
                style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: 8,
                  padding: 12,
                  borderLeftWidth: step.is_critical_path ? 4 : 0,
                  borderLeftColor: colors.accent,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ width: 50, fontSize: 12, color: colors.textSecondary }}>
                    {step.planned_start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      <View style={{
                        backgroundColor: step.step.phase === 'prep' ? '#dbeafe' :
                                       step.step.phase === 'cook' ? '#fed7aa' :
                                       step.step.phase === 'rest' ? '#e9d5ff' : '#d1fae5',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                      }}>
                        <Text style={{ fontSize: 10, color: colors.textPrimary }}>{step.step.phase}</Text>
                      </View>
                      {step.step.is_passive && (
                        <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                          <Text style={{ fontSize: 10 }}>passive</Text>
                        </View>
                      )}
                      {step.parallel_with.length > 0 && (
                        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                          <Text style={{ fontSize: 10 }}>⚡ parallel</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.textPrimary }}>
                      {step.step.instruction.length > 80
                        ? step.step.instruction.slice(0, 80) + '...'
                        : step.step.instruction}
                    </Text>
                    {step.step.duration_max && (
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                        ~{step.step.duration_max} min
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          backgroundColor: colors.bgScreen,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}>
          <TouchableOpacity
            onPress={() => {
              setScreen('active');
              stepStartTimeRef.current = Date.now();
            }}
            style={{
              backgroundColor: colors.accentGreen,
              padding: 16,
              borderRadius: 8,
            }}
          >
            <Text style={{ textAlign: 'center', color: '#ffffff', fontWeight: '700', fontSize: 18 }}>
              Let's Go →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          paddingTop: insets.top + 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
        }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.textSecondary }}>Exit</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textSecondary }}>
            Step {currentStepIndex + 1} of {sessionData.plan.steps.length}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setTtsEnabled(!ttsEnabled)}>
              <Text style={{ color: ttsEnabled ? colors.accent : colors.textSecondary }}>🔊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePause}>
              <Text style={{ color: colors.textSecondary }}>{isPaused ? '▶' : '⏸'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step Content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{
            fontSize: 24,
            color: colors.textPrimary,
            marginBottom: 40,
            lineHeight: 36,
            textAlign: 'center',
          }}>
            {currentStep.step.instruction}
          </Text>

          <Text style={{
            fontSize: 64,
            fontWeight: '700',
            color: isOvertime ? colors.accent : colors.textPrimary,
            marginBottom: 20,
          }}>
            {isOvertime ? '+' : ''}{formatTime(isOvertime ? timer - maxSeconds : remaining)}
          </Text>

          {/* Progress Bar */}
          <View style={{ width: '100%', height: 8, backgroundColor: colors.borderDefault, borderRadius: 4, marginBottom: 20 }}>
            <View style={{
              width: `${Math.min(100, progress)}%`,
              height: '100%',
              backgroundColor: isOvertime ? colors.accent : colors.accentGreen,
              borderRadius: 4,
            }} />
          </View>

          {/* Metadata */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Phase: {currentStep.step.phase}</Text>
            {currentStep.step.technique && (
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>• {currentStep.step.technique}</Text>
            )}
          </View>

          {currentStep.step.is_passive && (
            <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
              This step runs in the background
            </Text>
          )}

          {currentStep.parallel_with.length > 0 && (
            <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
              ⚡ Parallel step
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}>
          <TouchableOpacity
            onPress={() => {
              if (currentStepIndex > 0) {
                setCurrentStepIndex(currentStepIndex - 1);
                setTimer(0);
                setIsPaused(false);
                setWasStepPaused(false);
              }
            }}
            disabled={currentStepIndex === 0}
          >
            <Text style={{ color: currentStepIndex === 0 ? colors.borderDefault : colors.textSecondary }}>
              ← Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStepComplete}
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>Done — Next →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Screen 4: Complete
  if (screen === 'complete' && recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 }}>
          You cooked {recipe.title}!
        </Text>

        {totalTime > 0 && (
          <Text style={{ fontSize: 18, color: colors.textSecondary, marginBottom: 16 }}>
            Time taken: {Math.floor(totalTime / 60)} minutes
          </Text>
        )}

        {pointsAwarded > 0 && (
          <View style={{ backgroundColor: colors.accentGreen, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginBottom: 24 }}>
            <Text style={{ color: '#ffffff', fontWeight: '700' }}>+{pointsAwarded} points earned!</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push(`/recipe/${recipe.id}`)}
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 18 }}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
