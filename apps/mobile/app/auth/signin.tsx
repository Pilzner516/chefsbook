import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { supabase } from '@chefsbook/db';
import { Button, Input } from '../../components/UIKit';
import { useTranslation } from 'react-i18next';

export default function SignInScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError(t('auth.enterEmail'));
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? t('auth.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { Alert.alert(t('common.error'), t('auth.enterEmail')); return; }
    setForgotLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: 'https://chefsbk.app/auth/reset',
      });
      if (resetError) throw resetError;
      Alert.alert(t('auth.resetSent'), t('auth.resetSentMessage'));
      setShowForgot(false);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? 'Failed to send reset email');
    }
    setForgotLoading(false);
  };

  // TODO: Wire up Google OAuth with Supabase signInWithOAuth
  const handleGoogleSignIn = () => {};

  return (
    <SafeAreaView>
      <View style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('auth.welcomeBack')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('auth.signInSubtitle')}
        </Text>

        <View style={styles.form}>
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

          <TouchableOpacity onPress={() => { setForgotEmail(email); setShowForgot(true); }}>
            <Text style={{ color: colors.accent, fontSize: 13, marginTop: 8 }}>{t('auth.forgotPassword')}</Text>
          </TouchableOpacity>

          {error !== '' && (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          )}

          <View style={{ height: 20 }} />
          <Button title={t('auth.signIn')} onPress={handleSignIn} size="lg" loading={loading} />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{t('common.or')}</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
          </View>

          <Button
            title={t('auth.signInWithGoogle')}
            onPress={handleGoogleSignIn}
            variant="secondary"
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            {t('auth.noAccount')}{' '}
          </Text>
          <Text
            style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}
            onPress={() => router.replace('/auth/signup')}
          >
            {t('auth.signUp')}
          </Text>
        </View>
      </KeyboardAvoidingView>

      {showForgot && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: colors.bgCard, borderRadius: 16, padding: 24 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>{t('auth.resetPassword')}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>{t('auth.resetInstructions')}</Text>
            <Input value={forgotEmail} onChangeText={setForgotEmail} placeholder={t('auth.email')} keyboardType="email-address" autoCapitalize="none" />
            <View style={{ height: 16 }} />
            <Button title={forgotLoading ? t('common.sending') : t('auth.sendResetLink')} onPress={handleForgotPassword} loading={forgotLoading} />
            <View style={{ height: 8 }} />
            <Button title={t('common.cancel')} onPress={() => setShowForgot(false)} variant="ghost" />
          </View>
        </View>
      )}
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
