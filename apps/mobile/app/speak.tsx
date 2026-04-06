import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '../lib/useTabBarHeight';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { useRecipeStore } from '../lib/zustand/recipeStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';
import { formatVoiceRecipe } from '@chefsbook/ai';
import { formatQuantity, LANGUAGES } from '@chefsbook/ui';
import { Button, Card, Loading, Divider } from '../components/UIKit';

const SPEECH_LOCALE_MAP: Record<string, string> = {
  'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES',
  'de': 'de-DE', 'it': 'it-IT', 'pt': 'pt-PT',
  'nl': 'nl-NL', 'ja': 'ja-JP', 'ko': 'ko-KR',
  'zh': 'zh-CN', 'ar': 'ar-SA', 'ru': 'ru-RU',
  'pl': 'pl-PL', 'tr': 'tr-TR', 'sv': 'sv-SE',
  'da': 'da-DK', 'fi': 'fi-FI', 'no': 'nb-NO',
  'hi': 'hi-IN', 'th': 'th-TH', 'vi': 'vi-VN',
  'id': 'id-ID', 'ms': 'ms-MY', 'he': 'he-IL',
  'el': 'el-GR', 'hu': 'hu-HU', 'ro': 'ro-RO',
  'uk': 'uk-UA',
};

type Step = 1 | 2 | 3;

