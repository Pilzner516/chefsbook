import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { updateProfile, supabase } from '@chefsbook/db';
import { PLAN_LIMITS } from '@chefsbook/db/subscriptions';
import { Avatar, Button, Card, Divider, Input, Badge } from '../components/UIKit';
import { getInitials } from '@chefsbook/ui';

export default function SettingsModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const planTier = useAuthStore((s) => s.planTier);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const loadProfile = useAuthStore((s) => s.loadProfile);

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
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>{t('plans.yourPlan')}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>
            {t('plans.currentPlan')}: {planTier.charAt(0).toUpperCase() + planTier.slice(1)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
            {t('plans.ownRecipes')}: {PLAN_LIMITS[planTier].ownRecipes === Infinity ? t('plans.unlimited') : PLAN_LIMITS[planTier].ownRecipes}
          </Text>
          <View style={{ marginTop: 8 }}>
            <Button title={t('plans.seePlans')} onPress={() => router.push('/plans' as any)} variant="secondary" size="sm" />
          </View>
        </Card>

        {!isAnonymous && profile && (
          <Card>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>{t('settings.accountPrivacy')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14, flex: 1 }}>{t('settings.searchable')}</Text>
              <Switch
                value={profile.is_searchable}
                onValueChange={(value) => {
                  if (!value) {
                    Alert.alert(
                      t('settings.privateMode'),
                      `\u2022 ${t('settings.privateWarning1')}\n\u2022 ${t('settings.privateWarning2')}\n\u2022 ${t('settings.privateWarning3')}`,
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('settings.switchPrivate'),
                          style: 'destructive',
                          onPress: async () => {
                            await updateProfile(profile.id, { is_searchable: false });
                            await loadProfile();
                          },
                        },
                      ],
                    );
                  } else {
                    (async () => {
                      await updateProfile(profile.id, { is_searchable: true });
                      await loadProfile();
                    })();
                  }
                }}
                trackColor={{ true: colors.accentGreen, false: colors.borderDefault }}
                thumbColor="#ffffff"
              />
            </View>
          </Card>
        )}

        {!isAnonymous && (
          <Card>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>{t('settings.changePassword')}</Text>
            <View style={{ marginBottom: 10 }}>
              <Input value={newPw} onChangeText={setNewPw} placeholder={t('settings.newPassword')} secureTextEntry />
            </View>
            <Input value={confirmPw} onChangeText={setConfirmPw} placeholder={t('settings.confirmPassword')} secureTextEntry />
            <View style={{ marginTop: 12 }}>
              <Button
                title={pwSaving ? t('common.saving') : t('settings.changePassword')}
                loading={pwSaving}
                disabled={!newPw || pwSaving}
                onPress={async () => {
                  if (newPw.length < 8) { Alert.alert(t('common.error'), t('settings.pwMin8')); return; }
                  if (newPw !== confirmPw) { Alert.alert(t('common.error'), t('settings.pwMismatch')); return; }
                  setPwSaving(true);
                  try {
                    const { error } = await supabase.auth.updateUser({ password: newPw });
                    if (error) throw error;
                    Alert.alert(t('common.success'), t('settings.pwUpdated'));
                    setNewPw('');
                    setConfirmPw('');
                  } catch (e: any) {
                    Alert.alert(t('common.error'), e.message ?? 'Failed');
                  }
                  setPwSaving(false);
                }}
              />
            </View>
          </Card>
        )}

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
