import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { jobIds } = body as { jobIds?: string[] };

    let query = supabaseAdmin
      .from('import_completion_jobs')
      .update({
        status: 'pending',
        attempts: 0,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'failed');

    if (jobIds && jobIds.length > 0) {
      query = query.in('id', jobIds);
    }

    const { data, error } = await query.select('id');

    if (error) {
      console.error('[retry-failed] Error:', error);
      return NextResponse.json({ error: 'Failed to reset jobs' }, { status: 500 });
    }

    return NextResponse.json({ reset: data?.length || 0 });
  } catch (error) {
    console.error('[retry-failed] Error:', error);
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 });
  }
}
