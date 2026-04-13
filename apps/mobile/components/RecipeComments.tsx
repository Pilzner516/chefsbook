import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuthStore } from '../lib/zustand/authStore';
import { getComments, postComment, deleteComment, flagComment, blockCommenter, toggleComments, toggleCommentLike, createNotification } from '@chefsbook/db';
import type { CommentRow } from '@chefsbook/db';
import { moderateComment } from '@chefsbook/ai';
import { PLAN_LIMITS } from '@chefsbook/db';
import { Avatar } from './UIKit';
import { getInitials } from '@chefsbook/ui';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  recipeId: string;
  recipeOwnerId: string;
  recipeTitle?: string;
  commentsEnabled: boolean;
  isPublic: boolean;
}

export function RecipeComments({ recipeId, recipeOwnerId, recipeTitle, commentsEnabled, isPublic }: Props) {
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
  const [replyingTo, setReplyingTo] = useState<CommentRow | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  const isOwner = session?.user?.id === recipeOwnerId;
  const canComment = PLAN_LIMITS[planTier]?.canComment && profile?.is_searchable && !profile?.comments_suspended;

  useEffect(() => {
    if (isPublic) loadComments();
  }, [recipeId]);

  const loadComments = async () => {
    const data = await getComments(recipeId, session?.user?.id);
    setComments(data);
  };

  const handlePost = async () => {
    if (!text.trim() || !session?.user?.id || posting) return;
    setPosting(true);
    try {
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
        const { supabase } = await import('@chefsbook/db');
        await supabase.from('user_profiles').update({ comments_suspended: true }).eq('id', session.user.id);
      }

      const saved = await postComment(recipeId, session.user.id, text.trim(), status, flagSeverity, flagSource, flagReason);

      // Notify recipe owner
      if (recipeOwnerId !== session.user.id) {
        createNotification({
          user_id: recipeOwnerId,
          type: 'recipe_comment',
          actor_id: session.user.id,
          actor_username: profile?.username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipeTitle ?? undefined,
          comment_id: saved.id,
          message: 'commented on your recipe',
        }).catch(() => {});
      }

      setText('');
      await loadComments();
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message);
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !session?.user?.id || !replyingTo || posting) return;
    setPosting(true);
    try {
      const saved = await postComment(recipeId, session.user.id, replyText.trim(), 'visible', undefined, undefined, undefined, replyingTo.id);
      // Notify parent commenter
      if (replyingTo.user_id !== session.user.id) {
        createNotification({
          user_id: replyingTo.user_id,
          type: 'comment_reply',
          actor_id: session.user.id,
          actor_username: profile?.username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipeTitle ?? undefined,
          comment_id: saved.id,
          message: 'replied to your comment',
        }).catch(() => {});
      }
      // Also notify recipe owner if different
      if (recipeOwnerId !== session.user.id && recipeOwnerId !== replyingTo.user_id) {
        createNotification({
          user_id: recipeOwnerId,
          type: 'recipe_comment',
          actor_id: session.user.id,
          actor_username: profile?.username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipeTitle ?? undefined,
          comment_id: saved.id,
          message: 'commented on your recipe',
        }).catch(() => {});
      }
      setReplyText('');
      setReplyingTo(null);
      await loadComments();
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e.message ?? 'Failed to post reply');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (comment: CommentRow) => {
    if (!session?.user?.id) return;
    if (!PLAN_LIMITS[planTier]?.canComment) {
      Alert.alert(t('comments.planRequired'));
      return;
    }
    // Optimistic update
    setComments(prev => prev.map(c =>
      c.id === comment.id
        ? { ...c, isLiked: !c.isLiked, like_count: (c.like_count ?? 0) + (c.isLiked ? -1 : 1) }
        : c
    ));
    try {
      await toggleCommentLike(comment.id, session.user.id);
    } catch {
      await loadComments();
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

  const toggleExpand = (commentId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const getChildren = (parentId: string) =>
    comments.filter(c => c.parent_id === parentId);

  const renderComment = (c: CommentRow, depth: number) => {
    const children = getChildren(c.id);
    const isExpanded = expandedThreads.has(c.id);
    const indentLeft = depth > 0 ? 24 : 0;

    return (
      <View key={c.id}>
        <View style={{ flexDirection: 'row', marginBottom: 12, marginLeft: indentLeft }}>
          <TouchableOpacity onPress={() => router.push(`/chef/${c.user_id}`)}>
            <Avatar uri={c.avatar_url} initials={getInitials(c.display_name)} size={32} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>@{c.username ?? '?'}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{timeAgo(c.created_at)}</Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: 14, marginTop: 2 }}>{c.content}</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4, alignItems: 'center' }}>
              {/* Like button */}
              <TouchableOpacity onPress={() => handleLike(c)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 12 }}>{c.isLiked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}</Text>
                {(c.like_count ?? 0) > 0 && (
                  <Text style={{ color: c.isLiked ? '#ef4444' : colors.textMuted, fontSize: 12 }}>{c.like_count}</Text>
                )}
              </TouchableOpacity>
              {/* Reply button — on every comment */}
              {session?.user && (
                <TouchableOpacity onPress={() => { setReplyingTo(c); setReplyText(''); }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Reply</Text>
                </TouchableOpacity>
              )}
              {session?.user && (
                <TouchableOpacity onPress={() => setShowFlagPicker(c.id)}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>🚩</Text>
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
            {/* Inline reply input */}
            {replyingTo?.id === c.id && (
              <View style={{ marginTop: 8, borderLeftWidth: 2, borderLeftColor: colors.accent + '50', paddingLeft: 12 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 4 }}>↩ Replying to @{c.username}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={replyText}
                    onChangeText={(t) => setReplyText(t.slice(0, 500))}
                    placeholder={`Reply to @${c.username}...`}
                    placeholderTextColor={colors.textMuted}
                    maxLength={500}
                    autoFocus
                    style={{
                      flex: 1, backgroundColor: colors.bgBase, borderRadius: 8, borderWidth: 1,
                      borderColor: colors.borderDefault, padding: 8, fontSize: 13, color: colors.textPrimary,
                    }}
                  />
                  <TouchableOpacity onPress={() => { setReplyingTo(null); setReplyText(''); }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleReply}
                    disabled={replyText.trim().length < 2 || posting}
                    style={{
                      backgroundColor: replyText.trim().length >= 2 ? colors.accent : colors.bgBase,
                      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
                      opacity: replyText.trim().length >= 2 && !posting ? 1 : 0.5,
                    }}
                  >
                    <Text style={{ color: replyText.trim().length >= 2 ? '#ffffff' : colors.textMuted, fontSize: 12, fontWeight: '600' }}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Children (replies) — show inline at depth < 2, collapse at depth >= 2 */}
        {children.length > 0 && depth < 2 && (
          <View style={{ marginLeft: indentLeft + 10, borderLeftWidth: 2, borderLeftColor: colors.borderDefault + '50', paddingLeft: 12 }}>
            {children.map(child => renderComment(child, depth + 1))}
          </View>
        )}
        {children.length > 0 && depth >= 2 && !isExpanded && (
          <TouchableOpacity onPress={() => toggleExpand(c.id)} style={{ marginLeft: indentLeft + 10, paddingLeft: 12, marginBottom: 8 }}>
            <Text style={{ color: colors.accent, fontSize: 12 }}>▶ {children.length} more {children.length === 1 ? 'reply' : 'replies'}</Text>
          </TouchableOpacity>
        )}
        {children.length > 0 && depth >= 2 && isExpanded && (
          <View style={{ marginLeft: indentLeft + 10, borderLeftWidth: 2, borderLeftColor: colors.borderDefault + '50', paddingLeft: 12 }}>
            {children.map(child => renderComment(child, depth + 1))}
            <TouchableOpacity onPress={() => toggleExpand(c.id)} style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>▲ Collapse</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (!isPublic) return null;

  const topLevel = comments.filter(c => !c.parent_id);

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
        {t('comments.title')} ({topLevel.length})
      </Text>

      {!commentsEnabled && (
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>{t('comments.commentsOff')}</Text>
      )}

      {commentsEnabled && (
        <>
          {topLevel.map(c => renderComment(c, 0))}

          {topLevel.length === 0 && (
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
