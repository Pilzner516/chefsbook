import { supabaseAdmin } from '@chefsbook/db';
import { NextRequest } from 'next/server';

/**
 * GET /api/admin/audit/runs/[runId]/findings
 * Get findings for a specific audit run
 * Supports filters: ?content_type=tag&action=none&severity=standard
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const { searchParams } = new URL(req.url);

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

    // Build query with filters
    let query = supabaseAdmin
      .from('content_audit_findings')
      .select('*')
      .eq('audit_run_id', runId);

    const contentType = searchParams.get('content_type');
    const action = searchParams.get('action');
    const severity = searchParams.get('severity');

    if (contentType && contentType !== 'all') {
      query = query.eq('content_type', contentType);
    }

    if (action === 'pending') {
      query = query.eq('action_taken', 'none');
    } else if (action === 'actioned') {
      query = query.neq('action_taken', 'none');
    } else if (action && action !== 'all') {
      query = query.eq('action_taken', action);
    }

    if (severity && severity !== 'all') {
      query = query.eq('finding_severity', severity);
    }

    const { data: findings, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json({ findings: findings ?? [] });
  } catch (err: any) {
    console.error('Admin audit findings error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
