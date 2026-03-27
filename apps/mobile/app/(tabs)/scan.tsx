import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { scanRecipe } from '@chefsbook/ai';
import { canDo } from '@chefsbook/db/subscriptions';
import { pickImage, takePhoto, processImage } from '../../lib/image';
import { Button, Input, Loading, Card } from '../../components/UIKit';

export default function ScanTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);

  const handleScan = async (getUri: () => Promise<string | null>) => {
    if (!session?.user?.id) return;
    const uri = await getUri();
    if (!uri) return;

    setScanning(true);
    try {
      const { base64, mimeType } = await processImage(uri);
      const scanned = await scanRecipe(base64, mimeType);
      const recipe = await addRecipe(session.user.id, scanned);
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      Alert.alert('Scan failed', e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleUrlImport = async () => {
    if (!url.trim() || !session?.user?.id) return;
    setScanning(true);
    try {
      const res = await fetch(url);
      const html = await res.text();
      const { importFromUrl } = await import('@chefsbook/ai');
      const scanned = await importFromUrl(html, url);
      const recipe = await addRecipe(session.user.id, { ...scanned, source_url: url });
      router.push(`/recipe/${recipe.id}`);
    } catch (e: any) {
      Alert.alert('Import failed', e.message);
    } finally {
      setScanning(false);
    }
  };

  if (scanning) return <Loading message="Extracting recipe..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen, padding: 16 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 24 }}>Add Recipe</Text>

      <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Scan a Recipe</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 16 }}>
          Take a photo of a handwritten card, cookbook page, or printed recipe.
        </Text>
        <View style={{ gap: 10 }}>
          <Button title="Take Photo" onPress={() => handleScan(takePhoto)} />
          <Button title="Choose from Library" onPress={() => handleScan(pickImage)} variant="secondary" />
        </View>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Import from URL</Text>
        <Input value={url} onChangeText={setUrl} placeholder="Paste recipe URL..." autoCapitalize="none" />
        <View style={{ marginTop: 12 }}>
          <Button title="Import" onPress={handleUrlImport} variant="secondary" disabled={!url.trim()} />
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Manual Entry</Text>
        <Button title="Create from Scratch" onPress={() => router.push('/recipe/new')} variant="ghost" />
      </Card>
    </View>
  );
}
