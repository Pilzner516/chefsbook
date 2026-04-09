import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { useRecipeStore } from '../lib/zustand/recipeStore';
import { processImage } from '../lib/image';
import type { ScanImageAnalysis, ClarifyingQuestion } from '@chefsbook/ai';

const CUISINE_OPTIONS = [
  'Italian', 'French', 'Asian', 'Mexican',
  'Indian', 'Greek', 'American', 'Other',
];

type FlowStep =
  | 'analysing'
  | 'unclear'
  | 'cuisine_select'
  | 'clarifying'
  | 'dish_options'
  | 'confirm_dish'
  | 'manual_name'
  | 'context_input'
  | 'action_sheet'
  | 'generating';

interface Props {
  visible: boolean;
  imageUri: string;
  imageBase64: string;
  imageMimeType: string;
  initialAnalysis: ScanImageAnalysis;
  onDismiss: () => void;
  /** Called when the user chooses "It's a recipe to scan" from unclear screen */
  onForceRecipeScan: () => void;
}

export function DishIdentificationFlow({
  visible,
  imageUri,
  imageBase64,
  imageMimeType,
  initialAnalysis,
  onDismiss,
  onForceRecipeScan,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);

  const [analysis, setAnalysis] = useState<ScanImageAnalysis>(initialAnalysis);
  const [step, setStep] = useState<FlowStep>(() => {
    if (initialAnalysis.type === 'unclear') return 'unclear';
    if (initialAnalysis.dish_confidence === 'high') return 'confirm_dish';
    if (initialAnalysis.clarifying_questions?.length) return 'cuisine_select';
    return 'confirm_dish';
  });

  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedDishOption, setSelectedDishOption] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [userContext, setUserContext] = useState('');
  const [manualDishName, setManualDishName] = useState('');

  const questions = analysis.clarifying_questions ?? [];

  // ── Handlers ──

  const handleCuisineSelect = async (cuisine: string | null) => {
    setSelectedCuisine(cuisine);
    if (questions.length > 0) {
      setStep('clarifying');
    } else if (analysis.dish_confidence === 'high' || analysis.dish_name) {
      setStep('confirm_dish');
    } else {
      // Re-analyse with cuisine hint
      await reanalyseWithContext([], cuisine ?? undefined);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedOption(answer);
  };

  const handleNextQuestion = async () => {
    if (!selectedOption) return;
    const q = questions[currentQuestionIdx];
    const newAnswers = [...answers, { question: q.question, answer: selectedOption }];
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx((i) => i + 1);
    } else {
      // All questions answered — re-analyse
      await reanalyseWithContext(newAnswers, selectedCuisine ?? undefined);
    }
  };

  const reanalyseWithContext = async (
    userAnswers: { question: string; answer: string }[],
    cuisine?: string,
  ) => {
    setStep('analysing');
    try {
      const { reanalyseDish } = await import('@chefsbook/ai');
      const result = await reanalyseDish(imageBase64, userAnswers, cuisine, imageMimeType);
      setAnalysis(result);

      if (result.dish_options?.length && result.dish_confidence !== 'high') {
        setStep('dish_options');
      } else if (result.dish_name) {
        setStep('confirm_dish');
      } else {
        setStep('unclear');
      }
    } catch {
      setStep('unclear');
    }
  };

  const handleDishConfirmed = (name: string) => {
    setAnalysis((prev) => ({ ...prev, dish_name: name, dish_confidence: 'high' }));
    setStep('context_input');
  };

  const handleFindRecipes = () => {
    onDismiss();
    const searchQuery = userContext.trim()
      ? `${analysis.dish_name ?? ''} ${userContext.trim()}`
      : analysis.dish_name ?? '';
    router.push({ pathname: '/(tabs)/search', params: { q: searchQuery } });
  };

  const handleGenerateRecipe = async () => {
    if (!session?.user?.id || !analysis.dish_name) return;
    setStep('generating');
    setGenerating(true);
    try {
      const { generateDishRecipe } = await import('@chefsbook/ai');
      const contextAnswers = answers.length > 0 ? [...answers] : [];
      if (userContext.trim()) {
        contextAnswers.push({ question: 'User notes', answer: userContext.trim() });
      }
      const scanned = await generateDishRecipe({
        imageBase64,
        mimeType: imageMimeType,
        dishName: analysis.dish_name,
        cuisine: analysis.cuisine_guess ?? selectedCuisine ?? undefined,
        userAnswers: contextAnswers.length > 0 ? contextAnswers : undefined,
      });

      const recipe = await addRecipe(session.user.id, scanned);

      // Upload scanned dish photo as primary image
      try {
        const { base64 } = await processImage(imageUri);
        const { supabase, addRecipePhoto } = await import('@chefsbook/db');
        const fileName = `${session.user.id}/${recipe.id}/dish_${Date.now()}.jpg`;
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        await supabase.storage.from('recipe-user-photos').upload(fileName, bytes, { contentType: 'image/jpeg' });
        const { data: urlData } = supabase.storage.from('recipe-user-photos').getPublicUrl(fileName);
        await addRecipePhoto(recipe.id, session.user.id, fileName, urlData.publicUrl);
      } catch {} // non-blocking — recipe is saved even if photo upload fails

      onDismiss();
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      setGenerating(false);
      setStep('action_sheet');
      const { Alert } = require('react-native');
      Alert.alert(t('dishId.generateFailed'), e.message);
    }
  };

  // ── Render helpers ──

  const renderPill = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: selected ? colors.accent : colors.accentSoft,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: selected ? '#ffffff' : colors.accent, fontSize: 15, fontWeight: '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ── Steps ──

  const renderAnalysing = () => (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 16 }}>
        {t('dishId.analysing')}
      </Text>
    </View>
  );

  const renderUnclear = () => (
    <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
      <Ionicons name="help-circle-outline" size={56} color={colors.textMuted} style={{ marginBottom: 16 }} />
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
        {t('dishId.couldntIdentify')}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
        {t('dishId.unclearBody')}
      </Text>
      <TouchableOpacity
        onPress={() => { onDismiss(); onForceRecipeScan(); }}
        style={{
          width: '100%', backgroundColor: colors.bgCard, borderRadius: 12,
          padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12,
          borderWidth: 1, borderColor: colors.borderDefault,
        }}
      >
        <Ionicons name="document-text-outline" size={24} color={colors.accent} style={{ marginRight: 12 }} />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {t('dishId.itsRecipe')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setAnalysis((prev) => ({ ...prev, type: 'dish_photo' }));
          if (questions.length > 0) setStep('cuisine_select');
          else setStep('cuisine_select');
        }}
        style={{
          width: '100%', backgroundColor: colors.bgCard, borderRadius: 12,
          padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12,
          borderWidth: 1, borderColor: colors.borderDefault,
        }}
      >
        <Ionicons name="restaurant-outline" size={24} color={colors.accent} style={{ marginRight: 12 }} />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {t('dishId.itsDish')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setStep('manual_name')}
        style={{
          width: '100%', backgroundColor: colors.bgCard, borderRadius: 12,
          padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12,
          borderWidth: 1, borderColor: colors.borderDefault,
        }}
      >
        <Ionicons name="pencil-outline" size={24} color={colors.accent} style={{ marginRight: 12 }} />
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
          {t('dishId.typeItMyself')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCuisineSelect = () => (
    <View style={{ paddingHorizontal: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
        {t('dishId.cuisineTitle')}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
        {t('dishId.cuisineOptional')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {CUISINE_OPTIONS.map((c) =>
          renderPill(c, selectedCuisine === c, () => {
            setSelectedCuisine(c);
            handleCuisineSelect(c);
          }),
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleCuisineSelect(null)}
        style={{ alignItems: 'center', marginTop: 16, paddingVertical: 12 }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '500' }}>
          {t('dishId.skip')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderClarifying = () => {
    const q = questions[currentQuestionIdx];
    if (!q) return null;
    return (
      <View style={{ paddingHorizontal: 24 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
          {t('dishId.helpIdentify')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
          {t('dishId.questionProgress', { current: currentQuestionIdx + 1, total: questions.length })}
        </Text>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 16 }}>
          {q.question}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          {q.options.map((opt) =>
            renderPill(opt, selectedOption === opt, () => handleAnswerSelect(opt)),
          )}
        </View>
        <TouchableOpacity
          onPress={handleNextQuestion}
          disabled={!selectedOption}
          style={{
            backgroundColor: selectedOption ? colors.accent : colors.bgBase,
            borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20,
            opacity: selectedOption ? 1 : 0.5,
          }}
        >
          <Text style={{ color: selectedOption ? '#ffffff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
            {t('dishId.next')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderDishOptions = () => {
    const options = analysis.dish_options ?? [];
    return (
      <View style={{ paddingHorizontal: 24 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 }}>
          {t('dishId.whichDish')}
        </Text>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => setSelectedDishOption(opt)}
            style={{
              flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10,
              backgroundColor: selectedDishOption === opt ? colors.accentSoft : colors.bgCard,
              borderRadius: 12, borderWidth: 1,
              borderColor: selectedDishOption === opt ? colors.accent : colors.borderDefault,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 11, marginRight: 12,
              borderWidth: 2, borderColor: selectedDishOption === opt ? colors.accent : colors.textMuted,
              backgroundColor: selectedDishOption === opt ? colors.accent : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {selectedDishOption === opt && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
              )}
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '500', flex: 1 }}>{opt}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => handleDishConfirmed(selectedDishOption!)}
            disabled={!selectedDishOption}
            style={{
              flex: 1, backgroundColor: selectedDishOption ? colors.accent : colors.bgBase,
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
              opacity: selectedDishOption ? 1 : 0.5,
            }}
          >
            <Text style={{ color: selectedDishOption ? '#ffffff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
              {t('dishId.confirm')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStep('manual_name')}
            style={{
              flex: 1, backgroundColor: colors.bgBase, borderRadius: 12, paddingVertical: 14,
              alignItems: 'center', borderWidth: 1, borderColor: colors.borderDefault,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
              {t('dishId.noneOfThese')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderConfirmDish = () => (
    <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
        {t('dishId.isThisDish', { name: analysis.dish_name ?? 'Unknown dish' })}
      </Text>
      {analysis.cuisine_guess && (
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>
          {t('dishId.cuisine', { cuisine: analysis.cuisine_guess })}
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <TouchableOpacity
          onPress={() => handleDishConfirmed(analysis.dish_name!)}
          style={{
            flex: 1, backgroundColor: colors.accent, borderRadius: 12,
            paddingVertical: 14, alignItems: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{t('dishId.yes')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // Go back to cuisine select to try again
            setAnswers([]);
            setCurrentQuestionIdx(0);
            setSelectedOption(null);
            setStep('cuisine_select');
          }}
          style={{
            flex: 1, backgroundColor: colors.bgBase, borderRadius: 12,
            paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: colors.borderDefault,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t('dishId.noTryAgain')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => setStep('manual_name')} style={{ alignItems: 'center', marginTop: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('dishId.typeItMyself')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActionSheet = () => (
    <View style={{ paddingHorizontal: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
        {analysis.dish_name}
      </Text>
      {analysis.cuisine_guess && (
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
          {t('dishId.cuisine', { cuisine: analysis.cuisine_guess })}
        </Text>
      )}
      {!analysis.cuisine_guess && <View style={{ height: 20 }} />}
      <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
        {t('dishId.whatToDo')}
      </Text>

      <TouchableOpacity
        onPress={handleFindRecipes}
        style={{
          backgroundColor: colors.bgCard, borderRadius: 14, padding: 18,
          marginBottom: 12, borderWidth: 1, borderColor: colors.borderDefault,
          flexDirection: 'row', alignItems: 'center',
        }}
      >
        <Ionicons name="search" size={24} color={colors.accent} style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
            {t('dishId.findRecipes')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            {t('dishId.findRecipesSubtitle')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleGenerateRecipe}
        style={{
          backgroundColor: colors.bgCard, borderRadius: 14, padding: 18,
          marginBottom: 12, borderWidth: 1, borderColor: colors.borderDefault,
          flexDirection: 'row', alignItems: 'center',
        }}
      >
        <Ionicons name="sparkles" size={24} color={colors.accent} style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
            {t('dishId.generateRecipe')}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            {t('dishId.generateRecipeSubtitle')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const renderGenerating = () => (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 16 }}>
        {t('dishId.generating')}
      </Text>
    </View>
  );

  const renderManualName = () => (
    <View style={{ paddingHorizontal: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
        {t('dishId.whatDishIsThis')}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
        {t('dishId.manualNameHint')}
      </Text>
      <TextInput
        value={manualDishName}
        onChangeText={setManualDishName}
        placeholder={t('dishId.manualNamePlaceholder')}
        placeholderTextColor={colors.textMuted}
        autoFocus
        style={{
          backgroundColor: colors.bgBase,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          padding: 14,
          fontSize: 16,
          color: colors.textPrimary,
        }}
      />
      <TouchableOpacity
        onPress={() => {
          if (manualDishName.trim()) {
            handleDishConfirmed(manualDishName.trim());
          }
        }}
        disabled={!manualDishName.trim()}
        style={{
          backgroundColor: manualDishName.trim() ? colors.accent : colors.bgBase,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 16,
          marginBottom: insets.bottom + 16,
          opacity: manualDishName.trim() ? 1 : 0.5,
        }}
      >
        <Text style={{ color: manualDishName.trim() ? '#ffffff' : colors.textMuted, fontSize: 16, fontWeight: '700' }}>
          {t('dishId.continueArrow')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderContextInput = () => (
    <View style={{ paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
          {t('dishId.anyDetails')}
        </Text>
        <TouchableOpacity onPress={() => setStep('action_sheet')}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('dishId.skipArrow')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>
        {t('dishId.contextHint')}
      </Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          value={userContext}
          onChangeText={(t) => setUserContext(t.slice(0, 200))}
          placeholder={t('dishId.contextPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={200}
          style={{
            backgroundColor: colors.bgBase,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            padding: 14,
            paddingBottom: 30,
            fontSize: 15,
            color: colors.textPrimary,
            minHeight: 90,
            textAlignVertical: 'top',
          }}
        />
        <Text style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          color: colors.textMuted,
          fontSize: 12,
        }}>
          {userContext.length}/200
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => setStep('action_sheet')}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 16,
          marginBottom: insets.bottom + 16,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
          {t('dishId.continueArrow')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 'analysing': return renderAnalysing();
      case 'unclear': return renderUnclear();
      case 'cuisine_select': return renderCuisineSelect();
      case 'clarifying': return renderClarifying();
      case 'dish_options': return renderDishOptions();
      case 'confirm_dish': return renderConfirmDish();
      case 'manual_name': return renderManualName();
      case 'context_input': return renderContextInput();
      case 'action_sheet': return renderActionSheet();
      case 'generating': return renderGenerating();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.bgScreen,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          minHeight: '65%',
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Handle + close */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault }} />
          </View>
          {step !== 'analysing' && step !== 'generating' && (
            <TouchableOpacity
              onPress={onDismiss}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Image preview */}
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Image
              source={{ uri: imageUri }}
              style={{ width: 140, height: 140, borderRadius: 16 }}
              resizeMode="cover"
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            bounces={false}
          >
            {renderStep()}
          </ScrollView>

          {/* Cancel button (only on certain steps) */}
          {(step === 'cuisine_select' || step === 'clarifying' || step === 'confirm_dish' || step === 'manual_name' || step === 'context_input' || step === 'action_sheet' || step === 'dish_options') && (
            <TouchableOpacity
              onPress={onDismiss}
              style={{ alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>{t('dishId.cancel')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
