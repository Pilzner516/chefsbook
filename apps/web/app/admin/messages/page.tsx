'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@chefsbook/db';
import { adminFetch, adminPost } from '@/lib/adminFetch';
import ChefsDialog from '@/components/ChefsDialog';

type TabKey = 'recipes' | 'comments' | 'messages' | 'inbox';

// ─── Flagged Recipes Tab ────────────────────────────────────────────────────

interface FlagDetail {
  id: string;
  flag_type: string;
  reason: string | null;
  created_at: string;
  flagged_by: string | null;
  user_profiles?: { username: string } | null;
}

interface FlaggedRecipe {
  id: string;
  title: string;
  visibility: string;
  moderation_status: string | null;
  image_url: string | null;
  user_id: string;
  user_profiles: { username: string } | null;
  flags: FlagDetail[];
  flag_count: number;
  latest_flag_at: string | null;
}

function FlaggedRecipesTab() {
  const [recipes, setRecipes] = useState<FlaggedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<FlaggedRecipe | null>(null);
  const [acting, setActing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }
      const res = await fetch('/api/admin/flags', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load flagged recipes');
      }
      const data = await res.json();
      setRecipes(data.recipes || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (recipeId: string, action: string) => {
    setActing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`/api/admin/flags/${recipeId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }
      setSelectedRecipe(null);
      setDeleteConfirm(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
    setActing(false);
  };

  const aggregateReasons = (flags: FlagDetail[]): Map<string, number> => {
    const counts = new Map<string, number>();
    flags.forEach((flag) => {
      counts.set(flag.flag_type, (counts.get(flag.flag_type) || 0) + 1);
    });
    return counts;
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (recipes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-lg">No flagged recipes</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Recipe</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Owner</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Flags</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Reasons</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Latest</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe) => {
              const reasonCounts = aggregateReasons(recipe.flags);
              return (
                <tr key={recipe.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  setSelectedRecipe(recipe);
                }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {recipe.image_url && <img src={recipe.image_url} alt="" className="w-10 h-10 object-cover rounded" />}
                      <Link href={`/recipe/${recipe.id}`} target="_blank" className="text-cb-primary hover:underline font-medium" onClick={(e) => e.stopPropagation()}>{recipe.title}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{recipe.user_profiles?.username ? `@${recipe.user_profiles.username}` : 'Unknown'}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 text-red-700 rounded-full text-xs font-bold">{recipe.flag_count}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Array.from(reasonCounts.entries()).map(([reason, count]) => (
                        <span key={reason} className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs">{reason} ({count})</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{recipe.latest_flag_at ? new Date(recipe.latest_flag_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleAction(recipe.id, 'hide'); }} disabled={acting} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50">Hide</button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(recipe.id); }} disabled={acting} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">Delete</button>
                      <button onClick={(e) => { e.stopPropagation(); handleAction(recipe.id, 'dismiss'); }} disabled={acting} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">Dismiss</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end" onClick={() => setSelectedRecipe(null)}>
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                {selectedRecipe.image_url && <img src={selectedRecipe.image_url} alt="" className="w-24 h-24 object-cover rounded" />}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedRecipe.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">by @{selectedRecipe.user_profiles?.username || 'Unknown'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedRecipe(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Flags ({selectedRecipe.flags.length})</h3>
              {selectedRecipe.flags.map((flag) => (
                <div key={flag.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      {flag.flagged_by ? <p className="text-sm font-medium text-gray-900">@{flag.user_profiles?.username || 'Unknown'}</p> : <p className="text-sm font-medium text-blue-600">AI Proctor</p>}
                      <p className="text-xs text-gray-500">{new Date(flag.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs">{flag.flag_type}</span>
                  {flag.reason && <p className="text-sm text-gray-700 mt-2">{flag.reason}</p>}
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => handleAction(selectedRecipe.id, 'hide')} disabled={acting} className="flex-1 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 font-medium">Hide</button>
              <button onClick={() => setDeleteConfirm(selectedRecipe.id)} disabled={acting} className="flex-1 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 font-medium">Delete</button>
              <button onClick={() => handleAction(selectedRecipe.id, 'dismiss')} disabled={acting} className="flex-1 px-4 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 font-medium">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ChefsDialog
          open={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Recipe"
          body="This will permanently delete this recipe. This cannot be undone."
          buttons={[
            { label: 'Delete', variant: 'primary', onClick: () => handleAction(deleteConfirm, 'delete') },
            { label: 'Cancel', variant: 'cancel', onClick: () => setDeleteConfirm(null) },
          ]}
        />
      )}
    </>
  );
}

// ─── Flagged Comments Tab ───────────────────────────────────────────────────

interface FlaggedComment {
  id: string;
  comment_id: string;
  flagged_by: string;
  reason: string | null;
  created_at: string;
  comment_content: string | null;
  comment_user_id: string | null;
  commenter_username: string | null;
  recipe_id: string | null;
  flagged_by_username: string | null;
}

function FlaggedCommentsTab() {
  const [flags, setFlags] = useState<FlaggedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'flagged-comments' });
      setFlags(data.flags ?? []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (f: FlaggedComment) => {
    setActing(f.id);
    try { await adminPost({ action: 'approveComment', commentId: f.comment_id }); } catch {}
    setActing(null);
    load();
  };

  const handleRemove = async (f: FlaggedComment) => {
    setActing(f.id);
    try { await adminPost({ action: 'removeComment', commentId: f.comment_id }); } catch {}
    setActing(null);
    load();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (flags.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-lg">No flagged comments</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Comment</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Recipe</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Commenter</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Flag Reason</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Flagged By</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate">{f.comment_content ?? '(deleted)'}</td>
                <td className="px-4 py-3">{f.recipe_id ? <Link href={`/recipe/${f.recipe_id}`} className="text-cb-primary hover:underline text-xs">View</Link> : '—'}</td>
                <td className="px-4 py-3">{f.commenter_username ? <Link href={`/u/${f.commenter_username}`} className="text-cb-primary hover:underline text-xs">@{f.commenter_username}</Link> : <span className="text-xs text-gray-400">Unknown</span>}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{f.reason ?? '—'}</td>
                <td className="px-4 py-3">{f.flagged_by_username ? <span className="text-xs text-gray-600">@{f.flagged_by_username}</span> : <span className="text-xs text-gray-400">Unknown</span>}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(f)} disabled={acting === f.id} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">Approve</button>
                    <button onClick={() => handleRemove(f)} disabled={acting === f.id} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Flagged Messages Tab ───────────────────────────────────────────────────

interface FlaggedMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  moderation_status: string;
  is_hidden: boolean;
  created_at: string;
  sender_username?: string;
  recipient_username?: string;
  flag_count?: number;
  flag_reasons?: string[];
}

function FlaggedMessagesTab() {
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch({ page: 'messages' });
      setMessages((data.messages ?? []) as FlaggedMessage[]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load messages');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    try { await adminPost({ action: 'approveMessage', messageId: id }); } catch {}
    load();
  };

  const handleRemove = async (id: string) => {
    try { await adminPost({ action: 'removeMessage', messageId: id }); } catch {}
    load();
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (messages.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-lg">No flagged messages</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">{error}</div>}
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`bg-white rounded-lg border p-4 ${m.moderation_status === 'serious' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${m.moderation_status === 'serious' ? 'bg-red-200 text-red-800' : m.is_hidden ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                    {m.is_hidden ? 'HIDDEN' : m.moderation_status?.toUpperCase() ?? 'FLAGGED'}
                  </span>
                  {(m.flag_count ?? 0) > 0 && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-red-100 text-red-700">
                      {m.flag_count} user flag{m.flag_count === 1 ? '' : 's'}: {(m.flag_reasons ?? []).join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 mb-1">{m.content}</p>
                <p className="text-xs text-gray-500">
                  From <Link href={`/u/${m.sender_username}`} className="text-cb-primary hover:underline">@{m.sender_username}</Link> → <Link href={`/u/${m.recipient_username}`} className="text-cb-primary hover:underline">@{m.recipient_username}</Link>
                  {' · '}{new Date(m.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApprove(m.id)} className="text-xs px-3 py-1.5 rounded bg-green-100 text-green-800 hover:bg-green-200 font-medium">Approve</button>
                <button onClick={() => handleRemove(m.id)} className="text-xs px-3 py-1.5 rounded bg-red-100 text-red-800 hover:bg-red-200 font-medium">Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Admin Inbox Tab ────────────────────────────────────────────────────────

interface InboxConversation {
  id: string;
  other_user_id: string;
  other_username: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  tag?: string;
}

interface InboxMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_from_admin: boolean;
}

function AdminInboxTab() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'restriction' | 'direct'>('all');
  const [adminId, setAdminId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAdminId(user.id);
    });
  }, []);

  const loadConversations = async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/admin/inbox', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch (e) {
      console.error('Failed to load inbox:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (adminId) loadConversations();
  }, [adminId]);

  const loadMessages = async (convo: InboxConversation) => {
    setLoadingMessages(true);
    setSelectedConvo(convo);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/admin/inbox/${convo.other_user_id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        // Mark as read
        await fetch(`/api/admin/inbox/${convo.other_user_id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        loadConversations(); // Refresh unread counts
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }
    setLoadingMessages(false);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConvo) return;
    setSending(true);
    try {
      await adminPost({ action: 'sendMessage', recipientId: selectedConvo.other_user_id, content: replyText.trim() });
      setReplyText('');
      loadMessages(selectedConvo);
    } catch (e) {
      console.error('Failed to send:', e);
    }
    setSending(false);
  };

  const filteredConvos = conversations.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'restriction') return c.tag === 'account_restriction_inquiry';
    if (filter === 'direct') return !c.tag;
    return true;
  });

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="flex h-[600px] bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Left panel - conversation list */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <div className="flex gap-1">
            <button onClick={() => setFilter('all')} className={`text-xs px-2 py-1 rounded ${filter === 'all' ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
            <button onClick={() => setFilter('restriction')} className={`text-xs px-2 py-1 rounded ${filter === 'restriction' ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600'}`}>Restrictions</button>
            <button onClick={() => setFilter('direct')} className={`text-xs px-2 py-1 rounded ${filter === 'direct' ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-600'}`}>Direct</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvos.length === 0 ? (
            <p className="text-gray-500 text-sm p-4 text-center">No conversations</p>
          ) : (
            filteredConvos.map((c) => (
              <div
                key={c.id}
                onClick={() => loadMessages(c)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedConvo?.id === c.id ? 'bg-gray-100' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cb-primary flex items-center justify-center text-white text-xs font-bold">
                      {(c.other_username ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className={`text-sm ${c.unread_count > 0 ? 'font-bold text-gray-900' : 'text-gray-700'}`}>@{c.other_username ?? 'Unknown'}</p>
                      {c.tag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{c.tag}</span>}
                    </div>
                  </div>
                  {c.unread_count > 0 && (
                    <span className="bg-cb-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{c.unread_count}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{c.last_message}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(c.last_message_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel - message thread */}
      <div className="flex-1 flex flex-col">
        {!selectedConvo ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation
          </div>
        ) : loadingMessages ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Loading...
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-gray-200 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cb-primary flex items-center justify-center text-white text-xs font-bold">
                {(selectedConvo.other_username ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">@{selectedConvo.other_username}</p>
                {selectedConvo.tag && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{selectedConvo.tag}</span>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.is_from_admin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 ${m.is_from_admin ? 'bg-cb-primary text-white' : 'bg-gray-100 text-gray-900'}`}>
                    <p className="text-sm">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.is_from_admin ? 'text-white/70' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Type a reply..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  maxLength={1000}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="bg-cb-primary text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MessagesAndFlagsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'recipes');
  const [counts, setCounts] = useState({ recipes: 0, comments: 0, messages: 0, inbox: 0 });

  // Load counts for tab badges
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        // Fetch counts from API
        const res = await fetch('/api/admin/moderation-counts', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCounts(data);
        }
      } catch {}
    })();
  }, []);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'recipes', label: 'Flagged Recipes', count: counts.recipes },
    { key: 'comments', label: 'Flagged Comments', count: counts.comments },
    { key: 'messages', label: 'Flagged Messages', count: counts.messages },
    { key: 'inbox', label: 'Admin Inbox', count: counts.inbox },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Messages & Flags</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-cb-primary text-cb-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold ${
                activeTab === tab.key ? 'bg-cb-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'recipes' && <FlaggedRecipesTab />}
      {activeTab === 'comments' && <FlaggedCommentsTab />}
      {activeTab === 'messages' && <FlaggedMessagesTab />}
      {activeTab === 'inbox' && <AdminInboxTab />}
    </div>
  );
}
