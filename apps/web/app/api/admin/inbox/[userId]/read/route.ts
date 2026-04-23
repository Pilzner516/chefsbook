import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// POST: Mark all messages in conversation as read by admin
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;

    // Get all admin user IDs
    const { data: adminUsers } = await supabaseAdmin
      .from('admin_users')
      .select('user_id');

    const adminIds = adminUsers?.map(a => a.user_id) || [];

    // Update all messages from this user to admins as read
    // Also messages with special tags from this user
    const { error } = await supabaseAdmin
      .from('direct_messages')
      .update({ read_by_admin: true })
      .or(
        `and(sender_id.eq.${userId},recipient_id.in.(${adminIds.join(',')})),` +
        `and(sender_id.eq.${userId},message_tag.not.is.null)`
      )
      .eq('read_by_admin', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
