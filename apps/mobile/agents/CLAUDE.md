# Chefsbook Mobile — Agent Instructions

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

## Architecture
Expo SDK 54 + React Native 0.81 + Expo Router v6 (file-based routing).
Zustand v5 for state management. NativeWind v4 for styling.

## Key patterns
- Import supabase from `@chefsbook/db` — never call createClient() directly
- Import AI functions from `@chefsbook/ai`
- Use `useTheme().colors` for all styling — never hardcode hex values
- Follow Zustand store pattern in `lib/zustand/authStore.ts`
- Image pipeline: expo-image-picker -> expo-image-manipulator (1024px, 85% JPEG) -> base64 -> scanRecipe

## File structure
- `app/` — Expo Router screens (file-based routing)
- `components/UIKit.tsx` — Reusable design system components
- `context/ThemeContext.tsx` — Theme provider with dark/light modes
- `constants/themes.ts` — Color palettes
- `lib/` — Utilities (image processing, sharing)
- `lib/zustand/` — State stores (auth, recipe, cookbook, mealPlan, shopping)
