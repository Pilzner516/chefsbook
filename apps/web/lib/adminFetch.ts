import { supabase } from '@chefsbook/db';

/** Fetch from /api/admin with the user's JWT for auth. */
export async function adminFetch(params: Record<string, string>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/admin?${qs}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/** POST to /api/admin with the user's JWT. */
export async function adminPost(body: Record<string, any>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}
