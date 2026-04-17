import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { PLAN_LIMITS, devChangePlan } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/UIKit';
import { useTabBarHeight } from '../lib/useTabBarHeight';

const TIERS: { key: PlanTier; price: string; annual: string }[] = [
  { key: 'free', price: '$0', annual: '$0' },
  { key: 'chef', price: '$4.99', annual: '$3.99' },
  { key: 'family', price: '$9.99', annual: '$7.99' },
  { key: 'pro', price: '$14.99', annual: '$11.99' },
];

function featureRow(label: string, value: number | boolean, colors: any, t: any) {
  if (typeof value === 'boolean') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
        <Ionicons name={value ? 'checkmark-circle' : 'close-circle'} size={16} color={value ? colors.accentGreen : colors.textMuted} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      <Ionicons name="checkmark-circle" size={16} color={colors.accentGreen} style={{ marginRight: 8 }} />
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{label}: {value === Infinity ? t('plans.unlimited') : value}</Text>
    </View>
  );
}

export default function PlansScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [changing, setChanging] = useState<string | null>(null);

  const handleChangePlan = async (plan: PlanTier) => {
    if (!session?.user?.id || plan === planTier) return;
    setChanging(plan);
    try {
      await devChangePlan(session.user.id, plan);
      await loadProfile();
      Alert.alert('Plan updated', `You are now on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setChanging(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight }}>
      {/* Dev banner */}
      <View style={{ backgroundColor: colors.accentSoft, borderRadius: 8, padding: 10, marginBottom: 16, alignItems: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{t('plans.devBanner')}</Text>
      </View>

      <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 4 }}>{t('plans.title')}</Text>

      {/* Billing toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
        <TouchableOpacity onPress={() => setBilling('monthly')} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: billing === 'monthly' ? colors.accent : colors.bgBase }}>
          <Text style={{ color: billing === 'monthly' ? '#ffffff' : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('plans.monthly')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setBilling('annual')} style={{ paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: billing === 'annual' ? colors.accent : colors.bgBase }}>
          <Text style={{ color: billing === 'annual' ? '#ffffff' : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('plans.annual')}</Text>
        </TouchableOpacity>
        {billing === 'annual' && <Text style={{ color: colors.accentGreen, fontSize: 12, fontWeight: '600' }}>{t('plans.save20')}</Text>}
      </View>

      {/* Tier cards */}
      {TIERS.map((tier) => {
        const limits = PLAN_LIMITS[tier.key];
        const isCurrent = planTier === tier.key;
        const price = billing === 'annual' ? tier.annual : tier.price;
        return (
          <View
            key={tier.key}
            style={{
              backgroundColor: colors.bgCard, borderRadius: 14, padding: 16, marginBottom: 12,
              borderWidth: isCurrent ? 2 : 1, borderColor: isCurrent ? colors.accent : colors.borderDefault,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                {t(`plans.${tier.key}`)}
              </Text>
              {isCurrent && (
                <View style={{ backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>{t('plans.currentPlan')}</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.accent, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
              {price}<Text style={{ fontSize: 13, fontWeight: '400', color: colors.textMuted }}>{tier.key !== 'free' ? t('plans.perMonth') : ''}</Text>
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>{t(`plans.${tier.key}Desc`)}</Text>

            {featureRow(t('plans.ownRecipes'), limits.ownRecipes, colors, t)}
            {featureRow(t('plans.shoppingLists'), limits.shoppingLists, colors, t)}
            {featureRow(t('plans.cookbooks'), limits.cookbooks, colors, t)}
            {featureRow(t('plans.imagesPerRecipe'), limits.imagesPerRecipe, colors, t)}
            {featureRow(t('plans.aiFeatures'), limits.canAI, colors, t)}
            {featureRow(t('plans.mealPlanning'), limits.canMealPlan, colors, t)}
            {featureRow(t('plans.pdfExport'), limits.canPDF, colors, t)}
            {limits.familyMembers > 0 && featureRow(t('plans.familyMembers'), limits.familyMembers, colors, t)}

            {!isCurrent && (
              <View style={{ marginTop: 12 }}>
                <Button
                  title={changing === tier.key ? '...' : t(TIERS.indexOf(tier) > TIERS.findIndex((t) => t.key === planTier) ? 'plans.upgrade' : 'plans.downgrade')}
                  onPress={() => handleChangePlan(tier.key)}
                  variant={TIERS.indexOf(tier) > TIERS.findIndex((t) => t.key === planTier) ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={!!changing}
                />
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
