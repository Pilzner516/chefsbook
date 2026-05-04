import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  return data ? user.id : null;
}

// POST: Mark all messages in conversation as read by admin
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const adminId = await verifyAdmin(request);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
