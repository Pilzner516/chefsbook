import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@chefsbook/db';

// Called by external scheduler (PM2 cron job on RPi5).
// Checks scheduled_jobs for enabled jobs where last_run_at is older than schedule window.
// Requires x-cron-secret header matching CRON_SECRET env var.

export async function POST(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: jobs } = await supabaseAdmin
    .from('scheduled_jobs')
    .select('*')
    .eq('is_enabled', true);

  const triggered: string[] = [];
  for (const job of jobs ?? []) {
    if (job.job_name === 'site_compatibility_test') {
      const lastRun = job.last_run_at ? new Date(job.last_run_at).getTime() : 0;
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastRun < weekMs) continue;
      triggered.push(job.job_name);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      fetch(`${baseUrl}/api/admin/test-sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET ?? '' },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }

  // Monthly throttle reset — first day of the month
  if (new Date().getDate() === 1) {
    try {
      await supabaseAdmin
        .from('user_throttle')
        .update({
          is_throttled: false,
          throttle_level: null,
          throttled_at: null,
          throttled_reason: null,
          monthly_cost_usd: 0,
          monthly_cost_updated_at: new Date().toISOString(),
        })
        .eq('admin_override', false)
        .eq('is_throttled', true);
      triggered.push('monthly_throttle_reset');
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ ok: true, triggered });
}
