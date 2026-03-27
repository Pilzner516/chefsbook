import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { PinnedBar } from '../components/PinnedBar';
import { ImportBanner } from '../components/ImportBanner';

function RootNav() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <ImportBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgScreen },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.bgScreen },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
        <Stack.Screen name="recipe/new" options={{ title: 'New Recipe' }} />
        <Stack.Screen name="cookbook/[id]" options={{ title: 'Cookbook' }} />
        <Stack.Screen name="chef/[id]" options={{ title: 'Chef' }} />
        <Stack.Screen name="share/[token]" options={{ title: 'Shared Recipe' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Settings' }} />
      </Stack>
      <PinnedBar />
    </View>
  );
}

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
