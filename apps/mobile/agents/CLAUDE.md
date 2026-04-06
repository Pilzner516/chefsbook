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

## ADB Screenshot Rules

- Always overwrite the same single file: /tmp/cb_screen.png
- Never create numbered or timestamped screenshot files
- Command to use every time:
  adb exec-out screencap -p > /tmp/cb_screen.png
- After capturing, describe what you see in text
- Do NOT embed the image in the conversation context
- Delete /tmp/cb_screen.png after reading it:
  Remove-Item /tmp/cb_screen.png -Force -ErrorAction SilentlyContinue

## File structure
- `app/` — Expo Router screens (file-based routing)
- `components/UIKit.tsx` — Reusable design system components
- `context/ThemeContext.tsx` — Theme provider (single "Trattoria" light palette)
- `constants/themes.ts` — Color palettes
- `lib/` — Utilities (image processing, sharing)
- `lib/zustand/` — State stores (auth, recipe, cookbook, mealPlan, shopping)

## Navigator Agent
Before doing any UI work, navigation, or screen testing:
READ .claude/agents/navigator.md

This file contains:
- Every screen route and file path
- ADB commands to navigate to any screen
- Screen coordinate maps for tapping
- What each screen looks like
- How to verify you reached the right screen

Update navigator.md whenever you add or modify any screen.
Add a changelog entry with the date and what changed.
