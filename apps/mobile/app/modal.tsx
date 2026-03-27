import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { PLAN_LIMITS } from '@chefsbook/db/subscriptions';
import { Avatar, Button, Card, Divider, Input, Badge } from '../components/UIKit';
import { getInitials } from '@chefsbook/ui';

export default function SettingsModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session, profile, planTier, signIn, signUp, signOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAnonymous = !session?.user?.email;

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <View style={{ padding: 16, gap: 16 }}>
        {!isAnonymous && profile && (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Avatar uri={profile.avatar_url} initials={getInitials(profile.display_name)} size={64} />
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 }}>
                {profile.display_name}
              </Text>
              {profile.username && (
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>@{profile.username}</Text>
              )}
              <View style={{ marginTop: 8 }}>
                <Badge label={planTier.toUpperCase()} color={planTier === 'free' ? colors.textSecondary : colors.accent} />
              </View>
            </View>
          </Card>
        )}

        {isAnonymous && (
          <Card>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
            {isSignUp && (
              <View style={{ marginBottom: 10 }}>
                <Input value={name} onChangeText={setName} placeholder="Display name" autoCapitalize="words" />
              </View>
            )}
            <View style={{ marginBottom: 10 }}>
              <Input value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
            </View>
            <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
            <View style={{ marginTop: 12 }}>
              <Button title={isSignUp ? 'Create Account' : 'Sign In'} onPress={handleAuth} loading={loading} />
            </View>
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <Button
                title={isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                onPress={() => setIsSignUp(!isSignUp)}
                variant="ghost"
                size="sm"
              />
            </View>
          </Card>
        )}

        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Subscription</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>
            Current plan: {planTier.charAt(0).toUpperCase() + planTier.slice(1)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Recipes: {PLAN_LIMITS[planTier].maxRecipes === Infinity ? 'Unlimited' : PLAN_LIMITS[planTier].maxRecipes}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Scans/month: {PLAN_LIMITS[planTier].maxScansPerMonth === Infinity ? 'Unlimited' : PLAN_LIMITS[planTier].maxScansPerMonth}
          </Text>
        </Card>

        {!isAnonymous && (
          <Button
            title="Sign Out"
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
              ]);
            }}
            variant="ghost"
          />
        )}
      </View>
    </ScrollView>
  );
}
