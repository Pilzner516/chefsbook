import { supabase, supabaseAdmin } from '@chefsbook/db';
import { IMAGE_THEMES } from '@chefsbook/ai';

export async function PATCH(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { theme } = await req.json();
  if (!theme || !(theme in IMAGE_THEMES)) {
    return Response.json({ error: 'Invalid theme' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ image_theme: theme })
    .eq('id', user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, theme });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('image_theme')
    .eq('id', user.id)
    .single();

  return Response.json({ theme: data?.image_theme ?? 'bright_fresh' });
}
