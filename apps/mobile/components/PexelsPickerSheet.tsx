import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { searchPexels } from '@chefsbook/ai';
import type { PexelsPhoto } from '@chefsbook/ai';

const THUMB_SIZE = (Dimensions.get('window').width - 64) / 3;

interface Props {
  visible: boolean;
  query: string;
  onSelect: (photo: PexelsPhoto) => void;
  onClose: () => void;
}

export function PexelsPickerSheet({ visible, query, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !query.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPhotos([]);

    const pexelsKey = process.env.EXPO_PUBLIC_PEXELS_API_KEY || '';
    searchPexels(query, 3, pexelsKey)
      .then((results) => {
        if (cancelled) return;
        setPhotos(results);
        if (results.length === 0) setError(t('pexels.noResults'));
      })
      .catch(() => {
        if (!cancelled) setError(t('pexels.searchFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [visible, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={{
            backgroundColor: colors.bgCard,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
              {t('pexels.title')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12 }}>
                {t('pexels.searching')}
              </Text>
            </View>
          )}

          {/* Error */}
          {error && !loading && (
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>
              {error}
            </Text>
          )}

          {/* Photo grid */}
          {!loading && photos.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                {photos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => onSelect(photo)}
                    activeOpacity={0.7}
                    style={{ borderRadius: 10, overflow: 'hidden' }}
                  >
                    <Image
                      source={{ uri: photo.thumbnail }}
                      style={{ width: THUMB_SIZE, height: THUMB_SIZE * 0.75, borderRadius: 10 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 10 }}>
                {t('pexels.attribution')}
              </Text>
            </>
          )}

          {/* Cancel */}
          <TouchableOpacity
            onPress={onClose}
            style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600' }}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
