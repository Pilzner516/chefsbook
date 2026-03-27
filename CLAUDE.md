# Chefsbook — Claude Code Instructions

Multi-tenant SaaS recipe app. Turborepo monorepo with apps/mobile (Expo SDK 54),
apps/web (Next.js 15), and shared packages/db, packages/ai, packages/ui.

See `apps/mobile/agents/CLAUDE.md` for full mobile app instructions.

## Infrastructure

- **Supabase**: Self-hosted on rpi5-eth (Raspberry Pi 5) at http://100.110.47.62:8000
- **Supabase Studio**: http://100.110.47.62:8000 (login: supabase)
- **Supabase API**: http://100.110.47.62:8000
- **Postgres**: port 5432 on 100.110.47.62 (internal, not exposed publicly)
- **Network**: Tailscale mesh — accessible from any device on the Tailscale network
- **Storage**: 54GB USB drive mounted at /mnt/chefsbook on rpi5-eth
- **NOT using**: supabase.com cloud — all Supabase is self-hosted

## Environment variables (in .env.local at monorepo root)
```
EXPO_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
NEXT_PUBLIC_SUPABASE_URL=http://100.110.47.62:8000
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## Critical patterns

1. ALWAYS import supabase from `@chefsbook/db` — never call createClient() directly
2. ALWAYS import AI functions from `@chefsbook/ai` — never call the Claude API directly in app code
3. ALWAYS use `useTheme().colors` — never hardcode hex values anywhere
4. ALWAYS follow the Zustand store pattern in `apps/mobile/lib/zustand/authStore.ts`
5. NEVER commit `.env.local` — all keys stay out of git

## Build commands
- Mobile dev:     `cd apps/mobile && npx expo start --dev-client`
- Web dev:        `cd apps/web && npm run dev`
- All:            `turbo dev` (from root)
