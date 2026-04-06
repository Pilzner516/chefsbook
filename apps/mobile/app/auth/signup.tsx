import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { Button, Input } from '../../components/UIKit';

export default function SignUpScreen() {
  const { colors } = useTheme();
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
      setError('Please enter your name.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Sign up failed.');
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Start building your recipe collection
        </Text>

        <View style={styles.form}>
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Full name"
            autoCapitalize="words"
          />
          <View style={{ height: 12 }} />
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
          <Button title="Create Account" onPress={handleSignUp} size="lg" loading={loading} />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
          </View>

          <Button
            title="Sign up with Google"
            onPress={handleGoogleSignUp}
            variant="secondary"
            size="lg"
          />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Already have an account?{' '}
          </Text>
          <Text
            style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}
            onPress={() => router.replace('/auth/signin')}
          >
            Sign In
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
