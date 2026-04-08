import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import type { PexelsPhoto } from '@chefsbook/ai';

interface Props {
  visible: boolean;
  /** URL image extracted from the web page (Scenario A) */
  websiteImageUrl?: string | null;
  /** Scan page image URI — only shown if has_food_photo is true (Scenario B) */
  scanImageUri?: string | null;
  /** Pre-fetched Pexels results (fetched in parallel with import) */
  pexelsPhotos: PexelsPhoto[];
  pexelsLoading: boolean;
  onSelectWebsiteImage: () => void;
  onSelectScanImage: () => void;
  onSelectPexels: (photo: PexelsPhoto) => void;
  onTakePhoto: () => void;
  onPickLibrary: () => void;
  onSkip: () => void;
}

export function PostImportImageSheet({
  visible,
  websiteImageUrl,
  scanImageUri,
  pexelsPhotos,
  pexelsLoading,
  onSelectWebsiteImage,
  onSelectScanImage,
  onSelectPexels,
  onTakePhoto,
  onPickLibrary,
  onSkip,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onSkip}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          style={{
            backgroundColor: colors.bgCard,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '80%',
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 12,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
              {t('postImport.title')}
            </Text>
            <TouchableOpacity onPress={onSkip}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('postImport.skip')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 20 }}>
            {/* Option 1: Website image */}
            {websiteImageUrl && (
              <TouchableOpacity
                onPress={onSelectWebsiteImage}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgBase,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                }}
              >
                <Image
                  source={{ uri: websiteImageUrl }}
                  style={{ width: 80, height: 60, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                    {t('postImport.fromWebsite')}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {t('postImport.originalPhoto')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            {/* Option 2: Scan image (only if food photo detected) */}
            {scanImageUri && (
              <TouchableOpacity
                onPress={onSelectScanImage}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgBase,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                }}
              >
                <Image
                  source={{ uri: scanImageUri }}
                  style={{ width: 80, height: 60, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                    {t('postImport.fromScan')}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {t('postImport.scanPhoto')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            {/* Pexels results */}
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: '600',
                marginBottom: 8,
              }}
            >
              {t('postImport.findPhoto')}
            </Text>
            {pexelsLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : pexelsPhotos.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {pexelsPhotos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => onSelectPexels(photo)}
                    activeOpacity={0.7}
                    style={{ marginRight: 10 }}
                  >
                    <Image
                      source={{ uri: photo.thumbnail }}
                      style={{ width: 140, height: 100, borderRadius: 10 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  marginBottom: 16,
                  textAlign: 'center',
                }}
              >
                {t('pexels.noResults')}
              </Text>
            )}

            {/* Camera / Library buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={onTakePhoto}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.bgBase,
                  borderRadius: 10,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                }}
              >
                <Ionicons name="camera-outline" size={18} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                  {t('scan.camera')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onPickLibrary}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.bgBase,
                  borderRadius: 10,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                }}
              >
                <Ionicons name="images-outline" size={18} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                  {t('scan.library')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Skip button */}
            <TouchableOpacity
              onPress={onSkip}
              style={{ alignItems: 'center', paddingVertical: 12 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                {t('postImport.skipArrow')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
