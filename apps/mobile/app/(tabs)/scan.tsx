import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { scanRecipe, scanRecipeMultiPage } from '@chefsbook/ai';
import { pickImage, takePhoto, processImage } from '../../lib/image';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Input } from '../../components/UIKit';
import { PexelsPickerSheet } from '../../components/PexelsPickerSheet';
import type { PexelsPhoto } from '@chefsbook/ai';

// TODO(web): replicate multi-page scan support

type ImportStatus = 'idle' | 'importing' | 'success' | 'error';

export default function ScanTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { importUrl } = useLocalSearchParams<{ importUrl?: string }>();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);

  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importedRecipeId, setImportedRecipeId] = useState<string | null>(null);
  const tabBarHeight = useTabBarHeight();
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [hasPulsed, setHasPulsed] = useState(false);

  // Multi-page scan state
  const [scanPages, setScanPages] = useState<{ uri: string; base64: string; mimeType: string }[]>([]);
  const [scanMode, setScanMode] = useState(false);
  // Cover photo prompt state (shown after import when no image)
  const [showCoverPrompt, setShowCoverPrompt] = useState(false);
  const [coverPromptRecipeId, setCoverPromptRecipeId] = useState<string | null>(null);
  const [coverPromptTitle, setCoverPromptTitle] = useState('');
  const [showPexels, setShowPexels] = useState(false);

  // Speak button pulse animation
  const pulseScale = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      if (!hasPulsed) {
        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.02, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
      }
      return () => {
        pulseScale.value = 1;
      };
    }, [hasPulsed]),
  );

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // URL input expand/collapse animation
  const urlHeight = useSharedValue(0);
  const urlOpacity = useSharedValue(0);

  useEffect(() => {
    if (showUrlInput) {
      urlHeight.value = withTiming(200, { duration: 300 });
      urlOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
    } else {
      urlOpacity.value = withTiming(0, { duration: 150 });
      urlHeight.value = withDelay(100, withTiming(0, { duration: 250 }));
    }
  }, [showUrlInput]);

  const urlContainerStyle = useAnimatedStyle(() => ({
    height: urlHeight.value,
    opacity: urlOpacity.value,
    overflow: 'hidden' as const,
  }));

  // Clipboard check
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const text = await Clipboard.getStringAsync();
          if (text && /^https?:\/\//i.test(text)) {
            setClipboardUrl(text);
          } else {
            setClipboardUrl(null);
          }
        } catch {
          setClipboardUrl(null);
        }
      })();
    }, []),
  );

  // Auto-import from share sheet
  useEffect(() => {
    if (importUrl) {
      setUrlInput(importUrl);
      setShowUrlInput(true);
      handleImport(importUrl);
    }
  }, [importUrl]);

  // Start multi-page scan — capture first page and enter scan mode
  const startScan = async (getUri: () => Promise<string | null>) => {
    const uri = await getUri();
    if (!uri) return;
    const processed = await processImage(uri);
    setScanPages([{ uri, ...processed }]);
    setScanMode(true);
  };

  // Add another page to the scan
  const addScanPage = async (getUri: () => Promise<string | null>) => {
    if (scanPages.length >= 5) {
      Alert.alert(t('scan.maxPages'), t('scan.maxPagesBody'));
      return;
    }
    const uri = await getUri();
    if (!uri) return;
    const processed = await processImage(uri);
    setScanPages((prev) => [...prev, { uri, ...processed }]);
  };

  const removeScanPage = (index: number) => {
    setScanPages((prev) => prev.filter((_, i) => i !== index));
  };

  // Process all captured pages
  const finishScan = async () => {
    if (!session?.user?.id || scanPages.length === 0) return;
    setScanMode(false);
    setImportStatus('importing');
    try {
      const pages = scanPages.map((p) => ({ base64: p.base64, mimeType: p.mimeType }));
      const scanned = pages.length === 1
        ? await scanRecipe(pages[0].base64, pages[0].mimeType)
        : await scanRecipeMultiPage(pages);
      const recipe = await addRecipe(session.user.id, scanned);

      // Auto-add first scan page as recipe photo
      try {
        const { supabase, addRecipePhoto } = await import('@chefsbook/db');
        const fileName = `${session.user.id}/${recipe.id}/scan_${Date.now()}.jpg`;
        const binaryString = atob(scanPages[0].base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        await supabase.storage.from('recipe-user-photos').upload(fileName, bytes, { contentType: 'image/jpeg' });
        const { data: urlData } = supabase.storage.from('recipe-user-photos').getPublicUrl(fileName);
        await addRecipePhoto(recipe.id, session.user.id, fileName, urlData.publicUrl);
      } catch {} // non-blocking

      setImportedRecipeId(recipe.id);
      setImportStatus('success');
      setScanPages([]);
    } catch (e: any) {
      setImportStatus('error');
      Alert.alert(t('scan.scanFailed'), e.message);
      setScanPages([]);
    }
  };

  const handleImport = async (urlToImport?: string) => {
    const target = urlToImport || urlInput.trim();
    if (!target || !session?.user?.id) return;

    setImportStatus('importing');
    try {
      const res = await fetch(target);
      const html = await res.text();
      const { importFromUrl } = await import('@chefsbook/ai');
      const scanned = await importFromUrl(html, target);
      const recipe = await addRecipe(session.user.id, { ...scanned, source_url: target });
      setImportedRecipeId(recipe.id);
      setImportStatus('success');
      // Show "Add cover photo?" prompt if no image was imported
      if (!recipe.image_url) {
        setCoverPromptRecipeId(recipe.id);
        setCoverPromptTitle(recipe.title ?? '');
        setShowCoverPrompt(true);
      }
    } catch (e: any) {
      setImportStatus('error');
      Alert.alert(t('scan.importFailed'), e.message);
    }
  };

  const handleCoverPhoto = async (getUri: () => Promise<string | null>) => {
    if (!session?.user?.id || !coverPromptRecipeId) return;
    const uri = await getUri();
    if (!uri) return;
    setShowCoverPrompt(false);
    try {
      const { base64 } = await processImage(uri);
      const { supabase, addRecipePhoto } = await import('@chefsbook/db');
      const fileName = `${session.user.id}/${coverPromptRecipeId}/cover_${Date.now()}.jpg`;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      await supabase.storage.from('recipe-user-photos').upload(fileName, bytes, { contentType: 'image/jpeg' });
      const { data: urlData } = supabase.storage.from('recipe-user-photos').getPublicUrl(fileName);
      await addRecipePhoto(coverPromptRecipeId, session.user.id, fileName, urlData.publicUrl);
    } catch {} // non-blocking
  };

  const handleClipboardPaste = () => {
    if (clipboardUrl) {
      setUrlInput(clipboardUrl);
      setShowUrlInput(true);
      setClipboardUrl(null);
      handleImport(clipboardUrl);
    }
  };

  const gridCells = [
    {
      iconName: 'camera' as const,
      label: t('scan.scanPhoto'),
      subtitle: t('scan.scanSubtitle'),
      onPress: () => startScan(takePhoto),
    },
    {
      iconName: 'link' as const,
      label: t('scan.importUrl'),
      subtitle: t('scan.importSubtitle'),
      onPress: () => setShowUrlInput(!showUrlInput),
    },
    {
      iconName: 'images' as const,
      label: t('scan.choosePhoto'),
      subtitle: t('scan.chooseSubtitle'),
      onPress: () => startScan(pickImage),
    },
    {
      iconName: 'create' as const,
      label: t('scan.manualEntry'),
      subtitle: t('scan.manualSubtitle'),
      onPress: () => router.push('/recipe/new'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      <ChefsBookHeader />

      {/* Import progress bar */}
      {importStatus === 'importing' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500', marginLeft: 10 }}>{t('scan.importing')}</Text>
        </View>
      )}

      {importStatus === 'success' && (
        <TouchableOpacity
          onPress={() => {
            if (importedRecipeId) router.push(`/recipe/${importedRecipeId}`);
            setImportStatus('idle');
            setShowCoverPrompt(false);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.accentGreenSoft, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
          <Text style={{ color: colors.accentGreen, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>{t('scan.recipeSaved')}</Text>
        </TouchableOpacity>
      )}

      {/* "Add cover photo?" prompt — shown after import with no image */}
      {showCoverPrompt && (
        <View style={{ padding: 12, paddingHorizontal: 16, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{t('scan.addCoverPhoto')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleCoverPhoto(takePhoto)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.bgBase, borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderDefault }}
            >
              <Ionicons name="camera-outline" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{t('scan.camera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCoverPhoto(pickImage)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.bgBase, borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderDefault }}
            >
              <Ionicons name="images-outline" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{t('scan.library')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowPexels(true)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.bgBase, borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderDefault }}
            >
              <Ionicons name="search-outline" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{t('gallery.findPhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowCoverPrompt(false)}
              style={{ paddingHorizontal: 12, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('common.skip')}</Text>
            </TouchableOpacity>
          </View>
          <PexelsPickerSheet
            visible={showPexels}
            query={coverPromptTitle}
            onSelect={async (photo: PexelsPhoto) => {
              setShowPexels(false);
              handleCoverPhoto(async () => photo.fullUrl);
            }}
            onClose={() => setShowPexels(false)}
          />
        </View>
      )}

      {/* Multi-page scan mode */}
      {scanMode && (
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderDefault, backgroundColor: colors.bgCard }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            {t('scan.scanningPages', { count: scanPages.length })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {scanPages.map((page, i) => (
              <View key={i} style={{ marginRight: 10, position: 'relative' }}>
                <Image source={{ uri: page.uri }} style={{ width: 80, height: 100, borderRadius: 8 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => removeScanPage(i)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    backgroundColor: '#fff', borderRadius: 10, width: 20, height: 20,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 3,
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.accent} />
                </TouchableOpacity>
                <Text style={{ color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>{t('scan.page', { number: i + 1 })}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {scanPages.length < 5 && (
              <>
                <TouchableOpacity
                  onPress={() => addScanPage(takePhoto)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.bgBase, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: colors.borderDefault }}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{t('scan.addPage')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => addScanPage(pickImage)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.bgBase, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: colors.borderDefault }}
                >
                  <Ionicons name="images-outline" size={18} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{t('scan.fromGallery')}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              onPress={finishScan}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{t('scan.doneScanning')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => { setScanMode(false); setScanPages([]); }} style={{ alignItems: 'center', paddingVertical: 8, marginTop: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('scan.cancelScan')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>{t('scan.addRecipe')}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>{t('scan.chooseHow')}</Text>

        {/* Clipboard paste suggestion */}
        {clipboardUrl && showUrlInput === false && (
          <TouchableOpacity
            onPress={handleClipboardPaste}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.accentSoft,
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Ionicons name="clipboard-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>{t('scan.pasteClipboard')}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{clipboardUrl}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Hero Speak button */}
        <Animated.View style={pulseStyle}>
          <TouchableOpacity
            onPress={() => {
              setHasPulsed(true);
              pulseScale.value = 1;
              router.push('/speak');
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 16,
              height: 80,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              paddingHorizontal: 20,
              shadowColor: colors.accent,
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="mic" size={36} color="white" style={{ marginRight: 10 }} />
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>{t('scan.speakRecipe')}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>{t('scan.speakSubtitle')}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* 2x2 Grid */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {gridCells.slice(0, 2).map((cell) => (
            <GridCell key={cell.label} {...cell} colors={colors} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          {gridCells.slice(2, 4).map((cell) => (
            <GridCell key={cell.label} {...cell} colors={colors} />
          ))}
        </View>

        {/* Collapsible URL input */}
        <Animated.View style={urlContainerStyle}>
          <View style={{ paddingTop: 4 }}>
            <Input
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder={t('scan.pasteUrl')}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const text = await Clipboard.getStringAsync();
                    if (text) setUrlInput(text);
                  } catch {}
                }}
                style={{
                  flex: 1,
                  height: 40,
                  backgroundColor: colors.bgBase,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="clipboard-outline" size={16} color={colors.textPrimary} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{t('scan.paste')}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleImport()}
                disabled={!urlInput.trim()}
                style={{
                  flex: 1,
                  height: 40,
                  backgroundColor: urlInput.trim() ? colors.accent : colors.bgBase,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: urlInput.trim() ? 1 : 0.5,
                }}
              >
                <Text style={{ color: urlInput.trim() ? '#ffffff' : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>{t('scan.import')}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('scan.shareDescription')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Share from browser banner */}
        <View
          style={{
            backgroundColor: colors.bgScreen,
            borderRadius: 12,
            borderLeftWidth: 3,
            borderLeftColor: colors.accentGreen,
            padding: 16,
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="globe-outline" size={20} color={colors.accentGreen} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{t('scan.shareBanner')}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            {t('scan.shareDescription')}
          </Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            {[t('scan.shareStep1'), t('scan.shareStep2'), t('scan.shareStep3')].map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accentGreen, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>{i + 1}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: tabBarHeight }} />
      </ScrollView>
    </View>
  );
}

function GridCell({
  iconName,
  label,
  subtitle,
  onPress,
  colors,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        backgroundColor: colors.bgScreen,
        borderRadius: 14,
        height: 130,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
      }}>
        <Ionicons name={iconName} size={32} color={colors.accent} />
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}
