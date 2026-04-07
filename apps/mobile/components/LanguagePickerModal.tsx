import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { usePreferencesStore } from '../lib/zustand/preferencesStore';
import { LANGUAGES, PRIORITY_LANGUAGES } from '@chefsbook/ui';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePickerModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const [search, setSearch] = useState('');

  const priorityLangs = useMemo(
    () => LANGUAGES.filter((l) => PRIORITY_LANGUAGES.includes(l.code)),
    [],
  );
  const otherLangs = useMemo(
    () => LANGUAGES.filter((l) => !PRIORITY_LANGUAGES.includes(l.code)),
    [],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return { priority: priorityLangs, other: otherLangs };
    const q = search.toLowerCase();
    return {
      priority: priorityLangs.filter(
        (l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q),
      ),
      other: otherLangs.filter(
        (l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q),
      ),
    };
  }, [search, priorityLangs, otherLangs]);

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
          maxHeight: '80%',
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

          {/* Search */}
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('settings.searchLanguages')}
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.bgBase,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.borderDefault,
              }}
            />
          </View>

          <ScrollView style={{ maxHeight: 450 }}>
            {/* Priority languages */}
            {filtered.priority.map((lang) => (
              <LanguageRow
                key={lang.code}
                lang={lang}
                selected={language === lang.code}
                colors={colors}
                onPress={() => handleSelect(lang.code)}
              />
            ))}
            {filtered.priority.length > 0 && filtered.other.length > 0 && (
              <View style={{ height: 1, backgroundColor: colors.borderDefault, marginHorizontal: 16, marginVertical: 4 }} />
            )}
            {/* All other languages */}
            {filtered.other.map((lang) => (
              <LanguageRow
                key={lang.code}
                lang={lang}
                selected={language === lang.code}
                colors={colors}
                onPress={() => handleSelect(lang.code)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LanguageRow({
  lang,
  selected,
  colors,
  onPress,
}: {
  lang: { code: string; flag: string; nativeName: string; name: string };
  selected: boolean;
  colors: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
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
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{lang.nativeName}</Text>
        {lang.nativeName !== lang.name && (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>({lang.name})</Text>
        )}
      </View>
      {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
    </TouchableOpacity>
  );
}
