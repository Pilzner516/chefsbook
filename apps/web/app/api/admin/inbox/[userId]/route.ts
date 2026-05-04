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

// GET: Fetch all messages with a specific user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const adminId = await verifyAdmin(request);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await params;

    // Get all admin user IDs
    const { data: adminUsers } = await supabaseAdmin
      .from('admin_users')
      .select('user_id');

    const adminIds = adminUsers?.map(a => a.user_id) || [];

    // Fetch all messages between this user and any admin
    // OR messages with special tags from this user
    const { data: messages, error } = await supabaseAdmin
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
      .or(
        `and(sender_id.eq.${userId},recipient_id.in.(${adminIds.join(',')})),` +
        `and(recipient_id.eq.${userId},sender_id.in.(${adminIds.join(',')})),` +
        `and(sender_id.eq.${userId},message_tag.not.is.null)`
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, avatar_url, account_status')
      .eq('id', userId)
      .single();

    return NextResponse.json({
      messages: messages || [],
      user: userProfile,
      adminIds,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

// POST: Send a message to the user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUserId = await verifyAdmin(request);
    if (!adminUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Insert the message
    const { data: message, error } = await supabaseAdmin
      .from('direct_messages')
      .insert({
        sender_id: adminUserId,
        recipient_id: userId,
        content,
        message_tag: 'admin_outreach',
        read_by_admin: true, // Admin sent it, so they've "read" it
      })
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
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
