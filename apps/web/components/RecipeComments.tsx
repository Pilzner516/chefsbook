'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, getComments, postComment, deleteComment, flagComment, blockCommenter, createNotification, toggleCommentLike } from '@chefsbook/db';
import type { CommentRow } from '@chefsbook/db';
import { moderateComment } from '@chefsbook/ai';
import Link from 'next/link';
import { useConfirmDialog, useAlertDialog } from './useConfirmDialog';
import { PLAN_LIMITS } from '@chefsbook/db';

interface Props {
  recipeId: string;
  recipeOwnerId: string;
  recipeTitle?: string;
  commentsEnabled: boolean;
}

export default function RecipeComments({ recipeId, recipeOwnerId, recipeTitle, commentsEnabled }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<string>('free');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [confirmDel, ConfirmDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setIsOwner(uid === recipeOwnerId);
      if (uid) {
        supabase.from('user_profiles').select('username, plan_tier').eq('id', uid).single().then(({ data: p }) => {
          if (p?.username) setUsername(p.username);
          if (p?.plan_tier) setPlanTier(p.plan_tier);
        });
      }
    });
    loadComments();
  }, [recipeId]);

  const loadComments = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    const data = await getComments(recipeId, session?.user?.id);
    setComments(data);
  };

  const handlePost = async () => {
    if (!text.trim() || !userId || posting) return;
    setPosting(true);
    try {
      let status = 'visible';
      let flagSeverity: string | undefined;
      let flagSource: string | undefined;
      let flagReason: string | undefined;
      try {
        const mod = await moderateComment(text.trim());
        if (mod.verdict === 'serious') status = 'hidden_pending_review';
        if (mod.verdict !== 'clean') {
          flagSeverity = mod.verdict;
          flagSource = 'ai';
          flagReason = mod.reason ?? undefined;
        }
      } catch {
        // Moderation unavailable on web (CORS)
      }
      const saved = await postComment(recipeId, userId, text.trim(), status, flagSeverity, flagSource, flagReason);
      // Notify recipe owner
      if (recipeOwnerId !== userId) {
        createNotification({
          user_id: recipeOwnerId,
          type: 'recipe_comment',
          actor_id: userId,
          actor_username: username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipeTitle ?? undefined,
          comment_id: saved.id,
          message: 'commented on your recipe',
        }).catch(() => {});
      }
      setText('');
      await loadComments();
    } catch (e: any) {
      alert(e.message ?? 'Failed to post comment');
    }
    setPosting(false);
  };

  const handleReply = async (parentComment: CommentRow) => {
    if (!replyText.trim() || !userId || posting) return;
    setPosting(true);
    try {
      const saved = await postComment(recipeId, userId, replyText.trim(), 'visible', undefined, undefined, undefined, parentComment.id);
      // Notify parent commenter (reply notification)
      if (parentComment.user_id !== userId) {
        createNotification({
          user_id: parentComment.user_id,
          type: 'comment_reply',
          actor_id: userId,
          actor_username: username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipeTitle ?? undefined,
          comment_id: saved.id,
          message: 'replied to your comment',
        }).catch(() => {});
      }
      // Also notify recipe owner if different from reply recipient
      if (recipeOwnerId !== userId && recipeOwnerId !== parentComment.user_id) {
        createNotification({
          user_id: recipeOwnerId,
          type: 'recipe_comment',
          actor_id: userId,
          actor_username: username ?? undefined,
          recipe_id: recipeId,
          recipe_title: recipeTitle ?? undefined,
          comment_id: saved.id,
          message: 'commented on your recipe',
        }).catch(() => {});
      }
      setReplyText('');
      setReplyingTo(null);
      await loadComments();
    } catch {}
    setPosting(false);
  };

  const handleLike = async (comment: CommentRow) => {
    if (!userId) return;
    if (!(PLAN_LIMITS as any)[planTier]?.canComment) {
      showAlert({ icon: '💎', title: 'Upgrade required', body: 'Upgrade to Chef plan or higher to like comments.' });
      return;
    }
    // Optimistic update
    setComments(prev => prev.map(c =>
      c.id === comment.id
        ? { ...c, isLiked: !c.isLiked, like_count: (c.like_count ?? 0) + (c.isLiked ? -1 : 1) }
        : c
    ));
    try {
      await toggleCommentLike(comment.id, userId);
    } catch {
      await loadComments(); // revert on failure
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDel({ icon: '🗑️', title: 'Delete comment?', body: 'This comment will be permanently removed.', confirmLabel: 'Delete' });
    if (!ok) return;
    await deleteComment(id);
    loadComments();
  };

  const handleFlag = async (commentId: string, reason: string) => {
    if (!userId) return;
    await flagComment(commentId, userId, reason);
    setFlagging(null);
    showAlert({ icon: '✓', title: 'Thanks for reporting', body: "We'll review this comment shortly." });
  };

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const toggleExpand = (commentId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  // Build tree from flat list
  const getChildren = (parentId: string) =>
    comments.filter(c => c.parent_id === parentId);

  const renderComment = (c: CommentRow, depth: number) => {
    const children = getChildren(c.id);
    const isExpanded = expandedThreads.has(c.id);

    return (
      <div key={c.id}>
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-cb-primary text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {c.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm">
              <Link href={`/u/${c.username ?? c.user_id}`} className="font-semibold text-cb-text hover:underline text-xs">@{c.username ?? '?'}</Link>
              <span className="text-cb-muted text-[11px]">{timeAgo(c.created_at)}</span>
            </div>
            <p className="text-sm text-cb-text mt-0.5">{c.content}</p>
            <div className="flex gap-3 mt-1 items-center">
              {/* Like button */}
              <button onClick={() => handleLike(c)} className="flex items-center gap-1 text-xs text-cb-muted hover:text-cb-primary">
                <span className={c.isLiked ? 'text-red-500' : ''}>{c.isLiked ? '❤️' : '🤍'}</span>
                {(c.like_count ?? 0) > 0 && <span className={c.isLiked ? 'text-red-500' : ''}>{c.like_count}</span>}
              </button>
              {/* Reply button — on every comment */}
              {userId && (
                <button
                  onClick={() => { setReplyingTo(c.id); setReplyText(''); }}
                  className="text-xs text-cb-muted hover:text-cb-primary"
                >
                  Reply
                </button>
              )}
              {userId && <button onClick={() => setFlagging(c.id)} className="text-xs text-cb-muted hover:text-cb-primary">🚩</button>}
              {isOwner && c.user_id !== userId && <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>}
            </div>
            {flagging === c.id && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {['Inappropriate', 'Harassment', 'Spam', 'Other'].map((r) => (
                  <button key={r} onClick={() => handleFlag(c.id, r)} className="text-xs bg-cb-bg border border-cb-border rounded-full px-3 py-1 hover:bg-cb-base">{r}</button>
                ))}
                <button onClick={() => setFlagging(null)} className="text-xs text-cb-muted">Cancel</button>
              </div>
            )}
            {/* Inline reply input */}
            {replyingTo === c.id && (
              <div className="mt-2 border-l-2 border-cb-primary/30 pl-4">
                <p className="text-xs text-cb-muted mb-1">↩ Replying to @{c.username}</p>
                <div className="flex gap-2">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value.slice(0, 500))}
                    placeholder={`Reply to @${c.username}...`}
                    autoFocus
                    maxLength={500}
                    className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-1.5 text-sm outline-none focus:border-cb-primary"
                  />
                  <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-xs text-cb-muted">Cancel</button>
                  <button onClick={() => handleReply(c)} disabled={replyText.trim().length < 2 || posting} className="bg-cb-primary text-white px-3 py-1.5 rounded-input text-xs font-semibold disabled:opacity-50">Send</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Children (replies) */}
        {children.length > 0 && depth < 2 && (
          <div className="ml-10 mt-1 space-y-2 border-l-2 border-cb-border/50 pl-4">
            {children.map(child => renderComment(child, depth + 1))}
          </div>
        )}
        {children.length > 0 && depth >= 2 && !isExpanded && (
          <div className="ml-10 mt-1 pl-4">
            <button onClick={() => toggleExpand(c.id)} className="text-xs text-cb-primary hover:underline">
              ▶ {children.length} more {children.length === 1 ? 'reply' : 'replies'}
            </button>
          </div>
        )}
        {children.length > 0 && depth >= 2 && isExpanded && (
          <div className="ml-10 mt-1 space-y-2 border-l-2 border-cb-border/50 pl-4">
            {children.map(child => renderComment(child, depth + 1))}
            <button onClick={() => toggleExpand(c.id)} className="text-xs text-cb-muted hover:underline">▲ Collapse</button>
          </div>
        )}
      </div>
    );
  };

  if (!commentsEnabled) return <p className="text-cb-muted text-sm mt-4">Comments are disabled for this recipe.</p>;

  // Top-level comments (already sorted by engagement from getComments)
  const topLevel = comments.filter(c => !c.parent_id);

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-cb-text mb-4">Comments ({topLevel.length})</h3>

      {topLevel.length === 0 && <p className="text-cb-muted text-sm mb-4">No comments yet. Be the first!</p>}

      <div className="space-y-4 mb-4">
        {topLevel.map(c => renderComment(c, 0))}
      </div>

      {userId && (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="Add a comment..."
            maxLength={500}
            className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-2 text-sm outline-none focus:border-cb-primary"
          />
          <button
            onClick={handlePost}
            disabled={!text.trim() || posting}
            className="bg-cb-primary text-white px-4 py-2 rounded-input text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {posting ? '...' : 'Post'}
          </button>
        </div>
      )}
      <ConfirmDialog />
      <AlertDialog />
    </div>
  );
}
