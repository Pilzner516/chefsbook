import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
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

    const { data: jobs } = await supabaseAdmin
      .from('import_completion_jobs')
      .select('id, recipe_id, status, error_message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const allJobs = jobs || [];
    const pending = allJobs.filter(j => j.status === 'pending').length;
    const processing = allJobs.filter(j => j.status === 'processing').length;
    const complete = allJobs.filter(j => j.status === 'complete').length;
    const failed = allJobs.filter(j => j.status === 'failed').length;

    const completedRecipeIds = allJobs
      .filter(j => j.status === 'complete')
      .slice(0, 5)
      .map(j => j.recipe_id);

    let recentlyCompleted: Array<{ recipeId: string; title: string }> = [];
    if (completedRecipeIds.length > 0) {
      const { data: recipes } = await supabaseAdmin
        .from('recipes')
        .select('id, title')
        .in('id', completedRecipeIds);
      recentlyCompleted = (recipes || []).map(r => ({
        recipeId: r.id,
        title: r.title,
      }));
    }

    return NextResponse.json({
      pending,
      processing,
      complete,
      failed,
      total: allJobs.length,
      isActive: pending + processing > 0,
      recentlyCompleted,
    });
  } catch (error) {
    console.error('[completion-status] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
