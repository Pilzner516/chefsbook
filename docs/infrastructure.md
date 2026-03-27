# Chefsbook Infrastructure

## Hardware: rpi5-eth (Raspberry Pi 5)

- **Device**: Raspberry Pi 5
- **Tailscale IP**: `100.110.47.62`
- **Hostname**: `rpi5-eth`
- **SSH access**: `ssh rasp@rpi5-eth`
- **Storage**: 54GB USB drive mounted at `/mnt/chefsbook`
- **Purpose**: Hosts the entire self-hosted Supabase stack (Postgres, Auth, Storage, REST API, Realtime)

## Supabase Self-Hosted

**NOT using supabase.com cloud** — everything runs on rpi5-eth.

| Service | URL |
|---|---|
| Supabase API | `http://100.110.47.62:8000` |
| Supabase Studio | `http://100.110.47.62:8000` |
| Postgres (internal) | `100.110.47.62:5432` (not exposed publicly) |

### Network

All access is via **Tailscale mesh networking**. The Pi is only reachable from devices on the Tailscale network — it is not exposed to the public internet.

### Docker Compose

The Supabase stack runs via Docker Compose:

```
/mnt/chefsbook/supabase/docker-compose.yml
```

All persistent data (Postgres, Storage objects) lives on the USB drive at `/mnt/chefsbook`.

### Environment Variables

Apps connect using these env vars (defined in `.env.local` at monorepo root):

```
EXPO_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
NEXT_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>  # server-side only
```

## Common Operations

### Restart Supabase

If Supabase goes down (Pi reboot, Docker crash, etc.):

```bash
ssh rasp@rpi5-eth
cd /mnt/chefsbook/supabase
sudo docker compose down
sudo docker compose up -d
```

Verify it's running:

```bash
sudo docker compose ps
```

All containers should show `Up` status: `supabase-db`, `supabase-auth`, `supabase-rest`, `supabase-storage`, `supabase-realtime`, `supabase-studio`, `supabase-kong`.

### Run a New Migration

From the monorepo root on your local machine:

```bash
ssh rasp@rpi5-eth "sudo docker exec -i supabase-db psql -U postgres -d postgres" < supabase/migrations/<filename>.sql
```

Or pipe SQL directly:

```bash
ssh rasp@rpi5-eth "sudo docker exec -i supabase-db psql -U postgres -d postgres -c 'SELECT 1;'"
```

### Access Postgres Directly

```bash
ssh rasp@rpi5-eth "sudo docker exec -it supabase-db psql -U postgres -d postgres"
```

### Check Disk Usage

The USB drive has 54GB total. Check remaining space:

```bash
ssh rasp@rpi5-eth "df -h /mnt/chefsbook"
```

### View Docker Logs

```bash
ssh rasp@rpi5-eth "sudo docker logs supabase-db --tail 50"
ssh rasp@rpi5-eth "sudo docker logs supabase-auth --tail 50"
```

## Database Schema Overview

16 tables across these domains:

- **Users**: `user_profiles`, `follows`
- **Recipes**: `recipes`, `recipe_ingredients`, `recipe_steps`, `cookbooks`
- **Categories**: `category_groups`, `categories`, `recipe_categories`
- **Planning**: `meal_plans`, `menu_templates`
- **Shopping**: `shopping_lists`, `shopping_list_items`
- **Import**: `import_jobs`, `import_job_urls`
- **Notes**: `cooking_notes`

5 custom Postgres functions: `search_recipes`, `get_meal_plan_week`, `generate_shopping_list`, `clone_recipe`, `get_public_feed`.

2 storage buckets: `recipe-images` (5MB), `avatars` (2MB).

See `supabase/migrations/README.md` for detailed migration documentation.
