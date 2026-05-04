# Cron Setup for Knowledge Gap Detection

## Overview

The knowledge gap detection job runs daily at 3am to identify technique+ingredient combinations that need more data.

## Prerequisites

1. The web app must be running on slux (pm2 process: chefsbook-web)
2. The SUPABASE_SERVICE_ROLE_KEY must be available in the environment

## Installation

### 1. Create log directory

```bash
ssh pilzner@slux
sudo mkdir -p /opt/luxlabs/chefsbook/logs
sudo chown pilzner:pilzner /opt/luxlabs/chefsbook/logs
```

### 2. Make the cron script executable

```bash
ssh pilzner@slux
chmod +x /opt/luxlabs/chefsbook/repo/scripts/cron-gap-detection.sh
```

### 3. Add SUPABASE_SERVICE_ROLE_KEY to environment

Add to `/home/pilzner/.bashrc` or create `/opt/luxlabs/chefsbook/cron.env`:

```bash
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

### 4. Add to crontab

```bash
ssh pilzner@slux
crontab -e
```

Add this line:

```
# Knowledge gap detection - runs daily at 3am
0 3 * * * export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" && /opt/luxlabs/chefsbook/repo/scripts/cron-gap-detection.sh
```

Or source the environment file:

```
# Knowledge gap detection - runs daily at 3am
0 3 * * * . /opt/luxlabs/chefsbook/cron.env && /opt/luxlabs/chefsbook/repo/scripts/cron-gap-detection.sh
```

## Verification

### Check if cron is running

```bash
ssh pilzner@slux
crontab -l | grep gap-detection
```

### Manually test the script

```bash
ssh pilzner@slux
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
/opt/luxlabs/chefsbook/repo/scripts/cron-gap-detection.sh
```

### View logs

```bash
ssh pilzner@slux
tail -f /opt/luxlabs/chefsbook/logs/gap-detection.log
```

### Check recent runs

```bash
ssh pilzner@slux
tail -20 /opt/luxlabs/chefsbook/logs/gap-detection.log
```

## Troubleshooting

### Job not running

1. Check crontab is set: `crontab -l`
2. Check cron service: `systemctl status cron`
3. Check script permissions: `ls -l /opt/luxlabs/chefsbook/repo/scripts/cron-gap-detection.sh`

### Authentication errors

1. Verify SUPABASE_SERVICE_ROLE_KEY is set correctly
2. Check the key has admin permissions in the database

### API errors

1. Check web app is running: `pm2 status chefsbook-web`
2. Check web logs: `pm2 logs chefsbook-web`
3. Manually test the API: `curl -X POST http://localhost:3000/api/admin/knowledge-gaps/detect -H "Authorization: Bearer <key>"`

## Alternative: Using pm2-cron

Instead of system cron, you can use pm2-cron for better integration with the pm2 process manager:

```bash
npm install pm2-cron -g
pm2 install pm2-cron
```

Then create a cron config in ecosystem.config.js (if using pm2 ecosystem).

## What the job does

1. Queries `cooking_action_timings` for entries with low observations or low confidence
2. Identifies high-frequency technique+ingredient combos in `recipe_steps` not yet in `cooking_action_timings`
3. Upserts `knowledge_gaps` table with detected gaps
4. Marks gaps as `filled` where observation thresholds are met
5. Returns counts: `{ detected: N, updated: N, filled: N }`

## Next steps

After the cron job is running, monitor the first few runs to ensure:
- Gaps are being detected (check `knowledge_gaps` table)
- No errors in logs
- Performance is acceptable (<10s execution time)
