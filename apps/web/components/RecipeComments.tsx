'use client';

import { useState, useEffect } from 'react';
import { supabase, getComments, postComment, deleteComment, flagComment, blockCommenter, createNotification } from '@chefsbook/db';
import type { CommentRow } from '@chefsbook/db';
import { moderateComment } from '@chefsbook/ai';
import Link from 'next/link';
import { useConfirmDialog, useAlertDialog } from './useConfirmDialog';

interface Props {
  recipeId: string;
  recipeOwnerId: string;
  commentsEnabled: boolean;
}

export default function RecipeComments({ recipeId, recipeOwnerId, commentsEnabled }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentRow | null>(null);
  const [replyText, setReplyText] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [confirmDel, ConfirmDialog] = useConfirmDialog();
  const [showAlert, AlertDialog] = useAlertDialog();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setIsOwner(uid === recipeOwnerId);
      if (uid) supabase.from('user_profiles').select('username').eq('id', uid).single().then(({ data: p }) => { if (p?.username) setUsername(p.username); });
    });
    loadComments();
  }, [recipeId]);

  const loadComments = async () => {
    const data = await getComments(recipeId);
    setComments(data);
  };

  const handlePost = async () => {
    if (!text.trim() || !userId || posting) return;
    setPosting(true);
    try {
      // Attempt moderation (may fail on web due to CORS — post as visible if it does)
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
        // Moderation unavailable on web (CORS) — allow post without moderation
      }
      await postComment(recipeId, userId, text.trim(), status, flagSeverity, flagSource, flagReason);
      setText('');
      await loadComments();
    } catch (e: any) {
      alert(e.message ?? 'Failed to post comment');
    }
    setPosting(false);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !userId || !replyingTo || posting) return;
    setPosting(true);
    try {
      const saved = await postComment(recipeId, userId, replyText.trim(), 'visible', undefined, undefined, undefined, replyingTo.id);
      // Notify parent commenter
      if (replyingTo.user_id !== userId) {
        createNotification({
          user_id: replyingTo.user_id,
          type: 'comment_reply',
          actor_id: userId,
          actor_username: username ?? undefined,
          recipe_id: recipeId,
          comment_id: saved.id,
          message: `replied to your comment`,
        }).catch(() => {});
      }
      setReplyText('');
      setReplyingTo(null);
      await loadComments();
    } catch {}
    setPosting(false);
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
    showAlert({ icon: '✓', title: 'Thanks for reporting', body: 'We\'ll review this comment shortly.' });
  };

  const timeAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const renderComment = (c: CommentRow) => (
    <div key={c.id} className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-cb-primary text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {c.display_name?.charAt(0)?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/chef/${c.user_id}`} className="font-semibold text-cb-text hover:underline text-xs">@{c.username ?? '?'}</Link>
          <span className="text-cb-muted text-[11px]">{timeAgo(c.created_at)}</span>
        </div>
        <p className="text-sm text-cb-text mt-0.5">{c.content}</p>
        <div className="flex gap-3 mt-1">
          {userId && !c.parent_id && <button onClick={() => { setReplyingTo(c); setReplyText(`@${c.username} `); }} className="text-xs text-cb-muted hover:text-cb-primary">Reply</button>}
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
      </div>
    </div>
  );

  if (!commentsEnabled) return <p className="text-cb-muted text-sm mt-4">Comments are disabled for this recipe.</p>;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-cb-text mb-4">Comments ({comments.filter(c => !c.parent_id).length})</h3>

      {comments.filter(c => !c.parent_id).length === 0 && <p className="text-cb-muted text-sm mb-4">No comments yet. Be the first!</p>}

      <div className="space-y-4 mb-4">
        {comments.filter(c => !c.parent_id).map((c) => {
          const replies = comments.filter(r => r.parent_id === c.id);
          const shownReplies = replies.slice(0, 3);
          const hiddenCount = replies.length - 3;
          return (
            <div key={c.id}>
              {renderComment(c)}
              {/* Replies */}
              {shownReplies.length > 0 && (
                <div className="ml-10 mt-1 space-y-2 border-l-2 border-cb-border/50 pl-4">
                  {shownReplies.map(r => renderComment(r))}
                  {hiddenCount > 0 && (
                    <button className="text-xs text-cb-primary hover:underline">▶ {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}</button>
                  )}
                </div>
              )}
              {/* Inline reply input */}
              {replyingTo?.id === c.id && (
                <div className="ml-10 mt-2 border-l-2 border-cb-primary/30 pl-4">
                  <p className="text-xs text-cb-muted mb-1">↩ Replying to @{c.username}</p>
                  <div className="flex gap-2">
                    <input value={replyText} onChange={e => setReplyText(e.target.value.slice(0, 500))} placeholder={`Reply to @${c.username}...`} autoFocus maxLength={500} className="flex-1 bg-cb-bg border border-cb-border rounded-input px-3 py-1.5 text-sm outline-none focus:border-cb-primary" />
                    <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-xs text-cb-muted">Cancel</button>
                    <button onClick={handleReply} disabled={replyText.trim().length < 2 || posting} className="bg-cb-primary text-white px-3 py-1.5 rounded-input text-xs font-semibold disabled:opacity-50">Send</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
