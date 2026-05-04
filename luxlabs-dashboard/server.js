const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = 9000;

// CORS and JSON middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Postgres connection pool (max 3 connections)
let pgPool = null;
if (process.env.DATABASE_URL) {
  try {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
    console.log('[DB] PostgreSQL pool initialized');
  } catch (err) {
    console.error('[DB] Failed to create pool:', err.message);
  }
}

// Helper: Execute shell command with timeout
function execCommand(command, timeout = 5000) {
  return new Promise((resolve) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[CMD] Error executing: ${command}`, error.message);
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Helper: Execute DB query with error handling
async function queryDB(sql, params = []) {
  if (!pgPool) {
    return { configured: false };
  }

  try {
    const result = await pgPool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    return { configured: false, error: err.message };
  }
}

// Helper: Get system stats (used by /api/system and /api/alerts)
async function getSystemStats() {
  const [cpuData, meminfoData, loadavgData, uptimeData, hostnameData, psData] = await Promise.all([
    execCommand('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\''),
    execCommand('cat /proc/meminfo | head -3'),
    execCommand('cat /proc/loadavg'),
    execCommand('uptime -p'),
    execCommand('hostname'),
    execCommand('ps aux --sort=-%cpu | head -6'),
  ]);

  // Parse CPU from top (current usage, not since-boot)
  let cpu = 0;
  if (cpuData) {
    cpu = parseFloat(cpuData) || 0;
  }

  // Parse RAM from /proc/meminfo
  let ram = { used: 0, total: 0, pct: 0 };
  if (meminfoData) {
    const lines = meminfoData.split('\n');
    const totalKB = parseInt(lines[0].match(/\d+/)[0]);
    const availKB = parseInt(lines[2].match(/\d+/)[0]);
    const usedKB = totalKB - availKB;
    ram = {
      used: Math.round(usedKB / 1024),
      total: Math.round(totalKB / 1024),
      pct: (usedKB / totalKB * 100).toFixed(1),
    };
  }

  // Parse load average
  let load = { '1m': 0, '5m': 0, '15m': 0 };
  if (loadavgData) {
    const parts = loadavgData.split(/\s+/);
    load = { '1m': parseFloat(parts[0]), '5m': parseFloat(parts[1]), '15m': parseFloat(parts[2]) };
  }

  // Parse top 5 processes
  let processes = [];
  if (psData) {
    const lines = psData.split('\n').slice(1); // skip header
    processes = lines
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          user: parts[0],
          cpu: parseFloat(parts[2]),
          cmd: parts.slice(10).join(' ').substring(0, 40),
        };
      })
      .filter(p => p.user) // filter out malformed lines
      .slice(0, 5);
  }

  return {
    cpu: parseFloat(cpu),
    ram,
    load,
    uptime: uptimeData || 'unknown',
    hostname: hostnameData || 'unknown',
    processes,
  };
}

// GET /api/system - System vitals
app.get('/api/system', async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json(stats);
  } catch (err) {
    console.error('[API] /api/system error:', err);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// GET /api/network - Network status
app.get('/api/network', async (req, res) => {
  try {
    const [ipData, tsData, ping1, ping2, curlData, netdevData, sshData] = await Promise.all([
      execCommand('ip -4 addr show | grep -oP "(?<=inet )\\d+\\.\\d+\\.\\d+\\.\\d+" | grep -v "127.0.0.1" | head -1'),
      execCommand('tailscale status --json'),
      execCommand('ping -c 1 -W 2 1.1.1.1 | grep time= | grep -oP "time=\\K[0-9.]+"'),
      execCommand('ping -c 1 -W 2 8.8.8.8 | grep time= | grep -oP "time=\\K[0-9.]+"'),
      execCommand('curl -o /dev/null -s -w "%{time_total}" --max-time 5 https://chefsbk.app'),
      execCommand('cat /proc/net/dev | grep -E "eth0|ens|enp" | head -1'),
      execCommand('ss -tnp 2>/dev/null | grep ":22 " | grep ESTAB | wc -l'),
    ]);

    // Parse Tailscale
    let tailscale = { ip: null, peers: 0 };
    if (tsData) {
      try {
        const ts = JSON.parse(tsData);
        tailscale.ip = ts.Self?.TailscaleIPs?.[0] || null;
        tailscale.peers = Object.keys(ts.Peer || {}).length;
      } catch (e) {
        console.error('[API] Tailscale JSON parse error:', e.message);
      }
    }

    // Parse bandwidth from /proc/net/dev
    let bandwidth = { rx: 0, tx: 0 };
    if (netdevData) {
      const parts = netdevData.trim().split(/\s+/);
      bandwidth.rx = Math.round(parseInt(parts[1]) / 1024 / 1024); // MB
      bandwidth.tx = Math.round(parseInt(parts[9]) / 1024 / 1024); // MB
    }

    res.json({
      lan: ipData || 'unknown',
      tailscale,
      ping: {
        cloudflare: ping1 ? parseFloat(ping1) : null,
        google: ping2 ? parseFloat(ping2) : null,
      },
      chefsbkResponseTime: curlData ? (parseFloat(curlData) * 1000).toFixed(0) : null,
      bandwidth,
      sshSessions: sshData ? parseInt(sshData) : 0,
    });
  } catch (err) {
    console.error('[API] /api/network error:', err);
    res.status(500).json({ error: 'Failed to fetch network stats' });
  }
});

// GET /api/chefsbook - ChefsBook health
app.get('/api/chefsbook', async (req, res) => {
  try {
    const [pm2Data, port3000, port3001, port8000, port5432, dockerData] = await Promise.all([
      execCommand('pm2 jlist'),
      execCommand('ss -tlnp 2>/dev/null | grep ":3000 "'),
      execCommand('ss -tlnp 2>/dev/null | grep ":3001 "'),
      execCommand('ss -tlnp 2>/dev/null | grep ":8000 "'),
      execCommand('ss -tlnp 2>/dev/null | grep ":5432 "'),
      execCommand('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}"'),
    ]);

    // Parse PM2
    let pm2 = [];
    if (pm2Data) {
      try {
        const processes = JSON.parse(pm2Data);
        pm2 = processes.map(p => ({
          name: p.name,
          status: p.pm2_env?.status || 'unknown',
          memory: Math.round(p.monit?.memory / 1024 / 1024) || 0,
          restarts: p.pm2_env?.restart_time || 0,
        }));
      } catch (e) {
        console.error('[API] PM2 JSON parse error:', e.message);
      }
    }

    // Parse ports
    const ports = {
      3000: !!port3000,
      3001: !!port3001,
      8000: !!port8000,
      5432: !!port5432,
    };

    // Parse Docker containers
    let containers = [];
    if (dockerData) {
      containers = dockerData.split('\n').map(line => {
        const [name, status, image] = line.split('|');
        return { name, status, image };
      });
    }

    res.json({ pm2, ports, containers });
  } catch (err) {
    console.error('[API] /api/chefsbook error:', err);
    res.status(500).json({ error: 'Failed to fetch ChefsBook stats' });
  }
});

// Helper: Get infrastructure stats (used by /api/infrastructure and /api/alerts)
async function getInfrastructureStats() {
  const [dfData, tempData, dockerSvc, tailscaleSvc, cronSvc, cloudflaredSvc] = await Promise.all([
    execCommand('df -h / | tail -1'),
    execCommand('cat /sys/class/thermal/thermal_zone0/temp'),
    execCommand('systemctl is-active docker'),
    execCommand('systemctl is-active tailscaled'),
    execCommand('systemctl is-active cron'),
    execCommand('systemctl is-active cloudflared 2>/dev/null || echo inactive'),
  ]);

  // Parse disk
  let disk = { used: 0, total: 0, pct: 0 };
  if (dfData) {
    const parts = dfData.trim().split(/\s+/);
    disk = {
      used: parts[2],
      total: parts[1],
      pct: parseInt(parts[4]),
    };
  }

  // Parse temp
  let tempC = 0;
  if (tempData) {
    tempC = Math.round(parseInt(tempData) / 1000);
  }

  // Service statuses
  const services = [
    { name: 'docker', active: dockerSvc === 'active' },
    { name: 'tailscaled', active: tailscaleSvc === 'active' },
    { name: 'cron', active: cronSvc === 'active' },
    { name: 'cloudflared', active: cloudflaredSvc === 'active' },
    { name: 'pm2', active: true }, // if this API is responding, PM2 is running
  ];

  return { disk, tempC, services };
}

// GET /api/infrastructure - Infrastructure status
app.get('/api/infrastructure', async (req, res) => {
  try {
    const stats = await getInfrastructureStats();
    res.json(stats);
  } catch (err) {
    console.error('[API] /api/infrastructure error:', err);
    res.status(500).json({ error: 'Failed to fetch infrastructure stats' });
  }
});

// GET /api/supabase - Supabase stats
app.get('/api/supabase', async (req, res) => {
  if (!pgPool) {
    return res.json({ configured: false });
  }

  try {
    const [dbSizeResult, connStatesResult, activeQueriesResult, tablesResult] = await Promise.all([
      queryDB("SELECT pg_size_pretty(pg_database_size('postgres')) as size"),
      queryDB("SELECT state, count(*) as count FROM pg_stat_activity GROUP BY state"),
      queryDB("SELECT pid, EXTRACT(EPOCH FROM (now() - query_start)) as duration, query, state FROM pg_stat_activity WHERE state='active' AND query IS NOT NULL AND query NOT ILIKE '%pg_stat_activity%' LIMIT 5"),
      queryDB("SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_live_tup DESC LIMIT 8"),
    ]);

    // Handle DB connection failure
    if (dbSizeResult.configured === false) {
      return res.json({ configured: false });
    }

    const dbSize = dbSizeResult[0]?.size || 'unknown';
    const connections = connStatesResult || [];
    const activeQueries = activeQueriesResult.map(q => ({
      pid: q.pid,
      duration: Math.round(q.duration),
      query: q.query.substring(0, 80),
      state: q.state,
    }));
    const tables = tablesResult.map(t => ({
      name: t.relname,
      rows: t.n_live_tup,
      size: t.size,
    }));

    res.json({ dbSize, connections, activeQueries, tables });
  } catch (err) {
    console.error('[API] /api/supabase error:', err);
    res.json({ configured: false, error: err.message });
  }
});

// GET /api/live - Live activity
app.get('/api/live', async (req, res) => {
  if (!pgPool) {
    return res.json({ configured: false });
  }

  try {
    const [onlineResult, totalResult, sessionsResult, realtimeResult, aiActivityResult, recipesTodayResult, aiCalls24hResult, aiCalls1hResult, aiCost24hResult] = await Promise.all([
      queryDB("SELECT count(*) as count FROM public.user_profiles WHERE last_seen_at > now() - interval '5 minutes'"),
      queryDB("SELECT count(*) as count FROM auth.users"),
      queryDB("SELECT count(*) as count FROM auth.sessions WHERE not_after > now()"),
      queryDB("SELECT count(*) as count FROM pg_stat_activity WHERE application_name ILIKE '%realtime%' OR application_name ILIKE '%postgrest%'"),
      queryDB("SELECT action, model, cost_usd, created_at FROM public.ai_usage_log ORDER BY created_at DESC LIMIT 12"),
      queryDB("SELECT count(*) as count FROM public.recipes WHERE created_at::date = CURRENT_DATE"),
      queryDB("SELECT count(*) as count FROM public.ai_usage_log WHERE created_at > now() - interval '24 hours'"),
      queryDB("SELECT count(*) as count FROM public.ai_usage_log WHERE created_at > now() - interval '1 hour'"),
      queryDB("SELECT COALESCE(SUM(cost_usd), 0) as total FROM public.ai_usage_log WHERE created_at > now() - interval '24 hours'"),
    ]);

    // Handle DB connection failure
    if (onlineResult.configured === false) {
      return res.json({ configured: false });
    }

    res.json({
      onlineNow: onlineResult[0]?.count || 0,
      totalUsers: totalResult[0]?.count || 0,
      activeSessions: sessionsResult[0]?.count || 0,
      realtimeConns: realtimeResult[0]?.count || 0,
      aiActivity: aiActivityResult || [],
      dailyStats: {
        recipesAdded: recipesTodayResult[0]?.count || 0,
        aiCalls24h: aiCalls24hResult[0]?.count || 0,
        aiCalls1h: aiCalls1hResult[0]?.count || 0,
        aiCost24h: parseFloat(aiCost24hResult[0]?.total || 0).toFixed(3),
      },
    });
  } catch (err) {
    console.error('[API] /api/live error:', err);
    res.json({ configured: false, error: err.message });
  }
});

// GET /api/alerts - System alerts
app.get('/api/alerts', async (req, res) => {
  try {
    // Get current stats directly (not via HTTP loopback)
    const [systemData, infraData, tailscaleData] = await Promise.all([
      getSystemStats().catch(() => ({})),
      getInfrastructureStats().catch(() => ({})),
      execCommand('tailscale status --json'),
    ]);

    const alerts = [];

    // CPU alerts
    if (systemData.cpu > 85) {
      alerts.push({ level: 'critical', msg: `CPU at ${systemData.cpu}%`, source: 'system' });
    } else if (systemData.cpu > 65) {
      alerts.push({ level: 'warning', msg: `CPU at ${systemData.cpu}%`, source: 'system' });
    }

    // RAM alerts
    if (systemData.ram?.pct > 90) {
      alerts.push({ level: 'critical', msg: `RAM at ${systemData.ram.pct}%`, source: 'system' });
    } else if (systemData.ram?.pct > 75) {
      alerts.push({ level: 'warning', msg: `RAM at ${systemData.ram.pct}%`, source: 'system' });
    }

    // Disk alerts
    if (infraData.disk?.pct > 90) {
      alerts.push({ level: 'critical', msg: `Disk at ${infraData.disk.pct}%`, source: 'infrastructure' });
    } else if (infraData.disk?.pct > 75) {
      alerts.push({ level: 'warning', msg: `Disk at ${infraData.disk.pct}%`, source: 'infrastructure' });
    }

    // Temperature alerts
    if (infraData.tempC > 80) {
      alerts.push({ level: 'critical', msg: `CPU temp ${infraData.tempC}°C`, source: 'infrastructure' });
    } else if (infraData.tempC > 65) {
      alerts.push({ level: 'warning', msg: `CPU temp ${infraData.tempC}°C`, source: 'infrastructure' });
    }

    // Tailscale alert
    let tsActive = false;
    if (tailscaleData) {
      try {
        const ts = JSON.parse(tailscaleData);
        tsActive = ts.BackendState === 'Running';
      } catch (e) {}
    }
    if (!tsActive) {
      alerts.push({ level: 'critical', msg: 'Tailscale offline', source: 'network' });
    }

    // Docker alert
    const dockerActive = infraData.services?.find(s => s.name === 'docker')?.active;
    if (!dockerActive) {
      alerts.push({ level: 'critical', msg: 'Docker service inactive', source: 'infrastructure' });
    }

    // Return ok if no alerts
    if (alerts.length === 0) {
      return res.json({ level: 'ok', msg: 'All systems nominal', alerts: [] });
    }

    res.json({ alerts });
  } catch (err) {
    console.error('[API] /api/alerts error:', err);
    res.status(500).json({ error: 'Failed to generate alerts' });
  }
});

// GET /api/activity - Recent activity
app.get('/api/activity', async (req, res) => {
  try {
    const [loginsData, logsData] = await Promise.all([
      execCommand('last -n 6 2>/dev/null | head -6'),
      execCommand('pm2 logs --nostream --lines 8 2>/dev/null'),
    ]);

    res.json({
      logins: loginsData ? loginsData.split('\n') : [],
      logs: logsData ? logsData.split('\n').slice(-5) : [],
    });
  } catch (err) {
    console.error('[API] /api/activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] LuxLabs Dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`[DB] PostgreSQL pool: ${pgPool ? 'CONFIGURED' : 'NOT CONFIGURED (set DATABASE_URL env var)'}`);
});
