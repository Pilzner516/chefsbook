import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { PinnedBar } from '../components/PinnedBar';
import { ImportBanner } from '../components/ImportBanner';
import { Loading } from '../components/UIKit';

function useProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const segments = useSegments();
  const router = useRouter();
  const navRef = useNavigationContainerRef();
  const [navReady, setNavReady] = useState(false);

  useEffect(() => {
    if (navRef?.isReady()) setNavReady(true);
    const unsubscribe = navRef?.addListener?.('state', () => {
      if (navRef.isReady()) setNavReady(true);
    });
    return unsubscribe;
  }, [navRef]);

  useEffect(() => {
    if (loading || !navReady) return;

    const inAuth = segments[0] === 'auth';
    const inTabs = segments[0] === '(tabs)';
    const isLanding = (segments as string[]).length === 0 || segments[0] === undefined;
    const isAnonymous = session?.user?.is_anonymous === true;
    const isAuthenticated = session && !isAnonymous;

    if (isAuthenticated && (inAuth || isLanding)) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && inTabs) {
      router.replace('/');
    }
  }, [session, loading, segments, navReady]);
}

function RootNav() {
  const { colors } = useTheme();
  const loading = useAuthStore((s) => s.loading);

  useProtectedRoute();

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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/signin" options={{ title: 'Sign In', headerBackTitle: 'Back' }} />
        <Stack.Screen name="auth/signup" options={{ title: 'Sign Up', headerBackTitle: 'Back' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
        <Stack.Screen name="recipe/new" options={{ title: 'New Recipe' }} />
        <Stack.Screen name="cookbook/[id]" options={{ title: 'Cookbook' }} />
        <Stack.Screen name="chef/[id]" options={{ title: 'Chef' }} />
        <Stack.Screen name="share/[token]" options={{ title: 'Shared Recipe' }} />
        <Stack.Screen name="speak" options={{ title: 'Speak a Recipe' }} />
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
