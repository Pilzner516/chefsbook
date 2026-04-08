import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../context/ThemeContext';
import { listRecipePhotos, addRecipePhoto, deleteRecipePhoto, setPhotoPrimary, supabase, PLAN_LIMITS } from '@chefsbook/db';
import type { RecipeUserPhoto } from '@chefsbook/db';
import { pickImage, takePhoto, processImage } from '../lib/image';
import { useAuthStore } from '../lib/zustand/authStore';
import { PexelsPickerSheet } from './PexelsPickerSheet';
import type { PexelsPhoto } from '@chefsbook/ai';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

interface Props {
  recipeId: string;
  userId: string;
  editing: boolean;
  recipeTitle?: string;
}

export function EditImageGallery({ recipeId, userId, editing, recipeTitle }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const planTier = useAuthStore((s) => s.planTier);
  const [photos, setPhotos] = useState<RecipeUserPhoto[]>([]);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [lastFailedUri, setLastFailedUri] = useState<string | null>(null);
  const [showPexels, setShowPexels] = useState(false);
  const photoLimit = PLAN_LIMITS[planTier]?.maxPhotosPerRecipe ?? 3;

  useEffect(() => {
    loadPhotos();
  }, [recipeId]);

  const loadPhotos = async () => {
    const result = await listRecipePhotos(recipeId);
    setPhotos(result);
  };

  const uploadPhoto = async (uri: string) => {
    setUploadState('uploading');
    setLastFailedUri(null);
    try {
      // Resize/compress to a local JPEG file
      const { base64 } = await processImage(uri);
      const tmpPath = FileSystem.documentDirectory + `upload_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tmpPath, base64, { encoding: FileSystem.EncodingType.Base64 });

      // Get auth session for JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated — please sign in again');

      const fileName = `${userId}/${recipeId}/${Date.now()}.jpg`;
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/recipe-user-photos/${fileName}`;

      console.log('Upload URL:', uploadUrl);
      console.log('File URI:', tmpPath);
      console.log('Session token (first 20 chars):', session.access_token?.substring(0, 20));

      // Upload via native HTTP — bypasses Supabase JS client encoding issues
      const uploadPromise = FileSystem.uploadAsync(uploadUrl, tmpPath, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out after 30s')), 30000)
      );

      const response = await Promise.race([uploadPromise, timeoutPromise]);

      console.log('Upload response status:', response.status);
      console.log('Upload response body:', response.body);

      // Clean up temp file
      try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch {}

      if (response.status >= 400) {
        const body = JSON.parse(response.body || '{}');
        throw new Error(body.message || body.error || `Upload failed (${response.status})`);
      }

      const { data: urlData } = supabase.storage
        .from('recipe-user-photos')
        .getPublicUrl(fileName);

      await addRecipePhoto(recipeId, userId, fileName, urlData.publicUrl);
      await loadPhotos();
      setUploadState('idle');
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadState('error');
      setLastFailedUri(uri);
      Alert.alert(t('notepad.uploadFailed'), err.message);
    }
  };

  const uploadFromPexels = async (photo: PexelsPhoto) => {
    setShowPexels(false);
    // Reuse the same upload path as camera/library — download to local file first
    setUploadState('uploading');
    try {
      const FileSystem = require('expo-file-system/legacy');
      const localUri = FileSystem.documentDirectory + `pexels_${Date.now()}.jpg`;
      const download = await FileSystem.downloadAsync(photo.fullUrl, localUri);
      await uploadPhoto(download.uri);
      try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch {}
    } catch (err: any) {
      Alert.alert(t('notepad.uploadFailed'), err.message);
      setUploadState('error');
    }
  };

  const retryUpload = () => {
    if (lastFailedUri) uploadPhoto(lastFailedUri);
  };

  const uploading = uploadState !== 'idle';

  const showImagePicker = () => {
    // Plan gate: check photo limit
    if (photos.length >= photoLimit) {
      Alert.alert(
        t('gallery.photoLimit'),
        t('gallery.photoLimitBody', { tier: planTier, limit: photoLimit }),
        [{ text: t('common.ok') }],
      );
      return;
    }

    const options = [t('gallery.takePhoto'), t('gallery.chooseLibrary'), t('gallery.findPhoto'), t('common.cancel')];
    const cancelIndex = 3;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        async (idx) => {
          if (idx === 0) { const uri = await takePhoto(); if (uri) uploadPhoto(uri); }
          if (idx === 1) { const uri = await pickImage(); if (uri) uploadPhoto(uri); }
          if (idx === 2) setShowPexels(true);
        },
      );
    } else {
      Alert.alert(t('gallery.addPhoto'), t('gallery.chooseSource'), [
        { text: t('gallery.takePhoto'), onPress: async () => { const uri = await takePhoto(); if (uri) uploadPhoto(uri); } },
        { text: t('gallery.chooseLibrary'), onPress: async () => { const uri = await pickImage(); if (uri) uploadPhoto(uri); } },
        { text: t('gallery.findPhoto'), onPress: () => setShowPexels(true) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const handleDelete = (photo: RecipeUserPhoto) => {
    Alert.alert(t('gallery.deletePhoto'), t('gallery.cannotUndo'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await deleteRecipePhoto(photo.id);
        await loadPhotos();
      }},
    ]);
  };

  const handleSetPrimary = async (photo: RecipeUserPhoto) => {
    await setPhotoPrimary(photo.id, recipeId);
    await loadPhotos();
  };

  // Read-only gallery for non-edit mode
  if (!editing) {
    if (photos.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {photos.map((photo) => (
          <Image
            key={photo.id}
            source={{ uri: photo.url, headers: { apikey: SUPABASE_ANON_KEY } }}
            style={{ width: 120, height: 90, borderRadius: 8, marginRight: 8 }}
            resizeMode="cover"
            onError={(e) => console.error('Image load error:', e.nativeEvent.error, photo.url)}
            onLoad={() => console.log('Image loaded:', photo.url)}
          />
        ))}
      </ScrollView>
    );
  }

  const pexelsSheet = (
    <PexelsPickerSheet
      visible={showPexels}
      query={recipeTitle ?? ''}
      onSelect={uploadFromPexels}
      onClose={() => setShowPexels(false)}
    />
  );

  const uploadPill = uploadState === 'uploading' ? (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <View style={{
        backgroundColor: colors.accent, paddingHorizontal: 16,
        paddingVertical: 8, borderRadius: 20,
      }}>
        <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
          {t('gallery.uploading')}
        </Text>
      </View>
    </View>
  ) : uploadState === 'error' ? (
    <TouchableOpacity
      onPress={retryUpload}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      <View style={{
        backgroundColor: colors.accent, paddingHorizontal: 16,
        paddingVertical: 8, borderRadius: 20,
      }}>
        <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
          {t('gallery.uploadFailed')}
        </Text>
      </View>
    </TouchableOpacity>
  ) : null;

  // Edit mode — full controls
  if (photos.length === 0) {
    return (
      <>
        <TouchableOpacity
          onPress={showImagePicker}
          disabled={uploading}
          style={{
            width: '100%', height: 120, borderRadius: 12,
            borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderDefault,
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            backgroundColor: colors.bgBase,
          }}
        >
          {/* Chef's hat watermark */}
          <Image
            source={require('../assets/icon.png')}
            style={{ position: 'absolute', width: 48, height: 48, borderRadius: 10, opacity: 0.18 }}
            resizeMode="contain"
          />
          {uploadState === 'idle' && (
            <>
              <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
                {t('gallery.addPhotoLabel')}
              </Text>
            </>
          )}
          {uploadPill}
        </TouchableOpacity>
        {pexelsSheet}
      </>
    );
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {photos.map((photo) => (
          <View key={photo.id} style={{ marginRight: 10, position: 'relative' }}>
            <TouchableOpacity onLongPress={() => handleSetPrimary(photo)} activeOpacity={0.8}>
              <Image
                source={{ uri: photo.url, headers: { apikey: SUPABASE_ANON_KEY } }}
                style={{ width: 100, height: 80, borderRadius: 8 }}
                resizeMode="cover"
                onError={(e) => console.error('Image load error:', e.nativeEvent.error, photo.url)}
                onLoad={() => console.log('Image loaded:', photo.url)}
              />
              {photo.is_primary && (
                <View style={{
                  position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.accent,
                  borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{t('gallery.primary')}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(photo)}
              style={{
                position: 'absolute', top: -6, right: -6,
                backgroundColor: '#fff', borderRadius: 10, width: 20, height: 20,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
              }}
            >
              <Ionicons name="close" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>
        ))}
        {/* Add more button */}
        <TouchableOpacity
          onPress={showImagePicker}
          disabled={uploading}
          style={{
            width: 100, height: 80, borderRadius: 8,
            borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderDefault,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.bgBase, opacity: uploading ? 0.5 : 1,
          }}
        >
          <Ionicons name="add" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{t('gallery.longPress')}</Text>
      {pexelsSheet}
    </View>
  );
}

