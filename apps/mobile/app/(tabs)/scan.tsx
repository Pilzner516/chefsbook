import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { scanRecipe } from '@chefsbook/ai';
import { pickImage, takePhoto, processImage } from '../../lib/image';
import { ChefsBookHeader } from '../../components/ChefsBookHeader';
import { Input } from '../../components/UIKit';

type ImportStatus = 'idle' | 'importing' | 'success' | 'error';

export default function ScanTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const { importUrl } = useLocalSearchParams<{ importUrl?: string }>();
  const session = useAuthStore((s) => s.session);
  const addRecipe = useRecipeStore((s) => s.addRecipe);

  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importedRecipeId, setImportedRecipeId] = useState<string | null>(null);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [hasPulsed, setHasPulsed] = useState(false);

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

  const handleScan = async (getUri: () => Promise<string | null>) => {
    if (!session?.user?.id) return;
    const uri = await getUri();
    if (!uri) return;

    setImportStatus('importing');
    try {
      const { base64, mimeType } = await processImage(uri);
      const scanned = await scanRecipe(base64, mimeType);
      const recipe = await addRecipe(session.user.id, scanned);
      setImportedRecipeId(recipe.id);
      setImportStatus('success');
    } catch (e: any) {
      setImportStatus('error');
      Alert.alert('Scan failed', e.message);
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
    } catch (e: any) {
      setImportStatus('error');
      Alert.alert('Import failed', e.message);
    }
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
      icon: '\uD83D\uDCF7',
      label: 'Scan Photo',
      subtitle: 'Cookbook or recipe card',
      onPress: () => handleScan(takePhoto),
    },
    {
      icon: '\uD83D\uDD17',
      label: 'Import URL',
      subtitle: 'Paste any recipe link',
      onPress: () => setShowUrlInput(!showUrlInput),
    },
    {
      icon: '\uD83D\uDDBC\uFE0F',
      label: 'Choose Photo',
      subtitle: 'From your gallery',
      onPress: () => handleScan(pickImage),
    },
    {
      icon: '\u270F\uFE0F',
      label: 'Manual Entry',
      subtitle: 'Type it yourself',
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
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500', marginLeft: 10 }}>Importing recipe...</Text>
        </View>
      )}

      {importStatus === 'success' && (
        <TouchableOpacity
          onPress={() => {
            if (importedRecipeId) router.push(`/recipe/${importedRecipeId}`);
            setImportStatus('idle');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.accentGreenSoft, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}
        >
          <Text style={{ fontSize: 16 }}>{'\u2705'}</Text>
          <Text style={{ color: colors.accentGreen, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>Recipe saved! View it →</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>Add a Recipe</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>Choose how to add</Text>

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
            <Text style={{ fontSize: 16, marginRight: 8 }}>{'\uD83D\uDCCB'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Paste from clipboard</Text>
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
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginRight: 10 }}>{'\uD83C\uDF99\uFE0F'}</Text>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Speak a Recipe</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>Dictate and AI formats it instantly</Text>
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
              placeholder="Paste recipe URL..."
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
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{'\uD83D\uDCCB'} Paste</Text>
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
                <Text style={{ color: urlInput.trim() ? '#ffffff' : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Import</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Or share from your browser → In Chrome, tap Share ⋮ → ChefsBook</Text>
            </View>
          </View>
        </Animated.View>

        {/* Share from browser banner */}
        <View
          style={{
            backgroundColor: colors.bgBase,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderDefault,
            padding: 16,
            marginTop: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>{'\uD83C\uDF10'}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>Share recipes directly from Chrome</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Open any recipe in your browser, tap Share, select ChefsBook
          </Text>
          <View style={{ marginTop: 10, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>1. Open a recipe page in Chrome</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>2. Tap ⋮ menu → Share</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>3. Select ChefsBook from the list</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function GridCell({
  icon,
  label,
  subtitle,
  onPress,
  colors,
}: {
  icon: string;
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
        backgroundColor: colors.bgCard,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.borderDefault,
        height: 130,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 36, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}
