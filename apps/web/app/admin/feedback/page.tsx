'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@chefsbook/db';
import { adminFetch } from '@/lib/adminFetch';
import { useConfirmDialog } from '@/components/useConfirmDialog';

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

interface FeedbackRow {
  id: string;
  user_id: string | null;
  username: string | null;
  user_email: string | null;
  display_name: string | null;
  type: 'bug' | 'suggestion' | 'praise' | 'feature_request' | 'question' | 'other';
  tag: 'Bug' | 'Feature Request' | 'Question' | 'Other' | null;
  source: 'feedback' | 'got_an_idea' | 'qa_notepad' | null;
  screen: string | null;
  description: string;
  app_version: string | null;
  platform: string | null;
  status: 'new' | 'under_review' | 'resolved';
  created_at: string;
  note_count: number;
  message_count: number;
}

interface FeedbackNote {
  id: string;
  feedback_id: string;
  admin_id: string;
  admin_username: string;
  note: string;
  created_at: string;
}

interface FeedbackMessage {
  id: string;
  feedback_id: string;
  sender_id: string;
  sender_username: string;
  message: string;
  is_admin_message: boolean;
  created_at: string;
}

const TYPE_BADGES: Record<string, { bg: string; text: string; icon: string }> = {
  bug: { bg: 'bg-red-100', text: 'text-red-700', icon: '🐛' },
  suggestion: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '💡' },
  praise: { bg: 'bg-green-100', text: 'text-green-700', icon: '🎉' },
  feature_request: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '✨' },
  question: { bg: 'bg-cyan-100', text: 'text-cyan-700', icon: '❓' },
  other: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '💬' },
};

