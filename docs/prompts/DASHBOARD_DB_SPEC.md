# Mission: Fix DATABASE_URL connection for LuxLabs Dashboard

## Context
- LuxLabs Dashboard running via PM2 at ~/luxlabs-dashboard/
- Supabase self-hosted via Docker at /opt/luxlabs/chefsbook/supabase/
- Dashboard server.js uses `pg` Pool to connect to Postgres
- Current error: "Tenant or user not found" — connection hitting PgBouncer, not raw Postgres
- ecosystem.config.js is at ~/luxlabs-dashboard/ecosystem.config.js
- Supabase .env is at /opt/luxlabs/chefsbook/supabase/.env
- Supabase docker-compose is at /opt/luxlabs/chefsbook/supabase/docker-compose.yml

## Mission
Find the correct connection string to reach the raw Postgres instance (bypassing PgBouncer)
and wire it up so the dashboard's /api/supabase and /api/live endpoints return real data.

## Steps

1. Run `docker ps --format "{{.Names}}\t{{.Ports}}"` to see all container port mappings
2. Run `ss -tlnp | grep -E "543|5432|5433"` to find what's listening locally
3. Read /opt/luxlabs/chefsbook/supabase/docker-compose.yml — find the db/postgres service
   and its port mapping (host:container). The raw Postgres port is NOT 5432 (that's PgBouncer).
4. Read /opt/luxlabs/chefsbook/supabase/.env — extract POSTGRES_PASSWORD
5. Test the direct connection on the discovered port:
   ```
   node -e "
   const {Pool}=require('/home/pilzner/luxlabs-dashboard/node_modules/pg');
   const p=new Pool({connectionString:'postgresql://postgres:PASSWORD@localhost:REAL_PORT/postgres'});
   p.query('SELECT version()').then(r=>console.log('OK',r.rows[0])).catch(e=>console.log('ERR',e.message));
   "
   ```
6. Once connection succeeds, update ~/luxlabs-dashboard/ecosystem.config.js with the working
   DATABASE_URL (correct user, password, host, port)
7. Restart the dashboard:
   ```
   pm2 stop luxlabs-dashboard
   pm2 delete luxlabs-dashboard
   pm2 start ~/luxlabs-dashboard/ecosystem.config.js
   pm2 save
   ```
8. Verify both endpoints return real data:
   ```
   curl -s http://localhost:9000/api/supabase | python3 -m json.tool | head -15
   curl -s http://localhost:9000/api/live | python3 -m json.tool | head -15
   ```
9. Check pm2 logs for any remaining DB errors:
   ```
   pm2 logs luxlabs-dashboard --lines 10 --nostream
   ```

## Done When
- `curl http://localhost:9000/api/supabase` returns `"configured": true` with dbSize, tables array
- `curl http://localhost:9000/api/live` returns `"configured": true` with onlineUsers, totalUsers
- No "Tenant or user not found" errors in pm2 logs
- `pm2 save` completed successfully

## Do NOT
- Modify anything in /opt/luxlabs/chefsbook/repo/
- Restart chefsbook-web or cloudflared-tunnel
- Change any Supabase Docker configuration
- Run npm install (pg is already installed)
