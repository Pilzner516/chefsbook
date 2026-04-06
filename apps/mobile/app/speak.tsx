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
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState('');
  const [recipe, setRecipe] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Track text accumulated before current recording session
  const prevTranscriptRef = useRef('');

  // Speech recognition events — append new results to previous text
  useSpeechRecognitionEvent('result', (event) => {
    const newText = event.results[0]?.transcript ?? '';
    const prev = prevTranscriptRef.current;
    setTranscript(prev ? prev + ' ' + newText : newText);
  });
  useSpeechRecognitionEvent('error', (event) => {
    setError(`Recognition error: ${event.message}`);
    setRecording(false);
  });
  useSpeechRecognitionEvent('start', () => setRecording(true));
  useSpeechRecognitionEvent('end', () => setRecording(false));

  const startRecording = async () => {
    try {
      setError('');
      // Snapshot current transcript so new results append after it
      prevTranscriptRef.current = transcript;
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
      { text: 'Clear', style: 'destructive', onPress: () => { setTranscript(''); prevTranscriptRef.current = ''; } },
    ]);
  };

  const generateRecipe = async () => {
    if (!transcript.trim()) return;
    setStep(3);
    setGenerating(true);
    setError('');
    try {
      setGenStep('Reading your recipe...');
      setGenStep('Extracting ingredients & steps...');
      const result = await formatVoiceRecipe(transcript);
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
    const micLabel = recording ? 'Tap to pause' : transcript.length > 0 ? 'Tap to continue' : 'Tap to speak';

    return (
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center', paddingBottom: tabBarHeight + 80 }}>
          <ProgressBar />

          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            Speak your recipe naturally. Say the name, ingredients, and steps in any order.
          </Text>

          <Card style={{ padding: 16, marginBottom: 20, width: '100%' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Example</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontStyle: 'italic', lineHeight: 20 }}>
              "Grandma's cookies. Two cups flour, one cup butter, two eggs, one cup chocolate chips. Cream butter and sugar, add eggs, fold in flour and chips, bake at 375 for 12 minutes."
            </Text>
          </Card>

          {/* Big mic button */}
          <TouchableOpacity
            onPress={recording ? stopRecording : startRecording}
            style={{
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: recording ? '#ef4444' : colors.accent,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons name="mic" size={52} color="#ffffff" />
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
            {micLabel}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            Listening in {langName}
          </Text>
          {recording && (
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444', marginBottom: 8 }} />
          )}

          {/* Live transcript */}
          {transcript.length > 0 && (
            <View style={{ width: '100%', marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{transcript.length} characters</Text>
                <TouchableOpacity onPress={clearTranscript} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
                  <Ionicons name="refresh-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Clear</Text>
                </TouchableOpacity>
              </View>
              <View style={{
                backgroundColor: colors.bgBase, borderRadius: 12, padding: 16,
                minHeight: 80,
              }}>
                <Text style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}>{transcript}</Text>
              </View>
            </View>
          )}

          {error ? <Text style={{ color: '#ef4444', fontSize: 14, marginTop: 12 }}>{error}</Text> : null}
        </ScrollView>

        {/* Sticky bottom action */}
        {!recording && transcript.length > 0 && (
          <View style={{
            position: 'absolute',
            bottom: insets.bottom + 80,
            left: 16,
            right: 16,
          }}>
            <Button title="Next: Review" onPress={() => setStep(2)} />
          </View>
        )}
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
          value={transcript}
          onChangeText={setTranscript}
          multiline
          style={{
            backgroundColor: colors.bgBase, borderRadius: 12, padding: 16,
            fontSize: 16, lineHeight: 24, color: colors.textPrimary,
            minHeight: 200, textAlignVertical: 'top',
            borderWidth: 1, borderColor: colors.borderDefault,
          }}
        />
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 16 }}>{transcript.length} characters</Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button title="Re-record" onPress={() => setStep(1)} variant="ghost" />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Generate Recipe" onPress={generateRecipe} disabled={!transcript.trim()} />
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
