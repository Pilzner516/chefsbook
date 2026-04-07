import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
let _storageAdapter: any = undefined;

/**
 * Set a custom auth storage adapter (e.g. expo-secure-store) before the
 * Supabase client is first accessed. Must be called early in app startup.
 */
export function configureStorage(adapter: {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}): void {
  _storageAdapter = adapter;
}

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || !key) {
      console.warn('Supabase env vars missing — returning placeholder client');
    }
    _client = createClient(url, key, {
      auth: {
        ..._storageAdapter ? { storage: _storageAdapter } : {},
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});
