import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  domain: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

/**
 * Warm bottom toast that thanks the user for discovering a new site.
 * Appears above the tab bar, auto-dismisses after ~5s, user can tap × to close.
 */
export function DiscoveryToast({ domain, onDismiss, autoDismissMs = 5000 }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => onDismiss(),
      );
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, onDismiss, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 96,
        opacity,
        transform: [{ translateY }],
        zIndex: 1000,
      }}
    >
      <View
        style={{
          backgroundColor: colors.bgCard,
          borderLeftWidth: 4,
          borderLeftColor: colors.success ?? '#009246',
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          paddingRight: 36,
          shadowColor: '#009246',
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 22 }}>🌍</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
            You&rsquo;ve helped ChefsBook discover something new
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
            We added <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{domain}</Text>{' '}
            to our list. Thank you for expanding our recipe world.
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ position: 'absolute', top: 8, right: 10 }}
        >
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
