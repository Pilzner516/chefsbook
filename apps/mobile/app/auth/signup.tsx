import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { Button, Input } from '../../components/UIKit';
import { useTranslation } from 'react-i18next';
import { checkUsernameAvailable } from '@chefsbook/db';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function SignUpScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'short'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUsernameChange = (text: string) => {
    const lower = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(lower);
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!lower) { setUsernameStatus('idle'); return; }
    if (lower.length < 3) { setUsernameStatus('short'); return; }
    if (!USERNAME_RE.test(lower)) { setUsernameStatus('invalid'); return; }

    setUsernameStatus('checking');
    checkTimer.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(lower);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 500);
  };

  const handleSignUp = async () => {
    setError('');
    if (!displayName.trim()) { setError(t('auth.enterName')); return; }
    if (!username || usernameStatus !== 'available') { setError(t('signup.usernameTooShort')); return; }
    if (!email.trim() || !password) { setError(t('auth.enterEmail')); return; }
    if (password.length < 6) { setError(t('auth.passwordLength')); return; }
    setLoading(true);
    try {
      // Family-friendly check
      const { isUsernameFamilyFriendly } = await import('@chefsbook/ai');
      const friendly = await isUsernameFamilyFriendly(username);
      if (!friendly) { setError(t('signup.usernameNotAllowed')); setLoading(false); return; }
      await signUp(email.trim(), password, displayName.trim(), username);
      // Apply promo code if provided
      if (promoCode.trim()) {
        try {
          const { applyPromoCode } = await import('@chefsbook/db');
          const { data: sess } = await (await import('@chefsbook/db')).supabase.auth.getSession();
          if (sess.session?.user?.id) {
            await applyPromoCode(sess.session.user.id, promoCode.trim());
          }
        } catch {} // non-blocking — account created even if promo fails
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? t('auth.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  // TODO: Wire up Google OAuth with Supabase signInWithOAuth
  const handleGoogleSignUp = () => {};

  return (
    <SafeAreaView>
      <View style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('auth.createAccountTitle')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('auth.signUpSubtitle')}
        </Text>

        <View style={styles.form}>
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('auth.fullName')}
            autoCapitalize="words"
          />
          <View style={{ height: 12 }} />
          <View>
            <Input
              value={username}
              onChangeText={handleUsernameChange}
              placeholder={t('signup.usernamePlaceholder')}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, minHeight: 20 }}>
              {usernameStatus === 'checking' && (
                <>
                  <ActivityIndicator size="small" color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('signup.checking')}</Text>
                </>
              )}
              {usernameStatus === 'available' && (
                <Text style={{ color: colors.accentGreen, fontSize: 12, fontWeight: '600' }}>{'\u2713'} {t('signup.usernameAvailable')}</Text>
              )}
              {usernameStatus === 'taken' && (
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{'\u2717'} {t('signup.usernameTaken')}</Text>
              )}
              {usernameStatus === 'short' && (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('signup.usernameTooShort')}</Text>
              )}
              {usernameStatus === 'invalid' && (
                <Text style={{ color: colors.danger, fontSize: 12 }}>{t('signup.usernameInvalid')}</Text>
              )}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{t('signup.usernameHint')}</Text>
          </View>
          <View style={{ height: 12 }} />
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={{ height: 12 }} />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.password')}
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={{ height: 12 }} />
          <Input
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder={t('plans.promoPlaceholder')}
            autoCapitalize="none"
          />

          {error !== '' && (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          )}

          <View style={{ height: 20 }} />
          <Button title={t('auth.signUp')} onPress={handleSignUp} size="lg" loading={loading} />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('common.or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
          </View>

          <Button
            title={t('auth.signUpWithGoogle')}
            onPress={handleGoogleSignUp}
            variant="secondary"
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            {t('auth.haveAccount')}{' '}
          </Text>
          <Text
            style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}
            onPress={() => router.replace('/auth/signin')}
          >
            {t('auth.signIn')}
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 32 },
  form: {},
  error: { fontSize: 13, marginTop: 12 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
});
