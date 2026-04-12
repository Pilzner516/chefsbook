import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

/** Verify the request is from an admin user. Returns userId or null. */
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

export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page');

  if (page === 'users') {
    const planFilter = searchParams.get('plan') || 'all';
    const search = searchParams.get('search') || '';
    let q = supabaseAdmin.from('user_profiles').select('*').order('created_at', { ascending: false }).limit(200);
    if (planFilter !== 'all') q = q.eq('plan_tier', planFilter);
    if (search.trim()) q = q.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: admins } = await supabaseAdmin.from('admin_users').select('user_id, role');
    return NextResponse.json({ users: data ?? [], admins: admins ?? [] });
  }

  if (page === 'recipes') {
    const search = searchParams.get('search') || '';
    const { data: flagged } = await supabaseAdmin.from('recipes')
      .select('id, title, user_id, moderation_status, moderation_flag_reason, moderation_flagged_at, visibility, created_at')
      .in('moderation_status', ['flagged_mild', 'flagged_serious'])
      .order('moderation_flagged_at', { ascending: false });
    let q = supabaseAdmin.from('recipes').select('id, title, user_id, visibility, source_type, created_at')
      .eq('visibility', 'public').is('parent_recipe_id', null)
      .order('created_at', { ascending: false }).limit(200);
    if (search.trim()) q = q.ilike('title', `%${search}%`);
    const { data: recipes, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flagged: flagged ?? [], recipes: recipes ?? [] });
  }

  if (page === 'messages') {
    const { data, error } = await supabaseAdmin.from('direct_messages')
      .select('*')
      .or('is_hidden.eq.true,moderation_status.eq.mild,moderation_status.eq.serious')
      .order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data && data.length > 0) {
      const userIds = new Set<string>();
      data.forEach((m: any) => { userIds.add(m.sender_id); userIds.add(m.recipient_id); });
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username').in('id', [...userIds]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));
      const enriched = data.map((m: any) => ({ ...m, sender_username: pMap.get(m.sender_id), recipient_username: pMap.get(m.recipient_id) }));
      return NextResponse.json({ messages: enriched });
    }
    return NextResponse.json({ messages: [] });
  }

  if (page === 'promos') {
    const { data, error } = await supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promos: data ?? [] });
  }

  if (page === 'help') {
    const { data, error } = await supabaseAdmin.from('help_requests').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data ?? [] });
  }

  return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const action = body.action;

  if (action === 'toggleSuspend') {
    const { error } = await supabaseAdmin.from('user_profiles').update({ is_suspended: body.suspended }).eq('id', body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'changePlan') {
    const { error } = await supabaseAdmin.from('user_profiles').update({ plan_tier: body.plan }).eq('id', body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'addAdminRole') {
    const { error } = await supabaseAdmin.from('admin_users').upsert({ user_id: body.userId, role: body.role, added_by: adminId }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'updateUsername') {
    const existing = await supabaseAdmin.from('user_profiles').select('id').eq('username', body.username).neq('id', body.userId).limit(1);
    if (existing.data && existing.data.length > 0) return NextResponse.json({ error: 'Username taken' }, { status: 409 });
    const { error } = await supabaseAdmin.from('user_profiles').update({ username: body.username }).eq('id', body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approveMessage') {
    await supabaseAdmin.from('direct_messages').update({ is_hidden: false, moderation_status: 'clean' }).eq('id', body.messageId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeMessage') {
    await supabaseAdmin.from('direct_messages').update({ is_hidden: true }).eq('id', body.messageId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'approveRecipe') {
    await supabaseAdmin.from('recipes').update({ moderation_status: 'approved', visibility: 'public' }).eq('id', body.recipeId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'rejectRecipe') {
    await supabaseAdmin.from('recipes').update({ moderation_status: 'rejected' }).eq('id', body.recipeId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'hideRecipe') {
    await supabaseAdmin.from('recipes').update({ visibility: 'private' }).eq('id', body.recipeId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'createPromo') {
    const { error } = await supabaseAdmin.from('promo_codes').insert(body.promo);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'togglePromo') {
    const { error } = await supabaseAdmin.from('promo_codes').update({ is_active: body.active }).eq('id', body.promoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'deletePromo') {
    const { error } = await supabaseAdmin.from('promo_codes').delete().eq('id', body.promoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'resolveHelp') {
    await supabaseAdmin.from('help_requests').update({ status: 'resolved' }).eq('id', body.requestId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
