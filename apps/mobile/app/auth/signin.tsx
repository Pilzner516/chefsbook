import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { Button, Input } from '../../components/UIKit';

export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  // TODO: Wire up Google OAuth with Supabase signInWithOAuth
  const handleGoogleSignIn = () => {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sign in to your ChefsBook account
        </Text>

        <View style={styles.form}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={{ height: 12 }} />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
          />

          {error !== '' && (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          )}

          <View style={{ height: 20 }} />
          <Button title="Sign In" onPress={handleSignIn} size="lg" loading={loading} />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
          </View>

          <Button
            title="Sign in with Google"
            onPress={handleGoogleSignIn}
            variant="secondary"
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Don't have an account?{' '}
          </Text>
          <Text
            style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}
            onPress={() => router.replace('/auth/signup')}
          >
            Sign Up
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
