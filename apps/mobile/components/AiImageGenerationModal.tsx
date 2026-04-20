import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { IMAGE_THEMES } from '@chefsbook/ai';
import type { ImageTheme, CreativityLevel } from '@chefsbook/ai';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Web API URL: same host as Supabase but on port 3000
const WEB_API_URL = SUPABASE_URL.replace(':8000', ':3000');

const THEMES = Object.values(IMAGE_THEMES);
const REGEN_LIMIT = 5;

interface Props {
  visible: boolean;
  recipeId: string;
  onClose: () => void;
  onImageGenerated: (url: string) => void;
}

export function AiImageGenerationModal({ visible, recipeId, onClose, onImageGenerated }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);

  const [selectedTheme, setSelectedTheme] = useState<ImageTheme>('bright_fresh');
  const [creativity, setCreativity] = useState<CreativityLevel>(3);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [regenCount, setRegenCount] = useState(0);
  const [hasGenerated, setHasGenerated] = useState(false);

  const isFreePlan = planTier === 'free';
  const canTryAgain = hasGenerated && regenCount < REGEN_LIMIT;

  const generate = async (replaceExisting = false) => {
    if (!session?.access_token) return;
    setGenerating(true);
    try {
      const res = await fetch(`${WEB_API_URL}/api/recipes/mobile-generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          recipeId,
          theme: selectedTheme,
          creativityLevel: creativity,
          replaceExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          Alert.alert(t('imageManager.upgradeTitle'), t('imageManager.upgradeBody'));
          return;
        }
        if (res.status === 429) {
          Alert.alert(t('imageManager.regenLimitTitle'), t('imageManager.regenLimitBody'));
          return;
        }
        throw new Error(data.error ?? t('common.error'));
      }
      setGeneratedUrl(data.url);
      setRegenCount(data.regenCount ?? 0);
      setHasGenerated(true);
    } catch (err: any) {
      Alert.alert(t('common.errorTitle'), err.message ?? t('imageManager.generationFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const handleUseThisImage = () => {
    if (generatedUrl) {
      onImageGenerated(generatedUrl);
      onClose();
    }
  };

  const handleTryAgain = () => {
    setGeneratedUrl(null);
    generate(true);
  };

  const handleClose = () => {
    setGeneratedUrl(null);
    setHasGenerated(false);
    setGenerating(false);
    setSelectedTheme('bright_fresh');
    setCreativity(3);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
          paddingTop: insets.top + 12, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: colors.borderDefault,
        }}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
            {t('imageManager.generateAiImage')}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Free plan gate */}
        {isFreePlan ? (
          <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="sparkles-outline" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
              {t('imageManager.upgradeTitle')}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
              {t('imageManager.upgradeBody')}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={{ backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        ) : generating ? (
          /* Loading state */
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' }}>
              {t('imageManager.generating')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
              {t('imageManager.generatingHint')}
            </Text>
          </View>
        ) : generatedUrl ? (
          /* Preview state */
          <View style={{ flex: 1 }}>
            <Image
              source={{ uri: generatedUrl, headers: { apikey: SUPABASE_ANON_KEY } }}
              style={{ width: '100%', height: 280, resizeMode: 'cover' }}
            />
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                {t('imageManager.previewPrompt')}
              </Text>
              <TouchableOpacity
                onPress={handleUseThisImage}
                style={{
                  backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14,
                  alignItems: 'center', marginBottom: 12,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('imageManager.useThisImage')}</Text>
              </TouchableOpacity>
              {canTryAgain && (
                <TouchableOpacity
                  onPress={handleTryAgain}
                  style={{
                    borderWidth: 1, borderColor: colors.borderDefault,
                    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{t('imageManager.tryAgain')}</Text>
                </TouchableOpacity>
              )}
              {hasGenerated && regenCount >= REGEN_LIMIT && (
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                  {t('imageManager.regenLimitReached')}
                </Text>
              )}
            </View>
          </View>
        ) : (
          /* Configuration state */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          >
            {/* Theme picker */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
              {t('imageManager.chooseTheme')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {THEMES.map((theme) => (
                  <TouchableOpacity
                    key={theme.id}
                    onPress={() => setSelectedTheme(theme.id)}
                    style={{
                      width: 100, borderRadius: 10, overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: selectedTheme === theme.id ? colors.accent : colors.borderDefault,
                      backgroundColor: colors.bgCard,
                    }}
                  >
                    <View style={{ padding: 10, alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 24 }}>{theme.emoji}</Text>
                      <Text style={{
                        fontSize: 11, fontWeight: '600', color: colors.textPrimary,
                        textAlign: 'center', lineHeight: 14,
                      }}>
                        {theme.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Creativity slider */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
              {t('imageManager.creativity')}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
              {creativity === 1 ? t('imageManager.creativityVeryFaithful')
                : creativity === 2 ? t('imageManager.creativityFaithful')
                : creativity === 3 ? t('imageManager.creativityBalanced')
                : creativity === 4 ? t('imageManager.creativityCreative')
                : t('imageManager.creativityVeryCreative')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setCreativity((c) => Math.max(1, c - 1) as CreativityLevel)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: colors.borderDefault,
                }}
              >
                <Text style={{ fontSize: 20, color: colors.textPrimary, lineHeight: 24 }}>−</Text>
              </TouchableOpacity>

              <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setCreativity(n as CreativityLevel)}
                    style={{
                      flex: 1, height: 6, borderRadius: 3,
                      backgroundColor: n <= creativity ? colors.accent : colors.borderDefault,
                    }}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setCreativity((c) => Math.min(5, c + 1) as CreativityLevel)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: colors.bgBase, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: colors.borderDefault,
                }}
              >
                <Text style={{ fontSize: 20, color: colors.textPrimary, lineHeight: 24 }}>+</Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, width: 24, textAlign: 'center' }}>
                {creativity}
              </Text>
            </View>
          </ScrollView>
        )}

        {/* Generate button — shown only in configuration state */}
        {!isFreePlan && !generating && !generatedUrl && (
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: 16, paddingBottom: insets.bottom + 16,
            backgroundColor: colors.bgScreen,
            borderTopWidth: 1, borderTopColor: colors.borderDefault,
          }}>
            <TouchableOpacity
              onPress={() => generate(false)}
              style={{
                backgroundColor: colors.accent, borderRadius: 10,
                paddingVertical: 14, alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {t('imageManager.generateButton')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
