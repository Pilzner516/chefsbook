import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || !key) {
      console.warn('Supabase env vars missing — returning placeholder client');
    }
    _client = createClient(url, key);
  }
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});
