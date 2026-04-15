import { NextRequest, NextResponse } from 'next/server';
import { supabase, getUserImportStats, getUserIncompleteRecipes } from '@chefsbook/db';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = await getUserImportStats(user.id);
  const incomplete = await getUserIncompleteRecipes(user.id);
  return NextResponse.json({ stats, incomplete });
}
