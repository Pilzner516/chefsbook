import { supabase } from '@chefsbook/db';

export function createClient() {
  return supabase;
}
