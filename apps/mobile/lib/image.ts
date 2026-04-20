import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '@chefsbook/db';

// Module-level store for pending camera URI after Android Activity Recreation.
// Set by root layout after detecting a pending result on app restart;
// consumed by the scan tab's useFocusEffect so we never call getPendingResultAsync twice.
let _pendingRecoveryUri: string | null = null;
export const storePendingRecoveryUri = (uri: string) => { _pendingRecoveryUri = uri; };
export const consumePendingRecoveryUri = (): string | null => {
  const u = _pendingRecoveryUri;
  _pendingRecoveryUri = null;
  return u;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function pickImage(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  } catch (e) {
    console.warn('[scan] launchImageLibraryAsync failed', e);
    throw e;
  }
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[scan] camera permission denied', { status });
    return null;
  }

  try {
    // mediaTypes: ['images'] matches pickImage at the boundary — avoids edge cases where
    // OEM camera apps launch in video mode under the default SDK 54 behaviour and return
    // an asset the downstream processImage() pipeline rejects silently.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return null;  // user explicitly cancelled — caller handles silently
    if (!result.assets?.[0]?.uri) {
      // Camera completed but returned no image — unexpected; surface to caller as error
      console.warn('[scan] camera returned no usable asset', { assetCount: result.assets?.length ?? 0 });
      throw new Error('Camera returned no image. Please try again.');
    }
    return result.assets[0].uri;
  } catch (e) {
    console.warn('[scan] launchCameraAsync failed', e);
    throw e;
  }
}

// Recovers a camera result after Android kills + recreates MainActivity during the
// external camera intent (low-memory OEMs; dev setting "Don't keep activities"). Expo's
// MainActivity.kt calls super.onCreate(null), disabling RN state restoration, so the
// original launchCameraAsync Promise is orphaned. The SDK persists the result to
// SharedPreferences; this call reads it back and returns a URI in the same shape takePhoto
// uses. Returns null on no-pending-result, cancel, or SDK error. Call in a useFocusEffect
// on the scan tab so recovery runs whenever the user lands there after recreation.
export async function getPendingCameraResult(): Promise<string | null> {
  try {
    const result = await ImagePicker.getPendingResultAsync();
    if (!result) return null;
    // ImagePickerErrorResult carries a `code` property; ImagePickerResult does not.
    if ('code' in result) {
      console.warn('[scan] pending camera result returned error', result);
      return null;
    }
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  } catch (e) {
    console.warn('[scan] getPendingResultAsync failed', e);
    return null;
  }
}

export async function processImage(uri: string): Promise<{ base64: string; mimeType: string }> {
  // Step 1: Resize to 1024px max dimension at 85% JPEG quality
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Step 2: Platform-aware base64 encoding
  const base64 = await getBase64(manipulated.uri);
  return { base64, mimeType: 'image/jpeg' };
}

/**
 * Upload a local image file to Supabase recipe-user-photos bucket.
 * Uses FileSystem.uploadAsync — the only method that works on Hermes (not supabase.storage.upload).
 * Returns the public URL (Tailscale IP based).
 */
export async function uploadRecipePhoto(localUri: string, recipeId: string): Promise<string> {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (!authSession?.access_token) throw new Error('Not authenticated');

  // Resize to 1024px before upload
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1024 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const fileName = `${recipeId}/${Date.now()}.jpg`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/recipe-user-photos/${fileName}`;

  const response = await FileSystem.uploadAsync(uploadUrl, manipulated.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    headers: {
      Authorization: `Bearer ${authSession.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  if (response.status !== 200) throw new Error(`Upload failed: ${response.status}`);
  return `${SUPABASE_URL}/storage/v1/object/public/recipe-user-photos/${fileName}`;
}

async function getBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Web: use FileReader
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  // Native: use expo-file-system
  const result = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return result;
}
