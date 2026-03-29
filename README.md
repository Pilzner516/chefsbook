# ChefsBook

Recipe manager for home cooks. Scan handwritten cards, import from any URL or YouTube video, plan meals, and generate shopping lists.

## Stack

- **Web**: Next.js 15, React 19, Tailwind CSS 3
- **Mobile**: Expo SDK 54, React Native 0.81, Expo Router v6
- **Database**: Self-hosted Supabase (PostgreSQL + Auth + Storage)
- **AI**: Claude Sonnet via Anthropic API
- **Monorepo**: Turborepo with npm workspaces

## Workspaces

| Package | Path | Description |
|---------|------|-------------|
| `@chefsbook/web` | `apps/web` | Next.js web app |
| `@chefsbook/mobile` | `apps/mobile` | Expo mobile app |
| `@chefsbook/db` | `packages/db` | Supabase client, queries, types |
| `@chefsbook/ai` | `packages/ai` | Claude API wrapper for recipe extraction |
| `@chefsbook/ui` | `packages/ui` | Shared formatting utilities |
| Extension | `apps/extension` | Chrome/Edge browser extension |

## Quick Start

```bash
# Install dependencies
npm install

# Start all apps
turbo dev

# Or individually
npm run web    # Next.js dev server
npm run mobile # Expo dev client
```

## Environment

Copy `.env.local.example` to `.env.local` at the monorepo root. See `CLAUDE.md` for all required environment variables.

## Development

```bash
# Type checking
cd apps/web && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit

# Lint (web only)
cd apps/web && npm run lint
```

See `CLAUDE.md` for full architecture documentation, critical patterns, and development guidelines.
