import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

export async function GET() {
  try {
    // Get flagged recipes count (pending)
    const { count: flaggedRecipes } = await supabaseAdmin
      .from('recipe_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get flagged comments count (pending)
    const { count: flaggedComments } = await supabaseAdmin
      .from('comment_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get flagged messages count (pending)
    const { count: flaggedMessages } = await supabaseAdmin
      .from('message_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Get unread admin inbox count
    // Messages where:
    // 1. Has a message_tag (account_restriction_inquiry, admin_outreach)
    // 2. OR sender/recipient is an admin
    // 3. AND not read_by_admin
    const { data: adminUsers } = await supabaseAdmin
      .from('admin_users')
      .select('user_id');

    const adminIds = adminUsers?.map(a => a.user_id) || [];

    let unreadInbox = 0;
    if (adminIds.length > 0) {
      // Count messages with tags that are unread by admin
      const { count: taggedUnread } = await supabaseAdmin
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .not('message_tag', 'is', null)
        .eq('read_by_admin', false);

      // Count messages to admins that are unread
      const { count: toAdminUnread } = await supabaseAdmin
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .in('recipient_id', adminIds)
        .is('message_tag', null)
        .eq('read_by_admin', false);

      unreadInbox = (taggedUnread || 0) + (toAdminUnread || 0);
    }

    return NextResponse.json({
      flaggedRecipes: flaggedRecipes || 0,
      flaggedComments: flaggedComments || 0,
      flaggedMessages: flaggedMessages || 0,
      unreadInbox,
      total: (flaggedRecipes || 0) + (flaggedComments || 0) + (flaggedMessages || 0) + unreadInbox,
    });
  } catch (error) {
    console.error('Error fetching moderation counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch counts' },
      { status: 500 }
    );
  }
}
