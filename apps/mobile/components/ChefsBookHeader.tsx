import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';
import { LANGUAGES } from '@chefsbook/ui';
import { LanguagePickerModal } from './LanguagePickerModal';
import { QANotepad } from './QANotepad';
import { FeedbackModal } from './FeedbackModal';
import ChefsDialog from './ChefsDialog';
import NotificationBell from './NotificationBell';
import { useTranslation } from 'react-i18next';

const isStaging = process.env.EXPO_PUBLIC_APP_VARIANT === 'staging';

export function ChefsBookHeader() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const fontFamily = Platform.select({ ios: 'Georgia', default: 'serif' });
  const session = useAuthStore((s) => s.session);
  const language = usePreferencesStore((s) => s.language);
  const units = usePreferencesStore((s) => s.units);
  const setUnits = usePreferencesStore((s) => s.setUnits);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [qaNotepadVisible, setQaNotepadVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const langEntry = LANGUAGES.find((l) => l.code === language);
  const langLabel = langEntry ? `${langEntry.flag} ${langEntry.code.toUpperCase()}` : (language || 'en').toUpperCase();

  const toggleUnits = () => {
    const next = units === 'imperial' ? 'metric' : 'imperial';
    setUnits(next, session?.user?.id);
  };

  return (
    <View
      style={{
        backgroundColor: colors.bgScreen,
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDefault,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setShowUserMenu(true)} activeOpacity={1}>
          <Text style={{ fontSize: 28, fontWeight: '700', fontFamily }}>
            <Text style={{ color: colors.textPrimary }}>Chefs</Text>
            <Text style={{ color: colors.accent }}>Book</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        {/* Notification bell */}
        <NotificationBell />

        {/* Language flag */}
        <TouchableOpacity
          onPress={() => setLangPickerVisible(true)}
          style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{langLabel}</Text>
        </TouchableOpacity>

        {/* Unit toggle pill */}
        <View style={{
          flexDirection: 'row',
          minWidth: 60,
          height: 26,
          borderRadius: 13,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderDefault,
          flexShrink: 0,
        }}>
          <TouchableOpacity
            onPress={toggleUnits}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: units === 'metric' ? colors.accent : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: units === 'metric' ? '#ffffff' : colors.textMuted,
            }}>
              kg
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleUnits}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: units === 'imperial' ? colors.accent : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: units === 'imperial' ? '#ffffff' : colors.textMuted,
            }}>
              lb
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <LanguagePickerModal
        visible={langPickerVisible}
        onClose={() => setLangPickerVisible(false)}
      />
      <QANotepad
        visible={qaNotepadVisible}
        onClose={() => setQaNotepadVisible(false)}
      />
      <ChefsDialog
        visible={showUserMenu}
        icon="⚙️"
        title="ChefsBook"
        body=""
        layout="vertical"
        onClose={() => setShowUserMenu(false)}
        buttons={[
          {
            label: `⚙️  ${t('header.settings')}`,
            variant: 'primary',
            onPress: () => { setShowUserMenu(false); router.push('/modal'); },
          },
          {
            label: `💬  ${t('header.logFeedback')}`,
            variant: 'secondary',
            onPress: () => { setShowUserMenu(false); setFeedbackVisible(true); },
          },
          ...(isStaging ? [{
            label: '📋  QA Notepad',
            variant: 'secondary' as const,
            onPress: () => { setShowUserMenu(false); setQaNotepadVisible(true); },
          }] : []),
          { label: t('common.cancel'), variant: 'text' as const, onPress: () => setShowUserMenu(false) },
        ]}
      />
      <FeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
      />
    </View>
  );
}
