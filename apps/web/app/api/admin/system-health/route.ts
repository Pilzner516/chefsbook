import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';
import { execSync } from 'child_process';

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).single();
  return data ? user.id : null;
}

// Cache result for 60 seconds
let cachedResult: any = null;
let cachedAt = 0;

export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Serve cache if fresh
  if (cachedResult && Date.now() - cachedAt < 60000) {
    return NextResponse.json(cachedResult);
  }

  const checks = await Promise.allSettled([
    // Database
    (async () => {
      const t = Date.now();
      const { error } = await supabaseAdmin.from('user_profiles').select('id', { count: 'exact', head: true });
      return { status: error ? 'error' : 'online', latencyMs: Date.now() - t };
    })(),

    // Anthropic
    (async () => {
      const key = process.env.ANTHROPIC_API_KEY || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!key) return { status: 'error', latencyMs: 0 };
      const t = Date.now();
      try {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(5000),
        });
        return { status: res.ok ? 'online' : 'error', latencyMs: Date.now() - t };
      } catch {
        return { status: 'error', latencyMs: Date.now() - t };
      }
    })(),

    // Replicate
    (async () => {
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) return { status: 'error', latencyMs: 0 };
      const t = Date.now();
      try {
        const res = await fetch('https://api.replicate.com/v1/account', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        return { status: res.ok ? 'online' : 'error', latencyMs: Date.now() - t };
      } catch {
        return { status: 'error', latencyMs: Date.now() - t };
      }
    })(),

    // Disk
    (async () => {
      try {
        const out = execSync('df -h /mnt/chefsbook 2>/dev/null || df -h /', { timeout: 3000 }).toString();
        const lines = out.trim().split('\n');
        const parts = lines[lines.length - 1].split(/\s+/);
        const usedPct = parseInt(parts[4]?.replace('%', '') ?? '0', 10);
        const avail = parts[3] ?? '?';
        return {
          usedPercent: usedPct,
          availGb: avail,
          status: usedPct > 90 ? 'critical' : usedPct > 75 ? 'warning' : 'ok',
        };
      } catch {
        return { usedPercent: 0, availGb: '?', status: 'error' };
      }
    })(),

    // Memory
    (async () => {
      try {
        const out = execSync('free -m', { timeout: 3000 }).toString();
        const memLine = out.split('\n').find((l) => l.startsWith('Mem:'));
        if (!memLine) return { usedPercent: 0, availMb: 0, status: 'error' };
        const parts = memLine.split(/\s+/);
        const total = parseInt(parts[1], 10);
        const avail = parseInt(parts[6], 10);
        const usedPct = Math.round(((total - avail) / total) * 100);
        return {
          usedPercent: usedPct,
          availMb: avail,
          status: usedPct > 95 ? 'critical' : usedPct > 80 ? 'warning' : 'ok',
        };
      } catch {
        return { usedPercent: 0, availMb: 0, status: 'error' };
      }
    })(),

    // PM2
    (async () => {
      try {
        const out = execSync('pm2 jlist 2>/dev/null', { timeout: 3000 }).toString();
        const procs = JSON.parse(out);
        const web = procs.find((p: any) => p.name === 'chefsbook-web');
        if (!web) return { status: 'error', uptimeMs: 0, restarts: 0 };
        return {
          status: web.pm2_env?.status === 'online' ? 'online' : 'stopped',
          uptimeMs: web.pm2_env?.pm_uptime ? Date.now() - web.pm2_env.pm_uptime : 0,
          restarts: web.pm2_env?.restart_time ?? 0,
        };
      } catch {
        return { status: 'error', uptimeMs: 0, restarts: 0 };
      }
    })(),
  ]);

  const result = {
    database: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', latencyMs: 0 },
    anthropic: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', latencyMs: 0 },
    replicate: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'error', latencyMs: 0 },
    disk: checks[3].status === 'fulfilled' ? checks[3].value : { usedPercent: 0, availGb: '?', status: 'error' },
    memory: checks[4].status === 'fulfilled' ? checks[4].value : { usedPercent: 0, availMb: 0, status: 'error' },
    pm2: checks[5].status === 'fulfilled' ? checks[5].value : { status: 'error', uptimeMs: 0, restarts: 0 },
    checkedAt: new Date().toISOString(),
  };

  cachedResult = result;
  cachedAt = Date.now();

  return NextResponse.json(result);
}
