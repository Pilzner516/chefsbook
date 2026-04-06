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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../lib/zustand/authStore';
import { useRecipeStore } from '../../lib/zustand/recipeStore';
import { scanRecipe } from '@chefsbook/ai';
import { pickImage, takePhoto, processImage } from '../../lib/image';
import { useTabBarHeight } from '../../lib/useTabBarHeight';
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
  const tabBarHeight = useTabBarHeight();
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
      iconName: 'camera' as const,
      label: 'Scan Photo',
      subtitle: 'Cookbook or recipe card',
      onPress: () => handleScan(takePhoto),
    },
    {
      iconName: 'link' as const,
      label: 'Import URL',
      subtitle: 'Paste any recipe link',
      onPress: () => setShowUrlInput(!showUrlInput),
    },
    {
      iconName: 'images' as const,
      label: 'Choose Photo',
      subtitle: 'From your gallery',
      onPress: () => handleScan(pickImage),
    },
    {
      iconName: 'create' as const,
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
          <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
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
            <Ionicons name="clipboard-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="clipboard-outline" size={16} color={colors.textPrimary} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>Paste</Text>
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
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>Share recipes directly from Chrome</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Open any recipe in your browser, tap Share, select ChefsBook
          </Text>
          <View style={{ marginTop: 10, gap: 6 }}>
            {['Open a recipe page in Chrome', 'Tap \u22EE menu \u2192 Share', 'Select ChefsBook from the list'].map((step, i) => (
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
