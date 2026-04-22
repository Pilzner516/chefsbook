import { supabaseAdmin, blockTag, refreshBlockedTagsCache } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * GET /api/admin/tags/blocked
 * Get all blocked tags
 * Requires admin authentication
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin status
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get blocked tags with blocker info
    const { data: blocked, error } = await supabaseAdmin
      .from('blocked_tags')
      .select(`
        id,
        tag,
        reason,
        created_at,
        user_profiles!blocked_tags_blocked_by_fkey(username)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (blocked ?? []).map(b => ({
      id: b.id,
      tag: b.tag,
      reason: b.reason,
      blockedBy: (b.user_profiles as any)?.username,
      createdAt: b.created_at,
    }));

    return Response.json({ blocked: formatted });
  } catch (err: any) {
    console.error('Admin blocked tags error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/tags/blocked
 * Add a tag to the blocked list
 * Body: { tag: string, reason?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { tag, reason } = await req.json();

    if (!tag || typeof tag !== 'string' || tag.trim() === '') {
      return Response.json({ error: 'Invalid tag' }, { status: 400 });
    }

    // Verify admin status
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Add to blocked list
    await blockTag(tag.trim(), reason || null, user.id);

    return Response.json({ success: true });
  } catch (err: any) {
    console.error('Admin block tag error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
