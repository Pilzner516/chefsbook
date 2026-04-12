import { supabase } from '../client';

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  moderation_status: 'clean' | 'mild' | 'serious';
  is_hidden: boolean;
  created_at: string;
  // Joined fields
  sender_username?: string;
  sender_display_name?: string;
  sender_avatar_url?: string | null;
  recipient_username?: string;
  recipient_display_name?: string;
}

export interface ConversationPreview {
  other_user_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export async function sendMessage(senderId: string, recipientId: string, content: string, moderationStatus: string = 'clean'): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, content, moderation_status: moderationStatus })
    .select()
    .single();
  if (error) throw error;
  return data as DirectMessage;
}

export async function getConversation(userId: string, otherUserId: string, limit = 50, offset = 0): Promise<DirectMessage[]> {
  const { data } = await supabase
    .from('direct_messages')
    .select('*, sender:user_profiles!direct_messages_sender_id_fkey(username, display_name, avatar_url)')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  return (data ?? []).map((row: any) => ({
    ...row,
    sender_username: row.sender?.username,
    sender_display_name: row.sender?.display_name,
    sender_avatar_url: row.sender?.avatar_url,
  }));
}

export async function getConversationList(userId: string): Promise<ConversationPreview[]> {
  // Get all messages involving this user, grouped by the other participant
  const { data: messages } = await supabase
    .from('direct_messages')
    .select('id, sender_id, recipient_id, content, is_read, created_at')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!messages || messages.length === 0) return [];

  // Group by other user, keeping last message + unread count
  const convos = new Map<string, { lastMsg: string; lastAt: string; unread: number }>();
  for (const m of messages) {
    const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!convos.has(otherId)) {
      convos.set(otherId, { lastMsg: m.content, lastAt: m.created_at, unread: 0 });
    }
    if (m.recipient_id === userId && !m.is_read) {
      const c = convos.get(otherId)!;
      c.unread++;
    }
  }

  // Fetch profiles for all other users
  const otherIds = [...convos.keys()];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', otherIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return otherIds.map((id) => {
    const c = convos.get(id)!;
    const p = profileMap.get(id);
    return {
      other_user_id: id,
      other_username: p?.username ?? '?',
      other_display_name: p?.display_name ?? null,
      other_avatar_url: p?.avatar_url ?? null,
      last_message: c.lastMsg.slice(0, 80),
      last_message_at: c.lastAt,
      unread_count: c.unread,
    };
  }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}

export async function markMessagesRead(myUserId: string, otherUserId: string): Promise<void> {
  await supabase
    .from('direct_messages')
    .update({ is_read: true })
    .eq('recipient_id', myUserId)
    .eq('sender_id', otherUserId)
    .eq('is_read', false);

  // Recalculate unread count
  const { count } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', myUserId)
    .eq('is_read', false)
    .eq('is_hidden', false);

  await supabase
    .from('user_profiles')
    .update({ unread_messages_count: count ?? 0 })
    .eq('id', myUserId);
}

export async function flagMessage(messageId: string, flaggedBy: string, reason: string): Promise<void> {
  await supabase.from('message_flags').insert({ message_id: messageId, flagged_by: flaggedBy, reason });
}

export async function deleteMessage(messageId: string): Promise<void> {
  await supabase.from('direct_messages').delete().eq('id', messageId);
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false)
    .eq('is_hidden', false);
  return count ?? 0;
}
