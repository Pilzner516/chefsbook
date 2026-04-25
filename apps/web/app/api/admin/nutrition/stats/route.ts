import { NextRequest } from 'next/server';
import { supabase, supabaseAdmin } from '@chefsbook/db';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin.rpc('get_nutrition_stats');

  if (error) {
    const { count: total } = await supabaseAdmin
      .from('recipes')
      .select('*', { count: 'exact', head: true });

    const { count: hasNutrition } = await supabaseAdmin
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .not('nutrition', 'is', null);

    return Response.json({
      total: total ?? 0,
      hasNutrition: hasNutrition ?? 0,
      needsNutrition: (total ?? 0) - (hasNutrition ?? 0),
    });
  }

  return Response.json(data);
}
