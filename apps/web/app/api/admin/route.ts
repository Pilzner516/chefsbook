import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, recalculateAllRatings } from '@chefsbook/db';

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
    // Fetch emails and last sign in from auth.users
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const authMap = new Map((authUsers ?? []).map((u: any) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at }]));
    // Fetch throttle data
    const { data: throttleData } = await supabaseAdmin.from('user_throttle').select('user_id, throttle_level, is_throttled');
    const throttleMap = new Map((throttleData ?? []).map((t: any) => [t.user_id, t]));
    // Fetch actual AI costs from ai_usage_log (SUM per user)
    const { data: costData } = await supabaseAdmin
      .from('ai_usage_log')
      .select('user_id, cost_usd');
    const costMap = new Map<string, number>();
    for (const c of costData ?? []) {
      if (c.user_id) {
        costMap.set(c.user_id, (costMap.get(c.user_id) ?? 0) + Number(c.cost_usd ?? 0));
      }
    }
    // Fetch recipe counts per user
    const userIds = (data ?? []).map((u: any) => u.id);
    let recipeCounts = new Map<string, number>();
    if (userIds.length > 0) {
      const { data: recipeData } = await supabaseAdmin.from('recipes').select('user_id').in('user_id', userIds);
      for (const r of recipeData ?? []) {
        recipeCounts.set(r.user_id, (recipeCounts.get(r.user_id) ?? 0) + 1);
      }
    }
    const usersWithEmail = (data ?? []).map((u: any) => {
      const t = throttleMap.get(u.id);
      const auth = authMap.get(u.id);
      return {
        ...u,
        email: auth?.email ?? null,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        monthly_cost_usd: costMap.get(u.id) ?? 0,
        throttle_level: t?.throttle_level ?? null,
        recipe_count: recipeCounts.get(u.id) ?? 0,
      };
    });
    return NextResponse.json({ users: usersWithEmail, admins: admins ?? [], tags: tags ?? [], flags: flags ?? [] });
  }

  if (page === 'recipes') {
    const search = searchParams.get('search') || '';
    const { data: flagged } = await supabaseAdmin.from('recipes')
      .select('id, title, user_id, original_submitter_username, moderation_status, moderation_flag_reason, moderation_flagged_at, visibility, created_at, system_locked, ai_recipe_verdict')
      .in('moderation_status', ['flagged_mild', 'flagged_serious'])
      .order('moderation_flagged_at', { ascending: false });
    let q = supabaseAdmin.from('recipes').select('id, title, user_id, original_submitter_username, visibility, source_type, moderation_status, created_at, duplicate_of, is_canonical, system_locked, ai_recipe_verdict')
      .is('parent_recipe_id', null)
      .order('created_at', { ascending: false }).limit(200);
    if (search.trim()) q = q.ilike('title', `%${search}%`);
    const { data: recipes, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Fetch duplicates list for the Duplicates tab
    const { data: duplicates } = await supabaseAdmin.from('recipes')
      .select('id, title, user_id, original_submitter_username, duplicate_of, created_at')
      .not('duplicate_of', 'is', null)
      .order('created_at', { ascending: false }).limit(100);
    // Enrich duplicates with canonical recipe info
    const canonicalIds = [...new Set((duplicates ?? []).map((d: any) => d.duplicate_of).filter(Boolean))];
    const canonicalMap: Record<string, { title: string; username: string | null }> = {};
    if (canonicalIds.length > 0) {
      const { data: canonicals } = await supabaseAdmin.from('recipes')
        .select('id, title, original_submitter_username')
        .in('id', canonicalIds);
      for (const c of canonicals ?? []) {
        canonicalMap[c.id] = { title: c.title, username: c.original_submitter_username };
      }
    }
    const enrichedDuplicates = (duplicates ?? []).map((d: any) => ({
      ...d,
      canonical_title: canonicalMap[d.duplicate_of]?.title ?? 'Unknown',
      canonical_username: canonicalMap[d.duplicate_of]?.username ?? null,
    }));
    return NextResponse.json({ flagged: flagged ?? [], recipes: recipes ?? [], duplicates: enrichedDuplicates });
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

  if (page === 'feedback') {
    const { data, error } = await supabaseAdmin.from('user_feedback').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Enrich with user info
    const userIds = [...new Set((data ?? []).map((f: any) => f.user_id).filter(Boolean))];
    const feedbackIds = (data ?? []).map((f: any) => f.id);
    const profileMap = new Map<string, { username: string | null; display_name: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username, display_name').in('id', userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id, { username: p.username, display_name: p.display_name });
      }
    }
    // Get note counts per feedback
    const noteCountMap = new Map<string, number>();
    if (feedbackIds.length > 0) {
      const { data: notes } = await supabaseAdmin.from('feedback_notes').select('feedback_id').in('feedback_id', feedbackIds);
      for (const n of notes ?? []) {
        noteCountMap.set(n.feedback_id, (noteCountMap.get(n.feedback_id) ?? 0) + 1);
      }
    }
    // Get message counts per feedback
    const messageCountMap = new Map<string, number>();
    if (feedbackIds.length > 0) {
      const { data: messages } = await supabaseAdmin.from('feedback_messages').select('feedback_id').in('feedback_id', feedbackIds);
      for (const m of messages ?? []) {
        messageCountMap.set(m.feedback_id, (messageCountMap.get(m.feedback_id) ?? 0) + 1);
      }
    }
    const enriched = (data ?? []).map((f: any) => ({
      ...f,
      username: profileMap.get(f.user_id)?.username ?? null,
      display_name: profileMap.get(f.user_id)?.display_name ?? null,
      note_count: noteCountMap.get(f.id) ?? 0,
      message_count: messageCountMap.get(f.id) ?? 0,
    }));
    return NextResponse.json({ feedback: enriched });
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
    const pendingDiscoveries = (data ?? []).filter(
      (s: any) => s.is_user_discovered && s.review_status === 'pending',
    ).length;
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
        pendingDiscoveries,
      },
      schedule: schedule ?? null,
    });
  }

  if (page === 'library-accounts') {
    // Fetch all library accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, bio, recipe_count, follower_count, created_at')
      .eq('account_type', 'library')
      .order('created_at', { ascending: false });

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    // Fetch tokens for all library accounts
    const accountIds = (accounts ?? []).map((a: any) => a.id);
    const tokensMap: Record<string, any[]> = {};

    if (accountIds.length > 0) {
      const { data: tokens } = await supabaseAdmin
        .from('library_account_tokens')
        .select('id, user_id, description, created_at, last_used_at, is_active, created_by')
        .in('user_id', accountIds)
        .order('created_at', { ascending: false });

      // Group tokens by user_id
      for (const token of tokens ?? []) {
        if (!tokensMap[token.user_id]) {
          tokensMap[token.user_id] = [];
        }
        tokensMap[token.user_id].push(token);
      }
    }

    return NextResponse.json({
      accounts: accounts ?? [],
      tokens: tokensMap,
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

  if (page === 'copyright') {
    const { data, error } = await supabaseAdmin
      .from('recipe_flags')
      .select('*')
      .eq('flag_type', 'copyright')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Enrich with recipe info, submitter info, and flagger info
    const recipeIds = [...new Set((data ?? []).map((f: any) => f.recipe_id))];
    const userIds = [...new Set([
      ...(data ?? []).map((f: any) => f.flagged_by),
      ...(data ?? []).filter((f: any) => f.reviewed_by).map((f: any) => f.reviewed_by),
    ])];
    const { data: recipes } = await supabaseAdmin
      .from('recipes')
      .select('id, title, user_id, source_url, visibility, copyright_review_pending, copyright_previous_visibility')
      .in('id', recipeIds.length > 0 ? recipeIds : ['00000000-0000-0000-0000-000000000000']);
    const recipeMap = new Map((recipes ?? []).map((r: any) => [r.id, r]));

    // Get all user IDs (recipe owners + flaggers)
    const ownerIds = (recipes ?? []).map((r: any) => r.user_id);
    const allUserIds = [...new Set([...userIds, ...ownerIds])];
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, display_name, recipes_flagged_count')
      .in('id', allUserIds.length > 0 ? allUserIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const enriched = (data ?? []).map((f: any) => {
      const recipe = recipeMap.get(f.recipe_id);
      const flagger = profileMap.get(f.flagged_by);
      const owner = recipe ? profileMap.get(recipe.user_id) : null;
      return {
        ...f,
        recipe_title: recipe?.title ?? null,
        recipe_source_url: recipe?.source_url ?? null,
        recipe_owner_id: recipe?.user_id ?? null,
        recipe_owner_username: owner?.username ?? null,
        recipe_visibility: recipe?.visibility ?? null,
        copyright_review_pending: recipe?.copyright_review_pending ?? false,
        copyright_previous_visibility: recipe?.copyright_previous_visibility ?? null,
        flagger_username: flagger?.username ?? null,
        flagger_flag_count: flagger?.recipes_flagged_count ?? 0,
      };
    });

    return NextResponse.json({ flags: enriched });
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

    // Activity feed — last 20 events from ai_usage_log
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recentAi } = await supabaseAdmin.from('ai_usage_log')
      .select('action, model, cost_usd, user_id, created_at')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // Map user_ids to usernames for feed display
    const feedUserIds = [...new Set((recentAi ?? []).map((r: any) => r.user_id).filter(Boolean))];
    let feedUsernames = new Map<string, string>();
    if (feedUserIds.length > 0) {
      const { data: feedProfiles } = await supabaseAdmin.from('user_profiles').select('id, username').in('id', feedUserIds);
      feedUsernames = new Map((feedProfiles ?? []).map((p: any) => [p.id, p.username ?? p.id.slice(0, 8)]));
    }
    const activityFeed = (recentAi ?? []).map((r: any) => ({
      action: r.action,
      model: r.model,
      cost: parseFloat(r.cost_usd),
      user: feedUsernames.get(r.user_id) ?? null,
      time: r.created_at,
    }));

    return NextResponse.json({
      totalUsers: users.count ?? 0,
      planCounts,
      newToday: newToday ?? 0,
      totalRecipes: recipes.count ?? 0,
      flaggedCount: flagged.count ?? 0,
      activityFeed,
    });
  }

  if (page === 'limits') {
    const { data: limits, error } = await supabaseAdmin.from('plan_limits').select('*').order('monthly_price_cents');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ limits: limits ?? [] });
  }

  if (page === 'costs') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Model → Service mapping
    const modelToService = (model: string): string => {
      if (model.includes('haiku') || model.includes('sonnet') || model.includes('opus') || model.includes('claude')) return 'Anthropic';
      if (model.includes('gpt') || model.includes('openai')) return 'OpenAI';
      if (model.includes('flux') || model.includes('esrgan') || model.includes('replicate')) return 'Replicate';
      return 'Other';
    };

    // Action → Feature mapping
    const actionToFeature = (action: string): string => {
      const map: Record<string, string> = {
        'recipe-import': 'Recipe Import',
        'url-import': 'Recipe Import',
        'youtube-import': 'YouTube Import',
        'scan-recipe': 'Photo Scan',
        'scan-dish': 'Photo Scan',
        'dish-identify': 'Photo Scan',
        'generate-image': 'AI Image Generation',
        'regenerate-image': 'AI Image Generation',
        'mobile-generate-image': 'AI Image Generation',
        'upscale': 'Print Upscaling',
        'translate': 'Translation',
        'translate-recipe': 'Translation',
        'translate-title': 'Translation',
        'moderate': 'Moderation',
        'moderate-recipe': 'Moderation',
        'moderate-comment': 'Moderation',
        'moderate-tag': 'Moderation',
        'suggest-tags': 'Auto-Tagging',
        'auto-tag': 'Auto-Tagging',
        'meal-plan': 'Meal Plan Wizard',
        'generate-meal-plan': 'Meal Plan Wizard',
        'speak-recipe': 'Speak a Recipe',
        'purchase-unit': 'Shopping Suggestions',
        'suggest-purchase-units': 'Shopping Suggestions',
        'sous-chef': 'Sous Chef Suggest',
        'nutrition': 'Nutrition Generation',
        'generate-nutrition': 'Nutrition Generation',
        'is-recipe': 'Recipe Verification',
        'rewrite-steps': 'Step Formatting',
      };
      for (const [key, feature] of Object.entries(map)) {
        if (action.toLowerCase().includes(key)) return feature;
      }
      return action;
    };

    // Today's cost
    const { data: todayRows } = await supabaseAdmin.from('ai_usage_log').select('cost_usd').gte('created_at', todayStart);
    const todayCost = (todayRows ?? []).reduce((s, r) => s + parseFloat(String(r.cost_usd)), 0);

    // Current month data
    const { data: monthRows } = await supabaseAdmin.from('ai_usage_log').select('cost_usd, action, model, user_id, created_at').gte('created_at', monthStart);
    const monthCost = (monthRows ?? []).reduce((s, r) => s + parseFloat(String(r.cost_usd)), 0);

    // Last 30 days data
    const { data: last30Rows } = await supabaseAdmin.from('ai_usage_log').select('cost_usd, action, model, created_at').gte('created_at', thirtyDaysAgo);
    const last30Cost = (last30Rows ?? []).reduce((s, r) => s + parseFloat(String(r.cost_usd)), 0);

    // All time data
    const { data: allTimeRows } = await supabaseAdmin.from('ai_usage_log').select('cost_usd, action, model');
    const allTimeCost = (allTimeRows ?? []).reduce((s, r) => s + parseFloat(String(r.cost_usd)), 0);

    // Aggregate by action, model, user, day, service, feature for current month
    const byAction: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byService: Record<string, { cost: number; count: number }> = {};
    const byFeature: Record<string, { cost: number; count: number }> = {};
    const byServiceModel: Record<string, { service: string; model: string; action: string; cost: number; count: number }> = {};

    for (const r of monthRows ?? []) {
      const cost = parseFloat(String(r.cost_usd));
      byAction[r.action] = (byAction[r.action] ?? 0) + cost;
      byModel[r.model] = (byModel[r.model] ?? 0) + cost;
      if (r.user_id) byUser[r.user_id] = (byUser[r.user_id] ?? 0) + cost;
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + cost;

      const service = modelToService(r.model);
      const feature = actionToFeature(r.action);

      if (!byService[service]) byService[service] = { cost: 0, count: 0 };
      byService[service].cost += cost;
      byService[service].count += 1;

      if (!byFeature[feature]) byFeature[feature] = { cost: 0, count: 0 };
      byFeature[feature].cost += cost;
      byFeature[feature].count += 1;

      const smKey = `${service}|${r.model}|${feature}`;
      if (!byServiceModel[smKey]) byServiceModel[smKey] = { service, model: r.model, action: feature, cost: 0, count: 0 };
      byServiceModel[smKey].cost += cost;
      byServiceModel[smKey].count += 1;
    }

    // All-time by service
    const allTimeByService: Record<string, { cost: number; count: number }> = {};
    for (const r of allTimeRows ?? []) {
      const cost = parseFloat(String(r.cost_usd));
      const service = modelToService(r.model);
      if (!allTimeByService[service]) allTimeByService[service] = { cost: 0, count: 0 };
      allTimeByService[service].cost += cost;
      allTimeByService[service].count += 1;
    }

    // Last 30 days daily spend
    const dailySpend: Record<string, number> = {};
    for (const r of last30Rows ?? []) {
      const cost = parseFloat(String(r.cost_usd));
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      dailySpend[day] = (dailySpend[day] ?? 0) + cost;
    }

    // Find most expensive feature this month
    const featuresArray = Object.entries(byFeature).map(([f, d]) => ({ feature: f, ...d })).sort((a, b) => b.cost - a.cost);
    const mostExpensiveFeature = featuresArray[0] ?? null;

    // Top users
    const topUserIds = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    let topUsers: any[] = [];
    if (topUserIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, username, plan_tier').in('id', topUserIds);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      topUsers = topUserIds.map((id) => ({ ...pMap.get(id), cost: byUser[id] }));
    }

    // Throttled users
    const { data: throttled } = await supabaseAdmin.from('user_throttle').select('*').eq('is_throttled', true);

    // User count for avg
    const { count: userCount } = await supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true });

    return NextResponse.json({
      todayCost,
      monthCost,
      last30Cost,
      allTimeCost,
      avgPerUser: userCount ? monthCost / userCount : 0,
      mostExpensiveFeature,
      byAction: Object.entries(byAction).sort((a, b) => b[1] - a[1]),
      byModel: Object.entries(byModel).sort((a, b) => b[1] - a[1]),
      byDay: Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])),
      byService: Object.entries(byService).map(([s, d]) => ({ service: s, ...d, allTimeCost: allTimeByService[s]?.cost ?? 0 })).sort((a, b) => b.cost - a.cost),
      byFeature: featuresArray,
      byServiceModel: Object.values(byServiceModel).sort((a, b) => b.cost - a.cost),
      dailySpend: Object.entries(dailySpend).sort((a, b) => a[0].localeCompare(b[0])).map(([date, cost]) => ({ date, cost })),
      topUsers,
      throttled: throttled ?? [],
      totalCalls: (monthRows ?? []).length,
      totalCallsLast30: (last30Rows ?? []).length,
      totalCallsAllTime: (allTimeRows ?? []).length,
    });
  }

  if (page === 'settings') {
    const { data, error } = await supabaseAdmin.from('system_settings').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const settingsMap: Record<string, any> = {};
    for (const row of data ?? []) {
      settingsMap[row.key] = row;
    }
    return NextResponse.json({ settings: settingsMap });
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

  if (action === 'setImageQuality') {
    const override = body.override === 'dev' || body.override === 'schnell' ? body.override : null;
    const { error } = await supabaseAdmin.from('user_profiles').update({ image_quality_override: override }).eq('id', body.userId);
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

  if (action === 'overrideDuplicate') {
    // Swap canonical status: make the duplicate the new canonical, old canonical becomes duplicate
    const { recipeId, canonicalId } = body;
    await supabaseAdmin.from('recipes').update({ is_canonical: true, duplicate_of: null, duplicate_checked_at: new Date().toISOString() }).eq('id', recipeId);
    await supabaseAdmin.from('recipes').update({ is_canonical: false, duplicate_of: recipeId, duplicate_checked_at: new Date().toISOString() }).eq('id', canonicalId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'dismissDuplicate') {
    // Clear the duplicate flag — recipe is no longer considered a duplicate
    await supabaseAdmin.from('recipes').update({ duplicate_of: null, duplicate_checked_at: new Date().toISOString() }).eq('id', body.recipeId);
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
    if (body.reviewStatus !== undefined) updates.review_status = body.reviewStatus;
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

  if (action === 'recalculateRatings') {
    const updated = await recalculateAllRatings();
    return NextResponse.json({ ok: true, updated });
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

  // Copyright flag actions
  if (action === 'approveCopyright') {
    // Recipe is legitimate — unlock + restore visibility
    const { data: flag } = await supabaseAdmin.from('recipe_flags').select('recipe_id').eq('id', body.flagId).single();
    if (!flag) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('user_id, title, copyright_previous_visibility')
      .eq('id', flag.recipe_id)
      .single();

    // Update flag status
    await supabaseAdmin.from('recipe_flags').update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      admin_note: body.note || null,
    }).eq('id', body.flagId);

    // Restore visibility
    const prevVis = recipe?.copyright_previous_visibility ?? 'public';
    await supabaseAdmin.from('recipes').update({
      copyright_review_pending: false,
      copyright_locked_at: null,
      visibility: prevVis,
      copyright_previous_visibility: null,
    }).eq('id', flag.recipe_id);

    // DM to owner
    if (recipe?.user_id) {
      const { sendMessage } = await import('@chefsbook/db');
      await sendMessage(adminId, recipe.user_id, `Your recipe "${recipe.title}" has been reviewed and approved. It's now visible again.`, 'clean', supabaseAdmin).catch(() => {});
    }

    // DM to flagger
    if (body.flaggerId) {
      const { sendMessage } = await import('@chefsbook/db');
      await sendMessage(adminId, body.flaggerId, `We reviewed "${recipe?.title}" and determined it doesn't violate copyright. Thank you for your report.`, 'clean', supabaseAdmin).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'removeCopyright') {
    // Recipe infringes copyright — keep private permanently
    const { data: flag } = await supabaseAdmin.from('recipe_flags').select('recipe_id').eq('id', body.flagId).single();
    if (!flag) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('user_id, title')
      .eq('id', flag.recipe_id)
      .single();

    await supabaseAdmin.from('recipe_flags').update({
      status: 'removed',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      admin_note: body.note || null,
    }).eq('id', body.flagId);

    await supabaseAdmin.from('recipes').update({
      copyright_review_pending: false,
      copyright_removed: true,
      visibility: 'private',
    }).eq('id', flag.recipe_id);

    // DM to owner
    if (recipe?.user_id) {
      const { sendMessage } = await import('@chefsbook/db');
      await sendMessage(adminId, recipe.user_id,
        `Your recipe "${recipe.title}" has been removed from public view due to copyright concerns. You may keep it as a private reference or delete it. If you believe this is an error, please contact us. You have 30 days to appeal.`,
        'clean', supabaseAdmin,
      ).catch(() => {});
    }

    // DM to flagger
    if (body.flaggerId) {
      const { sendMessage } = await import('@chefsbook/db');
      await sendMessage(adminId, body.flaggerId, `We reviewed "${recipe?.title}" and removed it due to copyright concerns. Thank you for keeping ChefsBook legal!`, 'clean', supabaseAdmin).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'dismissCopyright') {
    // Flag is unfounded
    const { data: flag } = await supabaseAdmin.from('recipe_flags').select('recipe_id').eq('id', body.flagId).single();
    if (!flag) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });

    const { data: recipe } = await supabaseAdmin
      .from('recipes')
      .select('user_id, title, copyright_previous_visibility')
      .eq('id', flag.recipe_id)
      .single();

    await supabaseAdmin.from('recipe_flags').update({
      status: 'dismissed',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      admin_note: body.note || null,
    }).eq('id', body.flagId);

    // Restore visibility
    const prevVis = recipe?.copyright_previous_visibility ?? 'public';
    await supabaseAdmin.from('recipes').update({
      copyright_review_pending: false,
      copyright_locked_at: null,
      visibility: prevVis,
      copyright_previous_visibility: null,
    }).eq('id', flag.recipe_id);

    // DM to flagger
    if (body.flaggerId) {
      const { sendMessage } = await import('@chefsbook/db');
      await sendMessage(adminId, body.flaggerId, `We reviewed your report and determined "${recipe?.title}" doesn't raise copyright concerns. Thank you for helping keep ChefsBook fair.`, 'clean', supabaseAdmin).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'updateSetting') {
    const { key, value } = body;
    if (!key || value === undefined) return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({ key, value: String(value), updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'removeThrottle') {
    await supabaseAdmin.from('user_throttle').update({
      is_throttled: false, throttle_level: null, throttled_at: null, throttled_reason: null,
    }).eq('user_id', body.userId);
    return NextResponse.json({ ok: true });
  }

  if (action === 'whitelistUser') {
    await supabaseAdmin.from('user_throttle').upsert({
      user_id: body.userId,
      admin_override: true,
      override_by: adminId,
      override_note: body.note ?? 'Admin whitelist',
      is_throttled: false,
      throttle_level: null,
    }, { onConflict: 'user_id' });
    return NextResponse.json({ ok: true });
  }

  // Suspend user: force free plan, store pre-suspension plan
  if (action === 'suspendUser') {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('plan_tier')
      .eq('id', body.userId)
      .single();

    await supabaseAdmin.from('user_profiles').update({
      account_status: 'suspended',
      pre_suspension_plan: profile?.plan_tier ?? 'free',
      plan_tier: 'free',
      status_changed_at: new Date().toISOString(),
      status_changed_by: adminId,
      status_reason: body.reason ?? null,
    }).eq('id', body.userId);

    // Send notification message
    const { sendMessage } = await import('@chefsbook/db');
    await sendMessage(
      adminId,
      body.userId,
      'Your ChefsBook account has been restricted to the Free plan. If you have questions, please reply to this message.',
      'clean',
      supabaseAdmin
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  // Unsuspend user: restore original plan
  if (action === 'unsuspendUser') {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('pre_suspension_plan')
      .eq('id', body.userId)
      .single();

    await supabaseAdmin.from('user_profiles').update({
      account_status: 'active',
      plan_tier: profile?.pre_suspension_plan ?? 'free',
      pre_suspension_plan: null,
      status_changed_at: null,
      status_changed_by: null,
      status_reason: null,
    }).eq('id', body.userId);

    // Notify user
    const { sendMessage } = await import('@chefsbook/db');
    await sendMessage(
      adminId,
      body.userId,
      'Your ChefsBook account restrictions have been lifted. Thank you for your patience.',
      'clean',
      supabaseAdmin
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  // Expel user: content becomes hidden from all other users
  if (action === 'expelUser') {
    await supabaseAdmin.from('user_profiles').update({
      account_status: 'expelled',
      status_changed_at: new Date().toISOString(),
      status_changed_by: adminId,
      status_reason: body.reason ?? null,
    }).eq('id', body.userId);

    // Send notification message
    const { sendMessage } = await import('@chefsbook/db');
    await sendMessage(
      adminId,
      body.userId,
      'Your ChefsBook account has been restricted and your content is temporarily hidden from the community. If you have questions, please reply to this message.',
      'clean',
      supabaseAdmin
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  // Reinstate expelled user: content becomes visible again
  if (action === 'reinstateUser') {
    await supabaseAdmin.from('user_profiles').update({
      account_status: 'active',
      status_changed_at: null,
      status_changed_by: null,
      status_reason: null,
    }).eq('id', body.userId);

    // Notify user
    const { sendMessage } = await import('@chefsbook/db');
    await sendMessage(
      adminId,
      body.userId,
      'Your ChefsBook account has been reinstated. Your content is now visible to the community again.',
      'clean',
      supabaseAdmin
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
