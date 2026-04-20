import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Stack, useRouter, useSegments, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { configureStorage } from '@chefsbook/db';
import { getPendingCameraResult, storePendingRecoveryUri } from '../lib/image';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';
import { PinnedBar } from '../components/PinnedBar';
import { ImportBanner } from '../components/ImportBanner';
import { Loading } from '../components/UIKit';
import '../lib/i18n';
import { activateLanguage } from '../lib/i18n';

// Keep the native splash visible during JS bootstrap so the branded splash
// doesn't flash in and out. A 3-second minimum hold below gives the user time
// to see the ChefsBook wordmark + tagline before the landing / tabs render.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Minimum time to show the branded splash after JS mount (cold launch only —
// warm resume does not re-run module scope, so the splash never re-appears).
const SPLASH_MIN_MS = 3000;

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
      // Check for a pending camera result from Android Activity Recreation before
      // deciding which tab to land on. If a result exists, route to scan so the
      // tab's useFocusEffect can pick it up; otherwise land on the default tab.
      (async () => {
        const uri = await getPendingCameraResult();
        if (uri) {
          storePendingRecoveryUri(uri);
          router.replace('/(tabs)/scan');
        } else {
          router.replace('/(tabs)');
        }
      })();
    } else if (!isAuthenticated && inTabs) {
      router.replace('/');
    }
  }, [session, loading, segments, navReady]);
}

// Branded splash overlay shown for a minimum of SPLASH_MIN_MS on cold launch.
// Rendered at the root on top of everything; hand-off from the native splash
// is seamless because both share the cream Trattoria background.
function SplashOverlay() {
  const fontFamily = Platform.select({ ios: 'Georgia', default: 'serif' });
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#faf7f0',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <Image
        source={require('../assets/images/chefs-hat.png')}
        style={{ width: 160, height: 160, marginBottom: 24 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 42, fontWeight: '700', fontFamily, marginBottom: 8 }}>
        <Text style={{ color: '#1f1b16' }}>Chefs</Text>
        <Text style={{ color: '#ce2b37' }}>Book</Text>
      </Text>
      <Text style={{ fontSize: 15, color: '#7a6a5a', fontStyle: 'italic' }}>
        Welcome to ChefsBook
      </Text>
    </View>
  );
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

  // Cold-launch splash hold: hide the native splash as soon as JS mounts so the
  // JS SplashOverlay (cream bg + hat + wordmark) takes over immediately. Keep the
  // JS overlay visible for SPLASH_MIN_MS after auth settles so users see the
  // branded welcome screen for a full 3 seconds.
  const splashMountRef = useRef(Date.now());
  const [splashDone, setSplashDone] = useState(false);

  // Hide the native Android splash immediately once RN has rendered — the JS
  // overlay renders below it and takes over seamlessly.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Keep the JS overlay up until auth settles + 3 s have elapsed since mount.
  useEffect(() => {
    if (loading) return;
    const elapsed = Date.now() - splashMountRef.current;
    const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
    const timer = setTimeout(() => setSplashDone(true), remaining);
    return () => clearTimeout(timer);
  }, [loading]);

  useProtectedRoute();

  const [frozenDismissed, setFrozenDismissed] = useState(false);

  if (profile?.is_suspended) return <SuspendedNotice />;

  const showFrozenBanner = profile?.recipes_frozen && !frozenDismissed;

  // Handle URLs shared from browser (Android VIEW deep-link intents only — SEND intents are NOT received;
  // that would require a native share-intent receiver module). Instagram scraping was removed in
  // session 138 as unreliable without auth — IG URLs now route to scan with a "screenshot instead" tip.
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
        // IG scraping removed in session 138 — route to scan tab and show "screenshot instead" tip.
        router.push({ pathname: '/(tabs)/scan', params: { instagramTip: '1' } });
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
        // IG scraping removed in session 138 — route to scan tab and show "screenshot instead" tip.
        router.push({ pathname: '/(tabs)/scan', params: { instagramTip: '1' } });
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
      {!splashDone && <SplashOverlay />}
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
