import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput } from 'react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { scanRecipe, scanRecipeMultiPage, analyseScannedImage } from '@chefsbook/ai';
import type { ScanImageAnalysis, PexelsPhoto } from '@chefsbook/ai';
import { searchPexels } from '@chefsbook/ai';
import { pickImage, takePhoto, processImage } from '../../lib/image';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Input } from '../../components/UIKit';
import { PostImportImageSheet } from '../../components/PostImportImageSheet';
import { DishIdentificationFlow } from '../../components/DishIdentificationFlow';
import { DiscoveryToast } from '../../components/DiscoveryToast';

// TODO(web): replicate multi-page scan support

type ImportStatus = 'idle' | 'importing' | 'success' | 'error';

export default function ScanTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { importUrl, instagramTip } = useLocalSearchParams<{ importUrl?: string; instagramTip?: string }>();
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
  // Post-import image sheet state
  const [showImageSheet, setShowImageSheet] = useState(false);
  const [imageSheetRecipeId, setImageSheetRecipeId] = useState<string | null>(null);
  const [imageSheetWebsiteUrl, setImageSheetWebsiteUrl] = useState<string | null>(null);
  const [imageSheetScanUri, setImageSheetScanUri] = useState<string | null>(null);
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsPhoto[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  // Dish identification flow state
  const [showDishFlow, setShowDishFlow] = useState(false);
  const [dishFlowImageUri, setDishFlowImageUri] = useState('');
  const [dishFlowBase64, setDishFlowBase64] = useState('');
  const [dishFlowMime, setDishFlowMime] = useState('image/jpeg');
  const [dishFlowAnalysis, setDishFlowAnalysis] = useState<ScanImageAnalysis | null>(null);
  // Social-media tip card (dismissible)
  const [showSocialTip, setShowSocialTip] = useState(true);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Discovery toast — shown when the imported URL is from a site we hadn't seen
  const [discoveryDomain, setDiscoveryDomain] = useState<string | null>(null);

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

  // Instagram URL arrived via deep link — show a tip (scraping is no longer supported)
  useEffect(() => {
    if (instagramTip === '1') {
      Alert.alert(
        'Instagram import',
        "Instagram no longer lets us import posts directly. Screenshot the post, then tap \"Scan a photo\" below — we'll read it for you.",
        [{ text: 'Got it' }],
      );
    }
  }, [instagramTip]);

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

  // Process all captured pages — classify first, then route to recipe scan or dish identification
  const finishScan = async () => {
    if (!session?.user?.id || scanPages.length === 0) return;
    setScanMode(false);
    setImportStatus('importing');
    setPexelsLoading(true);
    setPexelsPhotos([]);
    try {
      const pages = scanPages.map((p) => ({ base64: p.base64, mimeType: p.mimeType }));

      // For single-page scans, classify the image first (dish vs recipe document)
      if (pages.length === 1) {
        const classification = await analyseScannedImage(pages[0].base64, pages[0].mimeType);

        if (classification.type !== 'recipe_document') {
          // Dish photo or unclear → show dish identification flow
          setImportStatus('idle');
          setPexelsLoading(false);
          setDishFlowImageUri(scanPages[0].uri);
          setDishFlowBase64(scanPages[0].base64);
          setDishFlowMime(scanPages[0].mimeType);
          setDishFlowAnalysis(classification);
          setShowDishFlow(true);
          setScanPages([]);
          return;
        }
      }

      // Recipe document path (existing flow unchanged)
      const scanPromise = pages.length === 1
        ? scanRecipe(pages[0].base64, pages[0].mimeType)
        : scanRecipeMultiPage(pages);

      const [scanned] = await Promise.all([
        scanPromise,
        searchPexels('recipe food dish').then((r) => { setPexelsPhotos(r); setPexelsLoading(false); }).catch(() => setPexelsLoading(false)),
      ]);

      if (scanned.title) {
        setPexelsLoading(true);
        searchPexels(scanned.title).then((r) => { setPexelsPhotos(r); setPexelsLoading(false); }).catch(() => setPexelsLoading(false));
      }

      const recipe = await addRecipe(session.user.id, scanned);
      setImportedRecipeId(recipe.id);
      setImportStatus('success');

      setImageSheetRecipeId(recipe.id);
      setImageSheetWebsiteUrl(null);
      setImageSheetScanUri(scanned.has_food_photo ? scanPages[0]?.uri : null);
      setShowImageSheet(true);
      setScanPages([]);
    } catch (e: any) {
      setImportStatus('error');
      setPexelsLoading(false);
      Alert.alert(t('scan.scanFailed'), e.message);
      setScanPages([]);
    }
  };

  // Force recipe scan — called from DishIdentificationFlow when user picks "It's a recipe"
  const forceRecipeScan = async () => {
    if (!session?.user?.id || !dishFlowBase64) return;
    setImportStatus('importing');
    setPexelsLoading(true);
    setPexelsPhotos([]);
    try {
      const [scanned] = await Promise.all([
        scanRecipe(dishFlowBase64, dishFlowMime),
        searchPexels('recipe food dish').then((r) => { setPexelsPhotos(r); setPexelsLoading(false); }).catch(() => setPexelsLoading(false)),
      ]);
      if (scanned.title) {
        setPexelsLoading(true);
        searchPexels(scanned.title).then((r) => { setPexelsPhotos(r); setPexelsLoading(false); }).catch(() => setPexelsLoading(false));
      }
      const recipe = await addRecipe(session.user.id, scanned);
      setImportedRecipeId(recipe.id);
      setImportStatus('success');
      setImageSheetRecipeId(recipe.id);
      setImageSheetWebsiteUrl(null);
      setImageSheetScanUri(scanned.has_food_photo ? dishFlowImageUri : null);
      setShowImageSheet(true);
    } catch (e: any) {
      setImportStatus('error');
      setPexelsLoading(false);
      Alert.alert(t('scan.scanFailed'), e.message);
    }
  };

  // Instagram URL detection — kept as a guard so we can redirect users to photo scan.
  // Direct Instagram scraping was removed in session 138 (unreliable without auth).
  const isInstagramUrl = (u: string) =>
    u.includes('instagram.com/p/') || u.includes('instagram.com/reel/');

  const showInstagramRedirect = () => {
    Alert.alert(
      'Instagram import',
      "Instagram no longer lets us import posts directly. Screenshot the post, then tap \"Scan a photo\" below — we'll read the ingredients and steps from the caption.",
      [{ text: 'OK' }],
    );
  };

  const handleImport = async (urlToImport?: string) => {
    const target = urlToImport || urlInput.trim();
    if (!target || !session?.user?.id) return;

    // Instagram scraping was removed in session 138 — redirect users to screenshot → photo scan.
    if (isInstagramUrl(target)) {
      showInstagramRedirect();
      return;
    }

    setImportStatus('importing');
    setPexelsLoading(true);
    setPexelsPhotos([]);

    try {
      // Pre-fetch Pexels using URL domain as a guess query, in parallel with import
      const domainGuess = new URL(target).hostname.replace(/^www\./, '').split('.')[0];
      const pexelsPromise = searchPexels(domainGuess + ' food recipe')
        .then((r) => { setPexelsPhotos(r); setPexelsLoading(false); })
        .catch(() => setPexelsLoading(false));

      const res = await fetch(target);
      const html = await res.text();
      const { importFromUrl } = await import('@chefsbook/ai');

      // Extract image URL from HTML (og:image or JSON-LD)
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      const extractedImageUrl = ogMatch?.[1] && /^https?:\/\//.test(ogMatch[1]) ? ogMatch[1] : null;

      const [scannedRaw] = await Promise.all([
        importFromUrl(html, target),
        pexelsPromise,
      ]);

      // Translate if non-English (uses detectLanguage + translateRecipeContent from @chefsbook/ai)
      let scanned = scannedRaw;
      try {
        const { detectLanguage, translateRecipeContent } = await import('@chefsbook/ai');
        const sampleText = `${scannedRaw.title ?? ''} ${(scannedRaw.ingredients ?? []).slice(0, 3).map((i: any) => i.ingredient ?? '').join(' ')}`;
        const srcLang = await detectLanguage(sampleText);
        if (srcLang !== 'en') {
          const translated = await translateRecipeContent(scannedRaw as any, 'en', srcLang);
          scanned = { ...scannedRaw, ...translated } as typeof scannedRaw;
        }
      } catch { /* translation failure non-blocking */ }

      // Refetch Pexels with actual recipe title
      if (scanned.title) {
        setPexelsLoading(true);
        searchPexels(scanned.title).then((r) => { setPexelsPhotos(r); setPexelsLoading(false); }).catch(() => setPexelsLoading(false));
      }

      const imageUrl = extractedImageUrl ?? null;
      const recipe = await addRecipe(session.user.id, { ...scanned, source_url: target, image_url: imageUrl });
      setImportedRecipeId(recipe.id);
      setImportStatus('success');

      // Fire-and-forget: record the site as discovered and surface the warm toast
      // when the domain is genuinely new. Failure is silent — purely non-critical.
      fetch('https://chefsbk.app/api/sites/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, userId: session.user.id }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.isNewDiscovery && d.domain) setDiscoveryDomain(d.domain);
        })
        .catch(() => {});

      // Always show image sheet — website image offered if available
      setImageSheetRecipeId(recipe.id);
      setImageSheetWebsiteUrl(imageUrl);
      setImageSheetScanUri(null);
      setShowImageSheet(true);
    } catch (e: any) {
      setImportStatus('error');
      setPexelsLoading(false);
      Alert.alert(t('scan.importFailed'), e.message);
    }
  };

  /** Upload any image URI as cover photo for the imported recipe */
  const uploadCoverImage = async (uri: string) => {
    if (!session?.user?.id || !imageSheetRecipeId) return;
    setShowImageSheet(false);
    try {
      const { base64 } = await processImage(uri);
      const { supabase, addRecipePhoto } = await import('@chefsbook/db');
      const fileName = `${session.user.id}/${imageSheetRecipeId}/cover_${Date.now()}.jpg`;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      await supabase.storage.from('recipe-user-photos').upload(fileName, bytes, { contentType: 'image/jpeg' });
      const { data: urlData } = supabase.storage.from('recipe-user-photos').getPublicUrl(fileName);
      await addRecipePhoto(imageSheetRecipeId, session.user.id, fileName, urlData.publicUrl);
    } catch {} // non-blocking
  };

  /** Download a remote URL, then upload as cover */
  const uploadCoverFromUrl = async (url: string) => {
    if (!session?.user?.id || !imageSheetRecipeId) return;
    setShowImageSheet(false);
    try {
      const FileSystem = require('expo-file-system/legacy');
      const localUri = FileSystem.documentDirectory + `cover_dl_${Date.now()}.jpg`;
      const download = await FileSystem.downloadAsync(url, localUri);
      await uploadCoverImage(download.uri);
      try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch {}
    } catch {} // non-blocking
  };

  const handleClipboardPaste = () => {
    if (clipboardUrl) {
      if (isInstagramUrl(clipboardUrl)) {
        setClipboardUrl(null);
        showInstagramRedirect();
      } else {
        setUrlInput(clipboardUrl);
        setShowUrlInput(true);
        setClipboardUrl(null);
        handleImport(clipboardUrl);
      }
    }
  };

  // Scan-a-photo is primary — it's now the import path for social media screenshots too.
  const gridCells = [
    {
      iconName: 'camera' as const,
      label: t('scan.scanPhoto'),
      subtitle: t('scan.scanSubtitle'),
      onPress: () => startScan(takePhoto),
      primary: true,
    },
    {
      iconName: 'images' as const,
      label: t('scan.choosePhoto'),
      subtitle: t('scan.chooseSubtitle'),
      onPress: () => startScan(pickImage),
    },
    {
      iconName: 'link' as const,
      label: t('scan.importUrl'),
      subtitle: t('scan.importSubtitle'),
      onPress: () => { setShowUrlInput(!showUrlInput); },
    },
    {
      iconName: 'clipboard' as const,
      label: 'Paste text',
      subtitle: 'Paste recipe text for AI parsing',
      onPress: () => setShowPasteInput(!showPasteInput),
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
            setShowImageSheet(false);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.accentGreenSoft, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
          <Text style={{ color: colors.accentGreen, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>{t('scan.recipeSaved')}</Text>
        </TouchableOpacity>
      )}

      {/* Post-import image selection sheet */}
      <PostImportImageSheet
        visible={showImageSheet}
        websiteImageUrl={imageSheetWebsiteUrl}
        scanImageUri={imageSheetScanUri}
        pexelsPhotos={pexelsPhotos}
        pexelsLoading={pexelsLoading}
        onSelectWebsiteImage={() => { if (imageSheetWebsiteUrl) uploadCoverFromUrl(imageSheetWebsiteUrl); }}
        onSelectScanImage={() => { if (imageSheetScanUri) uploadCoverImage(imageSheetScanUri); }}
        onSelectPexels={(photo) => uploadCoverFromUrl(photo.fullUrl)}
        onTakePhoto={async () => { const uri = await takePhoto(); if (uri) uploadCoverImage(uri); }}
        onPickLibrary={async () => { const uri = await pickImage(); if (uri) uploadCoverImage(uri); }}
        onSkip={() => setShowImageSheet(false)}
      />

      {/* Site discovery warm toast */}
      {discoveryDomain && (
        <DiscoveryToast domain={discoveryDomain} onDismiss={() => setDiscoveryDomain(null)} />
      )}

      {/* Dish identification flow */}
      {dishFlowAnalysis && (
        <DishIdentificationFlow
          visible={showDishFlow}
          imageUri={dishFlowImageUri}
          imageBase64={dishFlowBase64}
          imageMimeType={dishFlowMime}
          initialAnalysis={dishFlowAnalysis}
          onDismiss={() => { setShowDishFlow(false); setDishFlowAnalysis(null); }}
          onForceRecipeScan={forceRecipeScan}
        />
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
          <View style={{ paddingBottom: insets.bottom + 16 }}>
            {scanPages.length < 5 && (
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
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
              </View>
            )}
            <TouchableOpacity
              onPress={finishScan}
              style={{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 14 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('scan.doneScanning')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setScanMode(false); setScanPages([]); }} style={{ alignItems: 'center', paddingVertical: 12, marginTop: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('scan.cancelScan')}</Text>
            </TouchableOpacity>
          </View>
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

        {/* Import grid: 3 + 2 */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {gridCells.slice(0, 3).map((cell) => (
            <GridCell key={cell.label} {...cell} colors={colors} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          {gridCells.slice(3, 5).map((cell) => (
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

        {/* Collapsible paste text input */}
        {showPasteInput && (
          <View style={{ backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Paste recipe text</Text>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="Paste ingredients, steps, or the full recipe..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              style={{ backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, minHeight: 120, textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              onPress={async () => {
                if (!pasteText.trim()) return;
                setImportStatus('importing');
                setShowPasteInput(false);
                try {
                  const { importFromText } = await import('@chefsbook/ai');
                  const recipe = await importFromText(pasteText);
                  const saved = await addRecipe(session!.user.id, { ...recipe, source_type: 'text' } as any);
                  setImportedRecipeId(saved.id);
                  setImportStatus('success');
                  setPasteText('');
                } catch (e: any) {
                  setImportStatus('error');
                  Alert.alert('Import failed', e.message);
                }
              }}
              disabled={!pasteText.trim() || importStatus === 'importing'}
              style={{ marginTop: 12, backgroundColor: pasteText.trim() ? colors.accent : colors.bgBase, borderRadius: 10, paddingVertical: 10, alignItems: 'center', opacity: pasteText.trim() ? 1 : 0.5 }}
            >
              <Text style={{ color: pasteText.trim() ? '#ffffff' : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Parse Recipe</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Social-media screenshot tip (dismissible) — replaces the removed Instagram import card */}
        {showSocialTip && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            backgroundColor: colors.bgCard,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}>
            <Ionicons name="bulb-outline" size={20} color={colors.accent} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 2 }}>
                See a recipe on Instagram or TikTok?
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
                Screenshot it and tap Scan a photo — we'll read the photo and the caption.
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowSocialTip(false)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

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
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 14,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      }}
    >
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Ionicons name={iconName} size={24} color={colors.accent} />
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 1 }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}
