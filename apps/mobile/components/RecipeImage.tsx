import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import type { ImageStyle, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const chefsHat = require('../assets/images/chefs-hat.png');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

interface Props {
  uri?: string | null;
  style?: ImageStyle;
  /** Show chef's hat at low opacity as watermark (for edit placeholders) */
  watermark?: boolean;
}

export function RecipeImage({ uri, style, watermark }: Props) {
  const { colors } = useTheme();
  const baseStyle = [styles.base, { backgroundColor: colors.bgScreen }] as const;
  if (uri && /^https?:\/\//.test(uri)) {
    // Self-hosted Supabase requires apikey header even for public buckets (Kong gateway)
    const isSupabase = SUPABASE_URL && uri.startsWith(SUPABASE_URL);
    const source = isSupabase
      ? { uri, headers: { apikey: SUPABASE_ANON_KEY } }
      : { uri };
    return (
      <Image
        source={source}
        style={[...baseStyle, style]}
        resizeMode="cover"
        onError={() => {}}
      />
    );
  }

  // Fallback: chef's hat logo
  return (
    <View style={[...baseStyle, styles.fallback, style]}>
      <Image
        source={chefsHat}
        style={[
          styles.logo,
          watermark && styles.watermark,
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    height: 160,
  } as ImageStyle,
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  logo: {
    width: 64,
    height: 64,
    borderRadius: 12,
  } as ImageStyle,
  watermark: {
    opacity: 0.18,
    width: 48,
    height: 48,
  } as ImageStyle,
});
