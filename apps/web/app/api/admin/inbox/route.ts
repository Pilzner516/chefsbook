import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    // Get all admin user IDs
    const { data: adminUsers } = await supabaseAdmin
      .from('admin_users')
      .select('user_id');

    const adminIds = adminUsers?.map(a => a.user_id) || [];

    // Build query based on filter
    let query = supabaseAdmin
      .from('direct_messages')
      .select(`
        id,
        sender_id,
        recipient_id,
        content,
        message_tag,
        read_by_admin,
        created_at,
        sender:user_profiles!direct_messages_sender_id_fkey(id, username, avatar_url),
        recipient:user_profiles!direct_messages_recipient_id_fkey(id, username, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (filter === 'account_restriction_inquiry') {
      query = query.eq('message_tag', 'account_restriction_inquiry');
    } else if (filter === 'direct') {
      // Messages where admin is sender or recipient, no special tag
      query = query
        .is('message_tag', null)
        .or(`sender_id.in.(${adminIds.join(',')}),recipient_id.in.(${adminIds.join(',')})`);
    } else {
      // All: tagged messages OR admin is sender/recipient
      if (adminIds.length > 0) {
        query = query.or(
          `message_tag.not.is.null,sender_id.in.(${adminIds.join(',')}),recipient_id.in.(${adminIds.join(',')})`
        );
      } else {
        query = query.not('message_tag', 'is', null);
      }
    }

    const { data: messages, error } = await query.limit(200);

    if (error) {
      console.error('Error fetching inbox messages:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group messages by conversation (unique user pair)
    const conversations = new Map<string, {
      partnerId: string;
      partnerUsername: string;
      partnerAvatar: string | null;
      lastMessage: string;
      lastMessageDate: string;
      messageTag: string | null;
      unreadCount: number;
      messageCount: number;
    }>();

    for (const msg of messages || []) {
      // Determine the "partner" (non-admin user in the conversation)
      const isAdminSender = adminIds.includes(msg.sender_id);
      const partnerId = isAdminSender ? msg.recipient_id : msg.sender_id;
      // Supabase may return array or object depending on join type
      const rawPartner = isAdminSender ? msg.recipient : msg.sender;
      const partner = Array.isArray(rawPartner) ? rawPartner[0] : rawPartner;

      const existing = conversations.get(partnerId);
      if (!existing) {
        conversations.set(partnerId, {
          partnerId,
          partnerUsername: (partner as { username?: string })?.username || 'Unknown',
          partnerAvatar: (partner as { avatar_url?: string | null })?.avatar_url || null,
          lastMessage: msg.content.substring(0, 100),
          lastMessageDate: msg.created_at,
          messageTag: msg.message_tag,
          unreadCount: msg.read_by_admin ? 0 : 1,
          messageCount: 1,
        });
      } else {
        existing.messageCount++;
        if (!msg.read_by_admin) {
          existing.unreadCount++;
        }
        // Keep the most recent tag if different
        if (msg.message_tag && !existing.messageTag) {
          existing.messageTag = msg.message_tag;
        }
      }
    }

    // Convert to array and sort by last message date
    const conversationList = Array.from(conversations.values())
      .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());

    return NextResponse.json({
      conversations: conversationList,
      adminIds,
    });
  } catch (error) {
    console.error('Error in admin inbox:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}
