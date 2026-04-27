import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  if (!data) return null;
  return user.id;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('feedback_messages')
    .select('*')
    .eq('feedback_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with sender usernames
  const senderIds = [...new Set((data ?? []).map((m: any) => m.sender_id))];
  const profileMap = new Map<string, string>();
  if (senderIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username')
      .in('id', senderIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p.username);
    }
  }

  const messages = (data ?? []).map((m: any) => ({
    ...m,
    sender_username: profileMap.get(m.sender_id) ?? 'unknown',
  }));

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { message } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('feedback_messages')
    .insert({
      feedback_id: id,
      sender_id: adminId,
      message: message.trim(),
      is_admin_message: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get admin username
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('username')
    .eq('id', adminId)
    .single();

  return NextResponse.json({
    message: { ...data, sender_username: profile?.username ?? 'admin' },
  });
}
