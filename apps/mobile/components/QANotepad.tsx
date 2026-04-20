import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import ChefsDialog from './ChefsDialog';
import { useAuthStore } from '../lib/zustand/authStore';
import { supabase } from '@chefsbook/db';

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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const [items, setItems] = useState<QAItem[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    Alert.alert(t('notepad.deleteItem'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => saveItems(items.filter((i) => i.id !== id)) },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert(t('notepad.clearTitle'), t('notepad.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('notepad.clearAll'), style: 'destructive', onPress: () => saveItems([]) },
    ]);
  };

  const handleSendToAdmin = async () => {
    if (!session?.user?.id) return;
    setSending(true);
    try {
      const timestamp = new Date().toISOString();
      const noteLines = items.map((item, i) => `${i + 1}. ${item.text}`).join('\n');
      const body = [
        '[QA NOTEPAD]',
        `User: ${profile?.display_name || profile?.username || 'Unknown'}`,
        `Username: @${profile?.username || 'unknown'}`,
        `User ID: ${session.user.id}`,
        `Submitted: ${timestamp}`,
        '',
        'Notes:',
        noteLines,
      ].join('\n');

      const { error } = await supabase.from('help_requests').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        username: profile?.username,
        message: body,
        subject: `[QA NOTEPAD] from @${profile?.username || 'user'}`,
        body,
        status: 'open',
      });
      if (error) throw error;

      await saveItems([]);

      if (toastTimer.current) clearTimeout(toastTimer.current);
      setShowSuccessToast(true);
      toastTimer.current = setTimeout(() => setShowSuccessToast(false), 2500);
    } catch (e) {
      console.warn('Failed to send QA notepad:', e);
      Alert.alert(t('common.errorTitle'), t('notepad.sendFailed'));
    } finally {
      setSending(false);
      setShowSendConfirm(false);
    }
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
          Alert.alert(t('notepad.copied'), t('notepad.copiedBody'));
        }
      } catch {
        await Clipboard.setStringAsync(report);
        Alert.alert(t('notepad.copied'), t('notepad.copiedBody'));
      }
    } else {
      try {
        await Clipboard.setStringAsync(report);
        Alert.alert(t('notepad.copied'), t('notepad.copiedBody'));
      } catch {
        Alert.alert(t('notepad.share'), report);
      }
    }
  };

  return (
    <>
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
              {isStaging && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{t('notepad.share')}</Text>}
            </TouchableOpacity>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600' }}>{t('notepad.title')}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('notepad.subtitle')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (items.length === 0) {
                    Alert.alert(t('notepad.sendTitle'), t('notepad.sendEmpty'));
                    return;
                  }
                  setShowSendConfirm(true);
                }}
                style={{ padding: 4 }}
                disabled={sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Ionicons name="paper-plane-outline" size={22} color={colors.accent} />
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Add input */}
          {showInput && (
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('notepad.placeholder')}
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
                  <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAdd}
                  disabled={!inputText.trim()}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: inputText.trim() ? colors.accent : colors.bgBase, opacity: inputText.trim() ? 1 : 0.5 }}
                >
                  <Text style={{ color: inputText.trim() ? '#fff' : colors.textMuted, fontSize: 14, fontWeight: '600' }}>{t('common.add')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* List */}
          <ScrollView
            style={{ flex: 1, padding: 16 }}
            contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
          >
            {items.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Text style={{ color: colors.textMuted, fontSize: 15 }}>{t('notepad.noItems')}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{t('notepad.noItemsSub')}</Text>
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
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{t('notepad.clearAll')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* FAB — Add Item */}
          {!showInput && (
            <TouchableOpacity
              onPress={() => setShowInput(true)}
              style={{
                position: 'absolute',
                bottom: 16 + insets.bottom,
                right: 20,
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 6,
              }}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Success toast */}
          {showSuccessToast && (
            <View style={{
              position: 'absolute',
              top: 80,
              left: 24,
              right: 24,
              backgroundColor: '#2d6a4f',
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 20,
              alignItems: 'center',
              elevation: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
                {t('notepad.sendSuccess')}
              </Text>
            </View>
          )}
        </View>
      </View>

    </Modal>

    <ChefsDialog
      visible={showSendConfirm}
      icon="📋"
      title={t('notepad.sendConfirmTitle')}
      body={t('notepad.sendConfirmBody')}
      onClose={() => setShowSendConfirm(false)}
      buttons={[
        { label: t('common.cancel'), variant: 'cancel', onPress: () => setShowSendConfirm(false) },
        { label: t('notepad.sendConfirm'), variant: 'primary', onPress: handleSendToAdmin },
      ]}
    />
    </>
  );
}
