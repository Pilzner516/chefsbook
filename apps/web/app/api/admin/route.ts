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
    const tagFilter = searchParams.get('tags') || '';
    let q = supabaseAdmin.from('user_profiles').select('*').order('created_at', { ascending: false }).limit(200);
    if (planFilter !== 'all') q = q.eq('plan_tier', planFilter);
    if (search.trim()) q = q.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: admins } = await supabaseAdmin.from('admin_users').select('user_id, role');
    const { data: tags } = await supabaseAdmin.from('user_account_tags').select('user_id, tag');
    const { data: flags } = await supabaseAdmin.from('user_flags').select('user_id, flag_type, note, created_at, id, is_resolved').eq('is_resolved', false);
    // Fetch emails from auth.users
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const emailMap = new Map((authUsers ?? []).map((u: any) => [u.id, u.email]));
    const usersWithEmail = (data ?? []).map((u: any) => ({ ...u, email: emailMap.get(u.id) ?? null }));
    return NextResponse.json({ users: usersWithEmail, admins: admins ?? [], tags: tags ?? [], flags: flags ?? [] });
  }

  if (page === 'recipes') {
    const search = searchParams.get('search') || '';
    const { data: flagged } = await supabaseAdmin.from('recipes')
      .select('id, title, user_id, original_submitter_username, moderation_status, moderation_flag_reason, moderation_flagged_at, visibility, created_at')
      .in('moderation_status', ['flagged_mild', 'flagged_serious'])
      .order('moderation_flagged_at', { ascending: false });
    let q = supabaseAdmin.from('recipes').select('id, title, user_id, original_submitter_username, visibility, source_type, moderation_status, created_at')
      .is('parent_recipe_id', null)
      .order('created_at', { ascending: false }).limit(200);
    if (search.trim()) q = q.ilike('title', `%${search}%`);
    const { data: recipes, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ flagged: flagged ?? [], recipes: recipes ?? [] });
  }

  if (page === 'reserved-usernames') {
    const { data, error } = await supabaseAdmin.from('reserved_usernames').select('*').order('username');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reserved: data ?? [] });
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

  // Reserved usernames
  if (action === 'addReserved') {
    const { error } = await supabaseAdmin.from('reserved_usernames').insert({ username: body.username, reason: body.reason });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'approveReserved') {
    const { error } = await supabaseAdmin.from('reserved_usernames').update({
      is_approved: true, approved_for_user_id: body.userId || null, approved_note: body.note || null, updated_at: new Date().toISOString(),
    }).eq('id', body.reservedId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'revokeReserved') {
    const { error } = await supabaseAdmin.from('reserved_usernames').update({
      is_approved: false, approved_for_user_id: null, approved_note: null, updated_at: new Date().toISOString(),
    }).eq('id', body.reservedId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeReserved') {
    const { error } = await supabaseAdmin.from('reserved_usernames').delete().eq('id', body.reservedId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Account tags
  if (action === 'addTag') {
    const { error } = await supabaseAdmin.from('user_account_tags').insert({ user_id: body.userId, tag: body.tag, added_by: adminId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeTag') {
    const { error } = await supabaseAdmin.from('user_account_tags').delete().eq('user_id', body.userId).eq('tag', body.tag);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // User flags
  if (action === 'addFlag') {
    const { error } = await supabaseAdmin.from('user_flags').insert({ user_id: body.userId, flag_type: body.flagType, note: body.note, flagged_by: adminId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'resolveFlag') {
    const { error } = await supabaseAdmin.from('user_flags').update({ is_resolved: true, resolved_by: adminId, resolved_at: new Date().toISOString(), resolution_note: body.note }).eq('id', body.flagId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Send message (admin → user)
  if (action === 'sendMessage') {
    const { sendMessage } = await import('@chefsbook/db');
    try {
      await sendMessage(adminId, body.recipientId, body.content);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
