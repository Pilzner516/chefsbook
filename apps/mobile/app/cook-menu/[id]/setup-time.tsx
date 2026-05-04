import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { useAuthStore } from '../../../lib/zustand/authStore';
import { createCookingSession, getMenuWithSteps } from '@chefsbook/db';
import { createCookingPlan } from '@chefsbook/ui';
import type { ChefSetup, ServiceStyle } from '@chefsbook/ui';

export default function SetupTimeScreen() {
  const {
    id,
    chefs: chefsParam,
    ovenCount: ovenCountParam,
    serviceStyle: serviceStyleParam,
    eatingAtTable: eatingAtTableParam,
  } = useLocalSearchParams<{
    id: string;
    chefs: string;
    ovenCount: string;
    serviceStyle: string;
    eatingAtTable: string;
  }>();

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const chefs: string[] = chefsParam ? JSON.parse(chefsParam) : ['Chef'];
  const ovenCount = ovenCountParam ? (Number(ovenCountParam) as 0 | 1 | 2) : 1;
  const serviceStyle = (serviceStyleParam ?? 'plated') as ServiceStyle;
  const eatingAtTable = eatingAtTableParam !== '0';

  // Default serve time: 1 hour from now
  const [serveHour, setServeHour] = useState<number>(() => {
    const d = new Date();
    return (d.getHours() + 1) % 24;
  });
  const [serveMinute, setServeMinute] = useState<number>(0);
  const [showPicker, setShowPicker] = useState(false);
  const [startByLabel, setStartByLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const getServeDate = (): Date => {
    const d = new Date();
    d.setHours(serveHour, serveMinute, 0, 0);
    // If the chosen time is already past, assume tomorrow
    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  useEffect(() => {
    computeStartBy(getServeDate());
  }, [serveHour, serveMinute]);

  const computeStartBy = async (target: Date) => {
    try {
      const menuData = await getMenuWithSteps(id);
      if (!menuData) return;

      const setup: ChefSetup = {
        chefs,
        oven_count: ovenCount,
        service_style: serviceStyle,
        chefs_eating_at_table: eatingAtTable,
        serve_time: target,
      };

      const plan = createCookingPlan(menuData as any, setup);
      if (plan.earliest_start) {
        const diff = Math.max(
          0,
          Math.round((target.getTime() - plan.earliest_start.getTime()) / 60000)
        );
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        const duration = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
        setStartByLabel(
          `Start by ${plan.earliest_start.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })} (${duration} of cooking)`
        );
      }
    } catch {
      // hint is non-critical — silently ignore
    }
  };

  const handleBegin = async (useNow: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const target = useNow ? new Date(Date.now() + 2 * 60 * 1000) : getServeDate();
      const menuData = await getMenuWithSteps(id);
      if (!menuData) throw new Error('Menu not found');

      const setup: ChefSetup = {
        chefs,
        oven_count: ovenCount,
        service_style: serviceStyle,
        chefs_eating_at_table: eatingAtTable,
        serve_time: target,
      };

      const plan = createCookingPlan(menuData as any, setup);
      const userId = session?.user?.id ?? '';
      const cookingSession = await createCookingSession(id, userId, setup, plan);

      router.push({
        pathname: `/cook-menu/${id}/briefing` as any,
        params: { sessionId: cookingSession.id },
      });
    } catch (err) {
      console.error('Failed to create cooking session', err);
    } finally {
      setSaving(false);
    }
  };

  const timeLabel = `${String(serveHour).padStart(2, '0')}:${String(serveMinute).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: colors.bgCard,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 4 }}>
          Step 4 of 4
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>
          When are you serving?
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          We'll calculate when to start each step.
        </Text>
      </View>

      <View style={{ flex: 1, padding: 20 }}>
        {/* Time display + tap to change */}
        <View
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            padding: 20,
            marginBottom: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
            Serve time
          </Text>
          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <Text style={{ fontSize: 52, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] }}>
              {timeLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={{
              marginTop: 10,
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: colors.bgBase,
              borderWidth: 1,
              borderColor: colors.borderDefault,
            }}
          >
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Change time</Text>
          </TouchableOpacity>
        </View>

        {/* Start-by hint */}
        {!!startByLabel && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.accentSoft,
            }}
          >
            <Text style={{ fontSize: 18 }}>⏱</Text>
            <Text style={{ flex: 1, fontSize: 14, color: colors.accent, fontWeight: '500' }}>
              {startByLabel}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom buttons */}
      <View
        style={{
          gap: 10,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: colors.bgCard,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}
      >
        <TouchableOpacity
          onPress={() => handleBegin(false)}
          disabled={saving}
          style={{
            height: 56,
            borderRadius: 14,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>
            {saving ? 'Preparing...' : 'Meet Chef'}
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              backgroundColor: colors.bgBase,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleBegin(true)}
            disabled={saving}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.accent,
              backgroundColor: 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.accent }}>Start now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time picker modal */}
      <Modal visible={showPicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 20, width: 280 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 16 }}>
              Set serve time
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              {/* Hours */}
              <ScrollView style={{ height: 150, width: 64 }} showsVerticalScrollIndicator={false}>
                {Array.from({ length: 24 }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setServeHour(i)}
                    style={{
                      padding: 8,
                      alignItems: 'center',
                      backgroundColor: serveHour === i ? colors.accentSoft : 'transparent',
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 18, color: serveHour === i ? colors.accent : colors.textPrimary, fontWeight: serveHour === i ? '700' : '400' }}>
                      {String(i).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ fontSize: 28, fontWeight: '700', color: colors.textPrimary }}>:</Text>
              {/* Minutes */}
              <ScrollView style={{ height: 150, width: 64 }} showsVerticalScrollIndicator={false}>
                {[0, 15, 30, 45].map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setServeMinute(m)}
                    style={{
                      padding: 8,
                      alignItems: 'center',
                      backgroundColor: serveMinute === m ? colors.accentSoft : 'transparent',
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 18, color: serveMinute === m ? colors.accent : colors.textPrimary, fontWeight: serveMinute === m ? '700' : '400' }}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.bgBase, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
