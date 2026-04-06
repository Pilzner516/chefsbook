import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

export default function LandingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontFamily = Platform.select({ ios: 'Georgia', default: 'serif' });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgScreen,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* App icon */}
      <Image
        source={require('../assets/icon.png')}
        style={{
          width: 120,
          height: 120,
          borderRadius: 26,
          marginBottom: 20,
          alignSelf: 'center',
        }}
        resizeMode="contain"
      />

      {/* ChefsBook logo */}
      <Text style={{
        fontSize: 34,
        fontWeight: 'bold',
        fontFamily,
        textAlign: 'center',
        marginBottom: 8,
      }}>
        <Text style={{ color: colors.textPrimary }}>Chefs</Text>
        <Text style={{ color: colors.accent }}>Book</Text>
      </Text>

      {/* Tagline */}
      <Text style={{
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
        fontFamily,
      }}>
        Your recipes, beautifully organized
      </Text>

      {/* Three dots */}
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 40 }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.borderDefault }} />
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent }} />
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.borderDefault }} />
      </View>

      {/* Sign In button */}
      <TouchableOpacity
        onPress={() => router.push('/auth/signin')}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>Sign In</Text>
      </TouchableOpacity>

      {/* Create Account button */}
      <TouchableOpacity
        onPress={() => router.push('/auth/signup')}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 26,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 16,
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>Create Account</Text>
      </TouchableOpacity>

      {/* Continue as guest */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, width: '100%' }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.borderDefault }} />
        <TouchableOpacity onPress={() => router.push('/(tabs)/' as any)} style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Continue as guest</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.borderDefault }} />
      </View>
    </View>
  );
}
