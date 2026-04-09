import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { getComments, postComment, deleteComment, flagComment, blockCommenter, toggleComments } from '@chefsbook/db';
import type { CommentRow } from '@chefsbook/db';
import { moderateComment } from '@chefsbook/ai';
import { PLAN_LIMITS } from '@chefsbook/db';
import { Avatar } from './UIKit';
import { getInitials } from '@chefsbook/ui';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  recipeId: string;
  recipeOwnerId: string;
  commentsEnabled: boolean;
  isPublic: boolean;
}

export function RecipeComments({ recipeId, recipeOwnerId, commentsEnabled, isPublic }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const planTier = useAuthStore((s) => s.planTier);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showFlagPicker, setShowFlagPicker] = useState<string | null>(null);

  const isOwner = session?.user?.id === recipeOwnerId;
  const canComment = PLAN_LIMITS[planTier]?.canComment && profile?.is_searchable && !profile?.comments_suspended;

  useEffect(() => {
    if (isPublic) loadComments();
  }, [recipeId]);

  const loadComments = async () => {
    const data = await getComments(recipeId);
    setComments(data);
  };

  const handlePost = async () => {
    if (!text.trim() || !session?.user?.id || posting) return;
    setPosting(true);
    try {
      // AI moderation
      const modResult = await moderateComment(text.trim());

      let status = 'visible';
      let flagSeverity: string | undefined;
      let flagSource: string | undefined;
      let flagReason: string | undefined;

      if (modResult.verdict === 'mild') {
        status = 'visible';
        flagSeverity = 'mild';
        flagSource = 'ai';
        flagReason = modResult.reason ?? undefined;
      } else if (modResult.verdict === 'serious') {
        status = 'hidden_pending_review';
        flagSeverity = 'serious';
        flagSource = 'ai';
        flagReason = modResult.reason ?? undefined;
        // Suspend commenter
        const { supabase } = await import('@chefsbook/db');
        await supabase.from('user_profiles').update({ comments_suspended: true }).eq('id', session.user.id);
      }

      await postComment(recipeId, session.user.id, text.trim(), status, flagSeverity, flagSource, flagReason);
      setText('');
      await loadComments();
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert(t('comments.deleteComment'), t('comments.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await deleteComment(commentId); loadComments(); } },
    ]);
  };

  const handleBlock = (userId: string) => {
    Alert.alert(t('comments.blockUser'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => { if (session?.user?.id) await blockCommenter(session.user.id, userId); } },
    ]);
  };

  const handleFlag = async (commentId: string, reason: string) => {
    if (!session?.user?.id) return;
    await flagComment(commentId, session.user.id, reason);
    setShowFlagPicker(null);
    Alert.alert(t('comments.flagSent'));
  };

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  if (!isPublic) return null;

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
        {t('comments.title')} ({comments.length})
      </Text>

      {!commentsEnabled && (
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>{t('comments.commentsOff')}</Text>
      )}

      {commentsEnabled && (
        <>
          {comments.map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => router.push(`/chef/${c.user_id}`)}>
                <Avatar uri={c.avatar_url} initials={getInitials(c.display_name)} size={32} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>@{c.username ?? '?'}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(c.created_at)}</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 2 }}>{c.content}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                  {session?.user && (
                    <TouchableOpacity onPress={() => setShowFlagPicker(c.id)}>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>🚩 {t('comments.flag')}</Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && c.user_id !== session?.user?.id && (
                    <>
                      <TouchableOpacity onPress={() => handleDelete(c.id)}>
                        <Text style={{ color: colors.danger, fontSize: 12 }}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleBlock(c.user_id)}>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Block</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          ))}

          {comments.length === 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>{t('comments.noComments')}</Text>
          )}

          {/* Comment input */}
          {canComment ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: insets.bottom + 8 }}>
              <TextInput
                value={text}
                onChangeText={(t) => setText(t.slice(0, 500))}
                placeholder={t('comments.addComment')}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                style={{
                  flex: 1, backgroundColor: colors.bgBase, borderRadius: 10, borderWidth: 1,
                  borderColor: colors.borderDefault, padding: 10, fontSize: 14, color: colors.textPrimary,
                  maxHeight: 80,
                }}
              />
              <TouchableOpacity
                onPress={handlePost}
                disabled={!text.trim() || posting}
                style={{
                  backgroundColor: text.trim() ? colors.accent : colors.bgBase,
                  borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10,
                  opacity: text.trim() && !posting ? 1 : 0.5,
                }}
              >
                <Text style={{ color: text.trim() ? '#ffffff' : colors.textMuted, fontSize: 14, fontWeight: '600' }}>
                  {posting ? '...' : t('comments.post')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : profile?.comments_suspended ? (
            <Text style={{ color: colors.danger, fontSize: 13 }}>{t('comments.suspended')}</Text>
          ) : !PLAN_LIMITS[planTier]?.canComment ? (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('comments.planRequired')}</Text>
          ) : !profile?.is_searchable ? (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('comments.searchableRequired')}</Text>
          ) : null}
        </>
      )}

      {/* Flag reason picker */}
      <Modal visible={!!showFlagPicker} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowFlagPicker(null)}>
          <View style={{ backgroundColor: colors.bgCard, borderRadius: 14, padding: 20, width: 280 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>{t('comments.flagTitle')}</Text>
            {['flagInappropriate', 'flagHarassment', 'flagSpam', 'flagOther'].map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => showFlagPicker && handleFlag(showFlagPicker, t(`comments.${key}`))}
                style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderDefault }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{t(`comments.${key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