export default function SpeakScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const language = usePreferencesStore((s) => s.language);

  const speechLocale = SPEECH_LOCALE_MAP[language] ?? 'en-US';
  const langName = LANGUAGES.find((l) => l.code === language)?.name ?? 'English';

  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const [step, setStep] = useState<Step>(1);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [recipe, setRecipe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Ref to access latest interim in the 'end' handler
  const interimRef = useRef('');

  const fullTranscript = finalTranscript + (interimTranscript ? (finalTranscript ? ' ' : '') + interimTranscript : '');

  // Speech recognition events
  useSpeechRecognitionEvent('result', (event) => {
    const result = event.results[0];
    if (!result) return;

    if ((event as any).isFinal || (result as any).isFinal) {
      // Utterance complete — commit to permanent record
      setFinalTranscript((prev) => {
        const sep = prev.length > 0 ? ' ' : '';
        return prev + sep + result.transcript;
      });
      setInterimTranscript('');
      interimRef.current = '';
    } else {
      // Still speaking — live preview
      setInterimTranscript(result.transcript);
      interimRef.current = result.transcript;
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setError(`Recognition error: ${event.message}`);
    setRecording(false);
  });
  useSpeechRecognitionEvent('start', () => setRecording(true));
  useSpeechRecognitionEvent('end', () => {
    setRecording(false);
    // Finalize any remaining interim text
    const remaining = interimRef.current;
    if (remaining) {
      setFinalTranscript((prev) => {
        const sep = prev.length > 0 ? ' ' : '';
        return prev + sep + remaining;
      });
      setInterimTranscript('');
      interimRef.current = '';
    }
  });

  const startRecording = async () => {
    try {
      setError('');
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setError('Microphone permission required');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: speechLocale,
        interimResults: true,
        continuous: true,
      });
    } catch (e: any) {
      setError('Could not start voice recognition: ' + e.message);
    }
  };

  const stopRecording = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    setRecording(false);
  };

  const clearTranscript = () => {
    Alert.alert('Clear your recording?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        setFinalTranscript('');
        setInterimTranscript('');
        interimRef.current = '';
      }},
    ]);
  };

  const generateRecipe = async () => {
    const fullText = finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');
    console.log('Sending to Claude:', fullText.length, 'chars');
    if (!fullText.trim()) return;
    setStep(3);
    setGenerating(true);
    setError('');
    try {
      setGenStep('Reading your recipe...');
      setGenStep('Extracting ingredients & steps...');
      const result = await formatVoiceRecipe(fullText);
      if (!result) throw new Error('Could not extract a recipe. Try speaking with more detail.');
      setRecipe(result);
    } catch (e: any) {
      setError(e.message);
      setStep(2);
    } finally {
      setGenerating(false);
    }
  };

  const saveRecipe = async () => {
    if (!recipe || !session?.user?.id) return;
    setSaving(true);
    try {
      const saved = await addRecipe(session.user.id, recipe);
      router.replace(`/recipe/${saved.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  // ── Progress bar ──
  const ProgressBar = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}>
      {[{ n: 1, label: 'Record' }, { n: 2, label: 'Review' }, { n: 3, label: 'Recipe' }].map(({ n, label }, i) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: step >= n ? colors.accent : colors.bgBase,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: step >= n ? '#fff' : colors.textSecondary, fontSize: 13, fontWeight: '700' }}>{n}</Text>
          </View>
          <Text style={{ color: step >= n ? colors.textPrimary : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
          {i < 2 && <View style={{ flex: 1, height: 2, backgroundColor: step > n ? colors.accent : colors.borderDefault }} />}
        </View>
      ))}
    </View>
  );

  // ── Step 1: Record ──
  if (step === 1) {
    const micLabel = recording ? 'Tap to pause' : fullTranscript.length > 0 ? 'Tap to continue' : 'Tap to speak';
    const hasContent = finalTranscript.length > 0 || interimTranscript.length > 0;

    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          {/* Step indicator */}
          <View style={{ paddingTop: 12 }}>
            <ProgressBar />
          </View>

          {/* Instructions */}
          <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 }}>
            Speak your recipe naturally — name, ingredients, steps
          </Text>

          {/* Mic button */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity
              onPress={recording ? stopRecording : startRecording}
              style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: recording ? '#a81f2a' : colors.accent,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name={recording ? 'mic' : 'mic-outline'} size={48} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 10, fontWeight: '600' }}>
              {micLabel}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              {recording ? `Listening in ${langName}...` : ''}
            </Text>
          </View>

          {/* Transcript box — fills remaining space */}
          <View style={{
            flex: 1,
            backgroundColor: colors.bgCard,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: recording ? colors.accent : colors.borderDefault,
            padding: 16,
            marginBottom: 16,
          }}>
            {/* Recording indicator + clear button */}
            {(recording || hasContent) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                {recording && (
                  <>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginRight: 8 }} />
                    <Text style={{ fontSize: 11, color: colors.accent }}>Recording...</Text>
                  </>
                )}
                <View style={{ flex: 1 }} />
                {hasContent && (
                  <TouchableOpacity onPress={clearTranscript} style={{ padding: 4 }}>
                    <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Transcript text */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {hasContent ? (
                <Text style={{ fontSize: 15, color: colors.textPrimary, lineHeight: 24 }}>
                  {finalTranscript}
                  {interimTranscript ? (
                    <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>
                      {finalTranscript ? ' ' : ''}{interimTranscript}
                    </Text>
                  ) : null}
                </Text>
              ) : (
                <Text style={{ fontSize: 14, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                  Your recipe will appear here as you speak...
                </Text>
              )}
            </ScrollView>
          </View>

          {error ? <Text style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>{error}</Text> : null}
        </View>

        {/* Extract Recipe button — pinned above nav bar */}
        <View style={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: colors.bgScreen,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderDefault,
        }}>
          <TouchableOpacity
            onPress={() => setStep(2)}
            disabled={!hasContent}
            style={{
              backgroundColor: hasContent ? colors.accent : colors.borderDefault,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Extract Recipe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Step 2: Review ──
  if (step === 2) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight }}>
        <ProgressBar />

        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Review what was captured</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>Fix any mistakes before we generate your recipe.</Text>

        <TextInput
          value={fullTranscript}
          onChangeText={(text) => { setFinalTranscript(text); setInterimTranscript(''); }}
          multiline
          style={{
            backgroundColor: colors.bgBase, borderRadius: 12, padding: 16,
            fontSize: 16, lineHeight: 24, color: colors.textPrimary,
            minHeight: 200, textAlignVertical: 'top',
            borderWidth: 1, borderColor: colors.borderDefault,
          }}
        />
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 16 }}>{fullTranscript.length} characters</Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Re-record" onPress={() => setStep(1)} variant="ghost" />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Generate Recipe" onPress={generateRecipe} disabled={!fullTranscript.trim()} />
          </View>
        </View>

        {error ? <Text style={{ color: '#ef4444', fontSize: 14, marginTop: 12 }}>{error}</Text> : null}
      </ScrollView>
    );
  }

  // ── Step 3: Recipe ──
  if (step === 3 && generating) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Loading message={genStep || 'Creating your recipe...'} />
      </View>
    );
  }

  if (step === 3 && recipe) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }} contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight }}>
        <ProgressBar />

        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 8 }}>{recipe.title}</Text>
        {recipe.description && (
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 12 }}>{recipe.description}</Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {recipe.cuisine && (
            <View style={{ backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{recipe.cuisine}</Text>
            </View>
          )}
          {recipe.course && (
            <View style={{ backgroundColor: colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{recipe.course}</Text>
            </View>
          )}
        </View>

        <Divider />

        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Ingredients</Text>
        {(recipe.ingredients ?? []).map((ing: any, i: number) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ color: colors.accent, fontSize: 15, width: 80, textAlign: 'right', marginRight: 12 }}>
              {formatQuantity(ing.quantity)} {ing.unit ?? ''}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>
              {ing.ingredient}{ing.preparation ? `, ${ing.preparation}` : ''}
            </Text>
          </View>
        ))}

        <Divider />

        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Steps</Text>
        {(recipe.steps ?? []).map((s: any, i: number) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
            <View style={{
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: colors.accent,
              alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
            }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{s.step_number}</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 22, flex: 1 }}>{s.instruction}</Text>
          </View>
        ))}

        <Divider />

        {error ? <Text style={{ color: '#ef4444', fontSize: 14, marginBottom: 12 }}>{error}</Text> : null}

        <View style={{ gap: 12, marginBottom: 32 }}>
          <Button title={saving ? 'Saving...' : 'Save to My Recipes'} onPress={saveRecipe} disabled={saving} />
          <Button title="Re-generate" onPress={() => { setRecipe(null); generateRecipe(); }} variant="secondary" />
          <Button title="Edit Transcript" onPress={() => setStep(2)} variant="ghost" />
        </View>
      </ScrollView>
    );
  }

  return null;
}