const TAG_BADGES: Record<string, { bg: string; text: string }> = {
  'Bug': { bg: 'bg-red-100', text: 'text-red-700' },
  'Feature Request': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Question': { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  'Other': { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function FeedbackCard({
  feedback,
  onStatusChange,
  onDelete,
}: {
  feedback: FeedbackRow;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const badge = TYPE_BADGES[feedback.type] ?? TYPE_BADGES.bug;
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const [notes, setNotes] = useState<FeedbackNote[]>([]);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [localNoteCount, setLocalNoteCount] = useState(feedback.note_count);
  const [localMessageCount, setLocalMessageCount] = useState(feedback.message_count);

  const loadNotes = async () => {
    if (notes.length > 0) return;
    setLoadingNotes(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/feedback/${feedback.id}/notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {}
    setLoadingNotes(false);
  };

  const loadMessages = async () => {
    if (messages.length > 0) return;
    setLoadingMessages(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/feedback/${feedback.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {}
    setLoadingMessages(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/feedback/${feedback.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: newNote }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) => [...prev, data.note]);
        setLocalNoteCount((c) => c + 1);
        setNewNote('');
      }
    } catch {}
    setSavingNote(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || savingMessage) return;
    setSavingMessage(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/admin/feedback/${feedback.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessage }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        setLocalMessageCount((c) => c + 1);
        setNewMessage('');
      }
    } catch {}
    setSavingMessage(false);
  };

  const toggleNotes = () => {
    if (!notesExpanded) loadNotes();
    setNotesExpanded(!notesExpanded);
  };

  const toggleMessages = () => {
    if (!messagesExpanded) loadMessages();
    setMessagesExpanded(!messagesExpanded);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-2">
            {feedback.username ? (
              <Link
                href={`/chef/${feedback.username}`}
                className="w-8 h-8 rounded-full bg-cb-primary text-white flex items-center justify-center text-xs font-bold shrink-0 hover:ring-2 hover:ring-cb-primary/30 transition"
              >
                {feedback.username.charAt(0).toUpperCase()}
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold shrink-0">
                ?
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {feedback.username ? (
                <Link
                  href={`/chef/${feedback.username}`}
                  className="text-sm font-semibold text-gray-900 hover:text-cb-primary hover:underline transition"
                >
                  @{feedback.username}
                </Link>
              ) : (
                <span className="text-sm text-gray-500">Anonymous</span>
              )}
              {/* Tag pill (primary classification for Got an Idea) */}
              {feedback.tag && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${TAG_BADGES[feedback.tag]?.bg ?? 'bg-gray-100'} ${TAG_BADGES[feedback.tag]?.text ?? 'text-gray-600'}`}
                >
                  {feedback.tag}
                </span>
              )}
              {/* Type badge (fallback when no tag) */}
              {!feedback.tag && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.bg} ${badge.text}`}
                >
                  {badge.icon} {feedback.type}
                </span>
              )}
              {/* Got an Idea source badge */}
              {feedback.source === 'got_an_idea' && (
                <span className="text-[9px] font-medium bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">
                  💡 Got an Idea
                </span>
              )}
              {feedback.screen && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {feedback.screen}
                </span>
              )}
              {feedback.status === 'under_review' && (
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Under Review
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 whitespace-pre-wrap">{feedback.description}</p>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">{timeAgo(feedback.created_at)}</span>
            {feedback.platform && (
              <span className="text-xs text-gray-400">
                {feedback.platform === 'ios'
                  ? '📱 iOS'
                  : feedback.platform === 'android'
                    ? '🤖 Android'
                    : feedback.platform}
              </span>
            )}
            {feedback.app_version && <span className="text-xs text-gray-400">v{feedback.app_version}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-4">
          {feedback.status === 'new' && (
            <button
              onClick={() => onStatusChange(feedback.id, 'under_review')}
              className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition"
            >
              Mark Under Review
            </button>
          )}
          <button
            onClick={() => onDelete(feedback.id)}
            className="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Admin Notes Section */}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button
          onClick={toggleNotes}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <span className={notesExpanded ? 'rotate-90' : ''}>▶</span>
          {localNoteCount > 0 ? `Admin Notes (${localNoteCount})` : 'Add note'}
        </button>
        {notesExpanded && (
          <div className="mt-2 bg-gray-50 rounded-lg p-3">
            {loadingNotes ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : (
              <>
                {notes.map((note) => (
                  <div key={note.id} className="mb-2 last:mb-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">@{note.admin_username}</span>
                      <span className="text-xs text-gray-400">{timeAgo(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600">{note.note}</p>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a tracking note..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cb-primary/30"
                    rows={2}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={savingNote || !newNote.trim()}
                    className="self-end text-sm font-medium bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {savingNote ? '...' : 'Save Note'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Thread Section */}
      {feedback.user_id && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <button
            onClick={toggleMessages}
            className="text-sm font-medium text-cb-primary hover:text-cb-primary/80 flex items-center gap-1"
          >
            <span className={messagesExpanded ? 'rotate-90' : ''}>▶</span>
            {localMessageCount > 0 ? `Thread with @${feedback.username} (${localMessageCount})` : 'Message Sender'}
          </button>
          {messagesExpanded && (
            <div className="mt-2 bg-blue-50/50 rounded-lg p-3">
              {loadingMessages ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_admin_message ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            msg.is_admin_message
                              ? 'bg-cb-primary text-white'
                              : 'bg-white border border-gray-200 text-gray-700'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <div
                            className={`text-xs mt-1 ${msg.is_admin_message ? 'text-white/70' : 'text-gray-400'}`}
                          >
                            @{msg.sender_username} · {timeAgo(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">No messages yet</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder={`Reply to @${feedback.username}...`}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cb-primary/30"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={savingMessage || !newMessage.trim()}
                      className="text-sm font-medium bg-cb-primary text-white px-4 py-2 rounded-lg hover:bg-cb-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {savingMessage ? '...' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [confirm, ConfirmDialogEl] = useConfirmDialog();

  useEffect(() => {
    (async () => {
      try {
        const data = await adminFetch({ page: 'feedback' });
        setFeedback((data.feedback ?? []) as FeedbackRow[]);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load feedback');
      }
      setLoading(false);
    })();
  }, []);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: status as FeedbackRow['status'] } : f)),
    );
    try {
      const token = await getAuthToken();
      await fetch(`/api/admin/feedback/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
    } catch {
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'new' } : f)));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Feedback',
      body: 'Delete this feedback? This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    setFeedback((prev) => prev.filter((f) => f.id !== id));
    try {
      const token = await getAuthToken();
      await fetch(`/api/admin/feedback/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      window.location.reload();
    }
  }, [confirm]);

  let filtered = feedback;
  if (filterType !== 'all') filtered = filtered.filter((f) => f.type === filterType);
  if (filterTag !== 'all') filtered = filtered.filter((f) => f.tag === filterTag);
  if (filterSource !== 'all') filtered = filtered.filter((f) => f.source === filterSource);
  if (filterStatus === 'under_review') filtered = filtered.filter((f) => f.status === 'under_review');

  const stats = {
    bug: feedback.filter((f) => f.type === 'bug' || f.tag === 'Bug').length,
    suggestion: feedback.filter((f) => f.type === 'suggestion').length,
    praise: feedback.filter((f) => f.type === 'praise').length,
    feature_request: feedback.filter((f) => f.type === 'feature_request' || f.tag === 'Feature Request').length,
    question: feedback.filter((f) => f.type === 'question' || f.tag === 'Question').length,
    got_an_idea: feedback.filter((f) => f.source === 'got_an_idea').length,
    under_review: feedback.filter((f) => f.status === 'under_review').length,
  };

  return (
    <div>
      {ConfirmDialogEl()}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">User Feedback</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setFilterType('all'); setFilterTag('all'); setFilterSource('all'); setFilterStatus('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterType === 'all' && filterTag === 'all' && filterSource === 'all' && filterStatus === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          All ({feedback.length})
        </button>
        <button
          onClick={() => { setFilterTag('Bug'); setFilterType('all'); setFilterSource('all'); setFilterStatus('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterTag === 'Bug' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
        >
          🐛 Bugs ({stats.bug})
        </button>
        <button
          onClick={() => { setFilterTag('Feature Request'); setFilterType('all'); setFilterSource('all'); setFilterStatus('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterTag === 'Feature Request' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
        >
          ✨ Features ({stats.feature_request})
        </button>
        <button
          onClick={() => { setFilterTag('Question'); setFilterType('all'); setFilterSource('all'); setFilterStatus('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterTag === 'Question' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
        >
          ❓ Questions ({stats.question})
        </button>
        <span className="border-l border-gray-300 mx-1" />
        <button
          onClick={() => { setFilterSource('got_an_idea'); setFilterType('all'); setFilterTag('all'); setFilterStatus('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterSource === 'got_an_idea' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
        >
          💡 Got an Idea ({stats.got_an_idea})
        </button>
        <button
          onClick={() => { setFilterStatus('under_review'); setFilterType('all'); setFilterTag('all'); setFilterSource('all'); }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${filterStatus === 'under_review' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          ⏳ Under Review ({stats.under_review})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-lg">No feedback yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Users haven&apos;t submitted any feedback from the mobile app yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <FeedbackCard
              key={f.id}
              feedback={f}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
