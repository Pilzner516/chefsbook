import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';

const isStaging = process.env.EXPO_PUBLIC_APP_VARIANT === 'staging';

const QA_FILE = (FileSystem.documentDirectory ?? '') + 'qa_notepad.json';

interface QAItem {
  id: string;
  text: string;
  type: 'bug' | 'feature' | 'note';
  createdAt: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function QANotepad({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<QAItem[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');

  // Load items on open
  useEffect(() => {
    if (visible) loadItems();
  }, [visible]);

  const loadItems = async () => {
    try {
      const info = await FileSystem.getInfoAsync(QA_FILE);
      if (info.exists) {
        const json = await FileSystem.readAsStringAsync(QA_FILE);
        setItems(JSON.parse(json));
      }
    } catch {
      setItems([]);
    }
  };

  const saveItems = async (newItems: QAItem[]) => {
    setItems(newItems);
    try {
      await FileSystem.writeAsStringAsync(QA_FILE, JSON.stringify(newItems, null, 2));
    } catch (e) {
      console.warn('Failed to save QA items:', e);
    }
  };

  const handleAdd = () => {
    const text = inputText.trim();
    if (!text) return;
    const item: QAItem = {
      id: Date.now().toString(),
      text,
      type: 'note',
      createdAt: new Date().toISOString(),
    };
    saveItems([item, ...items]);
    setInputText('');
    setShowInput(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete this item?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => saveItems(items.filter((i) => i.id !== id)) },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear all notes?', 'This will permanently delete all notepad entries.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => saveItems([]) },
    ]);
  };

  const handleExport = async () => {
    const date = new Date().toLocaleDateString();
    const report = `ChefsBook QA Report — ${date}\n\n` +
      items.map((item, i) => `${i + 1}. ${item.text}`).join('\n');

    if (isStaging) {
      // In staging: write to temp file and share via native share sheet
      try {
        const tempFile = (FileSystem.cacheDirectory ?? '') + 'qa_report.txt';
        await FileSystem.writeAsStringAsync(tempFile, report);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(tempFile, { mimeType: 'text/plain', dialogTitle: 'Share QA Report' });
        } else {
          await Clipboard.setStringAsync(report);
          Alert.alert('Copied!', 'QA report copied to clipboard.');
        }
      } catch {
        await Clipboard.setStringAsync(report);
        Alert.alert('Copied!', 'QA report copied to clipboard.');
      }
    } else {
      try {
        await Clipboard.setStringAsync(report);
        Alert.alert('Copied!', 'QA report copied to clipboard.');
      } catch {
        Alert.alert('Export', report);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: colors.bgScreen,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          flex: 1,
          marginTop: 60,
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderDefault,
          }}>
            <TouchableOpacity
              onPress={handleExport}
              style={isStaging ? {
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: colors.accent, borderRadius: 8,
                paddingHorizontal: 10, paddingVertical: 6,
              } : { padding: 4 }}
            >
              <Ionicons name="share-outline" size={isStaging ? 16 : 20} color={isStaging ? '#fff' : colors.textMuted} />
              {isStaging && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Share</Text>}
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600' }}>QA Notepad</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Tap + to log a bug or feature request</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Add input */}
          {showInput && (
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Describe the bug or feature..."
                placeholderTextColor={colors.textSecondary}
                multiline
                autoFocus
                style={{
                  backgroundColor: colors.bgBase,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.borderDefault,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => { setShowInput(false); setInputText(''); }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.borderDefault }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAdd}
                  disabled={!inputText.trim()}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: inputText.trim() ? colors.accent : colors.bgBase, opacity: inputText.trim() ? 1 : 0.5 }}
                >
                  <Text style={{ color: inputText.trim() ? '#fff' : colors.textMuted, fontSize: 14, fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* List */}
          <ScrollView style={{ flex: 1, padding: 16 }}>
            {items.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Text style={{ color: colors.textMuted, fontSize: 15 }}>No items logged yet</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Tap + Add to log your first item</Text>
              </View>
            ) : (
              items.map((item, i) => (
                <View key={item.id} style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderDefault,
                }}>
                  <Text style={{ color: colors.textMuted, fontSize: 14, width: 28 }}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4, marginLeft: 8 }}>
                    <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            {/* Clear All — below list, separated from header actions */}
            {items.length > 0 && (
              <TouchableOpacity onPress={handleClearAll} style={{ marginTop: 24, paddingVertical: 12 }}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Clear All</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer */}
          {!showInput && (
            <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.borderDefault }}>
              <TouchableOpacity
                onPress={() => setShowInput(true)}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>+ Add Item</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
