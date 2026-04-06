import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export function ChefsBookHeader() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fontFamily = Platform.select({ ios: 'Georgia', default: 'serif' });

  return (
    <View
      style={{
        backgroundColor: colors.bgScreen,
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDefault,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: '700', fontFamily }}>
        <Text style={{ color: colors.textPrimary }}>Chefs</Text>
        <Text style={{ color: colors.accent }}>Book</Text>
      </Text>
    </View>
  );
}
