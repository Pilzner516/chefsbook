import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import type { ChefSetup } from '@chefsbook/ui';

type OvenCount = ChefSetup['oven_count'];

const OVEN_OPTIONS: { value: OvenCount; label: string; subtitle: string }[] = [
  { value: 1, label: '1 Oven', subtitle: 'Oven steps will be sequenced' },
  { value: 2, label: '2 Ovens', subtitle: 'Parallel oven use allowed' },
  { value: 0, label: 'None needed', subtitle: 'No oven steps in this menu' },
];

export default function SetupOvensScreen() {
  const { id, chefs: chefsParam } = useLocalSearchParams<{ id: string; chefs: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selected, setSelected] = useState<OvenCount>(1);

  const chefs: string[] = chefsParam ? JSON.parse(chefsParam) : [];

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
          Step 2 of 4
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary }}>
          How many ovens?
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          This affects how oven steps are scheduled.
        </Text>
      </View>

      {/* Options */}
      <View style={{ flex: 1, padding: 20, gap: 14 }}>
        {OVEN_OPTIONS.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => setSelected(opt.value)}
              style={{
                padding: 20,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: isActive ? colors.accent : colors.borderDefault,
                backgroundColor: isActive ? colors.accentSoft : colors.bgCard,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: isActive ? colors.accent : colors.textPrimary,
                }}
              >
                {opt.label}
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
                {opt.subtitle}
              </Text>
            </TouchableOpacity>
          );
        })}
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
              pathname: `/cook-menu/${id}/setup-style` as any,
              params: { chefs: JSON.stringify(chefs), ovenCount: String(selected) },
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
