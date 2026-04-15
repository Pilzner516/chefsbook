import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

/**
 * POST /api/admin/refresh-incomplete
 *
 * Body: { userId?: string }  // filter to a single user if provided
 *
 * Queues the set of incomplete recipes (is_complete=false) with a source_url
 * and re-imports them serially via /api/recipes/refresh, 1 every 5 seconds.
 * Returns a summary after completion — for very large sets the caller should
 * poll the tracker instead.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: admin } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const targetUserId: string | null = body?.userId ?? null;

  let query = supabaseAdmin
    .from('recipes')
    .select('id, user_id')
    .eq('is_complete', false)
    .not('source_url', 'is', null)
    .limit(200);
  if (targetUserId) query = query.eq('user_id', targetUserId);
  const { data: rows } = await query;
  const ids = (rows ?? []).map((r) => r.id);

  const origin = new URL(req.url).origin;
  let refreshed = 0;
  let needsExtension = 0;
  let failed = 0;

  for (const recipeId of ids) {
    try {
      const res = await fetch(`${origin}/api/recipes/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipeId }),
      });
      const b = await res.json();
      if (res.ok && b.ok) refreshed += 1;
      else if (res.status === 206) needsExtension += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  return Response.json({
    total: ids.length,
    refreshed,
    needsExtension,
    failed,
  });
}
