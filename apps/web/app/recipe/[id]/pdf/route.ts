import { NextRequest, NextResponse } from 'next/server';
import { supabase, getRecipe } from '@chefsbook/db';
import { PLAN_LIMITS } from '@chefsbook/db';
import type { PlanTier } from '@chefsbook/db';
import { renderToBuffer } from '@react-pdf/renderer';
import { RecipePdfDocument } from './RecipePdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Auth check
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  } else {
    // Try session cookie
    const { data: { session } } = await supabase.auth.getSession();
    userId = session?.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Plan check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan_tier')
    .eq('id', userId)
    .single();

  const plan = (profile?.plan_tier as PlanTier) ?? 'free';
  if (!PLAN_LIMITS[plan]?.canPDF) {
    return NextResponse.json({ error: 'Pro plan required for PDF export' }, { status: 403 });
  }

  // Fetch recipe
  const recipe = await getRecipe(id);
  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  // Fetch author info
  const { data: author } = await supabase
    .from('user_profiles')
    .select('username, display_name')
    .eq('id', recipe.user_id)
    .single();

  // Generate PDF
  const pdfBuffer = await renderToBuffer(
    RecipePdfDocument({
      recipe,
      authorUsername: author?.username ?? null,
      authorName: author?.display_name ?? null,
    }),
  );

  const filename = recipe.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  });
}
