import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';
import { LANGUAGES } from '@chefsbook/ui';
import { LanguagePickerModal } from './LanguagePickerModal';

export function ChefsBookHeader() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fontFamily = Platform.select({ ios: 'Georgia', default: 'serif' });
  const session = useAuthStore((s) => s.session);
  const language = usePreferencesStore((s) => s.language);
  const units = usePreferencesStore((s) => s.units);
  const setUnits = usePreferencesStore((s) => s.setUnits);
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const currentFlag = LANGUAGES.find((l) => l.code === language)?.flag ?? '🇺🇸';

  const toggleUnits = () => {
    const next = units === 'imperial' ? 'metric' : 'imperial';
    setUnits(next, session?.user?.id);
  };

  return (
    <View
      style={{
        backgroundColor: colors.bgScreen,
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDefault,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', fontFamily }}>
        <Text style={{ color: colors.textPrimary }}>Chefs</Text>
        <Text style={{ color: colors.accent }}>Book</Text>
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Language flag */}
        <TouchableOpacity
          onPress={() => setLangPickerVisible(true)}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 24 }}>{currentFlag}</Text>
        </TouchableOpacity>

        {/* Unit toggle pill */}
        <View style={{
          flexDirection: 'row',
          width: 72,
          height: 28,
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderDefault,
        }}>
          <TouchableOpacity
            onPress={toggleUnits}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: units === 'metric' ? colors.accent : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: units === 'metric' ? '#ffffff' : colors.textMuted,
            }}>
              kg
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleUnits}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: units === 'imperial' ? colors.accent : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: units === 'imperial' ? '#ffffff' : colors.textMuted,
            }}>
              lb
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <LanguagePickerModal
        visible={langPickerVisible}
        onClose={() => setLangPickerVisible(false)}
      />
    </View>
  );
}
