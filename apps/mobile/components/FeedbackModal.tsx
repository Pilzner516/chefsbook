import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { useTranslation } from 'react-i18next';
import { supabase } from '@chefsbook/db';
import Constants from 'expo-constants';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  currentScreen?: string;
}

type FeedbackType = 'bug' | 'suggestion' | 'praise';

const TYPE_OPTIONS: { type: FeedbackType; icon: string; label: string }[] = [
  { type: 'bug', icon: '🐛', label: 'Bug' },
  { type: 'suggestion', icon: '💡', label: 'Suggestion' },
  { type: 'praise', icon: '🎉', label: 'Praise' },
];

export function FeedbackModal({ visible, onClose, currentScreen }: FeedbackModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);

  const [type, setType] = useState<FeedbackType>('bug');
  const [screen, setScreen] = useState(currentScreen || '');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setType('bug');
    setScreen(currentScreen || '');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert(t('common.errorTitle'), t('feedback.descriptionRequired'));
      return;
    }

    if (!session?.user?.id) {
      Alert.alert(t('common.errorTitle'), t('feedback.signInRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const appVersion = Constants.expoConfig?.version || 'unknown';

      const { error } = await supabase.from('user_feedback').insert({
        user_id: session.user.id,
        type,
        screen: screen.trim() || null,
        description: description.trim(),
        app_version: appVersion,
        platform: Platform.OS,
      });

      if (error) throw error;

      Alert.alert(t('common.success'), t('feedback.thankYou'));
      resetForm();
      onClose();
    } catch (err) {
      console.error('Feedback submit error:', err);
      Alert.alert(t('common.errorTitle'), t('feedback.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={[styles.container, { backgroundColor: colors.bgCard, paddingBottom: insets.bottom + 16 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('feedback.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('feedback.subtitle')}
              </Text>

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('feedback.typeLabel')}
              </Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.type}
                    onPress={() => setType(opt.type)}
                    style={[
                      styles.typeButton,
                      {
                        borderColor: type === opt.type ? colors.accent : colors.borderDefault,
                        backgroundColor: type === opt.type ? colors.bgBase : 'transparent',
                      },
                    ]}
                  >
                    <Text style={styles.typeIcon}>{opt.icon}</Text>
                    <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>
                      {t(`feedback.type.${opt.type}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('feedback.screenLabel')}
              </Text>
              <TextInput
                value={screen}
                onChangeText={setScreen}
                placeholder={t('feedback.screenPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.bgBase,
                    borderColor: colors.borderDefault,
                    color: colors.textPrimary,
                  },
                ]}
              />

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('feedback.descriptionLabel')}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('feedback.descriptionPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.bgBase,
                    borderColor: colors.borderDefault,
                    color: colors.textPrimary,
                  },
                ]}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={[styles.button, styles.cancelButton, { borderColor: colors.borderDefault }]}
                >
                  <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={[
                    styles.button,
                    styles.submitButton,
                    { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                    {submitting ? t('common.sending') : t('feedback.submit')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  submitButton: {},
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
