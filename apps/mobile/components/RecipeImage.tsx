import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import type { ImageStyle, ViewStyle } from 'react-native';

const chefsHat = require('../assets/icon.png');

interface Props {
  uri?: string | null;
  style?: ImageStyle;
  /** Show chef's hat at low opacity as watermark (for edit placeholders) */
  watermark?: boolean;
}

export function RecipeImage({ uri, style, watermark }: Props) {
  if (uri && /^https?:\/\//.test(uri)) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, style]}
        resizeMode="cover"
        onError={() => {}}
      />
    );
  }

  // Fallback: chef's hat logo
  return (
    <View style={[styles.base, styles.fallback, style]}>
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
    backgroundColor: '#faf7f0',
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
