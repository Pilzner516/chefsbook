import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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

function SuspendedNotice() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.bgScreen }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🚫</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>Account Suspended</Text>
      <Text style={{ fontSize: 14, color: '#7a6a5a', textAlign: 'center' }}>
        Your account has been suspended. If you believe this is a mistake, please contact support@chefsbk.app.
      </Text>
    </View>
  );
}

function RootNav() {
  const { colors } = useTheme();
  const router = useRouter();
  const loading = useAuthStore((s) => s.loading);
  const profile = useAuthStore((s) => s.profile);

  useProtectedRoute();

  const [frozenDismissed, setFrozenDismissed] = useState(false);

  if (profile?.is_suspended) return <SuspendedNotice />;

  const showFrozenBanner = profile?.recipes_frozen && !frozenDismissed;

  // Handle URLs shared from browser / Instagram share sheet
  useEffect(() => {
    const isInstagramUrl = (u: string) =>
      u.includes('instagram.com/p/') || u.includes('instagram.com/reel/');

    const isChefsbkRecipeUrl = (u: string) =>
      u.includes('chefsbk.app/recipe/') || u.includes('chefsbook.app/recipe/');

    const handleUrl = ({ url }: { url: string }) => {
      if (!url || !/^https?:\/\//i.test(url)) return;
      if (isChefsbkRecipeUrl(url)) {
        const recipeId = url.split('/recipe/')[1]?.split('?')[0];
        if (recipeId) router.push(`/recipe/${recipeId}`);
      } else if (isInstagramUrl(url)) {
        router.push({ pathname: '/(tabs)/scan', params: { instagramUrl: url } });
      } else {
        router.push({ pathname: '/(tabs)/scan', params: { importUrl: url } });
      }
    };

    // Check for URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (!url || !/^https?:\/\//i.test(url)) return;
      if (isChefsbkRecipeUrl(url)) {
        const recipeId = url.split('/recipe/')[1]?.split('?')[0];
        if (recipeId) router.push(`/recipe/${recipeId}`);
      } else if (isInstagramUrl(url)) {
        router.push({ pathname: '/(tabs)/scan', params: { instagramUrl: url } });
      } else {
        router.push({ pathname: '/(tabs)/scan', params: { importUrl: url } });
      }
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      {showFrozenBanner && (
        <View style={{ backgroundColor: '#fef3c7', borderBottomWidth: 1, borderBottomColor: '#fbbf24', padding: 16 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: '#92400e', marginBottom: 4 }}>Account Under Review</Text>
          <Text style={{ fontSize: 13, color: '#92400e', lineHeight: 18 }}>
            Your public recipes have been temporarily hidden pending review. You can still access your private recipes.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:support@chefsbk.app')} style={{ backgroundColor: '#fbbf24', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#92400e', fontWeight: '600', fontSize: 13 }}>Contact Support</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFrozenDismissed(true)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#92400e', fontSize: 13 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
        <Stack.Screen name="messages" options={{ presentation: 'modal', headerShown: false }} />
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
