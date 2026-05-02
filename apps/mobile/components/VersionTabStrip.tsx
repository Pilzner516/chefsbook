import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import type { RecipeWithDetails } from '@chefsbook/db';

interface VersionTabStripProps {
  versions: RecipeWithDetails[];
  activeVersionId: string | null;
  onSelectOriginal: () => void;
  onSelectVersion: (versionId: string) => void;
  onVersionAction: (versionId: string, action: 'rename' | 'promote' | 'delete') => void;
}

export function VersionTabStrip({
  versions,
  activeVersionId,
  onSelectOriginal,
  onSelectVersion,
  onVersionAction,
}: VersionTabStripProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);

  const v1 = versions.find((v) => v.personal_version_slot === 1);
  const v2 = versions.find((v) => v.personal_version_slot === 2);

  const handleActionMenu = (versionId: string) => {
    // iOS has Alert.prompt, Android needs a custom modal
    // For now, use an action sheet pattern that works on both
    setShowMenuFor(versionId);
  };

  const renderVersionTab = (version: RecipeWithDetails | undefined) => {
    if (!version) return null;

    const isCurrent = activeVersionId === version.id;

    return (
      <View key={version.id} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
        <TouchableOpacity
          onPress={() => onSelectVersion(version.id)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: isCurrent ? colors.accent : colors.borderDefault,
            backgroundColor: isCurrent ? colors.accentSoft : colors.bgBase,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: isCurrent ? colors.accent : colors.textSecondary,
            }}
          >
            {version.title}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleActionMenu(version.id)}
          style={{
            marginLeft: 4,
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          <Text style={{ fontSize: 18, color: colors.textSecondary, lineHeight: 18 }}>···</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Action sheet modal overlay
  const renderActionSheet = () => {
    if (!showMenuFor) return null;

    const version = versions.find((v) => v.id === showMenuFor);
    if (!version) return null;

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setShowMenuFor(null)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.bgBase,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 32,
          }}
        >
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
              {version.title}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setShowMenuFor(null);
              onVersionAction(version.id, 'rename');
            }}
            style={{ paddingHorizontal: 16, paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 15, color: colors.textPrimary }}>{t('personalVersions.rename')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setShowMenuFor(null);
              onVersionAction(version.id, 'promote');
            }}
            style={{ paddingHorizontal: 16, paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 15, color: colors.textPrimary }}>{t('personalVersions.promote')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setShowMenuFor(null);
              onVersionAction(version.id, 'delete');
            }}
            style={{ paddingHorizontal: 16, paddingVertical: 14 }}
          >
            <Text style={{ fontSize: 15, color: '#ce2b37' }}>{t('personalVersions.delete')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowMenuFor(null)}
            style={{ paddingHorizontal: 16, paddingVertical: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.borderDefault }}
          >
            <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Don't render if no versions exist
  if (versions.length === 0) return null;

  const isOriginal = activeVersionId === null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        style={{ borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <TouchableOpacity
            onPress={onSelectOriginal}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: isOriginal ? colors.accent : colors.borderDefault,
              backgroundColor: isOriginal ? colors.accentSoft : colors.bgBase,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: isOriginal ? colors.accent : colors.textSecondary,
              }}
            >
              {t('personalVersions.original')}
            </Text>
          </TouchableOpacity>
        </View>

        {renderVersionTab(v1)}
        {renderVersionTab(v2)}
      </ScrollView>

      {renderActionSheet()}
    </>
  );
}
