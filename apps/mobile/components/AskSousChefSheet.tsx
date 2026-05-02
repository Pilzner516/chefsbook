import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@chefsbook/db';
import type { RecipeWithDetails } from '@chefsbook/db';
import type { SousChefFeedbackResult } from '@chefsbook/ai';

interface AskSousChefSheetProps {
  isOpen: boolean;
  onClose: () => void;
  original: RecipeWithDetails;
  versions: RecipeWithDetails[];
  onSave: (regenerated: SousChefFeedbackResult, baseVersionId: string | null) => Promise<void>;
}

type BaseVersion = 'original' | 'v1' | 'v2';

export function AskSousChefSheet({
  isOpen,
  onClose,
  original,
  versions,
  onSave,
}: AskSousChefSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [baseVersion, setBaseVersion] = useState<BaseVersion>('original');
  const [feedback, setFeedback] = useState('');
  const [generating, setGenerating] = useState(false);
  const [regenerated, setRegenerated] = useState<SousChefFeedbackResult | null>(null);
  const [saving, setSaving] = useState(false);

  const v1 = versions.find((v) => v.personal_version_slot === 1);
  const v2 = versions.find((v) => v.personal_version_slot === 2);

  // Hide Original pill when both slots are full
  const hideOriginal = v1 && v2;

  const handleGenerate = async () => {
    if (!feedback.trim()) return;

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`https://chefsbk.app/api/recipes/${original.id}/ask-sous-chef`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ feedback: feedback.trim(), baseVersion }),
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.error === 'PLAN_REQUIRED') {
          alert(t('personalVersions.planRequired'));
          return;
        }
        throw new Error(error.error || 'Failed to generate');
      }

      const data = await res.json();
      setRegenerated(data.regenerated);
    } catch (err: any) {
      console.error('Failed to generate:', err);
      alert(err.message || 'Failed to generate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!regenerated) return;

    setSaving(true);
    try {
      const baseVersionId =
        baseVersion === 'original' ? null : baseVersion === 'v1' ? v1?.id ?? null : v2?.id ?? null;
      await onSave(regenerated, baseVersionId);
      // Reset state
      setRegenerated(null);
      setFeedback('');
      setBaseVersion('original');
      onClose();
    } catch (err: any) {
      console.error('Failed to save:', err);
      alert(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setRegenerated(null);
    setFeedback('');
    setBaseVersion('original');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: colors.bgScreen,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: '90%',
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: colors.borderDefault,
                    borderRadius: 2,
                  }}
                />
              </View>

              <ScrollView
                style={{ maxHeight: 600 }}
                contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {!regenerated ? (
                  <View style={{ padding: 16 }}>
                    {/* Title */}
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
                      {t('personalVersions.askSousChef')}
                    </Text>

                    {/* Base version selector */}
                    {v1 || v2 ? (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                          Which version would you like to refine?
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {!hideOriginal && (
                            <TouchableOpacity
                              onPress={() => setBaseVersion('original')}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 8,
                                backgroundColor: baseVersion === 'original' ? '#ce2b37' : colors.bgBase,
                                borderWidth: 1,
                                borderColor: baseVersion === 'original' ? '#ce2b37' : colors.borderDefault,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: baseVersion === 'original' ? '#ffffff' : colors.textPrimary,
                                }}
                              >
                                {t('personalVersions.original')}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {v1 && (
                            <TouchableOpacity
                              onPress={() => setBaseVersion('v1')}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 8,
                                backgroundColor: baseVersion === 'v1' ? '#ce2b37' : colors.bgBase,
                                borderWidth: 1,
                                borderColor: baseVersion === 'v1' ? '#ce2b37' : colors.borderDefault,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: baseVersion === 'v1' ? '#ffffff' : colors.textPrimary,
                                }}
                              >
                                {v1.title}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {v2 && (
                            <TouchableOpacity
                              onPress={() => setBaseVersion('v2')}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                borderRadius: 8,
                                backgroundColor: baseVersion === 'v2' ? '#ce2b37' : colors.bgBase,
                                borderWidth: 1,
                                borderColor: baseVersion === 'v2' ? '#ce2b37' : colors.borderDefault,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: baseVersion === 'v2' ? '#ffffff' : colors.textPrimary,
                                }}
                              >
                                {v2.title}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ) : null}

                    {/* Feedback input */}
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
                        {t('personalVersions.askSousChefPlaceholder')}
                      </Text>
                      <TextInput
                        value={feedback}
                        onChangeText={setFeedback}
                        placeholder={t('personalVersions.askSousChefPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        multiline
                        style={{
                          minHeight: 100,
                          backgroundColor: colors.bgBase,
                          borderWidth: 1,
                          borderColor: colors.borderDefault,
                          borderRadius: 8,
                          padding: 12,
                          color: colors.textPrimary,
                          fontSize: 15,
                          textAlignVertical: 'top',
                        }}
                      />
                    </View>

                    {/* Generate button */}
                    <TouchableOpacity
                      onPress={handleGenerate}
                      disabled={!feedback.trim() || generating}
                      style={{
                        backgroundColor: !feedback.trim() || generating ? colors.borderDefault : '#ce2b37',
                        paddingVertical: 14,
                        borderRadius: 8,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {generating && <ActivityIndicator size="small" color="#ffffff" />}
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                        {generating ? t('personalVersions.generating') : t('common.generate') || 'Generate'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ padding: 16 }}>
                    {/* Review panel */}
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 }}>
                      {regenerated.title}
                    </Text>

                    {regenerated.description && (
                      <Text style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 16, lineHeight: 22 }}>
                        {regenerated.description}
                      </Text>
                    )}

                    {/* Ingredients */}
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                        Ingredients
                      </Text>
                      {regenerated.ingredients.map((ing, idx) => (
                        <Text key={idx} style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
                          • {ing.quantity} {ing.unit} {ing.name}
                          {ing.group && <Text style={{ color: colors.textSecondary }}> ({ing.group})</Text>}
                        </Text>
                      ))}
                    </View>

                    {/* Steps */}
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                        Steps
                      </Text>
                      {regenerated.steps.map((step, idx) => (
                        <View key={idx} style={{ marginBottom: 8 }}>
                          <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
                            <Text style={{ fontWeight: '600' }}>{idx + 1}.</Text> {step.instruction}
                            {step.duration_minutes && (
                              <Text style={{ color: colors.textSecondary }}> ({step.duration_minutes} min)</Text>
                            )}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {regenerated.notes && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                          Notes
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 20 }}>
                          {regenerated.notes}
                        </Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setRegenerated(null);
                          setFeedback('');
                        }}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: colors.borderDefault,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>
                          {t('common.back')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                          flex: 1,
                          backgroundColor: saving ? colors.borderDefault : '#ce2b37',
                          paddingVertical: 14,
                          borderRadius: 8,
                          alignItems: 'center',
                          flexDirection: 'row',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        {saving && <ActivityIndicator size="small" color="#ffffff" />}
                        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                          {saving ? t('common.saving') : t('personalVersions.saveVersion')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
