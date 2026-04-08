import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'fr', label: 'Fran\u00E7ais', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'es', label: 'Espa\u00F1ol',  flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'it', label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'de', label: 'Deutsch',  flag: '\u{1F1E9}\u{1F1EA}' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePickerModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);

  const handleSelect = async (code: string) => {
    await setLanguage(code, session?.user?.id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.bgScreen,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 16,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderDefault, alignSelf: 'center', marginBottom: 12 }} />

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>{t('settings.selectLanguage')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Language list */}
          {SUPPORTED_LANGUAGES.map((lang) => {
            const selected = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: selected ? colors.accentSoft : 'transparent',
                  minHeight: 52,
                }}
              >
                <Text style={{ fontSize: 28, marginRight: 14 }}>{lang.flag}</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>{lang.label}</Text>
                {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}

          <View style={{ height: insets.bottom + 16 }} />
        </View>
      </View>
    </Modal>
  );
}
