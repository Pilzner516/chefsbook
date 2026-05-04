import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@chefsbook/db';
import { detectKnowledgeGaps } from '@chefsbook/ai';

/**
 * POST /api/admin/knowledge-gaps/detect
 *
 * Triggers the knowledge gap detection job.
 * Super admin only.
 *
 * Returns: { detected, updated, filled }
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Super admin only' }, { status: 403 });
    }

    // Run gap detection
    const result = await detectKnowledgeGaps();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Gap detection error:', error);
    return NextResponse.json({ error: error.message || 'Failed to detect gaps' }, { status: 500 });
  }
}
