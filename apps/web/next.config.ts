import type { NextConfig } from 'next';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load root .env.local so the monorepo shares a single env file
function loadRootEnv() {
  const envPath = resolve(process.cwd(), '../../.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    // Strip inline comments (e.g. "value  # comment")
    const hashIdx = value.indexOf('#');
    if (hashIdx > 0) value = value.slice(0, hashIdx);
    value = value.trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadRootEnv();

const nextConfig: NextConfig = {
  transpilePackages: ['@chefsbook/db', '@chefsbook/ai', '@chefsbook/ui'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

export default nextConfig;
