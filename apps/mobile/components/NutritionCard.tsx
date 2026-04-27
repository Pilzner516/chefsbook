import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { supabase } from '@chefsbook/db';
import type { NutritionEstimate } from '@chefsbook/ai';

const TOGGLE_KEY = 'cb-nutrition-toggle';

interface NutritionData {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

const NUTRIENT_CONFIG = [
  { key: 'calories', label: 'Calories', unit: '', colorKey: 'accent' },
  { key: 'protein_g', label: 'Protein', unit: 'g', colorKey: 'blue' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g', colorKey: 'amber' },
  { key: 'fat_g', label: 'Fat', unit: 'g', colorKey: 'orange' },
  { key: 'fiber_g', label: 'Fiber', unit: 'g', colorKey: 'green' },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', colorKey: 'pink' },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', colorKey: 'purple' },
] as const;

const NUTRIENT_COLORS: Record<string, string> = {
  accent: '#ce2b37',
  blue: '#2563eb',
  amber: '#d97706',
  orange: '#ea580c',
  green: '#16a34a',
  pink: '#db2777',
  purple: '#7c3aed',
};

interface Props {
  recipeId: string;
  nutrition: NutritionEstimate | null;
  isOwner: boolean;
  servings: number | null;
  onNutritionUpdated?: (nutrition: NutritionEstimate) => void;
}

export function NutritionCard({ recipeId, nutrition: initialNutrition, isOwner, servings, onNutritionUpdated }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);

  const [nutrition, setNutrition] = useState<NutritionEstimate | null>(initialNutrition);
  const [view, setView] = useState<'serving' | '100g'>('serving');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore toggle preference from SecureStore
  useEffect(() => {
    SecureStore.getItemAsync(TOGGLE_KEY).then((saved) => {
      if (saved === '100g' && nutrition?.per_100g) {
        setView('100g');
      }
    });
  }, [nutrition]);

  // Update if initialNutrition changes (e.g., after parent refetch)
  useEffect(() => {
    setNutrition(initialNutrition);
  }, [initialNutrition]);

  const handleToggle = async (newView: 'serving' | '100g') => {
    setView(newView);
    await SecureStore.setItemAsync(TOGGLE_KEY, newView);
  };

  const handleGenerate = async () => {
    if (!session?.access_token) {
      Alert.alert(t('common.errorTitle'), 'Not authenticated');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`https://chefsbk.app/api/recipes/${recipeId}/generate-nutrition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }

      const { nutrition: newNutrition } = await res.json();
      setNutrition(newNutrition);
      onNutritionUpdated?.(newNutrition);
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate nutrition');
      setTimeout(() => setError(null), 5000);
    } finally {
      setGenerating(false);
    }
  };

  // If no nutrition and not owner, hide entirely
  if (!nutrition && !isOwner) {
    return null;
  }

  // Empty state with Generate CTA for owner
  if (!nutrition) {
    return (
      <View style={{ marginTop: 16 }}>
        <View style={{
          backgroundColor: colors.bgBase,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          borderLeftWidth: 4,
          borderLeftColor: colors.accent,
          overflow: 'hidden',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🥗</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>
              {t('nutrition.notYetGenerated', 'Nutrition data not yet generated')}
            </Text>
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={generating}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: generating ? 0.6 : 1,
              }}
            >
              {generating ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
                    {t('common.generating', 'Generating...')}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 12 }}>✨</Text>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
                    {t('nutrition.generate', 'Generate')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {error && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fef2f2' }}>
              <Text style={{ color: '#b91c1c', fontSize: 13 }}>{error}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Get the data to display based on toggle
  const data = view === '100g' && nutrition.per_100g ? nutrition.per_100g : nutrition.per_serving;
  const isLowConfidence = nutrition.confidence < 0.5;

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{
        backgroundColor: colors.bgBase,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        borderLeftWidth: 4,
        borderLeftColor: colors.accent,
        overflow: 'hidden',
      }}>
        {/* Header with toggle */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '700' }}>
              {t('nutrition.title', 'Nutrition Facts')}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              ✨ {t('nutrition.estimate', 'Estimate')}
            </Text>
          </View>
          {nutrition.per_100g && (
            <View style={{ flexDirection: 'row', backgroundColor: colors.bgScreen, borderRadius: 16, padding: 2 }}>
              <TouchableOpacity
                onPress={() => handleToggle('serving')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  backgroundColor: view === 'serving' ? colors.accent : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: view === 'serving' ? '#ffffff' : colors.textSecondary,
                }}>
                  {t('nutrition.perServing', 'Per Serving')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleToggle('100g')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 14,
                  backgroundColor: view === '100g' ? colors.accent : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: view === '100g' ? '#ffffff' : colors.textSecondary,
                }}>
                  {t('nutrition.per100g', 'Per 100g')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Low confidence warning */}
        {isLowConfidence && (
          <View style={{
            backgroundColor: '#fef3c7',
            borderTopWidth: 1,
            borderTopColor: '#fcd34d',
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ fontSize: 14 }}>⚠️</Text>
            <Text style={{ color: '#92400e', fontSize: 12, flex: 1 }}>
              {t('nutrition.lowConfidence', 'Limited ingredient data — these values are rough estimates only.')}
            </Text>
          </View>
        )}

        {/* Nutrient grid - 2 columns */}
        <View style={{
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}>
          {generating ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {NUTRIENT_CONFIG.map((n) => (
                <View key={n.key} style={{
                  width: '48%',
                  backgroundColor: colors.bgCard,
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                }}>
                  <View style={{ width: 40, height: 12, backgroundColor: colors.bgBase, borderRadius: 4, marginBottom: 8 }} />
                  <View style={{ width: 60, height: 20, backgroundColor: colors.bgBase, borderRadius: 4 }} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {NUTRIENT_CONFIG.map((n) => {
                const value = data[n.key as keyof NutritionData];
                const color = NUTRIENT_COLORS[n.colorKey] || colors.accent;
                return (
                  <View key={n.key} style={{
                    width: '48%',
                    backgroundColor: colors.bgCard,
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.borderDefault,
                  }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                      {t(`nutrition.${n.key}`, n.label)}
                    </Text>
                    <Text style={{ color, fontSize: 20, fontWeight: '700' }}>
                      {typeof value === 'number' ? value.toFixed(1) : '—'}
                      <Text style={{ fontSize: 14, fontWeight: '400', color: colors.textSecondary }}>
                        {n.unit && ` ${n.unit}`}
                      </Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Footer with disclaimer and regenerate */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 10, flex: 1, marginRight: 12 }}>
            {t('nutrition.disclaimer', 'Estimated by Sous Chef. Not a substitute for professional dietary advice.')}
          </Text>
          {isOwner && (
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={generating}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: generating ? 0.5 : 1 }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>↻</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {t('nutrition.regenerate', 'Regenerate')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Error toast */}
        {error && (
          <View style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: '#fef2f2',
            borderTopWidth: 1,
            borderTopColor: '#fecaca',
          }}>
            <Text style={{ color: '#b91c1c', fontSize: 13 }}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
