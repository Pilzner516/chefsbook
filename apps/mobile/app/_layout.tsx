import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { configureStorage } from '@chefsbook/db';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';
import { PinnedBar } from '../components/PinnedBar';
import { ImportBanner } from '../components/ImportBanner';
import { Loading } from '../components/UIKit';
import '../lib/i18n';
import { activateLanguage } from '../lib/i18n';

// Wire SecureStore as the Supabase auth storage adapter so sessions persist across launches
configureStorage({
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
});

function useProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const segments = useSegments();
  const router = useRouter();
  const navRef = useNavigationContainerRef();
  const [navReady, setNavReady] = useState(false);
  const loadFromLocal = usePreferencesStore((s) => s.loadFromLocal);
  const loadFromSupabase = usePreferencesStore((s) => s.loadFromSupabase);
  const language = usePreferencesStore((s) => s.language);

  // Sync i18n language when preference changes
  useEffect(() => {
    activateLanguage(language);
  }, [language]);

  useEffect(() => {
    if (navRef?.isReady()) setNavReady(true);
    const unsubscribe = navRef?.addListener?.('state', () => {
      if (navRef.isReady()) setNavReady(true);
    });
    return unsubscribe;
  }, [navRef]);

  // Load preferences on auth
  useEffect(() => {
    loadFromLocal();
    if (session?.user?.id) {
      loadFromSupabase(session.user.id);
    }
  }, [session?.user?.id]);

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
  const router = useRouter();
  const loading = useAuthStore((s) => s.loading);

  useProtectedRoute();

  // Handle URLs shared from browser / Instagram share sheet
  useEffect(() => {
    const isInstagramUrl = (u: string) =>
      u.includes('instagram.com/p/') || u.includes('instagram.com/reel/');

    const handleUrl = ({ url }: { url: string }) => {
      if (url && /^https?:\/\//i.test(url)) {
        if (isInstagramUrl(url)) {
          router.push({ pathname: '/(tabs)/scan', params: { instagramUrl: url } });
        } else {
          router.push({ pathname: '/(tabs)/scan', params: { importUrl: url } });
        }
      }
    };

    // Check for URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url && /^https?:\/\//i.test(url)) {
        if (isInstagramUrl(url)) {
          router.push({ pathname: '/(tabs)/scan', params: { instagramUrl: url } });
        } else {
          router.push({ pathname: '/(tabs)/scan', params: { importUrl: url } });
        }
      }
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

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
        <Stack.Screen name="plans" options={{ title: 'Plans' }} />
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
