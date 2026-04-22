import { supabaseAdmin } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * GET /api/admin/audit/runs
 * Get list of past audit runs
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

    // Get runs with user info
    const { data: runs, error } = await supabaseAdmin
      .from('content_audit_runs')
      .select('id, run_by, scan_scope, scan_mode, status, total_items_scanned, total_flagged, estimated_cost_usd, actual_cost_usd, rules_version, started_at, completed_at, error_message')
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Get user IDs
    const userIds = [...new Set((runs ?? []).map(r => r.run_by))];

    // Fetch user profiles
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.username]));

    const formatted = (runs ?? []).map(r => ({
      ...r,
      run_by_username: profileMap.get(r.run_by) || 'Unknown',
    }));

    return Response.json({ runs: formatted });
  } catch (err: any) {
    console.error('Admin audit runs error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
