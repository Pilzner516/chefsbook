import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '@chefsbook/db';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

interface KnowledgeGap {
  id: string;
  technique: string;
  ingredient_category: string | null;
  request_title: string;
  request_body: string;
}

const DISMISS_KEY_PREFIX = 'cb_gap_dismiss_';
const DISMISS_DURATION_DAYS = 7;

/**
 * Community knowledge gap request card.
 * Shows after FeedbackCard in My Recipes FlashList header.
 * Rotates through active gaps, dismissible for 7 days per gap.
 */
export function GapRequestCard() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [gap, setGap] = useState<KnowledgeGap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveGap();
  }, []);

  const loadActiveGap = async () => {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch active gaps
      const { data: gaps } = await supabase
        .from('knowledge_gaps')
        .select('id, technique, ingredient_category, request_title, request_body')
        .eq('status', 'active')
        .limit(10);

      if (!gaps || gaps.length === 0) {
        setLoading(false);
        return;
      }

      // Filter out dismissed gaps
      const now = Date.now();
      const availableGaps: KnowledgeGap[] = [];

      for (const g of gaps) {
        const dismissKey = `${DISMISS_KEY_PREFIX}${g.id}`;
        const dismissedUntil = await AsyncStorage.getItem(dismissKey);
        if (!dismissedUntil || parseInt(dismissedUntil, 10) < now) {
          availableGaps.push(g);
        }
      }

      if (availableGaps.length === 0) {
        setLoading(false);
        return;
      }

      // Pick one randomly
      const randomGap = availableGaps[Math.floor(Math.random() * availableGaps.length)];
      setGap(randomGap);
    } catch (error) {
      console.error('Failed to load knowledge gap:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!gap) return;
    const dismissKey = `${DISMISS_KEY_PREFIX}${gap.id}`;
    const dismissUntil = Date.now() + DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(dismissKey, dismissUntil.toString());
    setGap(null);
  };

  const handleContribute = () => {
    if (!gap) return;
    // Navigate to scan tab with gap context
    router.push({ pathname: '/(tabs)/scan', params: { gapId: gap.id } });
  };

  if (loading || !gap) return null;

  return (
    <View
      style={{
        backgroundColor: '#fef3c7',
        borderWidth: 2,
        borderColor: '#fcd34d',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {/* Brain icon */}
        <View style={{ paddingTop: 2 }}>
          <Text style={{ fontSize: 32 }}>🧠</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#78350f', marginBottom: 4 }}>
            {t('gapRequest.title', 'Our Sous Chef is looking for...')}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#92400e', marginBottom: 8 }}>
            {gap.request_title}
          </Text>
          <Text style={{ fontSize: 13, color: '#a16207', marginBottom: 12 }}>
            {gap.request_body || t('gapRequest.body', 'Help teach ChefsBook something new')}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={handleContribute}
              style={{
                backgroundColor: '#d97706',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
                {t('gapRequest.cta', 'I have one!')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDismiss}>
              <Text style={{ color: '#d97706', fontSize: 13, fontWeight: '600' }}>
                {t('gapRequest.dismiss', 'Not now')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Text style={{ fontSize: 16 }}>⭐</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#d97706' }}>
              {t('gapRequest.doublePoints', 'Earn 40 points')}
            </Text>
            <Text style={{ fontSize: 12, color: '#fbbf24' }}>·</Text>
            <Text style={{ fontSize: 11, color: '#a16207' }}>
              2× bonus
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
