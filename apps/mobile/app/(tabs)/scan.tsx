import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { useImportStore } from '../../lib/zustand/importStore';
import { scanRecipe } from '@chefsbook/ai';
import { canDo } from '@chefsbook/db/subscriptions';
import { pickImage, takePhoto, processImage } from '../../lib/image';
import { Button, Input, Loading, Card } from '../../components/UIKit';
import { ImportBanner } from '../../components/ImportBanner';

export default function ScanTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const planTier = useAuthStore((s) => s.planTier);
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const importUrls = useImportStore((s) => s.importUrls);
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [bookmarkUrls, setBookmarkUrls] = useState('');
  const [bookmarkFolder, setBookmarkFolder] = useState('');

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

  const handleBookmarkImport = () => {
    if (!session?.user?.id) return;
    const urls = bookmarkUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      Alert.alert('No URLs', 'Paste at least one URL to import.');
      return;
    }
    importUrls(session.user.id, urls, bookmarkFolder.trim() || undefined);
    setBookmarkUrls('');
    setBookmarkFolder('');
  };

  if (scanning) return <Loading message="Extracting recipe..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ImportBanner />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
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

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Import Bookmarks</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 12 }}>
            Paste recipe URLs from your browser bookmarks — one per line. Or share a URL directly from Safari/Chrome to Chefsbook.
          </Text>
          <Input
            value={bookmarkUrls}
            onChangeText={setBookmarkUrls}
            placeholder={"https://example.com/recipe-1\nhttps://example.com/recipe-2\n..."}
            multiline
          />
          <View style={{ marginTop: 8 }}>
            <Input
              value={bookmarkFolder}
              onChangeText={setBookmarkFolder}
              placeholder="Folder name (optional)"
            />
          </View>
          <View style={{ marginTop: 12 }}>
            <Button
              title={`Import ${bookmarkUrls.split('\n').filter((u) => u.trim()).length || ''} URL${bookmarkUrls.split('\n').filter((u) => u.trim()).length !== 1 ? 's' : ''}`}
              onPress={handleBookmarkImport}
              variant="secondary"
              disabled={!bookmarkUrls.trim()}
            />
          </View>
        </Card>

        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Manual Entry</Text>
          <Button title="Create from Scratch" onPress={() => router.push('/recipe/new')} variant="ghost" />
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
