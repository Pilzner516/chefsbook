import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { Button, Input } from '../../components/UIKit';
import { useTranslation } from 'react-i18next';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError('');
    if (!displayName.trim()) {
      setError(t('auth.enterName'));
      return;
    }
    if (!email.trim() || !password) {
      setError(t('auth.enterEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordLength'));
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
      </KeyboardAvoidingView>
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
