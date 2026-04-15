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
    // Get messages flagged by moderation or hidden
    const { data, error } = await supabaseAdmin.from('direct_messages')
      .select('*')
      .or('is_hidden.eq.true,moderation_status.eq.mild,moderation_status.eq.serious')
      .order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Also get messages flagged by users via message_flags
    const { data: flagRows } = await supabaseAdmin.from('message_flags').select('message_id, reason');
    const flagMap = new Map<string, string[]>();
    (flagRows ?? []).forEach((f: any) => {
      const arr = flagMap.get(f.message_id) ?? [];
      arr.push(f.reason);
      flagMap.set(f.message_id, arr);
    });
    // Fetch user-flagged messages not already in the moderation list
    const existingIds = new Set((data ?? []).map((m: any) => m.id));
    const userFlaggedIds = [...flagMap.keys()].filter((id) => !existingIds.has(id));
    let extraMessages: any[] = [];
    if (userFlaggedIds.length > 0) {
      const { data: extra } = await supabaseAdmin.from('direct_messages').select('*').in('id', userFlaggedIds);
      extraMessages = extra ?? [];
    }
    const allMessages = [...(data ?? []), ...extraMessages];
    if (allMessages.length > 0) {
      const userIds = new Set<string>();
      allMessages.forEach((m: any) => { userIds.add(m.sender_id); userIds.add(m.recipient_id); });
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username').in('id', [...userIds]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));
      const enriched = allMessages.map((m: any) => ({
        ...m,
        sender_username: pMap.get(m.sender_id),
        recipient_username: pMap.get(m.recipient_id),
        flag_reasons: flagMap.get(m.id) ?? [],
        flag_count: (flagMap.get(m.id) ?? []).length,
      }));
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

  if (page === 'import-sites') {
    const { data, error } = await supabaseAdmin.from('import_site_tracker').select('*').order('total_attempts', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // KPIs: last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabaseAdmin
      .from('import_attempts')
      .select('success')
      .gte('attempted_at', thirtyDaysAgo);
    const { count: flaggedCount } = await supabaseAdmin
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('is_complete', false)
      .gte('created_at', thirtyDaysAgo);
    const totalAttempts = attempts?.length ?? 0;
    const successes = attempts?.filter((a: any) => a.success).length ?? 0;
    const lowRating = (data ?? []).filter((s: any) => s.rating && s.rating <= 2).length;
    const blocked = (data ?? []).filter((s: any) => s.is_blocked).length;
    const { data: schedule } = await supabaseAdmin
      .from('scheduled_jobs')
      .select('*')
      .eq('job_name', 'site_compatibility_test')
      .maybeSingle();
    return NextResponse.json({
      sites: data ?? [],
      kpi: {
        totalAttempts,
        successRate: totalAttempts ? Math.round((successes / totalAttempts) * 100) : 0,
        lowRating,
        blocked,
        flagged: flaggedCount ?? 0,
      },
      schedule: schedule ?? null,
    });
  }

  if (page === 'incomplete-recipes') {
    const { data, error } = await supabaseAdmin
      .from('recipes')
      .select('id, title, user_id, missing_fields, ai_recipe_verdict, ai_verdict_reason, source_url, source_type, created_at, is_complete')
      .or('is_complete.eq.false,ai_recipe_verdict.eq.flagged,ai_recipe_verdict.eq.not_a_recipe')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, display_name')
      .in('id', userIds);
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const enriched = (data ?? []).map((r: any) => ({ ...r, owner: profMap.get(r.user_id) ?? null }));
    return NextResponse.json({ recipes: enriched });
  }

  if (page === 'flagged-comments') {
    const { data, error } = await supabaseAdmin.from('comment_flags')
      .select('id, comment_id, flagged_by, reason, created_at')
      .order('created_at', { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Enrich with comment content, commenter, and recipe info
    if (data && data.length > 0) {
      const commentIds = [...new Set(data.map((f: any) => f.comment_id))];
      const flaggedByIds = [...new Set(data.map((f: any) => f.flagged_by))];
      const { data: comments } = await supabaseAdmin.from('recipe_comments').select('id, content, user_id, recipe_id').in('id', commentIds);
      const allUserIds = new Set([...flaggedByIds, ...(comments ?? []).map((c: any) => c.user_id)]);
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username').in('id', [...allUserIds]);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));
      const commentMap = new Map((comments ?? []).map((c: any) => [c.id, c]));
      const enriched = data.map((f: any) => {
        const comment = commentMap.get(f.comment_id);
        return {
          ...f,
          comment_content: comment?.content ?? null,
          comment_user_id: comment?.user_id ?? null,
          commenter_username: comment?.user_id ? profileMap.get(comment.user_id) : null,
          recipe_id: comment?.recipe_id ?? null,
          flagged_by_username: profileMap.get(f.flagged_by) ?? null,
        };
      });
      return NextResponse.json({ flags: enriched });
    }
    return NextResponse.json({ flags: [] });
  }

  if (page === 'flagged-usernames') {
    const { data, error } = await supabaseAdmin.from('user_flags')
      .select('id, user_id, flag_type, note, created_at, is_resolved')
      .eq('flag_type', 'username_impersonation')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((f: any) => f.user_id))];
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username').in('id', userIds);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));
      const enriched = data.map((f: any) => ({ ...f, username: pMap.get(f.user_id) ?? null }));
      return NextResponse.json({ flags: enriched });
    }
    return NextResponse.json({ flags: [] });
  }

  if (page === 'user-search') {
    const q = searchParams.get('q') || '';
    if (!q.trim()) return NextResponse.json({ users: [] });
    const { data } = await supabaseAdmin.from('user_profiles').select('id, username, display_name, avatar_url').ilike('username', `%${q}%`).limit(10);
    return NextResponse.json({ users: data ?? [] });
  }

  if (page === 'overview') {
    const [users, recipes, flagged] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('plan_tier', { count: 'exact' }),
      supabaseAdmin.from('recipes').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true }).eq('type', 'comment_flagged').eq('is_read', false),
    ]);
    const planCounts: Record<string, number> = {};
    for (const u of users.data ?? []) {
      const plan = (u as any).plan_tier ?? 'free';
      planCounts[plan] = (planCounts[plan] ?? 0) + 1;
    }
    const today = new Date().toISOString().split('T')[0];
    const { count: newToday } = await supabaseAdmin.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', today);
    return NextResponse.json({
      totalUsers: users.count ?? 0,
      planCounts,
      newToday: newToday ?? 0,
      totalRecipes: recipes.count ?? 0,
      flaggedCount: flagged.count ?? 0,
    });
  }

  if (page === 'limits') {
    const { data: limits, error } = await supabaseAdmin.from('plan_limits').select('*').order('monthly_price_cents');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ limits: limits ?? [] });
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
    // Set moderation clean, restore visibility
    await supabaseAdmin.from('recipes').update({ moderation_status: 'approved', visibility: 'public' }).eq('id', body.recipeId);
    // For serious cases: unfreeze user
    if (body.unfreezeUserId) {
      await supabaseAdmin.from('user_profiles').update({ recipes_frozen: false }).eq('id', body.unfreezeUserId);
    }
    // Notify recipe owner
    if (body.ownerId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: body.ownerId,
        type: 'moderation',
        message: 'Your recipe has been reviewed and approved by an admin.',
        recipe_id: body.recipeId,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'rejectRecipe') {
    await supabaseAdmin.from('recipes').update({ moderation_status: 'rejected', visibility: 'private' }).eq('id', body.recipeId);
    // Notify recipe owner
    if (body.ownerId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: body.ownerId,
        type: 'moderation',
        message: 'Your recipe has been reviewed and set to private by an admin.',
        recipe_id: body.recipeId,
      });
    }
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

  // Import site tracker
  if (action === 'updateImportSite') {
    const updates: any = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) updates.status = body.status;
    if (body.knownIssue !== undefined) updates.known_issue = body.knownIssue;
    if (body.rating !== undefined) updates.rating = body.rating;
    if (body.isBlocked !== undefined) updates.is_blocked = body.isBlocked;
    if (body.blockReason !== undefined) updates.block_reason = body.blockReason;
    if (body.autoTestEnabled !== undefined) updates.auto_test_enabled = body.autoTestEnabled;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.markReviewed) updates.last_checked_by = adminId;
    const { error } = await supabaseAdmin.from('import_site_tracker').update(updates).eq('id', body.siteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'toggleScheduledJob') {
    const { error } = await supabaseAdmin
      .from('scheduled_jobs')
      .update({ is_enabled: body.enabled })
      .eq('job_name', body.jobName);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'deleteRecipe') {
    const { error } = await supabaseAdmin.from('recipes').delete().eq('id', body.recipeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'forceApproveRecipe') {
    const { error } = await supabaseAdmin
      .from('recipes')
      .update({
        ai_recipe_verdict: 'approved',
        is_complete: true,
        ai_verdict_at: new Date().toISOString(),
        ai_verdict_reason: 'admin override',
      })
      .eq('id', body.recipeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'upsertImportSite') {
    const { error } = await supabaseAdmin.from('import_site_tracker').upsert({
      domain: body.domain,
      total_attempts: body.totalAttempts ?? 1,
      successful_attempts: body.successfulAttempts ?? 0,
      last_import_at: body.lastImportAt ?? new Date().toISOString(),
      status: body.status ?? 'unknown',
    }, { onConflict: 'domain' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Flagged comments
  if (action === 'approveComment') {
    // Remove flags, keep comment visible
    await supabaseAdmin.from('comment_flags').delete().eq('comment_id', body.commentId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeComment') {
    // Delete the comment (cascades flags)
    await supabaseAdmin.from('recipe_comments').delete().eq('id', body.commentId);
    return NextResponse.json({ ok: true });
  }

  // Send message (admin → user)
  if (action === 'sendMessage') {
    const { sendMessage } = await import('@chefsbook/db');
    try {
      await sendMessage(adminId, body.recipientId, body.content, 'clean', supabaseAdmin);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
