import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  supabase,
  getConversationList,
  getConversation,
  sendMessage,
  markMessagesRead,
  flagMessage,
  getVerifiedUserIds,
} from '@chefsbook/db';
import type { ConversationPreview, DirectMessage } from '@chefsbook/db';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import ChefsDialog from '../components/ChefsDialog';
import VerifiedBadge from '../components/VerifiedBadge';

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function initialOf(name?: string | null, username?: string | null) {
  return (name ?? username ?? '?').charAt(0).toUpperCase();
}

export default function MessagesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const [convos, setConvos] = useState<ConversationPreview[]>([]);
  const [selected, setSelected] = useState<ConversationPreview | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [flagTarget, setFlagTarget] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; body: string } | null>(null);
  const [verifiedUserIds, setVerifiedUserIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  // Load conversation list
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    getConversationList(userId)
      .then(async (c) => {
        setConvos(c);
        // Fetch verified status for all conversation partners
        const otherIds = c.map((convo) => convo.other_user_id).filter((id): id is string => !!id);
        if (otherIds.length > 0) {
          const verifiedIds = await getVerifiedUserIds(otherIds);
          setVerifiedUserIds(verifiedIds);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('dm-realtime-mobile')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload: any) => {
          const newMsg = payload.new as DirectMessage;
          if (selected && newMsg.sender_id === selected.other_user_id) {
            setMessages((prev) => [...prev, newMsg]);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
          }
          getConversationList(userId).then(setConvos).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selected?.other_user_id]);

  const openConvo = async (convo: ConversationPreview) => {
    if (!userId) return;
    setSelected(convo);
    setLoadingThread(true);
    try {
      const msgs = await getConversation(userId, convo.other_user_id);
      setMessages(msgs);
      await markMessagesRead(userId, convo.other_user_id);
      setConvos((prev) =>
        prev.map((c) => (c.other_user_id === convo.other_user_id ? { ...c, unread_count: 0 } : c)),
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !userId || !selected || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(userId, selected.other_user_id, content, 'clean');
      setMessages((prev) => [...prev, msg]);
      setText('');
      setConvos((prev) =>
        prev.map((c) =>
          c.other_user_id === selected.other_user_id
            ? { ...c, last_message: content.slice(0, 80), last_message_at: new Date().toISOString() }
            : c,
        ),
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      setInfoDialog({ title: 'Error', body: e?.message ?? 'Failed to send' });
    }
    setSending(false);
  };

  const handleFlag = async (reason: string) => {
    if (!userId || !flagTarget) return;
    const targetId = flagTarget;
    setFlagTarget(null);
    try {
      await flagMessage(targetId, userId, reason);
      setInfoDialog({ title: 'Reported', body: 'Thanks for reporting.' });
    } catch (e: any) {
      setInfoDialog({ title: 'Error', body: e?.message ?? 'Failed to report' });
    }
  };

  // ---------- Thread view ----------
  if (selected) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bgScreen }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderDefault,
            backgroundColor: colors.bgCard,
            gap: 10,
          }}
        >
          <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </TouchableOpacity>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
              {initialOf(selected.other_display_name, selected.other_username)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}>
                @{selected.other_username}
              </Text>
              {selected.other_user_id && verifiedUserIds.has(selected.other_user_id) && <VerifiedBadge size="sm" />}
            </View>
            {selected.other_display_name ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {selected.other_display_name}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Messages */}
        {loadingThread ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((msg) => {
              const isMine = msg.sender_id === userId;
              return (
                <View
                  key={msg.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end',
                    gap: 6,
                  }}
                >
                  {!isMine && (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                        {initialOf(selected.other_display_name, selected.other_username)}
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      maxWidth: '78%',
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isMine ? colors.accent : colors.bgBase,
                      borderWidth: isMine ? 0 : 1,
                      borderColor: colors.borderDefault,
                    }}
                  >
                    <Text
                      style={{
                        color: isMine ? '#ffffff' : colors.textPrimary,
                        fontSize: 14,
                        lineHeight: 19,
                      }}
                    >
                      {msg.content}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <Text
                        style={{
                          color: isMine ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                          fontSize: 10,
                        }}
                      >
                        {timeAgo(msg.created_at)}
                      </Text>
                      {!isMine && (
                        <TouchableOpacity onPress={() => setFlagTarget(msg.id)}>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>🚩</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Compose */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.borderDefault,
            backgroundColor: colors.bgCard,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8) + 4,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 1000))}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              if (Platform.OS === 'ios') handleSend();
            }}
            style={{
              flex: 1,
              minHeight: 40,
              maxHeight: 120,
              backgroundColor: colors.bgBase,
              borderWidth: 1,
              borderColor: colors.borderDefault,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 10,
              color: colors.textPrimary,
              fontSize: 14,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !text.trim() || sending ? 0.5 : 1,
            }}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Flag reason picker */}
        <ChefsDialog
          visible={!!flagTarget}
          icon="🚩"
          title="Report message"
          body={
            <View style={{ gap: 8, width: '100%' }}>
              {['Inappropriate', 'Harassment', 'Spam', 'Other'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => handleFlag(r)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.borderDefault,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          buttons={[{ label: 'Cancel', variant: 'cancel', onPress: () => setFlagTarget(null) }]}
          onClose={() => setFlagTarget(null)}
        />

        <ChefsDialog
          visible={!!infoDialog}
          title={infoDialog?.title ?? ''}
          body={infoDialog?.body ?? ''}
          buttons={[{ label: 'OK', variant: 'primary', onPress: () => setInfoDialog(null) }]}
          onClose={() => setInfoDialog(null)}
        />
      </KeyboardAvoidingView>
    );
  }

  // ---------- Conversation list ----------
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgScreen }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
          backgroundColor: colors.bgCard,
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 18 }}>Messages</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : convos.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No messages yet.</Text>
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c) => c.other_user_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openConvo(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderDefault,
                backgroundColor: colors.bgCard,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {initialOf(item.other_display_name, item.other_username)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 14 }}
                    numberOfLines={1}
                  >
                    @{item.other_username}
                  </Text>
                  {item.other_user_id && verifiedUserIds.has(item.other_user_id) && <VerifiedBadge size="sm" />}
                  {item.other_display_name ? (
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12 }}
                      numberOfLines={1}
                    >
                      · {item.other_display_name}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 'auto' }}>
                    {timeAgo(item.last_message_at)}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {item.last_message}
                </Text>
              </View>
              {item.unread_count > 0 && (
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.accent,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                    {item.unread_count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <ChefsDialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        body={infoDialog?.body ?? ''}
        buttons={[{ label: 'OK', variant: 'primary', onPress: () => setInfoDialog(null) }]}
        onClose={() => setInfoDialog(null)}
      />
    </View>
  );
}
