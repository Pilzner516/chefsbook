import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { usePinStore } from '../lib/zustand/pinStore';

export function PinnedBar() {
  const { colors } = useTheme();
  const { pinned, unpin } = usePinStore();
  const router = useRouter();

  if (pinned.length === 0) return null;

  return (
    <View style={{
      backgroundColor: colors.bgCard,
      borderTopWidth: 1,
      borderTopColor: colors.borderDefault,
      paddingVertical: 8,
      paddingHorizontal: 12,
    }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {pinned.map((recipe) => (
          <TouchableOpacity
            key={recipe.id}
            onPress={() => router.push(`/recipe/${recipe.id}`)}
            onLongPress={() => unpin(recipe.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.accentSoft,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 13 }}>{'\uD83D\uDCCC'}</Text>
            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', maxWidth: 120 }} numberOfLines={1}>
              {recipe.title}
            </Text>
            <TouchableOpacity onPress={() => unpin(recipe.id)} hitSlop={8}>
              <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '700' }}>{'\u00D7'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
