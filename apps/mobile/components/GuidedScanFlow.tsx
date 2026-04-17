import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { useRecipeStore } from '../lib/zustand/recipeStore';
import { processImage } from '../lib/image';
import type { ScanImageAnalysis } from '@chefsbook/ai';
import type { ScanFollowUp } from '@chefsbook/ai';
import { consumeLastUsage } from '@chefsbook/ai';
import { logAiCallFromClient } from '@chefsbook/db';
import { useConfirmDialog } from './useDialog';

// ── Steps ──
// A — Dish confirmation + title edit + user comments (ALWAYS shown)
// B — AI follow-up questions (0–3 max, skipped when none)
// C — "Anything else?" Yes/No + optional final-thoughts textarea (ALWAYS shown)
// D — Recipe generation (loading state; not user-facing)
type Step = 'A' | 'B' | 'C' | 'D';

type AnsweredQuestion = { question: string; answer: string };

interface Props {
  visible: boolean;
  imageUri: string;
  imageBase64: string;
  imageMimeType: string;
  initialAnalysis: ScanImageAnalysis;
  onDismiss: () => void;
}

export function GuidedScanFlow({
  visible,
  imageUri,
  imageBase64,
  imageMimeType,
  initialAnalysis,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const [confirm, ConfirmDialog] = useConfirmDialog();

  const initialTitle = initialAnalysis.dish_name?.trim() || '';

  const [step, setStep] = useState<Step>('A');
  const [title, setTitle] = useState(initialTitle);
  const [comments, setComments] = useState('');

  // Step B state
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [followUps, setFollowUps] = useState<ScanFollowUp[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<string[]>([]);

  // Step C state
  const [finalThoughts, setFinalThoughts] = useState('');
  const [showFinalThoughts, setShowFinalThoughts] = useState(false);

  // Step D state
  const [generating, setGenerating] = useState(false);

  // Reset whenever the modal re-opens with a new analysis
  useEffect(() => {
    if (visible) {
      setStep('A');
      setTitle(initialTitle);
      setComments('');
      setFollowUps([]);
      setFollowUpAnswers([]);
      setFinalThoughts('');
      setShowFinalThoughts(false);
      setGenerating(false);
    }
  }, [visible, initialTitle]);

  const totalSteps = followUps.length > 0 ? 3 : 2; // A + optional B + C

  const stepLabel = (current: 1 | 2 | 3) =>
    t('guidedScan.stepOfTotal', { current, total: totalSteps });

  // ── Step A → compute follow-ups → Step B or C ──
  const handleContinueFromA = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(t('common.errorTitle'), t('guidedScan.titleRequired'));
      return;
    }
    setLoadingFollowUps(true);
    try {
      const { generateScanFollowUpQuestions } = await import('@chefsbook/ai');
      const t0 = Date.now();
      const questions = await generateScanFollowUpQuestions({
        dishName: trimmedTitle,
        cuisineGuess: initialAnalysis.cuisine_guess ?? null,
        userComments: comments,
      });
      // Fire-and-forget cost log for the follow-up Haiku call
      const usage = consumeLastUsage();
      if (session?.user?.id) {
        logAiCallFromClient({
          userId: session.user.id,
          action: 'scan_guided_followups',
          model: 'haiku',
          tokensIn: usage?.inputTokens,
          tokensOut: usage?.outputTokens,
          durationMs: Date.now() - t0,
          success: true,
        }).catch(() => {});
      }
      setFollowUps(questions);
      setFollowUpAnswers(questions.map(() => ''));
      setStep(questions.length > 0 ? 'B' : 'C');
    } catch (e: any) {
      // Follow-up generation is best-effort — on failure skip to Step C rather than abort
      console.warn('[guidedScan] follow-up generation failed', e);
      setFollowUps([]);
      setStep('C');
    } finally {
      setLoadingFollowUps(false);
    }
  };

  // ── Step B → Step C ──
  const handleContinueFromB = () => {
    setStep('C');
  };

  // ── Step C → Step D → generate + save ──
  const handleContinueFromC = async () => {
    if (!session?.user?.id) return;
    setStep('D');
    setGenerating(true);
    const t0 = Date.now();
    try {
      const trimmedTitle = title.trim();
      const answered: AnsweredQuestion[] = [];

      if (comments.trim()) {
        answered.push({ question: t('guidedScan.step1.commentsLabel'), answer: comments.trim() });
      }
      followUps.forEach((q, idx) => {
        const a = followUpAnswers[idx]?.trim();
        if (a) answered.push({ question: q.question, answer: a });
      });
      if (finalThoughts.trim()) {
        answered.push({ question: t('guidedScan.step3.finalLabel'), answer: finalThoughts.trim() });
      }

      const { generateDishRecipe } = await import('@chefsbook/ai');
      const scanned = await generateDishRecipe({
        imageBase64,
        mimeType: imageMimeType,
        dishName: trimmedTitle,
        cuisine: initialAnalysis.cuisine_guess ?? undefined,
        userAnswers: answered.length > 0 ? answered : undefined,
      });

      const usage = consumeLastUsage();
      // Honour the user's edited title even if Claude returned a different one
      const finalRecipe = { ...scanned, title: trimmedTitle || scanned.title };

      const recipe = await addRecipe(session.user.id, finalRecipe);

      // Upload the scan photo as the primary recipe image (non-blocking)
      try {
        const { base64 } = await processImage(imageUri);
        const { supabase, addRecipePhoto } = await import('@chefsbook/db');
        const fileName = `${session.user.id}/${recipe.id}/scan_${Date.now()}.jpg`;
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        await supabase.storage.from('recipe-user-photos').upload(fileName, bytes, { contentType: 'image/jpeg' });
        const { data: urlData } = supabase.storage.from('recipe-user-photos').getPublicUrl(fileName);
        await addRecipePhoto(recipe.id, session.user.id, fileName, urlData.publicUrl);
      } catch (uploadErr) {
        console.warn('[guidedScan] photo upload failed (non-blocking)', uploadErr);
      }

      // Log the Sonnet cost for admin observability — fire-and-forget
      logAiCallFromClient({
        userId: session.user.id,
        action: 'scan_guided_generation',
        model: 'sonnet',
        tokensIn: usage?.inputTokens,
        tokensOut: usage?.outputTokens,
        recipeId: recipe.id,
        durationMs: Date.now() - t0,
        success: true,
        metadata: {
          followup_count: followUps.length,
          user_commented: comments.trim().length > 0,
          user_final_thoughts: finalThoughts.trim().length > 0,
        },
      }).catch(() => {});

      onDismiss();
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      console.warn('[guidedScan] generation failed', e);
      setGenerating(false);
      setStep('C');
      logAiCallFromClient({
        userId: session?.user?.id ?? null,
        action: 'scan_guided_generation',
        model: 'sonnet',
        durationMs: Date.now() - t0,
        success: false,
        metadata: { error: String(e?.message ?? e).slice(0, 200) },
      }).catch(() => {});
      Alert.alert(t('common.errorTitle'), e?.message ?? String(e));
    }
  };

  // Back handlers — Step A has no back (cancel via close button)
  const handleBack = () => {
    if (step === 'B') setStep('A');
    else if (step === 'C') setStep(followUps.length > 0 ? 'B' : 'A');
  };

  const handleAnythingElseYes = async () => {
    setShowFinalThoughts(true);
  };

  const handleAnythingElseNo = async () => {
    await handleContinueFromC();
  };

  // ── Renderers ──

  const renderStepA = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{stepLabel(1)}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
        {t('guidedScan.step1.heading')}
      </Text>
      {initialAnalysis.cuisine_guess && (
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
          {t('guidedScan.cuisineGuess', { cuisine: initialAnalysis.cuisine_guess })}
        </Text>
      )}

      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>{t('guidedScan.step1.titleLabel')}</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('guidedScan.step1.titlePlaceholder')}
        placeholderTextColor={colors.textMuted}
        style={{
          backgroundColor: colors.bgBase,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          padding: 12,
          fontSize: 16,
          color: colors.textPrimary,
          marginBottom: 16,
        }}
      />

      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>{t('guidedScan.step1.commentsLabel')}</Text>
      <TextInput
        value={comments}
        onChangeText={(v) => setComments(v.slice(0, 400))}
        placeholder={t('guidedScan.step1.commentsPlaceholder')}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={400}
        style={{
          backgroundColor: colors.bgBase,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          padding: 12,
          fontSize: 14,
          color: colors.textPrimary,
          minHeight: 96,
          textAlignVertical: 'top',
          marginBottom: 20,
        }}
      />

      <TouchableOpacity
        onPress={handleContinueFromA}
        disabled={!title.trim() || loadingFollowUps}
        style={{
          backgroundColor: title.trim() && !loadingFollowUps ? colors.accent : colors.bgBase,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
          opacity: title.trim() && !loadingFollowUps ? 1 : 0.5,
        }}
      >
        {loadingFollowUps && <ActivityIndicator size="small" color="#ffffff" />}
        <Text style={{ color: title.trim() && !loadingFollowUps ? '#ffffff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
          {t('guidedScan.continue')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStepB = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{stepLabel(2)}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        {t('guidedScan.step2.heading')}
      </Text>
      {followUps.map((q, idx) => (
        <View key={idx} style={{ marginBottom: 14 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 6 }}>
            {q.question}
          </Text>
          <TextInput
            value={followUpAnswers[idx] ?? ''}
            onChangeText={(v) => {
              const next = [...followUpAnswers];
              next[idx] = v.slice(0, 160);
              setFollowUpAnswers(next);
            }}
            placeholder={q.placeholder ?? ''}
            placeholderTextColor={colors.textMuted}
            style={{
              backgroundColor: colors.bgBase,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              padding: 12,
              fontSize: 15,
              color: colors.textPrimary,
            }}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          onPress={handleBack}
          style={{
            flex: 1,
            backgroundColor: colors.bgBase,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.borderDefault,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>{t('guidedScan.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleContinueFromB}
          style={{
            flex: 1,
            backgroundColor: colors.accent,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{t('guidedScan.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStepC = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
        {stepLabel(followUps.length > 0 ? 3 : 2)}
      </Text>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 6 }}>
        {t('guidedScan.step3.heading')}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 20 }}>
        {t('guidedScan.step3.prompt')}
      </Text>

      {!showFinalThoughts ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={handleAnythingElseNo}
            style={{
              flex: 1,
              backgroundColor: colors.bgBase,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.borderDefault,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t('guidedScan.no')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAnythingElseYes}
            style={{
              flex: 1,
              backgroundColor: colors.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{t('guidedScan.yes')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>
            {t('guidedScan.step3.finalLabel')}
          </Text>
          <TextInput
            value={finalThoughts}
            onChangeText={(v) => setFinalThoughts(v.slice(0, 400))}
            placeholder={t('guidedScan.step3.finalPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={400}
            autoFocus
            style={{
              backgroundColor: colors.bgBase,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              padding: 12,
              fontSize: 14,
              color: colors.textPrimary,
              minHeight: 96,
              textAlignVertical: 'top',
              marginBottom: 16,
            }}
          />
          <TouchableOpacity
            onPress={handleContinueFromC}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{t('guidedScan.submit')}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        onPress={handleBack}
        style={{ alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('guidedScan.back')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStepD = () => (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 16 }}>
        {t('guidedScan.generating')}
      </Text>
    </View>
  );

  const renderBody = () => {
    switch (step) {
      case 'A': return renderStepA();
      case 'B': return renderStepB();
      case 'C': return renderStepC();
      case 'D': return renderStepD();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.bgScreen,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            minHeight: '70%',
            maxHeight: '92%',
          }}
        >
          {/* Handle + close */}
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault }} />
          </View>
          {step !== 'D' && (
            <TouchableOpacity
              onPress={async () => {
                const ok = await confirm({
                  icon: '❓',
                  title: t('guidedScan.cancelTitle'),
                  body: t('guidedScan.cancelBody'),
                  confirmLabel: t('guidedScan.cancelConfirm'),
                  cancelLabel: t('guidedScan.keepGoing'),
                });
                if (ok) onDismiss();
              }}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Header with image + title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
            <Image source={{ uri: imageUri }} style={{ width: 64, height: 64, borderRadius: 12 }} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                {t('guidedScan.title').toUpperCase()}
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>
                {title || t('guidedScan.step1.titlePlaceholder')}
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {renderBody()}
          </ScrollView>
        </View>
      </View>
      <ConfirmDialog />
    </Modal>
  );
}
