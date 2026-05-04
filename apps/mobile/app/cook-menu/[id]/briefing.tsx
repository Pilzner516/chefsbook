import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { getCookingSession, updateCookingSession } from '@chefsbook/db';
import { generateChefBriefing } from '@chefsbook/ai';
import type { CookingSession } from '@chefsbook/db';

export default function BriefingScreen() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [session, setSession] = useState<CookingSession | null>(null);
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const s = await getCookingSession(sessionId);
        if (cancelled || !s) return;
        setSession(s);

        const text = await generateChefBriefing(s.plan);
        if (cancelled) return;
        setBriefing(text);

        // Speak the briefing
        const Speech = require('expo-speech');
        Speech.stop();
        Speech.speak(text, { language: 'en' });
      } catch {
        if (!cancelled) setBriefing("Let's cook. Follow the steps and trust the plan. Let's go.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      try {
        const Speech = require('expo-speech');
        Speech.stop();
      } catch {
        // ignore
      }
    };
  }, [sessionId]);

  const handleStartCooking = async () => {
    if (!session) return;
    try {
      await updateCookingSession(
        session.id,
        { status: 'cooking', current_step_index: 0 },
        session.version
      );
    } catch {
      // proceed anyway — UI will refetch
    }
    router.replace({
      pathname: `/cook-menu/${id}/active` as any,
      params: { sessionId },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f1117' }}>
      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingHorizontal: 28,
          paddingBottom: 24,
          flexGrow: 1,
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <ActivityIndicator color="#ce2b37" size="large" />
            <Text style={{ color: '#9ca3af', fontSize: 15, textAlign: 'center' }}>
              Preparing your briefing...
            </Text>
          </View>
        ) : (
          <View>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#ce2b37',
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 20,
              }}
            >
              Chef's Briefing
            </Text>
            <Text
              style={{
                fontSize: 22,
                lineHeight: 36,
                color: '#f9fafb',
                fontWeight: '400',
              }}
            >
              {briefing}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Start button */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: '#1f2937',
        }}
      >
        <TouchableOpacity
          onPress={handleStartCooking}
          disabled={loading || !session}
          style={{
            height: 60,
            borderRadius: 14,
            backgroundColor: '#ce2b37',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loading || !session ? 0.4 : 1,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>
            Start cooking
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
