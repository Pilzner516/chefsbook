import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
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
