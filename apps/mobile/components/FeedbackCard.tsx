import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { supabase } from '@chefsbook/db';

export function FeedbackCard() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!session?.user?.id || message.trim().length < 10) return;
    setSending(true);
    try {
      const { error } = await supabase.from('help_requests').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        username: profile?.username,
        message: message.trim(),
        subject: 'Feedback',
        body: message.trim(),
        status: 'open',
      });
      if (error) throw error;
      setOpen(false);
      setMessage('');
      Alert.alert(t('feedback.thankTitle'), t('feedback.thankBody'));
    } catch {
      Alert.alert(t('common.errorTitle'), t('feedback.errorBody'));
    }
    setSending(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.bgScreen, borderWidth: 1, borderColor: colors.accent,
          borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center',
          marginBottom: 8, minHeight: 120,
        }}
      >
        <Image source={require('../assets/icon.png')} style={{ width: 48, height: 48, opacity: 0.6, marginBottom: 8 }} resizeMode="contain" />
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('feedback.title')}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{t('feedback.subtitle')}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bgScreen, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>{t('feedback.title')}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Image source={require('../assets/icon.png')} style={{ width: 48, height: 48, opacity: 0.6 }} resizeMode="contain" />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
              {t('feedback.intro')}
            </Text>
            {profile?.username && (
              <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 24, marginBottom: 8 }}>
                {t('feedback.from')}: <Text style={{ fontWeight: '600', color: colors.textPrimary }}>@{profile.username}</Text>
                {session?.user?.email ? ` (${session.user.email})` : ''}
              </Text>
            )}
            <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
              <TextInput
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, 500))}
                placeholder={t('feedback.placeholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                style={{
                  backgroundColor: colors.bgBase, borderRadius: 10, borderWidth: 1,
                  borderColor: colors.borderDefault, padding: 12, paddingBottom: 28,
                  fontSize: 15, color: colors.textPrimary, minHeight: 100, textAlignVertical: 'top',
                }}
              />
              <Text style={{ position: 'absolute', bottom: 8, right: 28, color: colors.textMuted, fontSize: 11 }}>{message.length}/500</Text>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={message.trim().length < 10 || sending}
                style={{
                  backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14,
                  alignItems: 'center', opacity: message.trim().length >= 10 && !sending ? 1 : 0.5,
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>{t('feedback.send')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
