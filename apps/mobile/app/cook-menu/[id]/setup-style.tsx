import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import type { ServiceStyle } from '@chefsbook/ui';

const STYLE_OPTIONS: { value: ServiceStyle; label: string; description: string; icon: string }[] = [
  {
    value: 'plated',
    label: 'Plated courses',
    description: 'Each course served in sequence at the table',
    icon: '🍽️',
  },
  {
    value: 'buffet',
    label: 'Buffet style',
    description: 'All dishes ready at the same time',
    icon: '🥘',
  },
];

export default function SetupStyleScreen() {
  const { id, chefs: chefsParam, ovenCount: ovenCountParam } = useLocalSearchParams<{
    id: string;
    chefs: string;
    ovenCount: string;
  }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [style, setStyle] = useState<ServiceStyle>('plated');
  const [eatingAtTable, setEatingAtTable] = useState(true);

  const chefs: string[] = chefsParam ? JSON.parse(chefsParam) : [];
  const ovenCount = ovenCountParam ? (Number(ovenCountParam) as 0 | 1 | 2) : 1;

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
          Step 3 of 4
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>
          Service style
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          How will the food be served?
        </Text>
      </View>

      <View style={{ flex: 1, padding: 20 }}>
        {/* Style cards */}
        <View style={{ gap: 14, marginBottom: 28 }}>
          {STYLE_OPTIONS.map((opt) => {
            const isActive = style === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setStyle(opt.value)}
                style={{
                  padding: 20,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: isActive ? colors.accent : colors.borderDefault,
                  backgroundColor: isActive ? colors.accentSoft : colors.bgCard,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <Text style={{ fontSize: 36 }}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: isActive ? colors.accent : colors.textPrimary,
                    }}
                  >
                    {opt.label}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>
                    {opt.description}
                  </Text>
                </View>
                {isActive && (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Eating at table toggle */}
        <TouchableOpacity
          onPress={() => setEatingAtTable((v) => !v)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderRadius: 12,
            backgroundColor: colors.bgCard,
            borderWidth: 1,
            borderColor: colors.borderDefault,
          }}
        >
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
              Eating at table?
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Chefs will also be seated guests
            </Text>
          </View>
          <View
            style={{
              width: 50,
              height: 28,
              borderRadius: 14,
              backgroundColor: eatingAtTable ? colors.accent : colors.bgBase,
              justifyContent: 'center',
              paddingHorizontal: 3,
              borderWidth: 1,
              borderColor: eatingAtTable ? colors.accent : colors.borderDefault,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#fff',
                alignSelf: eatingAtTable ? 'flex-end' : 'flex-start',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2,
              }}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom buttons */}
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
          paddingTop: 12,
          backgroundColor: colors.bgCard,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            flex: 1,
            height: 52,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            backgroundColor: colors.bgBase,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: `/cook-menu/${id}/setup-time` as any,
              params: {
                chefs: JSON.stringify(chefs),
                ovenCount: String(ovenCount),
                serviceStyle: style,
                eatingAtTable: eatingAtTable ? '1' : '0',
              },
            })
          }
          style={{
            flex: 2,
            height: 52,
            borderRadius: 12,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
