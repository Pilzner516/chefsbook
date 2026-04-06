import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/UIKit';

export default function LandingScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgScreen }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>
            <Text style={[styles.logoChefs, { color: colors.textPrimary }]}>Chefs</Text>
            <Text style={[styles.logoBook, { color: colors.accent }]}>Book</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Your recipes, all in one place.
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button
            title="Sign In"
            onPress={() => router.push('/auth/signin')}
            variant="primary"
            size="lg"
          />
          <View style={{ height: 12 }} />
          <Button
            title="Create Account"
            onPress={() => router.push('/auth/signup')}
            variant="secondary"
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
  },
  logoChefs: {
    fontFamily: 'serif',
  },
  logoBook: {
    fontFamily: 'serif',
  },
  tagline: {
    fontSize: 16,
    marginTop: 12,
  },
  buttons: {
    paddingHorizontal: 16,
  },
});
